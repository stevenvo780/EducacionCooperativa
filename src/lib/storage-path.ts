import path from 'path';
import { normalizeFolderPath } from '@/lib/folder-utils';

const SAFE_NAME_REGEX = /[\\/]/g;

export const sanitizeFileName = (value: string) => value.replace(SAFE_NAME_REGEX, '_');

export const ensureMarkdownFileName = (value: string) => {
  const safe = sanitizeFileName(value || 'Sin titulo');
  return safe.toLowerCase().endsWith('.md') ? safe : `${safe}.md`;
};

export const buildStoragePrefix = (workspaceId: string, ownerId: string) => {
  return workspaceId === 'personal' ? `users/${ownerId}` : `workspaces/${workspaceId}`;
};

export const buildStoragePath = (params: {
  workspaceId: string;
  ownerId: string;
  folder?: string | null;
  fileName: string;
}) => {
  const prefix = buildStoragePrefix(params.workspaceId, params.ownerId);
  const folder = normalizeFolderPath(params.folder ?? undefined);
  return `${prefix}/${folder}/${params.fileName}`;
};

export const getStorageBaseName = (storagePath: string) => {
  return path.posix.basename(storagePath);
};
