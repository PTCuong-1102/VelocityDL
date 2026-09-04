use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use tauri_plugin_shell::process::CommandChild;

/// Everything the backend knows about one running download.
/// The frontend store is the UI source of truth, but the backend keeps its
/// own copy of the facts it needs for kill/cancel/cleanup — so cancel and
/// orphan-sweeping work even with partial frontend data (e.g. after the
/// frontend restarted and rehydrated items as 'paused').
pub struct ActiveDownload {
    pub child: CommandChild,
    pub save_dir: String,
    pub output_paths: HashSet<String>,
}

pub struct AppState {
    pub active_downloads: Mutex<HashMap<String, ActiveDownload>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            active_downloads: Mutex::new(HashMap::new()),
        }
    }
}
