import React, { useState, useEffect } from 'react';
import {
  Monitor,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Search,
  Lock,
  ArrowRight,
  Info,
  RefreshCw,
  FileCode,
  Check,
  RotateCcw,
  Zap,
  Play,
} from 'lucide-react';
import { Button } from '../common/Button';
import {
  getFocusedText,
  getActiveControlInfo,
  replaceTextRange,
  setSimulatedState,
  isTauriEnvironment,
} from '../../services/windowsIntegration';
import { findMistakesInText } from '../../services/spellChecker';
import {
  TextControlInfo,
  FocusedTextPayload,
  DetectedMistake,
  ControlSupportState,
  ReplacementResult,
} from '../../types';

export interface WindowsIntegrationPanelProps {
  customDictionary: string[];
  assistantEnabled: boolean;
  autoApply?: boolean;
  autoApplyThreshold?: number;
  onCorrectionApplied?: (appliedMistakes: { wrongWord: string; suggestedWord: string }[]) => void;
}

// Preset application scenarios for Phase 3B testing
const PHASE3B_TEST_SCENARIOS = [
  {
    id: 'test1_notepad',
    label: 'Test 1: Notepad (Manual Apply)',
    appName: 'Windows Notepad',
    windowTitle: 'Document.txt - Notepad',
    controlType: 'Edit',
    supportState: 'SUPPORTED' as ControlSupportState,
    hasTextPattern: true,
    hasValuePattern: true,
    isPassword: false,
    text: 'I will recieve the document tommorow.',
    desc: 'Verify that applying "recieve -> receive" changes ONLY that word; "tommorow" stays untouched.',
  },
  {
    id: 'test2_auto_apply',
    label: 'Test 2: Auto Apply (High-confidence)',
    appName: 'Windows Notepad',
    windowTitle: 'Untitled - Notepad',
    controlType: 'Edit',
    supportState: 'SUPPORTED' as ControlSupportState,
    hasTextPattern: true,
    hasValuePattern: true,
    isPassword: false,
    text: 'I will recieve it tommorow.',
    desc: 'Applies high-confidence corrections sequentially with re-reading after each fix.',
  },
  {
    id: 'test3_stale_target',
    label: 'Test 3: Stale Target Protection',
    appName: 'Microsoft Word',
    windowTitle: 'Draft.docx - Word',
    controlType: 'Document',
    supportState: 'SUPPORTED' as ControlSupportState,
    hasTextPattern: true,
    hasValuePattern: true,
    isPassword: false,
    text: 'I will send the document tommorow.',
    desc: 'Tests user editing between detection and correction. Aborts with STALE_TARGET.',
  },
  {
    id: 'test4_password',
    label: 'Test 4: Password Protection',
    appName: 'Windows Security',
    windowTitle: 'Sign In - Windows Security',
    controlType: 'PasswordEdit',
    supportState: 'NOT_SUPPORTED' as ControlSupportState,
    hasTextPattern: false,
    hasValuePattern: false,
    isPassword: true,
    text: 'secret_user_pwd_123',
    desc: 'Privacy boundary: IsPassword detected. Text reading and replacement are strictly blocked.',
  },
  {
    id: 'test5_proper_name',
    label: 'Test 5: Proper Name Handling',
    appName: 'Google Chrome',
    windowTitle: 'LinkedIn - Google Chrome',
    controlType: 'Edit',
    supportState: 'SUPPORTED' as ControlSupportState,
    hasTextPattern: true,
    hasValuePattern: true,
    isPassword: false,
    text: 'Anand works at Bayer.',
    desc: 'Names & recognized organizations are never automatically replaced.',
  },
  {
    id: 'test6_multiple',
    label: 'Test 6: Multiple Mistakes Sequential',
    appName: 'Microsoft Edge',
    windowTitle: 'Mail - Microsoft Edge',
    controlType: 'Document',
    supportState: 'SUPPORTED' as ControlSupportState,
    hasTextPattern: true,
    hasValuePattern: true,
    isPassword: false,
    text: 'I will recieve it tommorow becuase it is necessary.',
    desc: 'Corrects one mistake at a time, re-reading and recalculating positions before next.',
  },
];

