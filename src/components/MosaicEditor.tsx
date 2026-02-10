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
import { useTerminal } from '@/context/TerminalContext';
import {
  Bold, Italic, Heading as HeadingIcon, Link as LinkIcon, Code,
  Quote, List, ListOrdered, Table, Image as ImageIcon,
  Sigma, Columns, Maximize2, Minimize2, Check, Cloud,
  Type, LayoutGrid, Search, ArrowUp, ArrowDown, X
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import clsx from 'clsx';
import 'katex/dist/katex.min.css';
import { authFetch, withAuthToken, getAuthToken } from '@/services/apiClient';
import dynamic from 'next/dynamic';

const MermaidDiagram = dynamic(() => import('@/components/MermaidDiagram'), {
  ssr: false,
  loading: () => <div className="mermaid-loading"><span>Cargando diagrama…</span></div>
});

// Helper function to highlight text in DOM nodes
const highlightTextInNode = (node: Node, searchTerm: string, highlights: HTMLElement[]): void => {
  if (node.nodeType === Node.TEXT_NODE && node.textContent) {
    const text = node.textContent;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    if (parts.length > 1) {
      const fragment = document.createDocumentFragment();
      parts.forEach(part => {
        if (regex.test(part)) {
          const mark = document.createElement('mark');
          mark.className = 'search-highlight bg-yellow-400/60 text-inherit rounded px-0.5';
          mark.textContent = part;
          highlights.push(mark);
          fragment.appendChild(mark);
          regex.lastIndex = 0; // Reset regex state
        } else if (part) {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      node.parentNode?.replaceChild(fragment, node);
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // Skip script, style, and already highlighted elements
    const tagName = (node as Element).tagName?.toLowerCase();
    if (tagName === 'script' || tagName === 'style' || tagName === 'mark') return;

    // Process child nodes (create array first to avoid live collection issues)
    const children = Array.from(node.childNodes);
    children.forEach(child => highlightTextInNode(child, searchTerm, highlights));
  }
};

// Helper to clear highlights
const clearHighlights = (container: HTMLElement): void => {
  const marks = container.querySelectorAll('mark.search-highlight');
  marks.forEach(mark => {
    const parent = mark.parentNode;
    if (parent) {
      const text = document.createTextNode(mark.textContent || '');
      parent.replaceChild(text, mark);
      parent.normalize(); // Merge adjacent text nodes
    }
  });
};

const MarkdownPreview = React.memo(({ content }: { content: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkMath, remarkGfm]}
    rehypePlugins={[rehypeKatex, rehypeRaw]}
    components={{
      pre({ children }) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const child = React.Children.toArray(children)[0] as any;
        const className: string = child?.props?.className || '';
        if (/language-mermaid/.test(className)) {
          const code = String(child?.props?.children || '').replace(/\n$/, '');
          return <MermaidDiagram chart={code} />;
        }
        return <pre>{children}</pre>;
      }
    }}
  >
    {content}
  </ReactMarkdown>
));
MarkdownPreview.displayName = 'MarkdownPreview';

type ViewId = 'editor' | 'preview' | string;
type ViewMode = 'edit' | 'split' | 'preview';

interface SearchState {
  currentMatch: number;
  totalMatches: number;
}

interface EditorProps {
  initialContent?: string;
  roomId: string;
  onClose?: () => void;
  embedded?: boolean;
  viewMode?: ViewMode;
  externalSearchTerm?: string;
  onSearchStateChange?: (state: SearchState) => void;
  searchNavRef?: React.MutableRefObject<{ next: () => void; prev: () => void } | null>;
}

const ToolbarButton = ({ onClick, icon: Icon, title, active = false }: any) => (
  <button
    onClick={onClick}
    className={clsx(
      'p-1.5 rounded-md transition-[background-color,color,box-shadow] duration-200',
      active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
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
    splitPercentage: 50
  };
};

export default function MosaicEditor({
  initialContent = '',
  roomId,
  onClose,
  embedded = false,
  viewMode,
  externalSearchTerm,
  onSearchStateChange,
  searchNavRef
}: EditorProps) {
  const resolvedViewMode = viewMode ?? 'preview';
  const [content, setContent] = useState(initialContent);
  const [debouncedContent, setDebouncedContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [showEditorToolbar, setShowEditorToolbar] = useState(true);
  const [showEditorStatus, setShowEditorStatus] = useState(true);
  const [docType, setDocType] = useState<'text' | 'file'>('text');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileMime, setFileMime] = useState('');
  const [docName, setDocName] = useState('');

  const [layout, setLayout] = useState<MosaicNode<ViewId> | null>(() => getLayoutForMode(resolvedViewMode));

  // Search state - use external if provided (embedded mode), otherwise internal
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = setInternalSearchTerm;
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const highlightsRef = useRef<HTMLElement[]>([]);

  const { user } = useAuth();
  const { onDocChangeCallback } = useTerminal();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  const [usePolling, setUsePolling] = useState(false);
  const contentRef = useRef(content);
  const pendingLocalChangeRef = useRef(false);
  const lastRawKeyRef = useRef<string | null>(null);
  const rawLoadInFlightRef = useRef(false);

  useEffect(() => {
    if (!pendingLocalChangeRef.current) {
      setDebouncedContent(prev => (prev === content ? prev : content));
      return;
    }

    const handler = setTimeout(() => {
      setDebouncedContent(prev => (prev === content ? prev : content));
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [content]);

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
        const res = await authFetch(`/api/documents/${roomId}/raw`, { cache: 'no-store' });
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
        setDocName(name || 'Archivo');
        setContent('');
        hasLoadedRef.current = true;
        return;
    }

    setDocType('text');
    setFileUrl(null);
    setFileName('');
    setFileMime(mimeType);
    setDocName(name || 'Documento');

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
        const res = await authFetch(`/api/documents/${roomId}`, { cache: 'no-store' });
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

  // Listen for real-time document changes
  useEffect(() => {
    if (!onDocChangeCallback || !roomId) return;
    return onDocChangeCallback((event) => {
        // If the document created/updated is the one we are viewing, reload it
        if (event.docId === roomId && (event.action === 'updated' || event.action === 'created')) {
             // Only reload if not currently saving (to avoid overwriting own changes if race condition?)
             // Actually loadDoc() handles 'lastUpdatedBy' check somewhat in applyDocData
             loadDoc();
        }
    });
  }, [onDocChangeCallback, roomId, loadDoc]);

  // Polling fallback if needed (though onDocChangeCallback should handle it)

  useEffect(() => {
    if (!roomId) return;
    const controller = new AbortController();
    let cancelled = false;

    const init = async () => {
        const token = await getAuthToken();
        if (cancelled) return;

        try {
            const res = await fetch(`/api/documents/${roomId}/stream`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                signal: controller.signal
            });

            if (!res.ok) throw new Error('Stream connection failed');
            if (!res.body) throw new Error('No body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (!cancelled) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data?.type === 'snapshot') {
                                applyDocData(data.data);
                            } else if (data?.type === 'deleted') {
                                resetDocState();
                            }
                        } catch (e) {}
                    }
                }
            }
        } catch (e: any) {
            if (e.name !== 'AbortError' && !cancelled) {
                console.error('Stream error, falling back to polling:', e);
                setUsePolling(true);
            }
        }
    };

    init();

    return () => {
        cancelled = true;
        controller.abort();
    };
  }, [roomId, loadDoc, applyDocData, resetDocState]);

  const handleContentChange = useCallback((val: string) => {
    setContent(val);
    if (!roomId || docType === 'file') return;
    if (!hasLoadedRef.current) return;

    pendingLocalChangeRef.current = true;
    setSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
        try {
            const res = await authFetch(`/api/documents/${roomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: val,
                    type: 'text',
                    lastUpdatedBy: user?.uid
                })
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

  // Search logic - perform DOM-based highlighting
  useEffect(() => {
    if (!previewRef.current) return;

    // Clear previous highlights first
    clearHighlights(previewRef.current);
    highlightsRef.current = [];

    if (!searchTerm || searchTerm.length < 2) {
        setTotalMatches(0);
        setCurrentMatch(0);
        return;
    }

    const performHighlight = () => {
        if (!previewRef.current) return;

        const highlights: HTMLElement[] = [];
        highlightTextInNode(previewRef.current, searchTerm, highlights);
        highlightsRef.current = highlights;
        setTotalMatches(highlights.length);

        // Reset to first match if we have results
        if (highlights.length > 0) {
            setCurrentMatch(0);
        }
    };

    const timeout = setTimeout(performHighlight, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm, debouncedContent]);

  // Navigate to current match when it changes
  useEffect(() => {
    const highlights = highlightsRef.current;
    if (highlights.length === 0) return;

    highlights.forEach((mark, i) => {
        if (i === currentMatch) {
            mark.className = 'search-highlight bg-orange-500 text-white rounded px-0.5 ring-2 ring-orange-300';
            mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            mark.className = 'search-highlight bg-yellow-400/60 text-inherit rounded px-0.5';
        }
    });
  }, [currentMatch, totalMatches]);

  // Navigation function - must be defined before the effect that uses it
  const navigateSearch = useCallback((direction: 'next' | 'prev') => {
      if (totalMatches === 0) return;
      setCurrentMatch(prev => {
        let next = direction === 'next' ? prev + 1 : prev - 1;
        if (next >= totalMatches) next = 0;
        if (next < 0) next = totalMatches - 1;
        return next;
      });
  }, [totalMatches]);

  // Expose navigation functions via ref for parent components
  useEffect(() => {
    if (searchNavRef) {
      searchNavRef.current = {
        next: () => navigateSearch('next'),
        prev: () => navigateSearch('prev')
      };
    }
    return () => {
      if (searchNavRef) searchNavRef.current = null;
    };
  }, [searchNavRef, totalMatches, navigateSearch]);

  // Notify parent of search state changes
  useEffect(() => {
    if (onSearchStateChange) {
      onSearchStateChange({ currentMatch, totalMatches });
    }
  }, [currentMatch, totalMatches, onSearchStateChange]);

  const insert = (template: string) => {
      const next = content + template;
      handleContentChange(next);
  };

  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return {
      words,
      chars: content.length
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
       {!showEditorStatus && (
         <div className="ml-auto flex items-center gap-2 text-xs text-slate-500 font-mono">
            {saving ? <span className="text-blue-400 animate-pulse flex items-center gap-1"><Cloud className="w-3 h-3"/> Saving</span> : <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3"/> Saved</span>}
         </div>
       )}
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
                <div className="flex flex-col h-full bg-slate-900 overflow-hidden relative" ref={previewRef}>
                    <div className="flex-1 overflow-auto p-8 custom-scrollbar relative">
                        <article className="markdown-preview">
                            <MarkdownPreview content={debouncedContent} />
                        </article>
                    </div>
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
    <div className={clsx('flex flex-col h-full bg-slate-950 text-slate-300 relative', embedded && 'editor-embedded')}>
        {!embedded && (
          <div className="h-10 shrink-0 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-3">
               <div className="flex items-center gap-3 min-w-0 flex-1">
                   {onClose && (
                      <button onClick={onClose} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider shrink-0">
                          <ChevronLeft className="w-4 h-4" /> Exit
                      </button>
                   )}
                   <div className="h-4 w-px bg-slate-700 shrink-0" />
                   <span className="text-xs font-medium text-slate-400 truncate max-w-[200px]" title={docName}>{docName || 'Documento'}</span>
               </div>

               {/* Search Input */}
               <div className="flex items-center gap-2 mx-4">
                   <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-1 rounded">
                       <Search className="w-3.5 h-3.5 text-slate-500" />
                       <input
                           type="text"
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           placeholder="Buscar en documento..."
                           className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none w-40"
                       />
                       {searchTerm && (
                           <>
                               <span className="text-[10px] text-slate-500 font-mono px-1">
                                   {totalMatches > 0 ? `${currentMatch + 1}/${totalMatches}` : '0/0'}
                               </span>
                               <button onClick={() => navigateSearch('prev')} className="p-0.5 hover:bg-slate-700 rounded text-slate-400" title="Anterior">
                                   <ArrowUp className="w-3 h-3" />
                               </button>
                               <button onClick={() => navigateSearch('next')} className="p-0.5 hover:bg-slate-700 rounded text-slate-400" title="Siguiente">
                                   <ArrowDown className="w-3 h-3" />
                               </button>
                               <button onClick={() => setSearchTerm('')} className="p-0.5 hover:bg-slate-700 rounded text-slate-400" title="Limpiar">
                                   <X className="w-3 h-3" />
                               </button>
                           </>
                       )}
                   </div>
               </div>

               <div className="flex items-center gap-2 shrink-0">
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
                margin: 3px !important;
                box-shadow: none !important;
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
                background: transparent !important;
                z-index: 2 !important;
            }
            .mosaic-split.-row {
                width: 6px !important;
                margin-left: -3px !important;
                cursor: col-resize !important;
            }
            .mosaic-split.-column {
                height: 6px !important;
                margin-top: -3px !important;
                cursor: row-resize !important;
            }
            .mosaic-split:hover {
                background: rgba(233, 69, 96, 0.4) !important;
            }
            .cm-editor { height: 100%; font-family: 'Fira Code', monospace; }
            .editor-embedded .mosaic-window-toolbar {
                display: none !important;
            }
        `}</style>
    </div>
  );
}

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
  );
}
