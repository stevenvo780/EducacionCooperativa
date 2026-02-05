import { db, auth } from '@/lib/firebase';
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
  writeBatch,
  serverTimestamp,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import type { BoardCard, BoardColumn, BoardData } from '@/components/dashboard/types';

const resolveBoardId = (workspaceId: string) => {
  const user = auth().currentUser;
  if (!user && workspaceId === 'personal') throw new Error('User not authenticated');
  return workspaceId === 'personal' ? `personal:${user?.uid}` : workspaceId;
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
  const boardId = resolveBoardId(params.workspaceId);
  
  // Ensure board exists (creates it if offline creation is allowed/compatible or if we are online)
  // Note: offline creation of new boards might be tricky if rules depend on server-side checks not fully replicated, 
  // but for 'personal' boards it's fine.
  await ensureBoardExists(boardId, params.workspaceId);

  const boardRef = doc(db(), 'boards', boardId);
  
  // Fetch columns
  const columnsQuery = query(collection(boardRef, 'columns'), orderBy('order'));
  const columnsSnap = await getDocs(columnsQuery);
  const columns = columnsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  })) as BoardColumn[];

  // Fetch cards
  const cardsQuery = query(collection(boardRef, 'cards'), orderBy('order'));
  const cardsSnap = await getDocs(cardsQuery);
  const cards = cardsSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  })) as BoardCard[];

  return {
    boardId,
    workspaceId: params.workspaceId,
    columns,
    cards
  };
};

export const createBoardColumnApi = async (params: { workspaceId: string; name: string }): Promise<BoardColumn> => {
  const boardId = resolveBoardId(params.workspaceId);
  const boardRef = doc(db(), 'boards', boardId);
  
  // Calculate new order (last + 1000) - simplified for offline optimisitc UI, preferably passed from UI state
  // ideally we should query last one, but for now let's just create it and let UI handle order or passed in params
  // To keep it robust without query:
  const newColData = {
    name: params.name,
    order: Date.now(), // Fallback if regular ordering fails, really should be passed or queried
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const colRef = await addDoc(collection(boardRef, 'columns'), newColData);
  
  return {
    id: colRef.id,
    ...newColData,
    order: newColData.order // Return number, not serverTimestamp placeholder if local
  } as unknown as BoardColumn;
};

export const updateBoardColumnApi = async (params: { workspaceId: string; columnId: string; name?: string; order?: number }) => {
  const boardId = resolveBoardId(params.workspaceId);
  const colRef = doc(db(), 'boards', boardId, 'columns', params.columnId);
  
  await updateDoc(colRef, {
    ...(params.name && { name: params.name }),
    ...(params.order !== undefined && { order: params.order }),
    updatedAt: serverTimestamp()
  });
};

export const deleteBoardColumnApi = async (params: { workspaceId: string; columnId: string }) => {
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
}): Promise<BoardCard> => {
  const boardId = resolveBoardId(params.workspaceId);
  const cardData = {
    columnId: params.columnId,
    title: params.title,
    description: params.description || '',
    ownerId: params.ownerId || auth().currentUser?.uid,
    order: Date.now(), // Simple ordering
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
}) => {
  const boardId = resolveBoardId(params.workspaceId);
  const cardRef = doc(db(), 'boards', boardId, 'cards', params.cardId);

  await updateDoc(cardRef, {
    ...(params.title && { title: params.title }),
    ...(params.description !== undefined && { description: params.description }),
    ...(params.columnId && { columnId: params.columnId }),
    ...(params.order !== undefined && { order: params.order }),
    updatedAt: serverTimestamp()
  });
};

export const deleteBoardCardApi = async (params: { workspaceId: string; cardId: string }) => {
  const boardId = resolveBoardId(params.workspaceId);
  const cardRef = doc(db(), 'boards', boardId, 'cards', params.cardId);
  await deleteDoc(cardRef);
};


