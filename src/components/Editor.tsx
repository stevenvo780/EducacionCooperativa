'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Mosaic,
  MosaicWindow,
  MosaicNode,
  MosaicPath
} from 'react-mosaic-component';
import 'react-mosaic-component/react-mosaic-component.css';

import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { useAuth } from '@/context/AuthContext';
import {
  Bold, Italic, Heading as HeadingIcon, Link as LinkIcon, Code,
  Quote, List, ListOrdered, Table, Image as ImageIcon,
  Sigma, Columns, Maximize2, Minimize2, Check, Cloud,
  Type, LayoutGrid
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import 'katex/dist/katex.min.css';


type ViewId = 'editor' | 'preview' | string;
type ViewMode = 'edit' | 'split' | 'preview';

interface EditorProps {
  initialContent?: string;
  roomId: string;
  onClose?: () => void;
  embedded?: boolean;
  viewMode?: ViewMode;
}


const ToolbarButton = ({ onClick, icon: Icon, title, active = false }: any) => (
  <button
    onClick={onClick}
    className={clsx(
      "p-1.5 rounded-md transition-all duration-200",
      active ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:bg-slate-700 hover:text-slate-100"
    )}
    title={title}
  >
    <Icon className="w-4 h-4" />
  </button>
);

const Divider = () => <div className="w-px h-5 bg-slate-700 mx-1 self-center" />;

const isMarkdownName = (name?: string) => {
  const lower = (name ?? '').toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdown') || lower.endsWith('.mkd');
};

const isMarkdownMime = (mime?: string) => (mime ?? '').toLowerCase().includes('markdown');
const isImageMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('image/');
const isVideoMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('video/');
const isAudioMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('audio/');
const isPdfMime = (mime?: string) => (mime ?? '').toLowerCase() === 'application/pdf';

const getLayoutForMode = (mode: ViewMode): MosaicNode<ViewId> => {
  if (mode === 'edit') return 'editor';
  if (mode === 'preview') return 'preview';
  return {
    direction: 'row',
    first: 'editor',
    second: 'preview',
    splitPercentage: 50,
  };
};


export default function MosaicEditor({
  initialContent = '',
  roomId,
  onClose,
  embedded = false,
  viewMode,
}: EditorProps) {
  const resolvedViewMode = viewMode ?? 'preview';
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [showEditorToolbar, setShowEditorToolbar] = useState(true);
  const [showEditorStatus, setShowEditorStatus] = useState(true);
  const [docType, setDocType] = useState<'text' | 'file'>('text');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileMime, setFileMime] = useState('');

  // Initial Layout: Editor (Left) | Preview (Right)
  const [layout, setLayout] = useState<MosaicNode<ViewId> | null>(() => getLayoutForMode(resolvedViewMode));

  const { user } = useAuth();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  const [usePolling, setUsePolling] = useState(false);
  const contentRef = useRef(content);
  const pendingLocalChangeRef = useRef(false);
  const lastRawKeyRef = useRef<string | null>(null);
  const rawLoadInFlightRef = useRef(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    setLayout(getLayoutForMode(resolvedViewMode));
  }, [resolvedViewMode]);

  const resetDocState = useCallback(() => {
    setDocType('text');
    setFileUrl(null);
    setFileName('');
    setFileMime('');
    setContent('');
    hasLoadedRef.current = true;
  }, []);

  const maybeLoadRawContent = useCallback(async (key: string | null) => {
    if (!roomId || !key) return;
    if (rawLoadInFlightRef.current || key === lastRawKeyRef.current) return;
    rawLoadInFlightRef.current = true;
    lastRawKeyRef.current = key;
    try {
        const res = await fetch(`/api/documents/${roomId}/raw`, { cache: 'no-store' });
        if (!res.ok) return;
        const text = await res.text();
        if (text && text !== contentRef.current) {
            setContent(text);
        }
    } catch (e) {
        console.error('Error loading raw content:', e);
    } finally {
        rawLoadInFlightRef.current = false;
    }
  }, [roomId]);

  const applyDocData = useCallback((data: any) => {
    if (!data) {
        resetDocState();
        return;
    }

    const type = data.type ?? 'text';
    const name = data.name ?? '';
    const mimeType = data.mimeType ?? '';
    const url = data.url ?? null;
    const storagePath = data.storagePath ?? null;
    const isMarkdown = isMarkdownMime(mimeType) || isMarkdownName(name);

    if (type === 'file' && !isMarkdown) {
        setDocType('file');
        setFileUrl(url);
        setFileName(name || 'Archivo');
        setFileMime(mimeType);
        setContent('');
        hasLoadedRef.current = true;
        return;
    }

    setDocType('text');
    setFileUrl(null);
    setFileName('');
    setFileMime(mimeType);

    const incoming = typeof data.content === 'string' ? data.content : null;
    if (incoming !== null) {
        const same = incoming === contentRef.current;
        const skipOwn = pendingLocalChangeRef.current && data.lastUpdatedBy === user?.uid && !same;
        if (!same && !skipOwn) {
            setContent(incoming);
        }
    } else if (type === 'file' && (url || storagePath)) {
        const rawKey = storagePath || url;
        maybeLoadRawContent(rawKey);
    } else if (!pendingLocalChangeRef.current) {
        setContent('');
    }

    hasLoadedRef.current = true;
  }, [maybeLoadRawContent, resetDocState, user?.uid]);

  const loadDoc = useCallback(async () => {
    if (!roomId) return;
    try {
        const res = await fetch(`/api/documents/${roomId}`, { cache: 'no-store' });
        if (!res.ok) {
            resetDocState();
            return;
        }
        const data = await res.json();
        applyDocData(data);
    } catch (e) {
        console.error('Error loading document:', e);
    }
  }, [roomId, applyDocData, resetDocState]);

  useEffect(() => {
    if (!roomId) return;
    hasLoadedRef.current = false;
    pendingLocalChangeRef.current = false;
    lastRawKeyRef.current = null;
    setUsePolling(false);
    loadDoc();
  }, [roomId, loadDoc]);

  useEffect(() => {
    if (!roomId) return;
    const source = new EventSource(`/api/documents/${roomId}/stream`);

    source.onmessage = (event) => {
        try {
            const payload = JSON.parse(event.data);
            if (payload?.type === 'snapshot') {
                applyDocData(payload.data);
            } else if (payload?.type === 'deleted') {
                resetDocState();
            }
        } catch (e) {
            console.error('Error parsing live update:', e);
        }
    };

    source.onerror = () => {
        source.close();
        setUsePolling(true);
    };

    return () => {
        source.close();
    };
  }, [roomId, applyDocData, resetDocState]);

  useEffect(() => {
    if (!usePolling) return;
    const interval = setInterval(() => {
        loadDoc();
    }, 5000);
    return () => clearInterval(interval);
  }, [usePolling, loadDoc]);

  const handleContentChange = useCallback((val: string) => {
    setContent(val);
    if (!roomId || docType === 'file') return;
    if (!hasLoadedRef.current) return;

    pendingLocalChangeRef.current = true;
    setSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
        try {
            const res = await fetch(`/api/documents/${roomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: val,
                    type: 'text',
                    lastUpdatedBy: user?.uid,
                }),
            });
            if (!res.ok) {
                throw new Error('Failed to save');
            }
        } catch (e) {
            console.error('Error saving:', e);
        } finally {
            pendingLocalChangeRef.current = false;
            setSaving(false);
        }
    }, 700);
  }, [roomId, user?.uid, docType]);

  useEffect(() => () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  }, []);

  const insert = (template: string, offset = 0) => {
      // Simple append for now. In a real app, we'd use a Ref to the CodeMirror instance
      // to insert at cursor position.
      const next = content + template;
      handleContentChange(next);
  };

  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return {
      words,
      chars: content.length,
    };
  }, [content]);

  const Toolbar = () => (
    <div className="flex items-center gap-1 p-2 bg-slate-800 border-b border-slate-700 select-none overflow-x-auto custom-scrollbar">
       <div className="flex items-center gap-1 shrink-0">
          <ToolbarButton icon={Bold} title="Bold (**b**)" onClick={() => insert('**Bold**')} />
          <ToolbarButton icon={Italic} title="Italic (*i*)" onClick={() => insert('*Italic*')} />
          <ToolbarButton icon={Code} title="Inline Code (`c`)" onClick={() => insert('`code`')} />
       </div>
       <Divider />
       <div className="flex items-center gap-1 shrink-0">
          <ToolbarButton icon={HeadingIcon} title="Heading 1" onClick={() => insert('# ')} />
          <ToolbarButton icon={Quote} title="Blockquote" onClick={() => insert('> ')} />
       </div>
       <Divider />
       <div className="flex items-center gap-1 shrink-0">
          <ToolbarButton icon={List} title="Bullet List" onClick={() => insert('- ')} />
          <ToolbarButton icon={ListOrdered} title="Numbered List" onClick={() => insert('1. ')} />
          <ToolbarButton icon={Table} title="Table" onClick={() => insert('\n| Col 1 | Col 2 |\n|---|---|\n| Val 1 | Val 2 |\n')} />
       </div>
       <Divider />
       <div className="flex items-center gap-1 shrink-0">
          <ToolbarButton icon={Sigma} title="Math Block ($$)" onClick={() => insert('\n$$ \n x = \\frac{-b \\pm \sqrt{b^2 - 4ac}}{2a} \n$$ \n')} />
          <ToolbarButton icon={Type} title="Inline Math ($)" onClick={() => insert('$x^2$')} />
       </div>
       <Divider />
       <div className="flex items-center gap-1 shrink-0">
          <ToolbarButton icon={LinkIcon} title="Link" onClick={() => insert('[Link Title](url)')} />
          <ToolbarButton icon={ImageIcon} title="Image" onClick={() => insert('![Alt](url)')} />
       </div>
       <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 font-mono">
          {saving ? <span className="text-blue-400 animate-pulse flex items-center gap-1"><Cloud className="w-3 h-3"/> Saving</span> : <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3"/> Saved</span>}
       </div>
       <button
         onClick={() => setShowEditorToolbar(false)}
         className="ml-1 p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-slate-100"
         title="Hide toolbar"
       >
         <Minimize2 className="w-4 h-4" />
       </button>
    </div>
  );

    const renderTile = (id: ViewId, path: MosaicPath) => {
      if (id === 'editor' || id.startsWith('editor')) {
          return (
            <MosaicWindow
              path={path}
              createNode={() => 'new'}
              title={`Editor`}
              className="bg-slate-900"
              toolbarControls={[]} 
              renderPreview={() => <div className="p-2 text-white">Editor Preview</div>}
            >
            <div className="flex flex-col h-full bg-slate-950 relative">
                {showEditorToolbar && <Toolbar />}
                {!showEditorToolbar && (
                  <button
                    onClick={() => setShowEditorToolbar(true)}
                    className="absolute top-2 left-2 z-10 p-1.5 rounded-md bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700"
                    title="Show toolbar"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
                <div className="flex-1 overflow-hidden relative">
                    <CodeMirror
                        value={content}
                        height="100%"
                        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
                        onChange={handleContentChange}
                        theme="dark"
                        className="text-base h-full"
                        basicSetup={{
                            lineNumbers: true, 
                            foldGutter: true, 
                            highlightActiveLine: true,
                            autocompletion: true
                        }}
                    />
                </div>
                {showEditorStatus && (
                  <div className="shrink-0 h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-3 text-[11px] text-slate-400">
                    <div className="flex items-center gap-3">
                      <span>Markdown</span>
                      <span>{stats.words} words</span>
                      <span>{stats.chars} chars</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {saving ? (
                        <span className="text-blue-400 flex items-center gap-1"><Cloud className="w-3 h-3" /> Saving</span>
                      ) : (
                        <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>
                      )}
                      <button
                        onClick={() => setShowEditorStatus(false)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                        title="Hide status bar"
                      >
                        <Minimize2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
                {!showEditorStatus && (
                  <button
                    onClick={() => setShowEditorStatus(true)}
                    className="absolute bottom-2 right-2 z-10 p-1.5 rounded-md bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700"
                    title="Show status bar"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
            </div>
          </MosaicWindow>
        );
      } 
      
      if (id === 'preview' || id.startsWith('preview')) {
          return (
              <MosaicWindow
                path={path}
                createNode={() => 'new'}
                title="Markdown Preview"
                className="bg-slate-900"
                toolbarControls={[]}
              >
                <div className="h-full overflow-auto p-8 bg-slate-900 custom-scrollbar">
                    <article className="markdown-preview">
                        <ReactMarkdown 
                            remarkPlugins={[remarkMath, remarkGfm]} 
                            rehypePlugins={[rehypeKatex]}
                        >
                            {content}
                        </ReactMarkdown>
                    </article>
                </div>
              </MosaicWindow>
          );
      }
  
      return <div className="text-white p-4">Unknown Window: {id}</div>;
    };

  if (docType === 'file') {
    const safeName = fileName || 'Archivo';
    const lowerName = safeName.toLowerCase();
    const isImage = isImageMime(fileMime) || /\.(png|jpe?g|gif|webp|svg)$/.test(lowerName);
    const isPdf = isPdfMime(fileMime) || lowerName.endsWith('.pdf');
    const isVideo = isVideoMime(fileMime);
    const isAudio = isAudioMime(fileMime);

    return (
      <div className="flex flex-col h-full bg-slate-950 text-white">
        <div className="h-12 shrink-0 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-4">
          <div className="flex items-center gap-3 min-w-0">
            {onClose && (
              <button onClick={onClose} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider">
                <ChevronLeft className="w-4 h-4" /> Volver
              </button>
            )}
            <div className="h-4 w-px bg-slate-700" />
            <span className="text-xs font-medium text-slate-400 truncate">{safeName}</span>
          </div>
          <div className="flex items-center gap-2">
            {fileUrl && (
              <>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded hover:bg-slate-700"
                >
                  Abrir
                </a>
                <a
                  href={fileUrl}
                  download
                  className="text-xs bg-blue-600 px-2 py-1 rounded hover:bg-blue-500"
                >
                  Descargar
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 p-4 bg-slate-900 flex items-center justify-center">
          {!fileUrl && (
            <div className="text-sm text-slate-400">No se pudo cargar el archivo.</div>
          )}
          {fileUrl && isImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={fileUrl} alt={safeName} className="max-h-full max-w-full rounded shadow" />
          )}
          {fileUrl && isVideo && (
            <video src={fileUrl} controls className="max-h-full max-w-full rounded shadow" />
          )}
          {fileUrl && isAudio && (
            <audio src={fileUrl} controls className="w-full max-w-xl" />
          )}
          {fileUrl && !isImage && !isVideo && !isAudio && (
            <iframe
              src={fileUrl}
              className={`w-full h-full border border-slate-700 rounded bg-white ${isPdf ? '' : 'min-h-[70vh]'}`}
              title={safeName}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx("flex flex-col h-full bg-slate-950 text-slate-300 relative", embedded && "editor-embedded")}>
        {/* Global App Bar */}
        {!embedded && (
          <div className="h-10 shrink-0 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-3">
               <div className="flex items-center gap-3">
                   {onClose && (
                      <button onClick={onClose} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider">
                          <ChevronLeft className="w-4 h-4" /> Exit
                      </button>
                   )}
                   <div className="h-4 w-px bg-slate-700" />
                   <span className="text-xs font-medium text-slate-500">Workspace</span>
               </div>
               
               <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setLayout({ direction: 'row', first: 'editor', second: 'preview', splitPercentage: 50 })}
                     className="flex items-center gap-1 px-2 py-1 hover:bg-slate-800 rounded text-xs text-slate-400"
                   >
                      <Columns className="w-3 h-3" /> Reset Layout
                   </button>
                   <button 
                     onClick={() => setLayout({ direction: 'column', first: 'editor', second: 'preview', splitPercentage: 50 })}
                     className="flex items-center gap-1 px-2 py-1 hover:bg-slate-800 rounded text-xs text-slate-400"
                   >
                      <LayoutGrid className="w-3 h-3" /> Split V
                   </button>
               </div>
          </div>
        )}

        {/* Mosaic Grid Area */}
        <div className="flex-1 relative overflow-hidden">
                <Mosaic
                    renderTile={renderTile}
                    value={layout}
                    onChange={setLayout}
                    className="mosaic-blueprint-theme mosaic-custom-dark"
                />
        </div>

        <style jsx global>{`
            .mosaic-custom-dark {
                background: #0f172a; 
            }
            .mosaic-root {
                top: 0 !important;
                bottom: 0 !important;
                left: 0 !important;
                right: 0 !important;
            }
            .mosaic-tile {
                margin: 0 !important; /* Remove gaps */
                box-shadow: none !important;
                border-left: 1px solid #334155; 
                border-bottom: 1px solid #334155;
            }
            .mosaic-tile:first-child {
                border-left: none;
            }
            .mosaic-window {
                box-shadow: none !important;
                background: #0f172a !important;
            }
            .mosaic-window-toolbar {
                height: 36px !important;
                background: #1e293b !important;
                box-shadow: none !important;
                border-bottom: 1px solid #334155 !important;
                display: flex !important;
                align-items: center !important;
                padding: 0 8px !important;
            }
            .mosaic-window-title {
                font-size: 13px !important;
                font-weight: 500 !important;
                color: #e2e8f0 !important;
                text-transform: none !important;
                letter-spacing: normal !important;
            }
            .mosaic-window-controls .mosaic-default-control {
                color: #94a3b8 !important;
                padding: 4px !important;
                margin-left: 4px !important;
                border-radius: 4px !important;
            }
            .mosaic-window-controls .mosaic-default-control:hover {
                background: #334155 !important;
                color: #f8fafc !important;
            }
            .mosaic-split {
                background: #1e293b !important;
                width: 1px !important; 
                height: 1px !important;
                z-index: 10 !important;
            }
            .mosaic-split:hover {
                background: #3b82f6 !important;
                box-shadow: 0 0 0 1px #3b82f6 !important;
            }
            .cm-editor { height: 100%; font-family: 'Fira Code', monospace; }
            .editor-embedded .mosaic-window-toolbar {
                display: none !important;
            }
        `}</style>
    </div>
  );
}

// Helper icons
function ChevronLeft(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
