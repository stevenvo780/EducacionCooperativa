/**
 * Parser de un doc Firestore en `documents/`. Existen docs viejos (legacy)
 * con shape distinto — los normalizamos aquí para que el resto del código
 * no tenga que recordar las ramas históricas.
 *
 * Bugs cubiertos:
 *  - 7b67d23 "listing /api/documents normaliza dotfiles legacy"
 *  - 0ac1770 "dotfiles con type=file legacy emitían signed URL caducado"
 */
import { err, isNumber, isObject, isString, ok, type ParseResult } from './result';
import { isDocumentType, type DocumentTypeId } from '@/types/documents';

export interface DocumentRecord {
  id: string;
  name: string;
  folder: string;
  type: DocumentTypeId;
  workspaceId: string | null;
  ownerId: string | null;
  storagePath: string | null;
  storageBackend: 'minio' | 'firebase' | null;
  contentHash: string | null;
  size: number | null;
  version: number;
  baseVersion: number;
  syncState: 'synced' | 'pending' | 'conflict' | null;
  mimeType: string | null;
  updatedAtMs: number | null;
}

const isDotfile = (name: string): boolean => name.startsWith('.') && name.indexOf('.', 1) === -1;

const coerceType = (rawType: unknown, name: string): DocumentTypeId => {
  if (typeof rawType === 'string' && isDocumentType(rawType)) {
    if (rawType === 'file' && isDotfile(name)) return 'text';
    return rawType;
  }
  return isDotfile(name) ? 'text' : 'file';
};

const coerceStorageBackend = (raw: unknown): DocumentRecord['storageBackend'] => {
  if (raw === 'minio' || raw === 'firebase') return raw;
  return null;
};

const coerceSyncState = (raw: unknown): DocumentRecord['syncState'] => {
  if (raw === 'synced' || raw === 'pending' || raw === 'conflict') return raw;
  return null;
};

const coerceUpdatedAtMs = (raw: unknown): number | null => {
  if (isObject(raw) && typeof (raw as { toMillis?: () => number }).toMillis === 'function') {
    try { return (raw as { toMillis: () => number }).toMillis(); } catch { return null; }
  }
  if (isNumber(raw)) return raw;
  return null;
};

export const parseDocumentRecord = (id: string, raw: unknown): ParseResult<DocumentRecord> => {
  if (!isObject(raw)) return err('document data is not an object');
  const name = isString(raw.name) ? raw.name : '';
  if (!name) return err('document missing field "name"');
  const folder = isString(raw.folder) ? raw.folder : 'No estructurado';
  return ok({
    id,
    name,
    folder,
    type: coerceType(raw.type, name),
    workspaceId: isString(raw.workspaceId) ? raw.workspaceId : null,
    ownerId: isString(raw.ownerId) ? raw.ownerId : null,
    storagePath: isString(raw.storagePath) && raw.storagePath ? raw.storagePath : null,
    storageBackend: coerceStorageBackend(raw.storageBackend),
    contentHash: isString(raw.contentHash) ? raw.contentHash : null,
    size: isNumber(raw.size) ? raw.size : null,
    version: isNumber(raw.version) ? raw.version : 0,
    baseVersion: isNumber(raw.baseVersion) ? raw.baseVersion : 0,
    syncState: coerceSyncState(raw.syncState),
    mimeType: isString(raw.mimeType) ? raw.mimeType : null,
    updatedAtMs: coerceUpdatedAtMs(raw.updatedAt)
  });
};
