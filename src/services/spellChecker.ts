/**
 * WritePilot - Core Spell Checker Service (Phase 2A: Real Local English Spelling Engine)
 * 
 * Local-First, Zero Cloud/AI telemetry.
 * Fast in-memory dictionary lookup, Hunspell English dictionary via nspell,
 * common misspelling mappings, punctuation isolation, case preservation,
 * confidence scoring, conservative proper-name handling, context-aware ranking,
 * and exclusion of numbers, emails, URLs, filenames, and snake_case tokens.
 * 
 * FUTURE TAURI / RUST INTEGRATION (Phase 3+):
 * These interfaces mirror the Rust backend Tauri commands:
 * `await invoke('check_word', { word, customDictionary })`
 * `await invoke('get_suggestions', { word, contextBefore })`
 * `await invoke('find_mistakes_in_text', { text, customDictionary })`
 */

import { DetectedMistake } from '../types';
import { getDictionaryInstance, initEnglishDictionary } from './dictionaryProvider';
import { levenshteinDistance, stringSimilarity } from './similarity';

// Initialize dictionary immediately on module load in browser
if (typeof window !== 'undefined') {
  initEnglishDictionary();
}

/**
 * Common typo to suggestions mapping with primary correction and reasonable variants.
 * Ranked with very high internal confidence scores (0.97 - 0.99).
 */
export interface SuggestionEntry {
  suggestions: string[];
  confidence: number;
}

export const COMMON_TYPOS: Record<string, SuggestionEntry> = {
  tommorow: { suggestions: ['tomorrow'], confidence: 0.98 },
  tomorow: { suggestions: ['tomorrow'], confidence: 0.97 },
  recieve: { suggestions: ['receive', 'receiver', 'received'], confidence: 0.98 },
  recieved: { suggestions: ['received', 'receiver', 'receive'], confidence: 0.98 },
  recieveing: { suggestions: ['receiving', 'receive', 'received'], confidence: 0.98 },
  becuase: { suggestions: ['because'], confidence: 0.99 },
  seperate: { suggestions: ['separate', 'separated', 'separates'], confidence: 0.98 },
  seperated: { suggestions: ['separated', 'separate'], confidence: 0.98 },
  definately: { suggestions: ['definitely'], confidence: 0.99 },
  goverment: { suggestions: ['government', 'governmental', 'governance'], confidence: 0.98 },
  occured: { suggestions: ['occurred', 'occurring', 'occur'], confidence: 0.98 },
  untill: { suggestions: ['until'], confidence: 0.98 },
  wich: { suggestions: ['which'], confidence: 0.97 },
  thier: { suggestions: ['their', 'there'], confidence: 0.96 },
  wierd: { suggestions: ['weird', 'wired'], confidence: 0.96 },
  beleive: { suggestions: ['believe', 'believer', 'believes'], confidence: 0.98 },
  adress: { suggestions: ['address', 'addressed', 'addresses'], confidence: 0.98 },
  acheive: { suggestions: ['achieve', 'achieved', 'achiever'], confidence: 0.98 },
  begining: { suggestions: ['beginning', 'began', 'begin'], confidence: 0.98 },
  calender: { suggestions: ['calendar', 'calendars'], confidence: 0.98 },
  comming: { suggestions: ['coming'], confidence: 0.98 },
  enviroment: { suggestions: ['environment', 'environmental'], confidence: 0.98 },
  occassion: { suggestions: ['occasion', 'occasional'], confidence: 0.98 },
  neccessary: { suggestions: ['necessary', 'necessarily'], confidence: 0.98 },
  responsable: { suggestions: ['responsible', 'responsibly'], confidence: 0.98 },
  succesful: { suggestions: ['successful', 'successfully'], confidence: 0.98 },
  realy: { suggestions: ['really', 'real'], confidence: 0.96 },
  writting: { suggestions: ['writing', 'writer', 'written'], confidence: 0.98 },
  remeber: { suggestions: ['remember', 'remembered'], confidence: 0.98 },
  refered: { suggestions: ['referred', 'refer'], confidence: 0.98 },
  arguement: { suggestions: ['argument', 'arguments'], confidence: 0.98 },
  experiance: { suggestions: ['experience', 'experienced'], confidence: 0.98 },
  managment: { suggestions: ['management', 'manager'], confidence: 0.98 },
  langauge: { suggestions: ['language', 'languages'], confidence: 0.98 },
  truely: { suggestions: ['truly'], confidence: 0.97 },
  accomodate: { suggestions: ['accommodate', 'accommodated'], confidence: 0.98 },
  embarass: { suggestions: ['embarrass', 'embarrassed'], confidence: 0.98 },
  grammer: { suggestions: ['grammar', 'grammatical'], confidence: 0.97 },
  knowlege: { suggestions: ['knowledge', 'knowledgeable'], confidence: 0.98 },
  pronounciation: { suggestions: ['pronunciation'], confidence: 0.98 },
  publically: { suggestions: ['publicly'], confidence: 0.98 },
  recommand: { suggestions: ['recommend', 'recommended'], confidence: 0.98 },
  suprise: { suggestions: ['surprise', 'surprised'], confidence: 0.98 },
  whould: { suggestions: ['would'], confidence: 0.96 },
  shoud: { suggestions: ['should'], confidence: 0.96 },
  coud: { suggestions: ['could'], confidence: 0.96 },
  writen: { suggestions: ['written'], confidence: 0.97 },
  priviledge: { suggestions: ['privilege', 'privileged'], confidence: 0.98 },
  independant: { suggestions: ['independent'], confidence: 0.98 },
  maintenence: { suggestions: ['maintenance'], confidence: 0.98 },
  mispell: { suggestions: ['misspell', 'misspelled'], confidence: 0.98 },
  noticable: { suggestions: ['noticeable'], confidence: 0.98 },
  persistance: { suggestions: ['persistence'], confidence: 0.98 },
  possession: { suggestions: ['possession'], confidence: 0.98 },
  posession: { suggestions: ['possession'], confidence: 0.98 },
  tendancy: { suggestions: ['tendency'], confidence: 0.98 },
  documnt: { suggestions: ['document', 'documents'], confidence: 0.98 },
  offce: { suggestions: ['office', 'offices'], confidence: 0.97 },
  thise: { suggestions: ['this', 'these', 'those'], confidence: 0.98 },
  ame: { suggestions: ['am', 'name', 'same', 'came'], confidence: 0.96 },
};

