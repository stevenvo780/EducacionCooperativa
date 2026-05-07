'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { List as VirtualizedList, type RowComponentProps } from 'react-window';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import {
  X, Plus, Pencil, Trash2, Check,
  Search, Copy, Sigma, Code2, LayoutGrid, FileText, BookOpen, TerminalSquare,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import {
  fetchSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  seedDefaultSnippets,
  type Snippet
} from '@/services/snippetApi';

const SNIPPET_ROW_HEIGHT = 144;
const SNIPPET_VIRTUALIZE_THRESHOLD = 24;

/**
 * Metadatos de categorías para el filtrado de snippets.
 */
const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: LayoutGrid },
  { id: 'math', label: 'Matemáticas', icon: Sigma },
  { id: 'diagram', label: 'Diagramas', icon: FileText },
  { id: 'structure', label: 'Estructura', icon: LayoutGrid },
  { id: 'code', label: 'Código', icon: Code2 },
  { id: 'general', label: 'General', icon: FileText },
  { id: 'formalization', label: 'Formalización', icon: BookOpen },
  { id: 'st', label: 'ST', icon: TerminalSquare }
] as const;

/**
 * Vista previa minimalista de Markdown que renderiza KaTeX y GFM.
 * El render del Markdown/KaTeX es perezoso: hasta que el card entra en viewport
 * (o se acerca a 200px) mostramos un skeleton para evitar parsear ~43 cards al
 * primer mount con KaTeX simultáneo.
 */
