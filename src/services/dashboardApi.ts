import type { DocItem, Workspace } from '@/components/dashboard/types';
import { authFetch } from '@/services/apiClient';
import { withErrorCode } from '@/lib/error-utils';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';
import {
  cacheDocuments,
  getCachedDocuments,
  cacheDocContent,
  getCachedContent,
  deleteCachedDoc,
  enqueueSync,
  SyncOperation,
  SyncQueueStatus,
  type CachedDoc
} from '@/lib/offlineStorage';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Debounce document updates — longer window reduces Firestore writes/costs
const UPDATE_DEBOUNCE_MS = 1500;
type PendingUpdate = {
  payload: Record<string, unknown>;
  timer: ReturnType<typeof setTimeout>;
  resolve: () => void;
  reject: (e: unknown) => void;
};
const _pendingDocUpdates = new Map<string, PendingUpdate>();

// Deduplicate concurrent fetchDocsApi calls with identical params
const fetchDocsInFlight = new Map<string, Promise<DocItem[]>>();

const assertOk = (res: Response, fallbackMessage: string) => {
  if (!res.ok) {
    throw new Error(fallbackMessage);
  }
};

export const fetchCurrentUserApi = async () => {
  const res = await authFetch('/api/users/me');
  assertOk(res, 'Failed to fetch current user');
  return (await res.json()) as { uid: string; email?: string | null; role?: string };
};

export const fetchWorkspacesApi = async (params: { ownerId: string; email?: string | null }) => {
  const search = new URLSearchParams();
  search.set('ownerId', params.ownerId);
  if (params.email) {
    search.set('email', params.email);
  }
  const res = await authFetch(`/api/workspaces?${search.toString()}`);
  assertOk(res, 'Failed to fetch workspaces');
  const data = (await res.json()) as { workspaces?: Workspace[]; invites?: Workspace[] };
  return {
    workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
    invites: Array.isArray(data.invites) ? data.invites : []
  };
};

export const acceptInviteApi = async (params: { workspaceId: string; userId: string; email: string }) => {
  const res = await authFetch(`/api/workspaces/${params.workspaceId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action: 'accept',
      userId: params.userId,
      email: params.email
    })
  });
  assertOk(res, 'Failed to accept invite');
};

export const inviteMemberApi = async (params: { workspaceId: string; email: string }) => {
  const res = await authFetch(`/api/workspaces/${params.workspaceId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action: 'invite',
      email: params.email
    })
  });
  assertOk(res, 'Failed to invite member');
};

export const removeMemberApi = async (params: { workspaceId: string; userId: string }) => {
  const res = await authFetch(`/api/workspaces/${params.workspaceId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action: 'remove_member',
      userId: params.userId
    })
  });
  assertOk(res, 'Failed to remove member');
};

export const createWorkspaceApi = async (params: { name: string; ownerId: string }) => {
  const res = await authFetch('/api/workspaces', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      name: params.name,
      ownerId: params.ownerId
    })
  });
  assertOk(res, 'Failed to create workspace');
  return (await res.json()) as { id: string; name?: string; ownerId?: string; members?: string[] };
};

export const deleteWorkspaceApi = async (params: { workspaceId: string; ownerId: string }) => {
  const res = await authFetch(`/api/workspaces/${params.workspaceId}`, {
    method: 'DELETE',
    headers: JSON_HEADERS,
    body: JSON.stringify({ ownerId: params.ownerId })
  });
  assertOk(res, 'Failed to delete workspace');
};

export const renameWorkspaceApi = async (params: { workspaceId: string; name: string }) => {
  const res = await authFetch(`/api/workspaces/${params.workspaceId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action: 'rename',
      name: params.name
    })
  });
  assertOk(res, 'Failed to rename workspace');
  return (await res.json()) as { status: 'renamed'; id: string; name: string };
};