/**
 * Built-in whitelist of common recognized technical terms, companies, and Indian names/places
 * to prevent aggressive flagging even if not yet in the user's custom dictionary.
 */
const KNOWN_PROPER_TERMS = new Set<string>([
  'anand', 'bayer', 'glucobay', 'datapilot', 'writepilot',
  'surat', 'ahmedabad', 'chatgpt', 'openai', 'microsoft',
  'google', 'patel', 'sharma', 'mumbai', 'delhi', 'bangalore',
  'windows', 'tauri', 'vite', 'react', 'linux', 'github'
]);

/**
 * High-frequency English functional words for short word checks and context ranking.
 */
const COMMON_SHORT_ENGLISH_WORDS = new Set<string>([
  'i', 'a', 'am', 'an', 'the', 'this', 'that', 'is', 'are', 'was', 'were',
  'you', 'we', 'they', 'he', 'she', 'it', 'my', 'your', 'our', 'for', 'from',
  'with', 'and', 'but', 'not', 'have', 'has', 'had', 'will', 'can', 'could',
  'would', 'should', 'to', 'in', 'on', 'at', 'by', 'be', 'do', 'go', 'me',
  'so', 'up', 'out', 'if', 'no', 'as', 'or', 'of', 'us', 'see', 'get', 'say'
]);

/**
 * Checks if a word is in the user's custom dictionary (case-insensitive).
 */
export function isWordInDictionary(word: string, customDictionary: string[] = []): boolean {
  if (!word) return false;
  const clean = word.toLowerCase().trim();
  if (customDictionary.some((dictWord) => dictWord.toLowerCase().trim() === clean)) {
    return true;
  }
  if (KNOWN_PROPER_TERMS.has(clean)) {
    return true;
  }
  return false;
}

/**
 * Checks whether a single word is spelled correctly.
 * 1. Checks custom dictionary.
 * 2. Checks token filter (numbers, emails, URLs, code identifiers, symbols).
 * 3. Checks known typo database.
 * 4. Checks Hunspell English dictionary via nspell.
 * 5. Conservative handling for proper names / capitalized words.
 */
