/**
 * WritePilot - Text Detection & Replacement Service (Phase 3B)
 *
 * Responsibilities:
 * - Polls or queries UI Automation focused elements.
 * - Emits `text_changed` Tauri events when the active text changes.
 * - Safely replaces specific text ranges when verified.
 * - Strictly prevents keylogging, background text capture, and password reading.
 * - Does NOT perform spell-checking (that is the job of the React/TypeScript engine).
 */

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

use super::ui_automation::native::AutomationManager;
pub use super::ui_automation::{
    ControlSupportState, FocusedTextPayload, ReplacementResult, ReplacementStatus, TextControlInfo,
};

pub struct TextDetectionService {
    manager: Arc<Mutex<Option<AutomationManager>>>,
    is_monitoring: Arc<AtomicBool>,
}

impl TextDetectionService {
    pub fn new() -> Self {
        #[cfg(target_os = "windows")]
        let mgr = AutomationManager::new().ok();
        #[cfg(not(target_os = "windows"))]
        let mgr = AutomationManager::new().ok();

        Self {
            manager: Arc::new(Mutex::new(mgr)),
            is_monitoring: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn get_text_control_info(&self) -> TextControlInfo {
        let lock = self.manager.lock().await;
        if let Some(ref mgr) = *lock {
            mgr.get_focused_control_info()
        } else {
            TextControlInfo {
                app_name: "Unavailable".into(),
                window_title: "".into(),
                control_type: "None".into(),
                support_state: ControlSupportState::ERROR,
                has_text_pattern: false,
                has_value_pattern: false,
                is_password: false,
                is_read_only: false,
                supports_replacement: false,
                details: Some("Automation manager not initialized.".into()),
            }
        }
    }

    pub async fn is_text_control_supported(&self) -> bool {
        let info = self.get_text_control_info().await;
        info.support_state == ControlSupportState::SUPPORTED
            || info.support_state == ControlSupportState::PARTIALLY_SUPPORTED
    }

    pub async fn get_focused_text(&self) -> Result<FocusedTextPayload, String> {
        let lock = self.manager.lock().await;
        if let Some(ref mgr) = *lock {
            mgr.get_focused_text().map_err(|e| format!("{e:?}"))
        } else {
            Err("UI Automation Manager not initialized".into())
        }
    }

    pub async fn replace_text_range(
        &self,
        start: usize,
        length: usize,
        replacement: String,
        expected_original: String,
    ) -> ReplacementResult {
        let lock = self.manager.lock().await;
        if let Some(ref mgr) = *lock {
            mgr.replace_text_range(start, length, &replacement, &expected_original)
        } else {
            ReplacementResult {
                success: false,
                status: ReplacementStatus::REPLACEMENT_FAILED,
                original: Some(expected_original),
                replacement: Some(replacement),
                error: Some("Automation manager is not available.".into()),
            }
        }
    }

    pub fn start_text_monitoring(&self, app: AppHandle) {
        if self.is_monitoring.swap(true, Ordering::SeqCst) {
            // Already monitoring
            return;
        }

        let is_monitoring = self.is_monitoring.clone();
        let manager = self.manager.clone();

        tokio::spawn(async move {
            let mut last_text = String::new();

            while is_monitoring.load(Ordering::SeqCst) {
                sleep(Duration::from_millis(250)).await;

                let lock = manager.lock().await;
                if let Some(ref mgr) = *lock {
                    if let Ok(payload) = mgr.get_focused_text() {
                        // Only emit event if text has changed and is not empty or password
                        if !payload.control_info.is_password
                            && payload.text != last_text
                            && !payload.text.is_empty()
                        {
                            last_text = payload.text.clone();
                            let _ = app.emit("text_changed", &payload);
                        }
                    }
                }
            }
        });
    }

    pub fn stop_text_monitoring(&self) {
        self.is_monitoring.store(false, Ordering::SeqCst);
    }
}
