'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  useDroppable,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
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

type DragData =
  | { type: 'column'; columnId: string }
  | { type: 'card'; cardId: string; columnId: string }
  | { type: 'column-drop'; columnId: string };

const normalizeColumns = (columns: BoardColumn[]) =>
  columns.map((col, index) => ({ ...col, order: (index + 1) * 1000 }));

const groupCardsByColumn = (cards: BoardCard[], columns: BoardColumn[]) => {
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
};

const normalizeCards = (cards: BoardCard[], columns: BoardColumn[]) => {
  const grouped = groupCardsByColumn(cards, columns);
  const updated = new Map<string, BoardCard>();

  columns.forEach(column => {
    const list = grouped[column.id] ?? [];
    list.forEach((card, index) => {
      updated.set(card.id, { ...card, order: (index + 1) * 1000, columnId: column.id });
    });
  });

  cards.forEach(card => {
    if (!updated.has(card.id)) {
      updated.set(card.id, card);
    }
  });

  return Array.from(updated.values());
};

const diffCardChanges = (before: BoardCard[], after: BoardCard[]) => {
  const beforeMap = new Map(before.map(card => [card.id, card]));
  return after.filter(card => {
    const prev = beforeMap.get(card.id);
    return !!prev && (prev.columnId !== card.columnId || prev.order !== card.order);
  });
};

const resolveOverData = (over: DragOverEvent['over'], cards: BoardCard[]): DragData | null => {
  if (!over) return null;
  const raw = over.data.current as DragData | undefined;
  if (raw?.type) return raw;
  const overId = String(over.id);
  if (overId.startsWith('card-')) {
    const cardId = overId.replace('card-', '');
    const card = cards.find(item => item.id === cardId);
    return card ? { type: 'card', cardId: card.id, columnId: card.columnId } : null;
  }
  if (overId.startsWith('column-drop-')) {
    return { type: 'column-drop', columnId: overId.replace('column-drop-', '') };
  }
  if (overId.startsWith('column-')) {
    return { type: 'column', columnId: overId.replace('column-', '') };
  }
  return null;
};

const moveCardInState = (
  cards: BoardCard[],
  columns: BoardColumn[],
  activeCardId: string,
  overData: DragData | null
) => {
  if (!overData) return cards;
  const activeCard = cards.find(card => card.id === activeCardId);
  if (!activeCard) return cards;

  const grouped = groupCardsByColumn(cards, columns);
  const sourceList = [...(grouped[activeCard.columnId] ?? [])];
  const sourceIndex = sourceList.findIndex(card => card.id === activeCardId);
  if (sourceIndex === -1) return cards;

  let destColumnId = activeCard.columnId;
  let destList = sourceList;
  let destIndex = sourceIndex;

  if (overData.type === 'card') {
    destColumnId = overData.columnId;
    destList = [...(grouped[destColumnId] ?? [])];
    destIndex = destList.findIndex(card => card.id === overData.cardId);
    if (destIndex < 0) destIndex = destList.length;
  } else if (overData.type === 'column-drop' || overData.type === 'column') {
    destColumnId = overData.columnId;
    destList = [...(grouped[destColumnId] ?? [])];
    destIndex = destList.length;
  }

  if (destColumnId === activeCard.columnId && destIndex === sourceIndex) return cards;

  sourceList.splice(sourceIndex, 1);
  const movedCard = destColumnId === activeCard.columnId
    ? activeCard
    : { ...activeCard, columnId: destColumnId };

  if (destColumnId === activeCard.columnId) {
    destList = sourceList;
  }
  destList.splice(destIndex, 0, movedCard);

  const updated = new Map<string, BoardCard>();
  cards.forEach(card => updated.set(card.id, card));

  sourceList.forEach((card, index) => {
    updated.set(card.id, { ...card, order: (index + 1) * 1000 });
  });

  if (destColumnId !== activeCard.columnId) {
    destList.forEach((card, index) => {
      updated.set(card.id, { ...card, order: (index + 1) * 1000, columnId: destColumnId });
    });
  }

  return Array.from(updated.values());
};