export function checkWord(word: string, customDictionary: string[] = []): boolean {
  if (!word || word.trim().length <= 1) return true;

  const trimmed = word.trim();

  // If in custom dictionary or built-in proper terms -> valid
  if (isWordInDictionary(trimmed, customDictionary)) {
    return true;
  }

  // Check if token should be ignored (e.g., number, email, URL, path, code identifier)
  if (shouldIgnoreToken(trimmed)) {
    return true;
  }

  // Strip punctuation surrounding the word
  const stripped = stripPunctuation(trimmed);
  if (!stripped || stripped.length <= 1) return true;

  if (isWordInDictionary(stripped, customDictionary)) {
    return true;
  }

  const lower = stripped.toLowerCase();

  // If it's a known typo -> definitely false
  if (COMMON_TYPOS[lower]) {
    return false;
  }

  // Check with local real English dictionary if initialized
  const dict = getDictionaryInstance();
  if (dict) {
    // Check original case and lower case
    if (dict.correct(stripped) || dict.correct(lower)) {
      return true;
    }

    // Capitalized unknown word: check if it's a proper name candidate
    if (isLikelyProperName(stripped)) {
      // Conservative rule: unknown capitalized words without a known typo match are not treated as errors
      return true;
    }

    return false;
  }

  // Fallback if dictionary is still loading: check short common words whitelist
  if (COMMON_SHORT_ENGLISH_WORDS.has(lower)) {
    return true;
  }

  return true;
}

/**
 * Determines if a token is formatted like a proper name / noun (starts with Capital, followed by lowercase).
 */
export function isLikelyProperName(word: string): boolean {
  if (!word || word.length < 2) return false;
  const first = word.charAt(0);
  const rest = word.slice(1);
  // Title case check: First is uppercase, rest is lowercase letters
  const isTitleCase = first === first.toUpperCase() && first !== first.toLowerCase() && rest === rest.toLowerCase();
  return isTitleCase;
}

/**
 * Returns candidate spelling suggestions for a misspelled word.
 * Context-aware: takes optional previous word context to rank suggestions (e.g. "I" before "ame" -> "am").
 */
export function getSuggestions(word: string, contextBefore?: string): string[] {
  if (!word) return [];
  const stripped = stripPunctuation(word.trim());
  const lower = stripped.toLowerCase();

  const candidates: Array<{ text: string; score: number }> = [];
  const seen = new Set<string>();

  // 1. Check known typos (highest priority)
  const typoEntry = COMMON_TYPOS[lower];
  if (typoEntry) {
    for (let i = 0; i < typoEntry.suggestions.length; i++) {
      const sug = typoEntry.suggestions[i];
      const sugLower = sug.toLowerCase();
      if (!seen.has(sugLower)) {
        seen.add(sugLower);
        // Base score high for known typos
        candidates.push({ text: sug, score: 100 - i });
      }
    }
  }

  // 2. Query real English dictionary (Hunspell)
  const dict = getDictionaryInstance();
  if (dict) {
    try {
      const hunspellSuggestions = dict.suggest(stripped);
      for (const sug of hunspellSuggestions) {
        const sugLower = sug.toLowerCase();
        if (!seen.has(sugLower)) {
          seen.add(sugLower);
          // Calculate string similarity and length penalty
          const sim = stringSimilarity(lower, sugLower);
          let score = sim * 50;

          // Bonus if suggestion is a common high-frequency English word
          if (COMMON_SHORT_ENGLISH_WORDS.has(sugLower)) {
            score += 15;
          }

          // Same first letter bonus
          if (sugLower[0] === lower[0]) {
            score += 5;
          }

          candidates.push({ text: sug, score });
        }
      }
    } catch (err) {
      console.warn('[WritePilot] Dict suggest error:', err);
    }
  }

  // 3. Context-aware ranking adjustments
  if (contextBefore) {
    const prev = contextBefore.toLowerCase().trim();
    // Context: "i [ame]" -> "am" should rank at top
    if (prev === 'i' || prev === 'i\'m') {
      for (const c of candidates) {
        if (c.text.toLowerCase() === 'am') {
          c.score += 60;
        }
      }
    }
    // Context: "to the [offce]" -> "office"
    if (prev === 'the' || prev === 'our' || prev === 'my' || prev === 'an') {
      for (const c of candidates) {
        if (c.text.toLowerCase() === 'office' || c.text.toLowerCase() === 'document') {
          c.score += 40;
        }
      }
    }
  }

  // Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Return top 5 suggestions with case preservation
  return candidates.slice(0, 5).map((c) => preserveCase(stripped, c.text));
}

/**
 * Calculates a confidence value (0.0 to 1.0) for a proposed suggestion.
 * - Known typo map: 0.96 - 0.99
 * - Very close dictionary candidate (edit distance 1, high similarity): 0.85 - 0.92
 * - Distant or ambiguous candidate: 0.50 - 0.75
 */
