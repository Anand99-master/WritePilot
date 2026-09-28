import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, CheckCircle2, RotateCcw, Zap, AlertTriangle, X, Check, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { findMistakesInText, identifyNewMistakes } from '../../services/spellChecker';
import { initEnglishDictionary } from '../../services/dictionaryProvider';
import { DetectedMistake } from '../../types';

export interface TypingSandboxProps {
  customDictionary: string[];
  autoApply: boolean;
  autoApplyThreshold?: number; // Default 0.95
  onMistakeFound?: (count: number) => void;
  onCorrectionApplied?: (appliedMistakes: { wrongWord: string; suggestedWord: string }[]) => void;
}

// Preset test scenarios from requirements for rapid verification
const PRESET_TEST_CASES = [
  {
    label: 'Test A: I ame anand thise',
    text: 'I ame anand thise',
  },
  {
    label: 'Test B: recieve & tommorow',
    text: 'I will recieve the document tommorow.',
  },
  {
    label: 'Test C: definately necessary',
    text: 'This is definately necessary.',
  },
  {
    label: 'Test D: Anand works at Bayer',
    text: 'Anand works at Bayer.',
  },
  {
    label: 'Test E: working on DataPilot',
    text: 'I am working on DataPilot.',
  },
  {
    label: 'Test F: documnt & tommorow',
    text: 'Please send the documnt tommorow.',
  },
  {
    label: 'Test G: thise',
    text: 'thise',
  },
  {
    label: 'Test H: ame',
    text: 'ame',
  },
  {
    label: 'Test I: Email & Punctuation',
    text: 'Email me at test@example.com "(becuase)" and [this]!',
  },
];

