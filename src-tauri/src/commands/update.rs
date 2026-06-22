use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[tauri::command]
pub async fn check_app_update(app: AppHandle, current_version: String) -> Result<Value, String> {
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

#[tauri::command]
pub fn exit_app() {
    std::process::exit(0);
}
