'use client';

import React, { useEffect, useMemo, useState, useCallback, useLayoutEffect, useRef } from 'react';
import { List as VirtualizedList, type RowComponentProps } from 'react-window';
import {
  Folder,
  FolderOpen,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  ChevronRight,
  ChevronDown,
  Upload,
  FolderPlus,
  Plus,
  Search,
  MoreVertical,
  Trash2,
  Copy,
  FolderInput,
  Pencil,
  GripVertical
} from 'lucide-react';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath } from '@/lib/folder-utils';
import { getUpdatedAtValue } from '@/services/dashboardUtils';

export interface DocItem {
  id: string;
  name: string;
  type?: 'text' | 'file' | 'folder' | 'terminal' | 'files';
  content?: string;
  url?: string;
  folder?: string;
  storagePath?: string;
  mimeType?: string;
  updatedAt?: any;
  ownerId?: string;
  order?: number;
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

type ContentItem =
  | { kind: 'folder'; folder: FolderItem }
  | { kind: 'doc'; doc: DocItem };

const CONTENT_ROW_HEIGHT = 52;
const DOC_REORDER_TYPE = 'application/x-doc-reorder';
const FOLDER_REORDER_TYPE = 'application/x-folder-reorder';

const arrayMove = <T,>(items: T[], from: number, to: number) => {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

const resolveReorderIndex = (fromIndex: number, targetIndex: number, placeAfter: boolean) => {
  let toIndex = placeAfter ? targetIndex + 1 : targetIndex;
  if (fromIndex < toIndex) toIndex -= 1;
  return toIndex;
};

const useElementSize = <T extends HTMLElement>() => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node !== null) {
      const updateSize = () => {
          const rect = node.getBoundingClientRect();
          setSize({ width: rect.width, height: rect.height });
      };

      updateSize();

      if (typeof ResizeObserver !== 'undefined') {
        observerRef.current = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) {
             const { width, height } = entry.contentRect;
             setSize({ width, height });
          }
        });
        observerRef.current.observe(node);
      }
    }
  }, []);

  return [ref, size] as const;
};

