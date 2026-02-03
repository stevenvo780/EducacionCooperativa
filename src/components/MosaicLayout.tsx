'use client';

import React, { useCallback, useMemo, useState, useRef } from 'react';
import { Mosaic, MosaicWindow, MosaicNode, MosaicZeroState, MosaicPath } from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import { Columns, Eye, Pencil, X, Terminal as TerminalIcon, Search, ChevronUp, ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false });
const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });
const FileExplorer = dynamic(() => import('@/components/FileExplorer'), { ssr: false });
const KanbanBoard = dynamic(() => import('@/components/dashboard/KanbanBoard'), { ssr: false });

interface SearchState {
  currentMatch: number;
  totalMatches: number;
}

export type ViewMode = 'edit' | 'preview' | 'split';

export interface DocItem {
  id: string;
  name: string;
  type?: 'text' | 'file' | 'folder' | 'terminal' | 'files' | 'board';
    sessionId?: string;
  content?: string;
  url?: string;
  folder?: string;
  storagePath?: string;
  workspaceId?: string;
  order?: number;

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
  order?: number;
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
  onReorderDocs?: (payload: { folderPath: string; orderedIds: string[] }) => void;
  onReorderFolders?: (payload: { parentPath: string; orderedPaths: string[] }) => void;
  activeFolder?: string;
  onActiveFolderChange?: (folderPath: string) => void;
  currentWorkspaceName?: string;
  currentWorkspaceId?: string;
  currentWorkspaceType?: 'personal' | 'shared';
  currentUserId?: string;
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
  onReorderDocs,
  onReorderFolders,
  activeFolder,
  onActiveFolderChange,
  currentWorkspaceName,
  currentWorkspaceId,
  currentWorkspaceType,
  currentUserId,
  nexusUrl
}) => {
  // Search state per document
  const [docSearchTerms, setDocSearchTerms] = useState<Record<string, string>>({});
  const [docSearchStates, setDocSearchStates] = useState<Record<string, SearchState>>({});
  const searchNavRefs = useRef<Record<string, { next: () => void; prev: () => void } | null>>({});

  const fileExplorerDocs = useMemo(() => {
      return docs.filter(d => d.type !== 'terminal' && d.type !== 'files' && d.type !== 'board');
  }, [docs]);
  const tabById = useMemo(() => new Map(openTabs.map(tab => [tab.id, tab])), [openTabs]);
  const docById = useMemo(() => new Map(docs.map(doc => [doc.id, doc])), [docs]);

  const handleSearchChange = useCallback((docId: string, value: string) => {
    setDocSearchTerms(prev => ({ ...prev, [docId]: value }));
  }, []);

  const handleSearchStateChange = useCallback((docId: string, state: SearchState) => {
    setDocSearchStates(prev => ({ ...prev, [docId]: state }));
  }, []);

  const getSearchNavRef = useCallback((docId: string) => {
    // Create a ref-like object for the specific docId
    const refObj = {
      get current() {
        return searchNavRefs.current[docId] || null;
      },
      set current(value: { next: () => void; prev: () => void } | null) {
        searchNavRefs.current[docId] = value;
      }
    };
    return refObj as React.MutableRefObject<{ next: () => void; prev: () => void } | null>;
  }, []);

  const renderToolbarControls = useCallback((doc: { id: string; type?: string }, mode: ViewMode) => {
    const isTextDoc = doc.type !== 'terminal' && doc.type !== 'files' && doc.type !== 'board';
    const searchTerm = docSearchTerms[doc.id] || '';
    const searchState = docSearchStates[doc.id] || { currentMatch: 0, totalMatches: 0 };

    return (
      <div className="flex items-center gap-1">
        {isTextDoc && (
          <>
            {/* Search input with navigation */}
            <div className="relative flex items-center gap-1">
              <div className="relative flex items-center">
                <Search className="absolute left-1.5 w-3 h-3 text-surface-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(doc.id, e.target.value)}
                  className="w-24 pl-5 pr-1.5 py-0.5 text-xs bg-surface-800 border border-surface-600 rounded text-surface-200 placeholder-surface-500 focus:outline-none focus:border-sky-500 transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => handleSearchChange(doc.id, '')}
                    className="absolute right-1 p-0.5 text-surface-500 hover:text-surface-300"
                    title="Limpiar"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              {/* Match count and navigation */}
              {searchTerm && searchState.totalMatches > 0 && (
                <>
                  <span className="text-xs text-surface-400 min-w-[3rem] text-center">
                    {searchState.currentMatch + 1}/{searchState.totalMatches}
                  </span>
                  <button
                    onClick={() => searchNavRefs.current[doc.id]?.prev()}
                    className="p-0.5 rounded text-surface-400 hover:bg-surface-700 hover:text-white transition"
                    title="Anterior (↑)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => searchNavRefs.current[doc.id]?.next()}
                    className="p-0.5 rounded text-surface-400 hover:bg-surface-700 hover:text-white transition"
                    title="Siguiente (↓)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {searchTerm && searchState.totalMatches === 0 && (
                <span className="text-xs text-mandy-400">Sin resultados</span>
              )}
            </div>
            <span className="w-px h-4 bg-surface-600 mx-1" />
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
  }, [onSetDocMode, onCloseTab, docSearchTerms, docSearchStates, handleSearchChange]);

  const renderTile = useCallback((id: string, path: MosaicPath) => {
    const doc = tabById.get(id) || docById.get(id);
    if (!doc) return <div className="p-4 text-surface-400">Documento no encontrado: {id}</div>;

    const isTerminal = doc.type === 'terminal';
    const isFileExplorer = doc.type === 'files';
    const isBoard = doc.type === 'board';
    const mode = docModes[doc.id] ?? 'preview';
    const searchTerm = docSearchTerms[doc.id] || '';

    return (
        <MosaicWindow<string>
            path={path}
            title={doc.name}
            className="bg-surface-900 mosaic-window-compact"
            toolbarControls={renderToolbarControls(doc, mode)}
        >
            <div className={`h-full w-full relative ${isBoard ? 'bg-surface-900' : 'bg-black'}`}>
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
                        docs={fileExplorerDocs as any}
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
                        onReorderDocs={onReorderDocs}
                        onReorderFolders={onReorderFolders}
                        activeFolder={activeFolder}
                        onActiveFolderChange={onActiveFolderChange}
                        currentWorkspaceName={currentWorkspaceName}
                        currentWorkspaceId={currentWorkspaceId}
                        embedded
                      />
                  ) : isBoard ? (
                      <KanbanBoard
                        workspaceId={doc.workspaceId ?? currentWorkspaceId}
                        workspaceName={currentWorkspaceName}
                        ownerId={doc.ownerId ?? currentUserId}
                      />
                  ) : (
                      <Editor
                        roomId={doc.id}
                        embedded
                        viewMode={mode}
                        externalSearchTerm={searchTerm}
                        onSearchStateChange={(state) => handleSearchStateChange(doc.id, state)}
                        searchNavRef={getSearchNavRef(doc.id)}
                      />
                  )}
            </div>
        </MosaicWindow>
    );
  }, [
    tabById, docById, docModes, nexusUrl, renderToolbarControls, docSearchTerms,
    currentWorkspaceId, currentWorkspaceName, currentWorkspaceType, currentUserId, folders,
    onSelectDoc, onCreateFile, onCreateFolder, onUploadFile, onUploadFolder,
    onDeleteDoc, onDeleteFolder, onDeleteItems, onDuplicateDoc, onMoveDoc, onRenameDoc,
    onReorderDocs, onReorderFolders,
    activeFolder, onActiveFolderChange, fileExplorerDocs,
    handleSearchStateChange, getSearchNavRef
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
