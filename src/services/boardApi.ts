import { db, auth } from '@/lib/firebase';
import { fetchZod } from '@/lib/fetch-zod';
import { boardDataSchema, boardColumnSchema, boardCardSchema } from '@agora/contracts';
import { authFetch } from '@/services/apiClient';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit as fsLimit,
  startAfter,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  type QueryDocumentSnapshot,
  type DocumentData
} from 'firebase/firestore';
import type { BoardCard, BoardColumn, BoardData } from '@/components/dashboard/types';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';

const BOARD_PAGE_SIZE = 100;

const generateOrder = () => Date.now() * 1000 + Math.floor(Math.random() * 1000);

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const useHttpBoardApi = process.env.NEXT_PUBLIC_ALLOW_INSECURE_AUTH === 'true';

const resolveBoardId = (workspaceId: string) => {
  const user = auth().currentUser;
  if (!user && isPersonalWorkspaceId(workspaceId)) throw new Error('User not authenticated');
  return isPersonalWorkspaceId(workspaceId) ? `${PERSONAL_WORKSPACE_ID}:${user?.uid}` : workspaceId;
};

const assertOk = (res: Response, fallbackMessage: string) => {
  if (!res.ok) {
    throw new Error(fallbackMessage);
  }
};

const DEFAULT_COLUMNS = ['Por hacer', 'En progreso', 'Hecho'];

