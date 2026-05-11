import { authFetch } from '@/services/apiClient';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const MULTIPART_THRESHOLD_BYTES = 50 * 1024 * 1024;
export const MULTIPART_PART_BYTES = 8 * 1024 * 1024;
export const MULTIPART_MAX_PARALLEL = 4;

export interface MultipartInitiateRequest {
  fileName: string;
  mimeType: string;
  workspaceId: string;
  folder: string;
  fileSize: number;
}

export interface MultipartInitiateResponse {
  uploadId: string;
  storagePath: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  workspaceId: string;
  folder: string;
  partSize: number;
}

export interface MultipartSignPartRequest {
  uploadId: string;
  storagePath: string;
  partNumber: number;
}

export interface MultipartSignPartResponse {
  signedUrl: string;
  partNumber: number;
}

export interface MultipartCompleteRequest {
  uploadId: string;
  storagePath: string;
  parts: Array<{ partNumber: number; etag: string }>;
  fileName: string;
  originalName: string;
  mimeType: string;
  workspaceId: string;
  folder: string;
}

export interface MultipartCompleteResponse {
  id: string;
  storagePath: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  workspaceId: string;
  folder: string;
  size?: number;
}

export class MultipartUnsupportedError extends Error {
  constructor() {
    super('Multipart upload endpoints not available on backend');
    this.name = 'MultipartUnsupportedError';
  }
}

function parseInitiateResponse(raw: unknown): MultipartInitiateResponse {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('parseInitiateResponse: respuesta no es un objeto');
  }
  const r = raw as Record<string, unknown>;
  const requireStr = (k: string): string => {
    const v = r[k];
    if (typeof v !== 'string' || !v) throw new Error(`parseInitiateResponse: ${k} ausente`);
    return v;
  };
  const partSize = typeof r['partSize'] === 'number' && r['partSize'] > 0 ? r['partSize'] : MULTIPART_PART_BYTES;
  return {
    uploadId: requireStr('uploadId'),
    storagePath: requireStr('storagePath'),
    fileName: requireStr('fileName'),
    originalName: typeof r['originalName'] === 'string' ? r['originalName'] : requireStr('fileName'),
    mimeType: requireStr('mimeType'),
    workspaceId: requireStr('workspaceId'),
    folder: typeof r['folder'] === 'string' ? r['folder'] : '',
    partSize
  };
}

function parseSignPartResponse(raw: unknown): MultipartSignPartResponse {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('parseSignPartResponse: respuesta no es un objeto');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r['signedUrl'] !== 'string' || !r['signedUrl']) {
    throw new Error('parseSignPartResponse: signedUrl ausente');
  }
  if (typeof r['partNumber'] !== 'number') {
    throw new Error('parseSignPartResponse: partNumber ausente');
  }
  return { signedUrl: r['signedUrl'], partNumber: r['partNumber'] };
}

function parseCompleteResponse(raw: unknown): MultipartCompleteResponse {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('parseCompleteResponse: respuesta no es un objeto');
  }
  const r = raw as Record<string, unknown>;
  const requireStr = (k: string): string => {
    const v = r[k];
    if (typeof v !== 'string' || !v) throw new Error(`parseCompleteResponse: ${k} ausente`);
    return v;
  };
  return {
    id: requireStr('id'),
    storagePath: requireStr('storagePath'),
    fileName: requireStr('fileName'),
    originalName: typeof r['originalName'] === 'string' ? r['originalName'] : requireStr('fileName'),
    mimeType: requireStr('mimeType'),
    workspaceId: requireStr('workspaceId'),
    folder: typeof r['folder'] === 'string' ? r['folder'] : '',
    size: typeof r['size'] === 'number' ? r['size'] : undefined
  };
}

export interface UploadProgressEvent {
  loadedBytes: number;
  totalBytes: number;
  partNumber: number;
  totalParts: number;
}

export interface MultipartUploadOptions {
  file: File;
  workspaceId: string;
  folder: string;
  partSize?: number;
  maxParallel?: number;
  signal?: AbortSignal;
  onProgress?: (event: UploadProgressEvent) => void;
}

