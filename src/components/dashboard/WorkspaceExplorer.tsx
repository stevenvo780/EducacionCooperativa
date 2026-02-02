'use client';

import type React from 'react';
import { Briefcase, Copy, Folder, FolderInput, FolderPlus, FolderUp, Pencil, Plus, Trash2, Upload, User } from 'lucide-react';
import type { DocItem, FolderItem, Workspace } from '@/components/dashboard/types';

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
  onDeleteDocument,
  getIcon,
  getDocBadge,
  personalWorkspaceId,
  rootFolderPath,
  defaultFolderName
}: WorkspaceExplorerProps) => {
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
        <section className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
          <div className="px-6 py-4 text-xs text-surface-400 uppercase tracking-wider">
            Documentos
          </div>
          <div className="px-4 pb-6 space-y-1">
            {activeChildFolders.map(folder => {
              const count = docsByFolder[folder.path]?.length ?? 0;
              const isDropActive = folderDragOver === folder.path;
              return (
                <div
                  key={folder.path}
                  onClick={() => onActiveFolderChange(folder.path)}
                  onDragOver={(e) => onFolderDragOver(e, folder.path)}
                  onDrop={(e) => onFolderDrop(e, folder.path)}
                  onDragLeave={() => onFolderDragLeave(folder.path)}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-lg border transition cursor-pointer ${isDropActive ? 'border-mandy-500/70 bg-mandy-500/10' : 'border-surface-800/80 bg-surface-800/30 hover:bg-surface-800/60 hover:border-surface-600/80'}`}
                >
                  <Folder className="w-4 h-4 text-surface-500" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold text-surface-200 truncate">{folder.name}</span>
                    <span className="text-[11px] text-surface-500 truncate">{folder.path}</span>
                  </div>
                  <span className="text-[10px] text-surface-500">{count}</span>
                </div>
              );
            })}
            {activeChildFolders.length === 0 && activeFolderDocs.length === 0 ? (
              <div className="px-4 py-6 text-sm text-surface-500">
                {activeFolder === rootFolderPath ? 'Este espacio esta vacio.' : 'Esta carpeta esta vacia.'}
              </div>
            ) : activeFolderDocs.map(doc => (
              <div
                key={doc.id}
                onClick={() => onOpenDocument(doc)}
                draggable
                onDragStart={(e) => onDocDragStart(e, doc)}
                onDragEnd={onDocDragEnd}
                className="group flex items-center gap-3 px-4 py-3 rounded-lg border border-surface-800/80 bg-surface-800/40 hover:bg-surface-800/70 hover:border-surface-600/80 transition cursor-pointer"
              >
                <div className="text-surface-500">{getIcon(doc)}</div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-surface-200 truncate">{doc.name}</span>
                  <span className="text-[11px] text-surface-500 truncate">{doc.folder || defaultFolderName}</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/60 text-surface-300 uppercase">
                  {getDocBadge(doc)}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyDocument(doc);
                    }}
                    className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100"
                    title="Duplicar"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRenameDocument(doc);
                    }}
                    className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100"
                    title="Renombrar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveDocument(doc);
                    }}
                    className="p-1 rounded-md text-surface-400 hover:text-surface-100 hover:bg-surface-700/70 transition opacity-0 group-hover:opacity-100"
                    title="Mover"
                  >
                    <FolderInput className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => onDeleteDocument(doc, e)}
                    className="p-1 rounded-md text-surface-400 hover:text-mandy-400 hover:bg-mandy-500/10 transition opacity-0 group-hover:opacity-100"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default WorkspaceExplorer;
