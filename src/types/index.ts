/**
 * WritePilot - Type Definitions
 * Windows Desktop Writing Assistant (Tauri Architecture Ready)
 */

export interface Settings {
  // General
  startWithWindows: boolean;
  assistantEnabled: boolean;

  // Corrections
  autoApplyCorrections: boolean;
  showSpellingSuggestions: boolean;
  correctionConfirmation: boolean;

  // Appearance
  theme: 'light' | 'dark' | 'system';
  compactMode: boolean;

  // Keyboard Shortcut
  shortcutCheckText: string;
}

export interface Correction {
  id: string;
  wrongWord: string;
  suggestedWord: string;
  isApplied: boolean;
  context?: string;
  timestamp?: string;
}

export interface SavedText {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DictionaryWord {
  id: string;
  word: string;
  addedAt: string;
}

export interface Statistics {
  mistakesDetected: number;
  correctionsApplied: number;
  savedTextsCount: number;
}

export interface DetectedMistake {
  id: string;
  word: string;
  suggestion: string;
  suggestions: string[];
  confidence: number;
  index: number;
  length: number;
}

export type NavigationTab = 'dashboard' | 'my-text' | 'dictionary' | 'settings';

export type ControlSupportState = 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_SUPPORTED' | 'ERROR';

export type ReplacementStatus =
  | 'APPLIED'
  | 'STALE_TARGET'
  | 'UNSUPPORTED'
  | 'PASSWORD_BLOCKED'
  | 'FOCUS_CHANGED'
  | 'REPLACEMENT_FAILED';

export interface ReplacementResult {
  success: boolean;
  status: ReplacementStatus;
  original?: string;
  replacement?: string;
  error?: string;
}

export interface ReplaceRangeParams {
  start: number;
  length: number;
  replacement: string;
  expectedOriginal: string;
}

export interface TextControlInfo {
  appName: string;
  windowTitle: string;
  controlType: string;
  supportState: ControlSupportState;
  hasTextPattern: boolean;
  hasValuePattern: boolean;
  isPassword: boolean;
  isReadOnly: boolean;
  supportsReplacement: boolean;
  details?: string;
}

export interface FocusedTextPayload {
  text: string;
  controlInfo: TextControlInfo;
  charCount: number;
}

export interface WindowsIntegrationStatus {
  connected: boolean;
  monitoring: boolean;
  activeControl: TextControlInfo | null;
  lastCheckedTime?: string;
  mode: 'tauri-native' | 'web-simulation';
}