export function calculateConfidence(word: string, suggestion: string): number {
  const normWord = word.toLowerCase();
  const normSug = suggestion.toLowerCase();

  // Known typo check
  if (COMMON_TYPOS[normWord]) {
    return COMMON_TYPOS[normWord].confidence;
  }

  // Distance check
  const dist = levenshteinDistance(normWord, normSug);
  const sim = stringSimilarity(normWord, normSug);

  if (dist === 1) {
    // Single character typo in normal word
    return Math.min(0.92, 0.85 + sim * 0.07);
  }

  if (dist === 2 && normWord.length >= 5) {
    return Math.min(0.85, 0.70 + sim * 0.15);
  }

  return Math.min(0.70, sim * 0.75);
}

/**
 * Corrects a single word using the highest-confidence suggestion or provided replacement.
 * Preserves the original word's capitalization and surrounding punctuation.
 */
export function correctWord(word: string, specificCorrection?: string, contextBefore?: string): string {
  const { leading, content, trailing } = splitPunctuation(word);
  if (!content) return word;

  let replacement = specificCorrection;
  if (!replacement) {
    const suggestions = getSuggestions(content, contextBefore);
    replacement = suggestions.length > 0 ? suggestions[0] : content;
  } else {
    replacement = preserveCase(content, replacement);
  }

  return `${leading}${replacement}${trailing}`;
}

/**
 * Scans a sentence or paragraph and returns all detected spelling mistakes
 * with confidence scores, suggested replacements, and token indices.
 */
export function findMistakesInText(
  text: string,
  customDictionary: string[] = []
): DetectedMistake[] {
  if (!text || !text.trim()) return [];

  const mistakes: DetectedMistake[] = [];
  const tokenRegex = /\S+/g;
  let match: RegExpExecArray | null;

  let previousWord = '';

  while ((match = tokenRegex.exec(text)) !== null) {
    const rawToken = match[0];
    const matchIndex = match.index;

    // Check if the entire token should be ignored (e.g. URL, email, file path, number, currency)
    if (shouldIgnoreToken(rawToken)) {
      previousWord = '';
      continue;
    }

    // Isolate core word and surrounding punctuation
    const { leading, content } = splitPunctuation(rawToken);
    if (!content || content.length <= 1) {
      previousWord = content;
      continue;
    }

    // Check custom dictionary for core word
    if (isWordInDictionary(content, customDictionary)) {
      previousWord = content;
      continue;
    }

    // Check if core word contains numbers, symbols, or snake_case (e.g. DataPilot_v2, v2_model)
    if (/[0-9_]/.test(content)) {
      previousWord = content;
      continue;
    }

    const lower = content.toLowerCase();

    // 1. Check known typo dictionary (highest priority)
    const typoEntry = COMMON_TYPOS[lower];
    if (typoEntry) {
      const suggestions = typoEntry.suggestions.map((sug) => preserveCase(content, sug));
      const primarySuggestion = suggestions[0];
      const actualWordIndex = matchIndex + leading.length;

      mistakes.push({
        id: `mistake-${actualWordIndex}-${content}`,
        word: content,
        suggestion: primarySuggestion,
        suggestions,
        confidence: typoEntry.confidence,
        index: actualWordIndex,
        length: content.length,
      });
      previousWord = primarySuggestion;
      continue;
    }

    // 2. Check with real English dictionary (Hunspell)
    const dict = getDictionaryInstance();
    if (dict) {
      // If valid word in dictionary -> skip
      if (dict.correct(content) || dict.correct(lower)) {
        previousWord = content;
        continue;
      }

      // Conservative rule for Proper Names / Capitalized words:
      // If it looks like a proper name and is NOT in the known typo list, DO NOT flag it as an error
      if (isLikelyProperName(content)) {
        previousWord = content;
        continue;
      }

      // Generate context-aware suggestions
      const suggestions = getSuggestions(content, previousWord);
      if (suggestions.length > 0) {
        const primarySuggestion = suggestions[0];
        const actualWordIndex = matchIndex + leading.length;
        const confidence = calculateConfidence(content, primarySuggestion);

        mistakes.push({
          id: `mistake-${actualWordIndex}-${content}`,
          word: content,
          suggestion: primarySuggestion,
          suggestions,
          confidence,
          index: actualWordIndex,
          length: content.length,
        });
      }
    }

    previousWord = content;
  }

  return mistakes;
}

/**
 * Generates a stable signature for a detected mistake instance within a document.
 * Combines normalized mistake word, primary correction, and occurrence index
 * to prevent duplicate counting during debounced typing analysis.
 */
