import React, { useState } from 'react';
import { Plus, BookA, Search } from 'lucide-react';
import { SearchBar } from '../common/SearchBar';
import { Button } from '../common/Button';
import { PageContainer } from '../common/PageContainer';
import { DictionaryItem } from './DictionaryItem';
import { DictionaryWord } from '../../types';

export interface DictionaryPageProps {
  dictionaryWords: DictionaryWord[];
  onAddWord: (word: string) => void;
  onDeleteWord: (id: string) => void;
}

export const DictionaryPage: React.FC<DictionaryPageProps> = ({
  dictionaryWords,
  onAddWord,
  onDeleteWord,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [newWord, setNewWord] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const filteredWords = dictionaryWords.filter((item) =>
    item.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newWord.trim();
    if (!trimmed) return;

    if (dictionaryWords.some((w) => w.word.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`"${trimmed}" is already in your dictionary.`);
      return;
    }

    onAddWord(trimmed);
    setNewWord('');
    setErrorMsg('');
  };

  return (
    <PageContainer>
      {/* Intro & Add Word Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Add Custom Word</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Words added to your personal dictionary will never be flagged as spelling errors.
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            value={newWord}
            onChange={(e) => {
              setNewWord(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            placeholder="e.g. WritePilot, BioTech, Glucobay..."
            className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs font-mono"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!newWord.trim()}
            icon={<Plus className="w-4 h-4" />}
          >
            Add Word
          </Button>
        </form>

        {errorMsg && (
          <p className="text-xs text-red-600 font-medium">{errorMsg}</p>
        )}
      </div>

      {/* Search & Word List */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="text-sm font-semibold text-slate-800">
              Dictionary Words ({dictionaryWords.length})
            </div>
            <p className="text-xs text-slate-500">
              Personal terms, brand names, and medical nomenclature.
            </p>
          </div>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search dictionary..."
            className="w-full sm:w-64"
          />
        </div>

        {filteredWords.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredWords.map((item) => (
              <DictionaryItem
                key={item.id}
                item={item}
                onDelete={onDeleteWord}
              />
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2">
              {searchQuery ? <Search className="w-5 h-5" /> : <BookA className="w-5 h-5" />}
            </div>
            <p className="text-sm font-medium text-slate-700">
              {searchQuery ? `No words match "${searchQuery}"` : 'Dictionary is empty'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? 'Try searching for another term or add it above.'
                : 'Add technical terms or names so WritePilot ignores them.'}
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
};
