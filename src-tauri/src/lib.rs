mod app_runtime;
mod commands;
mod model;
mod pi_bridge;
mod state_store;

use std::path::PathBuf;

use app_runtime::AppRuntime;
use tauri::Manager;

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")))
}

fn data_dir(app: &tauri::AppHandle) -> tauri::Result<PathBuf> {
    if let Ok(path) = std::env::var("DGCODER_PI_DATA_DIR") {
        return Ok(PathBuf::from(path));
    }

    app.path().app_data_dir()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let data_dir = data_dir(app.handle())?;
            let runtime = AppRuntime::new(app.handle().clone(), &repo_root(), data_dir)
                .map_err(std::io::Error::other)?;
            app.manage(runtime);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::abort_thread,
            commands::add_project,
            commands::create_thread,
            commands::import_codex_openai_key,
            commands::load_app_state,
            commands::load_project_diff,
            commands::move_project,
            commands::remove_attachment,
            commands::select_model,
            commands::select_reasoning,
            commands::send_prompt,
            commands::set_feature_toggle,
            commands::set_provider_key,
            commands::snapshot_state,
            commands::start_codex_login,
            commands::stage_attachment,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
