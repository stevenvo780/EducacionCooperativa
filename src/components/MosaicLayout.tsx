"use client";

import React, { useCallback } from 'react';
import { Mosaic, MosaicWindow, MosaicNode, MosaicZeroState, MosaicPath } from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';
import { X, Pencil, Eye, Columns, Terminal as TerminalIcon, FileText } from 'lucide-react';
import dynamic from 'next/dynamic';

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false });
const Terminal = dynamic(() => import('@/components/Terminal'), { ssr: false });

export type ViewMode = 'edit' | 'preview' | 'split';

export interface DocItem {
  id: string;
  name: string;
  type?: 'text' | 'file' | 'folder' | 'terminal';
  content?: string;
  url?: string;
  folder?: string;
  storagePath?: string;
  
  // File props
  mimeType?: string;
  size?: number;
  updatedAt?: any;
  ownerId?: string;
}

interface MosaicLayoutProps {
  value: MosaicNode<string> | null;
  onChange: (newNode: MosaicNode<string> | null) => void;
  openTabs: DocItem[];
  docs: DocItem[];
  docModes: Record<string, ViewMode>;
  onSetDocMode: (docId: string, mode: ViewMode) => void;
  onCloseTab: (docId: string) => void;
  nexusUrl: string;
}

const MosaicLayout: React.FC<MosaicLayoutProps> = ({
  value,
  onChange,
  openTabs,
  docs,
  docModes,
  onSetDocMode,
  onCloseTab,
  nexusUrl
}) => {

  const renderCloseControl = useCallback((docId: string) => (
      <button
          onClick={(e) => {
              e.stopPropagation();
              onCloseTab(docId);
          }}
          className="p-1 rounded transition text-slate-400 hover:bg-mandy-600/20 hover:text-mandy-300"
          title="Cerrar"
      >
          <X className="w-4 h-4" />
      </button>
  ), [onCloseTab]);

  const renderDocModeControls = useCallback((docId: string, mode: ViewMode) => (
      <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
          <button
              onClick={() => onSetDocMode(docId, 'edit')}
              className={`p-1 rounded transition ${mode === 'edit' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'}`}
              title="Edicion"
              aria-pressed={mode === 'edit'}
          >
              <Pencil className="w-4 h-4" />
          </button>
          <button
              onClick={() => onSetDocMode(docId, 'preview')}
              className={`p-1 rounded transition ${mode === 'preview' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'}`}
              title="Vista"
              aria-pressed={mode === 'preview'}
          >
              <Eye className="w-4 h-4" />
          </button>
          <button
              onClick={() => onSetDocMode(docId, 'split')}
              className={`p-1 rounded transition ${mode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'}`}
              title="Dividir"
              aria-pressed={mode === 'split'}
          >
              <Columns className="w-4 h-4" />
          </button>
          </div>
          <span className="h-4 w-px bg-slate-700" />
          {renderCloseControl(docId)}
      </div>
  ), [renderCloseControl, onSetDocMode]);

  const renderTile = (id: string, path: MosaicPath) => {
    const doc = openTabs.find(t => t.id === id) || docs.find(d => d.id === id);
    if (!doc) return <div className="p-4 text-surface-400">Documento no encontrado: {id}</div>;

    const isTerminal = doc.type === 'terminal';
    const mode = docModes[doc.id] ?? 'preview';
    
    return (
        <MosaicWindow<string>
            path={path}
            title={doc.name}
            className="bg-surface-900 border border-surface-700"
            toolbarControls={isTerminal ? renderCloseControl(doc.id) : renderDocModeControls(doc.id, mode)}
            renderPreview={() => (
                <div className="flex items-center gap-2 p-1">
                   {isTerminal ? <TerminalIcon className="w-4 h-4 text-mandy-400" /> : <FileText className="w-4 h-4 text-sky-400" />}
                   <span className="text-sm font-medium text-surface-200">{doc.name}</span>
                </div>
            )}
        >
            <div className="h-full w-full bg-black relative">
                 {isTerminal ? (
                      <Terminal nexusUrl={nexusUrl} />
                  ) : (
                      <Editor roomId={doc.id} embedded viewMode={mode} />
                  )}
            </div>
        </MosaicWindow>
    );
  };

  return (
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
  );
};

export default MosaicLayout;
