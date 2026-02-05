'use client';

import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { List as VirtualizedList, type RowComponentProps } from 'react-window';
import { Briefcase, Cloud, CloudOff, Copy, Folder, FolderInput, FolderPlus, FolderUp, GripVertical, Pencil, Plus, Trash2, Upload, User } from 'lucide-react';
import type { DocItem, FolderItem, Workspace } from '@/components/dashboard/types';
import { isDocUploaded } from '@/services/dashboardDocUtils';

const DOC_REORDER_TYPE = 'application/x-doc-reorder';
const FOLDER_REORDER_TYPE = 'application/x-folder-reorder';
const CONTENT_ROW_HEIGHT = 64;

type ContentItem =
  | { kind: 'folder'; folder: FolderItem }
  | { kind: 'doc'; doc: DocItem };

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
        setSize(prev => (
          prev.width === rect.width && prev.height === rect.height
            ? prev
            : { width: rect.width, height: rect.height }
        ));
      };

      updateSize();

      if (typeof ResizeObserver !== 'undefined') {
        observerRef.current = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) {
            const { width, height } = entry.contentRect;
            setSize(prev => (
              prev.width === width && prev.height === height
                ? prev
                : { width, height }
            ));
          }
        });
        observerRef.current.observe(node);
      }
    }
  }, []);

  return [ref, size] as const;
};

interface WorkspaceExplorerProps {
  currentWorkspace: Workspace | null;
  activeFolder: string;
  activeFolderLabel: string;
  activeChildFolders: FolderItem[];
  activeFolderDocs: DocItem[];
  docsByFolder: Record<string, DocItem[]>;
  folderTree: React.ReactNode;
  folderDragOver: string | null;
  onFolderDragOver: (e: React.DragEvent, path: string) => void;
  onFolderDrop: (e: React.DragEvent, path: string) => void;
  onFolderDragLeave: (path: string) => void;
  onDocDragStart: (e: React.DragEvent, doc: DocItem) => void;
  onDocDragEnd: () => void;
  onActiveFolderChange: (path: string) => void;
  onOpenDocument: (doc: DocItem) => void;
  onCreateDoc: () => void;
  onCreateFolder: () => void;
  onUploadFile: () => void;
  onUploadFolder: () => void;
  onCopyWorkspaceId: (id: string) => void;
  onCopyDocument: (doc: DocItem) => void;
  onRenameDocument: (doc: DocItem) => void;
  onMoveDocument: (doc: DocItem) => void;
  onReorderDocs?: (payload: { folderPath: string; orderedIds: string[] }) => void;
  onReorderFolders?: (payload: { parentPath: string; orderedPaths: string[] }) => void;
  onDeleteDocument: (doc: DocItem, e: React.MouseEvent) => void;
  getIcon: (doc: DocItem) => React.ReactNode;
  getDocBadge: (doc: DocItem) => string;
  personalWorkspaceId: string;
  rootFolderPath: string;
  defaultFolderName: string;
}

