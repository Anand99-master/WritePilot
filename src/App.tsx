import { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { MyTextPage } from './components/mytext/MyTextPage';
import { DictionaryPage } from './components/dictionary/DictionaryPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { NavigationTab, Settings, SavedText, DictionaryWord, Correction, Statistics } from './types';
import {
  getSettings,
  saveSettings,
  getSavedTexts,
  saveText,
  deleteSavedText,
  getDictionaryWords,
  addDictionaryWord,
  deleteDictionaryWord,
  getCorrections,
  markCorrectionApplied,
  addRecentCorrections,
  getStatistics,
  updateStatistics,
} from './services/storage';
import { startTextMonitoring, stopTextMonitoring } from './services/windowsIntegration';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [settings, setSettings] = useState<Settings>(getSettings);
  const [savedTexts, setSavedTexts] = useState<SavedText[]>(getSavedTexts);
  const [dictionaryWords, setDictionaryWords] = useState<DictionaryWord[]>(getDictionaryWords);
  const [corrections, setCorrections] = useState<Correction[]>(getCorrections);
  const [statistics, setStatistics] = useState<Statistics>(getStatistics);

  // Sync assistant state with Windows integration placeholder
  useEffect(() => {
    if (settings.assistantEnabled) {
      startTextMonitoring();
    } else {
      stopTextMonitoring();
    }
  }, [settings.assistantEnabled]);

  // Keep saved text count in stats synchronized
  useEffect(() => {
    setStatistics((prev) => {
      if (prev.savedTextsCount !== savedTexts.length) {
        const next = updateStatistics({ savedTextsCount: savedTexts.length });
        return next;
      }
      return prev;
    });
  }, [savedTexts.length]);

  const handleUpdateSettings = (updates: Partial<Settings>) => {
    const updated = saveSettings(updates);
    setSettings(updated);
  };

  const handleSaveText = (data: { title: string; content: string }, id?: string) => {
    const updatedList = saveText(data, id);
    setSavedTexts(updatedList);
  };

  const handleDeleteText = (id: string) => {
    const updatedList = deleteSavedText(id);
    setSavedTexts(updatedList);
  };

  const handleAddWord = (word: string) => {
    const updated = addDictionaryWord(word);
    setDictionaryWords(updated);
  };

  const handleDeleteWord = (id: string) => {
    const updated = deleteDictionaryWord(id);
    setDictionaryWords(updated);
  };

  const handleApplyCorrection = (id: string) => {
    const updated = markCorrectionApplied(id);
    setCorrections(updated);
    // Increment corrections applied
    const nextStats = updateStatistics({ correctionsApplied: 1 });
    setStatistics(nextStats);
  };

  const handleIncrementCorrectionsApplied = useCallback((count: number = 1) => {
    const nextStats = updateStatistics({ correctionsApplied: count });
    setStatistics(nextStats);
  }, []);

  const handleMistakeFound = useCallback((count: number) => {
    if (count <= 0) return;
    const nextStats = updateStatistics({ mistakesDetected: count });
    setStatistics(nextStats);
  }, []);

  const handleSandboxCorrectionApplied = useCallback((appliedMistakes: { wrongWord: string; suggestedWord: string }[]) => {
    if (!appliedMistakes || appliedMistakes.length === 0) return;
    const updatedList = addRecentCorrections(appliedMistakes);
    setCorrections(updatedList);
    const nextStats = updateStatistics({ correctionsApplied: appliedMistakes.length });
    setStatistics(nextStats);
  }, []);

  // Header content depending on current view
  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: 'Writing Assistant',
          subtitle: 'Check and improve your writing as you type.',
        };
      case 'my-text':
        return {
          title: 'My Text',
          subtitle: 'Saved snippets and quick-access texts for everyday typing.',
        };
      case 'dictionary':
        return {
          title: 'My Dictionary',
          subtitle: 'Custom personal terms and names ignored by the spell checker.',
        };
      case 'settings':
        return {
          title: 'Settings',
          subtitle: 'Configure assistant behavior, shortcuts, and application preferences.',
        };
    }
  };

  const headerInfo = getHeaderInfo();
  const dictionaryWordList = useMemo(() => dictionaryWords.map((d) => d.word), [dictionaryWords]);

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 ${settings.compactMode ? 'text-[13px]' : ''}`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        assistantActive={settings.assistantEnabled}
        savedTextsCount={savedTexts.length}
        dictionaryCount={dictionaryWords.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
        />

        <main className="flex-1 overflow-y-auto flex flex-col">
          {activeTab === 'dashboard' && (
            <DashboardPage
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              statistics={statistics}
              corrections={corrections}
              onApplyCorrection={handleApplyCorrection}
              customDictionary={dictionaryWordList}
              onIncrementCorrectionsApplied={handleIncrementCorrectionsApplied}
              onMistakeFound={handleMistakeFound}
              onSandboxCorrectionApplied={handleSandboxCorrectionApplied}
            />
          )}

          {activeTab === 'my-text' && (
            <MyTextPage
              savedTexts={savedTexts}
              onSaveText={handleSaveText}
              onDeleteText={handleDeleteText}
            />
          )}

          {activeTab === 'dictionary' && (
            <DictionaryPage
              dictionaryWords={dictionaryWords}
              onAddWord={handleAddWord}
              onDeleteWord={handleDeleteWord}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
            />
          )}
        </main>
      </div>
    </div>
  );
}
