'use client';

import React, { useState, useMemo, useEffect, useCallback, useDeferredValue, useTransition, memo } from 'react';
import { List as VirtualizedList } from 'react-window';
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Download, Folder, FolderOpen, FolderPlus, FolderUp, GripVertical, Info, ListCollapse, Loader2, Pencil, Plus, Search, Star, Trash2, Upload, X } from 'lucide-react';
import type { DocItem, FolderItem, Workspace } from '@/components/dashboard/types';
import { normalizeFolderPath } from '@/lib/folder-utils';
import { buildWorkspaceTreeModel } from '@/lib/workspace-tree-model';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import { useElementSize } from '@/hooks/useElementSize';
import { useIsTouchDeviceProfile } from '@/lib/device-input';

const ROW_HEIGHT = 28;
const EMPTY_DOCS: DocItem[] = [];
const EMPTY_FOLDERS: FolderItem[] = [];

interface SidebarRowProps {
  listItems: SidebarListItem[];
  selectedDocId: string | null;
  selectedDocsIds: Set<string>;
  favoriteDocIdSet: Set<string>;
  collapsedByUser: Set<string>;
  activeFolder: string;
  folderDragOver: string | null;
  docsByFolder: Record<string, DocItem[]>;
  isTouchDevice: boolean;
  touchHandleVisibilityClass: string;
  getIcon: (doc: DocItem) => React.ReactNode;
  handleDocClick: (e: React.MouseEvent, index: number, doc: DocItem) => void;
  handleDocDragStart: (e: React.DragEvent, doc: DocItem) => void;
  handleDocDragEnd: () => void;
  getDocContextMenuProps: (doc: DocItem) => { onContextMenu: (e: React.MouseEvent) => void };
  setActiveFolder: (folder: string) => void;
  toggleFolder: (path: string) => void;
  onFolderDragOver: (e: React.DragEvent, path: string) => void;
  onFolderDrop: (e: React.DragEvent, path: string) => void;
  onFolderDragLeave: (path: string) => void;
  getContextTriggerProps: (data: {
    type: 'doc' | 'folder' | 'sidebar';
    id?: string;
    path?: string;
    folder?: FolderItem;
    doc?: DocItem;
  }) => { onContextMenu?: (e: React.MouseEvent) => void };
}

type SidebarRowComponentProps = SidebarRowProps & {
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  index: number;
  style: React.CSSProperties;
};

const SidebarDocDragHandle = memo(function SidebarDocDragHandle({
  doc,
  handleDocDragStart,
  handleDocDragEnd,
  touchHandleVisibilityClass
}: {
  doc: DocItem;
  handleDocDragStart: (e: React.DragEvent, doc: DocItem) => void;
  handleDocDragEnd: () => void;
  touchHandleVisibilityClass: string;
}) {
  return (
    <button
      draggable
      data-drag-doc-id={doc.id}
      data-drag-label={doc.name}
      data-disable-context-menu-trigger="true"
      onDragStart={(e) => {
        e.stopPropagation();
        handleDocDragStart(e, doc);
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        handleDocDragEnd();
      }}
      onClick={(e) => e.stopPropagation()}
      className={`touch-none p-1 rounded-md text-surface-500 hover:text-surface-100 hover:bg-surface-700/70 transition ${touchHandleVisibilityClass} cursor-grab active:cursor-grabbing`}
      title="Arrastrar archivo"
    >
      <GripVertical className="w-3 h-3" />
    </button>
  );
});

