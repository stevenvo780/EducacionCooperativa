import type { DocItem, FolderItem } from '@/types/document-item';
import { normalizeFolderPath } from '@/lib/folder-utils';

const nameCollator = typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
  ? new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })
  : null;

const compareNames = (a: string, b: string): number => {
  if (nameCollator) return nameCollator.compare(a, b);
  return a < b ? -1 : a > b ? 1 : 0;
};

const getUpdatedAtMs = (value: DocItem['updatedAt']): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value && typeof value === 'object' && 'toMillis' in value) {
    try {
      return (value as { toMillis: () => number }).toMillis();
    } catch {
      return 0;
    }
  }
  return 0;
};

const FOLDER_KIND_WEIGHT: Record<FolderItem['kind'], number> = {
  system: 0,
  record: 1,
  virtual: 2
};

const compareFolders = (a: FolderItem, b: FolderItem): number => {
  const orderA = typeof a.order === 'number' ? a.order : null;
  const orderB = typeof b.order === 'number' ? b.order : null;
  if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
  if (orderA !== null && orderB === null) return -1;
  if (orderA === null && orderB !== null) return 1;
  const weightDiff = FOLDER_KIND_WEIGHT[a.kind] - FOLDER_KIND_WEIGHT[b.kind];
  if (weightDiff !== 0) return weightDiff;
  return compareNames(a.name, b.name);
};

const compareDocs = (a: DocItem, b: DocItem): number => {
  const orderA = typeof a.order === 'number' ? a.order : null;
  const orderB = typeof b.order === 'number' ? b.order : null;
  if (orderA !== null && orderB !== null && orderA !== orderB) return orderA - orderB;
  if (orderA !== null && orderB === null) return -1;
  if (orderA === null && orderB !== null) return 1;
  const dateA = getUpdatedAtMs(a.updatedAt);
  const dateB = getUpdatedAtMs(b.updatedAt);
  if (dateA !== dateB) return dateB - dateA;
  return compareNames(a.name || '', b.name || '');
};

export const buildEffectiveFolders = (folders: FolderItem[], docs: DocItem[]): FolderItem[] => {
  const byPath = new Map<string, FolderItem>();
  const derived: FolderItem[] = [];

  for (let i = 0; i < folders.length; i += 1) {
    const folder = folders[i]!;
    byPath.set(folder.path, folder);
  }

  const normalizeCache = new Map<string, string>();
  const normalize = (raw: string | undefined): string => {
    if (!raw) return '';
    const cached = normalizeCache.get(raw);
    if (cached !== undefined) return cached;
    const computed = normalizeFolderPath(raw);
    normalizeCache.set(raw, computed);
    return computed;
  };

  for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i]!;
    const normalized = normalize(doc.folder);
    if (!normalized) continue;
    if (byPath.has(normalized)) continue;

    const parts = normalized.split('/');
    let acc = '';
    for (let j = 0; j < parts.length; j += 1) {
      const part = parts[j] ?? '';
      acc = j === 0 ? part : `${acc}/${part}`;
      if (byPath.has(acc)) continue;

      const parentPath = j === 0 ? '' : acc.slice(0, acc.lastIndexOf('/'));
      const virtualFolder: FolderItem = {
        id: `virtual-${acc}`,
        name: part,
        path: acc,
        parentPath,
        kind: 'virtual'
      };
      byPath.set(acc, virtualFolder);
      derived.push(virtualFolder);
    }
  }

  if (derived.length === 0) return folders;
  return [...folders, ...derived];
};

export const buildFolderChildrenMap = (
  effectiveFolders: FolderItem[]
): Record<string, FolderItem[]> => {
  const map: Record<string, FolderItem[]> = { '': [] };
  for (let i = 0; i < effectiveFolders.length; i += 1) {
    const folder = effectiveFolders[i]!;
    const parent = folder.parentPath || '';
    const bucket = map[parent];
    if (bucket) bucket.push(folder);
    else map[parent] = [folder];
  }
  for (const key in map) {
    const list = map[key];
    if (list && list.length > 1) list.sort(compareFolders);
  }
  return map;
};

export const buildDocsByFolder = (
  docs: DocItem[],
  options: { sorted?: boolean } = {}
): Record<string, DocItem[]> => {
  const result: Record<string, DocItem[]> = {};
  const normalizeCache = new Map<string, string>();
  for (let i = 0; i < docs.length; i += 1) {
    const doc = docs[i]!;
    if (doc.type === 'folder') continue;
    const raw = doc.folder ?? '';
    let folder = normalizeCache.get(raw);
    if (folder === undefined) {
      folder = normalizeFolderPath(raw);
      normalizeCache.set(raw, folder);
    }
    const bucket = result[folder];
    if (bucket) {
      bucket.push(doc);
    } else {
      result[folder] = [doc];
    }
  }
  if (options.sorted !== false) {
    for (const key in result) {
      const list = result[key];
      if (list && list.length > 1) list.sort(compareDocs);
    }
  }
  return result;
};

export interface WorkspaceTreeModel {
  effectiveFolders: FolderItem[];
  folderChildrenMap: Record<string, FolderItem[]>;
  docsByFolder: Record<string, DocItem[]>;
}

export const buildWorkspaceTreeModel = (
  folders: FolderItem[],
  docs: DocItem[]
): WorkspaceTreeModel => {
  const effectiveFolders = buildEffectiveFolders(folders, docs);
  return {
    effectiveFolders,
    folderChildrenMap: buildFolderChildrenMap(effectiveFolders),
    docsByFolder: buildDocsByFolder(docs)
  };
};
