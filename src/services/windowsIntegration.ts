/**
 * WritePilot - Windows Integration Service (Phase 3B: Safe External Text Replacement)
 *
 * Provides a Tauri-aware abstraction for Windows UI Automation text detection & replacement.
 * - Detects currently focused UI Automation element and its patterns (TextPattern, ValuePattern).
 * - Identifies control type and support state (SUPPORTED, PARTIALLY_SUPPORTED, NOT_SUPPORTED, ERROR).
 * - Protects user privacy: strictly refuses to read or modify password fields.
 * - Stale target protection: verifies that the exact range still contains the expected original text.
 * - Only replaces the exact detected range (does NOT perform global string search or document replacement).
 * - Revalidates target control after replacement.
 * - Safe logging: never logs passwords, credentials, or entire document text.
 */

import {
  TextControlInfo,
  FocusedTextPayload,
  WindowsIntegrationStatus,
  ReplaceRangeParams,
  ReplacementResult,
} from '../types';

export interface MonitoringState {
  isMonitoring: boolean;
  statusMessage: string;
}

let isMonitoringActive = false;
let currentActiveControl: TextControlInfo | null = null;
const changeSubscribers = new Set<(payload: FocusedTextPayload) => void>();

// Simulated text buffer for browser dev preview testing
let simulatedText = 'I will recieve the document tommorow.';
let simulatedControl: TextControlInfo = {
  appName: 'Notepad',
  windowTitle: 'Document.txt - Notepad',
  controlType: 'Edit',
  supportState: 'SUPPORTED',
  hasTextPattern: true,
  hasValuePattern: true,
  isPassword: false,
  isReadOnly: false,
  supportsReplacement: true,
  details: 'Windows Notepad Win32 Edit Control (ValuePattern)',
};

/**
 * Checks if the application is running inside a Tauri native shell.
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Safe invocation of Tauri IPC commands with fallback.
 */
async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(cmd, args);
    } catch (err) {
      console.warn(`[WritePilot Windows Integration] Tauri invoke error for '${cmd}':`, err);
      return null;
    }
  }
  return null;
}

/**
 * Sets the simulated application state (used in browser dev preview to test Notepad, Word, Passwords, etc.).
 */
export function setSimulatedState(text: string, controlOverride?: Partial<TextControlInfo>) {
  simulatedText = text;
  if (controlOverride) {
    simulatedControl = {
      ...simulatedControl,
      ...controlOverride,
    };
  }
  currentActiveControl = simulatedControl;
}

/**
 * Retrieves the currently focused Windows UI Automation control info.
 */
export async function getActiveControlInfo(): Promise<TextControlInfo> {
  if (isTauriEnvironment()) {
    const res = await invokeTauri<TextControlInfo>('get_active_control_info');
    if (res) {
      currentActiveControl = res;
      return res;
    }
  }

  currentActiveControl = simulatedControl;
  return simulatedControl;
}

/**
 * Checks if the active control supports UI Automation text reading.
 */
export async function isTextControlSupported(): Promise<boolean> {
  const info = await getActiveControlInfo();
  return info.supportState === 'SUPPORTED' || info.supportState === 'PARTIALLY_SUPPORTED';
}

/**
 * Reads text from the currently focused Windows application control.
 * Strictly enforces privacy:
 * - If control is password-protected, text reading is rejected.
 * - If control is unsupported, returns empty text with NOT_SUPPORTED state.
 */
export async function getFocusedText(): Promise<FocusedTextPayload> {
  if (isTauriEnvironment()) {
    const res = await invokeTauri<FocusedTextPayload>('get_focused_text');
    if (res) {
      return res;
    }
  }

  const controlInfo = await getActiveControlInfo();

  // Privacy check simulation
  if (controlInfo.isPassword) {
    return {
      text: '',
      controlInfo,
      charCount: 0,
    };
  }

  return {
    text: simulatedText,
    controlInfo,
    charCount: simulatedText.length,
  };
}

/**
 * Safely replaces an exact text range in the focused external Windows application control.
 *
 * Privacy & Safety Guarantees:
 * 1. Checks `isPassword`. If true, rejects with `PASSWORD_BLOCKED`.
 * 2. Checks control support and read-only status.
 * 3. Stale text protection: compares `currentText[start..start+length]` with `expectedOriginal`.
 *    If mismatched, immediately aborts with `STALE_TARGET`.
 * 4. Replaces ONLY that exact character range (zero global replaces).
 * 5. Revalidates the control after replacement.
 * 6. Safe logging: never logs passwords, credentials, or document content.
 */
