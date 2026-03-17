'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import {
  X, Plus, Pencil, Trash2, Check, ChevronDown,
  Search, GripVertical, Copy, Sigma, Code2, LayoutGrid, FileText
} from 'lucide-react';
import clsx from 'clsx';
import type { Snippet } from '@/services/snippetApi';
import {
  fetchSnippets,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  seedDefaultSnippets
} from '@/services/snippetApi';

/**
 * Metadatos de categorías para el filtrado de snippets.
 */
const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: LayoutGrid },
  { id: 'math', label: 'Matemáticas', icon: Sigma },
  { id: 'diagram', label: 'Diagramas', icon: FileText },
  { id: 'structure', label: 'Estructura', icon: LayoutGrid },
  { id: 'code', label: 'Código', icon: Code2 },
  { id: 'general', label: 'General', icon: FileText }
] as const;

/**
 * Vista previa minimalista de Markdown que renderiza KaTeX y GFM.
 */
const MiniPreview = React.memo(({ content }: { content: string }) => (
  <div className="snippet-mini-preview overflow-hidden text-xs leading-relaxed text-slate-300 max-h-24">
    <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
      {content}
    </ReactMarkdown>
  </div>
));
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
  onInsert: (markdown: string) => void;
  onEdit: (snippet: Snippet) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="group relative rounded-lg border border-slate-800 bg-slate-900/60 transition hover:border-blue-500/40">
      <button
        type="button"
        className="w-full cursor-pointer p-3 text-left"
        onClick={() => onInsert(snippet.markdown)}
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
        <MiniPreview content={snippet.markdown} />
      </button>

      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onInsert(snippet.markdown); }}
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
function SnippetEditorModal({
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
              <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Markdown</label>
              <textarea
                ref={textareaRef}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder="Escribe el markdown del snippet..."
                rows={8}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-slate-500">Preview</label>
              <div className="h-[calc(8*1.5rem+1rem)] overflow-auto rounded-lg border border-slate-700 bg-slate-950/50 p-3">
                <MiniPreview content={markdown} />
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

/**
 * SnippetGallery — Barra lateral de gestión e inserción de snippets.
 * Proporciona búsqueda, filtrado por categorías y operaciones CRUD.
 */
export default function SnippetGallery({
  workspaceId,
  onInsert,
  onClose
}: {
  workspaceId: string;
  onInsert: (markdown: string) => void;
  onClose: () => void;
}) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [editingSnippet, setEditingSnippet] = useState<Partial<Snippet> | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const seededRef = useRef(false);

  /**
   * Carga los snippets del workspace y aplica semillas por defecto si está vacío.
   */
  const loadSnippets = useCallback(async () => {
    setLoading(true);
    const items = await fetchSnippets(workspaceId);

    if (items.length === 0 && !seededRef.current) {
      seededRef.current = true;
      const seeded = await seedDefaultSnippets(workspaceId);
      setSnippets(seeded);
    } else {
      setSnippets(items);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { void loadSnippets(); }, [loadSnippets]);

  const filtered = useMemo(() => {
    let list = snippets;
    if (activeCategory !== 'all') {
      list = list.filter((s) => s.category === activeCategory);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.markdown.toLowerCase().includes(q)
      );
    }
    return list;
  }, [snippets, activeCategory, searchQuery]);

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

  return (
    <>
      <div className="flex h-full flex-col bg-slate-950 text-slate-200">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Snippets</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleNew}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-blue-300"
              title="Nuevo snippet"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              title="Cerrar galería"
            >
              <X className="h-3.5 w-3.5" />
            </button>
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
          {CATEGORIES.map((cat) => {
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
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              {searchQuery ? 'Sin resultados' : 'No hay snippets. ¡Crea el primero!'}
            </div>
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
