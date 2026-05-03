'use client';

import dynamic from 'next/dynamic';
import { Files, Search, GitBranch, LayoutGrid, FileCode2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';
import type { Workspace } from '@/components/dashboard/types';
import type { SearchResultFilter, SearchResultItem } from '@/lib/search/types';
import ToolsGallery from './ToolsGallery';
import SearchPanel from './SearchPanel';

const GitWorkbench = dynamic(() => import('@/components/dashboard/GitWorkbench'), { ssr: false });
const SnippetGallery = dynamic(() => import('@/components/SnippetGallery'), { ssr: false });

/**
 * Contexto que recibe cada vista al renderizar. Pasamos handlers y datos
 * que el dashboard ya gestiona — la vista no debe mantener estado global,
 * solo encapsular su UI.
 */
export interface SidebarViewContext {
  filesContent: ReactNode;
  currentWorkspace: Workspace | null;
  userUid?: string;

  // search
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
  searchInputRef: React.Ref<HTMLInputElement>;

  // tools shortcuts
  onOpenBoard: () => void;
  onOpenStRunner: () => void;
  onOpenSemanticBrowser: () => void;
  onOpenFormalizer: () => void;
  isBoardOpen?: boolean;
  isStRunnerOpen?: boolean;
  isSemanticBrowserOpen?: boolean;
  isFormalizerOpen?: boolean;
}

export interface SidebarView {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  /** Render principal del panel; si no se define, se usa filesContent. */
  render: (ctx: SidebarViewContext) => ReactNode;
}

/**
 * Cabecera reutilizable estilo VS Code para vistas del sidebar.
 * Las vistas que renderizan componentes "full-bleed" (Sidebar de archivos,
 * GitWorkbench, AgoraAIChat) controlan su propia cabecera; el helper se
 * usa para envolver vistas simples (search, tools, snippets…).
 */
export function PanelShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col bg-surface-900">
      <div className="flex h-9 shrink-0 items-center border-b border-surface-700/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
        {title}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/**
 * Registro de vistas. El orden aquí es el orden visual en la activity bar.
 * Para añadir una nueva vista basta con empujar una entrada — la activity bar,
 * el LeftPanel, los atajos y la command palette la recogen automáticamente.
 */
export const SIDEBAR_VIEWS: SidebarView[] = [
  {
    id: 'files',
    label: 'Archivos',
    icon: Files,
    shortcut: 'Ctrl+Shift+E',
    render: (ctx) => <>{ctx.filesContent}</>
  },
  {
    id: 'search',
    label: 'Buscar',
    icon: Search,
    shortcut: 'Ctrl+K',
    render: (ctx) => (
      <SearchPanel
        query={ctx.searchQuery}
        onQueryChange={ctx.onSearchQueryChange}
        results={ctx.searchResults}
        loading={ctx.searchLoading}
        errorMessage={ctx.searchError}
        activeFilter={ctx.searchFilter}
        onFilterChange={ctx.onSearchFilterChange}
        selectedIndex={ctx.searchSelectedIndex}
        onSelectIndex={ctx.onSearchSelectIndex}
        onSelect={ctx.onSearchSelect}
        onKeyDown={ctx.onSearchKeyDown}
        inputRef={ctx.searchInputRef}
      />
    )
  },
  {
    id: 'git',
    label: 'Control de versiones',
    icon: GitBranch,
    shortcut: 'Ctrl+Shift+G',
    render: (ctx) => {
      if (!ctx.currentWorkspace) {
        return (
          <PanelShell title="Control de versiones">
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-xs text-surface-500">
              <GitBranch className="h-4 w-4" />
              <span>Selecciona un workspace para ver Git.</span>
            </div>
          </PanelShell>
        );
      }
      const wsId = ctx.currentWorkspace.id === PERSONAL_WORKSPACE_ID && ctx.userUid
        ? `personal:${ctx.userUid}`
        : ctx.currentWorkspace.id;
      return (
        <PanelShell title="Control de versiones">
          <GitWorkbench workspaceId={wsId} workspaceName={ctx.currentWorkspace.name} />
        </PanelShell>
      );
    }
  },
  {
    id: 'tools',
    label: 'Herramientas',
    icon: LayoutGrid,
    render: (ctx) => (
      <ToolsGallery
        onOpenBoard={ctx.onOpenBoard}
        onOpenStRunner={ctx.onOpenStRunner}
        onOpenSemanticBrowser={ctx.onOpenSemanticBrowser}
        onOpenFormalizer={ctx.onOpenFormalizer}
        isBoardOpen={ctx.isBoardOpen}
        isStRunnerOpen={ctx.isStRunnerOpen}
        isSemanticBrowserOpen={ctx.isSemanticBrowserOpen}
        isFormalizerOpen={ctx.isFormalizerOpen}
      />
    )
  },
  {
    id: 'snippets',
    label: 'Snippets',
    icon: FileCode2,
    render: (ctx) => (
      <PanelShell title="Snippets">
        {ctx.currentWorkspace ? (
          <SnippetGallery
            workspaceId={ctx.currentWorkspace.id}
            onInsert={(markdown) => {
              window.dispatchEvent(new CustomEvent('agora:insert-snippet', { detail: { markdown } }));
            }}
            hideClose
          />
        ) : (
          <EmptyView icon={<FileCode2 className="h-4 w-4" />} text="Selecciona un workspace." />
        )}
      </PanelShell>
    )
  }
];

export type ActivityView = (typeof SIDEBAR_VIEWS)[number]['id'];

function EmptyView({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-xs text-surface-500">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
