import type { DocItem, FolderItem, Workspace } from '@/components/dashboard/types';

export const getUpdatedAtValue = (value: DocItem['updatedAt']) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object') {
    const candidate = value as { seconds?: number; toDate?: () => Date };
    if (typeof candidate.seconds === 'number') return candidate.seconds * 1000;
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      if (date instanceof Date) return date.getTime();
    }
  }
  return 0;
};

export const areDocsEquivalent = (prev: DocItem[], next: DocItem[]) => {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (a.id !== b.id) return false;
    if (a.name !== b.name) return false;
    if (a.type !== b.type) return false;
    if ((a.folder || '') !== (b.folder || '')) return false;
    if ((a.mimeType || '') !== (b.mimeType || '')) return false;
    if ((a.url || '') !== (b.url || '')) return false;
    if ((a.storagePath || '') !== (b.storagePath || '')) return false;
    if ((a.workspaceId || '') !== (b.workspaceId || '')) return false;
    if ((a.ownerId || '') !== (b.ownerId || '')) return false;
    if ((a.size || 0) !== (b.size || 0)) return false;
    if (getUpdatedAtValue(a.updatedAt) !== getUpdatedAtValue(b.updatedAt)) return false;
  }
  return true;
};

export const areFoldersEquivalent = (prev: FolderItem[], next: FolderItem[]) => {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (a.id !== b.id) return false;
    if (a.name !== b.name) return false;
    if (a.path !== b.path) return false;
    if (a.parentPath !== b.parentPath) return false;
    if (a.kind !== b.kind) return false;
    if ((a.docId || '') !== (b.docId || '')) return false;
  }
  return true;
};

export const normalizeWorkspace = (data: Partial<Workspace> & { id: string }): Workspace => ({
  id: data.id,
  name: typeof data.name === 'string' && data.name.trim() ? data.name : 'Sin nombre',
  ownerId: data.ownerId ?? '',
  members: Array.isArray(data.members) ? data.members : [],
  pendingInvites: Array.isArray(data.pendingInvites) ? data.pendingInvites : [],
  type: data.type === 'personal' ? 'personal' : 'shared'
});