export const WindowsIntegrationPanel: React.FC<WindowsIntegrationPanelProps> = ({
  customDictionary,
  assistantEnabled,
  autoApply = false,
  autoApplyThreshold = 0.95,
  onCorrectionApplied,
}) => {
  const isTauri = isTauriEnvironment();
  const [activeControl, setActiveControl] = useState<TextControlInfo | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('test1_notepad');
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isReplacing, setIsReplacing] = useState<boolean>(false);
  const [detectedResult, setDetectedResult] = useState<{
    payload: FocusedTextPayload;
    mistakes: DetectedMistake[];
    detectedAt: string;
  } | null>(null);

  const [lastReplacementResult, setLastReplacementResult] = useState<ReplacementResult | null>(null);
  const [confirmManualTarget, setConfirmManualTarget] = useState<DetectedMistake | null>(null);

  // Load initial active control status
  useEffect(() => {
    getActiveControlInfo().then((info) => {
      setActiveControl(info);
    });
  }, []);

  // When scenario changes in web simulation mode, configure simulated state
  const handleSelectScenario = (scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setLastReplacementResult(null);
    setConfirmManualTarget(null);

    const scenario = PHASE3B_TEST_SCENARIOS.find((s) => s.id === scenarioId);
    if (scenario && !isTauri) {
      setSimulatedState(scenario.text, {
        appName: scenario.appName,
        windowTitle: scenario.windowTitle,
        controlType: scenario.controlType,
        supportState: scenario.supportState,
        hasTextPattern: scenario.hasTextPattern,
        hasValuePattern: scenario.hasValuePattern,
        isPassword: scenario.isPassword,
        isReadOnly: false,
        supportsReplacement: !scenario.isPassword && scenario.supportState === 'SUPPORTED',
        details: scenario.desc,
      });
    }
  };

  // 1. Detect Active Text Field (Detection ONLY, zero text modification)
  const handleDetect = async () => {
    setIsDetecting(true);
    setLastReplacementResult(null);
    setConfirmManualTarget(null);

    try {
      const payload = await getFocusedText();
      setActiveControl(payload.controlInfo);

      // Run detected text through existing spelling engine if not password protected
      const mistakes = payload.controlInfo.isPassword
        ? []
        : findMistakesInText(payload.text, customDictionary);

      setDetectedResult({
        payload,
        mistakes,
        detectedAt: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error('[WritePilot] Detection failed:', err);
    } finally {
      setIsDetecting(false);
    }
  };

  // 2. Safe Manual Replacement of a single verified mistake
  const handleApplySingleMistake = async (mistake: DetectedMistake, chosenReplacement?: string) => {
    if (!detectedResult || isReplacing) return;

    const replacement = chosenReplacement || mistake.suggestion;
    setIsReplacing(true);

    try {
      // Execute safe native replacement with exact range and expected original
      const result = await replaceTextRange({
        start: mistake.index,
        length: mistake.length,
        replacement,
        expectedOriginal: mistake.word,
      });

      setLastReplacementResult(result);
      setConfirmManualTarget(null);

      if (result.success && result.status === 'APPLIED') {
        // Increment Corrections Applied ONLY after verified APPLIED status
        onCorrectionApplied?.([{ wrongWord: mistake.word, suggestedWord: replacement }]);

        // Revalidate: Re-read the control text from the external application
        const refreshedPayload = await getFocusedText();
        const refreshedMistakes = findMistakesInText(refreshedPayload.text, customDictionary);

        setActiveControl(refreshedPayload.controlInfo);
        setDetectedResult({
          payload: refreshedPayload,
          mistakes: refreshedMistakes,
          detectedAt: new Date().toLocaleTimeString(),
        });
      }
    } catch (err) {
      console.error('[WritePilot] Replacement error:', err);
      setLastReplacementResult({
        success: false,
        status: 'REPLACEMENT_FAILED',
        error: String(err),
      });
    } finally {
      setIsReplacing(false);
    }
  };

  // 3. Stale Target Simulation Trigger (for Test 3)
  const handleSimulateStaleModification = () => {
    if (!detectedResult) return;
    // Modify text externally between detection and replacement
    const modified = detectedResult.payload.text.replace('tommorow', 'tommorow please');
    setSimulatedState(modified);
    alert('Simulated external change: user typed " please" right after the mistake. Now click "Apply" to verify STALE_TARGET abort.');
  };

  // 4. Safe Auto Apply Execution for eligible high-confidence mistakes
  const handleRunAutoApplyOnDetected = async () => {
    if (!detectedResult || detectedResult.mistakes.length === 0 || isReplacing) return;

    // Filter only eligible high-confidence mistakes (>= autoApplyThreshold, e.g. 0.95)
    const eligible = detectedResult.mistakes.filter((m) => m.confidence >= autoApplyThreshold);
    if (eligible.length === 0) {
      alert('No high-confidence mistakes eligible for Auto Apply (requires confidence >= 95%).');
      return;
    }

    setIsReplacing(true);

    try {
      // Sequential processing: process one mistake, re-read, recalculate positions before next
      for (const item of eligible) {
        // Re-read current text state
        const currentPayload = await getFocusedText();
        const currentMistakes = findMistakesInText(currentPayload.text, customDictionary);

        // Find the corresponding mistake in refreshed positions
        const match = currentMistakes.find((m) => m.word.toLowerCase() === item.word.toLowerCase());
        if (!match) continue;

        const result = await replaceTextRange({
          start: match.index,
          length: match.length,
          replacement: match.suggestion,
          expectedOriginal: match.word,
        });

        if (result.success && result.status === 'APPLIED') {
          onCorrectionApplied?.([{ wrongWord: match.word, suggestedWord: match.suggestion }]);
          setLastReplacementResult(result);
        } else {
          setLastReplacementResult(result);
          break; // Abort on first non-applied status
        }
      }

      // Final revalidation
      const finalPayload = await getFocusedText();
      const finalMistakes = findMistakesInText(finalPayload.text, customDictionary);
      setActiveControl(finalPayload.controlInfo);
      setDetectedResult({
        payload: finalPayload,
        mistakes: finalMistakes,
        detectedAt: new Date().toLocaleTimeString(),
      });
    } catch (err) {
      console.error('[WritePilot] Auto apply error:', err);
    } finally {
      setIsReplacing(false);
    }
  };

  const getSupportBadge = (state: ControlSupportState) => {
    switch (state) {
      case 'SUPPORTED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            SUPPORTED
          </span>
        );
      case 'PARTIALLY_SUPPORTED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            PARTIALLY_SUPPORTED
          </span>
        );
      case 'NOT_SUPPORTED':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            NOT_SUPPORTED
          </span>
        );
      case 'ERROR':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
            ERROR
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-0">
      {/* 1. Header with Connection & Status */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Windows Integration</h2>
              <span className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                Phase 3B: Safe External Replacement
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              UI Automation text detection & targeted single-range replacement. Zero keylogging, zero credential capture.
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isTauri ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'
              }`}
            />
            <span className="text-xs font-semibold text-slate-700">
              {isTauri ? 'Connected (Tauri 2.x)' : 'Connected (Dev Preview Mode)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-500">Active Control:</span>
            <span className="text-xs font-semibold text-slate-800">
              {activeControl ? `${activeControl.controlType} (${activeControl.appName})` : 'Not detected'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Privacy & Capability Status Bar */}
      <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Supported control:</span>
            <span className={`font-semibold ${activeControl?.supportState === 'SUPPORTED' ? 'text-emerald-700' : 'text-slate-700'}`}>
              {activeControl?.supportState === 'SUPPORTED' || activeControl?.supportState === 'PARTIALLY_SUPPORTED' ? 'Yes' : 'No'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Password protected:</span>
            <span className={`font-semibold ${activeControl?.isPassword ? 'text-red-600' : 'text-emerald-700'}`}>
              {activeControl?.isPassword ? 'Yes (Blocked)' : 'No'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Replacement support:</span>
            <span className={`font-semibold ${activeControl?.supportsReplacement ? 'text-emerald-700' : 'text-amber-700'}`}>
              {activeControl?.supportsReplacement ? 'Yes (ValuePattern/Range)' : 'No'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Stale Target Protection Active</span>
        </div>
      </div>

      {/* 3. Action Section */}
      <div className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Windows Integration Test (Phase 3B)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click &quot;Detect Active Text&quot; to inspect the focused control. Replacement requires explicit user confirmation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDetect}
              disabled={isDetecting || !assistantEnabled}
              icon={isDetecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            >
              {isDetecting ? 'Detecting...' : 'Detect Active Text'}
            </Button>

            {detectedResult && detectedResult.mistakes.length > 0 && activeControl?.supportsReplacement && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleRunAutoApplyOnDetected}
                disabled={isReplacing || !assistantEnabled}
                icon={isReplacing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              >
                {isReplacing ? 'Replacing...' : `Auto Apply Safe (${detectedResult.mistakes.filter(m => m.confidence >= autoApplyThreshold).length})`}
              </Button>
            )}
          </div>
        </div>

        {/* Phase 3B Scenario Selector */}
        {!isTauri && (
          <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Select Test Verification Scenario:</span>
              <span className="text-[11px] text-slate-400">
                Phase 3B test suite (Notepad, Word, Edge, Passwords, Stale Target)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {PHASE3B_TEST_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => handleSelectScenario(sc.id)}
                  className={`text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                    selectedScenarioId === sc.id
                      ? 'border-blue-600 bg-blue-50/80 text-blue-900 shadow-2xs ring-1 ring-blue-500/20'
                      : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="truncate">{sc.label}</span>
                    {sc.isPassword && <Lock className="w-3 h-3 text-red-500 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {sc.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Replacement Result Notification Banner */}
        {lastReplacementResult && (
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
              lastReplacementResult.status === 'APPLIED'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : lastReplacementResult.status === 'STALE_TARGET'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : lastReplacementResult.status === 'PASSWORD_BLOCKED'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-slate-100 border-slate-300 text-slate-800'
            }`}
          >
            {lastReplacementResult.status === 'APPLIED' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-semibold">
                Replacement Status: <span className="font-mono">{lastReplacementResult.status}</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {lastReplacementResult.status === 'APPLIED' && (
                  <span>
                    Successfully replaced &quot;<span className="line-through">{lastReplacementResult.original}</span>&quot; with &quot;<span className="font-bold">{lastReplacementResult.replacement}</span>&quot; at the exact detected range. Revalidation confirmed.
                  </span>
                )}
                {lastReplacementResult.status === 'STALE_TARGET' && (
                  <span>
                    Target text changed between detection and replacement. Operation aborted cleanly to prevent unintended overwriting.
                  </span>
                )}
                {lastReplacementResult.status === 'PASSWORD_BLOCKED' && (
                  <span>
                    Password protection triggered. WritePilot refuses to read or replace text in secure credential controls.
                  </span>
                )}
                {lastReplacementResult.status === 'UNSUPPORTED' && (
                  <span>
                    Target control is read-only or does not support range replacement.
                  </span>
                )}
                {lastReplacementResult.error && (
                  <span className="block text-slate-500 mt-0.5">{lastReplacementResult.error}</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Detection Result Card */}
        {detectedResult ? (
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">Target Control:</span>
                <span className="font-mono bg-white px-2 py-0.5 border rounded text-slate-700">
                  {detectedResult.payload.controlInfo.appName}
                </span>
                <span className="text-slate-400">({detectedResult.payload.controlInfo.windowTitle})</span>
              </div>
              <div className="flex items-center gap-2">
                {getSupportBadge(detectedResult.payload.controlInfo.supportState)}
                <span className="text-slate-400 text-[11px]">at {detectedResult.detectedAt}</span>
              </div>
            </div>

            {/* Read Text Sample */}
            {detectedResult.payload.controlInfo.isPassword ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-red-600" />
                  Password Protection Triggered
                </div>
                <p>
                  WritePilot detected <code>UIA_IsPasswordPropertyId = true</code> on this element. To protect your privacy and credentials, no text was read and no replacement is permitted.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Captured External Text ({detectedResult.payload.charCount} characters):</span>
                    {selectedScenarioId === 'test3_stale_target' && (
                      <button
                        type="button"
                        onClick={handleSimulateStaleModification}
                        className="text-[11px] text-amber-700 hover:text-amber-800 font-medium underline cursor-pointer"
                      >
                        [Simulate External Modification for Test 3]
                      </button>
                    )}
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-800 break-words selectable-text">
                    {detectedResult.payload.text || <span className="text-slate-400 italic">No text in control</span>}
                  </div>
                </div>

                {/* Detected Mistakes & Manual Replacement Actions */}
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>Detected Mistakes:</span>
                      {detectedResult.mistakes.length === 0 ? (
                        <span className="text-emerald-600 font-normal flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> No spelling mistakes found
                        </span>
                      ) : (
                        <span className="text-amber-700 font-normal">
                          {detectedResult.mistakes.length} mistake{detectedResult.mistakes.length > 1 ? 's' : ''} detected
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Exact character range replacement
                    </span>
                  </div>

                  {detectedResult.mistakes.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {detectedResult.mistakes.map((m) => (
                          <div
                            key={m.id}
                            className="inline-flex items-center gap-2 bg-red-50 hover:bg-red-100/70 border border-red-200 text-red-900 pl-2.5 pr-2 py-1 rounded-md text-xs transition-colors"
                          >
                            <span className="font-mono line-through text-red-600">{m.word}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-semibold text-emerald-700">{m.suggestion}</span>
                            <span className="text-[10px] text-slate-400 font-mono bg-white px-1 py-0.5 rounded border border-slate-200">
                              {(m.confidence * 100).toFixed(0)}%
                            </span>

                            {/* Test Manual Replacement Button */}
                            <button
                              type="button"
                              onClick={() => setConfirmManualTarget(m)}
                              disabled={isReplacing || !activeControl?.supportsReplacement}
                              className="ml-1 p-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded text-slate-600 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                              title="Test Manual Replacement with confirmation"
                            >
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Apply</span>
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Explicit User Confirmation Modal/Box for Manual Replacement */}
                      {confirmManualTarget && (
                        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs space-y-2 mt-2">
                          <div className="font-semibold text-blue-950 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-blue-600" />
                            Confirm Safe External Text Replacement:
                          </div>
                          <p className="text-slate-700 leading-relaxed">
                            WritePilot will replace ONLY the word &quot;<span className="font-mono font-bold text-red-700">{confirmManualTarget.word}</span>&quot; at character offset {confirmManualTarget.index} with &quot;<span className="font-mono font-bold text-emerald-700">{confirmManualTarget.suggestion}</span>&quot; in <span className="font-semibold">{activeControl?.appName}</span>. All surrounding text remains untouched.
                          </p>

                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => handleApplySingleMistake(confirmManualTarget)}
                              disabled={isReplacing}
                            >
                              {isReplacing ? 'Applying...' : `Confirm: Replace "${confirmManualTarget.word}"`}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmManualTarget(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3 p-2.5 bg-slate-100/80 border border-slate-200 rounded-lg text-xs text-slate-700 flex items-start gap-2">
                    <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Phase 3B Verification:</span> External text replacement replaces strictly the target word. Auto Apply is guarded by a 95% confidence threshold and sequential re-reading to guarantee zero stale offset corruption.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
            <FileCode className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-medium text-slate-700">Ready to test safe external text replacement</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Click &quot;Detect Active Text&quot; to inspect the focused control, view detected spelling mistakes, and test exact-range manual or automatic replacement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
