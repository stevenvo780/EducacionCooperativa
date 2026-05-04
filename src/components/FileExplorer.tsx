'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { markInternalDragStart, markInternalDragEnd } from '@/lib/internal-drag-flag';
import { List as VirtualizedList, type RowComponentProps } from 'react-window';
import {
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  ChevronRight,
  ChevronDown,
  Cloud,
  CloudOff,
  Upload,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  Copy,
  FolderInput,
  Pencil,
  GripVertical,
  Download,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  ListCollapse,
  Star,
  X,
  Code
} from 'lucide-react';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath } from '@/lib/folder-utils';
import { buildWorkspaceTreeModel } from '@/lib/workspace-tree-model';
import { MAX_FAVORITE_DOCS } from '@/services/dashboardPersistence';
import { useContextMenu } from '@/hooks/useContextMenu';
import { FileExplorerContextMenu } from '@/components/file-explorer/FileExplorerContextMenu';
import FilePropertiesModal from '@/components/file-explorer/FilePropertiesModal';
import { useFileExplorerDND, DOC_REORDER_TYPE, FOLDER_REORDER_TYPE } from '@/components/file-explorer/useFileExplorerDND';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';
import { useIsTouchDeviceProfile } from '@/lib/device-input';
import { useElementSize } from '@/hooks/useElementSize';

export type { DocItem, FolderItem } from '@/types/document-item';
import type { DocItem, FolderItem } from '@/types/document-item';

type ContentItem =
  | { kind: 'folder'; folder: FolderItem }
  | { kind: 'doc'; doc: DocItem };

const CONTENT_ROW_HEIGHT = 52;

