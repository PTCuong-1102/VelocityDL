pub mod commands;
pub mod proxy;
pub mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register State
        .manage(AppState::new())
        // Register Plugins
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        // Register Commands
        .invoke_handler(tauri::generate_handler![
            commands::download::start_download,
            commands::download::pause_download,
            commands::download::cancel_download,
            commands::download::get_video_info,
            commands::settings::get_default_download_path,
            commands::settings::browse_directory,
            commands::settings::browse_cookie_file,
            commands::settings::load_settings,
            commands::settings::save_settings,
            commands::settings::set_launch_on_boot,
            commands::settings::is_launch_on_boot,
            commands::filesystem::open_file,
            commands::filesystem::open_folder,
            commands::update::check_app_update,
            commands::update::start_app_update_download,
            commands::update::update_tools,
            commands::update::exit_app,
        ])
        // Kill all active downloads when the window is closed
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(state) = window.try_state::<AppState>() {
                    if let Ok(mut active) = state.active_downloads.lock() {
                        for (id, child) in active.drain() {
                            if let Err(e) = child.kill() {
                                eprintln!("[Cleanup] Failed to kill download process {}: {}", id, e);
                            } else {
                                println!("[Cleanup] Killed download process: {}", id);
                            }
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
