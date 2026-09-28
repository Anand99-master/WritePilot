import React from 'react';
import { Settings as SettingsType } from '../../types';
import { Toggle } from '../common/Toggle';
import { PageContainer } from '../common/PageContainer';
import { Command, Shield, Sliders, Palette, Keyboard, Check } from 'lucide-react';

export interface SettingsPageProps {
  settings: SettingsType;
  onUpdateSettings: (updates: Partial<SettingsType>) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
}) => {
  return (
    <PageContainer maxWidth="max-w-4xl">
      {/* 1. General Settings */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Sliders className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">General</h2>
        </div>
        <div className="p-5 divide-y divide-slate-100">
          <Toggle
            label="Start WritePilot with Windows"
            description="Automatically launch WritePilot in the system tray when your PC boots."
            checked={settings.startWithWindows}
            onChange={(checked) => onUpdateSettings({ startWithWindows: checked })}
            id="setting-start-windows"
          />
          <Toggle
            label="Enable Writing Assistant"
            description="Active spell checking engine monitors typed text for misspellings."
            checked={settings.assistantEnabled}
            onChange={(checked) => onUpdateSettings({ assistantEnabled: checked })}
            id="setting-enable-assistant"
          />
        </div>
      </div>

      {/* 2. Corrections Settings */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">Corrections</h2>
        </div>
        <div className="p-5 divide-y divide-slate-100">
          <Toggle
            label="Auto Apply Corrections"
            description="Automatically replace detected spelling mistakes without requiring confirmation."
            checked={settings.autoApplyCorrections}
            onChange={(checked) => onUpdateSettings({ autoApplyCorrections: checked })}
            id="setting-auto-apply"
          />
          <Toggle
            label="Show spelling suggestions"
            description="Display non-intrusive floating suggestion tooltips near the active caret."
            checked={settings.showSpellingSuggestions}
            onChange={(checked) => onUpdateSettings({ showSpellingSuggestions: checked })}
            id="setting-show-suggestions"
          />
          <Toggle
            label="Correction confirmation"
            description="Play a subtle haptic or audio chime when an automatic correction is applied."
            checked={settings.correctionConfirmation}
            onChange={(checked) => onUpdateSettings({ correctionConfirmation: checked })}
            id="setting-confirmation"
          />
        </div>
      </div>

      {/* 3. Appearance Settings */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Palette className="w-4 h-4 text-violet-600" />
          <h2 className="text-sm font-semibold text-slate-900">Appearance</h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="text-sm font-medium text-slate-800 mb-1">Theme</div>
            <div className="text-xs text-slate-500 mb-3">
              Choose the visual theme for the desktop interface.
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onUpdateSettings({ theme: t })}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium capitalize transition-all cursor-pointer ${
                    settings.theme === t
                      ? 'border-blue-600 bg-blue-50/70 text-blue-700 shadow-2xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  {settings.theme === t && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <Toggle
              label="Compact mode"
              description="Reduce padding and row heights for high-density desktop displays."
              checked={settings.compactMode}
              onChange={(checked) => onUpdateSettings({ compactMode: checked })}
              id="setting-compact-mode"
            />
          </div>
        </div>
      </div>

      {/* 4. Keyboard Shortcut */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
          <Keyboard className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-semibold text-slate-900">Keyboard Shortcut</h2>
        </div>
        <div className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-800">Check selected text</div>
              <div className="text-xs text-slate-500 mt-0.5">
                Highlight any text in any Windows app and press this shortcut to trigger instant correction.
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <kbd className="px-2.5 py-1 text-xs font-mono font-semibold bg-slate-100 border border-slate-300 rounded shadow-xs text-slate-700">
                Ctrl
              </kbd>
              <span className="text-slate-400 text-xs">+</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-semibold bg-slate-100 border border-slate-300 rounded shadow-xs text-slate-700">
                Shift
              </kbd>
              <span className="text-slate-400 text-xs">+</span>
              <kbd className="px-2.5 py-1 text-xs font-mono font-semibold bg-slate-100 border border-slate-300 rounded shadow-xs text-slate-700">
                C
              </kbd>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-blue-800 flex items-start gap-2">
            <Command className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Phase 3A Active:</span> Configured via Tauri Global Shortcut Plugin (<code className="bg-white/80 px-1 py-0.5 rounded font-mono">Ctrl + Shift + C</code>). Queries focused controls via Windows UI Automation with zero keylogging and zero text replacement.
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Architecture Notice */}
      <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 text-xs text-slate-500 space-y-1">
        <div className="font-semibold text-slate-700">Privacy-First Architecture</div>
        <div>
          WritePilot executes spelling checks locally on your Windows device. No keystrokes are recorded or transmitted to remote servers.
        </div>
      </div>
    </PageContainer>
  );
};