const MiniPreview = React.memo(({ content, category }: { content: string; category: string }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (shouldRender) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShouldRender(true);
      return;
    }
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldRender(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '200px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRender]);

  if (category === 'st' || category === 'formalization') {
    return (
      <pre className="overflow-hidden whitespace-pre-wrap rounded bg-slate-950/60 p-2 font-mono text-[11px] leading-relaxed text-slate-300 max-h-24">
        {content}
      </pre>
    );
  }

  if (!shouldRender) {
    return (
      <div
        ref={containerRef}
        className="snippet-mini-preview overflow-hidden text-xs leading-relaxed text-slate-500 max-h-24"
        aria-hidden="true"
      >
        <div className="h-2 w-3/4 rounded bg-slate-800/70" />
        <div className="mt-1.5 h-2 w-1/2 rounded bg-slate-800/50" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="snippet-mini-preview overflow-hidden text-xs leading-relaxed text-slate-300 max-h-24">
      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
MiniPreview.displayName = 'MiniPreview';

/**
 * Tarjeta individual de snippet con acciones de inserción y edición.
 */
function SnippetCardInner({
  snippet,
  onInsert,
  onEdit,
  onDelete
}: {
  snippet: Snippet;
  onInsert: (markdown: string, snippet?: Snippet) => void;
  onEdit: (snippet: Snippet) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="group relative rounded-lg border border-slate-800 bg-slate-900/60 transition hover:border-blue-500/40">
      <button
        type="button"
        className="w-full cursor-pointer p-3 text-left"
        onClick={() => onInsert(snippet.markdown, snippet)}
        title="Click para insertar"
      >
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-300 truncate">
            {snippet.title}
          </span>
          <span className="ml-auto text-[10px] text-slate-600 capitalize">{snippet.category}</span>
        </div>
        {snippet.description && (
          <p className="mb-2 text-[10px] text-slate-500 line-clamp-1">{snippet.description}</p>
        )}
        <MiniPreview content={snippet.markdown} category={snippet.category} />
      </button>

      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onInsert(snippet.markdown, snippet); }}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          title="Insertar"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(snippet); }}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          title="Editar"
        >
          <Pencil className="h-3 w-3" />
        </button>
        {confirmDelete ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(snippet.id); setConfirmDelete(false); }}
            className="rounded p-1 text-red-400 hover:bg-red-900/40 hover:text-red-300"
            title="Confirmar eliminar"
          >
            <Check className="h-3 w-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-red-300"
            title="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
const SnippetCard = React.memo(SnippetCardInner);

/**
 * Modal para la creación y edición de snippets.
 */
export function SnippetEditorModal({
  initial,
  onSave,
  onCancel
}: {
  initial: Partial<Snippet> | null;
  onSave: (data: { title: string; description: string; markdown: string; category: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [markdown, setMarkdown] = useState(initial?.markdown || '');
  const [category, setCategory] = useState(initial?.category || 'general');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-200">
            {initial?.id ? 'Editar snippet' : 'Nuevo snippet'}
          </h3>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título del snippet"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Categoría del snippet"
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción corta (opcional)"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Contenido</label>
              <textarea
                ref={textareaRef}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder="Escribe el contenido del snippet..."
                rows={8}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Preview</label>
              <div className="h-[calc(8*1.5rem+1rem)] overflow-auto rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                <MiniPreview content={markdown} category={category} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSave({ title, description, markdown, category })}
            disabled={!title.trim() || !markdown.trim()}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:opacity-40"
          >
            {initial?.id ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface VirtualizedSnippetRowData {
  items: Snippet[];
  onInsert: (markdown: string, snippet?: Snippet) => void;
  onEdit: (snippet: Snippet) => void;
  onDelete: (id: string) => void;
}

function VirtualizedSnippetRow(props: RowComponentProps<VirtualizedSnippetRowData>) {
  const { index, style, items, onInsert, onEdit, onDelete } = props;
  const snippet = items[index];
  if (!snippet) return null;
  return (
    <div style={style} className="px-0.5">
      <div style={{ height: SNIPPET_ROW_HEIGHT - 8 }}>
        <SnippetCard
          snippet={snippet}
          onInsert={onInsert}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function VirtualizedSnippetList({
  items,
  onInsert,
  onEdit,
  onDelete
}: VirtualizedSnippetRowData) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="h-full">
      {size.height > 0 && (
        <VirtualizedList<VirtualizedSnippetRowData>
          rowCount={items.length}
          rowHeight={SNIPPET_ROW_HEIGHT}
          overscanCount={4}
          rowComponent={VirtualizedSnippetRow}
          rowProps={{ items, onInsert, onEdit, onDelete }}
          style={{ height: size.height, width: '100%' }}
        />
      )}
    </div>
  );
}

/**
 * SnippetGallery — Barra lateral de gestión e inserción de snippets.
 * Proporciona búsqueda, filtrado por categorías y operaciones CRUD.
 */
export default function SnippetGallery({
  workspaceId,
  onInsert,
  onClose,
  allowedCategories,
  hideClose = false,
  title = 'Snippets',
  emptyLabel
}: {
  workspaceId: string;
  onInsert: (markdown: string, snippet?: Snippet) => void;
  onClose?: () => void;
  allowedCategories?: string[];
  hideClose?: boolean;
  title?: string;
  emptyLabel?: string;
}) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [editingSnippet, setEditingSnippet] = useState<Partial<Snippet> | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const seededRef = useRef(false);

  const loadSnippets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await fetchSnippets(workspaceId);
      if (!seededRef.current) {
        seededRef.current = true;
        const seeded = await seedDefaultSnippets(workspaceId, items);
        setSnippets(seeded);
      } else {
        setSnippets(items);
      }
    } catch (err) {
      console.error('[SnippetGallery] fetchSnippets failed', err);
      setLoadError('No se pudieron cargar los snippets. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void loadSnippets(); }, [loadSnippets]);

  const filtered = useMemo(() => {
    const allowedSet = allowedCategories && allowedCategories.length > 0
      ? new Set(allowedCategories)
      : null;
    const categoryFilter = activeCategory !== 'all' ? activeCategory : null;
    const q = searchQuery.trim().toLowerCase();

    if (!allowedSet && !categoryFilter && !q) return snippets;

    return snippets.filter((s) => {
      if (allowedSet && !allowedSet.has(s.category)) return false;
      if (categoryFilter && s.category !== categoryFilter) return false;
      if (q) {
        const matchTitle = s.title.toLowerCase().includes(q);
        const matchDesc = s.description.toLowerCase().includes(q);
        const matchMd = s.markdown.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchMd) return false;
      }
      return true;
    });
  }, [allowedCategories, snippets, activeCategory, searchQuery]);

  const visibleCategories = useMemo(() => {
    if (!allowedCategories || allowedCategories.length === 0) {
      return CATEGORIES;
    }
    return CATEGORIES.filter((category) => category.id === 'all' || allowedCategories.includes(category.id));
  }, [allowedCategories]);

  const handleSave = useCallback(async (data: { title: string; description: string; markdown: string; category: string }) => {
    if (editingSnippet?.id) {
      const ok = await updateSnippet(editingSnippet.id, data);
      if (ok) {
        setSnippets(prev => prev.map(s => s.id === editingSnippet.id ? { ...s, ...data } : s));
      }
    } else {
      const created = await createSnippet({ ...data, workspaceId, order: snippets.length });
      if (created) {
        setSnippets(prev => [...prev, created]);
      }
    }
    setShowEditor(false);
    setEditingSnippet(null);
  }, [editingSnippet, workspaceId, snippets.length]);

  const handleDelete = useCallback(async (id: string) => {
    const ok = await deleteSnippet(id);
    if (ok) {
      setSnippets(prev => prev.filter(s => s.id !== id));
    }
  }, []);

  const handleEdit = useCallback((snippet: Snippet) => {
    setEditingSnippet(snippet);
    setShowEditor(true);
  }, []);

  const handleNew = useCallback(() => {
    setEditingSnippet(null);
    setShowEditor(true);
  }, []);

  const duplicateGroups = useMemo(() => {
    const seen = new Map<string, Snippet[]>();
    for (const s of snippets) {
      const key = `${(s.title || '').trim().toLowerCase()}::${(s.markdown || '').trim()}`;
      const arr = seen.get(key) ?? [];
      arr.push(s);
      seen.set(key, arr);
    }
    return Array.from(seen.values()).filter((arr) => arr.length > 1);
  }, [snippets]);

  const duplicateCount = useMemo(
    () => duplicateGroups.reduce((sum, arr) => sum + (arr.length - 1), 0),
    [duplicateGroups]
  );

  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);

  const handleCleanDuplicates = useCallback(async () => {
    if (duplicateCount === 0 || cleaningDuplicates) return;
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        `Se eliminarán ${duplicateCount} snippet${duplicateCount === 1 ? '' : 's'} duplicado${duplicateCount === 1 ? '' : 's'}, conservando uno de cada grupo. ¿Continuar?`
      );
      if (!ok) return;
    }
    setCleaningDuplicates(true);
    try {
      const idsToDelete: string[] = [];
      for (const group of duplicateGroups) {
        const sorted = [...group].sort((a, b) => {
          const ao = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
          const bo = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return String(a.id).localeCompare(String(b.id));
        });
        for (let i = 1; i < sorted.length; i++) {
          const item = sorted[i];
          if (item?.id) idsToDelete.push(item.id);
        }
      }
      const results = await Promise.allSettled(idsToDelete.map((id) => deleteSnippet(id)));
      const okIds = new Set<string>();
      results.forEach((r, idx) => {
        const id = idsToDelete[idx];
        if (r.status === 'fulfilled' && r.value && id) okIds.add(id);
      });
      if (okIds.size > 0) {
        setSnippets((prev) => prev.filter((s) => !okIds.has(s.id)));
      }
    } finally {
      setCleaningDuplicates(false);
    }
  }, [duplicateGroups, duplicateCount, cleaningDuplicates]);

  return (
    <>
      <div className="flex h-full flex-col bg-slate-950 text-slate-200">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
          <div className="flex items-center gap-1">
            {duplicateCount > 0 && (
              <button
                type="button"
                onClick={handleCleanDuplicates}
                disabled={cleaningDuplicates}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-50"
                title={`Eliminar ${duplicateCount} duplicado${duplicateCount === 1 ? '' : 's'}`}
              >
                <Sparkles className="h-3 w-3" />
                <span>{cleaningDuplicates ? '…' : `${duplicateCount} dup`}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleNew}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-blue-300"
              title="Nuevo snippet"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            {!hideClose && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                title="Cerrar galería"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="shrink-0 border-b border-slate-800 px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar snippets..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="shrink-0 flex gap-1 overflow-x-auto border-b border-slate-800 px-3 py-1.5 scrollbar-thin">
          {visibleCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition',
                  activeCategory === cat.id
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                )}
              >
                <Icon className="h-3 w-3" />
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto p-3">
          {loadError && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => { void loadSnippets(); }}
                className="rounded border border-red-400/60 px-2 py-0.5 text-[10px] text-red-100 transition hover:bg-red-500/20"
              >
                Reintentar
              </button>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-300">
                <FileText className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-200">
                  {searchQuery ? 'Sin resultados' : 'Aún no hay snippets'}
                </p>
                <p className="text-xs text-slate-400">
                  {searchQuery
                    ? 'Prueba con otro término o crea uno nuevo.'
                    : (emptyLabel ?? 'Guarda fragmentos reutilizables y reusa con un click.')}
                </p>
              </div>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={handleNew}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-200 transition hover:border-blue-400 hover:bg-blue-500/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Crear primer snippet
                </button>
              )}
            </div>
          ) : filtered.length > SNIPPET_VIRTUALIZE_THRESHOLD ? (
            <VirtualizedSnippetList
              items={filtered}
              onInsert={onInsert}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <div className="grid gap-2">
              {filtered.map((s) => (
                <SnippetCard
                  key={s.id}
                  snippet={s}
                  onInsert={onInsert}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showEditor && (
        <SnippetEditorModal
          initial={editingSnippet}
          onSave={handleSave}
          onCancel={() => { setShowEditor(false); setEditingSnippet(null); }}
        />
      )}
    </>
  );
}
