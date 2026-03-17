'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Mosaic, MosaicWindow, MosaicNode, MosaicZeroState, MosaicPath, getLeaves, createBalancedTreeFromLeaves } from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import { Columns, Eye, Pencil, X, Terminal as TerminalIcon, Search, ChevronUp, ChevronDown, Check, XCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import type { DocumentTypeId } from '@/types/documents';
import type { WorkspaceTypeId } from '@/types/workspace';

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false });
const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });
const FileExplorer = dynamic(() => import('@/components/FileExplorer'), { ssr: false });
const KanbanBoard = dynamic(() => import('@/components/dashboard/KanbanBoard'), { ssr: false });
const SpreadsheetViewer = dynamic(() => import('@/components/SpreadsheetViewer'), { ssr: false });
const STRunner = dynamic(() => import('@/components/STRunner'), { ssr: false });
const STFileEditor = dynamic(() => import('@/components/editor/STFileEditor'), { ssr: false });

const SPREADSHEET_EXTENSIONS = new Set(['xlsx', 'xls', 'csv', 'tsv']);
function isSpreadsheetDoc(doc: { name: string }): boolean {
  const ext = doc.name.split('.').pop()?.toLowerCase() || '';
  return SPREADSHEET_EXTENSIONS.has(ext);
}

function isStFileDoc(doc: { name: string }): boolean {
  const lower = doc.name.toLowerCase();
  return lower.endsWith('.md.st') || lower.endsWith('.st');
}

interface SearchState {
  currentMatch: number;
  totalMatches: number;
}

export type ViewMode = 'edit' | 'preview' | 'split' | 'raw';

export interface DocItem {
  id: string;
  name: string;
  type?: DocumentTypeId;
  sessionId?: string;
  content?: string;
  url?: string;
  folder?: string;
  storagePath?: string;
  workspaceId?: string;
  order?: number;

  mimeType?: string;
  size?: number;
  updatedAt?: unknown;
  ownerId?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  parentPath: string;
  kind: 'system' | 'record' | 'virtual';
  docId?: string;
  order?: number;
}

interface MosaicLayoutProps {
  value: MosaicNode<string> | null;
  onChange: (newNode: MosaicNode<string> | null) => void;
  openTabs: DocItem[];
  docs: DocItem[];
  folders: FolderItem[];
  docModes: Record<string, ViewMode>;
  onSetDocMode: (docId: string, mode: ViewMode) => void;
  onCloseTab: (docId: string) => void;
  onSelectDoc: (doc: DocItem) => void;
  onActivateTab?: (docId: string) => void;
  onDropDocOnTile?: (docId: string, targetTileId: string, position: 'left' | 'right' | 'top' | 'bottom' | 'replace') => void;
  onDropDocOnEmpty?: (docId: string) => void;
  onCreateFile?: () => void;
  onCreateStFile?: () => void;
  onCreateFolder?: () => void;
  onUploadFile?: () => void;
  onUploadFolder?: () => void;
  onDeleteDoc?: (docId: string) => void;
  onDeleteFolder?: (folder: FolderItem) => void;
  onDeleteItems?: (payload: { docIds: string[]; folderPaths: string[] }) => void;
  onDuplicateDoc?: (doc: DocItem) => void;
  onMoveDoc?: (docId: string, targetFolder: string) => void;
  onRenameDoc?: (doc: DocItem) => void;
  onRenameDocInline?: (doc: DocItem, nextName: string) => Promise<void> | void;
  onDownloadDoc?: (doc: DocItem) => void;
  favoriteDocIds?: string[];
  onToggleFavorite?: (doc: DocItem) => void;
  onDownloadFolder?: (folderPath: string) => void;
  onReorderDocs?: (payload: { folderPath: string; orderedIds: string[] }) => void;
  onReorderFolders?: (payload: { parentPath: string; orderedPaths: string[] }) => void;
  activeFolder?: string;
  onActiveFolderChange?: (folderPath: string) => void;
  currentWorkspaceName?: string;
  currentWorkspaceId?: string;
  currentWorkspaceType?: WorkspaceTypeId;
  currentUserId?: string;
  nexusUrl: string;
}

