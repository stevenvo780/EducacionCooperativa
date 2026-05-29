'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Heading1, Heading2, Heading3, FileQuestion, Sigma, BookCheck, Cog } from 'lucide-react';
import type { DocItem } from '@/components/dashboard/types';
import { authFetch } from '@/services/apiClient';
import { parseMarkdownOutline, type OutlineHeading } from '@/lib/markdown-outline';
import { parseSTOutline, type STOutlineEntry } from '@/lib/st-outline';
import { AGORA_EVENTS, subscribeAgoraEvent } from '@/lib/agora-events';

interface OutlineViewProps {
  selectedDoc: DocItem | null;
  onJumpTo?: (line: number) => void;
}

// Tipos textuales que el outline soporta. 'text' y 'file' son los canónicos
// post-NAS; 'markdown' aparece en docs migrados/legacy y por algunos creadores;
// undefined cae en el default 'text'.
const TEXTUAL_DOC_TYPES = new Set<string>(['text', 'file', 'markdown', 'md', 'st', undefined as unknown as string]);
const NON_TEXTUAL_DOC_TYPES = new Set<string>(['folder', 'terminal', 'board', 'kanban', 'st-runner', 'semantic-browser', 'formalizer', 'agora-ai', 'snippets', 'file-explorer']);

const isLikelyST = (doc: DocItem): boolean => {
  const name = (doc.name || '').toLowerCase();
  const mime = (doc.mimeType || '').toLowerCase();
  if (name.endsWith('.st')) return true;
  if (mime === 'text/x-st' || mime.includes('st-lang')) return true;
  return false;
};

const isLikelyTextual = (doc: DocItem): boolean => {
  const name = (doc.name || '').toLowerCase();
  const mime = (doc.mimeType || '').toLowerCase();
  if (/\.(md|markdown|mdx|st|txt)$/i.test(name)) return true;
  if (mime.startsWith('text/') || mime.includes('markdown')) return true;
  return false;
};

const isOutlineableDoc = (doc: DocItem): boolean => {
  if (!doc) return false;
  const type = doc.type ?? 'text';
  if (NON_TEXTUAL_DOC_TYPES.has(type)) return false;
  // Si el nombre o mime aparenta texto, soportado SIEMPRE (cubre docs migrados
  // con `type='document'` o similar que no encajan en TEXTUAL_DOC_TYPES).
  if (isLikelyTextual(doc)) return true;
  if (TEXTUAL_DOC_TYPES.has(type)) return true;
  return false;
};

