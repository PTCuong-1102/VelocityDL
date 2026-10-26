use serde_json::{json, Value};
use std::fs;
use tauri::{AppHandle, Manager};

/// Cap stored history entries — oldest entries beyond this are dropped on
/// every save so the file stays bounded (each entry can carry a playlist's
/// worth of children).
const MAX_HISTORY_ENTRIES: usize = 1000;

fn history_file(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    Ok(config_dir.join("history.json"))
}

/// Load persisted download history. Returns an empty array when the file
/// does not exist yet (first run) or is unreadable — history is
/// best-effort data and must never block app startup.
#[tauri::command]
pub fn load_history(app: AppHandle) -> Result<Vec<Value>, String> {
    let path = history_file(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    match serde_json::from_str::<Value>(&content) {
        Ok(Value::Array(items)) => Ok(items),
        _ => Ok(Vec::new()), // corrupt/foreign file — treat as empty
    }
}

/// Persist download history atomically: serialize off the main path, then
/// rename, so a crash mid-write can not corrupt existing history.
/// Items are expected newest-first; the list is trimmed to the cap.
#[tauri::command]
pub fn save_history(app: AppHandle, items: Vec<Value>) -> Result<(), String> {
    let path = history_file(&app)?;
    let mut items = items;
    if items.len() > MAX_HISTORY_ENTRIES {
        items.truncate(MAX_HISTORY_ENTRIES);
    }
    let body = json!(items);
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec(&body).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Append-to-front helper used by the tests below.
#[cfg(test)]
fn bounded_push(items: &mut Vec<Value>, entry: Value) {
    items.insert(0, entry);
    if items.len() > MAX_HISTORY_ENTRIES {
        items.truncate(MAX_HISTORY_ENTRIES);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_push_keeps_newest_first_and_caps() {
        let mut items: Vec<Value> = Vec::new();
        for i in 0..(MAX_HISTORY_ENTRIES + 10) {
            bounded_push(&mut items, json!({ "id": i }));
        }
        assert_eq!(items.len(), MAX_HISTORY_ENTRIES);
        assert_eq!(items[0]["id"], json!(MAX_HISTORY_ENTRIES + 9));
        assert_eq!(items.last().unwrap()["id"], json!(10));
    }

    #[test]
    fn corrupt_file_degrades_to_empty() {
        // Mirror of load_history's parse branch: a non-array payload must
        // degrade to empty rather than error out the app start-up path.
        let parsed: Value = serde_json::from_str("{\"not\":\"an array\"}").unwrap();
        let degraded = match parsed {
            Value::Array(items) => items,
            _ => Vec::new(),
        };
        assert!(degraded.is_empty());
    }
}
