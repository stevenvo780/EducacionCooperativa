'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  MDXEditor,
  AdmonitionDirectiveDescriptor,
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
  directivesPlugin,
  frontmatterPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CodeToggle,
  CreateLink,
  HighlightToggle,
  InsertAdmonition,
  InsertFrontmatter,
  InsertImage,
  InsertThematicBreak,
  ListsToggle,
  Separator,
  InsertCodeBlock,
  StrikeThroughSupSubToggles,
  UndoRedo,
  type MDXEditorMethods
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';

import { useAuth } from '@/context/AuthContext';
import { useTerminal } from '@/context/TerminalContext';
import { Check, Cloud, Search, ArrowUp, ArrowDown, X, Settings2, Sparkles, MoreHorizontal, Maximize2, Minimize2, Grid3x3 } from 'lucide-react';
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

type ToolbarGroupKey = 'history' | 'inline' | 'structure' | 'lists' | 'media' | 'insert' | 'advanced';

type ToolbarVisibility = Record<ToolbarGroupKey, boolean>;

type QuickInsert = {
  id: string;
  title: string;
  description: string;
  markdown: string;
};

const TOOLBAR_VISIBILITY_STORAGE_KEY = 'agora.editor.toolbar.visibility.v1';

const DEFAULT_TOOLBAR_VISIBILITY: ToolbarVisibility = {
  history: true,
  inline: true,
  structure: true,
  lists: true,
  media: true,
  insert: true,
  advanced: true
};

const TOOLBAR_GROUP_LABELS: Record<ToolbarGroupKey, string> = {
  history: 'Historial',
  inline: 'Formato',
  structure: 'Bloques',
  lists: 'Listas',
  media: 'Links y media',
  insert: 'Inserciones',
  advanced: 'Avanzadas'
};

const QUICK_INSERTS: QuickInsert[] = [
  {
    id: 'latex-inline',
    title: 'LaTeX inline',
    description: 'Inserta una fórmula inline con KaTeX.',
    markdown: '$E = mc^2$'
  },
  {
    id: 'latex-block',
    title: 'Bloque LaTeX',
    description: 'Inserta un bloque matemático multilínea.',
    markdown: '$$\n\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)\n$$\n'
  },
  {
    id: 'mermaid',
    title: 'Diagrama Mermaid',
    description: 'Inserta una plantilla de diagrama/flujo.',
    markdown: '```mermaid\ngraph TD\n  Inicio[Inicio] --> Idea[Idea]\n  Idea --> Revision[Revisión]\n  Revision --> Publicacion[Publicación]\n```\n'
  },
  {
    id: 'admonition',
    title: 'Admonición',
    description: 'Añade una nota resaltada tipo callout.',
    markdown: ':::note[Nota importante]\nEscribe aquí la observación clave.\n:::\n'
  },
  {
    id: 'frontmatter',
    title: 'Frontmatter',
    description: 'Inserta metadatos YAML al inicio del documento.',
    markdown: '---\ntitle: Documento\ntags:\n  - clase\n  - apunte\n---\n\n'
  },
  {
    id: 'checklist',
    title: 'Checklist',
    description: 'Crea una lista de tareas lista para editar.',
    markdown: '- [ ] Primer pendiente\n- [ ] Segundo pendiente\n- [ ] Tercer pendiente\n'
  }
];

// ── Table Grid Picker (visual NxM selector like Google Docs) ──
const TABLE_MAX_ROWS = 8;
const TABLE_MAX_COLS = 8;

