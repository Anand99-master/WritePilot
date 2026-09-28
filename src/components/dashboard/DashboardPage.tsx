import React from 'react';
import { ShieldCheck, Zap, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { StatCard } from './StatCard';
import { CorrectionItem } from './CorrectionItem';
import { TypingSandbox } from './TypingSandbox';
import { WindowsIntegrationPanel } from './WindowsIntegrationPanel';
import { Toggle } from '../common/Toggle';
import { PageContainer } from '../common/PageContainer';
import { Correction, Settings, Statistics } from '../../types';

export interface DashboardPageProps {
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  statistics: Statistics;
  corrections: Correction[];
  onApplyCorrection: (id: string) => void;
  customDictionary: string[];
  onIncrementCorrectionsApplied: (count?: number) => void;
  onMistakeFound?: (count: number) => void;
  onSandboxCorrectionApplied?: (appliedMistakes: { wrongWord: string; suggestedWord: string }[]) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  settings,
  onUpdateSettings,
  statistics,
  corrections,
  onApplyCorrection,
  customDictionary,
  onMistakeFound,
  onSandboxCorrectionApplied,
}) => {
  return (
    <PageContainer>
      {/* Primary Control Cards (Grid of Assistant Status & Auto Apply) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assistant Status Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  settings.assistantEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-slate-900">Writing Assistant</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      settings.assistantEnabled ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  <span
                    className={`text-xs font-semibold ${
                      settings.assistantEnabled ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {settings.assistantEnabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <Toggle
                checked={settings.assistantEnabled}
                onChange={(checked) => onUpdateSettings({ assistantEnabled: checked })}
                id="assistant-status-toggle"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4 pt-3 border-t border-slate-100">
            {settings.assistantEnabled
              ? 'Real-time spelling detection is currently monitoring typed words.'
              : 'Detection is currently paused. Toggle on to resume spell checking.'}
          </p>
        </div>

        {/* Auto Apply Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  settings.autoApplyCorrections ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-slate-900">Auto Apply Corrections</div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatically replace detected spelling mistakes.
                </p>
              </div>
            </div>
            <div>
              <Toggle
                checked={settings.autoApplyCorrections}
                onChange={(checked) => onUpdateSettings({ autoApplyCorrections: checked })}
                id="auto-apply-toggle"
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-4 pt-3 border-t border-slate-100">
            <span>Current state:</span>
            <span
              className={`font-semibold ${
                settings.autoApplyCorrections ? 'text-blue-600' : 'text-slate-600'
              }`}
            >
              {settings.autoApplyCorrections ? 'ON (High confidence ≥95%)' : 'OFF (Default)'}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Mistakes Detected"
          value={statistics.mistakesDetected}
          icon={<AlertCircle className="w-4 h-4" />}
          hint="Total spelling errors spotted"
        />
        <StatCard
          label="Corrections Applied"
          value={statistics.correctionsApplied}
          icon={<CheckCircle className="w-4 h-4" />}
          hint="Accepted or auto-replaced"
        />
        <StatCard
          label="Saved Texts"
          value={statistics.savedTextsCount}
          icon={<FileText className="w-4 h-4" />}
          hint="Reusable snippets in library"
        />
      </div>

      {/* Windows UI Automation Native Integration Section (Phase 3B: Safe External Replacement) */}
      <WindowsIntegrationPanel
        customDictionary={customDictionary}
        assistantEnabled={settings.assistantEnabled}
        autoApply={settings.autoApplyCorrections && settings.assistantEnabled}
        autoApplyThreshold={0.95}
        onCorrectionApplied={onSandboxCorrectionApplied}
      />

      {/* In-App Interactive Typing Sandbox (Phase 2A Engine Playground) */}
      <TypingSandbox
        customDictionary={customDictionary}
        autoApply={settings.autoApplyCorrections && settings.assistantEnabled}
        autoApplyThreshold={0.95}
        onMistakeFound={onMistakeFound}
        onCorrectionApplied={onSandboxCorrectionApplied}
      />

      {/* Recent Corrections Section */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Recent Corrections</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review recent corrections detected by WritePilot.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Demo entries</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4">Wrong Word</th>
                <th className="py-2.5 px-2 w-8"></th>
                <th className="py-2.5 px-4">Suggested Word</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((corr) => (
                <CorrectionItem
                  key={corr.id}
                  correction={corr}
                  onApply={onApplyCorrection}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
};