const ensureBoardExists = async (boardId: string, workspaceId: string) => {
  const boardRef = doc(db(), 'boards', boardId);
  const boardSnap = await getDoc(boardRef);

  if (!boardSnap.exists()) {
    const batch = writeBatch(db());
    // Create board
    batch.set(boardRef, {
      workspaceId: boardId, // Use boardId as workspaceId for consistency in DB
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Create default columns
    const columnsRef = collection(boardRef, 'columns');
    DEFAULT_COLUMNS.forEach((name, index) => {
      const colRef = doc(columnsRef);
      batch.set(colRef, {
        name,
        order: (index + 1) * 1000,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  }
};

export const fetchBoardApi = async (params: { workspaceId: string }): Promise<BoardData> => {
  if (useHttpBoardApi) {
    const search = new URLSearchParams({ workspaceId: params.workspaceId });
    const data = await fetchZod(`/api/boards?${search.toString()}`, boardDataSchema, { cache: 'no-store' });
    return data as BoardData;
  }

  const boardId = resolveBoardId(params.workspaceId);
  
  // Ensure board exists (creates it if offline creation is allowed/compatible or if we are online)
  // Note: offline creation of new boards might be tricky if rules depend on server-side checks not fully replicated, 
  // but for personal boards it's fine.
  await ensureBoardExists(boardId, params.workspaceId);

  const boardRef = doc(db(), 'boards', boardId);

  const columns: BoardColumn[] = [];
  let columnCursor: QueryDocumentSnapshot<DocumentData> | undefined;
  while (true) {
    const baseQuery = columnCursor
      ? query(collection(boardRef, 'columns'), orderBy('order'), startAfter(columnCursor), fsLimit(BOARD_PAGE_SIZE))
      : query(collection(boardRef, 'columns'), orderBy('order'), fsLimit(BOARD_PAGE_SIZE));
    const snap = await getDocs(baseQuery);
    if (snap.empty) break;
    for (const d of snap.docs) {
      columns.push({ id: d.id, ...d.data() } as BoardColumn);
    }
    if (snap.docs.length < BOARD_PAGE_SIZE) break;
    columnCursor = snap.docs[snap.docs.length - 1];
  }

  const cards: BoardCard[] = [];
  let cardCursor: QueryDocumentSnapshot<DocumentData> | undefined;
  while (true) {
    const baseQuery = cardCursor
      ? query(collection(boardRef, 'cards'), orderBy('order'), startAfter(cardCursor), fsLimit(BOARD_PAGE_SIZE))
      : query(collection(boardRef, 'cards'), orderBy('order'), fsLimit(BOARD_PAGE_SIZE));
    const snap = await getDocs(baseQuery);
    if (snap.empty) break;
    for (const d of snap.docs) {
      cards.push({ id: d.id, ...d.data() } as BoardCard);
    }
    if (snap.docs.length < BOARD_PAGE_SIZE) break;
    cardCursor = snap.docs[snap.docs.length - 1];
  }

  return {
    boardId,
    workspaceId: params.workspaceId,
    columns,
    cards
  };
};

export interface BoardSnapshotPayload {
  columns: BoardColumn[];
  cards: BoardCard[];
}

export const subscribeBoardApi = (
  workspaceId: string,
  onChange: (payload: BoardSnapshotPayload) => void,
  onError?: (err: Error) => void
): (() => void) => {
  if (useHttpBoardApi) {
    return () => {};
  }

  let boardId: string;
  try {
    boardId = resolveBoardId(workspaceId);
  } catch (err) {
    onError?.(err as Error);
    return () => {};
  }

  const boardRef = doc(db(), 'boards', boardId);
  const columnsQuery = query(collection(boardRef, 'columns'), orderBy('order'));
  const cardsQuery = query(collection(boardRef, 'cards'), orderBy('order'));

  let latestColumns: BoardColumn[] = [];
  let latestCards: BoardCard[] = [];
  let hasColumns = false;
  let hasCards = false;

  const emit = () => {
    if (!hasColumns || !hasCards) return;
    onChange({ columns: latestColumns, cards: latestCards });
  };

  const unsubColumns = onSnapshot(
    columnsQuery,
    (snap) => {
      latestColumns = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardColumn);
      hasColumns = true;
      emit();
    },
    (err) => onError?.(err)
  );

  const unsubCards = onSnapshot(
    cardsQuery,
    (snap) => {
      latestCards = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BoardCard);
      hasCards = true;
      emit();
    },
    (err) => onError?.(err)
  );

  return () => {
    unsubColumns();
    unsubCards();
  };
};

export const createBoardColumnApi = async (params: { workspaceId: string; name: string }): Promise<BoardColumn> => {
  if (useHttpBoardApi) {
    const data = await fetchZod('/api/boards', boardColumnSchema, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        workspaceId: params.workspaceId,
        type: 'column',
        name: params.name
      })
    });
    return data as BoardColumn;
  }

  const boardId = resolveBoardId(params.workspaceId);
  const boardRef = doc(db(), 'boards', boardId);

  const lastColumnSnap = await getDocs(
    query(collection(boardRef, 'columns'), orderBy('order', 'desc'), fsLimit(1))
  );
  const lastColumn = lastColumnSnap.docs[0]?.data() as { order?: number } | undefined;
  const nextOrder = typeof lastColumn?.order === 'number' ? lastColumn.order + 1000 : 1000;

  const newColData = {
    name: params.name,
    order: nextOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const colRef = await addDoc(collection(boardRef, 'columns'), newColData);

  return {
    id: colRef.id,
    ...newColData,
    order: newColData.order
  } as unknown as BoardColumn;
};

export const updateBoardColumnApi = async (params: { workspaceId: string; columnId: string; name?: string; order?: number }) => {
  if (useHttpBoardApi) {
    const res = await authFetch('/api/boards', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        workspaceId: params.workspaceId,
        type: 'column',
        id: params.columnId,
        data: {
          ...(params.name !== undefined ? { name: params.name } : {}),
          ...(params.order !== undefined ? { order: params.order } : {})
        }
      })
    });
    assertOk(res, 'Failed to update board column');
    return;
  }

  const boardId = resolveBoardId(params.workspaceId);
  const colRef = doc(db(), 'boards', boardId, 'columns', params.columnId);
  
  await updateDoc(colRef, {
    ...(params.name && { name: params.name }),
    ...(params.order !== undefined && { order: params.order }),
    updatedAt: serverTimestamp()
  });
};

export const deleteBoardColumnApi = async (params: { workspaceId: string; columnId: string }) => {
  if (useHttpBoardApi) {
    const res = await authFetch('/api/boards', {
      method: 'DELETE',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        workspaceId: params.workspaceId,
        type: 'column',
        id: params.columnId
      })
    });
    assertOk(res, 'Failed to delete board column');
    return;
  }

  const boardId = resolveBoardId(params.workspaceId);
  const colRef = doc(db(), 'boards', boardId, 'columns', params.columnId);
  await deleteDoc(colRef);
};

