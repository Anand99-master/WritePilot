import React from 'react';
import { Minus, Square, X } from 'lucide-react';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, action }) => {
  return (
    <header className="w-full bg-white border-b border-slate-200/80 sticky top-0 z-10">
      {/* Windows Titlebar Simulation Strip */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-100 bg-slate-50/50 text-xs text-slate-500 select-none">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-600/80" />
          <span className="font-medium text-slate-600 text-[11px] tracking-tight">WritePilot Desktop · Windows</span>
        </div>
        {/* Window controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
            title="Maximize"
            aria-label="Maximize"
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            className="p-1 hover:bg-red-500 hover:text-white rounded text-slate-500 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Header Content */}
      <div className="flex items-center justify-between px-8 py-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex items-center gap-3">{action}</div>}
      </div>
    </header>
  );
};