function TableGridPicker({ onInsert }: { onInsert: (rows: number, cols: number) => void }) {
  const [open, setOpen] = React.useState(false);
  const [hoverRow, setHoverRow] = React.useState(0);
  const [hoverCol, setHoverCol] = React.useState(0);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  // Position the popover using fixed coords from button rect
  React.useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-700 hover:text-white"
        title="Insertar tabla"
      >
        <Grid3x3 className="h-3.5 w-3.5" />
      </button>
      {open && pos && ReactDOM.createPortal(
        <div
          ref={popoverRef}
          className="table-grid-popover"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999 }}
        >
          <div className="rounded-xl border border-slate-600 bg-slate-900 p-5 shadow-2xl shadow-black/60">
            <div className="mb-3 text-center text-sm font-semibold text-slate-200">
              {hoverRow > 0 ? `${hoverRow} × ${hoverCol}` : 'Tamaño de tabla'}
            </div>
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${TABLE_MAX_COLS}, 1fr)` }}
              onMouseLeave={() => { setHoverRow(0); setHoverCol(0); }}
            >
              {Array.from({ length: TABLE_MAX_ROWS * TABLE_MAX_COLS }, (_, idx) => {
                const r = Math.floor(idx / TABLE_MAX_COLS) + 1;
                const c = (idx % TABLE_MAX_COLS) + 1;
                const active = r <= hoverRow && c <= hoverCol;
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`h-[28px] w-[28px] rounded border-2 transition-all duration-100 ${
                      active
                        ? 'border-blue-400 bg-blue-500/50 scale-105'
                        : 'border-slate-600 bg-slate-800 hover:border-slate-400'
                    }`}
                    onMouseEnter={() => { setHoverRow(r); setHoverCol(c); }}
                    onClick={() => {
                      onInsert(r, c);
                      setOpen(false);
                      setHoverRow(0);
                      setHoverCol(0);
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-3 text-center text-xs text-slate-400">
              Máx {TABLE_MAX_ROWS}×{TABLE_MAX_COLS}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function MosaicEditor({
  initialContent = '',
  roomId,
  onClose,
  embedded = false,
  externalSearchTerm,
  onSearchStateChange,
  searchNavRef
}: EditorProps) {
  // MDXEditor is UNCONTROLLED: `markdown` prop is only read on mount.
  // We use `initialMarkdown` + `editorKey` for mount/remount,
  // and `contentRef` + `statsContent` for tracking without re-render loops.
  const [initialMarkdown, setInitialMarkdown] = useState(initialContent);
  const [editorKey, setEditorKey] = useState(0);
  const [statsContent, setStatsContent] = useState(initialContent); // only for stats display
  const [saving, setSaving] = useState(false);
  const [docType, setDocType] = useState<'text' | 'file'>('text');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileMime, setFileMime] = useState('');
  const [docName, setDocName] = useState('');
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [toolbarVisibility, setToolbarVisibility] = useState<ToolbarVisibility>(DEFAULT_TOOLBAR_VISIBILITY);

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
  const contentRef = useRef(initialContent);
  const lastSyncedContentRef = useRef(initialContent);
  const pendingLocalChangeRef = useRef(false);
  const hasLocalEditsThisSessionRef = useRef(false);
  const lastRawKeyRef = useRef<string | null>(null);
  const rawLoadInFlightRef = useRef(false);
  const mdxEditorRef = useRef<MDXEditorMethods>(null);
  const isNormalizingRef = useRef(false);
  const saveRequestIdRef = useRef(0);
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const [showCompactMenu, setShowCompactMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawValue = window.localStorage.getItem(TOOLBAR_VISIBILITY_STORAGE_KEY);
      if (!rawValue) return;
      const parsed = JSON.parse(rawValue) as Partial<ToolbarVisibility>;
      setToolbarVisibility({ ...DEFAULT_TOOLBAR_VISIBILITY, ...parsed });
    } catch {
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TOOLBAR_VISIBILITY_STORAGE_KEY, JSON.stringify(toolbarVisibility));
    } catch {
    }
  }, [toolbarVisibility]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const updateFullscreenState = () => {
      const fullscreenElement = document.fullscreenElement;
      const frameElement = typeof window !== 'undefined' ? window.frameElement : null;
      setIsFullscreen(Boolean(
        fullscreenElement
        && (fullscreenElement === editorShellRef.current || fullscreenElement === frameElement)
      ));
    };

    updateFullscreenState();
    document.addEventListener('fullscreenchange', updateFullscreenState);

    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
    };
  }, []);

  /** Helper: update the editor content (remount with new key) */
  const setEditorContent = useCallback((md: string) => {
    contentRef.current = md;
    lastSyncedContentRef.current = md;
    pendingLocalChangeRef.current = false;
    hasLocalEditsThisSessionRef.current = false;
    setInitialMarkdown(md);
    setStatsContent(md);
    setEditorKey(k => k + 1); // force MDXEditor remount with new markdown
  }, []);

  const hasUnsavedLocalChanges = useCallback(() => {
    return pendingLocalChangeRef.current || contentRef.current !== lastSyncedContentRef.current;
  }, []);

  const resetDocState = useCallback(() => {
    setDocType('text');
    setFileUrl(null);
    setFileName('');
    setFileMime('');
    setEditorContent('');
    hasLoadedRef.current = true;
  }, [setEditorContent]);

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
        setEditorContent(text);
      }
    } catch (e) {
      console.error('Error loading raw content:', e);
    } finally {
      rawLoadInFlightRef.current = false;
    }
  }, [roomId, setEditorContent]);

  const applyDocData = useCallback((data: any) => {
    if (!data) {
      if (!hasUnsavedLocalChanges()) {
        resetDocState();
      }
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
      contentRef.current = '';
      setStatsContent('');
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
      const isOutOfOrderOwnSnapshot = hasLocalEditsThisSessionRef.current
        && data.lastUpdatedBy === user?.uid
        && incoming !== contentRef.current;

      if (isOutOfOrderOwnSnapshot) {
        return;
      }

      const hasUnsavedChanges = hasUnsavedLocalChanges();
      if (!same && hasUnsavedChanges) {
        return;
      }

      if (!same) {
        // Use setMarkdown if editor is mounted (avoids full remount),
        // fall back to remount via setEditorContent
        if (mdxEditorRef.current) {
          contentRef.current = incoming;
          lastSyncedContentRef.current = incoming;
          pendingLocalChangeRef.current = false;
          setStatsContent(incoming);
          mdxEditorRef.current.setMarkdown(incoming);
        } else {
          setEditorContent(incoming);
        }
      }
    } else if (type === 'file' && (url || storagePath)) {
      const rawKey = storagePath || url;
      maybeLoadRawContent(rawKey);
    } else if (!hasUnsavedLocalChanges()) {
      if (mdxEditorRef.current) {
        contentRef.current = '';
        lastSyncedContentRef.current = '';
        pendingLocalChangeRef.current = false;
        setStatsContent('');
        mdxEditorRef.current.setMarkdown('');
      } else {
        setEditorContent('');
      }
    }

    hasLoadedRef.current = true;
  }, [hasUnsavedLocalChanges, maybeLoadRawContent, resetDocState, setEditorContent, user?.uid]);

  const loadDoc = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await authFetch(`/api/documents/${roomId}`, { cache: 'no-store' });
      if (!res.ok) {
        if (!hasUnsavedLocalChanges()) {
          resetDocState();
        }
        return;
      }
      const data = await res.json();
      applyDocData(data);
    } catch (e) {
      console.error('Error loading document:', e);
    }
  }, [roomId, applyDocData, hasUnsavedLocalChanges, resetDocState]);

  useEffect(() => {
    if (!roomId) return;
    hasLoadedRef.current = false;
    pendingLocalChangeRef.current = false;
    hasLocalEditsThisSessionRef.current = false;
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
    contentRef.current = val;
    setStatsContent(val);
    if (!roomId || docType === 'file') return;
    if (!hasLoadedRef.current) return;

    const hasUnsavedChanges = val !== lastSyncedContentRef.current;
    if (hasUnsavedChanges) {
      hasLocalEditsThisSessionRef.current = true;
    }
    pendingLocalChangeRef.current = hasUnsavedChanges;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    if (!hasUnsavedChanges) {
      setSaving(false);
      return;
    }

    setSaving(true);

    saveTimeoutRef.current = setTimeout(async () => {
      const requestId = ++saveRequestIdRef.current;
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

        if (requestId === saveRequestIdRef.current && contentRef.current === val) {
          lastSyncedContentRef.current = val;
          pendingLocalChangeRef.current = false;
          setSaving(false);
        } else {
          pendingLocalChangeRef.current = contentRef.current !== lastSyncedContentRef.current;
          setSaving(pendingLocalChangeRef.current);
        }
      } catch (e) {
        console.error('Error saving:', e);
      } finally {
        if (requestId === saveRequestIdRef.current) {
          const stillUnsaved = contentRef.current !== lastSyncedContentRef.current;
          pendingLocalChangeRef.current = stillUnsaved;
          setSaving(stillUnsaved);
        }
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
    const trimmed = statsContent.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    return { words, chars: statsContent.length };
  }, [statsContent]);

  const enabledToolbarGroupsCount = useMemo(
    () => Object.values(toolbarVisibility).filter(Boolean).length,
    [toolbarVisibility]
  );

  const toggleToolbarGroup = useCallback((group: ToolbarGroupKey) => {
    setToolbarVisibility((current) => ({
      ...current,
      [group]: !current[group]
    }));
  }, []);

  const insertSnippet = useCallback((snippet: string) => {
    const editor = mdxEditorRef.current;
    if (!editor) return;
    editor.focus(() => {
      editor.insertMarkdown(snippet);
    }, { defaultSelection: 'rootEnd', preventScroll: false });
    handleContentChange(editor.getMarkdown());
  }, [handleContentChange]);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;

    const frameElement = typeof window !== 'undefined' && window.frameElement instanceof HTMLElement
      ? window.frameElement
      : null;
    const target = frameElement ?? editorShellRef.current;

    if (!target) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen editor:', error);
    }
  }, []);

  const renderToolbarContents = useCallback(() => {
    const sections: React.ReactNode[] = [];

    const pushSection = (key: ToolbarGroupKey, content: React.ReactNode) => {
      if (!toolbarVisibility[key]) return;
      if (sections.length > 0) {
        sections.push(<Separator key={`separator-${key}`} />);
      }
      sections.push(<React.Fragment key={key}>{content}</React.Fragment>);
    };

    pushSection('history', <UndoRedo />);
    pushSection('inline', (
      <>
        <BoldItalicUnderlineToggles />
        <CodeToggle />
        <HighlightToggle />
        <StrikeThroughSupSubToggles options={['Strikethrough', 'Sub', 'Sup']} />
      </>
    ));
    pushSection('structure', <BlockTypeSelect />);
    pushSection('lists', <ListsToggle />);
    pushSection('media', (
      <>
        <CreateLink />
        <InsertImage />
      </>
    ));
    pushSection('insert', (
      <>
        <TableGridPicker onInsert={(rows, cols) => {
          const header = '| ' + Array.from({ length: cols }, (_, i) => `Col ${i + 1}`).join(' | ') + ' |';
          const sep = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
          const body = Array.from({ length: rows - 1 }, () =>
            '| ' + Array.from({ length: cols }, () => '   ').join(' | ') + ' |'
          ).join('\n');
          const tableMd = `\n${header}\n${sep}\n${body}\n`;
          insertSnippet(tableMd);
        }} />
        <InsertThematicBreak />
        <InsertCodeBlock />
      </>
    ));
    pushSection('advanced', (
      <>
        <InsertAdmonition />
        <InsertFrontmatter />
      </>
    ));

    return (
      <>
        {/* ── Custom controls ── */}
        <div className="relative shrink-0" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            onClick={() => setShowCompactMenu(c => !c)}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-600 bg-slate-700/60 text-slate-300 transition hover:bg-slate-600 hover:text-white"
            title="Más opciones"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-600 bg-slate-700/60 text-slate-300 transition hover:bg-slate-600 hover:text-white"
            title={isFullscreen ? 'Restaurar' : 'Maximizar'}
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
        {showCompactMenu && ReactDOM.createPortal(
          <div
            className="table-grid-popover"
            style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 99998 }}
            onClick={() => setShowCompactMenu(false)}
          >
            <div
              style={{ position: 'fixed', top: 34, left: 8, zIndex: 99999 }}
              className="min-w-[200px] rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => { setShowToolsPanel(c => !c); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                <Settings2 className="h-3.5 w-3.5 text-slate-400" />{showToolsPanel ? 'Ocultar herramientas' : 'Editar herramientas'}
              </button>
              <button type="button" onClick={() => { setToolbarVisibility(DEFAULT_TOOLBAR_VISIBILITY); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-slate-400" />Restaurar barra completa
              </button>
              <button type="button" onClick={() => { void toggleFullscreen(); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-slate-400" /> : <Maximize2 className="h-3.5 w-3.5 text-slate-400" />}
                {isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
              </button>
              <div className="my-1 h-px bg-slate-700" />
              <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">Insertar rápido</div>
              {QUICK_INSERTS.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  onClick={() => { insertSnippet(snippet.markdown); setShowCompactMenu(false); }}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
                >
                  <Sparkles className="h-3 w-3 text-blue-400" />{snippet.title}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}

        <Separator />

        {/* ── MDXEditor toolbar groups ── */}
        {sections}
      </>
    );
  }, [toolbarVisibility, showCompactMenu, isFullscreen, showToolsPanel, insertSnippet, toggleFullscreen, setShowCompactMenu, setShowToolsPanel, setToolbarVisibility]);

  // MDXEditor plugins configuration
  const editorPlugins = useMemo(() => {
    const plugins = [
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
      directivesPlugin({
        directiveDescriptors: [AdmonitionDirectiveDescriptor]
      }),
      frontmatterPlugin()
    ];

    plugins.push(
      toolbarPlugin({
        toolbarContents: renderToolbarContents
      })
    );

    return plugins;
  }, [renderToolbarContents]);

  const handleMdxChange = useCallback((md: string) => {
    // Skip if this is MDXEditor's initial markdown normalization
    if (isNormalizingRef.current) return;
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
    <div
      ref={editorShellRef}
      className={clsx(
        'flex flex-col h-full bg-slate-950 text-slate-300 relative mdx-editor-dark',
        embedded && 'editor-embedded',
        isFullscreen && 'z-[9999]'
      )}
    >
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

      {showToolsPanel && (
        <div className="shrink-0 border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
          <div className="px-3 py-3">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
              <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Panel de visibilidad</h3>
                  <button
                    type="button"
                    onClick={() => setToolbarVisibility(DEFAULT_TOOLBAR_VISIBILITY)}
                    className="text-[11px] text-slate-500 transition hover:text-slate-300"
                  >
                    Restaurar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TOOLBAR_GROUP_LABELS) as ToolbarGroupKey[]).map((group) => {
                    const active = toolbarVisibility[group];
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => toggleToolbarGroup(group)}
                        className={clsx(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                          active
                            ? 'border-blue-500/50 bg-blue-500/15 text-blue-200'
                            : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        )}
                      >
                        {TOOLBAR_GROUP_LABELS[group]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  Elige exactamente qué grupos aparecen en la barra principal: formato, bloques, listas, multimedia, inserciones y extras avanzados.
                </p>
              </section>

              <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Biblioteca rápida</h3>
                  <span className="text-[11px] text-slate-500">LaTeX, Mermaid, admoniciones y más</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {QUICK_INSERTS.map((snippet) => (
                    <button
                      key={snippet.id}
                      type="button"
                      onClick={() => insertSnippet(snippet.markdown)}
                      className="rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-left transition hover:border-blue-500/40 hover:bg-slate-900"
                    >
                      <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-200">
                        <Sparkles className="h-3.5 w-3.5 text-blue-300" />
                        {snippet.title}
                      </div>
                      <p className="text-[11px] leading-5 text-slate-500">{snippet.description}</p>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        <MDXEditor
          key={editorKey}
          ref={mdxEditorRef}
          markdown={initialMarkdown}
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

        /* Toolbar styling – compact single-line */
        .mdx-editor-dark [class*="_toolbar"] {
          background: #1e293b !important;
          border-bottom: 1px solid #334155 !important;
          padding: 2px 4px !important;
          min-height: 0 !important;
          overflow: visible !important;
        }

        /* Force all toolbar wrappers to single-line no-wrap */
        .mdx-editor-dark [class*="_toolbarRoot"] {
          overflow: visible !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] > div {
          flex-wrap: nowrap !important;
          align-items: center !important;
        }

        /* Compact toolbar buttons */
        .mdx-editor-dark [class*="_toolbarRoot"] button,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"] {
          padding: 2px 3px !important;
          min-width: 24px !important;
          min-height: 24px !important;
          height: 24px !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] svg {
          width: 14px !important;
          height: 14px !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_selectTrigger"] {
          padding: 1px 5px !important;
          height: 24px !important;
          font-size: 11px !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_separator"],
        .mdx-editor-dark [class*="_toolbarRoot"] [role="separator"] {
          height: 16px !important;
          margin: 0 1px !important;
          width: 1px !important;
          background: #334155 !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toggleGroupRoot"],
        .mdx-editor-dark [class*="_toolbarRoot"] [role="group"] {
          gap: 0 !important;
        }

        /* Hide scrollbar on toolbar overflow */
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }

        /* Toolbar button colors */
        .mdx-editor-dark [class*="_toolbarRoot"] button,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"],
        .mdx-editor-dark [class*="_toolbarRoot"] button *,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"] *,
        .mdx-editor-dark [class*="_toolbarRoot"] span,
        .mdx-editor-dark [class*="_toolbarRoot"] label,
        .mdx-editor-dark [class*="_toolbarRoot"] svg {
          color: #94a3b8 !important;
          fill: currentColor !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button:hover,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"]:hover,
        .mdx-editor-dark [class*="_toolbarRoot"] button:hover *,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"]:hover * {
          background: #334155 !important;
          color: #e2e8f0 !important;
          fill: currentColor !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button[data-state="on"],
        .mdx-editor-dark [class*="_toolbarRoot"] [data-active="true"],
        .mdx-editor-dark [class*="_toolbarRoot"] [aria-pressed="true"],
        .mdx-editor-dark [class*="_toolbarRoot"] button[data-state="on"] *,
        .mdx-editor-dark [class*="_toolbarRoot"] [data-active="true"] *,
        .mdx-editor-dark [class*="_toolbarRoot"] [aria-pressed="true"] * {
          background: #3b82f6 !important;
          color: #ffffff !important;
          fill: currentColor !important;
        }

        /* Select/dropdown in toolbar */
        .mdx-editor-dark [class*="_selectTrigger"],
        .mdx-editor-dark [class*="_selectContent"],
        .mdx-editor-dark select {
          background: #1e293b !important;
          color: #e2e8f0 !important;
          border-color: #334155 !important;
        }

        .mdx-editor-dark [class*="_selectTrigger"] *,
        .mdx-editor-dark [class*="_selectContent"] *,
        .mdx-editor-dark [class*="_selectItem"] *,
        .mdx-editor-dark [data-radix-popper-content-wrapper] *,
        .mdx-editor-dark [role="listbox"] *,
        .mdx-editor-dark [role="option"] * {
          color: #e2e8f0 !important;
          fill: currentColor !important;
        }

        .mdx-editor-dark [class*="_selectItem"]:hover,
        .mdx-editor-dark [class*="_selectItem"][data-highlighted] {
          background: #334155 !important;
        }

        .mdx-editor-dark [class*="_selectTrigger"] svg,
        .mdx-editor-dark [class*="_toolbarRoot"] svg,
        .mdx-editor-dark [data-radix-popper-content-wrapper] svg {
          color: #cbd5e1 !important;
          fill: currentColor !important;
          stroke: currentColor !important;
        }

        /* Separator colors */
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_separator"],
        .mdx-editor-dark [class*="_toolbarRoot"] [role="separator"] {
          background: #334155 !important;
        }
        /* Toggle group compact */
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toggleGroupRoot"],
        .mdx-editor-dark [class*="_toolbarRoot"] [role="group"] {
          gap: 0 !important;
        }

        /* Table grid picker portal – standalone styling */
        .table-grid-popover button {
          padding: 0 !important;
          min-width: 0 !important;
          min-height: 0 !important;
          height: auto !important;
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