const SidebarRow = memo(function SidebarRow({
  ariaAttributes,
  index,
  style,
  listItems,
  selectedDocId,
  selectedDocsIds,
  favoriteDocIdSet,
  collapsedByUser,
  activeFolder,
  folderDragOver,
  docsByFolder,
  isTouchDevice,
  touchHandleVisibilityClass,
  getIcon,
  handleDocClick,
  handleDocDragStart,
  handleDocDragEnd,
  getDocContextMenuProps,
  setActiveFolder,
  toggleFolder,
  onFolderDragOver,
  onFolderDrop,
  onFolderDragLeave,
  getContextTriggerProps
}: SidebarRowComponentProps) {
  const item = listItems[index];
  if (!item) return null;

  if (item.kind === 'search') {
    const isFavorite = favoriteDocIdSet.has(item.doc.id);
    const isSelected = selectedDocId === item.doc.id || selectedDocsIds.has(item.doc.id);
    return (
      <div
        style={{ ...style, paddingLeft: 12, paddingRight: 12 } as React.CSSProperties}
        {...ariaAttributes}
        role="treeitem"
        aria-selected={isSelected}
      >
        <div
          onClick={(e) => handleDocClick(e, index, item.doc)}
          draggable={!isTouchDevice}
          data-drag-doc-id={item.doc.id}
          data-drag-label={item.doc.name}
          onDragStart={!isTouchDevice ? ((e) => handleDocDragStart(e, item.doc)) : undefined}
          onDragEnd={!isTouchDevice ? handleDocDragEnd : undefined}
          {...getDocContextMenuProps(item.doc)}
          className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-md cursor-pointer select-none transition ${
            isSelected ? 'bg-surface-700 text-white font-medium ring-1 ring-inset ring-surface-500/50' : 'text-surface-300 hover:bg-surface-700/50'
          }`}
        >
          <div className={isSelected ? 'text-white' : 'text-surface-500'}>
            {getIcon(item.doc)}
          </div>
          <span className="truncate flex-1">{item.doc.name}</span>
          <span className="text-[10px] text-surface-400 truncate max-w-[60px]">{item.doc.folder?.split('/').pop()}</span>
          {isFavorite && (
            <Star className="w-3 h-3 text-amber-300 fill-current shrink-0" />
          )}
          <SidebarDocDragHandle
            doc={item.doc}
            handleDocDragStart={handleDocDragStart}
            handleDocDragEnd={handleDocDragEnd}
            touchHandleVisibilityClass={touchHandleVisibilityClass}
          />
        </div>
      </div>
    );
  }

  if (item.kind === 'folder') {
    const isUserCollapsed = collapsedByUser.has(item.folder.path);
    const isExpanded = !isUserCollapsed;
    const isActive = activeFolder === item.folder.path;
    const isDragOver = folderDragOver === item.folder.path;
    const count = docsByFolder[item.folder.path]?.length ?? 0;
    const paddingLeft = 8 + item.depth * 12;

    return (
      <div
        style={style}
        {...ariaAttributes}
        role="treeitem"
        aria-expanded={item.hasChildren ? isExpanded : undefined}
        aria-selected={isActive}
        aria-level={item.depth + 1}
      >
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
          {count > 0 && <span className="text-[10px] text-surface-400">{count}</span>}
        </button>
      </div>
    );
  }

  const docPaddingLeft = 8 + item.depth * 12 + 16;
  const isFavorite = favoriteDocIdSet.has(item.doc.id);
  const isSelected = selectedDocId === item.doc.id || selectedDocsIds.has(item.doc.id);
  return (
    <div
      style={style}
      {...ariaAttributes}
      role="treeitem"
      aria-selected={isSelected}
      aria-level={item.depth + 1}
    >
      <div
        onClick={(e) => handleDocClick(e, index, item.doc)}
        draggable={!isTouchDevice}
        data-drag-doc-id={item.doc.id}
        data-drag-label={item.doc.name}
        onDragStart={!isTouchDevice ? ((e) => handleDocDragStart(e, item.doc)) : undefined}
        onDragEnd={!isTouchDevice ? handleDocDragEnd : undefined}
        {...getDocContextMenuProps(item.doc)}
        className={`group flex items-center gap-2 py-1 px-2 text-xs rounded cursor-pointer select-none transition ${
          isSelected ? 'bg-surface-700 text-white font-medium ring-1 ring-inset ring-surface-500/50' : 'text-surface-400 hover:bg-surface-700/40'
        }`}
        style={{ paddingLeft: docPaddingLeft }}
      >
        <div className={isSelected ? 'text-white' : 'text-surface-500'}>
          {getIcon(item.doc)}
        </div>
        <span className="truncate flex-1">{item.doc.name}</span>
        {isFavorite && (
          <Star className="w-3 h-3 text-amber-300 fill-current shrink-0" />
        )}
        <SidebarDocDragHandle
          doc={item.doc}
          handleDocDragStart={handleDocDragStart}
          handleDocDragEnd={handleDocDragEnd}
          touchHandleVisibilityClass={touchHandleVisibilityClass}
        />
      </div>
    </div>
  );
});

type SidebarListItem =
  | { kind: 'folder'; folder: FolderItem; depth: number; hasChildren: boolean; ancestors: string[] }
  | { kind: 'doc'; doc: DocItem; depth: number; ancestors: string[] }
  | { kind: 'search'; doc: DocItem };

interface SidebarProps {
  sidebarWidth: number;
  isCollapsed: boolean;
  showMobileSidebar: boolean;
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
  // Tree model precomputado en page.tsx (single source of truth). Si no
  // viene, caemos a build local — pero el caso esperado en producción es
  // que llegue como prop para evitar duplicar el build O(N).
  docsByFolder?: Record<string, DocItem[]>;
  folderChildrenMap?: Record<string, FolderItem[]>;
  docById?: Map<string, DocItem>;
  selectedDocId: string | null;
  favoriteDocs: DocItem[];
  favoriteDocIds: string[];
  openDocument: (doc: DocItem) => void;
  onToggleFavorite: (doc: DocItem) => void;
  onMoveFavorite: (docId: string, direction: 'up' | 'down') => void;
  handleDocDragStart: (e: React.DragEvent, doc: DocItem) => void;
  handleDocDragEnd: () => void;
  deleteDocument: (doc: DocItem, e: React.MouseEvent) => void;
  onDeleteDocuments?: (docs: DocItem[]) => void;
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
  onToggleSidebarCollapse,
  currentWorkspace,
  activeFolder,
  setActiveFolder,
  folders,
  loadingDocs,
  docs,
  sidebarSearchQuery,
  setSidebarSearchQuery,
  sidebarFilteredDocs,
  docsByFolder: docsByFolderProp,
  folderChildrenMap: folderChildrenMapProp,
  docById: docByIdProp,
  selectedDocId,
  favoriteDocs,
  favoriteDocIds,
  openDocument,
  onToggleFavorite,
  onMoveFavorite,
  handleDocDragStart,
  handleDocDragEnd,
  deleteDocument,
  onDeleteDocuments,
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
  const isTouchDevice = useIsTouchDeviceProfile();
  const [collapsedByUser, setCollapsedByUser] = useState<Set<string>>(new Set());
  const [selectedDocsIds, setSelectedDocsIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [listRef, listSize] = useElementSize<HTMLDivElement>();
  const { menu: contextMenu, open: openContextMenu, close: closeContextMenu, getTriggerProps: getContextTriggerProps } = useContextMenu<{
    type: 'doc' | 'folder' | 'sidebar';
    id?: string;
    path?: string;
    folder?: FolderItem;
    doc?: DocItem;
  }>();

  const isCollapsedView = isCollapsed && !showMobileSidebar;
  const effectiveWidth = isCollapsedView ? 0 : sidebarWidth;
  const favoriteDocIdSet = useMemo(() => new Set(favoriteDocIds), [favoriteDocIds]);
  const touchHandleVisibilityClass = isTouchDevice ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';
  const iconButtonClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-surface-400 transition hover:bg-surface-700/70 hover:text-surface-100 active:bg-surface-700';

  // Al cambiar de workspace expandimos todos los folders top-level con contenido
  // para que el user vea la jerarquía inmediatamente.
  useEffect(() => {
    setCollapsedByUser(new Set());
  }, [currentWorkspace?.id]);

  const expandFolderPath = useCallback((path: string) => {
    const normalized = normalizeFolderPath(path);
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0) return;

    const paths: string[] = [];
    let current = '';
    segments.forEach(segment => {
      current = current ? `${current}/${segment}` : segment;
      paths.push(current);
    });

    setCollapsedByUser(prev => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      paths.forEach(item => next.delete(item));
      return next;
    });
  }, []);

  // Deferred mount: en React 18 useDeferredValue retorna el valor inicial en
  // el primer render, así que necesitamos un gate explícito. Renderemos un
  // skeleton vacío en el primer paint y, tras un microtask en transition,
  // habilitamos el cómputo del tree real. Esto libera el LCP del walk O(N)
  // de buildWorkspaceTreeModel + flatTree con 1k+ docs.
  const [treeReady, setTreeReady] = useState(false);
  const [, startTreeTransition] = useTransition();

  useEffect(() => {
    if (treeReady) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      startTreeTransition(() => setTreeReady(true));
    };
    if (typeof window === 'undefined') {
      run();
      return;
    }
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(run, { timeout: 200 });
      return () => {
        cancelled = true;
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(handle);
        }
      };
    }
    const id = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [treeReady]);

  const deferredDocs = useDeferredValue(docs);
  const deferredFolders = useDeferredValue(folders);
  const deferredDocsByFolderProp = useDeferredValue(docsByFolderProp);
  const deferredFolderChildrenMapProp = useDeferredValue(folderChildrenMapProp);

  const effectiveDocs = treeReady ? deferredDocs : EMPTY_DOCS;
  const effectiveFolders = treeReady ? deferredFolders : EMPTY_FOLDERS;
  const effectiveDocsByFolderProp = treeReady ? deferredDocsByFolderProp : undefined;
  const effectiveFolderChildrenMapProp = treeReady ? deferredFolderChildrenMapProp : undefined;

  const localTreeModel = useMemo(
    () => (effectiveDocsByFolderProp && effectiveFolderChildrenMapProp)
      ? null
      : buildWorkspaceTreeModel(effectiveFolders, effectiveDocs),
    [effectiveFolders, effectiveDocs, effectiveDocsByFolderProp, effectiveFolderChildrenMapProp]
  );
  const folderChildrenMap = effectiveFolderChildrenMapProp ?? localTreeModel!.folderChildrenMap;
  const docsByFolder = effectiveDocsByFolderProp ?? localTreeModel!.docsByFolder;
  const localDocById = useMemo(() => {
    if (docByIdProp) return null;
    const map = new Map<string, DocItem>();
    for (let i = 0; i < effectiveDocs.length; i += 1) {
      const d = effectiveDocs[i]!;
      map.set(d.id, d);
    }
    return map;
  }, [docByIdProp, effectiveDocs]);
  const docById = docByIdProp ?? localDocById!;

  const isDocsStale = !treeReady
    || docs !== deferredDocs
    || folders !== deferredFolders
    || docsByFolderProp !== deferredDocsByFolderProp
    || folderChildrenMapProp !== deferredFolderChildrenMapProp;

  const collapseAllFolders = useCallback(() => {
    const allPaths: string[] = [];
    Object.values(folderChildrenMap).forEach(list => {
      list.forEach(f => allPaths.push(f.path));
    });
    setCollapsedByUser(new Set(allPaths));
  }, [folderChildrenMap]);

  const toggleFolder = useCallback((path: string) => {
    setCollapsedByUser(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const isSearchMode = sidebarSearchQuery.trim().length > 0;

  useEffect(() => {
    if (isSearchMode) return;
    expandFolderPath(activeFolder);
  }, [activeFolder, isSearchMode, expandFolderPath]);

  // flatTree: lista plana de TODOS los items del árbol con sus ancestros,
  // independiente del estado collapsed. Solo cambia cuando el modelo cambia.
  const flatTree = useMemo<SidebarListItem[]>(() => {
    const items: SidebarListItem[] = [];

    const walk = (parentPath: string, depth: number, ancestors: string[]) => {
      const children = folderChildrenMap[parentPath] ?? [];
      for (let i = 0; i < children.length; i += 1) {
        const folder = children[i]!;
        const subfolders = folderChildrenMap[folder.path] ?? [];
        const folderFiles = docsByFolder[folder.path] ?? [];
        const hasChildren = subfolders.length > 0 || folderFiles.length > 0;
        items.push({ kind: 'folder', folder, depth, hasChildren, ancestors });

        const childAncestors = ancestors.length === 0 ? [folder.path] : [...ancestors, folder.path];
        walk(folder.path, depth + 1, childAncestors);
        for (let j = 0; j < folderFiles.length; j += 1) {
          items.push({ kind: 'doc', doc: folderFiles[j]!, depth: depth + 1, ancestors: childAncestors });
        }
      }
    };

    walk('', 0, []);
    const rootDocs = docsByFolder[''] ?? [];
    for (let i = 0; i < rootDocs.length; i += 1) {
      items.push({ kind: 'doc', doc: rootDocs[i]!, depth: 0, ancestors: [] });
    }
    return items;
  }, [docsByFolder, folderChildrenMap]);

  // visibleItems: filtrado O(F) por collapsed. Toggle ya no rebuildea el árbol
  // entero — solo filtra el flatTree precomputado con un set lookup.
  const visibleItems = useMemo<SidebarListItem[]>(() => {
    if (collapsedByUser.size === 0) return flatTree;
    return flatTree.filter(item => {
      if (item.kind === 'search') return true;
      return !item.ancestors.some(ancestor => collapsedByUser.has(ancestor));
    });
  }, [flatTree, collapsedByUser]);

  const listItems = useMemo<SidebarListItem[]>(() => {
    if (isSearchMode) {
      return sidebarFilteredDocs.map(doc => ({ kind: 'search', doc }));
    }
    return visibleItems;
  }, [isSearchMode, sidebarFilteredDocs, visibleItems]);

  const handleDocClick = useCallback((e: React.MouseEvent, index: number, doc: DocItem) => {
    if (e.shiftKey && lastSelectedIndex !== null) {
      e.preventDefault();
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const newSelected = new Set(selectedDocsIds);
      if (!e.ctrlKey && !e.metaKey) {
        newSelected.clear();
      }
      for (let i = start; i <= end; i++) {
        const rowItem = listItems[i];
        if (rowItem && (rowItem.kind === 'doc' || rowItem.kind === 'search')) {
          newSelected.add(rowItem.doc.id);
        }
      }
      setSelectedDocsIds(newSelected);
    } else if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const newSelected = new Set(selectedDocsIds);
      if (newSelected.has(doc.id)) {
        newSelected.delete(doc.id);
      } else {
        newSelected.add(doc.id);
      }
      setSelectedDocsIds(newSelected);
      setLastSelectedIndex(index);
    } else {
      setSelectedDocsIds(new Set([doc.id]));
      setLastSelectedIndex(index);
      openDocument(doc);
    }
  }, [lastSelectedIndex, listItems, openDocument, selectedDocsIds]);

  const getDocContextMenuProps = useCallback((doc: DocItem) => {
    return {
      onContextMenu: (e: React.MouseEvent) => {
        if (!selectedDocsIds.has(doc.id)) {
          setSelectedDocsIds(new Set([doc.id]));
        }
        getContextTriggerProps({ type: 'doc', id: doc.id, doc }).onContextMenu?.(e);
      }
    };
  }, [getContextTriggerProps, selectedDocsIds]);

  const sidebarRowProps = useMemo<SidebarRowProps>(() => ({
    listItems,
    selectedDocId,
    selectedDocsIds,
    favoriteDocIdSet,
    collapsedByUser,
    activeFolder,
    folderDragOver,
    docsByFolder,
    isTouchDevice,
    touchHandleVisibilityClass,
    getIcon,
    handleDocClick,
    handleDocDragStart,
    handleDocDragEnd,
    getDocContextMenuProps,
    setActiveFolder,
    toggleFolder,
    onFolderDragOver,
    onFolderDrop,
    onFolderDragLeave,
    getContextTriggerProps
  }), [
    listItems,
    selectedDocId,
    selectedDocsIds,
    favoriteDocIdSet,
    collapsedByUser,
    activeFolder,
    folderDragOver,
    docsByFolder,
    isTouchDevice,
    touchHandleVisibilityClass,
    getIcon,
    handleDocClick,
    handleDocDragStart,
    handleDocDragEnd,
    getDocContextMenuProps,
    setActiveFolder,
    toggleFolder,
    onFolderDragOver,
    onFolderDrop,
    onFolderDragLeave,
    getContextTriggerProps
  ]);

  return (
    <>
      <div
        style={{
          width: effectiveWidth,
          contentVisibility: isCollapsedView ? 'hidden' : 'visible'
        }}
        className={`
          bg-surface-800 border-r border-surface-600/50 flex flex-col shrink-0 h-full
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
            <div className="flex items-center justify-between gap-1 px-2 py-1.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-surface-500" title={currentWorkspace?.name ? `Archivos: ${currentWorkspace.name}` : 'Archivos'}>
                {loadingDocs ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Folder className="h-5 w-5 text-amber-400" />
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                {onCreateDoc && (
                  <button
                    type="button"
                    onClick={onCreateDoc}
                    className={iconButtonClass}
                    title="Nuevo archivo"
                    aria-label="Nuevo archivo"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                )}
                {onCreateFolder && (
                  <button
                    type="button"
                    onClick={onCreateFolder}
                    className={iconButtonClass}
                    title="Nueva carpeta"
                    aria-label="Nueva carpeta"
                  >
                    <FolderPlus className="h-5 w-5" />
                  </button>
                )}
                {onUploadFile && (
                  <button
                    type="button"
                    onClick={onUploadFile}
                    className={iconButtonClass}
                    title="Subir archivos"
                    aria-label="Subir archivos"
                  >
                    <Upload className="h-5 w-5" />
                  </button>
                )}
                {onUploadFolder && (
                  <button
                    type="button"
                    onClick={onUploadFolder}
                    className={iconButtonClass}
                    title="Subir carpeta"
                    aria-label="Subir carpeta"
                  >
                    <FolderUp className="h-5 w-5" />
                  </button>
                )}
              </div>
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
              <div className="flex items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
                  <input
                    type="text"
                    value={sidebarSearchQuery}
                    onChange={e => setSidebarSearchQuery(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full rounded-md border border-surface-700 bg-surface-800 py-2 pl-8 pr-10 text-sm text-white placeholder-surface-500 outline-none transition focus:border-mandy-500/50"
                  />
                  {sidebarSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSidebarSearchQuery('')}
                      className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-surface-500 transition hover:bg-surface-700/70 hover:text-surface-200"
                      title="Limpiar busqueda"
                      aria-label="Limpiar busqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={collapseAllFolders}
                  className={iconButtonClass}
                  title="Contraer toda la jerarquia"
                  aria-label="Contraer toda la jerarquia"
                >
                  <ListCollapse className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-2 px-1 flex-1 min-h-0 relative">
              {(loadingDocs && docs.length === 0) || (isDocsStale && docs.length > 0 && !isSearchMode) ? (
                <div className="h-full min-h-[200px] flex items-start justify-center pt-6">
                  <div className="flex items-center gap-2 text-xs text-surface-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Cargando archivos...
                  </div>
                </div>
              ) : null}

              {!loadingDocs && docs.length === 0 && !isSearchMode && !isDocsStale && (
                <div className="h-full min-h-[200px] flex items-start justify-center pt-6">
                  <div className="text-xs text-surface-500">Espacio vacío</div>
                </div>
              )}

              {isSearchMode && sidebarFilteredDocs.length === 0 && (
                <div className="h-full min-h-[200px] flex items-start justify-center pt-6">
                  <div className="text-xs text-surface-500">Sin resultados</div>
                </div>
              )}

              {listItems.length > 0 && !isDocsStale && (
                <div ref={listRef} className="h-full min-h-[200px]" role="tree" aria-label="Árbol de archivos">
                  {listSize.height > 0 && listSize.width > 0 ? (
                    <VirtualizedList
                      rowCount={listItems.length}
                      rowHeight={ROW_HEIGHT}
                      overscanCount={6}
                      className="scrollbar-hide"
                      style={{ height: listSize.height, width: listSize.width }}
                      rowComponent={SidebarRow as unknown as (props: SidebarRowComponentProps) => React.ReactElement | null}
                      rowProps={sidebarRowProps}
                    />
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-surface-600/50 bg-surface-800 text-xs text-surface-500 flex justify-between items-center">
          <span>{sidebarSearchQuery ? `${sidebarFilteredDocs.length} de ${docs.length}` : `${docs.length} archivos`}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onToggleSidebarCollapse}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-surface-400 transition hover:bg-surface-700/70 hover:text-surface-200"
              title="Ocultar panel de archivos (Ctrl+B)"
              aria-label="Ocultar panel de archivos"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          sections={contextMenu.data.type === 'doc' ? selectedDocsIds.size > 1 ? [
            {
              actions: [
                {
                  label: `Fijar en favoritos (${selectedDocsIds.size})`,
                  icon: <Star className="w-4 h-4" />,
                  onClick: () => {
                    const toFavorite = Array.from(selectedDocsIds);
                    toFavorite.forEach(id => {
                      const doc = docById.get(id);
                      if (doc && !favoriteDocIdSet.has(doc.id)) onToggleFavorite(doc);
                    });
                  }
                },
                ...(onDownloadDoc ? [{
                  label: `Descargar (${selectedDocsIds.size})`,
                  icon: <Download className="w-4 h-4" />,
                  onClick: () => {
                    const toDownload = Array.from(selectedDocsIds);
                    toDownload.forEach(id => {
                      const doc = docById.get(id);
                      if (doc) onDownloadDoc(doc);
                    });
                  }
                }] : [])
              ]
            },
            {
              actions: [
                {
                  label: `Eliminar (${selectedDocsIds.size})`,
                  icon: <Trash2 className="w-4 h-4" />,
                  onClick: () => {
                    if (onDeleteDocuments) {
                        const selectedDocsItems: DocItem[] = [];
                        selectedDocsIds.forEach(id => {
                          const d = docById.get(id);
                          if (d) selectedDocsItems.push(d);
                        });
                        onDeleteDocuments(selectedDocsItems);
                        setSelectedDocsIds(new Set());
                    } else {
                        Array.from(selectedDocsIds).forEach(id => {
                            const doc = docById.get(id);
                            if (doc) deleteDocument(doc, { stopPropagation: () => {} } as React.MouseEvent);
                        });
                        setSelectedDocsIds(new Set());
                    }
                  },
                  destructive: true
                }
              ]
            }
          ] : [
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
