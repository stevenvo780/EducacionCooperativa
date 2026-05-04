import type { DocItem, FolderItem } from '@/types/document-item';
import { DEFAULT_FOLDER_NAME, normalizeFolderPath } from '@/lib/folder-utils';

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
  return a.name.localeCompare(b.name);
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
  return (a.name || '').localeCompare(b.name || '');
};

export const buildEffectiveFolders = (folders: FolderItem[], docs: DocItem[]): FolderItem[] => {
  const byPath = new Map<string, FolderItem>();
  const derived: FolderItem[] = [];

  for (const folder of folders) {
    byPath.set(folder.path, folder);
  }

  const ensureFolder = (rawPath?: string) => {
    const normalized = normalizeFolderPath(rawPath);
    if (byPath.has(normalized)) return;

    const parts = normalized.split('/');
    let acc = '';

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i] ?? '';
      acc = i === 0 ? part : `${acc}/${part}`;
      if (byPath.has(acc)) continue;

      const parentPath = i === 0 ? '' : acc.slice(0, acc.lastIndexOf('/'));
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
  };

  ensureFolder(DEFAULT_FOLDER_NAME);
  for (const doc of docs) ensureFolder(doc.folder);

  return [...folders, ...derived];
};

export const buildFolderChildrenMap = (
  effectiveFolders: FolderItem[]
): Record<string, FolderItem[]> => {
  const map: Record<string, FolderItem[]> = { '': [] };
  for (const folder of effectiveFolders) {
    const parent = folder.parentPath || '';
    if (!map[parent]) map[parent] = [];
    map[parent].push(folder);
  }
  for (const list of Object.values(map)) list.sort(compareFolders);
  return map;
};

export const buildDocsByFolder = (
  docs: DocItem[],
  options: { sorted?: boolean } = {}
): Record<string, DocItem[]> => {
  const result: Record<string, DocItem[]> = {};
  for (const doc of docs) {
    if (doc.type === 'folder') continue;
    const folder = normalizeFolderPath(doc.folder);
    if (!result[folder]) result[folder] = [];
    result[folder].push(doc);
  }
  if (options.sorted !== false) {
    for (const list of Object.values(result)) list.sort(compareDocs);
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
