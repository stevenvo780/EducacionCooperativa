'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  createNotebook,
  deleteNotebook,
  listNotebooks,
  type NotebookListItem
} from '@/lib/notebooks';
import { TEMPLATES } from './templates';

export default function NotebookList() {
  const { user } = useAuth();
  const router = useRouter();
  const [notebooks, setNotebooks] = useState<NotebookListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const items = await listNotebooks(user.uid);
      setNotebooks(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando notebooks');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(
    async (templateIndex: number) => {
      if (!user) return;
      const template = TEMPLATES[templateIndex];
      if (!template) return;
      setCreating(true);
      try {
        const nb = template.create();
        const id = await createNotebook(user.uid, nb);
        router.push(`/st-notebook/${id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error creando notebook');
        setCreating(false);
      }
    },
    [user, router]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!user) return;
      if (!window.confirm('¿Eliminar este notebook?')) return;
      setDeletingId(id);
      try {
        await deleteNotebook(user.uid, id);
        setNotebooks(prev => prev.filter(n => n.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error eliminando notebook');
      } finally {
        setDeletingId(null);
      }
    },
    [user]
  );

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!user) return;
      const file = e.target.files?.[0];
      if (!file) return;
      setImporting(true);
      setError(null);
      try {
        const text = await file.text();
        const { parseNotebook } = await import('@stevenvo780/st-lang/format/stnb');
        const nb = parseNotebook(text);
        const id = await createNotebook(user.uid, nb);
        router.push(`/st-notebook/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error importando archivo');
        setImporting(false);
      } finally {
        e.target.value = '';
      }
    },
    [user, router]
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        Debes iniciar sesión para usar ST Notebook.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">ST Notebooks</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {TEMPLATES.map((tmpl, i) => (
            <button
              key={i}
              disabled={creating}
              onClick={() => { void handleCreate(i); }}
              className="px-3 py-1.5 text-sm rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              + {tmpl.label}
            </button>
          ))}
          <label className="px-3 py-1.5 text-sm rounded border border-gray-300 cursor-pointer hover:bg-gray-50 disabled:opacity-50">
            {importing ? 'Importando…' : 'Importar .stnb'}
            <input
              type="file"
              accept=".stnb,.json"
              className="hidden"
              disabled={importing}
              onChange={handleImport}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Cargando…</div>
      ) : notebooks.length === 0 ? (
        <div className="text-gray-400 text-sm py-8 text-center">
          No hay notebooks. Crea uno con los botones de arriba.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
          {notebooks.map(nb => (
            <li
              key={nb.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
            >
              <button
                className="flex-1 text-left"
                onClick={() => router.push(`/st-notebook/${nb.id}`)}
              >
                <span className="font-medium text-sm">{nb.title || 'Sin título'}</span>
                <span className="ml-2 text-xs text-gray-400">{nb.profile}</span>
                <span className="ml-2 text-xs text-gray-300">
                  {nb.updatedAt ? new Date(nb.updatedAt).toLocaleDateString() : ''}
                </span>
              </button>
              <button
                disabled={deletingId === nb.id}
                onClick={() => { void handleDelete(nb.id); }}
                className="ml-4 text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
              >
                {deletingId === nb.id ? '…' : 'Eliminar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
