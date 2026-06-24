use crate::state::AppState;
use serde_json::Value;
use tauri::{AppHandle, State, Emitter, Manager};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

#[tauri::command]
pub fn start_download(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    url: String,
    save_dir: String,
    options: Value,
) -> Result<(), String> {
    let options_str = serde_json::to_string(&options).map_err(|e| e.to_string())?;

    // Spawn Deno sidecar
    let (mut rx, child) = app
        .shell()
        .sidecar("deno-engine")
        .map_err(|e| e.to_string())?
        .args(&["download", &id, &url, &save_dir, &options_str])
        .spawn()
        .map_err(|e| e.to_string())?;

    // Store the child process so we can kill it later (e.g. pause/cancel)
    {
        let mut active = state.active_downloads.lock().unwrap();
        active.insert(id.clone(), child);
    }

    // Spawn async task to monitor output
    let app_clone = app.clone();
    let id_clone = id.clone();
    
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line_bytes) => {
                    let line = String::from_utf8_lossy(&line_bytes);
                    for single_line in line.lines() {
                        if let Ok(payload) = serde_json::from_str::<Value>(single_line) {
                            // Emit progress to frontend
                            let _ = app_clone.emit("download-progress", payload);
                        }
                    }
                }
                CommandEvent::Stderr(line_bytes) => {
                    let err_line = String::from_utf8_lossy(&line_bytes);
                    eprintln!("[Sidecar Error]: {}", err_line);
                }
                CommandEvent::Terminated(payload) => {
                    println!("[Sidecar Terminated] exit code: {:?}", payload.code);
                    
                    let mut was_active = false;
                    // Remove from active list
                    if let Some(state_accessor) = app_clone.try_state::<AppState>() {
                        let mut active = state_accessor.active_downloads.lock().unwrap();
                        was_active = active.remove(&id_clone).is_some();
                    }

                    if was_active && payload.code != Some(0) {
                        let _ = app_clone.emit("download-progress", serde_json::json!({
                            "id": id_clone,
                            "status": "error",
                            "error": format!("Sidecar process terminated unexpectedly with code {:?}", payload.code),
                            "progress": 0,
                            "speed": 0,
                            "eta": 0,
                            "downloadedBytes": 0,
                            "totalBytes": 0
                        }));
                    }
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn pause_download(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut active = state.active_downloads.lock().unwrap();
    if let Some(child) = active.remove(&id) {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn cancel_download(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut active = state.active_downloads.lock().unwrap();
    if let Some(child) = active.remove(&id) {
        child.kill().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_video_info(app: AppHandle, url: String) -> Result<Value, String> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("deno-engine")
        .map_err(|e| e.to_string())?
        .args(&["info", &url])
        .spawn()
        .map_err(|e| e.to_string())?;

    let mut output_str = String::new();

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line_bytes) => {
                let text = String::from_utf8_lossy(&line_bytes);
                output_str.push_str(&text);
                
                // Parse on the fly to emit update progress to frontend
                for line in text.lines() {
                    if let Ok(json_val) = serde_json::from_str::<Value>(line) {
                        let status_opt = json_val.get("status").and_then(|s| s.as_str());
                        if status_opt == Some("updating") || status_opt == Some("ready") {
                            let _ = app.emit("info-progress", json_val);
                        }
                    }
                }
            }
            CommandEvent::Stderr(line_bytes) => {
                let err_line = String::from_utf8_lossy(&line_bytes);
                eprintln!("[Sidecar Info Error]: {}", err_line);
            }
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }

    // Parse the stdout JSON
    for line in output_str.lines() {
        if let Ok(json_val) = serde_json::from_str::<Value>(line) {
            // Find the info response
            if json_val.get("type").and_then(|t| t.as_str()) == Some("info") {
                return Ok(json_val.get("data").cloned().unwrap_or(Value::Null));
            } else if json_val.get("status").and_then(|s| s.as_str()) == Some("error") {
                return Err(json_val.get("message").and_then(|m| m.as_str()).unwrap_or("Failed to fetch info").to_string());
            }
        }
    }

    Err("Could not retrieve URL metadata from sidecar stdout".to_string())
}
