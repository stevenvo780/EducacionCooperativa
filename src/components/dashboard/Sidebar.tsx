'use client';

import React, { useState, useMemo, useLayoutEffect, useRef, useEffect, useCallback } from 'react';
import { List as VirtualizedList, type RowComponentProps } from 'react-window';
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Download, Folder, FolderOpen, FolderPlus, FolderUp, Info, Loader2, Pencil, Plus, Search, Star, Trash2, Upload, X } from 'lucide-react';
import type { DocItem, FolderItem, Workspace } from '@/components/dashboard/types';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath } from '@/lib/folder-utils';
import { getUpdatedAtValue } from '@/services/dashboardUtils';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import { setTouchDragDocId } from '@/lib/touchDragState';
import { TOUCH_DROP_DOC_EVENT, LONG_PRESS_DELAY_MS, DRAG_START_THRESHOLD_PX } from '@/hooks/useTouchDrag';

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
  onToggleSidebarCollapse: () => void;
  currentWorkspace: Workspace | null;
  activeFolder: string;
  setActiveFolder: (folder: string) => void;
  folders: FolderItem[];
  loadingDocs: boolean;
  docs: DocItem[];
  sidebarSearchQuery: string;
  setSidebarSearchQuery: (value: string) => void;
  sidebarFilteredDocs: DocItem[];
  selectedDocId: string | null;
  favoriteDocs: DocItem[];
  favoriteDocIds: string[];
  openDocument: (doc: DocItem) => void;
  onToggleFavorite: (doc: DocItem) => void;
  onMoveFavorite: (docId: string, direction: 'up' | 'down') => void;
  handleDocDragStart: (e: React.DragEvent, doc: DocItem) => void;
  handleDocDragEnd: () => void;
  deleteDocument: (doc: DocItem, e: React.MouseEvent) => void;
  onRenameDocument: (doc: DocItem) => void;
  onDownloadDoc?: (doc: DocItem) => void;
  getIcon: (doc: DocItem) => React.ReactNode;
  folderDragOver: string | null;
  onFolderDragOver: (e: React.DragEvent, path: string) => void;
  onFolderDrop: (e: React.DragEvent, path: string) => void;
  onFolderDragLeave: (path: string) => void;
  onCreateDoc?: () => void;
  onCreateFolder?: () => void;
  onCreateDocInFolder?: (folderPath: string) => void;
  onCreateFolderInFolder?: (folderPath: string) => void;
  onUploadFile?: () => void;
  onUploadFolder?: () => void;
  onUploadFileToFolder?: (folderPath: string) => void;
  onUploadFolderToFolder?: (folderPath: string) => void;
  onShowDocProperties?: (doc: DocItem) => void;
  onShowFolderProperties?: (folder: FolderItem) => void;
  onShowCurrentLocationProperties?: () => void;
  onRenameFolder?: (folder: FolderItem) => void;
  onDeleteFolder?: (folder: FolderItem) => void;
}