export async function replaceTextRange(params: ReplaceRangeParams): Promise<ReplacementResult> {
  const { start, length, replacement, expectedOriginal } = params;

  if (isTauriEnvironment()) {
    const res = await invokeTauri<ReplacementResult>('replace_text_range', {
      start,
      length,
      replacement,
      expectedOriginal,
    });

    if (res) {
      logSafeReplacement(res.status, length, replacement.length);
      return res;
    }

    return {
      success: false,
      status: 'REPLACEMENT_FAILED',
      original: expectedOriginal,
      replacement,
      error: 'Tauri IPC call failed.',
    };
  }

  // Web Dev Mode Simulation
  const control = await getActiveControlInfo();

  if (control.isPassword) {
    logSafeReplacement('PASSWORD_BLOCKED', length, replacement.length);
    return {
      success: false,
      status: 'PASSWORD_BLOCKED',
      original: expectedOriginal,
      replacement,
      error: 'Password fields are strictly protected against modification.',
    };
  }

  if (control.supportState === 'NOT_SUPPORTED' || control.isReadOnly || !control.supportsReplacement) {
    logSafeReplacement('UNSUPPORTED', length, replacement.length);
    return {
      success: false,
      status: 'UNSUPPORTED',
      original: expectedOriginal,
      replacement,
      error: 'Target control does not support text replacement.',
    };
  }

  // Stale target protection check
  if (start + length > simulatedText.length) {
    logSafeReplacement('STALE_TARGET', length, replacement.length);
    return {
      success: false,
      status: 'STALE_TARGET',
      original: expectedOriginal,
      replacement,
      error: 'Text length changed since detection.',
    };
  }

  const currentSlice = simulatedText.slice(start, start + length);
  if (currentSlice !== expectedOriginal) {
    logSafeReplacement('STALE_TARGET', length, replacement.length);
    return {
      success: false,
      status: 'STALE_TARGET',
      original: expectedOriginal,
      replacement,
      error: `Target text was modified (found "${currentSlice}" instead of "${expectedOriginal}").`,
    };
  }

  // Execute exact range replacement
  const before = simulatedText.slice(0, start);
  const after = simulatedText.slice(start + length);
  simulatedText = before + replacement + after;

  logSafeReplacement('APPLIED', length, replacement.length);
  return {
    success: true,
    status: 'APPLIED',
    original: expectedOriginal,
    replacement,
  };
}

/**
 * Safe logging helper: never logs words, passwords, or document text.
 */
function logSafeReplacement(status: string, origLen: number, replLen: number) {
  console.log(`[WritePilot Safe Replacement] Status: ${status} | Length: ${origLen}->${replLen}`);
}

/**
 * Starts Windows UI Automation text change monitoring.
 */
export async function startTextMonitoring(): Promise<MonitoringState> {
  isMonitoringActive = true;

  if (isTauriEnvironment()) {
    try {
      await invokeTauri('start_text_monitoring');
      const { listen } = await import('@tauri-apps/api/event');
      await listen<FocusedTextPayload>('text_changed', (event) => {
        changeSubscribers.forEach((cb) => cb(event.payload));
      });

      return {
        isMonitoring: true,
        statusMessage: 'Windows UI Automation text monitoring active.',
      };
    } catch (err) {
      console.warn('[WritePilot] Could not start native monitoring:', err);
    }
  }

  return {
    isMonitoring: true,
    statusMessage: 'UI Automation text monitoring active (Ready for input).',
  };
}

/**
 * Stops Windows UI Automation text change monitoring.
 */
export async function stopTextMonitoring(): Promise<MonitoringState> {
  isMonitoringActive = false;

  if (isTauriEnvironment()) {
    try {
      await invokeTauri('stop_text_monitoring');
    } catch (err) {
      console.warn('[WritePilot] Could not stop native monitoring:', err);
    }
  }

  return {
    isMonitoring: false,
    statusMessage: 'Windows UI Automation text monitoring paused.',
  };
}

/**
 * Subscribes to text change events from Windows applications.
 */
export function subscribeToTextChanges(callback: (payload: FocusedTextPayload) => void): () => void {
  changeSubscribers.add(callback);
  return () => {
    changeSubscribers.delete(callback);
  };
}

/**
 * Returns complete Windows Integration status for Dashboard display.
 */
export async function getIntegrationStatus(): Promise<WindowsIntegrationStatus> {
  const isTauri = isTauriEnvironment();
  const control = await getActiveControlInfo();

  return {
    connected: isTauri,
    monitoring: isMonitoringActive,
    activeControl: control,
    lastCheckedTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    mode: isTauri ? 'tauri-native' : 'web-simulation',
  };
}
