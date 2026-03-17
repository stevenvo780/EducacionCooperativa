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
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setEditorToolbarVisibility } from '@/store/dashboardSlice';
import { Check, Cloud, Search, ArrowUp, ArrowDown, X, Settings2, Sparkles, MoreHorizontal, Maximize2, Minimize2, Grid3x3, Monitor, PenLine, AlertTriangle, FileCode2, Quote, ListTodo, Sigma, BetweenHorizontalStart } from 'lucide-react';
import clsx from 'clsx';
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import MermaidDiagram from '@/components/MermaidDiagram';
import { authFetch, getAuthToken } from '@/services/apiClient';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { normalizePath } from '@/lib/folder-utils';

type ViewMode = 'edit' | 'split' | 'preview' | 'raw';

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

type ToolbarGroupKey = 'history' | 'inline' | 'structure' | 'lists' | 'media' | 'insert' | 'snippets' | 'advanced';

type ToolbarVisibility = Record<ToolbarGroupKey, boolean>;

type QuickInsert = {
  id: string;
  title: string;
  description: string;
  markdown: string;
};

type MarkdownDocMeta = {
  workspaceId: string | null;
  folder: string;
  name: string;
};

const TOOLBAR_VISIBILITY_STORAGE_KEY = 'agora.editor.toolbar.visibility.v2';

const DEFAULT_TOOLBAR_VISIBILITY: ToolbarVisibility = {
  history: true,
  inline: true,
  structure: true,
  lists: true,
  media: true,
  insert: true,
  snippets: true,
  advanced: true
};

const TOOLBAR_GROUP_LABELS: Record<ToolbarGroupKey, string> = {
  history: 'Historial',
  inline: 'Formato',
  structure: 'Bloques',
  lists: 'Listas',
  media: 'Links y media',
  insert: 'Inserciones',
  snippets: 'Snippets',
  advanced: 'Avanzadas'
};

const QUICK_INSERTS: QuickInsert[] = [
  {
    id: 'latex-inline',
    title: 'LaTeX en línea',
    description: 'Inserta una fórmula en línea con KaTeX.',
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
    title: 'Lista de tareas',
    description: 'Crea una lista de tareas lista para editar.',
    markdown: '- [ ] Primer pendiente\n- [ ] Segundo pendiente\n- [ ] Tercer pendiente\n'
  }
];

// ── Table Grid Picker (visual NxM selector like Google Docs) ──
const TABLE_MAX_ROWS = 8;
const TABLE_MAX_COLS = 8;

// ── Error boundary para diagramas ──
class DiagramErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mermaid-error">
          <div className="mermaid-error-label">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Error al renderizar diagrama</span>
          </div>
          <pre className="mermaid-error-source">{this.props.fallback}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Preview con LaTeX + Mermaid ──