const WorkspaceExplorer = ({
  currentWorkspace,
  activeFolder,
  activeFolderLabel,
  activeChildFolders,
  activeFolderDocs,
  docsByFolder,
  folderTree,
  folderDragOver,
  onFolderDragOver,
  onFolderDrop,
  onFolderDragLeave,
  onDocDragStart,
  onDocDragEnd,
  onActiveFolderChange,
  onOpenDocument,
  onCreateDoc,
  onCreateFolder,
  onUploadFile,
  onUploadFolder,
  onCopyWorkspaceId,
  onCopyDocument,
  onRenameDocument,
  onMoveDocument,
  onReorderDocs,
  onReorderFolders,
  onDeleteDocument,
  getIcon,
  getDocBadge,
  personalWorkspaceId,
  rootFolderPath,
  defaultFolderName
}: WorkspaceExplorerProps) => {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [contentListRef, contentListSize] = useElementSize<HTMLDivElement>();
  const canReorderDocs = !!onReorderDocs;
  const canReorderFolders = !!onReorderFolders && activeChildFolders.every(folder => !!folder.docId);

  const contentItems = useMemo<ContentItem[]>(() => {
    const items: ContentItem[] = [];
    activeChildFolders.forEach(folder => items.push({ kind: 'folder', folder }));
    activeFolderDocs.forEach(doc => items.push({ kind: 'doc', doc }));
    return items;
  }, [activeChildFolders, activeFolderDocs]);

  const updateDragOver = useCallback((key: string | null, position: 'before' | 'after' | null) => {
    setDragOverKey(prev => (prev === key ? prev : key));
    setDragOverPosition(prev => (prev === position ? prev : position));
  }, []);

  const reorderDocs = (dragId: string, targetId: string, placeAfter: boolean) => {
    if (!canReorderDocs) return;
    const fromIndex = activeFolderDocs.findIndex(doc => doc.id === dragId);
    const toIndex = activeFolderDocs.findIndex(doc => doc.id === targetId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const resolvedIndex = resolveReorderIndex(fromIndex, toIndex, placeAfter);
    if (resolvedIndex === fromIndex) return;
    const reordered = arrayMove(activeFolderDocs, fromIndex, resolvedIndex);
    onReorderDocs?.({ folderPath: activeFolder, orderedIds: reordered.map(doc => doc.id) });
  };

  const reorderFolders = (dragPath: string, targetPath: string, placeAfter: boolean) => {
    if (!canReorderFolders) return;
    const fromIndex = activeChildFolders.findIndex(folder => folder.path === dragPath);
    const toIndex = activeChildFolders.findIndex(folder => folder.path === targetPath);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
    const resolvedIndex = resolveReorderIndex(fromIndex, toIndex, placeAfter);
    if (resolvedIndex === fromIndex) return;
    const reordered = arrayMove(activeChildFolders, fromIndex, resolvedIndex);
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

    if (item.kind === 'folder') {
      const folder = item.folder;
      const count = docsByFolder[folder.path]?.length ?? 0;
      const isDropActive = folderDragOver === folder.path;

      return (
        <div style={style}>
          <div
            onClick={() => onActiveFolderChange(folder.path)}
            onDragOver={(e) => {
              const types = Array.from(e.dataTransfer.types ?? []);
              if (types.includes(FOLDER_REORDER_TYPE) && canReorderFolders) {
                e.preventDefault();
                e.stopPropagation();
                updateDragOver(`folder:${folder.path}`, getDropPosition(e));
                e.dataTransfer.dropEffect = 'move';
                return;
              }
              onFolderDragOver(e, folder.path);
            }}
            onDrop={(e) => {
              const types = Array.from(e.dataTransfer.types ?? []);
              if (types.includes(FOLDER_REORDER_TYPE) && canReorderFolders) {
                e.preventDefault();
                e.stopPropagation();
                const dragPath = e.dataTransfer.getData(FOLDER_REORDER_TYPE);
                if (dragPath) {
                  const placeAfter = getDropPosition(e) === 'after';
                  reorderFolders(dragPath, folder.path, placeAfter);
                }
                updateDragOver(null, null);
                return;
              }
              onFolderDrop(e, folder.path);
            }}
            onDragLeave={() => {
              if (dragOverKey === `folder:${folder.path}`) {
                updateDragOver(null, null);
              }
              onFolderDragLeave(folder.path);
            }}
            onDragEnd={() => {
              updateDragOver(null, null);
            }}
            className={`group flex items-center gap-3 px-4 py-3 rounded-lg border transition cursor-pointer relative ${isDropActive ? 'border-mandy-500/70 bg-mandy-500/10' : 'border-surface-800/80 bg-surface-800/30 hover:bg-surface-800/60 hover:border-surface-600/80'} ${dragOverKey === `folder:${folder.path}` ? 'ring-1 ring-mandy-400/60' : ''} ${
              dragOverKey === `folder:${folder.path}` && dragOverPosition === 'before'
                ? 'before:absolute before:left-3 before:right-3 before:top-0 before:h-0.5 before:bg-mandy-400'
                : dragOverKey === `folder:${folder.path}` && dragOverPosition === 'after'
                  ? 'after:absolute after:left-3 after:right-3 after:bottom-0 after:h-0.5 after:bg-mandy-400'
                  : ''
            }`}
          >
            <Folder className="w-4 h-4 text-surface-500" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold text-surface-200 truncate">{folder.name}</span>
              <span className="text-[11px] text-surface-500 truncate">{folder.path}</span>
            </div>
            <span className="text-[10px] text-surface-500">{count}</span>
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
                  updateDragOver(null, null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-md text-surface-500 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
                title="Reordenar carpeta"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      );
    }

    const doc = item.doc;
    const uploaded = isDocUploaded(doc);
    const SyncIcon = uploaded ? Cloud : CloudOff;
    const syncLabel = uploaded ? 'Subido' : 'Pendiente';
    const syncTitle = uploaded ? 'Contenido subido' : 'Pendiente de subir';
    return (
      <div style={style}>
        <div
          onClick={() => onOpenDocument(doc)}
          draggable
          onDragStart={(e) => {
            onDocDragStart(e, doc);
          }}
          onDragOver={(e) => {
            const types = Array.from(e.dataTransfer.types ?? []);
            if (!canReorderDocs || !types.includes(DOC_REORDER_TYPE)) return;
            e.preventDefault();
            e.stopPropagation();
            updateDragOver(`doc:${doc.id}`, getDropPosition(e));
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            const types = Array.from(e.dataTransfer.types ?? []);
            if (!canReorderDocs || !types.includes(DOC_REORDER_TYPE)) return;
            e.preventDefault();
            e.stopPropagation();
            const dragId = e.dataTransfer.getData(DOC_REORDER_TYPE);
            if (dragId) {
              const placeAfter = getDropPosition(e) === 'after';
              reorderDocs(dragId, doc.id, placeAfter);
            }
            updateDragOver(null, null);
          }}
          onDragLeave={() => {
            if (dragOverKey === `doc:${doc.id}`) {
              updateDragOver(null, null);
            }
          }}
          onDragEnd={() => {
            updateDragOver(null, null);
            onDocDragEnd();
          }}
          className={`group flex items-center gap-3 px-4 py-3 rounded-lg border border-surface-800/80 bg-surface-800/40 hover:bg-surface-800/70 hover:border-surface-600/80 transition cursor-pointer relative ${dragOverKey === `doc:${doc.id}` ? 'ring-1 ring-mandy-400/60' : ''} ${
            dragOverKey === `doc:${doc.id}` && dragOverPosition === 'before'
              ? 'before:absolute before:left-3 before:right-3 before:top-0 before:h-0.5 before:bg-mandy-400'
              : dragOverKey === `doc:${doc.id}` && dragOverPosition === 'after'
                ? 'after:absolute after:left-3 after:right-3 after:bottom-0 after:h-0.5 after:bg-mandy-400'
                : ''
          }`}
        >
          <div className="text-surface-500">{getIcon(doc)}</div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-semibold text-surface-200 truncate">{doc.name}</span>
            <span className="text-[11px] text-surface-500 truncate">{doc.folder || defaultFolderName}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-300 uppercase">
            {getDocBadge(doc)}
          </span>
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
                updateDragOver(null, null);
                onDocDragEnd();
              }}
              onClick={(e) => e.stopPropagation()}
              className="p-1 rounded-md text-surface-500 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
              title="Reordenar archivo"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyDocument(doc);
              }}
              className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
              title="Duplicar"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRenameDocument(doc);
              }}
              className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
              title="Renombrar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDocument(doc);
              }}
              className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition"
              title="Mover"
            >
              <FolderInput className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => onDeleteDocument(doc, e)}
              className="p-1 rounded-md text-surface-400 hover:text-mandy-400 hover:bg-mandy-500/10 transition"
              title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-surface-900">
      <div className="px-6 py-4 border-b border-surface-700/60 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {currentWorkspace?.type === 'personal' ? <User className="w-6 h-6 text-surface-400" /> : <Briefcase className="w-6 h-6 text-mandy-400" />}
          <div className="flex flex-col">
            <span className="text-lg font-bold text-white">{currentWorkspace?.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-surface-400">Carpeta: {activeFolderLabel}</span>
              {currentWorkspace?.id && currentWorkspace.id !== personalWorkspaceId && (
                <button
                  onClick={() => onCopyWorkspaceId(currentWorkspace.id)}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono bg-surface-700/50 text-surface-400 rounded hover:bg-surface-600 hover:text-surface-200 transition"
                  title="Copiar ID del workspace"
                >
                  <span className="truncate max-w-[100px]">{currentWorkspace.id}</span>
                  <Copy className="w-2.5 h-2.5 shrink-0" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateDoc}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-800 border border-surface-700 text-surface-200 hover:border-mandy-500/50 hover:text-mandy-300 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo Doc
          </button>
          <button
            onClick={onCreateFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-800 border border-surface-700 text-surface-200 hover:border-mandy-500/50 hover:text-mandy-300 transition"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Nueva Carpeta
          </button>
          <button
            onClick={onUploadFile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-800 border border-surface-700 text-surface-200 hover:border-mandy-500/50 hover:text-mandy-300 transition"
          >
            <Upload className="w-3.5 h-3.5" /> Subir
          </button>
          <button
            onClick={onUploadFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface-800 border border-surface-700 text-surface-200 hover:border-mandy-500/50 hover:text-mandy-300 transition"
          >
            <FolderUp className="w-3.5 h-3.5" /> Subir Carpeta
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 flex">
        <aside className="w-64 border-r border-surface-700/60 bg-surface-800/40 flex flex-col">
          <div className="px-4 py-3 text-xs font-semibold text-surface-500 uppercase tracking-wider">
            Carpetas
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 pb-4 space-y-1">
            <button
              onClick={() => onActiveFolderChange(rootFolderPath)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition border ${activeFolder === rootFolderPath ? 'border-mandy-500/40 bg-mandy-500/10 text-mandy-300' : 'border-transparent text-surface-300 hover:bg-surface-700/40'}`}
            >
              {currentWorkspace?.type === 'personal'
                ? <User className={`w-4 h-4 ${activeFolder === rootFolderPath ? 'text-mandy-400' : 'text-surface-500'}`} />
                : <Briefcase className={`w-4 h-4 ${activeFolder === rootFolderPath ? 'text-mandy-400' : 'text-surface-500'}`} />
              }
              <span className="text-sm font-semibold truncate flex-1">{currentWorkspace?.name || 'Espacio Personal'}</span>
              <span className="text-[10px] text-surface-500">Raiz</span>
            </button>
            {folderTree}
          </div>
        </aside>
        <section className="flex-1 min-h-0 flex flex-col">
          <div className="px-6 py-4 text-xs text-surface-400 uppercase tracking-wider">
            Documentos
          </div>
          {contentItems.length === 0 ? (
            <div className="px-4 py-6 text-sm text-surface-500">
              {activeFolder === rootFolderPath ? 'Este espacio esta vacio.' : 'Esta carpeta esta vacia.'}
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
    </div>
  );
};

export default WorkspaceExplorer;