interface FileExplorerProps {
  docs: DocItem[];
  folders: FolderItem[];
  onSelectDoc: (doc: DocItem) => void;
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
  onDownloadDoc?: (doc: DocItem) => void;
  favoriteDocIds?: string[];
  onToggleFavorite?: (doc: DocItem) => void;
  onDownloadFolder?: (folderPath: string) => void;
  onReorderDocs?: (payload: { folderPath: string; orderedIds: string[] }) => void;
  onReorderFolders?: (payload: { parentPath: string; orderedPaths: string[] }) => void;
  currentWorkspaceName?: string;
  currentWorkspaceId?: string;
  embedded?: boolean;
  activeFolder?: string;
  onActiveFolderChange?: (folderPath: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  docs,
  folders,
  onSelectDoc,
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
  onDownloadDoc,
  favoriteDocIds = [],
  onToggleFavorite,
  onDownloadFolder,
  onReorderDocs,
  onReorderFolders,
  currentWorkspaceName = 'Espacio Personal',
  currentWorkspaceId,
  embedded = false,
  activeFolder: activeFolderProp,
  onActiveFolderChange
}) => {
  const isTouchDevice = useIsTouchDeviceProfile();
  const favoriteDocIdSet = useMemo(() => new Set(favoriteDocIds), [favoriteDocIds]);

  const resolveActiveFolder = (value?: string) => {
    if (value === '') return '';
    if (value === undefined || value === null) return DEFAULT_FOLDER_NAME;
    return normalizeFolderPath(value);
  };

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([DEFAULT_FOLDER_NAME]));
  const [activeFolder, setActiveFolder] = useState(resolveActiveFolder(activeFolderProp));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const { menu: contextMenu, open: openContextMenu, close: closeContextMenu, getTriggerProps: getContextTriggerProps } = useContextMenu<{
    type: 'doc' | 'folder';
    id?: string;
    path?: string;
    folder?: FolderItem;
    doc?: DocItem;
  }>();
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [contentListRef, contentListSize] = useElementSize<HTMLDivElement>();
  const lastSelectedIndex = useRef<number>(-1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [_overflowMenuId, _setOverflowMenuId] = useState<string | null>(null);
  const [downloadingFolder, setDownloadingFolder] = useState<string | null>(null);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const toolbarMenuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const normalizedDocs = useMemo(() => {
    return docs.map(doc => ({ ...doc, folder: normalizeFolderPath(doc.folder) }));
  }, [docs]);

  // Track container width for responsive layout
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(entries => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const w = entries[0]?.contentRect.width ?? 800;
        setContainerWidth(w);
      }, 150);
    });
    ro.observe(node);
    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, []);

  // Auto-collapse sidebar when panel is narrow
  const isCompact = containerWidth < 550;
  const isUltraCompact = containerWidth < 380;
  const touchHandleVisibilityClass = isTouchDevice ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';
  const toolbarIconButtonClass = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-surface-400 transition hover:bg-surface-700 hover:text-surface-200 active:bg-surface-700';

  // Auto-collapse sidebar when embedded in Mosaic and compact
  useEffect(() => {
    if (embedded && isCompact) {
      setSidebarCollapsed(true);
    }
  }, [embedded, isCompact]);

  // Close toolbar menu on click outside
  useEffect(() => {
    if (!toolbarMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (toolbarMenuRef.current && !toolbarMenuRef.current.contains(e.target as Node)) {
        setToolbarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [toolbarMenuOpen]);

  const { effectiveFolders, folderChildrenMap, docsByFolder } = useMemo(
    () => buildWorkspaceTreeModel(folders, normalizedDocs),
    [folders, normalizedDocs]
  );

  const activeChildFolders = useMemo(() => {
    return folderChildrenMap[activeFolder] ?? [];
  }, [folderChildrenMap, activeFolder]);

  const activeFolderDocs = useMemo(() => {
    return docsByFolder[activeFolder] ?? [];
  }, [docsByFolder, activeFolder]);

  const filteredChildFolders = useMemo(() => {
    if (!searchQuery.trim()) return activeChildFolders;
    const query = searchQuery.toLowerCase();
    // Cuando hay búsqueda, buscar en TODAS las carpetas
    return effectiveFolders.filter(folder => folder.name.toLowerCase().includes(query));
  }, [activeChildFolders, effectiveFolders, searchQuery]);

  const filteredFolderDocs = useMemo(() => {
    if (!searchQuery.trim()) return activeFolderDocs;
    const query = searchQuery.toLowerCase();
    // Cuando hay búsqueda, buscar en TODOS los documentos
    return normalizedDocs.filter(doc => doc.name.toLowerCase().includes(query));
  }, [activeFolderDocs, normalizedDocs, searchQuery]);

  const contentItems = useMemo<ContentItem[]>(() => {
    const items: ContentItem[] = [];
    filteredChildFolders.forEach(folder => items.push({ kind: 'folder', folder }));
    filteredFolderDocs.forEach(doc => items.push({ kind: 'doc', doc }));
    return items;
  }, [filteredChildFolders, filteredFolderDocs]);

  const canReorderDocs = !!onReorderDocs && !searchQuery.trim();
  const canReorderFolders = !!onReorderFolders && !searchQuery.trim() && filteredChildFolders.every(folder => !!folder.docId);

  const docIndexMap = useMemo(() => {
    return new Map(filteredFolderDocs.map((doc, index) => [doc.id, index]));
  }, [filteredFolderDocs]);

  const folderIndexMap = useMemo(() => {
    return new Map(filteredChildFolders.map((folder, index) => [folder.path, index]));
  }, [filteredChildFolders]);

  const docMap = useMemo(() => {
    return new Map(normalizedDocs.map(doc => [doc.id, doc]));
  }, [normalizedDocs]);

  const folderMap = useMemo(() => {
    return new Map(effectiveFolders.map(folder => [folder.path, folder]));
  }, [effectiveFolders]);

  const selectedDocIds = useMemo(() => {
    return Array.from(selectedKeys)
      .filter(key => key.startsWith('doc:'))
      .map(key => key.replace('doc:', ''))
      .filter(id => docMap.has(id));
  }, [selectedKeys, docMap]);

  const selectedFolderPaths = useMemo(() => {
    return Array.from(selectedKeys)
      .filter(key => key.startsWith('folder:'))
      .map(key => key.replace('folder:', ''))
      .filter(path => folderMap.has(path));
  }, [selectedKeys, folderMap]);

  const hasSelection = selectedDocIds.length > 0 || selectedFolderPaths.length > 0;

  const resolvedActiveFolderProp = useMemo(() => resolveActiveFolder(activeFolderProp), [activeFolderProp]);

  useEffect(() => {
    if (activeFolderProp === undefined) return;
    if (resolvedActiveFolderProp !== activeFolder) {
      setActiveFolder(resolvedActiveFolderProp);
    }
  }, [activeFolderProp, resolvedActiveFolderProp, activeFolder]);

  const expandFolderPath = useCallback((path: string) => {
    const normalized = normalizeFolderPath(path);
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length === 0) return;

    setExpandedFolders(prev => {
      const next = new Set(prev);
      let current = '';
      segments.forEach(segment => {
        current = current ? `${current}/${segment}` : segment;
        next.add(current);
      });
      return next;
    });
  }, []);

  const collapseAllFolders = useCallback(() => {
    setExpandedFolders(new Set());
  }, []);

  useEffect(() => {
    expandFolderPath(activeFolder);
  }, [activeFolder, expandFolderPath]);

  useEffect(() => {
    if (activeFolder === '') return;
    if (!effectiveFolders.length) return;
    const exists = effectiveFolders.some(folder => folder.path === activeFolder);
    if (!exists) {
      const rootFolders = folderChildrenMap[''] ?? [];
      const fallback = rootFolders[0]?.path || DEFAULT_FOLDER_NAME;
      setActiveFolder(fallback);
      onActiveFolderChange?.(fallback);
    }
  }, [effectiveFolders, folderChildrenMap, activeFolder, onActiveFolderChange]);

  useEffect(() => {
    setSelectedKeys(new Set());
    lastSelectedIndex.current = -1;
  }, [activeFolder, searchQuery]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getFileIcon = (doc?: DocItem) => {
    if (!doc) return <FileIcon className="w-4 h-4 text-slate-400" />;

    const mimeType = doc.mimeType || '';
    if (mimeType.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4 text-purple-400" />;
    }
    if (doc.name.endsWith('.md') || doc.type === 'text') {
      return <FileText className="w-4 h-4 text-sky-400" />;
    }
    return <FileIcon className="w-4 h-4 text-slate-400" />;
  };

  const getDocBadge = (doc: DocItem) => {
    if (doc.type === 'file') {
      const segments = doc.name.split('.');
      const ext = segments.length > 1 ? segments.pop() : undefined;
      const badge = ext ? ext.toUpperCase() : 'FILE';
      return badge.length > 4 ? badge.slice(0, 4) : badge;
    }
    return doc.name.toLowerCase().endsWith('.md') ? 'MD' : 'DOC';
  };

  const isDocUploaded = (doc: DocItem) => {
    if (doc.type === 'file') {
      return Boolean(doc.storagePath || doc.url);
    }
    if (doc.type === 'text' || doc.type === undefined) {
      return Boolean(doc.storagePath);
    }
    return true;
  };

  const handleContextMenu = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const doc = docMap.get(docId);
    openContextMenu(e.clientX, e.clientY, { type: 'doc', id: docId, doc });
  };

  const toggleSelection = (key: string, e?: React.MouseEvent | React.ChangeEvent) => {
    e?.stopPropagation();
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const setSingleSelection = (key: string) => {
    setSelectedKeys(new Set([key]));
  };

  const handleSelectAll = useCallback(() => {
    const allKeys = new Set<string>();
    contentItems.forEach(item => {
      if (item.kind === 'folder') allKeys.add(`folder:${item.folder.path}`);
      else allKeys.add(`doc:${item.doc.id}`);
    });

    const allVisibleSelected = contentItems.length > 0 && contentItems.every(item => {
       const key = item.kind === 'folder' ? `folder:${item.folder.path}` : `doc:${item.doc.id}`;
       return selectedKeys.has(key);
    });

    if (allVisibleSelected) {
       setSelectedKeys(new Set());
    } else {
       setSelectedKeys(allKeys);
    }
  }, [contentItems, selectedKeys]);

  const handleFolderSelect = (folder: FolderItem, index: number, e: React.MouseEvent) => {
    const key = `folder:${folder.path}`;

    if (e.shiftKey && lastSelectedIndex.current !== -1) {
       const start = Math.min(lastSelectedIndex.current, index);
       const end = Math.max(lastSelectedIndex.current, index);
       const nextKeys = new Set(selectedKeys);

       for (let i = start; i <= end; i++) {
          const item = contentItems[i];
          if (item.kind === 'folder') nextKeys.add(`folder:${item.folder.path}`);
          else nextKeys.add(`doc:${item.doc.id}`);
       }
       setSelectedKeys(nextKeys);
       return;
    }

    if (e.metaKey || e.ctrlKey) {
      toggleSelection(key, e);
      lastSelectedIndex.current = index;
      return;
    }

    setSingleSelection(key);
    lastSelectedIndex.current = index;
  };

  const handleFolderDoubleClick = (folder: FolderItem) => {
      setActiveFolder(folder.path);
      onActiveFolderChange?.(folder.path);
      setExpandedFolders(prev => new Set(prev).add(folder.path));
  };

  const handleDocSelect = (doc: DocItem, index: number, e: React.MouseEvent) => {
    const key = `doc:${doc.id}`;

    if (e.shiftKey && lastSelectedIndex.current !== -1) {
         const start = Math.min(lastSelectedIndex.current, index);
         const end = Math.max(lastSelectedIndex.current, index);
         const nextKeys = new Set(selectedKeys);
         for (let i = start; i <= end; i++) {
            const item = contentItems[i];
            if (item.kind === 'folder') nextKeys.add(`folder:${item.folder.path}`);
            else nextKeys.add(`doc:${item.doc.id}`);
         }
         setSelectedKeys(nextKeys);
         return;
    }

    if (e.metaKey || e.ctrlKey) {
      toggleSelection(key, e);
      lastSelectedIndex.current = index;
      return;
    }

    setSingleSelection(key);
    lastSelectedIndex.current = index;
  };

  const handleDocDoubleClick = (doc: DocItem) => {
    onSelectDoc(doc);
  };

  const handleOpenDoc = (doc: DocItem) => {
    onSelectDoc(doc);
  };

  const [propertiesDoc, setPropertiesDoc] = useState<DocItem | null>(null);

  const handleShowProperties = (doc: DocItem) => setPropertiesDoc(doc);

  const handleCopyPath = async (doc: DocItem) => {
    const folder = doc.folder ? `${doc.folder}/` : '';
    const path = `${folder}${doc.name ?? 'untitled'}`;
    try { await navigator.clipboard.writeText(path); } catch { /* noop */ }
  };

  const handleOpenInForgejo = (doc: DocItem) => {
    const repoFullName = (doc as unknown as { git?: { repoFullName?: string } }).git?.repoFullName;
    if (!repoFullName) return;
    const folder = doc.folder ? `${doc.folder}/` : '';
    const repoPath = encodeURI(`${folder}${doc.name ?? ''}`).replace(/'/g, '%27');
    const apiBase = process.env.NEXT_PUBLIC_FORGEJO_WEB_URL ?? 'https://git.proxy.humanizar-dev.cloud';
    window.open(`${apiBase}/${repoFullName}/src/branch/main/${repoPath}`, '_blank', 'noopener,noreferrer');
  };

  const handleMoveDoc = (doc: DocItem) => {
    if (!onMoveDoc) return;
    const current = normalizeFolderPath(doc.folder);
    const target = prompt('Mover a carpeta', current);
    if (!target) return;
    onMoveDoc(doc.id, target);
  };

  const handleRenameDoc = (doc: DocItem) => {
    if (!onRenameDoc) return;
    onRenameDoc(doc);
  };

  const handleToggleFavorite = (doc: DocItem) => {
    onToggleFavorite?.(doc);
  };

  const handleDeleteSelected = () => {
    if (!hasSelection) return;
    if (onDeleteItems) {
      onDeleteItems({ docIds: selectedDocIds, folderPaths: selectedFolderPaths });
      setSelectedKeys(new Set());
      return;
    }
    selectedFolderPaths.forEach(path => {
      const folder = folderMap.get(path);
      if (folder && onDeleteFolder) onDeleteFolder(folder);
    });
    selectedDocIds.forEach(docId => onDeleteDoc?.(docId));
    setSelectedKeys(new Set());
  };

  const { reorderDocs, reorderFolders, getDropPosition } = useFileExplorerDND({
    canReorderDocs,
    canReorderFolders,
    docIndexMap,
    folderIndexMap,
    filteredFolderDocs,
    filteredChildFolders,
    activeFolder,
    onReorderDocs,
    onReorderFolders
  });

  const renderContentRow = ({ index, style }: RowComponentProps) => {
    const item = contentItems[index];
    if (!item) return null;
    const rowStyle = {
      ...style,
      paddingLeft: 16,
      paddingRight: 16
    } as React.CSSProperties;

    if (item.kind === 'folder') {
      const folder = item.folder;
      const isSelected = selectedKeys.has(`folder:${folder.path}`);
      const count = docsByFolder[folder.path]?.length ?? 0;
      return (
        <div style={rowStyle}>
          <div
            onClick={(e) => handleFolderSelect(folder, index, e)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleFolderDoubleClick(folder);
            }}
            {...getContextTriggerProps({ type: 'folder', path: folder.path, folder })}
            onDragOver={(e) => {
              const types = Array.from(e.dataTransfer.types ?? []);
              const hasFolderType = types.includes(FOLDER_REORDER_TYPE);
              const hasDocType = types.includes(DOC_REORDER_TYPE);

              if (hasDocType && onMoveDoc) {
                 e.preventDefault();
                 e.stopPropagation();
                 setDragOverKey(`folder:${folder.path}`);
                 setDragOverPosition(null); // Inside
                 e.dataTransfer.dropEffect = 'move';
                 return;
              }

              if (!canReorderFolders || !hasFolderType) return;
              e.preventDefault();
              e.stopPropagation();
              setDragOverKey(`folder:${folder.path}`);
              setDragOverPosition(getDropPosition(e));
              e.dataTransfer.dropEffect = 'move';
            }}
            onDragEnd={() => {
              setDragOverKey(null);
              setDragOverPosition(null);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOverKey(prev => (prev === `folder:${folder.path}` ? null : prev));
              setDragOverPosition(null);
            }}
            onDrop={(e) => {
              const types = Array.from(e.dataTransfer.types ?? []);

              if (types.includes(DOC_REORDER_TYPE) && onMoveDoc) {
                  e.preventDefault();
                  e.stopPropagation();
                  const dragId = e.dataTransfer.getData(DOC_REORDER_TYPE);
                  if (dragId) {
                      onMoveDoc(dragId, folder.path);
                  }
                  setDragOverKey(null);
                  setDragOverPosition(null);
                  return;
              }

              if (!types.includes(FOLDER_REORDER_TYPE)) return;
              e.preventDefault();
              e.stopPropagation();
              const dragPath = e.dataTransfer.getData(FOLDER_REORDER_TYPE);
              if (dragPath) {
                const placeAfter = getDropPosition(e) === 'after';
                reorderFolders(dragPath, folder.path, placeAfter);
              }
              setDragOverKey(null);
              setDragOverPosition(null);
            }}
            className={`group flex items-center gap-3 px-3 py-2 rounded-lg border transition cursor-pointer relative ${
              isSelected ? 'border-mandy-500/50 bg-mandy-500/10 text-mandy-300' : 'border-surface-800/80 bg-surface-800/30 hover:bg-surface-800/60 hover:border-surface-600/80'
            } ${dragOverKey === `folder:${folder.path}` ? 'ring-1 ring-mandy-400/60' : ''} ${
              dragOverKey === `folder:${folder.path}` && dragOverPosition === 'before'
                ? 'before:absolute before:left-3 before:right-3 before:top-0 before:h-0.5 before:bg-mandy-400'
                : dragOverKey === `folder:${folder.path}` && dragOverPosition === 'after'
                  ? 'after:absolute after:left-3 after:right-3 after:bottom-0 after:h-0.5 after:bg-mandy-400'
                  : ''
            }`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => toggleSelection(`folder:${folder.path}`, e)}
              className="accent-mandy-500"
              title="Seleccionar carpeta"
            />
            <Folder className="w-4 h-4 text-surface-500" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold truncate">{folder.name}</span>
              {!isUltraCompact && <span className="text-[11px] text-surface-500 truncate">{folder.path}</span>}
            </div>
            <span className="text-[10px] text-surface-500">{count}</span>
            <div className={`ml-auto flex items-center gap-1 ${isCompact ? '' : 'gap-2'}`}>
              {canReorderFolders && folder.docId && !isUltraCompact && (
                <button
                  draggable
                  data-drag-label={`Reordenar carpeta ${folder.name}`}
                  data-disable-context-menu-trigger="true"
                  onDragStart={(e) => {
                    e.stopPropagation();
                    markInternalDragStart();
                    e.dataTransfer.setData('application/x-dashboard-internal-drag', 'folder-reorder');
                    e.dataTransfer.setData(FOLDER_REORDER_TYPE, folder.path);
                    e.dataTransfer.setData('text/plain', folder.path);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={(e) => {
                    e.stopPropagation();
                    markInternalDragEnd();
                    setDragOverKey(null);
                    setDragOverPosition(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`touch-none p-1 rounded-md text-surface-500 hover:text-surface-100 hover:bg-surface-700/70 transition ${touchHandleVisibilityClass} cursor-grab active:cursor-grabbing`}
                  title="Reordenar carpeta"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
              )}
              {onDownloadFolder && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDownloadingFolder(folder.path);
                    onDownloadFolder(folder.path);
                    setTimeout(() => setDownloadingFolder(null), 5000);
                  }}
                  disabled={downloadingFolder === folder.path}
                  className={`p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition ${isCompact ? '' : 'opacity-0 group-hover:opacity-100'}`}
                  title="Descargar carpeta"
                >
                  {downloadingFolder === folder.path
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Download className="w-3.5 h-3.5" />
                  }
                </button>
              )}
              {onDeleteFolder && folder.kind !== 'system' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(folder);
                  }}
                  className={`p-1 rounded-md text-surface-400 hover:text-mandy-400 hover:bg-mandy-500/10 transition ${isCompact ? '' : 'opacity-0 group-hover:opacity-100'}`}
                  title="Eliminar carpeta"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    const doc = item.doc;
    const key = `doc:${doc.id}`;
    const isSelected = selectedKeys.has(key);
    const isFavorite = favoriteDocIdSet.has(doc.id);
    const uploaded = isDocUploaded(doc);
    const SyncIcon = uploaded ? Cloud : CloudOff;
    const syncLabel = uploaded ? 'Subido' : 'Pendiente';
    const syncTitle = uploaded ? 'Contenido subido' : 'Pendiente de subir';
    return (
      <div style={rowStyle}>
        <div
          onClick={(e) => handleDocSelect(doc, index, e)}
          onDoubleClick={() => handleDocDoubleClick(doc)}
          {...getContextTriggerProps({ type: 'doc', id: doc.id, doc })}
          onDragOver={(e) => {
            const types = Array.from(e.dataTransfer.types ?? []);
            if (!canReorderDocs || !types.includes(DOC_REORDER_TYPE)) return;
            e.preventDefault();
            e.stopPropagation();
            setDragOverKey(`doc:${doc.id}`);
            setDragOverPosition(getDropPosition(e));
            e.dataTransfer.dropEffect = 'move';
          }}
          onDragEnd={() => {
            setDragOverKey(null);
            setDragOverPosition(null);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverKey(prev => (prev === `doc:${doc.id}` ? null : prev));
            setDragOverPosition(null);
          }}
          onDrop={(e) => {
            const types = Array.from(e.dataTransfer.types ?? []);
            if (!types.includes(DOC_REORDER_TYPE)) return;
            e.preventDefault();
            e.stopPropagation();
            const dragId = e.dataTransfer.getData(DOC_REORDER_TYPE);
            if (dragId) {
              const placeAfter = getDropPosition(e) === 'after';
              reorderDocs(dragId, doc.id, placeAfter);
            }
            setDragOverKey(null);
            setDragOverPosition(null);
          }}
          className={`group flex items-center gap-3 px-3 py-2 rounded-lg border transition cursor-pointer relative ${
            isSelected ? 'border-mandy-500/50 bg-mandy-500/10 text-mandy-300' : 'border-surface-800/80 bg-surface-800/30 hover:bg-surface-800/60 hover:border-surface-600/80'
          } ${dragOverKey === `doc:${doc.id}` ? 'ring-1 ring-mandy-400/60' : ''} ${
            dragOverKey === `doc:${doc.id}` && dragOverPosition === 'before'
              ? 'before:absolute before:left-3 before:right-3 before:top-0 before:h-0.5 before:bg-mandy-400'
              : dragOverKey === `doc:${doc.id}` && dragOverPosition === 'after'
                ? 'after:absolute after:left-3 after:right-3 after:bottom-0 after:h-0.5 after:bg-mandy-400'
                : ''
          }`}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => toggleSelection(key, e)}
            className="accent-mandy-500"
            title="Seleccionar archivo"
          />
          <div className="text-surface-500">{getFileIcon(doc)}</div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold truncate">{doc.name}</span>
            {!isUltraCompact && <span className="text-[11px] text-surface-500 truncate">{doc.folder || DEFAULT_FOLDER_NAME}</span>}
          </div>
          {!isUltraCompact && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-300 uppercase">
              {getDocBadge(doc)}
            </span>
          )}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(doc);
              }}
              className={`p-1 rounded-md transition ${
                isFavorite
                  ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/10'
                  : 'text-surface-500 hover:text-amber-300 hover:bg-surface-700/70'
              }`}
              title={isFavorite ? 'Quitar de favoritos' : `Fijar en favoritos (${MAX_FAVORITE_DOCS} máx.)`}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}
          {!isCompact && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                uploaded
                  ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                  : 'border-amber-500/40 text-amber-300 bg-amber-500/10'
              }`}
              title={syncTitle}
            >
              <SyncIcon className="w-3 h-3" />
              <span>{syncLabel}</span>
            </span>
          )}
          {/* Actions: responsive overflow menu for compact, inline for wide */}
          {isCompact ? (
            <div className="ml-auto relative flex items-center gap-1">
              {canReorderDocs && (
                <button
                  draggable
                  data-drag-label={`Reordenar ${doc.name}`}
                  data-disable-context-menu-trigger="true"
                  onDragStart={(e) => {
                    e.stopPropagation();
                    markInternalDragStart();
                    e.dataTransfer.setData('application/x-dashboard-internal-drag', 'doc-reorder');
                    e.dataTransfer.setData(DOC_REORDER_TYPE, doc.id);
                    e.dataTransfer.setData('text/plain', doc.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={(e) => {
                    e.stopPropagation();
                    markInternalDragEnd();
                    setDragOverKey(null);
                    setDragOverPosition(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="touch-none p-1 rounded-md text-surface-500 hover:text-surface-100 hover:bg-surface-700/70 transition cursor-grab active:cursor-grabbing"
                  title="Reordenar archivo"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDoc(doc);
                }}
                className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
                title="Abrir"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
              {onDownloadDoc && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDownloadDoc(doc); }}
                  className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
                  title="Descargar"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleContextMenu(e, doc.id); }}
                className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
                title="Más acciones"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDoc(doc);
              }}
              className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
              title="Abrir"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            {canReorderDocs && (
              <button
                draggable
                data-drag-label={`Reordenar ${doc.name}`}
                data-disable-context-menu-trigger="true"
                onDragStart={(e) => {
                  e.stopPropagation();
                  markInternalDragStart();
                  e.dataTransfer.setData('application/x-dashboard-internal-drag', 'doc-reorder');
                  e.dataTransfer.setData(DOC_REORDER_TYPE, doc.id);
                  e.dataTransfer.setData('text/plain', doc.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  markInternalDragEnd();
                  setDragOverKey(null);
                  setDragOverPosition(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className={`touch-none p-1 rounded-md text-surface-500 hover:text-surface-100 hover:bg-surface-700/70 transition ${touchHandleVisibilityClass} cursor-grab active:cursor-grabbing`}
                title="Reordenar archivo"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}
            {onDuplicateDoc && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicateDoc(doc);
                }}
                className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
                title="Duplicar"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {onDownloadDoc && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadDoc(doc);
                }}
                className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
                title="Descargar"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            {onRenameDoc && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameDoc(doc);
                }}
                className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
                title="Renombrar"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
            {onMoveDoc && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveDoc(doc);
                }}
                className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
                title="Mover"
              >
                <FolderInput className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteDoc && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDoc(doc.id);
                }}
                className="p-1 rounded-md text-surface-400 hover:text-mandy-400 hover:bg-mandy-500/10 transition"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          )}
        </div>
      </div>
    );
  };

  const renderFolderTree = useCallback((parentPath: string, depth = 0): React.ReactNode[] => {
    const children = folderChildrenMap[parentPath] ?? [];
    return children.map(folder => {
      const isExpanded = expandedFolders.has(folder.path);
      const hasChildren = (folderChildrenMap[folder.path] ?? []).length > 0;
      const count = docsByFolder[folder.path]?.length ?? 0;
      const isActive = activeFolder === folder.path;
      const paddingLeft = 10 + depth * 12;

      return (
        <div key={folder.path}>
          <div
            onClick={(e) => {
              e.stopPropagation();
              setActiveFolder(folder.path);
              onActiveFolderChange?.(folder.path);
              if (hasChildren) {
                toggleFolder(folder.path);
              }
            }}
            {...getContextTriggerProps({ type: 'folder', path: folder.path, folder })}
            className={`group w-full flex items-center gap-2 py-1.5 px-2 rounded transition border cursor-pointer relative ${
              isActive ? 'border-mandy-500/40 bg-mandy-500/10 text-mandy-300' : 'border-transparent text-surface-300 hover:bg-surface-700/40'
            }`}
            style={{ paddingLeft }}
          >
            {hasChildren ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.path);
                }}
                className="flex items-center justify-center w-4 h-4 shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </span>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span className="text-sm truncate flex-1 md:pr-6">{folder.name}</span>
            <span className="text-[10px] text-surface-500 shrink-0">{count}</span>

            {onRenameDoc && folder.docId && (
                <div
                   onClick={(e) => {
                       e.stopPropagation();
                       const doc = docMap.get(folder.docId!);
                       if (doc) onRenameDoc(doc);
                   }}
                   className="absolute right-2 p-1 rounded bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
                   title="Renombrar carpeta"
                >
                   <Pencil className="w-3 h-3" />
                </div>
            )}
          </div>
          {isExpanded && hasChildren && (
            <div>{renderFolderTree(folder.path, depth + 1)}</div>
          )}
        </div>
      );
    });
  }, [folderChildrenMap, expandedFolders, docsByFolder, activeFolder, onActiveFolderChange, docMap, onRenameDoc, getContextTriggerProps]);

  return (
    <div ref={containerRef} className={`h-full flex flex-col bg-surface-900 text-slate-200 overflow-hidden ${embedded ? '' : ''}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-surface-700">
        {/* Sidebar toggle */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(prev => !prev)}
          className={toolbarIconButtonClass}
          title={sidebarCollapsed ? 'Mostrar carpetas' : 'Ocultar carpetas'}
          aria-label={sidebarCollapsed ? 'Mostrar carpetas' : 'Ocultar carpetas'}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>

        {/* Workspace name — hide on ultracompact */}
        {!isUltraCompact && (
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium text-sm truncate max-w-[100px]">{currentWorkspaceName}</span>
          </div>
        )}

        {/* Search — collapsible in ultracompact */}
        {isUltraCompact && !searchExpanded ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchExpanded(true)}
              className={toolbarIconButtonClass}
              title="Buscar"
              aria-label="Buscar"
            >
              <Search className="h-5 w-5" />
            </button>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={collapseAllFolders}
                className={toolbarIconButtonClass}
                title="Contraer toda la jerarquia"
                aria-label="Contraer toda la jerarquia"
              >
                <ListCollapse className="h-5 w-5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                autoFocus={isUltraCompact && searchExpanded}
                onBlur={() => { if (isUltraCompact && !searchQuery) setSearchExpanded(false); }}
                className="w-full rounded border border-surface-700 bg-surface-800 py-2 pl-8 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:border-sky-500/50 focus:outline-none"
              />
            </div>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={collapseAllFolders}
                className={toolbarIconButtonClass}
                title="Contraer toda la jerarquia"
                aria-label="Contraer toda la jerarquia"
              >
                <ListCollapse className="h-5 w-5" />
              </button>
            )}
            {isUltraCompact && searchExpanded && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchExpanded(false); }}
                className={toolbarIconButtonClass}
                title="Cerrar busqueda"
                aria-label="Cerrar busqueda"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Action buttons — inline when wide, overflow menu when compact */}
        {isCompact ? (
          <div className="relative shrink-0" ref={toolbarMenuRef}>
            <button
              type="button"
              onClick={() => setToolbarMenuOpen(prev => !prev)}
              className={`${toolbarIconButtonClass} ${
                toolbarMenuOpen
                  ? 'bg-surface-700 text-surface-200'
                  : ''
              }`}
              title="Acciones"
              aria-label="Acciones"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {toolbarMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-surface-800 border border-surface-600/50 rounded-lg shadow-2xl shadow-black/50 overflow-hidden">
                {onCreateFile && (
                  <button
                    onClick={() => { onCreateFile(); setToolbarMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nuevo archivo
                  </button>
                )}
                {onCreateStFile && (
                  <button
                    onClick={() => { onCreateStFile(); setToolbarMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-400 hover:bg-surface-700 transition"
                  >
                    <Code className="w-3.5 h-3.5" /> Nuevo archivo ST
                  </button>
                )}
                {onCreateFolder && (
                  <button
                    onClick={() => { onCreateFolder(); setToolbarMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 transition"
                  >
                    <FolderPlus className="w-3.5 h-3.5" /> Nueva carpeta
                  </button>
                )}
                <div className="border-t border-surface-700 my-0.5" />
                {onUploadFile && (
                  <button
                    onClick={() => { onUploadFile(); setToolbarMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 transition"
                  >
                    <Upload className="w-3.5 h-3.5" /> Subir archivo
                  </button>
                )}
                {onUploadFolder && (
                  <button
                    onClick={() => { onUploadFolder(); setToolbarMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 transition"
                  >
                    <FolderInput className="w-3.5 h-3.5" /> Subir carpeta
                  </button>
                )}
                {!isCompact && currentWorkspaceId && currentWorkspaceId !== PERSONAL_WORKSPACE_ID && (
                  <>
                    <div className="border-t border-surface-700 my-0.5" />
                    <button
                      onClick={() => { navigator.clipboard.writeText(currentWorkspaceId); setToolbarMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-surface-700 transition"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar ID
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-0.5 shrink-0">
            {onCreateFile && (
              <button
                type="button"
                onClick={onCreateFile}
                className={toolbarIconButtonClass}
                title="Nuevo archivo"
                aria-label="Nuevo archivo"
              >
                <Plus className="h-5 w-5 text-slate-400" />
              </button>
            )}
            {onCreateStFile && (
              <button
                type="button"
                onClick={onCreateStFile}
                className={toolbarIconButtonClass}
                title="Nuevo archivo ST"
                aria-label="Nuevo archivo ST"
              >
                <Code className="h-5 w-5 text-emerald-400" />
              </button>
            )}
            {onCreateFolder && (
              <button
                type="button"
                onClick={onCreateFolder}
                className={toolbarIconButtonClass}
                title="Nueva carpeta"
                aria-label="Nueva carpeta"
              >
                <FolderPlus className="h-5 w-5 text-slate-400" />
              </button>
            )}
            {onUploadFile && (
              <button
                type="button"
                onClick={onUploadFile}
                className={toolbarIconButtonClass}
                title="Subir archivo"
                aria-label="Subir archivo"
              >
                <Upload className="h-5 w-5 text-slate-400" />
              </button>
            )}
            {onUploadFolder && (
              <button
                type="button"
                onClick={onUploadFolder}
                className={toolbarIconButtonClass}
                title="Subir carpeta"
                aria-label="Subir carpeta"
              >
                <FolderInput className="h-5 w-5 text-slate-400" />
              </button>
            )}
            {currentWorkspaceId && currentWorkspaceId !== PERSONAL_WORKSPACE_ID && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(currentWorkspaceId)}
                className={toolbarIconButtonClass}
                title="Copiar ID del workspace"
                aria-label="Copiar ID del workspace"
              >
                <Copy className="h-5 w-5 shrink-0" />
              </button>
            )}
          </div>
        )}
      </div>

      {hasSelection && (
        <div className="px-3 py-2 border-b border-surface-700 bg-surface-800/60 flex items-center justify-between">
          <span className="text-xs text-slate-300">
            {selectedDocIds.length + selectedFolderPaths.length} seleccionados
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteSelected}
              className="text-xs text-red-300 hover:text-red-200 px-2 py-1 rounded hover:bg-surface-700 transition"
            >
              Eliminar
            </button>
            <button
              onClick={() => setSelectedKeys(new Set())}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-surface-700 transition"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {!sidebarCollapsed && !isUltraCompact && (
        <aside className={`${isCompact ? 'w-36' : 'w-56'} border-r border-surface-700/60 bg-surface-800/40 flex flex-col shrink-0 transition-all duration-150`}>
          <div className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Carpetas</div>
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-4 space-y-1">
            {renderFolderTree('')}
          </div>
        </aside>
        )}
        <section className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-surface-400 uppercase tracking-wider">Contenido</span>
            <button
              onClick={handleSelectAll}
              className="text-[10px] uppercase font-semibold text-surface-500 hover:text-mandy-400 hover:bg-surface-700/50 px-2 py-1 rounded transition-colors"
              title="Seleccionar todo / Ninguno"
            >
              {contentItems.length > 0 && selectedKeys.size === contentItems.length ? 'Ninguno' : 'Todos'}
            </button>
          </div>
          {contentItems.length === 0 ? (
            <div className="px-4 py-6 text-sm text-surface-500">
              {searchQuery ? 'No se encontraron archivos' : 'Esta carpeta está vacía.'}
            </div>
          ) : (
            <div ref={contentListRef} className="flex-1 min-h-0">
              <VirtualizedList
                rowCount={contentItems.length}
                rowHeight={CONTENT_ROW_HEIGHT}
                overscanCount={6}
                className="scrollbar-hide"
                style={{
                  height: Math.max(contentListSize.height, 1),
                  width: Math.max(contentListSize.width, 1)
                }}
                rowComponent={renderContentRow}
                rowProps={{}}
              />
            </div>
          )}
        </section>
      </div>

      {contextMenu && (
        <FileExplorerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          data={contextMenu.data}
          docMap={docMap}
          favoriteDocIdSet={favoriteDocIdSet}
          onOpenDoc={handleOpenDoc}
          onDuplicateDoc={onDuplicateDoc}
          onDownloadDoc={onDownloadDoc}
          onToggleFavorite={onToggleFavorite}
          onRenameDoc={onRenameDoc}
          onMoveDocPrompt={handleMoveDoc}
          onDeleteDoc={onDeleteDoc}
          onDownloadFolder={onDownloadFolder}
          onDeleteFolder={onDeleteFolder}
          onShowProperties={handleShowProperties}
          onCopyPath={handleCopyPath}
          onOpenInForgejo={handleOpenInForgejo}
        />
      )}
      {propertiesDoc && (
        <FilePropertiesModal doc={propertiesDoc} onClose={() => setPropertiesDoc(null)} />
      )}
    </div>
  );
};

export default React.memo(FileExplorer);
