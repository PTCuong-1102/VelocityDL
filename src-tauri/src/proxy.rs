use tauri::{AppHandle, Manager};

/// Load proxy settings from `<app_config>/settings.json` and export them as
/// process env vars so every `sidecar("deno-engine")` child inherits them.
///
/// This closes the gap where only the Deno sidecar applied proxy internally
/// (and only *after* binary downloads): Rust-spawned sidecars for
/// `info / download / check-app-update` now carry HTTP(S)_PROXY from the start.
pub fn apply_proxy_from_settings(app: &AppHandle) {
    let config_dir = match app.path().app_config_dir() {
        Ok(d) => d,
        Err(_) => return,
    };
    let settings_file = config_dir.join("settings.json");
    let content = match std::fs::read_to_string(&settings_file) {
        Ok(c) => c,
        Err(_) => return,
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return,
    };

    let proxy_address = json
        .get("engine")
        .and_then(|e| e.get("proxyAddress"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .unwrap_or("");
    if proxy_address.is_empty() {
        return;
    }
    let proxy_type = json
        .get("engine")
        .and_then(|e| e.get("proxyType"))
        .and_then(|v| v.as_str())
        .unwrap_or("HTTP");

    let prefix = if proxy_type == "SOCKS5" {
        "socks5://"
    } else {
        "http://"
    };
    let full_proxy = if proxy_address.starts_with("http://")
        || proxy_address.starts_with("https://")
        || proxy_address.starts_with("socks5://")
    {
        proxy_address.to_string()
    } else {
        format!("{prefix}{proxy_address}")
    };

    for key in [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
    ] {
        std::env::set_var(key, &full_proxy);
    }
}