const MosaicLayout: React.FC<MosaicLayoutProps> = ({
  value,
  onChange,
  openTabs,
  docs,
  folders,
  docModes,
  onSetDocMode,
  onCloseTab,
  onSelectDoc,
  onActivateTab,
  onDropDocOnTile,
  onDropDocOnEmpty,
  onCreateFile,
  onCreateStFile,
  onCreateFolder,
  onUploadFile,
  onUploadFolder,
  onDeleteDoc,
  onDeleteFolder,
  onDeleteItems,
  onDuplicateDoc,
  onMoveDoc,
  onRenameDoc,
  onRenameDocInline,
  onDownloadDoc,
  favoriteDocIds,
  onToggleFavorite,
  onDownloadFolder,
  onReorderDocs,
  onReorderFolders,
  activeFolder,
  onActiveFolderChange,
  currentWorkspaceName,
  currentWorkspaceId,
  currentWorkspaceType,
  currentUserId,
  nexusUrl
}) => {
  const [docSearchTerms, setDocSearchTerms] = useState<Record<string, string>>({});
  const [docSearchStates, setDocSearchStates] = useState<Record<string, SearchState>>({});
  const [dragOverInfo, setDragOverInfo] = useState<{ tileId: string; position: 'left' | 'right' | 'top' | 'bottom' | 'replace' } | null>(null);
  const [dragOverEmpty, setDragOverEmpty] = useState(false);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);
  const [isResizingMosaic, setIsResizingMosaic] = useState(false);
  const [resizeCursor, setResizeCursor] = useState<'col-resize' | 'row-resize'>('col-resize');
  const [editingTitleDocId, setEditingTitleDocId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const dragLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchNavRefs = useRef<Record<string, { next: () => void; prev: () => void } | null>>({});
  const mosaicContainerRef = useRef<HTMLDivElement | null>(null);
  const { menu: tabContextMenu, close: closeTabContextMenu, getTriggerProps: getTabContextTriggerProps } = useContextMenu<string>();

  // Detect global drag of documents to show overlay over iframes
  useEffect(() => {
    const handleGlobalDragStart = (e: DragEvent) => {
      const types = Array.from(e.dataTransfer?.types ?? []);
      if (types.includes('application/x-doc-id')) {
        setIsDraggingDoc(true);
      }
    };
    const handleGlobalDragEnd = () => setIsDraggingDoc(false);
    const handleGlobalDrop = () => setIsDraggingDoc(false);
    document.addEventListener('dragstart', handleGlobalDragStart);
    document.addEventListener('dragend', handleGlobalDragEnd);
    document.addEventListener('drop', handleGlobalDrop);
    return () => {
      document.removeEventListener('dragstart', handleGlobalDragStart);
      document.removeEventListener('dragend', handleGlobalDragEnd);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const splitHandle = target.closest('.mosaic-split');
      if (!splitHandle || !mosaicContainerRef.current?.contains(splitHandle)) return;

      setIsResizingMosaic(true);
      setResizeCursor(splitHandle.classList.contains('-column') ? 'row-resize' : 'col-resize');
    };

    const stopResize = () => {
      setIsResizingMosaic(false);
    };

    const handleWindowBlur = () => {
      stopResize();
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);
    document.addEventListener('mouseup', stopResize, true);
    document.addEventListener('touchend', stopResize, true);
    document.addEventListener('touchcancel', stopResize, true);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
      document.removeEventListener('mouseup', stopResize, true);
      document.removeEventListener('touchend', stopResize, true);
      document.removeEventListener('touchcancel', stopResize, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.body.classList.toggle('mosaic-resizing-active', isResizingMosaic);
    document.body.style.cursor = isResizingMosaic ? resizeCursor : '';

    return () => {
      document.body.classList.remove('mosaic-resizing-active');
      document.body.style.cursor = '';
    };
  }, [isResizingMosaic, resizeCursor]);

  const fileExplorerDocs = useMemo(() => {
      return docs.filter(d => d.type !== 'terminal' && d.type !== 'files' && d.type !== 'board' && d.type !== 'st-runner');
  }, [docs]);
  const tabById = useMemo(() => new Map(openTabs.map(tab => [tab.id, tab])), [openTabs]);
  const docById = useMemo(() => new Map(docs.map(doc => [doc.id, doc])), [docs]);

  useEffect(() => {
    if (!value) return;
    try {
        const leaves = getLeaves(value);
        const validLeaves = leaves.filter(id => tabById.has(id) || docById.has(id));
        if (validLeaves.length !== leaves.length) {
             if (validLeaves.length === 0) {
                 onChange(null);
             } else {
                 onChange(createBalancedTreeFromLeaves(validLeaves));
             }
        }
    } catch (e) {
        console.error('Mosaic cleanup error', e);
    }
  }, [value, tabById, docById, onChange]);

  const handleSearchChange = useCallback((docId: string, value: string) => {
    setDocSearchTerms(prev => ({ ...prev, [docId]: value }));
  }, []);

  const handleSearchStateChange = useCallback((docId: string, state: SearchState) => {
    setDocSearchStates(prev => {
      const previousState = prev[docId];
      if (previousState && previousState.currentMatch === state.currentMatch && previousState.totalMatches === state.totalMatches) {
        return prev;
      }
      return { ...prev, [docId]: state };
    });
  }, []);

  const getSearchNavRef = useCallback((docId: string) => {
    const refObj = {
      get current() {
        return searchNavRefs.current[docId] || null;
      },
      set current(value: { next: () => void; prev: () => void } | null) {
        searchNavRefs.current[docId] = value;
      }
    };
    return refObj as React.MutableRefObject<{ next: () => void; prev: () => void } | null>;
  }, []);

  const startInlineRename = useCallback((doc: DocItem) => {
    if (!onRenameDocInline) return;
    setEditingTitleDocId(doc.id);
    setEditingTitleValue(doc.name || '');
  }, [onRenameDocInline]);

  const cancelInlineRename = useCallback(() => {
    setEditingTitleDocId(null);
    setEditingTitleValue('');
  }, []);

  const submitInlineRename = useCallback(async (doc: DocItem) => {
    if (!onRenameDocInline) return;
    const trimmed = editingTitleValue.trim();
    if (!trimmed || trimmed === doc.name) {
      cancelInlineRename();
      return;
    }

    setRenamingDocId(doc.id);
    try {
      await onRenameDocInline(doc, trimmed);
      setEditingTitleDocId(null);
      setEditingTitleValue('');
    } finally {
      setRenamingDocId(null);
    }
  }, [cancelInlineRename, editingTitleValue, onRenameDocInline]);

  const renderToolbarControls = useCallback((doc: { id: string; type?: string; name: string }, mode: ViewMode) => {
    const isTextDoc = doc.type !== 'terminal' && doc.type !== 'files' && doc.type !== 'board' && doc.type !== 'st-runner' && !isSpreadsheetDoc(doc) && !isStFileDoc(doc);
    const searchTerm = docSearchTerms[doc.id] || '';
    const searchState = docSearchStates[doc.id] || { currentMatch: 0, totalMatches: 0 };

    return (
      <div className="flex items-center gap-1">
        {isTextDoc && (
          <>
            <div className="relative flex items-center gap-1">
              <div className="relative flex items-center">
                <Search className="absolute left-1.5 w-3 h-3 text-surface-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(doc.id, e.target.value)}
                  className="w-24 pl-5 pr-1.5 py-0.5 text-xs bg-surface-800 border border-surface-600 rounded text-surface-200 placeholder-surface-500 focus:outline-none focus:border-sky-500 transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => handleSearchChange(doc.id, '')}
                    className="absolute right-1 p-0.5 text-surface-500 hover:text-surface-300"
                    title="Limpiar"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              {searchTerm && searchState.totalMatches > 0 && (
                <>
                  <span className="text-xs text-surface-400 min-w-[3rem] text-center">
                    {searchState.currentMatch + 1}/{searchState.totalMatches}
                  </span>
                  <button
                    onClick={() => searchNavRefs.current[doc.id]?.prev()}
                    className="p-0.5 rounded text-surface-400 hover:bg-surface-700 hover:text-white transition"
                    title="Anterior (↑)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => searchNavRefs.current[doc.id]?.next()}
                    className="p-0.5 rounded text-surface-400 hover:bg-surface-700 hover:text-white transition"
                    title="Siguiente (↓)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {searchTerm && searchState.totalMatches === 0 && (
                <span className="text-xs text-mandy-400">Sin resultados</span>
              )}
            </div>
            <span className="w-px h-4 bg-surface-600 mx-1" />
          </>
        )}
        <button
          onClick={() => onCloseTab(doc.id)}
          className="p-1 rounded text-surface-400 hover:bg-mandy-600/20 hover:text-mandy-300 transition"
          title="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }, [onCloseTab, docSearchTerms, docSearchStates, handleSearchChange]);

  const closeOtherTabs = useCallback((keepDocId: string) => {
    const otherIds = openTabs.filter(t => t.id !== keepDocId).map(t => t.id);
    otherIds.forEach(id => onCloseTab(id));
  }, [onCloseTab, openTabs]);

  const closeAllTabs = useCallback(() => {
    openTabs.forEach(t => onCloseTab(t.id));
  }, [onCloseTab, openTabs]);

  const renderWindowToolbar = useCallback((doc: DocItem, mode: ViewMode) => {
    const canRenameInline = Boolean(onRenameDocInline) && doc.type !== 'terminal' && doc.type !== 'files' && doc.type !== 'board' && doc.type !== 'st-runner';
    const isEditingTitle = editingTitleDocId === doc.id;
    const isRenaming = renamingDocId === doc.id;

    return (
      <div className="flex h-full w-full min-w-0 items-center justify-between gap-2 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {isEditingTitle ? (
            <div
              className="flex min-w-0 flex-1 items-center gap-1"
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={editingTitleValue}
                onChange={(e) => setEditingTitleValue(e.target.value)}
                onBlur={() => {
                  void submitInlineRename(doc);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void submitInlineRename(doc);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelInlineRename();
                  }
                }}
                autoFocus
                className="h-5 min-w-0 flex-1 rounded border border-sky-500/50 bg-surface-950 px-2 text-xs text-surface-100 outline-none focus:border-sky-400"
                aria-label="Renombrar archivo"
              />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={() => {
                  void submitInlineRename(doc);
                }}
                disabled={isRenaming}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-wait disabled:opacity-60"
                title="Guardar nombre"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={cancelInlineRename}
                disabled={isRenaming}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-surface-400 transition hover:bg-surface-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                title="Cancelar"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startInlineRename(doc);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (canRenameInline) startInlineRename(doc);
              }}
              {...getTabContextTriggerProps(doc.id)}
              disabled={!canRenameInline}
              className={`mosaic-inline-title group flex min-w-0 flex-1 items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] ${canRenameInline ? 'text-surface-300 hover:bg-surface-800/80 hover:text-white' : 'cursor-default text-surface-300'}`}
              title={canRenameInline ? 'Click para renombrar' : doc.name}
            >
              <span className="truncate">{doc.name}</span>
              {canRenameInline && <Pencil className="h-3 w-3 shrink-0 text-surface-500 opacity-0 transition group-hover:opacity-100" />}
            </button>
          )}
        </div>
        <span className="h-4 w-px shrink-0 bg-surface-600/80" />
        <div className="shrink-0 pl-1">{renderToolbarControls(doc, mode)}</div>
      </div>
    );
  }, [cancelInlineRename, editingTitleDocId, editingTitleValue, onRenameDocInline, renderToolbarControls, renamingDocId, startInlineRename, submitInlineRename, getTabContextTriggerProps]);

  const calcDropPosition = useCallback((e: React.DragEvent<HTMLDivElement>): 'left' | 'right' | 'top' | 'bottom' | 'replace' => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const edgeThreshold = 0.22;
    if (x < edgeThreshold) return 'left';
    if (x > 1 - edgeThreshold) return 'right';
    if (y < edgeThreshold) return 'top';
    if (y > 1 - edgeThreshold) return 'bottom';
    return 'replace';
  }, []);

  const handleTileDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, tileId: string) => {
    const types = Array.from(e.dataTransfer.types ?? []);
    if (!types.includes('application/x-doc-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragLeaveTimer.current) { clearTimeout(dragLeaveTimer.current); dragLeaveTimer.current = null; }
    const position = calcDropPosition(e);
    setDragOverInfo(prev => {
      if (prev && prev.tileId === tileId && prev.position === position) return prev;
      return { tileId, position };
    });
  }, [calcDropPosition]);

  const handleTileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragLeaveTimer.current = setTimeout(() => setDragOverInfo(null), 80);
  }, []);

  const handleTileDrop = useCallback((e: React.DragEvent<HTMLDivElement>, tileId: string) => {
    const types = Array.from(e.dataTransfer.types ?? []);
    if (!types.includes('application/x-doc-id')) return;
    e.preventDefault();
    e.stopPropagation();
    const position = calcDropPosition(e);
    setDragOverInfo(null);
    const docId = e.dataTransfer.getData('application/x-doc-id');
    if (docId && docId !== tileId) {
      onDropDocOnTile?.(docId, tileId, position);
    }
  }, [onDropDocOnTile, calcDropPosition]);

  const handleEmptyDragOver = useCallback((e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types ?? []);
    if (!types.includes('application/x-doc-id')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverEmpty(true);
  }, []);

  const handleEmptyDrop = useCallback((e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer.types ?? []);
    if (!types.includes('application/x-doc-id')) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverEmpty(false);
    const docId = e.dataTransfer.getData('application/x-doc-id');
    if (docId) onDropDocOnEmpty?.(docId);
  }, [onDropDocOnEmpty]);

  const renderTile = useCallback((id: string, path: MosaicPath) => {
    const doc = tabById.get(id) || docById.get(id);
    if (!doc) return <div className="p-4 text-surface-400">Documento no encontrado: {id}</div>;

    const isTerminal = doc.type === 'terminal';
    const isFileExplorer = doc.type === 'files';
    const isBoard = doc.type === 'board';
    const isStRunner = doc.type === 'st-runner';
    const isSpreadsheet = !isTerminal && !isFileExplorer && !isBoard && isSpreadsheetDoc(doc);
    const isStFile = !isTerminal && !isFileExplorer && !isBoard && !isStRunner && isStFileDoc(doc);
    const mode = docModes[doc.id] ?? 'preview';
    const searchTerm = docSearchTerms[doc.id] || '';
    const dropInfo = dragOverInfo?.tileId === doc.id ? dragOverInfo : null;

    return (
        <MosaicWindow<string>
            path={path}
            title={doc.name}
            className="bg-surface-900 mosaic-window-compact"
            toolbarControls={renderToolbarControls(doc, mode)}
          renderToolbar={() => renderWindowToolbar(doc, mode)}
        >
            <div
                className={`h-full w-full relative ${isBoard ? 'bg-surface-900' : 'bg-black'}`}
                onMouseDownCapture={() => {
                  onActivateTab?.(doc.id);
                }}
                onFocusCapture={() => {
                  onActivateTab?.(doc.id);
                }}
                onDragOver={(e) => handleTileDragOver(e, doc.id)}
                onDragLeave={handleTileDragLeave}
                onDrop={(e) => handleTileDrop(e, doc.id)}
            >
                {/* Transparent overlay during drag to prevent iframe from capturing drag events */}
                {isDraggingDoc && (
                  <div className="absolute inset-0 z-40" style={{ background: 'transparent' }} />
                )}
                {dropInfo && (
                  <div className="absolute inset-0 z-50 pointer-events-none">
                    {dropInfo.position === 'left' && <div className="absolute inset-y-0 left-0 w-1/2 bg-sky-500/20 border-l-4 border-sky-500 rounded-l" />}
                    {dropInfo.position === 'right' && <div className="absolute inset-y-0 right-0 w-1/2 bg-sky-500/20 border-r-4 border-sky-500 rounded-r" />}
                    {dropInfo.position === 'top' && <div className="absolute inset-x-0 top-0 h-1/2 bg-sky-500/20 border-t-4 border-sky-500 rounded-t" />}
                    {dropInfo.position === 'bottom' && <div className="absolute inset-x-0 bottom-0 h-1/2 bg-sky-500/20 border-b-4 border-sky-500 rounded-b" />}
                    {dropInfo.position === 'replace' && <div className="absolute inset-0 bg-sky-500/10 ring-2 ring-inset ring-sky-500" />}
                  </div>
                )}
                 {isTerminal ? (
                      <Terminal
                        nexusUrl={nexusUrl}
                        workspaceId={currentWorkspaceId}
                        workspaceName={currentWorkspaceName}
                        workspaceType={currentWorkspaceType}
                        sessionId={doc.sessionId}
                      />
                  ) : isFileExplorer ? (
                      <FileExplorer
                        docs={fileExplorerDocs}
                        folders={folders}
                        onSelectDoc={onSelectDoc}
                        onCreateFile={onCreateFile}
                        onCreateStFile={onCreateStFile}
                        onCreateFolder={onCreateFolder}
                        onUploadFile={onUploadFile}
                        onUploadFolder={onUploadFolder}
                        onDeleteDoc={onDeleteDoc}
                        onDeleteFolder={onDeleteFolder}
                        onDeleteItems={onDeleteItems}
                        onDuplicateDoc={onDuplicateDoc}
                        onMoveDoc={onMoveDoc}
                        onRenameDoc={onRenameDoc}
                        onDownloadDoc={onDownloadDoc}
                        favoriteDocIds={favoriteDocIds}
                        onToggleFavorite={onToggleFavorite}
                        onDownloadFolder={onDownloadFolder}
                        onReorderDocs={onReorderDocs}
                        onReorderFolders={onReorderFolders}
                        activeFolder={activeFolder}
                        onActiveFolderChange={onActiveFolderChange}
                        currentWorkspaceName={currentWorkspaceName}
                        currentWorkspaceId={currentWorkspaceId}
                        embedded
                      />
                  ) : isBoard ? (
                      <KanbanBoard
                        workspaceId={doc.workspaceId ?? currentWorkspaceId}
                        workspaceName={currentWorkspaceName}
                        ownerId={doc.ownerId ?? currentUserId}
                      />
                  ) : isSpreadsheet ? (
                      <SpreadsheetViewer
                        docId={doc.id}
                        docName={doc.name}
                      />
                  ) : isStRunner ? (
                      <STRunner height="100%" />
                  ) : isStFile ? (
                      <STFileEditor
                        docId={doc.id}
                        docName={doc.name}
                      />
                  ) : (
                      <Editor
                        roomId={doc.id}
                        embedded
                        forceInline
                        externalSearchTerm={searchTerm}
                        onSearchStateChange={(state) => handleSearchStateChange(doc.id, state)}
                        searchNavRef={getSearchNavRef(doc.id)}
                      />
                  )}
            </div>
        </MosaicWindow>
    );
  }, [
    tabById, docById, docModes, nexusUrl, renderToolbarControls, renderWindowToolbar, docSearchTerms, dragOverInfo, isDraggingDoc,
    currentWorkspaceId, currentWorkspaceName, currentWorkspaceType, currentUserId, folders,
    onSelectDoc, onActivateTab, onCreateFile, onCreateFolder, onUploadFile, onUploadFolder,
    handleTileDragOver, handleTileDragLeave, handleTileDrop,
    onDeleteDoc, onDeleteFolder, onDeleteItems, onDuplicateDoc, onMoveDoc, onRenameDoc, onDownloadDoc, favoriteDocIds, onToggleFavorite, onDownloadFolder,
    onReorderDocs, onReorderFolders,
    activeFolder, onActiveFolderChange, fileExplorerDocs,
    handleSearchStateChange, getSearchNavRef
  ]);

  const emptyZeroState = useMemo(() => (
    <div
      className={`h-full w-full flex flex-col items-center justify-center text-surface-400 p-8 text-center transition-colors duration-150 ${dragOverEmpty ? 'bg-sky-500/10 ring-2 ring-inset ring-sky-500' : ''}`}
      onDragOver={handleEmptyDragOver}
      onDragLeave={() => setDragOverEmpty(false)}
      onDrop={handleEmptyDrop}
    >
      <div className="max-w-md space-y-4 pointer-events-none">
        <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Columns className="w-8 h-8 text-surface-400" />
        </div>
        <h3 className="text-xl font-medium text-surface-200">{dragOverEmpty ? 'Soltar aquí para abrir' : 'No hay paneles abiertos'}</h3>
        <p className="text-surface-400">{dragOverEmpty ? 'Suelta el archivo para abrirlo en el panel' : 'Selecciona o arrastra un archivo del explorador para comenzar.'}</p>
      </div>
    </div>
  ), [dragOverEmpty, handleEmptyDragOver, handleEmptyDrop]);

  return (
    <>
      <div ref={mosaicContainerRef} className="relative h-full w-full">
      <Mosaic<string>
          renderTile={renderTile}
          value={value}
          onChange={onChange}
          onRelease={onChange}
          className="mosaic-blueprint-theme mosaic-custom-dark h-full w-full"
          zeroStateView={emptyZeroState}
      />
      {isResizingMosaic && (
        <div
          className="absolute inset-0 z-[80] bg-transparent"
          style={{ cursor: resizeCursor }}
          onMouseUp={() => setIsResizingMosaic(false)}
          onTouchEnd={() => setIsResizingMosaic(false)}
        />
      )}
      </div>
      {tabContextMenu && (
        <ContextMenu
          x={tabContextMenu.x}
          y={tabContextMenu.y}
          onClose={closeTabContextMenu}
          sections={[
            {
              actions: [
                {
                  label: 'Cerrar',
                  icon: <X className="w-4 h-4" />,
                  onClick: () => onCloseTab(tabContextMenu.data)
                },
                {
                  label: 'Cerrar otros',
                  icon: <XCircle className="w-4 h-4" />,
                  onClick: () => closeOtherTabs(tabContextMenu.data)
                },
                {
                  label: 'Cerrar todos',
                  icon: <XCircle className="w-4 h-4" />,
                  onClick: () => closeAllTabs(),
                  destructive: true
                }
              ]
            }
          ]}
        />
      )}
      <style jsx global>{`
        body.mosaic-resizing-active,
        body.mosaic-resizing-active * {
          user-select: none !important;
        }
        .mosaic-custom-dark .mosaic-split {
          z-index: 30 !important;
          background: rgba(148, 163, 184, 0.18) !important;
          touch-action: none !important;
        }
        .mosaic-custom-dark .mosaic-split:hover,
        .mosaic-custom-dark .mosaic-split.-active {
          background: rgba(96, 165, 250, 0.4) !important;
        }
        .mosaic-custom-dark .mosaic-tile,
        .mosaic-custom-dark .mosaic-window,
        .mosaic-custom-dark .mosaic-window-body {
          min-width: 0;
          min-height: 0;
        }
        .mosaic-window-compact .mosaic-window-toolbar {
          height: 28px !important;
          min-height: 28px !important;
          background: rgb(30 30 35) !important;
          border-bottom: 1px solid rgb(55 55 65) !important;
        }
        .mosaic-window-compact .mosaic-window-title {
          font-size: 11px !important;
          color: rgb(180 180 190) !important;
        }
        .mosaic-window-compact .mosaic-inline-title:disabled {
          opacity: 1;
        }
      `}</style>
    </>
  );
};

export default MosaicLayout;