export const TypingSandbox: React.FC<TypingSandboxProps> = ({
  customDictionary,
  autoApply,
  autoApplyThreshold = 0.95,
  onMistakeFound,
  onCorrectionApplied,
}) => {
  const [inputText, setInputText] = useState('I ame anand thise');
  const [mistakes, setMistakes] = useState<DetectedMistake[]>([]);
  const [selectedMistake, setSelectedMistake] = useState<DetectedMistake | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [lastAutoAppliedCount, setLastAutoAppliedCount] = useState<number>(0);
  const [dictLoaded, setDictLoaded] = useState<boolean>(false);

  const debounceTimerRef = useRef<number | null>(null);
  const isAutoApplyingRef = useRef<boolean>(false);
  // Session-level tracking of active mistake signatures to guarantee zero duplicate counting
  const activeSignaturesRef = useRef<Set<string>>(new Set());

  // Ensure dictionary is initialized
  useEffect(() => {
    initEnglishDictionary().then(() => {
      setDictLoaded(true);
    });
  }, []);

  // Debounced text analysis
  useEffect(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    // Small debounce (180ms) for high typing performance
    debounceTimerRef.current = window.setTimeout(() => {
      // If we just programmatically auto-applied, skip re-evaluating to prevent infinite loops
      if (isAutoApplyingRef.current) {
        isAutoApplyingRef.current = false;
        return;
      }

      const detected = findMistakesInText(inputText, customDictionary);
      // Filter out dismissed mistake instances
      const active = detected.filter((m) => !dismissedIds.has(m.id));

      // 1. Separate Counting from Detection:
      // Identify only genuinely newly detected mistakes in this session
      const { newMistakes, updatedSignatures } = identifyNewMistakes(
        active,
        activeSignaturesRef.current
      );

      // Increment Mistakes Detected ONLY for newly detected mistakes (0 on repeated analysis/wait)
      if (newMistakes.length > 0) {
        onMistakeFound?.(newMistakes.length);
      }

      // 2. Auto Apply Safety:
      // When Auto Apply is ON, only replace mistakes above the safety threshold (default 0.95)
      // Never auto-replace unknown proper names or ambiguous words
      if (autoApply) {
        const autoApplicable = active.filter((m) => m.confidence >= autoApplyThreshold);

        if (autoApplicable.length > 0) {
          isAutoApplyingRef.current = true;
          let updatedText = inputText;
          const appliedEntries: { wrongWord: string; suggestedWord: string }[] = [];

          // Sort backwards by index so replacing doesn't distort previous character positions
          const sorted = [...autoApplicable].sort((a, b) => b.index - a.index);
          for (const item of sorted) {
            const before = updatedText.slice(0, item.index);
            const after = updatedText.slice(item.index + item.length);
            updatedText = before + item.suggestion + after;
            appliedEntries.push({ wrongWord: item.word, suggestedWord: item.suggestion });
          }

          setInputText(updatedText);
          setLastAutoAppliedCount(appliedEntries.length);
          setTimeout(() => setLastAutoAppliedCount(0), 3000);

          // Update Corrections Applied statistic ONLY when replacement occurs
          if (onCorrectionApplied) {
            onCorrectionApplied(appliedEntries);
          }

          // Remaining mistakes below threshold
          const remaining = active.filter((m) => m.confidence < autoApplyThreshold);
          setMistakes(remaining);
          setSelectedMistake(null);

          // Update remaining active signatures
          const remainingDetected = findMistakesInText(updatedText, customDictionary);
          const { updatedSignatures: nextSignatures } = identifyNewMistakes(
            remainingDetected,
            new Set()
          );
          activeSignaturesRef.current = nextSignatures;
          return;
        }
      }

      // Update active signatures
      activeSignaturesRef.current = updatedSignatures;
      setMistakes(active);

      // If previously selected mistake is gone, reset selection
      if (selectedMistake && !active.some((m) => m.id === selectedMistake.id)) {
        setSelectedMistake(null);
      }
    }, 180);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputText, customDictionary, autoApply, autoApplyThreshold, dismissedIds, dictLoaded, onMistakeFound, onCorrectionApplied]);

  // Manually apply a single specific suggestion
  const handleApplySuggestion = (mistake: DetectedMistake, chosenWord?: string) => {
    const replacement = chosenWord || mistake.suggestion;
    const before = inputText.slice(0, mistake.index);
    const after = inputText.slice(mistake.index + mistake.length);
    const updated = before + replacement + after;

    setInputText(updated);
    setSelectedMistake(null);

    if (onCorrectionApplied) {
      onCorrectionApplied([{ wrongWord: mistake.word, suggestedWord: replacement }]);
    }
  };

  // Manually fix all currently detected mistakes
  const handleFixAll = () => {
    if (mistakes.length === 0) return;

    let updated = inputText;
    const appliedEntries: { wrongWord: string; suggestedWord: string }[] = [];

    // Sort backwards by index to preserve replacement offsets
    const sorted = [...mistakes].sort((a, b) => b.index - a.index);
    for (const item of sorted) {
      const before = updated.slice(0, item.index);
      const after = updated.slice(item.index + item.length);
      updated = before + item.suggestion + after;
      appliedEntries.push({ wrongWord: item.word, suggestedWord: item.suggestion });
    }

    setInputText(updated);
    setSelectedMistake(null);
    setMistakes([]);

    if (onCorrectionApplied) {
      onCorrectionApplied(appliedEntries);
    }
  };

  // Dismiss a suggestion without changing text
  const handleDismiss = (mistakeId: string) => {
    setDismissedIds((prev) => new Set(prev).add(mistakeId));
    setMistakes((prev) => prev.filter((m) => m.id !== mistakeId));
    if (selectedMistake?.id === mistakeId) {
      setSelectedMistake(null);
    }
  };

  const handleSelectPreset = (text: string) => {
    setDismissedIds(new Set());
    setSelectedMistake(null);
    activeSignaturesRef.current.clear();
    setInputText(text);
  };

  const handleReset = () => {
    setDismissedIds(new Set());
    setSelectedMistake(null);
    setMistakes([]);
    activeSignaturesRef.current.clear();
    setInputText('');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
      {/* Header with Title and Mode Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <span>In-App Typing Sandbox</span>
            <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full">
              Hunspell Offline Engine Active
            </span>
            {autoApply ? (
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-600" />
                Auto Apply ON (≥{(autoApplyThreshold * 100).toFixed(0)}%)
              </span>
            ) : (
              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                Auto Apply OFF
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real local English spell checker with 50,000+ words vocabulary, proper name protection, and context-aware ranking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
          {mistakes.length > 0 && (
            <Button
              size="sm"
              variant="primary"
              onClick={handleFixAll}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Fix All ({mistakes.length})
            </Button>
          )}
        </div>
      </div>

      {/* Preset Test Case Buttons */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          Verification Test Scenarios:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_TEST_CASES.map((tc, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectPreset(tc.text)}
              className="text-xs px-2.5 py-1 rounded bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-200 transition-colors cursor-pointer"
            >
              {tc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Text Area with Caret Focus */}
      <div className="relative">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Start typing English text here to see real-time local spelling suggestions..."
          rows={4}
          className="w-full p-3.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-sans leading-relaxed resize-none transition-colors"
        />

        {/* Auto Apply Banner Notification */}
        {lastAutoAppliedCount > 0 && (
          <div className="absolute top-2 right-2 bg-emerald-600 text-white text-xs px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1.5 animate-fadeIn">
            <Zap className="w-3.5 h-3.5" />
            <span>Auto-corrected {lastAutoAppliedCount} mistake{lastAutoAppliedCount > 1 ? 's' : ''}!</span>
          </div>
        )}
      </div>

      {/* Detection Results Bar */}
      <div className="space-y-2">
        {mistakes.length === 0 ? (
          <div className="flex items-center gap-2 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>All clear:</strong> No spelling mistakes detected. English vocabulary, proper names, punctuation, emails, and custom dictionary words are recognized.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Detected mistakes ({mistakes.length}): Click any badge to view suggestions & apply
              </span>
              <span className="text-[11px] text-slate-400">
                Confidence threshold: {(autoApplyThreshold * 100).toFixed(0)}%
              </span>
            </div>

            {/* List of Detected Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {mistakes.map((m) => {
                const isSelected = selectedMistake?.id === m.id;
                return (
                  <div
                    key={m.id}
                    className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-md text-xs border transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-red-50 hover:bg-red-100/70 border-red-200 text-red-900 cursor-pointer'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedMistake(isSelected ? null : m)}
                      className="inline-flex items-center gap-1.5 text-left cursor-pointer"
                    >
                      <span className="font-mono line-through text-red-600">{m.word}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-semibold text-emerald-700">{m.suggestion}</span>
                      <span className="text-[10px] text-slate-400 font-mono bg-white/70 px-1 py-0.2 rounded">
                        {(m.confidence * 100).toFixed(0)}%
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplySuggestion(m)}
                      title={`Apply "${m.suggestion}"`}
                      className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition-colors ml-1 cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDismiss(m.id)}
                      title="Dismiss suggestion"
                      className="p-1 hover:bg-red-200 rounded text-slate-400 hover:text-red-700 transition-colors cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Active Suggestion Inspector Card */}
            {selectedMistake && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-800 flex items-center gap-2">
                    <span>Suggestions for</span>
                    <span className="font-mono font-bold text-red-600 bg-red-100/80 px-1.5 py-0.5 rounded">
                      {selectedMistake.word}
                    </span>
                    <span className="text-slate-400">
                      (internal confidence: {(selectedMistake.confidence * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMistake(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-slate-500">Pick replacement:</span>
                  {selectedMistake.suggestions.map((sug, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={i === 0 ? 'primary' : 'secondary'}
                      onClick={() => handleApplySuggestion(selectedMistake, sug)}
                    >
                      {i + 1}. {sug}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(selectedMistake.id)}
                  >
                    Ignore this word
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