const Sidebar = ({
  sidebarWidth,
  isCollapsed,
  showMobileSidebar,
  onCloseMobileSidebar,
  onToggleSidebarCollapse,
  currentWorkspace,
  activeFolder,
  setActiveFolder,
  folders,
  loadingDocs,
  docs,
  sidebarSearchQuery,
  setSidebarSearchQuery,
  selectedDocId,
  favoriteDocs,
  favoriteDocIds,
  openDocument,
  onToggleFavorite,
  onMoveFavorite,
  handleDocDragStart,
  handleDocDragEnd,
  deleteDocument,
  onRenameDocument,
  onDownloadDoc,
  getIcon,
  folderDragOver,
  onFolderDragOver,
  onFolderDrop,
  onFolderDragLeave,
  onCreateDoc,
  onCreateFolder,
  onCreateDocInFolder,
  onCreateFolderInFolder,
  onUploadFile,
  onUploadFolder,
  onUploadFileToFolder,
  onUploadFolderToFolder,
  onShowDocProperties,
  onShowFolderProperties,
  onShowCurrentLocationProperties,
  onRenameFolder,
  onDeleteFolder
}: SidebarProps) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([DEFAULT_FOLDER_NAME]));
  const [collapsedByUser, setCollapsedByUser] = useState<Set<string>>(new Set());
  const [listRef, listSize] = useElementSize<HTMLDivElement>();
  const { menu: contextMenu, open: openContextMenu, close: closeContextMenu, getTriggerProps: getContextTriggerProps } = useContextMenu<{
    type: 'doc' | 'folder' | 'sidebar';
    id?: string;
    path?: string;
    folder?: FolderItem;
    doc?: DocItem;
  }>();

  // Touch drag state (refs to avoid re-renders)
  const touchDocRef = useRef<{ id: string; label: string } | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDraggingRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchGhostRef = useRef<HTMLElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Create/reuse the ghost element for touch drag
  const getTouchGhost = useCallback((): HTMLElement => {
    if (!touchGhostRef.current) {
      const el = document.createElement('div');
      el.style.cssText = [
        'position:fixed', 'pointer-events:none', 'z-index:99999',
        'padding:6px 12px', 'border-radius:8px',
        'background:rgba(30,41,59,0.95)', 'border:1px solid rgba(100,116,139,0.5)',
        'color:#cbd5e1', 'font-size:12px', 'font-weight:500',
        'box-shadow:0 8px 24px rgba(0,0,0,0.5)', 'backdrop-filter:blur(4px)',
        'display:none', 'user-select:none', 'white-space:nowrap'
      ].join(';');
      document.body.appendChild(el);
      touchGhostRef.current = el;
    }
    return touchGhostRef.current;
  }, []);

  // Cleanup ghost on unmount
  useEffect(() => {
    return () => {
      touchGhostRef.current?.remove();
      touchGhostRef.current = null;
    };
  }, []);

  // Container-level touch drag handling for doc items
  useEffect(() => {
    const container = listContainerRef.current;
    if (!container) return;

    const cancelTouch = () => {
      if (touchTimerRef.current) { clearTimeout(touchTimerRef.current); touchTimerRef.current = null; }
      if (touchDraggingRef.current) { setTouchDragDocId(null); touchDraggingRef.current = false; }
      if (touchGhostRef.current) touchGhostRef.current.style.display = 'none';
      touchDocRef.current = null;
      touchStartPosRef.current = null;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      // Walk up from touch target to find a doc item
      let node = e.target as HTMLElement | null;
      while (node && node !== container) {
        if (node.dataset.docId) {
          touchDocRef.current = { id: node.dataset.docId, label: node.dataset.docLabel ?? '' };
          break;
        }
        node = node.parentElement;
      }
      if (!touchDocRef.current) return;

      const touch = e.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

      touchTimerRef.current = setTimeout(() => {
        touchTimerRef.current = null;
        if (!touchDocRef.current) return;
        touchDraggingRef.current = true;
        setTouchDragDocId(touchDocRef.current.id);
        const ghost = getTouchGhost();
        ghost.textContent = `📄 ${touchDocRef.current.label}`;
        ghost.style.display = 'block';
        ghost.style.left = `${touch.clientX + 12}px`;
        ghost.style.top = `${touch.clientY - 20}px`;
      }, LONG_PRESS_DELAY_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touchDraggingRef.current) {
        // Cancel long-press if finger moved beyond threshold before activation
        if (touchStartPosRef.current) {
          const dx = touch.clientX - touchStartPosRef.current.x;
          const dy = touch.clientY - touchStartPosRef.current.y;
          if (Math.sqrt(dx * dx + dy * dy) > DRAG_START_THRESHOLD_PX) {
            if (touchTimerRef.current) { clearTimeout(touchTimerRef.current); touchTimerRef.current = null; }
          }
        }
        return;
      }
      e.preventDefault();
      const ghost = getTouchGhost();
      ghost.style.left = `${touch.clientX + 12}px`;
      ghost.style.top = `${touch.clientY - 20}px`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchDraggingRef.current) { cancelTouch(); return; }
      const touch = e.changedTouches[0];
      if (touchGhostRef.current) touchGhostRef.current.style.display = 'none';

      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      let tileId: string | null = null;
      let isDropTarget = false;
      let node: Element | null = el;
      while (node) {
        if (node instanceof HTMLElement) {
          if (node.dataset.touchDropTarget === 'true') { isDropTarget = true; tileId = node.dataset.tileId ?? null; break; }
          if (node.dataset.touchEmptyDrop === 'true') { isDropTarget = true; break; }
        }
        node = node.parentElement;
      }

      if (isDropTarget && touchDocRef.current) {
        window.dispatchEvent(new CustomEvent(TOUCH_DROP_DOC_EVENT, {
          detail: { docId: touchDocRef.current.id, tileId }
        }));
      }

      setTouchDragDocId(null);
      touchDraggingRef.current = false;
      touchDocRef.current = null;
      touchStartPosRef.current = null;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', cancelTouch);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', cancelTouch);
    };
  }, [getTouchGhost]);

  const isCollapsedView = isCollapsed && !showMobileSidebar;
  const effectiveWidth = isCollapsedView ? 0 : sidebarWidth;
  const favoriteDocIdSet = useMemo(() => new Set(favoriteDocIds), [favoriteDocIds]);

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

  // Filtrar docs localmente para evitar desfase con useDeferredValue
  const actualFilteredDocs = useMemo(() => {
    const query = sidebarSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return docs.filter(d => d.name.toLowerCase().includes(query));
  }, [docs, sidebarSearchQuery]);

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
      return actualFilteredDocs.map(doc => ({ kind: 'search', doc }));
    }
    return treeItems;
  }, [isSearchMode, actualFilteredDocs, treeItems]);

  const renderSidebarRow = ({ index, style, ariaAttributes }: RowComponentProps) => {
    const item = listItems[index];
    if (!item) return null;

    if (item.kind === 'search') {
      const isFavorite = favoriteDocIdSet.has(item.doc.id);
      return (
        <div
          style={{ ...style, paddingLeft: 12, paddingRight: 12 } as React.CSSProperties}
          {...ariaAttributes}
        >
          <div
            onClick={() => openDocument(item.doc)}
            draggable
            data-doc-id={item.doc.id}
            data-doc-label={item.doc.name}
            onDragStart={(e) => handleDocDragStart(e, item.doc)}
            onDragEnd={handleDocDragEnd}
            {...getContextTriggerProps({ type: 'doc', id: item.doc.id, doc: item.doc })}
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
                  onToggleFavorite(item.doc);
                }}
                className={`p-0.5 ${isFavorite ? 'text-amber-300 hover:text-amber-200' : 'text-surface-500 hover:text-amber-300'}`}
                title={isFavorite ? 'Quitar de favoritos' : 'Fijar en favoritos'}
              >
                <Star className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              {onDownloadDoc && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadDoc(item.doc);
                  }}
                  className="text-surface-500 hover:text-surface-300 p-0.5"
                  title="Descargar"
                >
                  <Download className="w-3 h-3" />
                </button>
              )}
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
            {...getContextTriggerProps({ type: 'folder', path: item.folder.path, folder: item.folder })}
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
  const isFavorite = favoriteDocIdSet.has(item.doc.id);
    return (
      <div style={style} {...ariaAttributes}>
        <div
          onClick={() => openDocument(item.doc)}
          draggable
          data-doc-id={item.doc.id}
          data-doc-label={item.doc.name}
          onDragStart={(e) => handleDocDragStart(e, item.doc)}
          onDragEnd={handleDocDragEnd}
          {...getContextTriggerProps({ type: 'doc', id: item.doc.id, doc: item.doc })}
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
                onToggleFavorite(item.doc);
              }}
              className={`p-0.5 ${isFavorite ? 'text-amber-300 hover:text-amber-200' : 'text-surface-500 hover:text-amber-300'}`}
              title={isFavorite ? 'Quitar de favoritos' : 'Fijar en favoritos'}
            >
              <Star className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
            {onDownloadDoc && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadDoc(item.doc);
                }}
                className="text-surface-500 hover:text-surface-300 p-0.5"
                title="Descargar"
              >
                <Download className="w-3 h-3" />
              </button>
            )}
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
        onContextMenu={(e) => {
          e.preventDefault();
          openContextMenu(e.clientX, e.clientY, { type: 'sidebar', path: activeFolder });
        }}
      >
        <div className="flex-1 overflow-hidden p-2 flex flex-col">
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider flex items-center gap-2">
                ARCHIVOS: {currentWorkspace?.name}
                {loadingDocs && <Loader2 className="w-3 h-3 animate-spin text-surface-500" />}
              </span>
            </div>

            {/* File action buttons */}
            <div className="grid grid-cols-2 gap-1 px-2 pb-2">
              <button
                onClick={onCreateDoc}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-surface-300 hover:text-mandy-300 hover:bg-surface-700 transition"
                title="Nuevo archivo"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="truncate">Nuevo archivo</span>
              </button>
              <button
                onClick={onCreateFolder}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-surface-300 hover:text-mandy-300 hover:bg-surface-700 transition"
                title="Nueva carpeta"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span className="truncate">Nueva carpeta</span>
              </button>
              <button
                onClick={onUploadFile}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-surface-300 hover:text-mandy-300 hover:bg-surface-700 transition"
                title="Subir archivos"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="truncate">Subir archivos</span>
              </button>
              <button
                onClick={onUploadFolder}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-surface-300 hover:text-mandy-300 hover:bg-surface-700 transition"
                title="Subir carpeta"
              >
                <FolderUp className="w-3.5 h-3.5" />
                <span className="truncate">Subir carpeta</span>
              </button>
            </div>

            {favoriteDocs.length > 0 && (
              <div className="px-2 pb-1.5">
                <div className="space-y-0.5">
                  {favoriteDocs.map((doc, index) => {
                    const isSelected = selectedDocId === doc.id;

                    return (
                      <div
                        key={doc.id}
                        {...getContextTriggerProps({ type: 'doc', id: doc.id, doc })}
                        className={`group flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition ${
                          isSelected ? 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/30' : 'text-surface-200 hover:bg-surface-800/80'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openDocument(doc)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                          title={doc.name}
                        >
                          <Star className={`h-3 w-3 shrink-0 fill-current ${isSelected ? 'text-amber-200' : 'text-amber-400/70'}`} />
                          <span className="truncate">{doc.name}</span>
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => onMoveFavorite(doc.id, 'up')}
                            disabled={index === 0}
                            className="rounded p-0.5 text-surface-500 hover:text-surface-200 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Subir"
                          >
                            <ArrowUp className="h-2.5 w-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveFavorite(doc.id, 'down')}
                            disabled={index === favoriteDocs.length - 1}
                            className="rounded p-0.5 text-surface-500 hover:text-surface-200 disabled:cursor-not-allowed disabled:opacity-30"
                            title="Bajar"
                          >
                            <ArrowDown className="h-2.5 w-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleFavorite(doc)}
                            className="rounded p-0.5 text-surface-400 hover:text-amber-200"
                            title="Quitar"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

              {isSearchMode && actualFilteredDocs.length === 0 && (
                <div className="px-3 py-2 text-center text-xs text-surface-500">
                  Sin resultados
                </div>
              )}

              {listItems.length > 0 && (
                <div
                  ref={(el) => { listRef.current = el; listContainerRef.current = el; }}
                  className="h-full min-h-[200px]"
                >
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
          <span>{sidebarSearchQuery ? `${actualFilteredDocs.length} de ${docs.length}` : `${docs.length} archivos`}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onToggleSidebarCollapse}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-surface-400 transition hover:bg-surface-700/70 hover:text-surface-200"
              title="Ocultar panel de archivos (Ctrl+B)"
              aria-label="Ocultar panel de archivos"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ocultar</span>
            </button>
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          sections={contextMenu.data.type === 'doc' ? [
            {
              actions: [
                {
                  label: 'Abrir',
                  onClick: () => { if (contextMenu.data.doc) openDocument(contextMenu.data.doc); }
                },
                {
                  label: 'Renombrar',
                  icon: <Pencil className="w-4 h-4" />,
                  onClick: () => { if (contextMenu.data.doc) onRenameDocument(contextMenu.data.doc); }
                },
                {
                  label: (contextMenu.data.id && favoriteDocIdSet.has(contextMenu.data.id)) ? 'Quitar de favoritos' : 'Fijar en favoritos',
                  icon: <Star className={`w-4 h-4 ${(contextMenu.data.id && favoriteDocIdSet.has(contextMenu.data.id)) ? 'fill-current text-amber-300' : ''}`} />,
                  onClick: () => { if (contextMenu.data.doc) onToggleFavorite(contextMenu.data.doc); }
                },
                ...(onDownloadDoc && contextMenu.data.doc ? [{
                  label: 'Descargar',
                  icon: <Download className="w-4 h-4" />,
                  onClick: () => onDownloadDoc!(contextMenu.data.doc!)
                }] : []),
                ...(onShowDocProperties && contextMenu.data.doc ? [{
                  label: 'Propiedades',
                  icon: <Info className="w-4 h-4" />,
                  onClick: () => onShowDocProperties(contextMenu.data.doc!)
                }] : [])
              ]
            },
            {
              actions: [
                {
                  label: 'Eliminar',
                  icon: <Trash2 className="w-4 h-4" />,
                  onClick: () => { if (contextMenu.data.doc) deleteDocument(contextMenu.data.doc, { stopPropagation: () => {} } as React.MouseEvent); },
                  destructive: true
                }
              ]
            }
          ] : contextMenu.data.type === 'folder' ? [
            {
              actions: [
                {
                  label: 'Abrir Carpeta',
                  icon: <Folder className="w-4 h-4" />,
                  onClick: () => { if (contextMenu.data.path) setActiveFolder(contextMenu.data.path); }
                },
                ...(onCreateDocInFolder && contextMenu.data.path ? [{
                  label: 'Nuevo archivo',
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => onCreateDocInFolder(contextMenu.data.path!)
                }] : []),
                ...(onCreateFolderInFolder && contextMenu.data.path ? [{
                  label: 'Nueva carpeta',
                  icon: <FolderPlus className="w-4 h-4" />,
                  onClick: () => onCreateFolderInFolder(contextMenu.data.path!)
                }] : []),
                ...(onUploadFileToFolder && contextMenu.data.path ? [{
                  label: 'Subir archivos',
                  icon: <Upload className="w-4 h-4" />,
                  onClick: () => onUploadFileToFolder(contextMenu.data.path!)
                }] : []),
                ...(onUploadFolderToFolder && contextMenu.data.path ? [{
                  label: 'Subir carpeta',
                  icon: <FolderUp className="w-4 h-4" />,
                  onClick: () => onUploadFolderToFolder(contextMenu.data.path!)
                }] : []),
                ...(onRenameFolder && contextMenu.data.folder?.docId ? [{
                  label: 'Renombrar',
                  icon: <Pencil className="w-4 h-4" />,
                  onClick: () => onRenameFolder(contextMenu.data.folder!)
                }] : []),
                ...(onShowFolderProperties && contextMenu.data.folder ? [{
                  label: 'Propiedades',
                  icon: <Info className="w-4 h-4" />,
                  onClick: () => onShowFolderProperties(contextMenu.data.folder!)
                }] : [])
              ]
            },
            {
              actions: [
                ...(onDeleteFolder && contextMenu.data.folder && contextMenu.data.folder.kind !== 'system' ? [{
                  label: 'Eliminar',
                  icon: <Trash2 className="w-4 h-4" />,
                  onClick: () => onDeleteFolder(contextMenu.data.folder!),
                  destructive: true
                }] : [])
              ]
            }
          ] : [
            {
              actions: [
                ...(onCreateDoc ? [{
                  label: 'Nuevo archivo',
                  icon: <Plus className="w-4 h-4" />,
                  onClick: () => onCreateDoc()
                }] : []),
                ...(onCreateFolder ? [{
                  label: 'Nueva carpeta',
                  icon: <FolderPlus className="w-4 h-4" />,
                  onClick: () => onCreateFolder()
                }] : []),
                ...(onUploadFile ? [{
                  label: 'Subir archivos',
                  icon: <Upload className="w-4 h-4" />,
                  onClick: () => onUploadFile()
                }] : []),
                ...(onUploadFolder ? [{
                  label: 'Subir carpeta',
                  icon: <FolderUp className="w-4 h-4" />,
                  onClick: () => onUploadFolder()
                }] : []),
                ...(onShowCurrentLocationProperties ? [{
                  label: activeFolder ? 'Propiedades de carpeta' : 'Propiedades del espacio',
                  icon: <Info className="w-4 h-4" />,
                  onClick: () => onShowCurrentLocationProperties()
                }] : [])
              ]
            }
          ]}
        />
      )}
    </>
  );
};

export default React.memo(Sidebar);
