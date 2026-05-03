'use client';

import { useEffect, useMemo, useState } from 'react';
import { Hash, Heading1, Heading2, Heading3, FileQuestion } from 'lucide-react';
import type { DocItem } from '@/components/dashboard/types';
import { authFetch } from '@/services/apiClient';

interface OutlineItem {
  level: number;
  text: string;
  line: number;
  id: string;
}

function parseHeadings(content: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim();
      const id = `${i}-${text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}`;
      items.push({ level, text, line: i + 1, id });
    }
  }
  return items;
}

interface OutlineViewProps {
  selectedDoc: DocItem | null;
  onJumpTo?: (line: number) => void;
}

export default function OutlineView({ selectedDoc, onJumpTo }: OutlineViewProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDoc || selectedDoc.type !== 'file') {
      setContent('');
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await authFetch(`/api/documents/${encodeURIComponent(selectedDoc.id)}/raw`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (active) setContent(text);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Error cargando contenido');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [selectedDoc]);

  const headings = useMemo(() => parseHeadings(content), [content]);

  return (
    <div className="flex h-full w-full flex-col bg-surface-900">
      <header className="flex h-9 shrink-0 items-center border-b border-surface-700/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
        Esquema
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {!selectedDoc ? (
          <Empty
            icon={<FileQuestion className="h-4 w-4" />}
            text="Sin documento abierto"
            hint="Abre un archivo Markdown para ver su estructura."
          />
        ) : loading ? (
          <p className="px-3 py-3 text-[11px] text-surface-500">Cargando…</p>
        ) : error ? (
          <p className="px-3 py-3 text-[11px] text-rose-300">No se pudo cargar: {error}</p>
        ) : headings.length === 0 ? (
          <Empty
            icon={<Hash className="h-4 w-4" />}
            text="Sin encabezados"
            hint="Este documento no tiene títulos (#, ##, ###)."
          />
        ) : (
          <ul className="space-y-px text-[12px]">
            {headings.map((h) => (
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