function unescapeLatex(md: string): string {
  // MDXEditor escapes many chars for CommonMark safety. We need to reverse
  // that so remark-math can find $ delimiters and LaTeX gets clean formulas.

  // Step 1: Restore block math delimiters  \$\$ ... \$\$ → $$ ... $$
  let result = md.replace(/\\\$\\\$([\s\S]*?)\\\$\\\$/g, '$$$$$$1$$$$');
  // Step 2: Restore inline math delimiters  \$ ... \$ → $ ... $
  result = result.replace(/\\\$((?!\$)[^\n]*?)\\\$/g, '$$$1$$');
  // Step 3: Strip remaining backslash escapes before ASCII punctuation.
  // MDXEditor escapes = * _ { } [ ] ( ) # + - . ! | ~ < > ^ ` etc.
  // ReactMarkdown handles unescaped markdown the same way, and LaTeX
  // needs the raw characters (e.g. \= is a macron accent, not equals).
  result = result.replace(/\\([=*_{}[\]()#+\-.!|~<>^`])/g, '$1');
  return result;
}

const stripQueryAndHash = (href: string) => href.split('#')[0]?.split('?')[0] ?? href;

const isExternalMarkdownHref = (href: string) => /^(https?:|mailto:|tel:|data:)/i.test(href);

const normalizeRelativeMarkdownPath = (value: string) => {
  const parts = value.split('/');
  const normalized: string[] = [];

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (!part || part === '.') continue;
    if (part === '..') {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }

  return normalized.join('/');
};

const ensureMarkdownCandidateNames = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const candidates = new Set<string>([trimmed]);
  if (!/\.[a-z0-9]+$/i.test(trimmed)) {
    candidates.add(`${trimmed}.md`);
  }
  return Array.from(candidates);
};

const convertWikiLinksToMarkdown = (content: string) => {
  const lines = content.split('\n');
  let insideFence = false;

  return lines.map((line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```')) {
      insideFence = !insideFence;
      return line;
    }

    if (insideFence || !line.includes('[[')) {
      return line;
    }

    return line.replace(/\[\[([^\]]+)\]\]/g, (_match, rawTarget: string) => {
      const [targetPart, labelPart] = rawTarget.split('|');
      const target = targetPart?.trim();
      const label = labelPart?.trim() || target;

      if (!target) {
        return _match;
      }

      return `[${label}](${target})`;
    });
  }).join('\n');
};

const MarkdownPreview = React.memo(({ content, onOpenInternalLink }: { content: string; onOpenInternalLink?: (href: string) => Promise<boolean> }) => {
  const processed = useMemo(() => convertWikiLinksToMarkdown(unescapeLatex(content)), [content]);
  return (
  <div className="markdown-preview-container overflow-auto h-full">
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={[rehypeKatex]}
      components={{
        pre({ children }) {
          const child = React.Children.toArray(children)[0] as React.ReactElement;
          const className: string = (child?.props as Record<string, string>)?.className || '';
          if (/language-mermaid/.test(className)) {
            const code = String((child?.props as Record<string, unknown>)?.children || '').trim();
            return (
              <DiagramErrorBoundary fallback={code}>
                <MermaidDiagram chart={code} />
              </DiagramErrorBoundary>
            );
          }
          return <pre>{children}</pre>;
        },
        code({ className, children, ...props }) {
          if (/language-mermaid/.test(className || '')) {
            const code = String(children).trim();
            return (
              <DiagramErrorBoundary fallback={code}>
                <MermaidDiagram chart={code} />
              </DiagramErrorBoundary>
            );
          }
          return <code className={className} {...props}>{children}</code>;
        },
        a({ href, children, ...props }) {
          const isExternal = !href || href.startsWith('#') || isExternalMarkdownHref(href);
          return (
            <a
              href={href}
              {...props}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noreferrer noopener' : undefined}
              onClick={async (event) => {
                props.onClick?.(event);
                if (event.defaultPrevented || !href || !onOpenInternalLink) return;
                if (href.startsWith('#') || isExternalMarkdownHref(href)) return;
                event.preventDefault();
                const opened = await onOpenInternalLink(href);
                if (!opened) {
                  window.location.assign(href);
                }
              }}
            >
              {children}
            </a>
          );
        }
      }}
    >
      {processed}
    </ReactMarkdown>
  </div>
  );
});
MarkdownPreview.displayName = 'MarkdownPreview';

function ToolbarShortcutButton({
  title,
  icon,
  onClick
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 min-w-6 items-center justify-center gap-1 rounded px-1.5 text-slate-400 transition hover:bg-slate-700 hover:text-white"
      title={title}
      aria-label={title}
    >
      {icon}
    </button>
  );
}

function TableGridPicker({
  onInsert,
  portalContainer
}: {
  onInsert: (rows: number, cols: number) => void;
  portalContainer?: Element | DocumentFragment | null;
}) {
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
        portalContainer ?? document.body
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

  // Search state
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = setInternalSearchTerm;
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);

  const { user } = useAuth();
  const { onDocChangeCallback } = useTerminal();
  const dispatch = useAppDispatch();
  const toolbarVisibility = useAppSelector((state) => ({
    ...DEFAULT_TOOLBAR_VISIBILITY,
    ...(state.dashboard.editorToolbarVisibility as Partial<ToolbarVisibility>)
  }));
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
  const currentDocMetaRef = useRef<MarkdownDocMeta>({ workspaceId: null, folder: '', name: '' });
  const [showCompactMenu, setShowCompactMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rawValue = window.localStorage.getItem(TOOLBAR_VISIBILITY_STORAGE_KEY);
      if (!rawValue) return;
      const parsed = JSON.parse(rawValue) as Partial<ToolbarVisibility>;
      dispatch(setEditorToolbarVisibility({ ...DEFAULT_TOOLBAR_VISIBILITY, ...parsed }));
    } catch {
    }
  }, [dispatch]);

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
        && (
          fullscreenElement === document.documentElement
          || fullscreenElement === document.body
          || fullscreenElement === editorShellRef.current
          || fullscreenElement === frameElement
        )
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
    currentDocMetaRef.current = { workspaceId: null, folder: '', name: '' };
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
    const folder = typeof data.folder === 'string' ? data.folder : '';
    const workspaceId = typeof data.workspaceId === 'string' ? data.workspaceId : null;
    const isMarkdown = isMarkdownMime(mimeType) || isMarkdownName(name);

    currentDocMetaRef.current = {
      workspaceId,
      folder,
      name
    };

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

  const applyToolbarVisibility = useCallback((nextVisibility: ToolbarVisibility) => {
    dispatch(setEditorToolbarVisibility(nextVisibility));
  }, [dispatch]);

  const toggleToolbarGroup = useCallback((group: ToolbarGroupKey) => {
    applyToolbarVisibility({
      ...toolbarVisibility,
      [group]: !toolbarVisibility[group]
    });
  }, [applyToolbarVisibility, toolbarVisibility]);

  const setViewModeWithSync = useCallback((nextMode: ViewMode) => {
    const editor = mdxEditorRef.current;
    const latestMarkdown = editor ? editor.getMarkdown() : contentRef.current;

    contentRef.current = latestMarkdown;
    setStatsContent(latestMarkdown);
    pendingLocalChangeRef.current = latestMarkdown !== lastSyncedContentRef.current;

    if (nextMode === 'edit') {
      setInitialMarkdown(latestMarkdown);
      setEditorKey((currentKey) => currentKey + 1);
    }

    setViewMode(nextMode);
  }, []);

  const openInternalMarkdownLink = useCallback(async (href: string) => {
    const cleanedHref = decodeURIComponent(stripQueryAndHash(href)).trim();
    if (!cleanedHref || cleanedHref.startsWith('#') || isExternalMarkdownHref(cleanedHref)) {
      return false;
    }

    const currentMeta = currentDocMetaRef.current;
    if (!currentMeta.workspaceId) {
      return false;
    }

    try {
      const search = new URLSearchParams({
        workspaceId: currentMeta.workspaceId,
        view: 'list',
        excludeContent: 'true'
      });
      const res = await authFetch(`/api/documents?${search.toString()}`, { cache: 'no-store' });
      if (!res.ok) return false;

      const docs = await res.json() as Array<{ id: string; name?: string; folder?: string; type?: string }>;
      const currentFolder = normalizePath(currentMeta.folder);
      const resolvedPath = cleanedHref.startsWith('/')
        ? normalizeRelativeMarkdownPath(cleanedHref)
        : normalizeRelativeMarkdownPath(currentFolder ? `${currentFolder}/${cleanedHref}` : cleanedHref);
      const basePath = normalizeRelativeMarkdownPath(cleanedHref);
      const candidatePaths = new Set<string>([
        ...ensureMarkdownCandidateNames(resolvedPath),
        ...ensureMarkdownCandidateNames(basePath)
      ]);
      const candidateNames = new Set<string>([
        ...ensureMarkdownCandidateNames(basePath.split('/').pop() || ''),
        ...ensureMarkdownCandidateNames(resolvedPath.split('/').pop() || '')
      ]);

      const matchedDoc = docs.find((doc) => {
        if (!doc || doc.type === 'folder') return false;
        const docName = typeof doc.name === 'string' ? doc.name : '';
        const docFolder = normalizePath(typeof doc.folder === 'string' ? doc.folder : '');
        const docPath = normalizeRelativeMarkdownPath(docFolder ? `${docFolder}/${docName}` : docName);
        return candidatePaths.has(docPath) || candidateNames.has(docName) || doc.id === cleanedHref;
      });

      if (!matchedDoc) return false;

      if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'agora-open-doc', docId: matchedDoc.id }, window.location.origin);
        return true;
      }

      window.location.assign(`/editor/${encodeURIComponent(matchedDoc.id)}`);
      return true;
    } catch (error) {
      console.error('Error opening internal markdown link:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    const editorShell = editorShellRef.current;
    if (!editorShell) return;

    const handleEditorLinkClick = (event: MouseEvent) => {
      if (viewMode !== 'edit') return;
      if (event.button !== 0) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('.mdx-content-editable a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute('href')?.trim();
      if (!href) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      void (async () => {
        if (href.startsWith('#')) return;

        if (isExternalMarkdownHref(href)) {
          window.open(href, '_blank', 'noopener,noreferrer');
          return;
        }

        const opened = await openInternalMarkdownLink(href);
        if (!opened) {
          window.location.assign(href);
        }
      })();
    };

    editorShell.addEventListener('click', handleEditorLinkClick, true);

    return () => {
      editorShell.removeEventListener('click', handleEditorLinkClick, true);
    };
  }, [openInternalMarkdownLink, viewMode]);

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

    const target = document.documentElement;

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
    pushSection('structure', (
      <>
        <BlockTypeSelect />
        <ToolbarShortcutButton
          title="Insertar cita"
          icon={<Quote className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('\n> Escribe una cita aquí\n')}
        />
      </>
    ));
    pushSection('lists', (
      <>
        <ListsToggle />
        <ToolbarShortcutButton
          title="Insertar lista de tareas"
          icon={<ListTodo className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('\n- [ ] Primera tarea\n- [ ] Segunda tarea\n')}
        />
      </>
    ));
    pushSection('media', (
      <>
        <CreateLink />
        <InsertImage />
      </>
    ));
    pushSection('insert', (
      <>
        <TableGridPicker portalContainer={editorShellRef.current} onInsert={(rows, cols) => {
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
    pushSection('snippets', (
      <>
        <ToolbarShortcutButton
          title="LaTeX en línea"
          icon={<Sigma className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('$E = mc^2$')}
        />
        <ToolbarShortcutButton
          title="Bloque LaTeX"
          icon={<Sigma className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('\n$$\n\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)\n$$\n')}
        />
        <ToolbarShortcutButton
          title="Diagrama Mermaid"
          icon={<BetweenHorizontalStart className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('\n```mermaid\ngraph TD\n  A[Inicio] --> B[Proceso]\n```\n')}
        />
        <ToolbarShortcutButton
          title="Nota al pie"
          icon={<FileCode2 className="h-3.5 w-3.5" />}
          onClick={() => insertSnippet('[^1]\n\n[^1]: Escribe la nota al pie aquí.\n')}
        />
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
        <div className="relative shrink-0" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => setShowCompactMenu(c => !c)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-700 hover:text-white"
            title="Más opciones"
            aria-label="Más opciones del editor"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewModeWithSync(viewMode === 'raw' ? 'edit' : 'raw')}
            className={clsx(
              'inline-flex h-6 w-6 items-center justify-center rounded-full transition',
              viewMode === 'raw'
                ? 'bg-violet-600/25 text-violet-300 hover:bg-violet-600/35'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            )}
            title={viewMode === 'raw' ? 'Volver al editor visual' : 'Ver Markdown puro'}
            aria-label={viewMode === 'raw' ? 'Volver al editor visual' : 'Ver Markdown puro'}
            aria-pressed={viewMode === 'raw'}
          >
            {viewMode === 'raw' ? <PenLine className="h-4 w-4" /> : <FileCode2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setViewModeWithSync(viewMode === 'preview' ? 'edit' : 'preview')}
            className={clsx(
              'inline-flex h-6 w-6 items-center justify-center rounded-full transition',
              viewMode === 'preview'
                ? 'bg-blue-600/25 text-blue-300 hover:bg-blue-600/35'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            )}
            title={viewMode === 'preview' ? 'Volver a editar' : 'Vista previa (LaTeX, Mermaid)'}
            aria-label={viewMode === 'preview' ? 'Volver al editor' : 'Abrir vista previa renderizada'}
            aria-pressed={viewMode === 'preview'}
          >
            {viewMode === 'preview' ? <PenLine className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-700 hover:text-white"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Abrir en pantalla completa'}
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Entrar en pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
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
              <button type="button" title={showToolsPanel ? 'Ocultar herramientas visibles en la barra' : 'Elegir qué herramientas se muestran'} aria-label={showToolsPanel ? 'Ocultar herramientas visibles en la barra' : 'Elegir qué herramientas se muestran'} onClick={() => { setShowToolsPanel(c => !c); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                <Settings2 className="h-3.5 w-3.5 text-slate-400" />{showToolsPanel ? 'Ocultar herramientas' : 'Editar herramientas'}
              </button>
              <button type="button" title="Restaurar todos los botones de la barra" aria-label="Restaurar todos los botones de la barra" onClick={() => { applyToolbarVisibility(DEFAULT_TOOLBAR_VISIBILITY); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                <Sparkles className="h-3.5 w-3.5 text-slate-400" />Restaurar barra completa
              </button>
              <button type="button" title={isFullscreen ? 'Salir de pantalla completa' : 'Abrir en pantalla completa'} aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Abrir en pantalla completa'} onClick={() => { void toggleFullscreen(); setShowCompactMenu(false); }} className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800">
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-slate-400" /> : <Maximize2 className="h-3.5 w-3.5 text-slate-400" />}
                {isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}
              </button>
              <div className="my-1 h-px bg-slate-700" />
              <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">Insertar rápido</div>
              {QUICK_INSERTS.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  title={snippet.title}
                  aria-label={snippet.title}
                  onClick={() => { insertSnippet(snippet.markdown); setShowCompactMenu(false); }}
                  className="flex w-full items-center gap-2 rounded px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-800"
                >
                  <Sparkles className="h-3 w-3 text-blue-400" />{snippet.title}
                </button>
              ))}
            </div>
          </div>,
          editorShellRef.current ?? document.body
        )}

        {/* ── MDXEditor toolbar groups ── */}
        {sections}
      </>
    );
  }, [applyToolbarVisibility, toolbarVisibility, showCompactMenu, isFullscreen, showToolsPanel, viewMode, insertSnippet, toggleFullscreen, setShowCompactMenu, setShowToolsPanel, setViewModeWithSync]);

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
                    onClick={() => applyToolbarVisibility(DEFAULT_TOOLBAR_VISIBILITY)}
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
                  Elige exactamente qué grupos aparecen en la barra principal: formato, bloques, listas, multimedia, inserciones, snippets y extras avanzados.
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
        {viewMode === 'preview' ? (
          <>
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800">
              <button
                type="button"
                onClick={() => setViewModeWithSync('edit')}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/50 bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300 transition hover:bg-blue-600/30"
                title="Volver al editor visual"
                aria-label="Volver al editor visual"
              >
                <PenLine className="h-3 w-3" />
                Editor visual
              </button>
              <button
                type="button"
                onClick={() => setViewModeWithSync('raw')}
                className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-600/15 px-3 py-1 text-xs font-medium text-violet-200 transition hover:bg-violet-600/25"
                title="Ver Markdown puro"
                aria-label="Ver Markdown puro"
              >
                <FileCode2 className="h-3 w-3" />
                Markdown puro
              </button>
              <span className="text-[11px] text-slate-500">Vista previa — LaTeX, Mermaid y tablas se renderizan aquí</span>
            </div>
            <MarkdownPreview content={statsContent || contentRef.current} onOpenInternalLink={openInternalMarkdownLink} />
          </>
        ) : viewMode === 'raw' ? (
          <>
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-slate-900 border-b border-slate-800">
              <button
                type="button"
                onClick={() => setViewModeWithSync('edit')}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/50 bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300 transition hover:bg-blue-600/30"
                title="Volver al editor visual"
                aria-label="Volver al editor visual"
              >
                <PenLine className="h-3 w-3" />
                Editor visual
              </button>
              <button
                type="button"
                onClick={() => setViewModeWithSync('preview')}
                className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-600/15 px-3 py-1 text-xs font-medium text-violet-200 transition hover:bg-violet-600/25"
                title="Abrir vista previa renderizada"
                aria-label="Abrir vista previa renderizada"
              >
                <Monitor className="h-3 w-3" />
                Vista previa
              </button>
              <span className="text-[11px] text-slate-500">Markdown puro — aquí ves y editas el texto exacto del documento</span>
            </div>
            <textarea
              value={statsContent}
              onChange={(event) => handleContentChange(event.target.value)}
              spellCheck={false}
              className="markdown-raw-textarea h-full w-full resize-none border-0 bg-slate-950/95 px-5 py-4 font-mono text-[13px] leading-6 text-slate-100 outline-none"
              placeholder="# Markdown puro\n\nEscribe aquí el contenido exacto del documento..."
            />
          </>
        ) : (
          <MDXEditor
            key={editorKey}
            ref={mdxEditorRef}
            markdown={initialMarkdown}
            onChange={handleMdxChange}
            plugins={editorPlugins}
            contentEditableClassName="mdx-content-editable"
            className="mdx-editor-root h-full"
            placeholder="Escribe aquí... Usa Markdown como en Obsidian"
          />
        )}
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
        .mdx-editor-dark toolbar,
        .mdx-editor-dark [role="toolbar"],
        .mdx-editor-dark [class*="_toolbar"] {
          background: #1e293b !important;
          border-bottom: 1px solid #334155 !important;
          padding: 2px 4px !important;
          min-height: 0 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: thin !important;
          scrollbar-color: rgba(148, 163, 184, 0.45) transparent !important;
          -ms-overflow-style: auto !important;
          justify-content: flex-start !important;
        }

        .mdx-editor-dark toolbar::-webkit-scrollbar,
        .mdx-editor-dark [role="toolbar"]::-webkit-scrollbar,
        .mdx-editor-dark [class*="_toolbar"]::-webkit-scrollbar {
          height: 8px !important;
        }

        .mdx-editor-dark toolbar::-webkit-scrollbar-thumb,
        .mdx-editor-dark [role="toolbar"]::-webkit-scrollbar-thumb,
        .mdx-editor-dark [class*="_toolbar"]::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.45) !important;
          border-radius: 999px !important;
        }

        .mdx-editor-dark toolbar::-webkit-scrollbar-track,
        .mdx-editor-dark [role="toolbar"]::-webkit-scrollbar-track,
        .mdx-editor-dark [class*="_toolbar"]::-webkit-scrollbar-track {
          background: transparent !important;
        }

        /* Force all toolbar wrappers to single-line no-wrap */
        .mdx-editor-dark [class*="_toolbarRoot"] {
          overflow-x: auto !important;
          overflow-y: hidden !important;
          width: 100% !important;
          max-width: 100% !important;
          scrollbar-width: thin !important;
          scrollbar-color: rgba(148, 163, 184, 0.45) transparent !important;
          -ms-overflow-style: auto !important;
          justify-content: flex-start !important;
          scrollbar-gutter: stable !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"]::-webkit-scrollbar {
          height: 8px !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"]::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.45) !important;
          border-radius: 999px !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] > div {
          flex-wrap: nowrap !important;
          align-items: center !important;
          width: max-content !important;
          min-width: max-content !important;
        }

        /* Compact toolbar buttons */
        .mdx-editor-dark [class*="_toolbarRoot"] button,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"] {
          padding: 2px 3px !important;
          min-width: 24px !important;
          min-height: 24px !important;
          height: 24px !important;
          border: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
          outline: none !important;
          text-decoration: none !important;
        }
        /* Kill any underline/border decoration on toolbar toggle items and their wrappers */
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toggleSingleGroup"],
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toggleSingleGroupButton"],
        .mdx-editor-dark [class*="_toolbarRoot"] [data-state],
        .mdx-editor-dark [class*="_toolbarRoot"] [data-orientation],
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toolbarToggle"],
        .mdx-editor-dark [class*="_toolbarRoot"] > *,
        .mdx-editor-dark [class*="_toolbarRoot"] > * > *,
        .mdx-editor-dark [class*="_toolbarRoot"] > * > * > * {
          border: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
          text-decoration: none !important;
          outline: none !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] svg {
          width: 14px !important;
          height: 14px !important;
        }

        .mdx-editor-dark .lucide {
          fill: none !important;
          stroke: currentColor !important;
          stroke-width: 2.2 !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_selectTrigger"] {
          padding: 1px 5px !important;
          height: 24px !important;
          font-size: 11px !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_separator"],
        .mdx-editor-dark [class*="_toolbarRoot"] [role="separator"] {
          height: 16px !important;
          margin: 0 3px !important;
          width: 1px !important;
          border: none !important;
          background: #334155 !important;
          display: inline-block !important;
          flex-shrink: 0 !important;
        }
        .mdx-editor-dark [class*="_toolbarRoot"] [class*="_toggleGroupRoot"],
        .mdx-editor-dark [class*="_toolbarRoot"] [role="group"] {
          gap: 0 !important;
        }

        /* Hide scrollbar on toolbar overflow */
        .scrollbar-none::-webkit-scrollbar { height: 8px; width: 8px; }
        .scrollbar-none { -ms-overflow-style: auto; scrollbar-width: thin; }

        /* Toolbar button colors */
        .mdx-editor-dark [class*="_toolbarRoot"] button,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"],
        .mdx-editor-dark [class*="_toolbarRoot"] button *,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"] *,
        .mdx-editor-dark [class*="_toolbarRoot"] span,
        .mdx-editor-dark [class*="_toolbarRoot"] label,
        .mdx-editor-dark [class*="_toolbarRoot"] svg {
          color: #94a3b8 !important;
          fill: none !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button:hover,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"]:hover,
        .mdx-editor-dark [class*="_toolbarRoot"] button:hover *,
        .mdx-editor-dark [class*="_toolbarRoot"] [role="button"]:hover * {
          background: #334155 !important;
          color: #e2e8f0 !important;
          fill: none !important;
        }

        .mdx-editor-dark [class*="_toolbarRoot"] button[data-state="on"],
        .mdx-editor-dark [class*="_toolbarRoot"] [data-active="true"],
        .mdx-editor-dark [class*="_toolbarRoot"] [aria-pressed="true"],
        .mdx-editor-dark [class*="_toolbarRoot"] button[data-state="on"] *,
        .mdx-editor-dark [class*="_toolbarRoot"] [data-active="true"] *,
        .mdx-editor-dark [class*="_toolbarRoot"] [aria-pressed="true"] * {
          background: #3b82f6 !important;
          color: #ffffff !important;
          fill: none !important;
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
          fill: none !important;
          stroke: currentColor !important;
        }

        .mdx-editor-dark .mdxeditor,
        .mdx-editor-dark .mdxeditor > div,
        .mdx-editor-dark [class*="_rootContentEditableWrapper"],
        .mdx-editor-dark [class*="_contentEditable"] {
          min-width: 0 !important;
        }

        .mdx-editor-dark .mdxeditor :where([data-radix-popper-content-wrapper]) {
          z-index: 100000 !important;
        }

        .markdown-preview-container,
        .markdown-raw-textarea,
        .mdx-content-editable {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
        }

        .markdown-preview-container::-webkit-scrollbar,
        .markdown-raw-textarea::-webkit-scrollbar,
        .mdx-content-editable::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .markdown-preview-container::-webkit-scrollbar-thumb,
        .markdown-raw-textarea::-webkit-scrollbar-thumb,
        .mdx-content-editable::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.45);
          border-radius: 999px;
        }

        .markdown-preview-container::-webkit-scrollbar-track,
        .markdown-raw-textarea::-webkit-scrollbar-track,
        .mdx-content-editable::-webkit-scrollbar-track {
          background: transparent;
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
          padding: 0.9rem 2rem 1.5rem;
          min-height: 100%;
          max-width: 100%;
          outline: none;
          caret-color: #60a5fa;
        }

        .mdx-content-editable > :first-child {
          margin-top: 0 !important;
        }

        .mdx-content-editable h1 {
          font-size: 2em;
          font-weight: 700;
          margin: 0.6em 0 0.5em;
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

        .mdx-content-editable,
        .markdown-preview-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 15px;
          line-height: 1.75;
          letter-spacing: 0;
          word-break: break-word;
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

        /* ─── Table editor controls: compact identical toolbars ─── */

        /* The table wrapper itself */
        .mdx-editor-dark [class*="_tableEditor"] {
          border: 1px solid #334155 !important;
          border-radius: 6px !important;
          overflow: hidden !important;
          position: relative !important;
        }

        /* ── THEAD tool row: collapse to thin strip ── */
        .mdx-editor-dark [class*="_tableEditor"] > thead {
          line-height: 0 !important;
          font-size: 0 !important;
        }

        .mdx-editor-dark [class*="_tableEditor"] > thead th,
        .mdx-editor-dark [class*="_tableEditor"] > thead td {
          padding: 0 !important;
          height: 14px !important;
          overflow: hidden !important;
          line-height: 14px !important;
          font-size: 0 !important;
          border: none !important;
          border-bottom: 1px solid #1e293b !important;
          background: #151e2d !important;
        }

        /* ── Tool column (left side _toolCell): slim 16px ── */
        .mdx-editor-dark [class*="_toolCell"],
        .mdx-editor-dark [class*="_tableToolsColumn"] {
          width: 16px !important;
          min-width: 16px !important;
          max-width: 16px !important;
          padding: 0 !important;
          background: #151e2d !important;
          transition: background 0.15s ease !important;
        }

        /* colgroup first col must also be slim */
        .mdx-editor-dark [class*="_tableEditor"] > colgroup > col:first-child {
          width: 16px !important;
        }

        /* colgroup last col (add column) also slim */
        .mdx-editor-dark [class*="_tableEditor"] > colgroup > col:last-child {
          width: 16px !important;
        }

        /* ── All trigger/icon buttons inside tool cells ── */
        .mdx-editor-dark [class*="_tableColumnEditorTrigger"],
        .mdx-editor-dark [class*="_tableRowEditorTrigger"],
        .mdx-editor-dark [class*="_toolCell"] button,
        .mdx-editor-dark [class*="_tableToolsColumn"] button,
        .mdx-editor-dark thead [data-tool-cell="true"] button {
          opacity: 0.35 !important;
          width: 100% !important;
          height: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          min-width: 0 !important;
          min-height: 0 !important;
          border: none !important;
          background: transparent !important;
          color: #94a3b8 !important;
          cursor: pointer !important;
          transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        /* All SVGs inside trigger/tool buttons: tiny */
        .mdx-editor-dark [class*="_tableColumnEditorTrigger"] svg,
        .mdx-editor-dark [class*="_tableRowEditorTrigger"] svg,
        .mdx-editor-dark [class*="_toolCell"] button svg,
        .mdx-editor-dark [class*="_tableToolsColumn"] button svg,
        .mdx-editor-dark thead [data-tool-cell="true"] button svg,
        .mdx-editor-dark [class*="_iconButton"] svg {
          width: 10px !important;
          height: 10px !important;
        }

        /* Hover: show buttons clearly */
        .mdx-editor-dark [class*="_tableEditor"]:hover [class*="_tableColumnEditorTrigger"],
        .mdx-editor-dark [class*="_tableEditor"]:hover [class*="_tableRowEditorTrigger"],
        .mdx-editor-dark [class*="_tableEditor"]:hover [class*="_toolCell"] button,
        .mdx-editor-dark [class*="_tableEditor"]:hover thead button {
          opacity: 0.6 !important;
        }

        .mdx-editor-dark [class*="_toolCell"] button:hover,
        .mdx-editor-dark thead [data-tool-cell="true"] button:hover,
        .mdx-editor-dark [class*="_tableToolsColumn"] button:hover {
          opacity: 1 !important;
          background: rgba(148, 163, 184, 0.15) !important;
          color: #e2e8f0 !important;
        }

        .mdx-editor-dark [class*="_toolCell"]:hover,
        .mdx-editor-dark thead th:hover {
          background: #1c2a3a !important;
        }

        /* ── Delete table icon button: red on hover ── */
        .mdx-editor-dark [class*="_iconButton"] {
          background: transparent !important;
          color: #64748b !important;
          padding: 0 !important;
          border-radius: 50% !important;
          transition: all 0.15s ease !important;
        }

        .mdx-editor-dark [class*="_iconButton"]:hover {
          opacity: 1 !important;
          background: rgba(239, 68, 68, 0.12) !important;
          color: #ef4444 !important;
        }

        /* ── Add row / add column buttons ── */
        .mdx-editor-dark [class*="_addRowButton"],
        .mdx-editor-dark [class*="_addColumnButton"] {
          background: transparent !important;
          border: 1px dashed #2d3d50 !important;
          color: #475569 !important;
          padding: 0 !important;
          margin: 0 !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 0 !important;
        }

        .mdx-editor-dark [class*="_addRowButton"] {
          height: 14px !important;
          min-height: 14px !important;
          max-height: 14px !important;
        }

        .mdx-editor-dark [class*="_addColumnButton"] {
          width: 16px !important;
          min-width: 16px !important;
          max-width: 16px !important;
        }

        .mdx-editor-dark [class*="_addRowButton"] svg,
        .mdx-editor-dark [class*="_addColumnButton"] svg {
          width: 8px !important;
          height: 8px !important;
          opacity: 0.4 !important;
          transition: opacity 0.15s ease !important;
        }

        .mdx-editor-dark [class*="_addRowButton"]:hover,
        .mdx-editor-dark [class*="_addColumnButton"]:hover {
          background: rgba(59, 130, 246, 0.08) !important;
          border-color: #3b82f6 !important;
          color: #60a5fa !important;
        }

        .mdx-editor-dark [class*="_addRowButton"]:hover svg,
        .mdx-editor-dark [class*="_addColumnButton"]:hover svg {
          opacity: 1 !important;
        }

        /* ── Right-side tool cells (add column area) ── */
        .mdx-editor-dark [class*="_tableEditor"] th[data-tool-cell="true"]:last-child,
        .mdx-editor-dark [class*="_tableEditor"] td[data-tool-cell="true"]:last-child {
          width: 16px !important;
          min-width: 16px !important;
          max-width: 16px !important;
          padding: 0 !important;
        }

        /* ── Bottom add-row area ── */
        .mdx-editor-dark [class*="_tableEditor"] > tfoot th,
        .mdx-editor-dark [class*="_tableEditor"] > tfoot td {
          padding: 0 !important;
          height: 14px !important;
          overflow: hidden !important;
          border: none !important;
          border-top: 1px solid #1e293b !important;
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

        .markdown-raw-textarea {
          tab-size: 2;
          white-space: pre-wrap;
          word-break: break-word;
          caret-color: #60a5fa;
        }

        .markdown-raw-textarea::selection {
          background: rgba(96, 165, 250, 0.35);
        }

        /* ─── Markdown Preview (LaTeX + Mermaid) ─── */
        .markdown-preview-container {
          background: #0f172a;
          color: #e2e8f0;
          padding: 0.9rem 2rem 1.5rem;
        }
        .markdown-preview-container h1,
        .markdown-preview-container h2,
        .markdown-preview-container h3,
        .markdown-preview-container h4 {
          color: #f1f5f9;
          font-weight: 700;
          margin-top: 0.6em;
          margin-bottom: 0.5em;
        }
        .markdown-preview-container > :first-child { margin-top: 0 !important; }
        .markdown-preview-container h1 { font-size: 2em; border-bottom: 1px solid #334155; padding-bottom: 0.3em; margin-top: 0.6em; }
        .markdown-preview-container h2 { font-size: 1.5em; font-weight: 600; border-bottom: 1px solid #1e293b; padding-bottom: 0.2em; margin: 0.8em 0 0.4em; }
        .markdown-preview-container h3 { font-size: 1.25em; font-weight: 600; margin: 0.7em 0 0.3em; color: #e2e8f0; }
        .markdown-preview-container h4,
        .markdown-preview-container h5,
        .markdown-preview-container h6 { font-weight: 600; margin: 0.6em 0 0.3em; color: #cbd5e1; }
        .markdown-preview-container p { margin: 0.5em 0; }
        .markdown-preview-container a { color: #60a5fa; text-decoration: underline; text-decoration-color: rgba(96, 165, 250, 0.4); transition: text-decoration-color 0.2s; }
        .markdown-preview-container a:hover { text-decoration-color: #60a5fa; }
        .markdown-preview-container strong { color: #f1f5f9; font-weight: 600; }
        .markdown-preview-container em { color: #cbd5e1; }
        .markdown-preview-container code:not(pre code) {
          background: #1e293b;
          border-radius: 4px;
          padding: 0.15em 0.4em;
          font-size: 0.9em;
          color: #f472b6;
        }
        .markdown-preview-container pre {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 16px;
          overflow-x: auto;
          margin: 1em 0;
        }
        .markdown-preview-container pre code {
          background: none;
          border: none;
          padding: 0;
          color: #e2e8f0;
          font-size: 0.875em;
        }
        .markdown-preview-container blockquote {
          border-left: 4px solid #3b82f6;
          background: rgba(59, 130, 246, 0.05);
          padding: 0.5em 1em;
          margin: 1em 0;
          color: #94a3b8;
        }
        .markdown-preview-container table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        .markdown-preview-container th,
        .markdown-preview-container td {
          border: 1px solid #334155;
          padding: 8px 12px;
          text-align: left;
        }
        .markdown-preview-container th {
          background: #1e293b;
          font-weight: 600;
          color: #f1f5f9;
        }
        .markdown-preview-container tr:nth-child(even) {
          background: #0f172a;
        }
        .markdown-preview-container tr:nth-child(odd) {
          background: #1e293b40;
        }
        .markdown-preview-container ul,
        .markdown-preview-container ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .markdown-preview-container li { margin: 0.25em 0; }
        .markdown-preview-container hr {
          border: none;
          border-top: 1px solid #334155;
          margin: 2em 0;
        }
        .markdown-preview-container img {
          max-width: 100%;
          border-radius: 8px;
        }

        /* KaTeX overrides for dark theme */
        .markdown-preview-container .katex { color: #e2e8f0; font-size: 1.1em; }
        .markdown-preview-container .katex-display { margin: 1em 0; overflow-x: auto; }
        .markdown-preview-container .katex-display > .katex {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 12px 16px;
          display: inline-block;
        }

        /* Mermaid containers */
        .markdown-preview-container .mermaid-container {
          margin: 1em 0;
          padding: 16px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          text-align: center;
          overflow-x: auto;
        }
        .markdown-preview-container .mermaid-container svg {
          max-width: 100%;
          height: auto;
        }
        .mermaid-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 13px;
          padding: 12px;
        }
        .mermaid-loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #334155;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .mermaid-error {
          background: #1e293b;
          border: 1px solid #ef4444;
          border-radius: 8px;
          padding: 12px;
          margin: 8px 0;
        }
        .mermaid-error-label {
          color: #ef4444;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .mermaid-error-detail,
        .mermaid-error-source {
          font-size: 12px;
          color: #94a3b8;
          overflow-x: auto;
          white-space: pre-wrap;
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
