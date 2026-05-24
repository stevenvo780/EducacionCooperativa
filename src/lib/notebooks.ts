import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  query
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notebook } from '@/types/stnb';

export interface NotebookListItem {
  id: string;
  title: string;
  profile: string;
  createdAt: number;
  updatedAt: number;
}

const notebooksCol = (uid: string) =>
  collection(doc(collection(db(), 'users'), uid), 'notebooks');

export async function listNotebooks(uid: string): Promise<NotebookListItem[]> {
  const q = query(notebooksCol(uid), orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      title: typeof data['title'] === 'string' ? data['title'] : 'Sin título',
      profile: typeof data['profile'] === 'string' ? data['profile'] : 'classical',
      createdAt: typeof data['createdAt'] === 'number' ? data['createdAt'] : 0,
      updatedAt: typeof data['updatedAt'] === 'number' ? data['updatedAt'] : 0
    };
  });
}

export async function loadNotebook(uid: string, id: string): Promise<Notebook> {
  const ref = doc(notebooksCol(uid), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Notebook ${id} no encontrado`);
  const data = snap.data();
  return data['notebook'] as Notebook;
}

export async function saveNotebook(uid: string, id: string, nb: Notebook): Promise<void> {
  const ref = doc(notebooksCol(uid), id);
  const now = Date.now();
  await setDoc(ref, {
    notebook: nb,
    title: nb.metadata.title,
    profile: nb.metadata.profile,
    updatedAt: now
  }, { merge: true });
}

export async function createNotebook(uid: string, nb: Notebook): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(notebooksCol(uid), {
    notebook: nb,
    title: nb.metadata.title,
    profile: nb.metadata.profile,
    createdAt: now,
    updatedAt: now,
    _serverTs: serverTimestamp()
  });
  return ref.id;
}

export async function deleteNotebook(uid: string, id: string): Promise<void> {
  const ref = doc(notebooksCol(uid), id);
  await deleteDoc(ref);
}
