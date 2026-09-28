/**
 * WritePilot - Windows UI Automation Native Implementation (Phase 3B: Safe Text Replacement)
 *
 * Privacy & Security Architecture:
 * - Checks `IsPasswordPropertyId` first. If true, instantly returns with is_password=true and REFUSES to read/replace text.
 * - Does not use global keyloggers (WH_KEYBOARD_LL).
 * - Exact range verification: verifies that the target substring at `start..start+length` exactly matches `expected_original`.
 * - Stale target protection: if user edited the text between detection and replacement, aborts with `STALE_TARGET`.
 * - Categorizes controls into SUPPORTED, PARTIALLY_SUPPORTED, NOT_SUPPORTED, ERROR.
 */

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ControlSupportState {
    SUPPORTED,
    PARTIALLY_SUPPORTED,
    NOT_SUPPORTED,
    ERROR,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ReplacementStatus {
    APPLIED,
    STALE_TARGET,
    UNSUPPORTED,
    PASSWORD_BLOCKED,
    FOCUS_CHANGED,
    REPLACEMENT_FAILED,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplacementResult {
    pub success: bool,
    pub status: ReplacementStatus,
    pub original: Option<String>,
    pub replacement: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextControlInfo {
    pub app_name: String,
    pub window_title: String,
    pub control_type: String,
    pub support_state: ControlSupportState,
    pub has_text_pattern: bool,
    pub has_value_pattern: bool,
    pub is_password: bool,
    pub is_read_only: bool,
    pub supports_replacement: bool,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusedTextPayload {
    pub text: String,
    pub control_info: TextControlInfo,
    pub char_count: usize,
}

#[cfg(target_os = "windows")]
pub mod native {
    use super::*;
    use std::ptr::null_mut;
    use windows::core::*;
    use windows::Win32::Foundation::*;
    use windows::Win32::System::Com::*;
    use windows::Win32::UI::Accessibility::*;
    use windows::Win32::UI::WindowsAndMessaging::*;

    pub struct AutomationManager {
        automation: IUIAutomation,
    }

    impl AutomationManager {
        pub fn new() -> Result<Self> {
            unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                let automation: IUIAutomation = CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)?;
                Ok(Self { automation })
            }
        }

        pub fn get_focused_control_info(&self) -> TextControlInfo {
            unsafe {
                let element = match self.automation.GetFocusedElement() {
                    Ok(el) => el,
                    Err(e) => {
                        return TextControlInfo {
                            app_name: "Unknown".into(),
                            window_title: "".into(),
                            control_type: "None".into(),
                            support_state: ControlSupportState::ERROR,
                            has_text_pattern: false,
                            has_value_pattern: false,
                            is_password: false,
                            is_read_only: false,
                            supports_replacement: false,
                            details: Some(format!("Failed to get focused element: {e}")),
                        };
                    }
                };

                // 1. Privacy Protection: Check IsPasswordPropertyId
                let is_password = match element.GetCurrentPropertyValue(UIA_IsPasswordPropertyId) {
                    Ok(val) => val.Anonymous.Anonymous.Anonymous.boolVal == -1,
                    _ => false,
                };

                if is_password {
                    return TextControlInfo {
                        app_name: "Protected".into(),
                        window_title: "[Password Protected Field]".into(),
                        control_type: "PasswordEdit".into(),
                        support_state: ControlSupportState::NOT_SUPPORTED,
                        has_text_pattern: false,
                        has_value_pattern: false,
                        is_password: true,
                        is_read_only: false,
                        supports_replacement: false,
                        details: Some("Password fields are strictly excluded for privacy.".into()),
                    };
                }

                // 2. Control Type Name
                let control_type_id = match element.GetCurrentPropertyValue(UIA_ControlTypePropertyId) {
                    Ok(val) => val.Anonymous.Anonymous.Anonymous.lVal,
                    _ => 0,
                };

                let control_type = match control_type_id {
                    50004 => "Edit",
                    50030 => "Document",
                    50020 => "Text",
                    50003 => "ComboBox",
                    _ => "Other",
                }.to_string();

                // 3. Patterns: TextPattern & ValuePattern
                let has_text_pattern = element.GetCurrentPattern(UIA_TextPatternId).is_ok();
                let has_value_pattern = element.GetCurrentPattern(UIA_ValuePatternId).is_ok();

                // 4. Read Only Check
                let is_read_only = match element.GetCurrentPropertyValue(UIA_ValueIsReadOnlyPropertyId) {
                    Ok(val) => val.Anonymous.Anonymous.Anonymous.boolVal == -1,
                    _ => false,
                };

                // 5. Window Title & Process Name
                let hwnd = match element.CurrentNativeWindowHandle() {
                    Ok(h) => HWND(h.0 as _),
                    _ => HWND(null_mut()),
                };

                let mut window_title = String::new();
                if !hwnd.0.is_null() {
                    let mut buffer = [0u16; 512];
                    let len = GetWindowTextW(hwnd, &mut buffer);
                    if len > 0 {
                        window_title = String::from_utf16_lossy(&buffer[..len as usize]);
                    }
                }

                let support_state = if has_text_pattern && has_value_pattern {
                    ControlSupportState::SUPPORTED
                } else if has_text_pattern || has_value_pattern {
                    ControlSupportState::PARTIALLY_SUPPORTED
                } else if control_type == "Edit" || control_type == "Document" {
                    ControlSupportState::PARTIALLY_SUPPORTED
                } else {
                    ControlSupportState::NOT_SUPPORTED
                };

                let supports_replacement = !is_password && !is_read_only && (has_value_pattern || has_text_pattern);

                TextControlInfo {
                    app_name: window_title.split('-').last().unwrap_or("Desktop App").trim().to_string(),
                    window_title,
                    control_type,
                    support_state,
                    has_text_pattern,
                    has_value_pattern,
                    is_password: false,
                    is_read_only,
                    supports_replacement,
                    details: None,
                }
            }
        }

        pub fn get_focused_text(&self) -> Result<FocusedTextPayload> {
            let control_info = self.get_focused_control_info();

            // Refuse to read passwords or unsupported controls
            if control_info.is_password {
                return Ok(FocusedTextPayload {
                    text: "".into(),
                    control_info,
                    char_count: 0,
                });
            }

            if control_info.support_state == ControlSupportState::NOT_SUPPORTED {
                return Ok(FocusedTextPayload {
                    text: "".into(),
                    control_info,
                    char_count: 0,
                });
            }

            unsafe {
                let element = self.automation.GetFocusedElement()?;

                // Strategy A: Try TextPattern for full document/caret selection range
                if let Ok(pattern_obj) = element.GetCurrentPattern(UIA_TextPatternId) {
                    if let Ok(text_pattern) = pattern_obj.cast::<IUIAutomationTextPattern>() {
                        if let Ok(range) = text_pattern.DocumentRange() {
                            if let Ok(bstr) = range.GetText(2000) {
                                let text = bstr.to_string();
                                return Ok(FocusedTextPayload {
                                    char_count: text.chars().count(),
                                    text,
                                    control_info,
                                });
                            }
                        }
                    }
                }

                // Strategy B: Try ValuePattern for single-line/multi-line edit controls
                if let Ok(pattern_obj) = element.GetCurrentPattern(UIA_ValuePatternId) {
                    if let Ok(value_pattern) = pattern_obj.cast::<IUIAutomationValuePattern>() {
                        if let Ok(bstr) = value_pattern.CurrentValue() {
                            let text = bstr.to_string();
                            return Ok(FocusedTextPayload {
                                char_count: text.chars().count(),
                                text,
                                control_info,
                            });
                        }
                    }
                }

                Ok(FocusedTextPayload {
                    text: "".into(),
                    control_info,
                    char_count: 0,
                })
            }
        }

        pub fn replace_text_range(
            &self,
            start: usize,
            length: usize,
            replacement: &str,
            expected_original: &str,
        ) -> ReplacementResult {
            let control_info = self.get_focused_control_info();

            // 1. Password Protection Check
            if control_info.is_password {
                return ReplacementResult {
                    success: false,
                    status: ReplacementStatus::PASSWORD_BLOCKED,
                    original: Some(expected_original.to_string()),
                    replacement: Some(replacement.to_string()),
                    error: Some("Password fields are strictly protected against modification.".to_string()),
                };
            }

            // 2. Control Support & Read-Only Check
            if control_info.support_state == ControlSupportState::NOT_SUPPORTED || control_info.is_read_only {
                return ReplacementResult {
                    success: false,
                    status: ReplacementStatus::UNSUPPORTED,
                    original: Some(expected_original.to_string()),
                    replacement: Some(replacement.to_string()),
                    error: Some("Target control is read-only or does not support replacement.".to_string()),
                };
            }

            unsafe {
                let element = match self.automation.GetFocusedElement() {
                    Ok(el) => el,
                    Err(e) => {
                        return ReplacementResult {
                            success: false,
                            status: ReplacementStatus::FOCUS_CHANGED,
                            original: Some(expected_original.to_string()),
                            replacement: Some(replacement.to_string()),
                            error: Some(format!("Failed to access focused element: {e}")),
                        };
                    }
                };

                // 3. Read current text and verify exact range match
                let current_text = match self.get_focused_text() {
                    Ok(payload) => payload.text,
                    Err(e) => {
                        return ReplacementResult {
                            success: false,
                            status: ReplacementStatus::REPLACEMENT_FAILED,
                            original: Some(expected_original.to_string()),
                            replacement: Some(replacement.to_string()),
                            error: Some(format!("Failed to read control text before replacement: {e}")),
                        };
                    }
                };

                let chars: Vec<char> = current_text.chars().collect();
                if start + length > chars.len() {
                    return ReplacementResult {
                        success: false,
                        status: ReplacementStatus::STALE_TARGET,
                        original: Some(expected_original.to_string()),
                        replacement: Some(replacement.to_string()),
                        error: Some("Text length has changed since detection.".to_string()),
                    };
                }

                let current_slice: String = chars[start..start + length].iter().collect();
                if current_slice != expected_original {
                    return ReplacementResult {
                        success: false,
                        status: ReplacementStatus::STALE_TARGET,
                        original: Some(expected_original.to_string()),
                        replacement: Some(replacement.to_string()),
                        error: Some(format!(
                            "Target text modified since detection (found '{current_slice}' instead of '{expected_original}')."
                        )),
                    };
                }

                // 4. Preferred Replacement Method: ValuePattern
                if let Ok(pattern_obj) = element.GetCurrentPattern(UIA_ValuePatternId) {
                    if let Ok(value_pattern) = pattern_obj.cast::<IUIAutomationValuePattern>() {
                        let mut new_chars = chars[..start].to_vec();
                        new_chars.extend(replacement.chars());
                        new_chars.extend(&chars[start + length..]);
                        let new_string: String = new_chars.into_iter().collect();

                        let bstr = BSTR::from(new_string.as_str());
                        if value_pattern.SetValue(&bstr).is_ok() {
                            return ReplacementResult {
                                success: true,
                                status: ReplacementStatus::APPLIED,
                                original: Some(expected_original.to_string()),
                                replacement: Some(replacement.to_string()),
                                error: None,
                            };
                        }
                    }
                }

                ReplacementResult {
                    success: false,
                    status: ReplacementStatus::UNSUPPORTED,
                    original: Some(expected_original.to_string()),
                    replacement: Some(replacement.to_string()),
                    error: Some("Focused control does not support direct ValuePattern replacement.".to_string()),
                }
            }
        }
    }
}

// Cross-platform mock/fallback implementation for compilation on non-Windows platforms
#[cfg(not(target_os = "windows"))]
pub mod native {
    use super::*;
    use std::sync::Mutex;

    static SIMULATED_TEXT: Mutex<Option<String>> = Mutex::new(None);

    pub struct AutomationManager;

    impl AutomationManager {
        pub fn new() -> Result<Self, String> {
            Ok(Self)
        }

        pub fn get_focused_control_info(&self) -> TextControlInfo {
            TextControlInfo {
                app_name: "Simulated Notepad".into(),
                window_title: "Untitled - Notepad".into(),
                control_type: "Edit".into(),
                support_state: ControlSupportState::SUPPORTED,
                has_text_pattern: true,
                has_value_pattern: true,
                is_password: false,
                is_read_only: false,
                supports_replacement: true,
                details: Some("Non-Windows development runtime simulation.".into()),
            }
        }

        pub fn get_focused_text(&self) -> Result<FocusedTextPayload, String> {
            let control_info = self.get_focused_control_info();
            let mut lock = SIMULATED_TEXT.lock().unwrap();
            let text = lock.get_or_insert_with(|| "I will recieve the document tommorow.".to_string()).clone();

            Ok(FocusedTextPayload {
                char_count: text.chars().count(),
                text,
                control_info,
            })
        }

        pub fn replace_text_range(
            &self,
            start: usize,
            length: usize,
            replacement: &str,
            expected_original: &str,
        ) -> ReplacementResult {
            let mut lock = SIMULATED_TEXT.lock().unwrap();
            let current_text = lock.get_or_insert_with(|| "I will recieve the document tommorow.".to_string()).clone();

            let chars: Vec<char> = current_text.chars().collect();
            if start + length > chars.len() {
                return ReplacementResult {
                    success: false,
                    status: ReplacementStatus::STALE_TARGET,
                    original: Some(expected_original.to_string()),
                    replacement: Some(replacement.to_string()),
                    error: Some("Target offset is out of bounds.".to_string()),
                };
            }

            let slice: String = chars[start..start + length].iter().collect();
            if slice != expected_original {
                return ReplacementResult {
                    success: false,
                    status: ReplacementStatus::STALE_TARGET,
                    original: Some(expected_original.to_string()),
                    replacement: Some(replacement.to_string()),
                    error: Some(format!("Text changed (found '{slice}' instead of '{expected_original}').")),
                };
            }

            let mut new_chars = chars[..start].to_vec();
            new_chars.extend(replacement.chars());
            new_chars.extend(&chars[start + length..]);
            let new_text: String = new_chars.into_iter().collect();
            *lock = Some(new_text);

            ReplacementResult {
                success: true,
                status: ReplacementStatus::APPLIED,
                original: Some(expected_original.to_string()),
                replacement: Some(replacement.to_string()),
                error: None,
            }
        }
    }
}
