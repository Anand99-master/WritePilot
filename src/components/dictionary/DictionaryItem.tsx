import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../common/Button';
import { DictionaryWord } from '../../types';

export interface DictionaryItemProps {
  item: DictionaryWord;
  onDelete: (id: string) => void;
}

export const DictionaryItem: React.FC<DictionaryItemProps> = ({ item, onDelete }) => {
  return (
    <div className="flex items-center justify-between p-3.5 bg-white rounded-lg border border-slate-200/80 hover:border-slate-300 transition-colors group">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold text-slate-800">
          {item.word}
        </span>
        <span className="text-xs text-slate-400">
          Added {item.addedAt}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(item.id)}
        icon={<Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
        className="hover:bg-red-50 hover:text-red-600"
        title={`Remove "${item.word}" from dictionary`}
      >
        Remove
      </Button>
    </div>
  );
};