async function initiateMultipart(req: MultipartInitiateRequest): Promise<MultipartInitiateResponse> {
  const res = await authFetch('/api/upload/multipart/initiate', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(req)
  });
  if (res.status === 404 || res.status === 501) {
    throw new MultipartUnsupportedError();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`initiate-multipart failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }
  return parseInitiateResponse(await res.json());
}

async function signPart(req: MultipartSignPartRequest): Promise<MultipartSignPartResponse> {
  const res = await authFetch('/api/upload/multipart/sign-part', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(req)
  });
  if (res.status === 404 || res.status === 501) {
    throw new MultipartUnsupportedError();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`sign-part failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }
  return parseSignPartResponse(await res.json());
}

async function completeMultipart(req: MultipartCompleteRequest): Promise<MultipartCompleteResponse> {
  const res = await authFetch('/api/upload/multipart/complete', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(req)
  });
  if (res.status === 404 || res.status === 501) {
    throw new MultipartUnsupportedError();
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`complete-multipart failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }
  return parseCompleteResponse(await res.json());
}

async function abortMultipart(uploadId: string, storagePath: string): Promise<void> {
  await authFetch('/api/upload/multipart/abort', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ uploadId, storagePath })
  }).catch(() => undefined);
}

async function uploadPart(
  url: string,
  body: Blob,
  contentType: string,
  signal: AbortSignal | undefined
): Promise<string> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
    signal
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upload-part failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : ''}`);
  }
  const etag = res.headers.get('etag') ?? res.headers.get('ETag');
  if (!etag) {
    throw new Error('upload-part: ETag missing in response');
  }
  return etag.replace(/^"|"$/g, '');
}

export async function uploadFileMultipart(opts: MultipartUploadOptions): Promise<MultipartCompleteResponse> {
  const { file, workspaceId, folder, signal, onProgress } = opts;
  const mimeType = (file.type && file.type.trim()) || 'application/octet-stream';

  const initiated = await initiateMultipart({
    fileName: file.name,
    mimeType,
    workspaceId,
    folder,
    fileSize: file.size
  });

  const partSize = opts.partSize && opts.partSize > 0 ? opts.partSize : initiated.partSize;
  const maxParallel = opts.maxParallel && opts.maxParallel > 0 ? opts.maxParallel : MULTIPART_MAX_PARALLEL;
  const totalParts = Math.max(1, Math.ceil(file.size / partSize));

  const partResults: Array<{ partNumber: number; etag: string }> = new Array<{ partNumber: number; etag: string }>(totalParts);
  let nextPartIndex = 0;
  let loadedBytes = 0;

  const runWorker = async (): Promise<void> => {
    for (;;) {
      if (signal?.aborted) throw new DOMException('Upload aborted', 'AbortError');
      const idx = nextPartIndex;
      if (idx >= totalParts) return;
      nextPartIndex += 1;

      const partNumber = idx + 1;
      const start = idx * partSize;
      const end = Math.min(file.size, start + partSize);
      const slice = file.slice(start, end);

      const signed = await signPart({
        uploadId: initiated.uploadId,
        storagePath: initiated.storagePath,
        partNumber
      });

      const etag = await uploadPart(signed.signedUrl, slice, mimeType, signal);
      partResults[idx] = { partNumber, etag };
      loadedBytes += slice.size;
      onProgress?.({ loadedBytes, totalBytes: file.size, partNumber, totalParts });
    }
  };

  try {
    const workers = Array.from({ length: Math.min(maxParallel, totalParts) }, () => runWorker());
    await Promise.all(workers);

    const completedParts = partResults
      .filter((p): p is { partNumber: number; etag: string } => Boolean(p))
      .sort((a, b) => a.partNumber - b.partNumber);

    if (completedParts.length !== totalParts) {
      throw new Error(`multipart: expected ${totalParts} parts, got ${completedParts.length}`);
    }

    return await completeMultipart({
      uploadId: initiated.uploadId,
      storagePath: initiated.storagePath,
      parts: completedParts,
      fileName: initiated.fileName,
      originalName: initiated.originalName,
      mimeType: initiated.mimeType,
      workspaceId: initiated.workspaceId,
      folder: initiated.folder
    });
  } catch (err) {
    await abortMultipart(initiated.uploadId, initiated.storagePath);
    throw err;
  }
}
