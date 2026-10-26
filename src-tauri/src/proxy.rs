use tauri::{AppHandle, Manager};

/// Pure helper: normalize a user-entered proxy address into a full URL.
/// Returns `None` when the address is empty/whitespace.
pub fn build_proxy_url(proxy_address: &str, proxy_type: &str) -> Option<String> {
    let proxy_address = proxy_address.trim();
    if proxy_address.is_empty() {
        return None;
    }
    if proxy_address.starts_with("http://")
        || proxy_address.starts_with("https://")
        || proxy_address.starts_with("socks5://")
    {
        return Some(proxy_address.to_string());
    }
    let prefix = if proxy_type == "SOCKS5" { "socks5://" } else { "http://" };
    Some(format!("{prefix}{proxy_address}"))
}

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
        .unwrap_or("");
    let proxy_type = json
        .get("engine")
        .and_then(|e| e.get("proxyType"))
        .and_then(|v| v.as_str())
        .unwrap_or("HTTP");

    let full_proxy = match build_proxy_url(proxy_address, proxy_type) {
        Some(p) => p,
        None => return,
    };

    // Deno (sidecar) ignores uppercase HTTP_PROXY but honors the lowercase
    // spellings — publish all six so Python children (yt-dlp / pip) are
    // covered too.
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

#[cfg(test)]
mod tests {
    use super::build_proxy_url;

    #[test]
    fn empty_address_is_none() {
        assert!(build_proxy_url("", "HTTP").is_none());
        assert!(build_proxy_url("   ", "HTTP").is_none());
    }

    #[test]
    fn bare_address_gets_http_prefix() {
        assert_eq!(
            build_proxy_url("127.0.0.1:1080", "HTTP").as_deref(),
            Some("http://127.0.0.1:1080")
        );
    }

    #[test]
    fn socks5_type_gets_socks_prefix() {
        assert_eq!(
            build_proxy_url("127.0.0.1:9050", "SOCKS5").as_deref(),
            Some("socks5://127.0.0.1:9050")
        );
    }

    #[test]
    fn fully_qualified_addresses_pass_through() {
        assert_eq!(
            build_proxy_url("https://proxy.example.com:3128", "HTTP").as_deref(),
            Some("https://proxy.example.com:3128")
        );
        assert_eq!(
            build_proxy_url("socks5://10.0.0.1:1080", "HTTP").as_deref(),
            Some("socks5://10.0.0.1:1080")
        );
    }

    #[test]
    fn surrounding_whitespace_is_trimmed() {
        assert_eq!(
            build_proxy_url("  10.0.0.2:8080 ", "HTTP").as_deref(),
            Some("http://10.0.0.2:8080")
        );
    }
}