export const createBoardCardApi = async (params: {
  workspaceId: string;
  columnId: string;
  title: string;
  description?: string;
  ownerId?: string | null;
  sourceDocId?: string;
  sourceDocName?: string;
  sourceFragment?: string;
  sourcePath?: string;
}): Promise<BoardCard> => {
  if (useHttpBoardApi) {
    const data = await fetchZod('/api/boards', boardCardSchema, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        workspaceId: params.workspaceId,
        type: 'card',
        columnId: params.columnId,
        title: params.title,
        description: params.description,
        ownerId: params.ownerId,
        sourceDocId: params.sourceDocId,
        sourceDocName: params.sourceDocName,
        sourceFragment: params.sourceFragment,
        sourcePath: params.sourcePath
      })
    });
    return data as BoardCard;
  }

  const boardId = resolveBoardId(params.workspaceId);
  const cardData = {
    columnId: params.columnId,
    title: params.title,
    description: params.description || '',
    ownerId: params.ownerId || auth().currentUser?.uid,
    order: generateOrder(),
    sourceDocId: params.sourceDocId || null,
    sourceDocName: params.sourceDocName || null,
    sourceFragment: params.sourceFragment || null,
    sourcePath: params.sourcePath || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const cardRef = await addDoc(collection(db(), 'boards', boardId, 'cards'), cardData);
  
  return {
    id: cardRef.id,
    ...cardData
  } as unknown as BoardCard;
};

export const updateBoardCardApi = async (params: {
  workspaceId: string;
  cardId: string;
  title?: string;
  description?: string;
  columnId?: string;
  order?: number;
  sourceDocId?: string;
  sourceDocName?: string;
  sourceFragment?: string;
  sourcePath?: string;
}) => {
  if (useHttpBoardApi) {
    const res = await authFetch('/api/boards', {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        workspaceId: params.workspaceId,
        type: 'card',
        id: params.cardId,
        data: {
          ...(params.title !== undefined ? { title: params.title } : {}),
          ...(params.description !== undefined ? { description: params.description } : {}),
          ...(params.columnId !== undefined ? { columnId: params.columnId } : {}),
          ...(params.order !== undefined ? { order: params.order } : {}),
          ...(params.sourceDocId !== undefined ? { sourceDocId: params.sourceDocId } : {}),
          ...(params.sourceDocName !== undefined ? { sourceDocName: params.sourceDocName } : {}),
          ...(params.sourceFragment !== undefined ? { sourceFragment: params.sourceFragment } : {}),
          ...(params.sourcePath !== undefined ? { sourcePath: params.sourcePath } : {})
        }
      })
    });
    assertOk(res, 'Failed to update board card');
    return;
  }

  const boardId = resolveBoardId(params.workspaceId);
  const cardRef = doc(db(), 'boards', boardId, 'cards', params.cardId);

  await updateDoc(cardRef, {
    ...(params.title && { title: params.title }),
    ...(params.description !== undefined && { description: params.description }),
    ...(params.columnId && { columnId: params.columnId }),
    ...(params.order !== undefined && { order: params.order }),
    ...(params.sourceDocId !== undefined && { sourceDocId: params.sourceDocId }),
    ...(params.sourceDocName !== undefined && { sourceDocName: params.sourceDocName }),
    ...(params.sourceFragment !== undefined && { sourceFragment: params.sourceFragment }),
    ...(params.sourcePath !== undefined && { sourcePath: params.sourcePath }),
    updatedAt: serverTimestamp()
  });
};

export const deleteBoardCardApi = async (params: { workspaceId: string; cardId: string }) => {
  if (useHttpBoardApi) {
    const res = await authFetch('/api/boards', {
      method: 'DELETE',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        workspaceId: params.workspaceId,
        type: 'card',
        id: params.cardId
      })
    });
    assertOk(res, 'Failed to delete board card');
    return;
  }

  const boardId = resolveBoardId(params.workspaceId);
  const cardRef = doc(db(), 'boards', boardId, 'cards', params.cardId);
  await deleteDoc(cardRef);
};