interface FileExplorerProps {
  docs: DocItem[];
  folders: FolderItem[];
  onSelectDoc: (doc: DocItem) => void;
  onCreateFile?: () => void;
  onCreateFolder?: () => void;
  onUploadFile?: () => void;
  onUploadFolder?: () => void;
  onDeleteDoc?: (docId: string) => void;
  onDeleteFolder?: (folder: FolderItem) => void;
  onDeleteItems?: (payload: { docIds: string[]; folderPaths: string[] }) => void;
  onDuplicateDoc?: (doc: DocItem) => void;
  onMoveDoc?: (docId: string, targetFolder: string) => void;
  onRenameDoc?: (doc: DocItem) => void;
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
  onCreateFolder,
  onUploadFile,
  onUploadFolder,
  onDeleteDoc,
  onDeleteFolder,
  onDeleteItems,
  onDuplicateDoc,
  onMoveDoc,
  onRenameDoc,
  onReorderDocs,
  onReorderFolders,
  currentWorkspaceName = 'Espacio Personal',
  currentWorkspaceId,
  embedded = false,
  activeFolder: activeFolderProp,
  onActiveFolderChange
}) => {
  const resolveActiveFolder = (value?: string) => {
    if (value === '') return '';
    if (value === undefined || value === null) return DEFAULT_FOLDER_NAME;
    return normalizeFolderPath(value);
  };

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([DEFAULT_FOLDER_NAME]));
  const [activeFolder, setActiveFolder] = useState(resolveActiveFolder(activeFolderProp));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; docId: string } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [contentListRef, contentListSize] = useElementSize<HTMLDivElement>();
  const lastSelectedIndex = useRef<number>(-1);

  const normalizedDocs = useMemo(() => {
    return docs.map(doc => ({ ...doc, folder: normalizeFolderPath(doc.folder) }));
  }, [docs]);

  const docsByFolder = useMemo(() => {
    const grouped: Record<string, DocItem[]> = {};
    normalizedDocs.forEach(docItem => {
      const folderName = normalizeFolderPath(docItem.folder);
      if (!grouped[folderName]) grouped[folderName] = [];
      grouped[folderName].push(docItem);
    });
    return grouped;
  }, [normalizedDocs]);

  const effectiveFolders = useMemo<FolderItem[]>(() => {
    const byPath = new Map<string, FolderItem>();
    const derived: FolderItem[] = [];

    folders.forEach(folder => {
      byPath.set(folder.path, folder);
    });

    const ensureFolder = (rawPath?: string) => {
      const normalized = normalizeFolderPath(rawPath);
      if (byPath.has(normalized)) return;

      const parts = normalized.split('/');
      let acc = '';
      for (let i = 0; i < parts.length; i += 1) {
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
    normalizedDocs.forEach(doc => ensureFolder(doc.folder));

    return [...folders, ...derived];
  }, [folders, normalizedDocs]);

  const folderChildrenMap = useMemo(() => {
    const map: Record<string, FolderItem[]> = {};
    effectiveFolders.forEach(folder => {
      const parent = folder.parentPath || '';
      if (!map[parent]) map[parent] = [];
      map[parent].push(folder);
    });
    Object.values(map).forEach(list => {
      list.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : null;
        const orderB = typeof b.order === 'number' ? b.order : null;
        if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
        if (orderA !== null && orderB === null) return -1;
        if (orderA === null && orderB !== null) return 1;
        const kindWeight: Record<FolderItem['kind'], number> = { system: 0, record: 1, virtual: 2 };
        const weightDiff = kindWeight[a.kind] - kindWeight[b.kind];
        if (weightDiff !== 0) return weightDiff;
        return a.name.localeCompare(b.name);
      });
    });
    return map;
  }, [effectiveFolders]);

  const activeChildFolders = useMemo(() => {
    return folderChildrenMap[activeFolder] ?? [];
  }, [folderChildrenMap, activeFolder]);

  const activeFolderDocs = useMemo(() => {
    const list = docsByFolder[activeFolder] ?? [];
    return list.slice().sort((a, b) => {
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
  }, [docsByFolder, activeFolder]);

  const filteredChildFolders = useMemo(() => {
    if (!searchQuery.trim()) return activeChildFolders;
    const query = searchQuery.toLowerCase();
    return activeChildFolders.filter(folder => folder.name.toLowerCase().includes(query));
  }, [activeChildFolders, searchQuery]);

  const filteredFolderDocs = useMemo(() => {
    if (!searchQuery.trim()) return activeFolderDocs;
    const query = searchQuery.toLowerCase();
    return activeFolderDocs.filter(doc => doc.name.toLowerCase().includes(query));
  }, [activeFolderDocs, searchQuery]);

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

  const handleContextMenu = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, docId });
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

  const reorderDocs = (dragId: string, targetId: string, placeAfter: boolean) => {
    if (!canReorderDocs) return;
    const fromIndex = docIndexMap.get(dragId);
    const toIndex = docIndexMap.get(targetId);
    if (fromIndex === undefined || toIndex === undefined || fromIndex === toIndex) return;
    const resolvedIndex = resolveReorderIndex(fromIndex, toIndex, placeAfter);
    if (resolvedIndex === fromIndex) return;
    const reordered = arrayMove(filteredFolderDocs, fromIndex, resolvedIndex);
    onReorderDocs?.({ folderPath: activeFolder, orderedIds: reordered.map(doc => doc.id) });
  };

  const reorderFolders = (dragPath: string, targetPath: string, placeAfter: boolean) => {
    if (!canReorderFolders) return;
    const fromIndex = folderIndexMap.get(dragPath);
    const toIndex = folderIndexMap.get(targetPath);
    if (fromIndex === undefined || toIndex === undefined || fromIndex === toIndex) return;
    const resolvedIndex = resolveReorderIndex(fromIndex, toIndex, placeAfter);
    if (resolvedIndex === fromIndex) return;
    const reordered = arrayMove(filteredChildFolders, fromIndex, resolvedIndex);
    onReorderFolders?.({ parentPath: activeFolder, orderedPaths: reordered.map(folder => folder.path) });
  };

  const getDropPosition = (e: React.DragEvent<HTMLElement>) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    return e.clientY > midpoint ? 'after' : 'before';
  };

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
              <span className="text-[11px] text-surface-500 truncate">{folder.path}</span>
            </div>
            <span className="text-[10px] text-surface-500">{count}</span>
            <div className="ml-auto flex items-center gap-2">
              {canReorderFolders && folder.docId && (
                <button
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData(FOLDER_REORDER_TYPE, folder.path);
                    e.dataTransfer.setData('text/plain', folder.path);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={(e) => {
                    e.stopPropagation();
                    setDragOverKey(null);
                    setDragOverPosition(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded-md text-surface-500 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
                  title="Reordenar carpeta"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
              )}
              {onDeleteFolder && folder.kind !== 'system' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder(folder);
                  }}
                  className="p-1 rounded-md text-surface-400 hover:text-mandy-400 hover:bg-mandy-500/10 transition opacity-0 group-hover:opacity-100"
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
    return (
      <div style={rowStyle}>
        <div
          onClick={(e) => handleDocSelect(doc, index, e)}
          onDoubleClick={(e) => handleDocDoubleClick(doc)}
          onContextMenu={(e) => handleContextMenu(e, doc.id)}
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
            <span className="text-[11px] text-surface-500 truncate">{doc.folder || DEFAULT_FOLDER_NAME}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-300 uppercase">
            {getDocBadge(doc)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canReorderDocs && (
              <button
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData(DOC_REORDER_TYPE, doc.id);
                  e.dataTransfer.setData('text/plain', doc.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={(e) => {
                  e.stopPropagation();
                  setDragOverKey(null);
                  setDragOverPosition(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-md text-surface-500 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e, doc.id);
              }}
              className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
              title="Mas opciones"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </div>
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
  }, [folderChildrenMap, expandedFolders, docsByFolder, activeFolder, onActiveFolderChange, docMap, onRenameDoc]);

  return (
    <div className={`h-full flex flex-col bg-surface-900 text-slate-200 overflow-hidden ${embedded ? '' : ''}`}>
      <div className="flex items-center gap-3 px-3 py-2 border-b border-surface-700">
        <div className="flex items-center gap-2 shrink-0">
          <Folder className="w-4 h-4 text-amber-400" />
          <span className="font-medium text-sm truncate max-w-[120px]">{currentWorkspaceName}</span>
          {currentWorkspaceId && currentWorkspaceId !== 'personal' && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(currentWorkspaceId);
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono bg-surface-700/50 text-surface-400 rounded hover:bg-surface-600 hover:text-surface-200 transition"
              title="Copiar ID del workspace"
            >
              <Copy className="w-2.5 h-2.5 shrink-0" />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-7 pr-3 py-1 bg-surface-800 border border-surface-700 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {onCreateFile && (
            <button
              onClick={onCreateFile}
              className="p-1.5 hover:bg-surface-700 rounded transition-colors"
              title="Nuevo archivo"
            >
              <Plus className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {onCreateFolder && (
            <button
              onClick={onCreateFolder}
              className="p-1.5 hover:bg-surface-700 rounded transition-colors"
              title="Nueva carpeta"
            >
              <FolderPlus className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {onUploadFile && (
            <button
              onClick={onUploadFile}
              className="p-1.5 hover:bg-surface-700 rounded transition-colors"
              title="Subir archivo"
            >
              <Upload className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {onUploadFolder && (
            <button
              onClick={onUploadFolder}
              className="p-1.5 hover:bg-surface-700 rounded transition-colors"
              title="Subir carpeta"
            >
              <FolderInput className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
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
        <aside className="w-56 border-r border-surface-700/60 bg-surface-800/40 flex flex-col">
          <div className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Carpetas</div>
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-4 space-y-1">
            {renderFolderTree('')}
          </div>
        </aside>
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
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {onDuplicateDoc && (
              <button
                onClick={() => {
                  const doc = docMap.get(contextMenu.docId);
                  if (doc) onDuplicateDoc(doc);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-surface-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Duplicar
              </button>
            )}
            {onRenameDoc && (
              <button
                onClick={() => {
                  const doc = docMap.get(contextMenu.docId);
                  if (doc) handleRenameDoc(doc);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-surface-700 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Renombrar
              </button>
            )}
            {onMoveDoc && (
              <button
                onClick={() => {
                  const doc = docMap.get(contextMenu.docId);
                  if (doc) handleMoveDoc(doc);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-surface-700 transition-colors"
              >
                <FolderInput className="w-4 h-4" />
                Mover a...
              </button>
            )}
            {(onDuplicateDoc || onMoveDoc) && <div className="border-t border-surface-700 my-1" />}
            {onDeleteDoc && (
              <button
                onClick={() => {
                  onDeleteDoc(contextMenu.docId);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-surface-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FileExplorer;
