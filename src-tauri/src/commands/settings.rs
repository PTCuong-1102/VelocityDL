use std::fs;
use serde_json::{json, Value};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

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
                "autoUpdateYtdlp": true
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
