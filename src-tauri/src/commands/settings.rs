use std::fs;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[tauri::command]
pub fn get_default_download_path() -> Option<String> {
    dirs::download_dir().map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn browse_directory(app: tauri::AppHandle) -> Option<String> {
    // Since Tauri command handlers run on a pool of threads, blocking_pick_folder is safe here
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|path| path.into_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn browse_cookie_file(app: tauri::AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .add_filter("Cookie text files", &["txt"])
        .blocking_pick_file()
        .and_then(|path| path.into_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn load_settings(app: tauri::AppHandle) -> Result<Value, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let settings_file = config_dir.join("settings.json");

    if settings_file.exists() {
        let content = fs::read_to_string(settings_file).map_err(|e| e.to_string())?;
        let json_val: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        Ok(json_val)
    } else {
        // Return default settings structure
        let default_download = get_default_download_path()
            .unwrap_or_else(|| "".to_string());

        let defaults = json!({
            "engine": {
                "concurrentThreads": 3,
                "proxyType": "HTTP",
                "proxyAddress": "",
                "autoUpdateYtdlp": true,
                "cookieSource": "default",
                "cookieFilePath": "",
                "speedLimit": 0
            },
            "storage": {
                "defaultDownloadPath": default_download,
                "createSubfolders": true
            },
            "general": {
                "theme": "deep-space",
                "launchOnBoot": false,
                "desktopNotifications": true
            }
        });
        Ok(defaults)
    }
}

#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: Value) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    
    // Create config folder if it doesn't exist
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    let settings_file = config_dir.join("settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    
    fs::write(settings_file, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_launch_on_boot(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autolaunch = app.autolaunch();
    if enabled {
        autolaunch.enable().map_err(|e| e.to_string())
    } else {
        autolaunch.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn is_launch_on_boot(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// Verify a cookie source end-to-end: spawns the sidecar `check-cookies`
/// probe (browser export + parse) and returns its report
/// {requestedSource, resolvedSource, cookieCount, domains}.
#[tauri::command]
pub async fn check_cookies(app: AppHandle, source: String, file_path: String) -> Result<Value, String> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("deno-engine")
        .map_err(|e| e.to_string())?
        .args(&["check-cookies", &source, &file_path])
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
                eprintln!("[Sidecar Cookie Check Error]: {}", err_line);
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    for line in output_str.lines() {
        if let Ok(json_val) = serde_json::from_str::<Value>(line) {
            if json_val.get("status").and_then(|s| s.as_str()) == Some("success") {
                return Ok(json_val.get("data").cloned().unwrap_or(Value::Null));
            } else if json_val.get("status").and_then(|s| s.as_str()) == Some("error") {
                return Err(json_val
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("Cookie check failed")
                    .to_string());
            }
        }
    }

    Err("Could not verify cookies: no result from sidecar".to_string())
}