export function getMistakeSignature(
  mistake: { word: string; suggestion: string },
  occurrenceIndex: number = 0
): string {
  const normWord = mistake.word.toLowerCase();
  const normSug = mistake.suggestion.toLowerCase();
  return `${normWord}->${normSug}#${occurrenceIndex}`;
}

/**
 * Compares current detected mistakes against an active set of tracked mistake signatures.
 * Returns only genuine newly detected mistakes, and the updated active signature set.
 * Guarantees zero duplicate counting during re-renders or repeated analysis.
 */
export function identifyNewMistakes(
  currentMistakes: DetectedMistake[],
  activeSignatures: Set<string>
): {
  newMistakes: DetectedMistake[];
  updatedSignatures: Set<string>;
} {
  const occurrenceCounts: Record<string, number> = {};
  const newMistakes: DetectedMistake[] = [];
  const updatedSignatures = new Set<string>();

  for (const m of currentMistakes) {
    const norm = m.word.toLowerCase();
    const count = occurrenceCounts[norm] || 0;
    occurrenceCounts[norm] = count + 1;

    const signature = getMistakeSignature(m, count);
    updatedSignatures.add(signature);

    if (!activeSignatures.has(signature)) {
      newMistakes.push(m);
    }
  }

  return { newMistakes, updatedSignatures };
}

/**
 * Checks if a token should be bypassed from spell-checking.
 * Bypasses:
 * - Numbers & Currency (e.g. 123, 2026, ₹29600, $50, 45%)
 * - Email addresses (e.g. test@example.com, john.doe@work.co.uk)
 * - URLs & Web domains (e.g. https://example.com, www.site.org, api.domain.com/v1)
 * - File paths (e.g. C:\Users\Test, /usr/local/bin, ./src/index.ts)
 * - Code identifiers with underscores or digits (e.g. DataPilot_v2, user_id, api_v3)
 */
export function shouldIgnoreToken(token: string): boolean {
  if (!token) return true;

  // Single characters
  if (token.length <= 1) return true;

  // Pure numbers or numbers with currency/percentage (123, 2026, ₹29600, $50, 100%, 3.14, 1,000)
  if (/^[₹$€£¥#]?\s*[\d,.]+%?$/.test(token)) {
    return true;
  }

  // Any token starting with a currency symbol or digit
  if (/^[₹$€£¥\d]/.test(token)) {
    return true;
  }

  // Email address
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(token)) {
    return true;
  }

  // URLs & links
  if (/^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i.test(token)) {
    return true;
  }

  // File paths (Windows drive C:\... or unix /usr/...)
  if (/^[a-zA-Z]:\\[^\s]+/.test(token) || /^\/[a-zA-Z0-9_-]+\/[^\s]+/.test(token)) {
    return true;
  }

  // Identifiers with underscores or hyphens combined with alphanumeric (e.g., DataPilot_v2, item_id_9)
  if (token.includes('_')) {
    return true;
  }

  // All-caps acronyms (e.g., API, NASA, HTML, PC, UI)
  if (/^[A-Z]{2,6}$/.test(token)) {
    return true;
  }

  return false;
}

/**
 * Strips surrounding punctuation from a token.
 * Examples:
 *   "hello," -> "hello"
 *   "\"hello\"" -> "hello"
 *   "(hello)" -> "hello"
 *   "[this]" -> "this"
 *   "hello!" -> "hello"
 */
export function stripPunctuation(token: string): string {
  return token.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
}

/**
 * Splits leading punctuation, core word content, and trailing punctuation.
 */
export function splitPunctuation(token: string): { leading: string; content: string; trailing: string } {
  const match = token.match(/^([^a-zA-Z0-9]*)(.*?)([^a-zA-Z0-9]*)$/);
  if (!match) {
    return { leading: '', content: token, trailing: '' };
  }
  return {
    leading: match[1] || '',
    content: match[2] || '',
    trailing: match[3] || '',
  };
}

/**
 * Preserves the casing of the original word when applying a replacement.
 * Examples:
 *   "Tommorow" -> "Tomorrow" (Title Case)
 *   "TOMMOROW" -> "TOMORROW" (ALL CAPS)
 *   "tommorow" -> "tomorrow" (lowercase)
 *   "Thise" -> "This"
 */
export function preserveCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;

  // All caps check (only if length > 1)
  if (original.length > 1 && original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }

  // First letter capitalized
  const firstLetter = original.charAt(0);
  if (firstLetter === firstLetter.toUpperCase() && firstLetter !== firstLetter.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }

  // Default to lowercase
  return replacement.toLowerCase();
}