export const duplicateWorkspaceApi = async (params: { workspaceId: string; name: string }) => {
  const res = await authFetch(`/api/workspaces/${params.workspaceId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action: 'duplicate',
      name: params.name
    })
  });
  assertOk(res, 'Failed to duplicate workspace');
  return (await res.json()) as {
    status: 'duplicated';
    workspace: Workspace;
    documentsCreated: number;
    boardColumnsCreated: number;
    boardCardsCreated: number;
  };
};

export const mergeWorkspaceApi = async (params: { targetWorkspaceId: string; sourceWorkspaceId: string }) => {
  const res = await authFetch(`/api/workspaces/${params.targetWorkspaceId}`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action: 'merge',
      sourceWorkspaceId: params.sourceWorkspaceId
    })
  });
  assertOk(res, 'Failed to merge workspace');
  return (await res.json()) as {
    status: 'merged';
    documentsCreated: number;
    skippedFolders: number;
    boardColumnsCreated: number;
    boardCardsCreated: number;
  };
};

export const fetchDocsApi = (params: { workspaceId: string; ownerId?: string; view?: string }): Promise<DocItem[]> => {
  const search = new URLSearchParams();
  search.set('workspaceId', params.workspaceId);
  if (params.ownerId) search.set('ownerId', params.ownerId);
  if (params.view) search.set('view', params.view);

  const key = search.toString();
  const existing = fetchDocsInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const res = await authFetch(`/api/documents?${key}`, { cache: 'no-store' });
      assertOk(res, 'Failed to fetch docs via API');
      const docs = (await res.json()) as DocItem[];

      // Cache docs in IDB for offline use
      try {
        const cached: CachedDoc[] = docs.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type,
          folder: d.folder,
          mimeType: d.mimeType,
          size: d.size,
          storagePath: d.storagePath,
          workspaceId: params.workspaceId,
          ownerId: d.ownerId,
          order: d.order,
          updatedAt: d.updatedAt ? String(d.updatedAt) : undefined,
          _cachedAt: Date.now()
        }));
        await cacheDocuments(cached);
      } catch { /* IDB not available */ }

      return docs;
    } catch (err) {
      // Offline fallback: return cached docs from IDB
      if (!navigator.onLine) {
        try {
          const cached = await getCachedDocuments(params.workspaceId);
          if (cached.length > 0) {
            console.info('[offline] Serving', cached.length, 'docs from cache');
            return cached as unknown as DocItem[];
          }
        } catch { /* IDB not available */ }
      }
      throw err;
    }
  })();

  fetchDocsInFlight.set(key, promise);
  promise.finally(() => fetchDocsInFlight.delete(key));
  return promise;
};

export const fetchDocumentRawApi = async (docId: string) => {
  try {
    const res = await authFetch(`/api/documents/${docId}/raw`, { cache: 'no-store' });
    assertOk(res, 'Failed to load content');
    const text = await res.text();

    // Cache content in IDB
    try {
      await cacheDocContent(docId, text);
    } catch { /* IDB not available */ }

    return text;
  } catch (err) {
    // Offline fallback
    if (!navigator.onLine) {
      try {
        const cached = await getCachedContent(docId);
        if (cached !== null) {
          console.info('[offline] Serving content for', docId, 'from cache');
          return cached;
        }
      } catch { /* IDB not available */ }
    }
    throw err;
  }
};

export const downloadDocumentBlobApi = async (docId: string): Promise<{ blob: Blob; mimeType: string }> => {
  const res = await authFetch(`/api/documents/${docId}/raw`, { cache: 'no-store' });
  assertOk(res, 'Failed to download document');
  const mimeType = res.headers.get('Content-Type')?.split(';')[0]?.trim() || 'application/octet-stream';
  const blob = await res.blob();
  return { blob, mimeType };
};

export const replaceDocumentFileApi = async (params: {
  docId: string;
  blob: Blob;
  mimeType?: string;
}) => {
  const mimeType = params.mimeType || params.blob.type || 'application/octet-stream';

  const signedUrlRes = await authFetch(`/api/documents/${params.docId}/upload-url`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      mimeType,
      fileSize: params.blob.size
    })
  });

  if (signedUrlRes.status === 413) {
    const errData = await signedUrlRes.json();
    throw withErrorCode(
      new Error(errData.error || 'Límite de almacenamiento alcanzado'),
      'STORAGE_LIMIT_EXCEEDED'
    );
  }

  assertOk(signedUrlRes, 'Failed to get replacement upload URL');
  const uploadInfo = await signedUrlRes.json() as { signedUrl: string };

  const uploadRes = await fetch(uploadInfo.signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType
    },
    body: params.blob
  });

  if (!uploadRes.ok) {
    throw new Error(`Direct replacement upload failed: ${uploadRes.status}`);
  }

  const updateRes = await authFetch(`/api/documents/${params.docId}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      mimeType,
      size: params.blob.size,
      refreshUrl: true
    })
  });
  assertOk(updateRes, 'Failed to update file metadata');
};

export const fetchUserProfilesApi = async (params: { workspaceId: string; userIds: string[] }) => {
  const res = await authFetch('/api/users/lookup', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(params)
  });
  assertOk(res, 'Failed to fetch user profiles');
  return (await res.json()) as { users: { uid: string; email?: string | null; displayName?: string | null }[] };
};

export const createDocumentApi = async (payload: Record<string, unknown>) => {
  if (!navigator.onLine) {
    // Queue for later sync
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await enqueueSync({
      operation: SyncOperation.Create,
      docId: tempId,
      payload,
      timestamp: Date.now(),
      status: SyncQueueStatus.Pending,
      retries: 0
    });
    // Return a temp doc so the UI can render it
    return { id: tempId, ...payload, _offline: true } as { id: string; [key: string]: unknown };
  }

  const res = await authFetch('/api/documents', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  });
  assertOk(res, 'Failed to create document via API');
  return res.json() as Promise<{ id: string; [key: string]: unknown }>;
};

