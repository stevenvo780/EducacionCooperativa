'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { BoardCard, BoardColumn } from '@/components/dashboard/types';
import {
  createBoardCardApi,
  createBoardColumnApi,
  deleteBoardCardApi,
  deleteBoardColumnApi,
  fetchBoardApi,
  updateBoardCardApi,
  updateBoardColumnApi
} from '@/services/boardApi';

interface KanbanBoardProps {
  workspaceId?: string | null;
  workspaceName?: string;
  ownerId?: string | null;
}

const KanbanBoard = ({ workspaceId, workspaceName, ownerId }: KanbanBoardProps) => {
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({});
  const [columnDrafts, setColumnDrafts] = useState<Record<string, string>>({});

  const columnsOrdered = useMemo(() => {
    return [...columns].sort((a, b) => a.order - b.order);
  }, [columns]);

  const cardsByColumn = useMemo(() => {
    const grouped: Record<string, BoardCard[]> = {};
    columns.forEach(col => {
      grouped[col.id] = [];
    });
    cards.forEach(card => {
      if (!grouped[card.columnId]) grouped[card.columnId] = [];
      grouped[card.columnId].push(card);
    });
    Object.values(grouped).forEach(list => list.sort((a, b) => a.order - b.order));
    return grouped;
  }, [cards, columns]);

  const loadBoard = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBoardApi({ workspaceId });
      setColumns(data.columns || []);
      setCards(data.cards || []);
      setColumnDrafts({});
    } catch (err) {
      console.error('Error loading board', err);
      setError('No se pudo cargar el tablero.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) {
      setColumns([]);
      setCards([]);
      return;
    }
    loadBoard();
  }, [workspaceId, loadBoard]);

  const handleAddColumn = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    const name = newColumnName.trim();
    if (!name) return;
    try {
      const created = await createBoardColumnApi({ workspaceId, name });
      setColumns(prev => [...prev, created]);
      setNewColumnName('');
    } catch (err) {
      console.error('Error creating column', err);
      setError('No se pudo crear la columna.');
    }
  };

  const handleRenameColumn = async (columnId: string, name: string) => {
    if (!workspaceId) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await updateBoardColumnApi({ workspaceId, columnId, name: trimmed });
      setColumns(prev => prev.map(col => (col.id === columnId ? { ...col, name: trimmed } : col)));
    } catch (err) {
      console.error('Error renaming column', err);
      setError('No se pudo renombrar la columna.');
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!workspaceId) return;
    const ok = window.confirm('¿Eliminar la columna y sus tarjetas?');
    if (!ok) return;
    try {
      await deleteBoardColumnApi({ workspaceId, columnId });
      setColumns(prev => prev.filter(col => col.id !== columnId));
      setCards(prev => prev.filter(card => card.columnId !== columnId));
    } catch (err) {
      console.error('Error deleting column', err);
      setError('No se pudo eliminar la columna.');
    }
  };

  const handleAddCard = async (columnId: string, e: FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;
    const title = (newCardTitles[columnId] || '').trim();
    if (!title) return;
    try {
      const created = await createBoardCardApi({ workspaceId, columnId, title, ownerId });
      setCards(prev => [...prev, created]);
      setNewCardTitles(prev => ({ ...prev, [columnId]: '' }));
    } catch (err) {
      console.error('Error creating card', err);
      setError('No se pudo crear la tarjeta.');
    }
  };

  const handleMoveCard = async (cardId: string, newColumnId: string) => {
    if (!workspaceId) return;
    try {
      const nextOrder = Date.now();
      await updateBoardCardApi({ workspaceId, cardId, columnId: newColumnId, order: nextOrder });
      setCards(prev => prev.map(card => (card.id === cardId ? { ...card, columnId: newColumnId, order: nextOrder } : card)));
    } catch (err) {
      console.error('Error moving card', err);
      setError('No se pudo mover la tarjeta.');
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!workspaceId) return;
    try {
      await deleteBoardCardApi({ workspaceId, cardId });
      setCards(prev => prev.filter(card => card.id !== cardId));
    } catch (err) {
      console.error('Error deleting card', err);
      setError('No se pudo eliminar la tarjeta.');
    }
  };

  if (!workspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center text-surface-400">
        Selecciona un espacio de trabajo para ver el tablero.
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Tablero</h2>
          <p className="text-xs text-surface-500">
            {workspaceName ? `Espacio: ${workspaceName}` : 'Espacio sin nombre'}
          </p>
        </div>
        <button
          onClick={loadBoard}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-surface-800 border border-surface-600 text-surface-300 hover:text-white hover:border-mandy-500/50 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-mandy-500/10 border border-mandy-500/30 text-mandy-300 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-surface-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 h-full min-h-0 items-start">
            {columnsOrdered.map(column => (
              <div
                key={column.id}
                className="w-72 shrink-0 bg-surface-800 border border-surface-600/50 rounded-xl p-3 flex flex-col max-h-full"
              >
                <div className="flex items-start justify-between gap-2">
                  <input
                    value={columnDrafts[column.id] ?? column.name}
                    onChange={(e) => setColumnDrafts(prev => ({ ...prev, [column.id]: e.target.value }))}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const trimmed = value.trim();
                      if (trimmed && trimmed !== column.name) {
                        handleRenameColumn(column.id, trimmed);
                        setColumnDrafts(prev => ({ ...prev, [column.id]: trimmed }));
                      } else {
                        setColumnDrafts(prev => ({ ...prev, [column.id]: column.name }));
                      }
                    }}
                    className="text-sm font-semibold text-surface-200 bg-transparent focus:outline-none focus:ring-1 focus:ring-mandy-500/40 rounded px-1"
                  />
                  <button
                    onClick={() => handleDeleteColumn(column.id)}
                    className="p-1 text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10 rounded"
                    title="Eliminar columna"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[11px] text-surface-500">
                  {(cardsByColumn[column.id] || []).length} tarjetas
                </span>

                <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                  {(cardsByColumn[column.id] || []).map(card => (
                    <div key={card.id} className="bg-surface-700/70 border border-surface-600/40 rounded-lg p-2">
                      <div className="text-xs font-semibold text-surface-100 break-words">{card.title}</div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <select
                          value={card.columnId}
                          onChange={(e) => handleMoveCard(card.id, e.target.value)}
                          className="text-[11px] bg-surface-800 border border-surface-600 rounded px-2 py-1 text-surface-300"
                        >
                          {columnsOrdered.map(col => (
                            <option key={col.id} value={col.id}>{col.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDeleteCard(card.id)}
                          className="text-surface-500 hover:text-mandy-400"
                          title="Eliminar tarjeta"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={(e) => handleAddCard(column.id, e)} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newCardTitles[column.id] || ''}
                    onChange={(e) => setNewCardTitles(prev => ({ ...prev, [column.id]: e.target.value }))}
                    placeholder="Nueva tarjeta"
                    className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-2 py-1 text-xs text-white placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-mandy-500/40"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-gradient-mandy text-white rounded-lg hover:opacity-90"
                    title="Agregar tarjeta"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </form>
              </div>
            ))}

            <div className="w-72 shrink-0 border border-dashed border-surface-600/60 rounded-xl p-3 bg-surface-900/40">
              <form onSubmit={handleAddColumn} className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Nueva columna</span>
                <input
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="Ej: Revisar"
                  className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-mandy-500/40"
                />
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gradient-mandy text-white text-sm rounded-lg hover:opacity-90"
                >
                  <Plus className="w-4 h-4" />
                  Agregar columna
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;
