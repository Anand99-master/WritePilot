import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '../common/Button';
import { Correction } from '../../types';

export interface CorrectionItemProps {
  correction: Correction;
  onApply: (id: string) => void;
}

export const CorrectionItem: React.FC<CorrectionItemProps> = ({ correction, onApply }) => {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
      <td className="py-3 px-4 text-sm">
        <span className="font-mono text-red-600 bg-red-50/80 px-2 py-0.5 rounded text-xs line-through decoration-red-400">
          {correction.wrongWord}
        </span>
      </td>
      <td className="py-3 px-2 text-slate-400">
        <ArrowRight className="w-3.5 h-3.5" />
      </td>
      <td className="py-3 px-4 text-sm font-medium text-slate-800">
        <span className="font-mono text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded text-xs">
          {correction.suggestedWord}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        {correction.isApplied ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 px-2 py-1">
            <Check className="w-3.5 h-3.5" />
            Applied
          </span>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onApply(correction.id)}
            className="hover:border-blue-400 hover:text-blue-600"
          >
            Apply
          </Button>
        )}
      </td>
    </tr>
  );
};