const SortableCard = ({
  card,
  columns,
  onMoveCard,
  onDeleteCard
}: {
  card: BoardCard;
  columns: BoardColumn[];
  onMoveCard: (cardId: string, columnId: string) => void;
  onDeleteCard: (cardId: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', cardId: card.id, columnId: card.columnId }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-surface-700/70 border border-surface-600/40 rounded-lg p-2"
    >
      <div className="flex items-start gap-2">
        <button
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="mt-0.5 text-surface-500 hover:text-surface-300"
          title="Arrastrar tarjeta"
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <div className="text-xs font-semibold text-surface-100 break-words flex-1">{card.title}</div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <select
          value={card.columnId}
          onChange={(e) => onMoveCard(card.id, e.target.value)}
          className="text-[11px] bg-surface-800 border border-surface-600 rounded px-2 py-1 text-surface-300"
        >
          {columns.map(col => (
            <option key={col.id} value={col.id}>{col.name}</option>
          ))}
        </select>
        <button
          onClick={() => onDeleteCard(card.id)}
          className="text-surface-500 hover:text-mandy-400"
          title="Eliminar tarjeta"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

const SortableColumn = ({
  column,
  cards,
  columns,
  draftValue,
  onDraftChange,
  onRenameColumn,
  onDeleteColumn,
  onAddCard,
  newCardTitle,
  onNewCardTitleChange,
  onMoveCard,
  onDeleteCard
}: {
  column: BoardColumn;
  cards: BoardCard[];
  columns: BoardColumn[];
  draftValue: string;
  onDraftChange: (value: string) => void;
  onRenameColumn: (value: string) => void;
  onDeleteColumn: () => void;
  onAddCard: (event: FormEvent) => void;
  newCardTitle: string;
  onNewCardTitleChange: (value: string) => void;
  onMoveCard: (cardId: string, columnId: string) => void;
  onDeleteCard: (cardId: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: `column-${column.id}`,
    data: { type: 'column', columnId: column.id }
  });

  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `column-drop-${column.id}`,
    data: { type: 'column-drop', columnId: column.id }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-72 shrink-0 bg-surface-800 border border-surface-600/50 rounded-xl p-3 flex flex-col max-h-full"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            className="mt-1 text-surface-500 hover:text-surface-300"
            title="Arrastrar columna"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <input
            value={draftValue}
            onChange={(e) => onDraftChange(e.target.value)}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value && value !== column.name) {
                onRenameColumn(value);
              } else {
                onDraftChange(column.name);
              }
            }}
            className="text-sm font-semibold text-surface-200 bg-transparent focus:outline-none focus:ring-1 focus:ring-mandy-500/40 rounded px-1 flex-1"
          />
        </div>
        <button
          onClick={onDeleteColumn}
          className="p-1 text-surface-500 hover:text-mandy-400 hover:bg-mandy-500/10 rounded"
          title="Eliminar columna"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <span className="text-[11px] text-surface-500">
        {cards.length} tarjetas
      </span>

      <div
        ref={setDropNodeRef}
        className={`mt-3 flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 transition ${
          isOver ? 'ring-1 ring-mandy-500/40 rounded-lg' : ''
        }`}
      >
        <SortableContext
          items={cards.map(card => `card-${card.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map(card => (
            <SortableCard
              key={card.id}
              card={card}
              columns={columns}
              onMoveCard={onMoveCard}
              onDeleteCard={onDeleteCard}
            />
          ))}
        </SortableContext>
      </div>

      <form onSubmit={onAddCard} className="mt-3 flex gap-2">
        <input
          type="text"
          value={newCardTitle}
          onChange={(e) => onNewCardTitleChange(e.target.value)}
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
  );
};

const KanbanBoard = ({ workspaceId, workspaceName, ownerId }: KanbanBoardProps) => {
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [cards, setCards] = useState<BoardCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [newCardTitles, setNewCardTitles] = useState<Record<string, string>>({});
  const [columnDrafts, setColumnDrafts] = useState<Record<string, string>>({});
  const [activeDrag, setActiveDrag] = useState<{ type: 'card' | 'column'; id: string } | null>(null);
  const dragSnapshotRef = useRef<{ type: 'card' | 'column'; cards: BoardCard[]; columns: BoardColumn[] } | null>(null);

  const columnsOrdered = useMemo(() => {
    return [...columns].sort((a, b) => a.order - b.order);
  }, [columns]);

  const cardsByColumn = useMemo(() => {
    return groupCardsByColumn(cards, columnsOrdered);
  }, [cards, columnsOrdered]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  const handleDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as DragData | undefined;
    if (!data) return;
    if (data.type === 'card') {
      dragSnapshotRef.current = { type: 'card', cards: cards.map(card => ({ ...card })), columns: [] };
      setActiveDrag({ type: 'card', id: data.cardId });
    }
    if (data.type === 'column') {
      dragSnapshotRef.current = { type: 'column', columns: columns.map(col => ({ ...col })), cards: [] };
      setActiveDrag({ type: 'column', id: data.columnId });
    }
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    const activeData = active.data.current as DragData | undefined;
    if (!activeData || activeData.type !== 'card') return;
    if (!over) return;

    const overData = resolveOverData(over, cards);
    setCards(prev => moveCardInState(prev, columnsOrdered, activeData.cardId, overData));
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const activeData = active.data.current as DragData | undefined;
    const snapshot = dragSnapshotRef.current;
    setActiveDrag(null);
    dragSnapshotRef.current = null;

    if (!activeData || !over) {
      if (snapshot?.type === 'card') setCards(snapshot.cards);
      if (snapshot?.type === 'column') setColumns(snapshot.columns);
      return;
    }

    const overData = resolveOverData(over, cards);

    if (activeData.type === 'column' && (overData?.type === 'column' || overData?.type === 'column-drop')) {
      const targetColumnId = overData.columnId;
      const ordered = [...columns].sort((a, b) => a.order - b.order);
      const oldIndex = ordered.findIndex(col => col.id === activeData.columnId);
      const newIndex = ordered.findIndex(col => col.id === targetColumnId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = normalizeColumns(arrayMove(ordered, oldIndex, newIndex));
      setColumns(reordered);

      if (workspaceId && snapshot?.type === 'column') {
        const prevMap = new Map(snapshot.columns.map(col => [col.id, col.order]));
        const updates = reordered.filter(col => prevMap.get(col.id) !== col.order);
        await Promise.all(updates.map(col => updateBoardColumnApi({ workspaceId, columnId: col.id, order: col.order })));
      }
      return;
    }

    if (activeData.type === 'card') {
      const normalized = normalizeCards(cards, columnsOrdered);
      setCards(normalized);
      if (workspaceId && snapshot?.type === 'card') {
        const changes = diffCardChanges(snapshot.cards, normalized);
        await Promise.all(changes.map(card => updateBoardCardApi({
          workspaceId,
          cardId: card.id,
          columnId: card.columnId,
          order: card.order
        })));
      }
    }
  };

  const handleDragCancel = ({ active }: DragCancelEvent) => {
    const snapshot = dragSnapshotRef.current;
    if (snapshot?.type === 'card') setCards(snapshot.cards);
    if (snapshot?.type === 'column') setColumns(snapshot.columns);
    dragSnapshotRef.current = null;
    if (active?.data?.current) setActiveDrag(null);
  };

  if (!workspaceId) {
    return (
      <div className="flex-1 flex items-center justify-center text-surface-400">
        Selecciona un espacio de trabajo para ver el tablero.
      </div>
    );
  }

  const activeCard = activeDrag?.type === 'card'
    ? cards.find(card => card.id === activeDrag.id)
    : null;
  const activeColumn = activeDrag?.type === 'column'
    ? columns.find(col => col.id === activeDrag.id)
    : null;

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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={columnsOrdered.map(col => `column-${col.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-4 h-full min-h-0 items-start">
                {columnsOrdered.map(column => (
                  <SortableColumn
                    key={column.id}
                    column={column}
                    cards={cardsByColumn[column.id] || []}
                    columns={columnsOrdered}
                    draftValue={columnDrafts[column.id] ?? column.name}
                    onDraftChange={(value) => setColumnDrafts(prev => ({ ...prev, [column.id]: value }))}
                    onRenameColumn={(value) => handleRenameColumn(column.id, value)}
                    onDeleteColumn={() => handleDeleteColumn(column.id)}
                    onAddCard={(event) => handleAddCard(column.id, event)}
                    newCardTitle={newCardTitles[column.id] || ''}
                    onNewCardTitleChange={(value) => setNewCardTitles(prev => ({ ...prev, [column.id]: value }))}
                    onMoveCard={handleMoveCard}
                    onDeleteCard={handleDeleteCard}
                  />
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
            </SortableContext>

            <DragOverlay>
              {activeCard && (
                <div className="w-64 bg-surface-700/90 border border-surface-600/60 rounded-lg p-2 shadow-xl">
                  <div className="text-xs font-semibold text-surface-100 break-words">{activeCard.title}</div>
                </div>
              )}
              {activeColumn && (
                <div className="w-72 bg-surface-800 border border-surface-600/60 rounded-xl p-3 shadow-xl">
                  <div className="text-sm font-semibold text-surface-200">{activeColumn.name}</div>
                  <div className="text-[11px] text-surface-500">Arrastrando columna</div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;
