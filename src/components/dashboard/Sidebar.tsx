'use client';

import type React from 'react';
import { Folder, FolderPlus, FolderUp, Loader2, Plus, Search, Settings, Trash2, Upload, X } from 'lucide-react';
import type { DocItem, Workspace } from '@/components/dashboard/types';
import { DEFAULT_FOLDER_NAME } from '@/lib/folder-utils';
import AssistantSection from '@/components/dashboard/AssistantSection';
import type { TerminalSession } from '@/context/TerminalContext';
import type { WorkerStatus } from '@/lib/TerminalController';
import type { User as FirebaseUser } from 'firebase/auth';

interface SidebarProps {
  sidebarWidth: number;
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
  connectionStatus: 'checking' | 'online' | 'offline' | 'error';
  isCreatingSession: boolean;
  activeSessionId: string | null;
  getWorkerStatusForWorkspace: (workspaceId: string) => WorkerStatus;
  getSessionsForWorkspace: (workspaceId: string) => TerminalSession[];
  createSession: (workspaceId: string, workspaceType: 'personal' | 'shared', workspaceName?: string) => void;
  selectSession: (sessionId: string) => void;
  destroySession: (sessionId: string) => void;
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
  setShowQuickSearch: (value: boolean) => void;
  quickSearchInputRef: React.RefObject<HTMLInputElement>;
  getIcon: (doc: DocItem) => React.ReactNode;
}

const Sidebar = ({
  sidebarWidth,
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
  connectionStatus,
  isCreatingSession,
  activeSessionId,
  getWorkerStatusForWorkspace,
  getSessionsForWorkspace,
  createSession,
  selectSession,
  destroySession,
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
  setShowQuickSearch,
  quickSearchInputRef,
  getIcon
}: SidebarProps) => {
  return (
    <>
      {showMobileSidebar && (
        <div className="absolute inset-0 z-30 bg-black/40 md:hidden" onClick={onCloseMobileSidebar} />
      )}

      <div
        style={{ width: sidebarWidth }}
        className={`
          bg-surface-800 border-r border-surface-600/50 flex flex-col shrink-0 transition-transform duration-200 absolute md:relative z-40 h-full
          ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
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

        <div className="flex-1 overflow-y-auto scrollbar-hide p-2 space-y-4">
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
            openTerminal={openTerminal}
            openTabs={openTabs}
            closeTabById={closeTabById}
          />

          <div>
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

            <div className="mt-1 space-y-0.5">
              {loadingDocs && docs.length === 0 && (
                <div className="px-3 py-2 text-center text-xs text-surface-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando archivos...
                </div>
              )}

              {!loadingDocs && sidebarFilteredDocs.length === 0 && (
                <div className="px-3 py-2 text-center text-xs text-surface-500">
                  {sidebarSearchQuery ? 'Sin resultados' : 'Espacio vacio'}
                </div>
              )}

              {sidebarFilteredDocs.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => openDocument(doc)}
                  draggable
                  onDragStart={(e) => handleDocDragStart(e, doc)}
                  onDragEnd={handleDocDragEnd}
                  className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-md cursor-pointer select-none transition ${selectedDocId === doc.id ? 'bg-surface-700 text-white font-medium' : 'text-surface-300 hover:bg-surface-700/50'}`}
                >
                  <div className={`${selectedDocId === doc.id ? 'text-white' : 'text-surface-500'}`}>
                    {getIcon(doc)}
                  </div>
                  <span className="truncate flex-1">{doc.name}</span>
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => deleteDocument(doc, e)}
                      className="text-surface-500 hover:text-mandy-400 p-0.5"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
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
