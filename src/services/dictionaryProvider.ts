/**
 * WritePilot - English Dictionary Provider
 * 
 * Manages loading and caching of Hunspell English dictionary via `nspell`.
 * Runs 100% locally in browser memory - zero telemetry, zero cloud APIs.
 */

// @ts-ignore - nspell doesn't have official TS types in all configurations
import nspell from 'nspell';

interface SpellInstance {
  correct: (word: string) => boolean;
  suggest: (word: string) => string[];
  add: (word: string) => void;
  remove: (word: string) => void;
}

let spellInstance: SpellInstance | null = null;
let initPromise: Promise<SpellInstance | null> | null = null;

/**
 * Initializes the English dictionary once and caches it in memory.
 * Fetches the local Hunspell affix and dictionary files from `/dict/en.aff` and `/dict/en.dic`.
 */
export async function initEnglishDictionary(): Promise<SpellInstance | null> {
  if (spellInstance) return spellInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const [affResponse, dicResponse] = await Promise.all([
        fetch('/dict/en.aff'),
        fetch('/dict/en.dic')
      ]);

      if (!affResponse.ok || !dicResponse.ok) {
        console.warn('[WritePilot Dictionary] Could not fetch dictionary files from /dict/en.*');
        return null;
      }

      const [affText, dicText] = await Promise.all([
        affResponse.text(),
        dicResponse.text()
      ]);

      spellInstance = nspell(affText, dicText);
      console.log('[WritePilot Dictionary] Real English dictionary initialized successfully.');
      return spellInstance;
    } catch (err) {
      console.error('[WritePilot Dictionary] Failed to load offline dictionary:', err);
      return null;
    }
  })();

  return initPromise;
}

/**
 * Synchronous accessor for the initialized dictionary instance (if loaded).
 */
export function getDictionaryInstance(): SpellInstance | null {
  return spellInstance;
}
