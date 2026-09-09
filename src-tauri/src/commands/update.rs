use crate::proxy::apply_proxy_from_settings;
use crate::state::AppState;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[tauri::command]
pub async fn check_app_update(app: AppHandle, current_version: String) -> Result<Value, String> {
    apply_proxy_from_settings(&app);
    let (mut rx, _child) = app
        .shell()
        .sidecar("deno-engine")
        .map_err(|e| e.to_string())?
        .args(&["check-app-update", &current_version])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut output_str = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                output_str.push_str(&String::from_utf8_lossy(&line_bytes));
            }
            CommandEvent::Stderr(line_bytes) => {
                let err_line = String::from_utf8_lossy(&line_bytes);
                eprintln!("[Sidecar Update Check Error]: {}", err_line);
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    for line in output_str.lines() {
        if let Ok(json_val) = serde_json::from_str::<Value>(line) {
            if json_val.get("status").and_then(|s| s.as_str()) == Some("success") {
                return Ok(json_val);
            } else if json_val.get("status").and_then(|s| s.as_str()) == Some("error") {
                return Err(json_val
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("Failed to check update")
                    .to_string());
            }
        }
    }

    Err("Could not retrieve update info from sidecar".to_string())
}

#[tauri::command]
pub fn start_app_update_download(
    app: AppHandle,
    url: String,
    save_dir: String,
    file_name: String,
) -> Result<(), String> {
    apply_proxy_from_settings(&app);
    let (mut rx, _child) = app
        .shell()
        .sidecar("deno-engine")
        .map_err(|e| e.to_string())?
        .args(&["download-app-update", &url, &save_dir, &file_name])
        .spawn()
        .map_err(|e| e.to_string())?;

    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    for single_line in line.lines() {
                        if let Ok(payload) = serde_json::from_str::<Value>(single_line) {
                            let _ = app_clone.emit("update-progress", payload);
                        }
                    }
                }
                CommandEvent::Stderr(line_bytes) => {
                    let err_line = String::from_utf8_lossy(&line_bytes);
                    eprintln!("[Sidecar Update Download Error]: {}", err_line);
                }
                _ => {}
            }
        }
    });

    Ok(())
}

/// Manual "update download tools now" — honors nothing, just forces the
/// sidecar `update` flow and streams its updating/ready lines to the
/// frontend as `info-progress` events (same channel as get_video_info).
#[tauri::command]
pub async fn update_tools(app: AppHandle, state: tauri::State<'_, AppState>) -> Result<(), String> {
    // Replacing tool binaries mid-download corrupts in-flight jobs
    // (and fails on Windows file locks) — refuse while busy.
    if let Ok(active) = state.active_downloads.lock() {
        if !active.is_empty() {
            return Err("Cannot update tools while downloads are running. Pause or wait, then retry.".to_string());
        }
    }
    apply_proxy_from_settings(&app);
    let (mut rx, _child) = app
        .shell()
        .sidecar("deno-engine")
        .map_err(|e| e.to_string())?
        .args(&["update"])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut last_error: Option<String> = None;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let text = String::from_utf8_lossy(&line_bytes);
                for line in text.lines() {
                    if let Ok(json_val) = serde_json::from_str::<Value>(line) {
                        let status_opt = json_val.get("status").and_then(|s| s.as_str());
                        match status_opt {
                            Some("updating") | Some("ready") | Some("warning") | Some("info") => {
                                let _ = app.emit("info-progress", json_val);
                            }
                            Some("error") => {
                                last_error = Some(
                                    json_val
                                        .get("message")
                                        .and_then(|m| m.as_str())
                                        .unwrap_or("Tool update failed")
                                        .to_string(),
                                );
                                let _ = app.emit("info-progress", json_val);
                            }
                            _ => {}
                        }
                    }
                }
            }
            CommandEvent::Stderr(line_bytes) => {
                let err_line = String::from_utf8_lossy(&line_bytes);
                eprintln!("[Sidecar Tools Update Error]: {}", err_line);
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    if let Some(msg) = last_error {
        return Err(msg);
    }
    Ok(())
}

#[tauri::command]
pub fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle, file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err(format!("Installer file not found at: {}", file_path));
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to launch installer executable: {}", e))?;
        app.exit(0);
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open installer: {}", e))?;
        app.exit(0);
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        use std::process::Command;

        let lower = file_path.to_lowercase();
        if lower.ends_with(".appimage") {
            if let Ok(metadata) = std::fs::metadata(&file_path) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = std::fs::set_permissions(&file_path, perms);
            }
            Command::new(&file_path)
                .spawn()
                .map_err(|e| format!("Failed to launch AppImage: {}", e))?;
            app.exit(0);
            return Ok(());
        } else if lower.ends_with(".deb") {
            let res = Command::new("pkexec")
                .args(&["apt", "install", "-y", &file_path])
                .spawn();
            if res.is_err() {
                Command::new("pkexec")
                    .args(&["dpkg", "-i", &file_path])
                    .spawn()
                    .map_err(|e| format!("Failed to install .deb package: {}", e))?;
            }
            app.exit(0);
            return Ok(());
        } else if lower.ends_with(".rpm") {
            let res = Command::new("pkexec")
                .args(&["dnf", "install", "-y", &file_path])
                .spawn();
            if res.is_err() {
                Command::new("pkexec")
                    .args(&["rpm", "-Uvh", &file_path])
                    .spawn()
                    .map_err(|e| format!("Failed to install .rpm package: {}", e))?;
            }
            app.exit(0);
            return Ok(());
        } else if lower.ends_with(".pkg.tar.zst") || lower.ends_with(".pkg.tar.xz") {
            Command::new("pkexec")
                .args(&["pacman", "-U", "--noconfirm", &file_path])
                .spawn()
                .map_err(|e| format!("Failed to install package with pacman: {}", e))?;
            app.exit(0);
            return Ok(());
        } else {
            Command::new("xdg-open")
                .arg(&file_path)
                .spawn()
                .map_err(|e| format!("Failed to open file: {}", e))?;
            return Ok(());
        }
    }

    #[allow(unreachable_code)]
    Ok(())
}

