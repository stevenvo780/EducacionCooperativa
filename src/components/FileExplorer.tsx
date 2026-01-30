"use client";

import React, { useEffect, useMemo, useState } from 'react';
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
  FolderInput
} from 'lucide-react';

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
}

export interface FolderItem {
  id: string;
  name: string;
  path: string;
  parentPath: string;
  kind: 'system' | 'record' | 'virtual';
  docId?: string;
}

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
  currentWorkspaceName?: string;
  embedded?: boolean;
  activeFolder?: string;
  onActiveFolderChange?: (folderPath: string) => void;
}

const DEFAULT_FOLDER_NAME = 'No estructurado';

const normalizePath = (value?: string) => {
  if (!value) return '';
  return value
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .join('/');
};

const normalizeFolderPath = (value?: string) => {
  const normalized = normalizePath(value);
  return normalized || DEFAULT_FOLDER_NAME;
};

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
  currentWorkspaceName = 'Espacio Personal',
  embedded = false,
  activeFolder: activeFolderProp,
  onActiveFolderChange
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([DEFAULT_FOLDER_NAME]));
  const [activeFolder, setActiveFolder] = useState(activeFolderProp || DEFAULT_FOLDER_NAME);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; docId: string } | null>(null);

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

  const folderChildrenMap = useMemo(() => {
    const map: Record<string, FolderItem[]> = {};
    folders.forEach(folder => {
      const parent = folder.parentPath || '';
      if (!map[parent]) map[parent] = [];
      map[parent].push(folder);
    });
    Object.values(map).forEach(list => {
      list.sort((a, b) => {
        const kindWeight: Record<FolderItem['kind'], number> = { system: 0, record: 1, virtual: 2 };
        const weightDiff = kindWeight[a.kind] - kindWeight[b.kind];
        if (weightDiff !== 0) return weightDiff;
        return a.name.localeCompare(b.name);
      });
    });
    return map;
  }, [folders]);

  const activeChildFolders = useMemo(() => {
    return folderChildrenMap[activeFolder] ?? [];
  }, [folderChildrenMap, activeFolder]);

  const activeFolderDocs = useMemo(() => {
    return docsByFolder[activeFolder] ?? [];
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

  const docMap = useMemo(() => {
    return new Map(normalizedDocs.map(doc => [doc.id, doc]));
  }, [normalizedDocs]);

  const folderMap = useMemo(() => {
    return new Map(folders.map(folder => [folder.path, folder]));
  }, [folders]);

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

  useEffect(() => {
    if (activeFolderProp && activeFolderProp !== activeFolder) {
      setActiveFolder(activeFolderProp);
    }
  }, [activeFolderProp, activeFolder]);

  useEffect(() => {
    if (!folders.length) return;
    const exists = folders.some(folder => folder.path === activeFolder);
    if (!exists) {
      const rootFolders = folderChildrenMap[''] ?? [];
      const fallback = rootFolders[0]?.path || DEFAULT_FOLDER_NAME;
      setActiveFolder(fallback);
      onActiveFolderChange?.(fallback);
    }
  }, [folders, folderChildrenMap, activeFolder, onActiveFolderChange]);

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [activeFolder]);

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

  const handleFolderSelect = (folder: FolderItem, e: React.MouseEvent) => {
    const key = `folder:${folder.path}`;
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      toggleSelection(key, e);
      return;
    }
    setSingleSelection(key);
    setActiveFolder(folder.path);
    onActiveFolderChange?.(folder.path);
    setExpandedFolders(prev => new Set(prev).add(folder.path));
  };

  const handleDocSelect = (doc: DocItem, e: React.MouseEvent) => {
    const key = `doc:${doc.id}`;
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      toggleSelection(key, e);
      return;
    }
    setSingleSelection(key);
    onSelectDoc(doc);
  };

  const handleMoveDoc = (doc: DocItem) => {
    if (!onMoveDoc) return;
    const current = normalizeFolderPath(doc.folder);
    const target = prompt('Mover a carpeta', current);
    if (!target) return;
    onMoveDoc(doc.id, target);
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

  const renderFolderTree = (parentPath: string, depth = 0): React.ReactNode[] => {
    const children = folderChildrenMap[parentPath] ?? [];
    return children.map(folder => {
      const isExpanded = expandedFolders.has(folder.path);
      const hasChildren = (folderChildrenMap[folder.path] ?? []).length > 0;
      const count = docsByFolder[folder.path]?.length ?? 0;
      const isActive = activeFolder === folder.path;
      const paddingLeft = 10 + depth * 12;

      return (
        <div key={folder.path}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveFolder(folder.path);
              onActiveFolderChange?.(folder.path);
              if (hasChildren) {
                toggleFolder(folder.path);
              }
            }}
            className={`w-full flex items-center gap-2 py-1.5 px-2 rounded transition border ${
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
                className="flex items-center justify-center w-4 h-4"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </span>
            ) : (
              <span className="w-4" />
            )}
            {isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-400" />
            ) : (
              <Folder className="w-4 h-4 text-amber-400" />
            )}
            <span className="text-sm truncate flex-1">{folder.name}</span>
            <span className="text-[10px] text-surface-500">{count}</span>
          </button>
          {isExpanded && hasChildren && (
            <div>{renderFolderTree(folder.path, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className={`h-full flex flex-col bg-surface-900 text-slate-200 overflow-hidden ${embedded ? '' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-surface-700">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-amber-400" />
          <div className="flex flex-col">
            <span className="font-medium text-sm">{currentWorkspaceName}</span>
            <span className="text-[10px] text-slate-500 truncate">Carpeta: {activeFolder}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
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

      {/* Search */}
      <div className="p-2 border-b border-surface-700">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar archivos..."
            className="w-full pl-8 pr-3 py-1.5 bg-surface-800 border border-surface-700 rounded text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
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

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        <aside className="w-56 border-r border-surface-700/60 bg-surface-800/40 flex flex-col">
          <div className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">Carpetas</div>
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-4 space-y-1">
            {renderFolderTree('')}
          </div>
        </aside>
        <section className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          <div className="px-4 py-3 text-xs text-surface-400 uppercase tracking-wider">Contenido</div>
          <div className="px-4 pb-6 space-y-1">
            {filteredChildFolders.map(folder => {
              const isSelected = selectedKeys.has(`folder:${folder.path}`);
              const count = docsByFolder[folder.path]?.length ?? 0;
              return (
                <div
                  key={folder.path}
                  onClick={(e) => handleFolderSelect(folder, e)}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg border transition cursor-pointer ${
                    isSelected ? 'border-mandy-500/50 bg-mandy-500/10 text-mandy-300' : 'border-surface-800/80 bg-surface-800/30 hover:bg-surface-800/60 hover:border-surface-600/80'
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
              );
            })}

            {filteredFolderDocs.map(doc => {
              const key = `doc:${doc.id}`;
              const isSelected = selectedKeys.has(key);
              return (
                <div
                  key={doc.id}
                  onClick={(e) => handleDocSelect(doc, e)}
                  onContextMenu={(e) => handleContextMenu(e, doc.id)}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg border transition cursor-pointer ${
                    isSelected ? 'border-mandy-500/50 bg-mandy-500/10 text-mandy-300' : 'border-surface-800/80 bg-surface-800/30 hover:bg-surface-800/60 hover:border-surface-600/80'
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
                    {onDuplicateDoc && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicateDoc(doc);
                        }}
                        className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100"
                        title="Duplicar"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onMoveDoc && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveDoc(doc);
                        }}
                        className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100"
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
                        className="p-1 rounded-md text-surface-400 hover:text-mandy-400 hover:bg-mandy-500/10 transition opacity-0 group-hover:opacity-100"
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
                      className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100"
                      title="Mas opciones"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredChildFolders.length === 0 && filteredFolderDocs.length === 0 && (
              <div className="px-4 py-6 text-sm text-surface-500">
                {searchQuery ? 'No se encontraron archivos' : 'Esta carpeta está vacía.'}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Context Menu */}
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
