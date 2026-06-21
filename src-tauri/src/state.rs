use std::collections::HashMap;
use std::sync::Mutex;
use tauri_plugin_shell::process::CommandChild;

pub struct AppState {
    pub active_downloads: Mutex<HashMap<String, CommandChild>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            active_downloads: Mutex::new(HashMap::new()),
        }
    }
}
