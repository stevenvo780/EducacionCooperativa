'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { loadNotebook, saveNotebook } from '@/lib/notebooks';
import type { Cell, CodeCell, Notebook } from '@/types/stnb';
import NotebookToolbar from './NotebookToolbar';
import CellEditor from './CellEditor';
import { runCellInWorker } from './st-eval-worker-client';

interface Props {
  notebookId: string;
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function NotebookEditor({ notebookId }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningCellId, setRunningCellId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    loadNotebook(user.uid, notebookId)
      .then(nb => { setNotebook(nb); })
      .catch(e => { setError(e instanceof Error ? e.message : 'Error cargando notebook'); })
      .finally(() => { setLoading(false); });
  }, [user, notebookId]);

  const updateNotebook = useCallback((updater: (prev: Notebook) => Notebook) => {
    setNotebook(prev => {
      if (!prev) return prev;
      return updater(prev);
    });
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    updateNotebook(nb => ({
      ...nb,
      metadata: { ...nb.metadata, title }
    }));
  }, [updateNotebook]);

  const handleProfileChange = useCallback((profile: string) => {
    updateNotebook(nb => ({
      ...nb,
      metadata: { ...nb.metadata, profile }
    }));
  }, [updateNotebook]);

  const handleCellUpdate = useCallback((updated: Cell) => {
    updateNotebook(nb => ({
      ...nb,
      cells: nb.cells.map(c => c.id === updated.id ? updated : c)
    }));
  }, [updateNotebook]);

  const handleCellRemove = useCallback((id: string) => {
    updateNotebook(nb => ({
      ...nb,
      cells: nb.cells.filter(c => c.id !== id)
    }));
  }, [updateNotebook]);

  const handleAddCode = useCallback(() => {
    updateNotebook(nb => ({
      ...nb,
      cells: [
        ...nb.cells,
        { id: newId(), type: 'code', source: '', outputs: [] } satisfies CodeCell
      ]
    }));
  }, [updateNotebook]);

  const handleAddMarkdown = useCallback(() => {
    updateNotebook(nb => ({
      ...nb,
      cells: [
        ...nb.cells,
        { id: newId(), type: 'markdown', source: '' }
      ]
    }));
  }, [updateNotebook]);

  const runCell = useCallback(
    async (cellId: string, nb: Notebook): Promise<Notebook> => {
      const cell = nb.cells.find(c => c.id === cellId);
      if (!cell || cell.type !== 'code') return nb;
      const profile = (cell as CodeCell).profile ?? nb.metadata.profile;
      const outputs = await runCellInWorker(cell as CodeCell, profile);
      const updatedCell: CodeCell = {
        ...(cell as CodeCell),
        outputs
      };
      return {
        ...nb,
        cells: nb.cells.map(c => c.id === cellId ? updatedCell : c)
      };
    },
    []
  );

  const handleRunCell = useCallback(
    async (cellId: string) => {
      if (!notebook) return;
      setRunningCellId(cellId);
      try {
        const updated = await runCell(cellId, notebook);
        setNotebook(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error ejecutando celda');
      } finally {
        setRunningCellId(null);
      }
    },
    [notebook, runCell]
  );

  const handleRunAll = useCallback(async () => {
    if (!notebook) return;
    setRunningAll(true);
    setError(null);
    try {
      let nb = notebook;
      for (const cell of nb.cells) {
        if (cell.type === 'code') {
          nb = await runCell(cell.id, nb);
        }
      }
      setNotebook(nb);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error ejecutando notebook');
    } finally {
      setRunningAll(false);
    }
  }, [notebook, runCell]);

  const handleSave = useCallback(async () => {
    if (!user || !notebook) return;
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const nbToSave: Notebook = {
        ...notebook,
        metadata: { ...notebook.metadata, updatedAt: now }
      };
      await saveNotebook(user.uid, notebookId, nbToSave);
      setNotebook(nbToSave);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando notebook');
    } finally {
      setSaving(false);
    }
  }, [user, notebook, notebookId]);

  const handleExportStnb = useCallback(async () => {
    if (!notebook) return;
    const { serializeNotebook } = await import('@stevenvo780/st-lang/format/stnb');
    const content = serializeNotebook(notebook);
    const safe = (notebook.metadata.title || 'notebook').replace(/[^a-z0-9_-]/gi, '_');
    downloadBlob(content, `${safe}.stnb`, 'application/json');
  }, [notebook]);

  const handleExportHtml = useCallback(async () => {
    if (!notebook) return;
    const { renderHTML } = await import('@stevenvo780/st-lang/format/stnb');
    try {
      const html = renderHTML(notebook);
      const safe = (notebook.metadata.title || 'notebook').replace(/[^a-z0-9_-]/gi, '_');
      downloadBlob(html, `${safe}.html`, 'text/html');
    } catch {
      setError('Error exportando HTML — ejecuta las celdas primero');
    }
  }, [notebook]);

  // Auto-save with debounce on notebook changes (not on initial load)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!notebook || !user) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => { void handleSave(); }, 3000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [notebook, user, handleSave]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        Debes iniciar sesión para usar ST Notebook.
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-40 text-gray-400">Cargando notebook…</div>;
  }

  if (error && !notebook) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3">
        <p className="text-red-600 text-sm">{error}</p>
        <button
          onClick={() => router.push('/st-notebook')}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Volver a la lista
        </button>
      </div>
    );
  }

  if (!notebook) return null;

  return (
    <div className="flex flex-col h-screen">
      <NotebookToolbar
        title={notebook.metadata.title}
        profile={notebook.metadata.profile}
        saving={saving}
        running={runningAll}
        onTitleChange={handleTitleChange}
        onProfileChange={handleProfileChange}
        onSave={() => { void handleSave(); }}
        onRunAll={() => { void handleRunAll(); }}
        onExportStnb={() => { void handleExportStnb(); }}
        onExportHtml={() => { void handleExportHtml(); }}
        onAddCode={handleAddCode}
        onAddMarkdown={handleAddMarkdown}
        onBack={() => router.push('/st-notebook')}
      />

      {error && (
        <div className="mx-4 mt-2 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
        {notebook.cells.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">
            No hay celdas. Añade una con los botones de la barra.
          </div>
        )}
        {notebook.cells.map((cell, i) => (
          <CellEditor
            key={cell.id}
            cell={cell}
            index={i}
            onUpdate={handleCellUpdate}
            onRun={handleRunCell}
            onRemove={handleCellRemove}
            running={runningCellId === cell.id || (runningAll && cell.type === 'code')}
          />
        ))}
      </div>
    </div>
  );
}