export default function OutlineView({ selectedDoc, onJumpTo }: OutlineViewProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLiveUpdateAt = useRef(0);

  useEffect(() => {
    if (!selectedDoc || !isOutlineableDoc(selectedDoc)) {
      setContent('');
      setError(null);
      return;
    }
    let active = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const fetchContent = async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        const res = await authFetch(`/api/documents/${encodeURIComponent(selectedDoc.id)}/raw`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (active) {
          setContent(text);
          setError(null);
        }
      } catch (e) {
        if (active && !silent) setError(e instanceof Error ? e.message : 'Error cargando contenido');
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    void fetchContent(false);
    pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (Date.now() - lastLiveUpdateAt.current < 60_000) return;
      void fetchContent(true);
    }, 120_000);

    // Live: cuando el editor activo dispara cambios, actualizamos el outline
    // de inmediato sin esperar al save ni al poll.
    const unsubscribeLive = subscribeAgoraEvent(AGORA_EVENTS.documentContent, (detail) => {
      if (!detail || detail.docId !== selectedDoc.id || typeof detail.content !== 'string') return;
      lastLiveUpdateAt.current = Date.now();
      setContent(detail.content);
      setError(null);
    });

    return () => {
      active = false;
      if (pollTimer) clearInterval(pollTimer);
      unsubscribeLive();
    };
  }, [selectedDoc]);

  const isST = !!selectedDoc && isLikelyST(selectedDoc);
  const mdHeadings = useMemo<OutlineHeading[]>(() => isST ? [] : parseMarkdownOutline(content), [content, isST]);
  const stEntries = useMemo<STOutlineEntry[]>(() => isST ? parseSTOutline(content) : [], [content, isST]);
  const isEmpty = isST ? stEntries.length === 0 : mdHeadings.length === 0;

  return (
    <div className="flex h-full w-full flex-col bg-surface-900">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-surface-700/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
        <span>Esquema</span>
        {selectedDoc && (
          <span className="text-[10px] text-surface-500">
            {isST ? 'ST' : 'Markdown'}
            {!isEmpty && ` · ${isST ? stEntries.length : mdHeadings.length}`}
          </span>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {!selectedDoc ? (
          <Empty
            icon={<FileQuestion className="h-4 w-4" />}
            text="Sin documento abierto"
            hint="Abre un archivo Markdown o .st para ver su estructura."
          />
        ) : !isOutlineableDoc(selectedDoc) ? (
          <Empty
            icon={<FileQuestion className="h-4 w-4" />}
            text="Tipo no soportado"
            hint="El esquema soporta documentos de texto (.md, .st)."
          />
        ) : loading ? (
          <p className="px-3 py-3 text-[11px] text-surface-500">Cargando…</p>
        ) : error ? (
          <p className="px-3 py-3 text-[11px] text-rose-300">No se pudo cargar: {error}</p>
        ) : isEmpty ? (
          <Empty
            icon={<Hash className="h-4 w-4" />}
            text={isST ? 'Sin elementos ST' : 'Sin encabezados'}
            hint={isST
              ? 'Define logic, axiom, derive o check para que aparezcan aquí.'
              : 'Este documento no tiene títulos (#, ##, ###).'}
          />
        ) : isST ? (
          <ul className="space-y-px text-[12px]">
            {stEntries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => onJumpTo?.(entry.line)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-surface-200 transition hover:bg-surface-800/60 hover:text-white"
                  style={{ paddingLeft: `${8 + entry.depth * 12}px` }}
                  title={`Línea ${entry.line} · ${entry.kind}`}
                >
                  <STKindIcon kind={entry.kind} />
                  <span className="truncate">
                    <span className="text-surface-500 mr-1">{entry.kind}</span>
                    {entry.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-px text-[12px]">
            {mdHeadings.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => onJumpTo?.(h.line)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-surface-200 transition hover:bg-surface-800/60 hover:text-white"
                  style={{ paddingLeft: `${8 + (h.level - 1) * 12}px` }}
                  title={`Línea ${h.line}`}
                >
                  <HeadingIcon level={h.level} />
                  <span className="truncate">{h.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function STKindIcon({ kind }: { kind: STOutlineEntry['kind'] }) {
  const cls = 'h-3 w-3 shrink-0';
  if (kind === 'logic') return <Cog className={`${cls} text-mandy-300`} />;
  if (kind === 'axiom') return <BookCheck className={`${cls} text-sky-300`} />;
  if (kind === 'derive') return <Sigma className={`${cls} text-emerald-300`} />;
  return <Hash className={`${cls} text-surface-500`} />;
}

function HeadingIcon({ level }: { level: number }) {
  const cls = 'h-3 w-3 shrink-0';
  if (level === 1) return <Heading1 className={`${cls} text-mandy-300`} />;
  if (level === 2) return <Heading2 className={`${cls} text-sky-300`} />;
  if (level === 3) return <Heading3 className={`${cls} text-emerald-300`} />;
  return <Hash className={`${cls} text-surface-500`} />;
}

function Empty({ icon, text, hint }: { icon: React.ReactNode; text: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center text-xs text-surface-500">
      <span>{icon}</span>
      <span className="text-surface-300">{text}</span>
      <span className="text-[10px]">{hint}</span>
    </div>
  );
}
