'use client';

import { type ReactNode, type Ref } from 'react';
import dynamic from 'next/dynamic';
import { GitBranch, Sparkles } from 'lucide-react';
import type { ActivityView } from './ActivityBar';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';
import type { Workspace } from '@/components/dashboard/types';
import type { SearchResultFilter, SearchResultItem } from '@/lib/search/types';
import ToolsGallery from './ToolsGallery';
import SearchPanel from './SearchPanel';

const GitWorkbench = dynamic(() => import('@/components/dashboard/GitWorkbench'), { ssr: false });

interface LeftPanelProps {
  view: ActivityView;
  filesContent: ReactNode;
  currentWorkspace: Workspace | null;
  userUid?: string;

  // search inline
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: SearchResultItem[];
  searchLoading: boolean;
  searchError?: string | null;
  searchFilter: SearchResultFilter;
  onSearchFilterChange: (value: SearchResultFilter) => void;
  searchSelectedIndex: number;
  onSearchSelectIndex: (index: number) => void;
  onSearchSelect: (result: SearchResultItem) => void;
  onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  searchInputRef: Ref<HTMLInputElement>;

  // tools
  onOpenBoard: () => void;
  onOpenStRunner: () => void;
  onOpenSemanticBrowser: () => void;
  onOpenFormalizer: () => void;
  onOpenSnippetsGallery: () => void;
  onOpenAgoraAI: () => void;
  isBoardOpen?: boolean;
  isStRunnerOpen?: boolean;
  isSemanticBrowserOpen?: boolean;
  isFormalizerOpen?: boolean;
  isAgoraAIOpen?: boolean;
}

export default function LeftPanel(props: LeftPanelProps) {
  const { view, filesContent, currentWorkspace, userUid } = props;

  if (view === 'files') {
    return <>{filesContent}</>;
  }

  if (view === 'search') {
    return (
      <SearchPanel
        query={props.searchQuery}
        onQueryChange={props.onSearchQueryChange}
        results={props.searchResults}
        loading={props.searchLoading}
        errorMessage={props.searchError}
        activeFilter={props.searchFilter}
        onFilterChange={props.onSearchFilterChange}
        selectedIndex={props.searchSelectedIndex}
        onSelectIndex={props.onSearchSelectIndex}
        onSelect={props.onSearchSelect}
        onKeyDown={props.onSearchKeyDown}
        inputRef={props.searchInputRef}
      />
    );
  }

  if (view === 'git') {
    if (!currentWorkspace) {
      return (
        <PanelShell title="Control de versiones">
          <EmptyHint icon={<GitBranch className="h-4 w-4" />} text="Selecciona un workspace para ver Git." />
        </PanelShell>
      );
    }
    const wsId = currentWorkspace.id === PERSONAL_WORKSPACE_ID && userUid
      ? `personal:${userUid}`
      : currentWorkspace.id;
    return (
      <div className="flex h-full w-full flex-col bg-surface-900">
        <PanelHeader title="Control de versiones" />
        <div className="flex-1 min-h-0 overflow-hidden">
          <GitWorkbench workspaceId={wsId} workspaceName={currentWorkspace.name} />
        </div>
      </div>
    );
  }

  if (view === 'tools') {
    return (
      <ToolsGallery
        onOpenBoard={props.onOpenBoard}
        onOpenStRunner={props.onOpenStRunner}
        onOpenSemanticBrowser={props.onOpenSemanticBrowser}
        onOpenFormalizer={props.onOpenFormalizer}
        onOpenSnippetsGallery={props.onOpenSnippetsGallery}
        onOpenAgoraAI={props.onOpenAgoraAI}
        isBoardOpen={props.isBoardOpen}
        isStRunnerOpen={props.isStRunnerOpen}
        isSemanticBrowserOpen={props.isSemanticBrowserOpen}
        isFormalizerOpen={props.isFormalizerOpen}
        isAgoraAIOpen={props.isAgoraAIOpen}
      />
    );
  }

  if (view === 'ai') {
    return (
      <PanelShell title="Agora AI">
        <div className="px-3 py-4 space-y-3 text-xs text-surface-400">
          <p className="leading-relaxed">
            Chat asistido con contexto del workspace.
          </p>
          <button
            type="button"
            onClick={props.onOpenAgoraAI}
            className="flex w-full items-center gap-2 rounded border border-surface-700 bg-surface-900 px-3 py-2 text-left text-surface-200 transition hover:border-mandy-500/50 hover:bg-surface-800"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="flex-1">Abrir Agora AI en panel</span>
          </button>
        </div>
      </PanelShell>
    );
  }

  return null;
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="flex h-9 shrink-0 items-center border-b border-surface-700/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
      {title}
    </div>
  );
}

function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col bg-surface-900">
      <PanelHeader title={title} />
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-xs text-surface-500">
      <span className="text-surface-500">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
