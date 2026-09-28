import React from 'react';
import { LayoutDashboard, FileText, BookA, Settings as SettingsIcon, Feather } from 'lucide-react';
import { NavigationTab } from '../../types';

export interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  assistantActive: boolean;
  savedTextsCount: number;
  dictionaryCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  assistantActive,
  savedTextsCount,
  dictionaryCount,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavigationTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'my-text' as NavigationTab,
      label: 'My Text',
      icon: FileText,
      badge: savedTextsCount > 0 ? savedTextsCount : undefined,
    },
    {
      id: 'dictionary' as NavigationTab,
      label: 'Dictionary',
      icon: BookA,
      badge: dictionaryCount > 0 ? dictionaryCount : undefined,
    },
    {
      id: 'settings' as NavigationTab,
      label: 'Settings',
      icon: SettingsIcon,
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen select-none">
      {/* Brand Header */}
      <div>
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Feather className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-slate-900 leading-none">
                WritePilot
              </div>
              <div className="text-[11px] text-slate-500 font-medium mt-1">
                Write better. Type faster.
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs tabular-nums px-2 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-blue-100/80 text-blue-700 font-medium'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Assistant Status Card */}
      <div className="p-4 border-t border-slate-100">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {assistantActive && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  assistantActive ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
            </span>
            <div className="text-xs">
              <span className="text-slate-500">Writing Assistant: </span>
              <span
                className={`font-semibold ${
                  assistantActive ? 'text-emerald-700' : 'text-slate-600'
                }`}
              >
                {assistantActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 pl-5">
            {assistantActive ? 'Monitoring typing locally' : 'Protection paused'}
          </div>
        </div>
      </div>
    </aside>
  );
};
