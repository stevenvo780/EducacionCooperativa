'use client';

import type React from 'react';
import { useState, useMemo, useLayoutEffect, useRef, useEffect } from 'react';
import { List as VirtualizedList, type RowComponentProps } from 'react-window';
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, FolderUp, Loader2, Pencil, Plus, Search, Settings, Trash2, Upload, X } from 'lucide-react';
import type { DocItem, FolderItem, Workspace } from '@/components/dashboard/types';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath } from '@/lib/folder-utils';
import { getUpdatedAtValue } from '@/services/dashboardUtils';
import AssistantSection from '@/components/dashboard/AssistantSection';
import type { TerminalSession } from '@/context/TerminalContext';
import type { WorkerStatus } from '@/lib/TerminalController';
import type { User as FirebaseUser } from 'firebase/auth';

const ROW_HEIGHT = 28;

const useElementSize = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
};

type SidebarListItem =
  | { kind: 'folder'; folder: FolderItem; depth: number; hasChildren: boolean }
  | { kind: 'doc'; doc: DocItem; depth: number }
  | { kind: 'search'; doc: DocItem };

interface SidebarProps {
  sidebarWidth: number;
  isCollapsed: boolean;
  showMobileSidebar: boolean;
  onCloseMobileSidebar: () => void;
  openFilesTab: () => void;
  createDoc: (e?: React.FormEvent, folderName?: string) => void;
  createFolder: () => void;
  setUploadTargetFolder: (folder: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  folderInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  folderInputProps: React.InputHTMLAttributes<HTMLInputElement>;
  currentWorkspace: Workspace | null;
  activeFolder: string;
  setActiveFolder: (folder: string) => void;
  folders: FolderItem[];
  connectionStatus: 'checking' | 'online' | 'offline' | 'error';
  isCreatingSession: boolean;
  activeSessionId: string | null;
  getWorkerStatusForWorkspace: (workspaceId: string) => WorkerStatus;
  getSessionsForWorkspace: (workspaceId: string) => TerminalSession[];
  createSession: (workspaceId: string, workspaceType: 'personal' | 'shared', workspaceName?: string) => void;
  selectSession: (sessionId: string) => void;
  destroySession: (sessionId: string) => void;
  onRenameSession: (session: TerminalSession) => void;
  openTerminal: (session?: { id: string; name: string }) => void;
  openTabs: DocItem[];
  closeTabById: (tabId: string) => void;
  user: FirebaseUser | null;
  loadingDocs: boolean;
  docs: DocItem[];
  sidebarSearchQuery: string;
  setSidebarSearchQuery: (value: string) => void;
  sidebarFilteredDocs: DocItem[];
  selectedDocId: string | null;
  openDocument: (doc: DocItem) => void;
  handleDocDragStart: (e: React.DragEvent, doc: DocItem) => void;
  handleDocDragEnd: () => void;
  deleteDocument: (doc: DocItem, e: React.MouseEvent) => void;
  onRenameDocument: (doc: DocItem) => void;
  setShowQuickSearch: (value: boolean) => void;
  quickSearchInputRef: React.RefObject<HTMLInputElement>;
  getIcon: (doc: DocItem) => React.ReactNode;
  folderDragOver: string | null;
  onFolderDragOver: (e: React.DragEvent, path: string) => void;
  onFolderDrop: (e: React.DragEvent, path: string) => void;
  onFolderDragLeave: (path: string) => void;
}

const Sidebar = ({
  sidebarWidth,
  isCollapsed,
  showMobileSidebar,
  onCloseMobileSidebar,
  openFilesTab,
  createDoc,
  createFolder,
  setUploadTargetFolder,
  fileInputRef,
  folderInputRef,
  handleFileUpload,
  handleFolderUpload,
  folderInputProps,
  currentWorkspace,
  activeFolder,
  setActiveFolder,
  folders,
  connectionStatus,
  isCreatingSession,
  activeSessionId,
  getWorkerStatusForWorkspace,
  getSessionsForWorkspace,
  createSession,
  selectSession,
  destroySession,
  onRenameSession,
  openTerminal,
  openTabs,
  closeTabById,
  user,
  loadingDocs,
  docs,
  sidebarSearchQuery,
  setSidebarSearchQuery,
  sidebarFilteredDocs,
  selectedDocId,
  openDocument,
  handleDocDragStart,
  handleDocDragEnd,
  deleteDocument,
  onRenameDocument,
  setShowQuickSearch,
  quickSearchInputRef,
  getIcon,
  folderDragOver,
  onFolderDragOver,
  onFolderDrop,
  onFolderDragLeave
}: SidebarProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([DEFAULT_FOLDER_NAME]));
  const [collapsedByUser, setCollapsedByUser] = useState<Set<string>>(new Set());
  const [listRef, listSize] = useElementSize<HTMLDivElement>();
  const isCollapsedView = isCollapsed && !showMobileSidebar;
  const effectiveWidth = isCollapsedView ? 0 : sidebarWidth;

