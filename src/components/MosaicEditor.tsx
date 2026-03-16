'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  tablePlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CodeToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  Separator,
  InsertCodeBlock,
  DiffSourceToggleWrapper,
  UndoRedo,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

import { useAuth } from '@/context/AuthContext';
import { useTerminal } from '@/context/TerminalContext';
import { Check, Cloud, Search, ArrowUp, ArrowDown, X } from 'lucide-react';
import clsx from 'clsx';
import 'katex/dist/katex.min.css';
import { authFetch, getAuthToken } from '@/services/apiClient';
import { usePageVisibility } from '@/hooks/usePageVisibility';

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

const isMarkdownName = (name?: string) => {
  const lower = (name ?? '').toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdown') || lower.endsWith('.mkd');
};

const isMarkdownMime = (mime?: string) => (mime ?? '').toLowerCase().includes('markdown');
const isImageMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('image/');
const isVideoMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('video/');
const isAudioMime = (mime?: string) => (mime ?? '').toLowerCase().startsWith('audio/');
const isPdfMime = (mime?: string) => (mime ?? '').toLowerCase() === 'application/pdf';

export default function MosaicEditor({
  initialContent = '',
  roomId,
  onClose,
  embedded = false,
  externalSearchTerm,
  onSearchStateChange,
  searchNavRef
}: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<'text' | 'file'>('text');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileMime, setFileMime] = useState('');
  const [docName, setDocName] = useState('');

  // Search state
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = setInternalSearchTerm;
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const { user } = useAuth();
  const { onDocChangeCallback } = useTerminal();
  const isPageVisible = usePageVisibility();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false);
  const contentRef = useRef(content);
  const pendingLocalChangeRef = useRef(false);
  const lastRawKeyRef = useRef<string | null>(null);
  const rawLoadInFlightRef = useRef(false);
  const mdxEditorRef = useRef<MDXEditorMethods>(null);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const resetDocState = useCallback(() => {
    setDocType('text');
    setFileUrl(null);
    setFileName('');
    setFileMime('');
    setContent('');
    if (mdxEditorRef.current) {
      mdxEditorRef.current.setMarkdown('');
    }
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
        if (mdxEditorRef.current) {
          mdxEditorRef.current.setMarkdown(text);
        }
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
        if (mdxEditorRef.current) {
          mdxEditorRef.current.setMarkdown(incoming);
        }
      }
    } else if (type === 'file' && (url || storagePath)) {
      const rawKey = storagePath || url;
      maybeLoadRawContent(rawKey);
    } else if (!pendingLocalChangeRef.current) {
      setContent('');
      if (mdxEditorRef.current) {
        mdxEditorRef.current.setMarkdown('');
      }
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
    loadDoc();
  }, [roomId, loadDoc]);

  // Listen for real-time document changes
  useEffect(() => {
    if (!onDocChangeCallback || !roomId || !isPageVisible) return;
    return onDocChangeCallback((event) => {
      if (event.docId === roomId && (event.action === 'updated' || event.action === 'created')) {
        loadDoc();
      }
    });
  }, [onDocChangeCallback, roomId, loadDoc, isPageVisible]);

  // SSE stream for real-time updates
  useEffect(() => {
    if (!roomId || !isPageVisible) return;
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
              } catch (_e) { /* ignore parse errors */ }
            }
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError' && !cancelled) {
          console.error('Stream error:', e);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [roomId, loadDoc, applyDocData, resetDocState, isPageVisible]);

  useEffect(() => {
    if (!isPageVisible || !roomId) return;
    loadDoc();
  }, [isPageVisible, roomId, loadDoc]);

  const handleContentChange = useCallback((val: string) => {
    setContent(val);
    contentRef.current = val;
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

  // Notify parent of search state changes
  useEffect(() => {
    if (onSearchStateChange) {
      onSearchStateChange({ currentMatch, totalMatches });
    }
  }, [currentMatch, totalMatches, onSearchStateChange]);

  const navigateSearch = useCallback((direction: 'next' | 'prev') => {
    if (totalMatches === 0) return;
    setCurrentMatch(prev => {
      let next = direction === 'next' ? prev + 1 : prev - 1;
      if (next >= totalMatches) next = 0;
      if (next < 0) next = totalMatches - 1;
      return next;
    });
  }, [totalMatches]);

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

  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return { words, chars: content.length };
  }, [content]);

  // MDXEditor plugins configuration
  const editorPlugins = useMemo(() => [
    headingsPlugin(),
    listsPlugin(),
    quotePlugin(),
    thematicBreakPlugin(),
    markdownShortcutPlugin(),
    tablePlugin(),
    linkPlugin(),
    linkDialogPlugin(),
    imagePlugin({ imageUploadHandler: async () => '/placeholder.png' }),
    codeBlockPlugin({ defaultCodeBlockLanguage: '' }),
    codeMirrorPlugin({
      codeBlockLanguages: {
        js: 'JavaScript',
        javascript: 'JavaScript',
        ts: 'TypeScript',
        typescript: 'TypeScript',
        python: 'Python',
        py: 'Python',
        css: 'CSS',
        html: 'HTML',
        json: 'JSON',
        bash: 'Bash',
        sh: 'Shell',
        sql: 'SQL',
        yaml: 'YAML',
        xml: 'XML',
        markdown: 'Markdown',
        mermaid: 'Mermaid',
        rust: 'Rust',
        go: 'Go',
        java: 'Java',
        cpp: 'C++',
        c: 'C',
        '': 'Texto plano'
      }
    }),
    frontmatterPlugin(),
    diffSourcePlugin({ viewMode: 'rich-text' }),
    toolbarPlugin({
      toolbarContents: () => (
        <>
          <DiffSourceToggleWrapper>
            <></>
          </DiffSourceToggleWrapper>
          <Separator />
          <UndoRedo />
          <Separator />
          <BoldItalicUnderlineToggles />
          <CodeToggle />
          <Separator />
          <BlockTypeSelect />
          <Separator />
          <ListsToggle />
          <Separator />
          <CreateLink />
          <InsertImage />
          <Separator />
          <InsertTable />
          <InsertThematicBreak />
          <InsertCodeBlock />
        </>
      )
    })
  ], []);

  const handleMdxChange = useCallback((md: string) => {
    handleContentChange(md);
  }, [handleContentChange]);

  // ── File viewer (non-markdown files) ──
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
                <a href={fileUrl} target="_blank" rel="noreferrer" className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded hover:bg-slate-700">
                  Abrir
                </a>
                <a href={fileUrl} download className="text-xs bg-blue-600 px-2 py-1 rounded hover:bg-blue-500">
                  Descargar
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 p-4 bg-slate-900 flex items-center justify-center">
          {!fileUrl && <div className="text-sm text-slate-400">No se pudo cargar el archivo.</div>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {fileUrl && isImage && <img src={fileUrl} alt={safeName} className="max-h-full max-w-full rounded shadow" />}
          {fileUrl && isVideo && <video src={fileUrl} controls className="max-h-full max-w-full rounded shadow" />}
          {fileUrl && isAudio && <audio src={fileUrl} controls className="w-full max-w-xl" />}
          {fileUrl && !isImage && !isVideo && !isAudio && (
            <iframe src={fileUrl} className={`w-full h-full border border-slate-700 rounded bg-white ${isPdf ? '' : 'min-h-[70vh]'}`} title={safeName} />
          )}
        </div>
      </div>
    );
  }

  // ── WYSIWYG Markdown Editor (tipo Obsidian) ──
  return (
    <div className={clsx('flex flex-col h-full bg-slate-950 text-slate-300 relative mdx-editor-dark', embedded && 'editor-embedded')}>
      {!embedded && (
        <div className="h-10 shrink-0 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {onClose && (
              <button onClick={onClose} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider shrink-0">
                <ChevronLeft className="w-4 h-4" /> Salir
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
                placeholder="Buscar..."
                className="bg-transparent border-none text-xs text-white placeholder-slate-500 focus:outline-none w-32"
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

          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono shrink-0">
            <span>{stats.words} palabras</span>
            <span>·</span>
            <span>{stats.chars} car.</span>
            <span className="w-px h-3 bg-slate-700 mx-1" />
            {saving ? (
              <span className="text-blue-400 flex items-center gap-1"><Cloud className="w-3 h-3" /> Guardando</span>
            ) : (
              <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Guardado</span>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        <MDXEditor
          ref={mdxEditorRef}
          markdown={content}
          onChange={handleMdxChange}
          plugins={editorPlugins}
          contentEditableClassName="mdx-content-editable"
          className="mdx-editor-root h-full"
          placeholder="Escribe aquí... Usa Markdown como en Obsidian ✨"
        />
      </div>

      {/* Status bar for embedded mode */}
      {embedded && (
        <div className="shrink-0 h-7 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-3 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>Markdown</span>
            <span>{stats.words} palabras</span>
            <span>{stats.chars} car.</span>
          </div>
          <div className="flex items-center gap-2">
            {saving ? (
              <span className="text-blue-400 flex items-center gap-1"><Cloud className="w-3 h-3" /> Guardando</span>
            ) : (
              <span className="text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Guardado</span>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        /* ─── MDXEditor Dark Theme ─── */
        .mdx-editor-dark .mdxeditor {
          --baseTextContrast-color: #e2e8f0;
          --baseBg: #0f172a;
          --baseBorder: #334155;
          --baseBgSubtle: #1e293b;
          --baseBgActive: #334155;
          --baseBgHover: #1e293b;
          --baseTextSubtle-color: #94a3b8;
          --baseText-color: #e2e8f0;
          --accentBase-color: #3b82f6;
          --accentBgSubtle-color: #1e3a5f;
          --accentText-color: #60a5fa;
          --accentSolid-color: #3b82f6;
          --accentTextContrast-color: #ffffff;
          --admonitionTipBg: rgba(34, 197, 94, 0.08);
          --admonitionTipBorder: #22c55e;
          --admonitionInfoBg: rgba(59, 130, 246, 0.08);
          --admonitionInfoBorder: #3b82f6;
          --admonitionCautionBg: rgba(234, 179, 8, 0.08);
          --admonitionCautionBorder: #eab308;
          --admonitionDangerBg: rgba(239, 68, 68, 0.08);
          --admonitionDangerBorder: #ef4444;
          --admonitionNoteBg: rgba(168, 85, 247, 0.08);
          --admonitionNoteBorder: #a855f7;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #e2e8f0;
          background: #0f172a;
        }

        .mdx-editor-dark .mdxeditor,
        .mdx-editor-dark [class*="_toolbarRoot"] {
          background: #0f172a !important;
          border-color: #334155 !important;
        }

        /* Toolbar styling */
        .mdx-editor-dark [class*="_toolbar"] {
          background: #1e293b !important;
          border-bottom: 1px solid #334155 !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"] {
          color: #94a3b8 !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button:hover,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"]:hover {
          background: #334155 !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button[data-state="on"],
        .mdx-editor-dark [class*="_toolbarRoot"] [data-active="true"],
        .mdx-editor-dark [class*="_toolbarRoot"] [aria-pressed="true"] {
          background: #3b82f6 !important;
          color: #ffffff !important;
        }

        /* Select/dropdown in toolbar */
        .mdx-editor-dark [class*="_selectTrigger"],
        .mdx-editor-dark [class*="_selectContent"],
        .mdx-editor-dark select {
          background: #1e293b !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark [class*="_selectItem"]:hover,
        .mdx-editor-dark [class*="_selectItem"][data-highlighted] {
          background: #334155 !important;
        }

        /* Separator */
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_separator"],
        .mdx-editor-dark [class*="_toolbarRoot"] [role="separator"] {
          background: #334155 !important;
        }

        /* Content editable area */
        .mdx-content-editable {
          color: #e2e8f0;
          font-size: 15px;
          line-height: 1.75;
          padding: 1.5rem 2rem;
          min-height: 100%;
          max-width: 100%;
          outline: none;
          caret-color: #60a5fa;
        }

        .mdx-content-editable h1 {
          font-size: 2em;
          font-weight: 700;
          margin: 1em 0 0.5em;
          color: #f1f5f9;
          border-bottom: 1px solid #334155;
          padding-bottom: 0.3em;
        }

        .mdx-content-editable h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin: 0.8em 0 0.4em;
          color: #f1f5f9;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 0.2em;
        }

        .mdx-content-editable h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 0.7em 0 0.3em;
          color: #e2e8f0;
        }

        .mdx-content-editable h4,
        .mdx-content-editable h5,
        .mdx-content-editable h6 {
          font-weight: 600;
          margin: 0.6em 0 0.3em;
          color: #cbd5e1;
        }

        .mdx-content-editable p {
          margin: 0.5em 0;
        }

        .mdx-content-editable a {
          color: #60a5fa;
          text-decoration: underline;
          text-decoration-color: rgba(96, 165, 250, 0.4);
          transition: text-decoration-color 0.2s;
        }

        .mdx-content-editable a:hover {
          text-decoration-color: #60a5fa;
        }

        .mdx-content-editable strong {
          color: #f1f5f9;
          font-weight: 600;
        }

        .mdx-content-editable em {
          color: #cbd5e1;
        }

        .mdx-content-editable code {
          background: #1e293b;
          color: #f472b6;
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
          font-family: 'Fira Code', 'JetBrains Mono', monospace;
        }

        .mdx-content-editable pre {
          background: #1e293b !important;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 1em;
          margin: 1em 0;
          overflow-x: auto;
        }

        .mdx-content-editable pre code {
          background: transparent !important;
          color: #e2e8f0;
          padding: 0;
          font-size: 0.88em;
        }

        .mdx-content-editable blockquote {
          border-left: 4px solid #3b82f6;
          margin: 1em 0;
          padding: 0.5em 1em;
          background: rgba(59, 130, 246, 0.05);
          color: #94a3b8;
        }

        .mdx-content-editable blockquote p {
          margin: 0.3em 0;
        }

        .mdx-content-editable ul,
        .mdx-content-editable ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }

        .mdx-content-editable li {
          margin: 0.25em 0;
        }

        .mdx-content-editable li::marker {
          color: #64748b;
        }

        .mdx-content-editable ul li {
          list-style-type: disc;
        }

        .mdx-content-editable ol li {
          list-style-type: decimal;
        }

        .mdx-content-editable hr {
          border: none;
          border-top: 1px solid #334155;
          margin: 1.5em 0;
        }

        .mdx-content-editable table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }

        .mdx-content-editable th,
        .mdx-content-editable td {
          border: 1px solid #334155;
          padding: 0.5em 0.75em;
          text-align: left;
        }

        .mdx-content-editable th {
          background: #1e293b;
          font-weight: 600;
          color: #f1f5f9;
        }

        .mdx-content-editable td {
          background: #0f172a;
        }

        .mdx-content-editable tr:hover td {
          background: #1e293b;
        }

        .mdx-content-editable img {
          max-width: 100%;
          border-radius: 8px;
          margin: 1em 0;
        }

        .mdx-content-editable input[type="checkbox"] {
          accent-color: #3b82f6;
          margin-right: 0.5em;
        }

        /* Editor root full height */
        .mdx-editor-root.h-full {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .mdx-editor-root.h-full .mdxeditor {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .mdx-editor-root.h-full [class*="_rootContentEditableWrapper"],
        .mdx-editor-root.h-full [class*="_contentEditable"] {
          flex: 1;
          overflow-y: auto;
        }

        /* Scrollbar */
        .mdx-content-editable::-webkit-scrollbar,
        .mdx-editor-root ::-webkit-scrollbar {
          width: 8px;
        }

        .mdx-content-editable::-webkit-scrollbar-track,
        .mdx-editor-root ::-webkit-scrollbar-track {
          background: #0f172a;
        }

        .mdx-content-editable::-webkit-scrollbar-thumb,
        .mdx-editor-root ::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }

        .mdx-content-editable::-webkit-scrollbar-thumb:hover,
        .mdx-editor-root ::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }

        /* DiffSource (source mode) CodeMirror styling */
        .mdx-editor-dark .cm-editor {
          background: #0f172a !important;
          height: 100% !important;
        }

        .mdx-editor-dark .cm-gutters {
          background: #1e293b !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark .cm-activeLineGutter {
          background: #334155 !important;
        }

        .mdx-editor-dark .cm-activeLine {
          background: rgba(59, 130, 246, 0.05) !important;
        }

        .mdx-editor-dark .cm-content {
          color: #e2e8f0 !important;
          caret-color: #60a5fa !important;
        }

        .mdx-editor-dark .cm-cursor {
          border-left-color: #60a5fa !important;
        }

        .mdx-editor-dark .cm-line {
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark .cm-gutterElement {
          color: #475569 !important;
        }

        .mdx-editor-dark .cm-selectionBackground {
          background: rgba(59, 130, 246, 0.2) !important;
        }

        /* Popover/dialog dark theme */
        .mdx-editor-dark [class*="_dialogContent"],
        .mdx-editor-dark [class*="_popoverContent"],
        .mdx-editor-dark [class*="_dialogOverlay"] + div {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_dialogContent"] input,
        .mdx-editor-dark [class*="_popoverContent"] input {
          background: #0f172a !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_primaryButton"],
        .mdx-editor-dark [class*="_dialogContent"] button[type="submit"] {
          background: #3b82f6 !important;
          color: white !important;
        }

        .mdx-editor-dark [class*="_secondaryButton"] {
          background: #334155 !important;
          color: #e2e8f0 !important;
        }

        /* Code block language selector */
        .mdx-editor-dark [class*="_codeMirrorToolbar"],
        .mdx-editor-dark [class*="_codeBlockToolbar"] {
          background: #1e293b !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark [class*="_codeMirrorToolbar"] select,
        .mdx-editor-dark [class*="_codeBlockToolbar"] select {
          background: #0f172a !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }

        /* Hide mosaic styles when embedded */
        .editor-embedded .mosaic-window-toolbar {
          display: none !important;
        }

        /* Source/diff toggle buttons */
        .mdx-editor-dark [class*="_viewMode"] {
          background: #1e293b !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark [class*="_viewMode"] button {
          color: #94a3b8 !important;
        }

        .mdx-editor-dark [class*="_viewMode"] button[data-state="on"] {
          background: #3b82f6 !important;
          color: #ffffff !important;
        }

        /* Table editor controls */
        .mdx-editor-dark [class*="_tableEditor"],
        .mdx-editor-dark [class*="_toolCell"] {
          background: #1e293b !important;
        }

        .mdx-editor-dark [class*="_addRowButton"],
        .mdx-editor-dark [class*="_addColumnButton"],
        .mdx-editor-dark [class*="_iconButton"] {
          background: #334155 !important;
          color: #94a3b8 !important;
        }

        .mdx-editor-dark [class*="_addRowButton"]:hover,
        .mdx-editor-dark [class*="_addColumnButton"]:hover,
        .mdx-editor-dark [class*="_iconButton"]:hover {
          background: #475569 !important;
          color: #e2e8f0 !important;
        }

        /* Placeholder */
        .mdx-editor-dark [class*="_placeholder"] {
          color: #475569 !important;
        }

        /* Link tooltip popup */
        .mdx-editor-dark [class*="_linkDialogPopoverContent"],
        .mdx-editor-dark [class*="_tooltipContent"],
        .mdx-editor-dark [class*="_linkDialogEditForm"] {
          background: #1e293b !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_linkDialogEditForm"] input {
          background: #0f172a !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }

        /* Code block wrapper */
        .mdx-editor-dark [class*="_codeBlockEditorWrapper"],
        .mdx-editor-dark [class*="_codeMirrorWrapper"] {
          background: #1e293b !important;
          border-color: #334155 !important;
          border-radius: 8px !important;
          overflow: hidden;
        }

        /* Diff source wrapper full height */
        .mdx-editor-dark [class*="_diffSourceWrapper"] {
          height: 100% !important;
        }

        .mdx-editor-dark [class*="_diffSourceWrapper"] > div {
          height: 100% !important;
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
