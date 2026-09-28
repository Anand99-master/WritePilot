import React from 'react';

export interface StatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  hint?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, hint }) => {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs transition-all hover:border-slate-300">
      <div className="flex items-center justify-between text-slate-500 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
        {value}
      </div>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
};