  useEffect(() => {
    setExpandedFolders(new Set([DEFAULT_FOLDER_NAME]));
    setCollapsedByUser(new Set());
  }, [currentWorkspace?.id]);

  const effectiveFolders = useMemo<FolderItem[]>(() => {
    const byPath = new Map<string, FolderItem>();
    const derived: FolderItem[] = [];

    for (const folder of folders) {
      byPath.set(folder.path, folder);
    }

    const ensureFolder = (rawPath?: string) => {
      const normalized = normalizeFolderPath(rawPath);
      if (byPath.has(normalized)) return;

      const parts = normalized.split('/');
      let acc = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        acc = i === 0 ? part : `${acc}/${part}`;
        if (byPath.has(acc)) continue;

        const parentPath = i === 0 ? '' : acc.slice(0, acc.lastIndexOf('/'));
        const virtualFolder: FolderItem = {
          id: `virtual-${acc}`,
          name: part,
          path: acc,
          parentPath,
          kind: 'virtual'
        };

        byPath.set(acc, virtualFolder);
        derived.push(virtualFolder);
      }
    };

    ensureFolder(DEFAULT_FOLDER_NAME);
    docs.forEach(doc => ensureFolder(doc.folder));

    return [...folders, ...derived];
  }, [docs, folders]);

  const folderChildrenMap = useMemo(() => {
    const map: Record<string, FolderItem[]> = { '': [] };
    for (const folder of effectiveFolders) {
      const parent = folder.parentPath || '';
      if (!map[parent]) map[parent] = [];
      map[parent].push(folder);
    }
    Object.values(map).forEach(list => {
      list.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : null;
        const orderB = typeof b.order === 'number' ? b.order : null;
        if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
        if (orderA !== null && orderB === null) return -1;
        if (orderA === null && orderB !== null) return 1;
        return a.name.localeCompare(b.name);
      });
    });
    return map;
  }, [effectiveFolders]);

  const docsByFolder = useMemo(() => {
    const result: Record<string, DocItem[]> = {};
    for (const doc of docs) {
      if (doc.type === 'folder') continue;
      const f = doc.folder || DEFAULT_FOLDER_NAME;
      if (!result[f]) result[f] = [];
      result[f].push(doc);
    }
    Object.values(result).forEach(list => {
      list.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : null;
        const orderB = typeof b.order === 'number' ? b.order : null;
        if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
        if (orderA !== null && orderB === null) return -1;
        if (orderA === null && orderB !== null) return 1;
        const dateA = getUpdatedAtValue(a.updatedAt);
        const dateB = getUpdatedAtValue(b.updatedAt);
        if (dateA !== dateB) return dateB - dateA;
        return (a.name || '').localeCompare(b.name || '');
      });
    });
    return result;
  }, [docs]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    if (path === DEFAULT_FOLDER_NAME) {
      setCollapsedByUser(prev => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    }
  };

  const isSearchMode = sidebarSearchQuery.trim().length > 0;

  const treeItems = useMemo<SidebarListItem[]>(() => {
    const items: SidebarListItem[] = [];

    const walk = (parentPath: string, depth: number) => {
      const children = folderChildrenMap[parentPath] ?? [];
      for (const folder of children) {
        const subfolders = folderChildrenMap[folder.path] ?? [];
        const folderFiles = docsByFolder[folder.path] ?? [];
        const hasChildren = subfolders.length > 0 || folderFiles.length > 0;
        items.push({ kind: 'folder', folder, depth, hasChildren });

        const isDefaultFolder = folder.path === DEFAULT_FOLDER_NAME;
        const isUserCollapsed = collapsedByUser.has(folder.path);
        const shouldExpand = isDefaultFolder
          ? !isUserCollapsed
          : expandedFolders.has(folder.path);

        if (shouldExpand) {
          walk(folder.path, depth + 1);
          for (const doc of folderFiles) {
            items.push({ kind: 'doc', doc, depth: depth + 1 });
          }
        }
      }
    };

    walk('', 0);
    return items;
  }, [docsByFolder, expandedFolders, folderChildrenMap, collapsedByUser]);

  const listItems = useMemo<SidebarListItem[]>(() => {
    if (isSearchMode) {
      return sidebarFilteredDocs.map(doc => ({ kind: 'search', doc }));
    }
    return treeItems;
  }, [isSearchMode, sidebarFilteredDocs, treeItems]);

  const renderSidebarRow = ({ index, style, ariaAttributes }: RowComponentProps) => {
    const item = listItems[index];
    if (!item) return null;

    if (item.kind === 'search') {
      return (
        <div
          style={{ ...style, paddingLeft: 12, paddingRight: 12 } as React.CSSProperties}
          {...ariaAttributes}
        >
          <div
            onClick={() => openDocument(item.doc)}
            draggable
            onDragStart={(e) => handleDocDragStart(e, item.doc)}
            onDragEnd={handleDocDragEnd}
            className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-md cursor-pointer select-none transition ${
              selectedDocId === item.doc.id ? 'bg-surface-700 text-white font-medium' : 'text-surface-300 hover:bg-surface-700/50'
            }`}
          >
            <div className={`${selectedDocId === item.doc.id ? 'text-white' : 'text-surface-500'}`}>
              {getIcon(item.doc)}
            </div>
            <span className="truncate flex-1">{item.doc.name}</span>
            <span className="text-[9px] text-surface-600 truncate max-w-[60px]">{item.doc.folder?.split('/').pop()}</span>
            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRenameDocument(item.doc);
                }}
                className="text-surface-500 hover:text-surface-300 p-0.5"
                title="Renombrar"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => deleteDocument(item.doc, e)}
                className="text-surface-500 hover:text-mandy-400 p-0.5"
                title="Eliminar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (item.kind === 'folder') {
      const isDefaultFolder = item.folder.path === DEFAULT_FOLDER_NAME;
      const isUserCollapsed = collapsedByUser.has(item.folder.path);
      const isExpanded = isDefaultFolder
        ? !isUserCollapsed
        : expandedFolders.has(item.folder.path);
      const isActive = activeFolder === item.folder.path;
      const isDragOver = folderDragOver === item.folder.path;
      const count = docsByFolder[item.folder.path]?.length ?? 0;
      const paddingLeft = 8 + item.depth * 12;

      return (
        <div style={style} {...ariaAttributes}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveFolder(item.folder.path);
              toggleFolder(item.folder.path);
            }}
            onDragOver={(e) => onFolderDragOver(e, item.folder.path)}
            onDrop={(e) => onFolderDrop(e, item.folder.path)}
            onDragLeave={() => onFolderDragLeave(item.folder.path)}
            className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-xs transition relative ${
              isActive ? 'bg-mandy-500/15 text-mandy-300' : 'text-surface-300 hover:bg-surface-700/40'
            } ${isDragOver ? 'ring-2 ring-mandy-500 bg-mandy-500/20' : ''}`}
            style={{ paddingLeft }}
          >
            <span className="w-3 h-3 flex items-center justify-center">
              {item.hasChildren ? (
                isExpanded ? <ChevronDown className="w-3 h-3 text-surface-500" /> : <ChevronRight className="w-3 h-3 text-surface-500" />
              ) : (
                <span className="w-3" />
              )}
            </span>
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="truncate flex-1 text-left">{item.folder.name}</span>
            {count > 0 && <span className="text-[9px] text-surface-500">{count}</span>}
          </button>
        </div>
      );
    }

    const paddingLeft = 8 + item.depth * 12 + 16;
    return (
      <div style={style} {...ariaAttributes}>
        <div
          onClick={() => openDocument(item.doc)}
          draggable
          onDragStart={(e) => handleDocDragStart(e, item.doc)}
          onDragEnd={handleDocDragEnd}
          className={`group flex items-center gap-2 py-1 px-2 text-xs rounded cursor-pointer select-none transition ${
            selectedDocId === item.doc.id ? 'bg-surface-700 text-white font-medium' : 'text-surface-400 hover:bg-surface-700/40'
          }`}
          style={{ paddingLeft }}
        >
          <div className={`${selectedDocId === item.doc.id ? 'text-white' : 'text-surface-500'}`}>
            {getIcon(item.doc)}
          </div>
          <span className="truncate flex-1">{item.doc.name}</span>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameDocument(item.doc);
              }}
              className="text-surface-500 hover:text-surface-300 p-0.5"
              title="Renombrar"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => deleteDocument(item.doc, e)}
              className="text-surface-500 hover:text-mandy-400 p-0.5"
              title="Eliminar"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {showMobileSidebar && (
        <div className="absolute inset-0 z-30 bg-black/40 md:hidden" onClick={onCloseMobileSidebar} />
      )}

      <div
        style={{ width: effectiveWidth }}
        className={`
          bg-surface-800 border-r border-surface-600/50 flex flex-col shrink-0 transition-transform duration-150 absolute md:relative z-40 h-full
          ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsedView ? 'overflow-hidden border-r-0 pointer-events-none' : ''}
        `}
        aria-hidden={isCollapsedView}
      >
        <div className="p-3 border-b border-surface-600/50 flex justify-between items-center bg-surface-700/30 gap-2">
          <div className="text-xs font-bold text-surface-500 uppercase tracking-wider pl-2">
            Navegador
          </div>
          <div className="flex gap-0.5">
            <button onClick={() => openFilesTab()} className="p-1.5 hover:bg-surface-700 rounded text-surface-500 hover:text-mandy-400 transition" title="Abrir Explorador">
              <Folder className="w-4 h-4" />
            </button>
            <button onClick={() => createDoc(undefined, activeFolder)} className="p-1.5 hover:bg-surface-700 rounded text-surface-500 hover:text-mandy-400 transition" title="Nuevo Archivo">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => createFolder()} className="p-1.5 hover:bg-surface-700 rounded text-surface-500 hover:text-mandy-400 transition" title="Nueva Carpeta">
              <FolderPlus className="w-4 h-4" />
            </button>
            <div className="relative group/up">
              <button className="p-1.5 hover:bg-surface-700 rounded text-surface-500 hover:text-mandy-400 transition" title="Subir">
                <Upload className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1 bg-surface-800 border border-surface-600 rounded-lg shadow-xl p-1 hidden group-hover/up:flex flex-col gap-1 z-50">
                <button
                  onClick={() => {
                    setUploadTargetFolder(DEFAULT_FOLDER_NAME);
                    fileInputRef.current?.click();
                  }}
                  className="px-3 py-1.5 text-xs text-left text-surface-300 hover:bg-surface-700 rounded flex gap-2 items-center"
                >
                  <Upload className="w-3 h-3" /> Archivos
                </button>
                <button
                  onClick={() => {
                    setUploadTargetFolder(DEFAULT_FOLDER_NAME);
                    folderInputRef.current?.click();
                  }}
                  className="px-3 py-1.5 text-xs text-left text-surface-300 hover:bg-surface-700 rounded flex gap-2 items-center"
                >
                  <FolderUp className="w-3 h-3" /> Carpeta
                </button>
              </div>
            </div>
          </div>
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />
          <input type="file" ref={folderInputRef} className="hidden" onChange={handleFolderUpload} multiple {...folderInputProps} />
        </div>

        <div className="flex-1 overflow-hidden p-2 flex flex-col gap-4">
          <AssistantSection
            currentWorkspace={currentWorkspace}
            user={user}
            connectionStatus={connectionStatus}
            isCreatingSession={isCreatingSession}
            activeSessionId={activeSessionId}
            getWorkerStatusForWorkspace={getWorkerStatusForWorkspace}
            getSessionsForWorkspace={getSessionsForWorkspace}
            createSession={createSession}
            selectSession={selectSession}
            destroySession={destroySession}
            onRenameSession={onRenameSession}
            openTerminal={openTerminal}
            openTabs={openTabs}
            closeTabById={closeTabById}
          />

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-2 py-1 flex items-center justify-between">
              <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                ARCHIVOS: {currentWorkspace?.name}
                {loadingDocs && <Loader2 className="w-3 h-3 animate-spin text-surface-500" />}
              </span>
            </div>

            <div className="px-2 py-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
                <input
                  type="text"
                  value={sidebarSearchQuery}
                  onChange={e => setSidebarSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-7 pr-7 py-1.5 text-xs bg-surface-800 border border-surface-700 rounded-md text-white placeholder-surface-500 outline-none focus:border-mandy-500/50 transition"
                />
                {sidebarSearchQuery && (
                  <button
                    onClick={() => setSidebarSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-surface-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setShowQuickSearch(true);
                  setTimeout(() => quickSearchInputRef.current?.focus(), 50);
                }}
                className="w-full mt-1 px-2 py-1 text-[10px] text-surface-500 hover:text-surface-300 flex items-center gap-1 justify-center hover:bg-surface-800 rounded transition"
              >
                <kbd className="px-1 py-0.5 bg-surface-700 rounded text-[9px]">Ctrl+P</kbd>
                <span>Busqueda rapida</span>
              </button>
            </div>

            <div className="mt-2 px-1 flex-1 min-h-0">
              {loadingDocs && docs.length === 0 && (
                <div className="px-3 py-2 text-center text-xs text-surface-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando archivos...
                </div>
              )}

              {!loadingDocs && docs.length === 0 && !isSearchMode && (
                <div className="px-3 py-2 text-center text-xs text-surface-500">
                  Espacio vacío
                </div>
              )}

              {isSearchMode && sidebarFilteredDocs.length === 0 && (
                <div className="px-3 py-2 text-center text-xs text-surface-500">
                  Sin resultados
                </div>
              )}

              {listItems.length > 0 && (
                <div ref={listRef} className="h-full min-h-[200px]">
                  <VirtualizedList
                    rowCount={listItems.length}
                    rowHeight={ROW_HEIGHT}
                    overscanCount={6}
                    className="scrollbar-hide"
                    style={{
                      height: listSize.height > 0 ? listSize.height : listItems.length * ROW_HEIGHT,
                      width: Math.max(listSize.width, 1)
                    }}
                    rowComponent={renderSidebarRow}
                    rowProps={{}}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-surface-600/50 bg-surface-800 text-xs text-surface-500 flex justify-between items-center">
          <span>{sidebarSearchQuery ? `${sidebarFilteredDocs.length} de ${docs.length}` : `${docs.length} archivos`}</span>
          <div className="flex gap-2">
            <Settings className="w-4 h-4 hover:text-surface-300 cursor-pointer" />
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
