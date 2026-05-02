/**
 * Contratos de los endpoints `/api/sync/worker-*`.
 *
 * Parsers estrictos: el endpoint nunca debe usar `as T` sobre el body.
 * Si el daemon manda algo malformado, queremos un 400 con campo concreto,
 * no 4 capas adentro como `undefined`.
 */
import { err, fieldErr, isNumber, isObject, isString, ok, type ParseResult } from './result';

export interface WorkerCommitPayload {
  repoPath: string;
  contentHash: string;
  size: number | null;
  mimeType: string | null;
}

const sanitizeRepoPath = (input: string): string | null => {
  const cleaned = input.replace(/^\/+/, '').trim();
  if (!cleaned) return null;
  if (cleaned.split('/').some((seg) => seg === '..' || seg === '')) return null;
  return cleaned;
};

export const parseWorkerCommitPayload = (input: unknown): ParseResult<WorkerCommitPayload> => {
  if (!isObject(input)) return err('body must be a JSON object');
  const { repoPath, contentHash, size, mimeType } = input;
  if (!isString(repoPath)) return fieldErr('repoPath', 'string', repoPath);
  const sanitized = sanitizeRepoPath(repoPath);
  if (!sanitized) return err('field "repoPath" contains traversal or empty segments');
  if (!isString(contentHash) || !contentHash) return fieldErr('contentHash', 'non-empty string', contentHash);
  let normalizedSize: number | null = null;
  if (size !== undefined && size !== null) {
    if (!isNumber(size) || size < 0) return fieldErr('size', 'non-negative number', size);
    normalizedSize = size;
  }
  let normalizedMime: string | null = null;
  if (mimeType !== undefined && mimeType !== null) {
    if (!isString(mimeType)) return fieldErr('mimeType', 'string', mimeType);
    normalizedMime = mimeType;
  }
  return ok({ repoPath: sanitized, contentHash, size: normalizedSize, mimeType: normalizedMime });
};

export interface WorkerDeletePayload {
  repoPath: string;
}

export const parseWorkerDeletePayload = (input: unknown): ParseResult<WorkerDeletePayload> => {
  if (!isObject(input)) return err('body must be a JSON object');
  const { repoPath } = input;
  if (!isString(repoPath)) return fieldErr('repoPath', 'string', repoPath);
  const sanitized = sanitizeRepoPath(repoPath);
  if (!sanitized) return err('field "repoPath" contains traversal or empty segments');
  return ok({ repoPath: sanitized });
};

export interface WorkerUploadUrlPayload {
  repoPath: string;
  size: number;
  mimeType: string | null;
}

export const parseWorkerUploadUrlPayload = (input: unknown): ParseResult<WorkerUploadUrlPayload> => {
  if (!isObject(input)) return err('body must be a JSON object');
  const { repoPath, size, mimeType } = input;
  if (!isString(repoPath)) return fieldErr('repoPath', 'string', repoPath);
  const sanitized = sanitizeRepoPath(repoPath);
  if (!sanitized) return err('field "repoPath" contains traversal or empty segments');
  if (!isNumber(size) || size <= 0) return fieldErr('size', 'positive number', size);
  let normalizedMime: string | null = null;
  if (mimeType !== undefined && mimeType !== null) {
    if (!isString(mimeType)) return fieldErr('mimeType', 'string', mimeType);
    normalizedMime = mimeType;
  }
  return ok({ repoPath: sanitized, size, mimeType: normalizedMime });
};
