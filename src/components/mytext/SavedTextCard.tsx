import React, { useState } from 'react';
import { Copy, Check, Edit2, Trash2, Calendar } from 'lucide-react';
import { Button } from '../common/Button';
import { SavedText } from '../../types';

export interface SavedTextCardProps {
  item: SavedText;
  onEdit: (item: SavedText) => void;
  onDelete: (id: string) => void;
}

export const SavedTextCard: React.FC<SavedTextCardProps> = ({ item, onEdit, onDelete }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = item.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
            {item.title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
            <Calendar className="w-3.5 h-3.5" />
            <span>{item.updatedAt || item.createdAt}</span>
          </div>
        </div>

        <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed selectable-text">
          {item.content}
        </p>
      </div>

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleCopy}
          icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          className={copied ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : ''}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(item)}
            icon={<Edit2 className="w-3.5 h-3.5 text-slate-500" />}
            title="Edit text"
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(item.id)}
            icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
            className="hover:bg-red-50 hover:text-red-600"
            title="Delete text"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};
