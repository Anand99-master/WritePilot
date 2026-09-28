/**
 * WritePilot - Tauri 2.x Application Entry & IPC Bridge (Phase 3B: Safe External Replacement)
 */

mod windows;

use std::sync::Arc;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use windows::text_detection::{
    FocusedTextPayload, ReplacementResult, TextControlInfo, TextDetectionService,
};

#[tauri::command]
async fn get_focused_text(
    state: State<'_, Arc<TextDetectionService>>,
) -> Result<FocusedTextPayload, String> {
    state.get_focused_text().await
}

#[tauri::command]
async fn get_active_control_info(
    state: State<'_, Arc<TextDetectionService>>,
) -> Result<TextControlInfo, String> {
    Ok(state.get_text_control_info().await)
}

#[tauri::command]
async fn is_text_control_supported(
    state: State<'_, Arc<TextDetectionService>>,
) -> Result<bool, String> {
    Ok(state.is_text_control_supported().await)
}

#[tauri::command]
async fn replace_text_range(
    start: usize,
    length: usize,
    replacement: String,
    expected_original: String,
    state: State<'_, Arc<TextDetectionService>>,
) -> Result<ReplacementResult, String> {
    Ok(state
        .replace_text_range(start, length, replacement, expected_original)
        .await)
}

#[tauri::command]
fn start_text_monitoring(app: AppHandle, state: State<'_, Arc<TextDetectionService>>) {
    state.start_text_monitoring(app);
}

#[tauri::command]
fn stop_text_monitoring(state: State<'_, Arc<TextDetectionService>>) {
    state.stop_text_monitoring();
}

pub fn run() {
    let text_service = Arc::new(TextDetectionService::new());

    tauri::Builder::default()
        .manage(text_service)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Register global shortcut: Ctrl+Shift+C
            let shortcut_str = "Ctrl+Shift+C";
            let global_shortcut = app.global_shortcut();

            match global_shortcut.register(shortcut_str.parse().unwrap()) {
                Ok(_) => {
                    println!("[WritePilot] Successfully registered global shortcut: {}", shortcut_str);
                }
                Err(err) => {
                    println!(
                        "[WritePilot] Warning: Could not register global shortcut {}: {}. It may already be in use.",
                        shortcut_str, err
                    );
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_focused_text,
            get_active_control_info,
            is_text_control_supported,
            replace_text_range,
            start_text_monitoring,
            stop_text_monitoring
        ])
        .run(tauri::generate_context!())
        .expect("error while running WritePilot Tauri application");
}
