/**
 * WritePilot - Storage Service
 * 
 * Local-First Persistence Layer:
 * - In Phase 1: Uses client-side localStorage with seeded demo data.
 * - In Phase 2: Will seamlessly swap or sync with SQLite / tauri-plugin-store via Tauri IPC.
 * - Zero remote servers, zero external telemetry.
 */

import { Correction, DictionaryWord, SavedText, Settings, Statistics } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'writepilot_settings_v1',
  SAVED_TEXTS: 'writepilot_saved_texts_v1',
  DICTIONARY: 'writepilot_dictionary_v1',
  CORRECTIONS: 'writepilot_recent_corrections_v1',
  STATS: 'writepilot_stats_v1',
};

// Default initial settings
export const DEFAULT_SETTINGS: Settings = {
  startWithWindows: true,
  assistantEnabled: true,
  autoApplyCorrections: false,
  showSpellingSuggestions: true,
  correctionConfirmation: true,
  theme: 'light',
  compactMode: false,
  shortcutCheckText: 'Ctrl + Shift + C',
};

// Initial demo saved texts
const INITIAL_SAVED_TEXTS: SavedText[] = [
  {
    id: 'text-1',
    title: 'Doctor Invitation',
    content: 'Dear Dr. Patel, we are pleased to invite you as our distinguished keynote speaker for the annual Medical Sciences Symposium held on October 14th at the Grand Plaza Hall. We look forward to your valuable insights on modern therapeutic innovations.',
    createdAt: '2026-09-24',
    updatedAt: '2026-09-24',
  },
  {
    id: 'text-2',
    title: 'Manager Message',
    content: 'Good morning sir, I wanted to provide a quick progress update on the quarterly deliverables and sprint milestones. All core modules have successfully passed integration benchmarks, and we remain ahead of the target schedule.',
    createdAt: '2026-09-22',
    updatedAt: '2026-09-22',
  },
  {
    id: 'text-3',
    title: 'Client Follow-up',
    content: 'Hi Sarah, thank you for taking the time to discuss the technical implementation roadmap yesterday. Attached is the revised scope summary and milestone timeline for your team to review before our Friday sync.',
    createdAt: '2026-09-18',
    updatedAt: '2026-09-18',
  },
];

// Initial demo dictionary words
const INITIAL_DICTIONARY_WORDS: DictionaryWord[] = [
  { id: 'dict-1', word: 'WritePilot', addedAt: '2026-09-10' },
  { id: 'dict-2', word: 'DataPilot', addedAt: '2026-09-12' },
  { id: 'dict-3', word: 'Bayer', addedAt: '2026-09-15' },
  { id: 'dict-4', word: 'Glucobay', addedAt: '2026-09-18' },
];

// Initial demo recent corrections
const INITIAL_CORRECTIONS: Correction[] = [
  {
    id: 'corr-1',
    wrongWord: 'tommorow',
    suggestedWord: 'tomorrow',
    isApplied: false,
    timestamp: '10:42 AM',
  },
  {
    id: 'corr-2',
    wrongWord: 'recieve',
    suggestedWord: 'receive',
    isApplied: false,
    timestamp: '09:15 AM',
  },
  {
    id: 'corr-3',
    wrongWord: 'becuase',
    suggestedWord: 'because',
    isApplied: false,
    timestamp: 'Yesterday',
  },
  {
    id: 'corr-4',
    wrongWord: 'seperate',
    suggestedWord: 'separate',
    isApplied: false,
    timestamp: 'Sep 26',
  },
];

const INITIAL_STATS: Statistics = {
  mistakesDetected: 142,
  correctionsApplied: 89,
  savedTextsCount: 3,
};

// Safe JSON parser helper
function safeGet<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (err) {
    console.error(`Error loading key "${key}" from storage:`, err);
    return defaultValue;
  }
}

function safeSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving key "${key}" to storage:`, err);
  }
}

// ----------------- SETTINGS API -----------------
export function getSettings(): Settings {
  return safeGet<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function saveSettings(updates: Partial<Settings>): Settings {
  const current = getSettings();
  const next = { ...current, ...updates };
  safeSet(STORAGE_KEYS.SETTINGS, next);
  return next;
}

// ----------------- SAVED TEXTS API -----------------
export function getSavedTexts(): SavedText[] {
  return safeGet<SavedText[]>(STORAGE_KEYS.SAVED_TEXTS, INITIAL_SAVED_TEXTS);
}

export function saveText(text: { title: string; content: string }, id?: string): SavedText[] {
  const list = getSavedTexts();
  const now = new Date().toISOString().split('T')[0];

  if (id) {
    // Update existing
    const updated = list.map(item =>
      item.id === id ? { ...item, title: text.title, content: text.content, updatedAt: now } : item
    );
    safeSet(STORAGE_KEYS.SAVED_TEXTS, updated);
    return updated;
  } else {
    // Create new
    const newItem: SavedText = {
      id: `text-${Date.now()}`,
      title: text.title.trim() || 'Untitled Note',
      content: text.content.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const updated = [newItem, ...list];
    safeSet(STORAGE_KEYS.SAVED_TEXTS, updated);
    return updated;
  }
}

export function deleteSavedText(id: string): SavedText[] {
  const list = getSavedTexts();
  const updated = list.filter(item => item.id !== id);
  safeSet(STORAGE_KEYS.SAVED_TEXTS, updated);
  return updated;
}

// ----------------- DICTIONARY API -----------------
export function getDictionaryWords(): DictionaryWord[] {
  return safeGet<DictionaryWord[]>(STORAGE_KEYS.DICTIONARY, INITIAL_DICTIONARY_WORDS);
}

export function addDictionaryWord(rawWord: string): DictionaryWord[] {
  const word = rawWord.trim();
  if (!word) return getDictionaryWords();

  const list = getDictionaryWords();
  // Check case-insensitive duplicate
  if (list.some(item => item.word.toLowerCase() === word.toLowerCase())) {
    return list;
  }

  const now = new Date().toISOString().split('T')[0];
  const newEntry: DictionaryWord = {
    id: `dict-${Date.now()}`,
    word,
    addedAt: now,
  };

  const updated = [...list, newEntry].sort((a, b) => a.word.localeCompare(b.word));
  safeSet(STORAGE_KEYS.DICTIONARY, updated);
  return updated;
}

export function deleteDictionaryWord(id: string): DictionaryWord[] {
  const list = getDictionaryWords();
  const updated = list.filter(item => item.id !== id);
  safeSet(STORAGE_KEYS.DICTIONARY, updated);
  return updated;
}

// ----------------- RECENT CORRECTIONS API -----------------
export function getCorrections(): Correction[] {
  return safeGet<Correction[]>(STORAGE_KEYS.CORRECTIONS, INITIAL_CORRECTIONS);
}

export function markCorrectionApplied(id: string): Correction[] {
  const list = getCorrections();
  const updated = list.map(c => (c.id === id ? { ...c, isApplied: true } : c));
  safeSet(STORAGE_KEYS.CORRECTIONS, updated);
  return updated;
}

export function addRecentCorrections(newItems: { wrongWord: string; suggestedWord: string }[]): Correction[] {
  const list = getCorrections();
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const entries: Correction[] = newItems.map((item, idx) => ({
    id: `corr-${Date.now()}-${idx}`,
    wrongWord: item.wrongWord,
    suggestedWord: item.suggestedWord,
    isApplied: true,
    timestamp: now,
  }));
  // Prepend and keep top 10
  const updated = [...entries, ...list].slice(0, 10);
  safeSet(STORAGE_KEYS.CORRECTIONS, updated);
  return updated;
}

// ----------------- STATS API -----------------
export function getStatistics(): Statistics {
  return safeGet<Statistics>(STORAGE_KEYS.STATS, INITIAL_STATS);
}

export function updateStatistics(delta: Partial<Statistics>): Statistics {
  const current = getStatistics();
  const next: Statistics = {
    mistakesDetected: current.mistakesDetected + (delta.mistakesDetected ?? 0),
    correctionsApplied: current.correctionsApplied + (delta.correctionsApplied ?? 0),
    savedTextsCount: delta.savedTextsCount !== undefined ? delta.savedTextsCount : current.savedTextsCount,
  };
  safeSet(STORAGE_KEYS.STATS, next);
  return next;
}