export const updateDocumentApi = (docId: string, payload: Record<string, unknown>): Promise<void> => {
  if (!navigator.onLine) {
    return (async () => {
      await enqueueSync({
        operation: SyncOperation.Update,
        docId,
        payload: { docId, ...payload },
        timestamp: Date.now(),
        status: SyncQueueStatus.Pending,
        retries: 0
      });
      if (typeof payload.content === 'string') {
        try { await cacheDocContent(docId, payload.content); } catch { /* ignore */ }
      }
    })();
  }

  // Cancel any pending debounced update for this doc
  const existing = _pendingDocUpdates.get(docId);
  const nextPayload = existing ? { ...existing.payload, ...payload } : payload;
  if (existing) {
    clearTimeout(existing.timer);
    // Resolve previous caller early — a newer update supersedes it
    existing.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(async () => {
      _pendingDocUpdates.delete(docId);
      try {
        const res = await authFetch(`/api/documents/${docId}`, {
          method: 'PUT',
          headers: JSON_HEADERS,
          body: JSON.stringify(nextPayload)
        });
        assertOk(res, 'Failed to update document');
        resolve();
      } catch (err) {
        reject(err);
      }
    }, UPDATE_DEBOUNCE_MS);
    _pendingDocUpdates.set(docId, { payload: nextPayload, timer, resolve, reject });
  });
};

export const deleteDocumentApi = async (docId: string) => {
  if (!navigator.onLine) {
    await enqueueSync({
      operation: SyncOperation.Delete,
      docId,
      payload: { docId },
      timestamp: Date.now(),
      status: SyncQueueStatus.Pending,
      retries: 0
    });
    try { await deleteCachedDoc(docId); } catch { /* ignore */ }
    return true;
  }

  const res = await authFetch(`/api/documents/${docId}`, { method: 'DELETE' });
  return res.ok;
};

/**
 * Uploads a file directly to Firebase Storage via signed URL, then registers it in Firestore.
 * This bypasses Vercel's 4.5MB limit by not routing the file through serverless functions.
 */
export const uploadFileApi = async (formData: FormData) => {
  const fileEntry = formData.get('file');
  const workspaceIdEntry = formData.get('workspaceId');
  const workspaceId = typeof workspaceIdEntry === 'string' && workspaceIdEntry
    ? workspaceIdEntry
    : PERSONAL_WORKSPACE_ID;
  const folder = (formData.get('folder') as string) || 'No estructurado';

  if (!(fileEntry instanceof File)) {
    throw new Error('No file provided');
  }
  const file = fileEntry;

  // Step 1: Get signed URL for direct upload
  const signedUrlRes = await authFetch('/api/upload/signed-url', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      workspaceId,
      folder,
      fileSize: file.size
    })
  });

  // Handle storage limit exceeded
  if (signedUrlRes.status === 413) {
    const errData = await signedUrlRes.json();
    throw withErrorCode(
      new Error(errData.error || 'Límite de almacenamiento alcanzado'),
      'STORAGE_LIMIT_EXCEEDED'
    );
  }

  assertOk(signedUrlRes, 'Failed to get upload URL');
  const uploadInfo = await signedUrlRes.json();

  // Step 2: Upload directly to Firebase Storage using the signed URL
  const uploadRes = await fetch(uploadInfo.signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    },
    body: file
  });

  if (!uploadRes.ok) {
    throw new Error(`Direct upload failed: ${uploadRes.status}`);
  }

  // Step 3: Register the uploaded file in Firestore
  const registerRes = await authFetch('/api/upload/register', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      storagePath: uploadInfo.storagePath,
      fileName: uploadInfo.fileName,
      originalName: uploadInfo.originalName,
      mimeType: uploadInfo.mimeType,
      workspaceId: uploadInfo.workspaceId,
      folder: uploadInfo.folder
    })
  });
  assertOk(registerRes, 'Failed to register upload');

  return (await registerRes.json()) as DocItem;
};

export const convertFileToMarkdownApi = async (params: {
  file: File;
  workspaceId: string;
  folder: string;
  persistOriginal?: boolean;
  createDocument?: boolean;
}) => {
  const formData = new FormData();
  formData.append('file', params.file);
  formData.append('workspaceId', params.workspaceId);
  formData.append('folder', params.folder);
  if (params.persistOriginal !== undefined) {
    formData.append('persistOriginal', params.persistOriginal ? 'true' : 'false');
  }
  if (params.createDocument !== undefined) {
    formData.append('createDocument', params.createDocument ? 'true' : 'false');
  }

  const res = await authFetch('/api/documents/convert', {
    method: 'POST',
    body: formData
  });
  assertOk(res, 'Failed to convert file to markdown');
  return (await res.json()) as {
    markdown: string;
    suggestedName: string;
    createdDoc: DocItem | null;
  };
};
