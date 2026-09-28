/**
 * WritePilot - Settings Service
 * 
 * Manages configuration profile reading and updating.
 * In Phase 2: Will hook into Windows Registry (for startWithWindows)
 * and Tauri configuration persistence.
 */

import { Settings } from '../types';
import { getSettings, saveSettings } from './storage';

export function loadUserSettings(): Settings {
  return getSettings();
}

export function updateUserSettings(updates: Partial<Settings>): Settings {
  return saveSettings(updates);
}

/**
 * Hook for Windows Startup setting
 * In Phase 2: Interacts with `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`
 * via Tauri shell or autostart plugin.
 */
export async function setWindowsAutoStart(enabled: boolean): Promise<boolean> {
  console.log(`[WritePilot Settings] Windows autostart set to: ${enabled} (Phase 1 Stub)`);
  updateUserSettings({ startWithWindows: enabled });
  return true;
}
