'use client';

import type React from 'react';
import { X } from 'lucide-react';
import type { DocItem } from '@/components/dashboard/types';

interface TabsBarProps {
  openTabs: DocItem[];
  selectedDocId: string | null;
  onSelectTab: (tab: DocItem) => void;
  onCloseTab: (tabId: string, e: React.MouseEvent) => void;
  getIcon: (doc: DocItem) => React.ReactNode;
}

const TabsBar = ({ openTabs, selectedDocId, onSelectTab, onCloseTab, getIcon }: TabsBarProps) => {
  if (openTabs.length === 0) {
    return (
      <div className="flex items-center justify-between border-b border-surface-600/50 bg-surface-800 px-4 py-2 text-sm text-surface-400">
        <span>Sin pestanas abiertas</span>
      </div>
    );
  }

  return (
    <div className="flex items-center border-b border-surface-600/50 bg-surface-800">
      <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
        {openTabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => onSelectTab(tab)}
            className={`
              group flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer min-w-[120px] max-w-[200px] border-r border-surface-600/30 select-none
              ${selectedDocId === tab.id ? 'bg-surface-900 text-mandy-400 border-t-2 border-t-mandy-500' : 'text-surface-500 hover:bg-surface-700/50'}
            `}
          >
            {getIcon(tab)}
            <span className="truncate flex-1">{tab.name}</span>
            <button
              onClick={(e) => onCloseTab(tab.id, e)}
              className={`p-0.5 rounded-full hover:bg-surface-700 ${selectedDocId === tab.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TabsBar;
