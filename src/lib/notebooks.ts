import { parseNotebook } from '@stevenvo780/st-lang/format/stnb';
import { auth } from '@/lib/firebase';
import { authFetch } from '@/services/apiClient';
import type { Notebook } from '@/types/stnb';

export interface NotebookListItem {
  id: string;
  title: string;
  profile: string;
  createdAt: number;
  updatedAt: number;
}

const assertUser = (uid: string) => { if (auth().currentUser?.uid !== uid) throw new Error('User not authenticated'); };
const check = async (response: Response) => { if (!response.ok) throw new Error('Notebook request failed'); return response.json(); };

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}

export async function listNotebooks(uid: string): Promise<NotebookListItem[]> {
  assertUser(uid);
  const payload = await check(await authFetch('/api/notebooks', { cache: 'no-store' }));
  return payload.notebooks as NotebookListItem[];
}

export async function loadNotebook(uid: string, id: string): Promise<Notebook> {
  assertUser(uid);
  const payload = await check(await authFetch(`/api/notebooks?id=${encodeURIComponent(id)}`, { cache: 'no-store' }));
  const raw = payload.notebook;
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Notebook ${id}: campo notebook ausente o inválido`);
  }
  return parseNotebook(JSON.stringify(raw));
}

export async function saveNotebook(uid: string, id: string, nb: Notebook): Promise<void> {
  assertUser(uid);
  await check(await authFetch('/api/notebooks', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stripUndefinedDeep({ id, notebook: nb })) }));
}

export async function createNotebook(uid: string, nb: Notebook): Promise<string> {
  assertUser(uid);
  const payload = await check(await authFetch('/api/notebooks', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stripUndefinedDeep({ notebook: nb })) }));
  return String(payload.id);
}

export async function deleteNotebook(uid: string, id: string): Promise<void> {
  assertUser(uid);
  await check(await authFetch(`/api/notebooks?id=${encodeURIComponent(id)}`, { method: 'DELETE' }));
}
