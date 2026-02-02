'use client';

import React, { useCallback, useMemo } from 'react';
import { Mosaic, MosaicWindow, MosaicNode, MosaicZeroState, MosaicPath } from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import { Columns, Eye, Pencil, X, Terminal as TerminalIcon } from 'lucide-react';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false });
const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });
const FileExplorer = dynamic(() => import('@/components/FileExplorer'), { ssr: false });

export type ViewMode = 'edit' | 'preview' | 'split';

export interface DocItem {
  id: string;
  name: string;
  type?: 'text' | 'file' | 'folder' | 'terminal' | 'files';
    sessionId?: string;
  content?: string;
  url?: string;
  folder?: string;
  storagePath?: string;
  workspaceId?: string;

  mimeType?: string;
  size?: number;
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
  activeFolder?: string;
  onActiveFolderChange?: (folderPath: string) => void;
  currentWorkspaceName?: string;
  currentWorkspaceId?: string;
  currentWorkspaceType?: 'personal' | 'shared';
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
  activeFolder,
  onActiveFolderChange,
  currentWorkspaceName,
  currentWorkspaceId,
  currentWorkspaceType,
  nexusUrl
}) => {
  const fileExplorerDocs = useMemo(() => {
      return docs.filter(d => d.type !== 'terminal' && d.type !== 'files');
  }, [docs]);

  const renderToolbarControls = useCallback((doc: { id: string; type?: string }, mode: ViewMode) => {
    const isTextDoc = doc.type !== 'terminal' && doc.type !== 'files';

    return (
      <div className="flex items-center gap-1">
        {isTextDoc && (
          <>
            <button
              onClick={() => onSetDocMode(doc.id, 'edit')}
              className={`p-1 rounded transition ${mode === 'edit' ? 'bg-sky-600 text-white' : 'text-surface-400 hover:bg-surface-700 hover:text-white'}`}
              title="Edicion"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetDocMode(doc.id, 'preview')}
              className={`p-1 rounded transition ${mode === 'preview' ? 'bg-emerald-600 text-white' : 'text-surface-400 hover:bg-surface-700 hover:text-white'}`}
              title="Vista"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetDocMode(doc.id, 'split')}
              className={`p-1 rounded transition ${mode === 'split' ? 'bg-indigo-600 text-white' : 'text-surface-400 hover:bg-surface-700 hover:text-white'}`}
              title="Dividir"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
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
  }, [onSetDocMode, onCloseTab]);

  const renderTile = useCallback((id: string, path: MosaicPath) => {
    const doc = openTabs.find(t => t.id === id) || docs.find(d => d.id === id);
    if (!doc) return <div className="p-4 text-surface-400">Documento no encontrado: {id}</div>;

    const isTerminal = doc.type === 'terminal';
    const isFileExplorer = doc.type === 'files';
    const mode = docModes[doc.id] ?? 'preview';

    return (
        <MosaicWindow<string>
            path={path}
            title={doc.name}
            className="bg-surface-900 mosaic-window-compact"
            toolbarControls={renderToolbarControls(doc, mode)}
        >
            <div className="h-full w-full bg-black relative">
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
                        onCreateFolder={onCreateFolder}
                        onUploadFile={onUploadFile}
                        onUploadFolder={onUploadFolder}
                        onDeleteDoc={onDeleteDoc}
                        onDeleteFolder={onDeleteFolder}
                        onDeleteItems={onDeleteItems}
                        onDuplicateDoc={onDuplicateDoc}
                        onMoveDoc={onMoveDoc}
                        onRenameDoc={onRenameDoc}
                        activeFolder={activeFolder}
                        onActiveFolderChange={onActiveFolderChange}
                        currentWorkspaceName={currentWorkspaceName}
                        currentWorkspaceId={currentWorkspaceId}
                        embedded
                      />
                  ) : (
                      <Editor roomId={doc.id} embedded viewMode={mode} />
                  )}
            </div>
        </MosaicWindow>
    );
  }, [
    openTabs, docs, docModes, nexusUrl, renderToolbarControls,
    currentWorkspaceId, currentWorkspaceName, currentWorkspaceType, folders,
    onSelectDoc, onCreateFile, onCreateFolder, onUploadFile, onUploadFolder,
    onDeleteDoc, onDeleteFolder, onDeleteItems, onDuplicateDoc, onMoveDoc,
    activeFolder, onActiveFolderChange, fileExplorerDocs
  ]);

  return (
    <>
      <Mosaic<string>
          renderTile={renderTile}
          value={value}
          onChange={onChange}
          className="mosaic-blueprint-theme mosaic-custom-dark h-full w-full"
          zeroStateView={
              <div className="h-full w-full flex flex-col items-center justify-center text-surface-400 p-8 text-center">
                  <div className="max-w-md space-y-4">
                      <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <Columns className="w-8 h-8 text-surface-400" />
                      </div>
                      <h3 className="text-xl font-medium text-surface-200">No hay paneles abiertos</h3>
                      <p className="text-surface-400">Selecciona un archivo del explorador o abre una nueva terminal para comenzar.</p>
                  </div>
              </div>
          }
      />
      <style jsx global>{`
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
      `}</style>
    </>
  );
};

export default MosaicLayout;
