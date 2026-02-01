import type { DocItem, Workspace } from '@/components/dashboard/types';
import { authFetch } from '@/services/apiClient';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const assertOk = (res: Response, fallbackMessage: string) => {
  if (!res.ok) {
    throw new Error(fallbackMessage);
  }
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

export const fetchDocsApi = async (params: { workspaceId: string; ownerId?: string; view?: string }) => {
  const search = new URLSearchParams();
  search.set('workspaceId', params.workspaceId);
  if (params.ownerId) {
    search.set('ownerId', params.ownerId);
  }
  if (params.view) {
    search.set('view', params.view);
  }
  const res = await authFetch(`/api/documents?${search.toString()}`);
  assertOk(res, 'Failed to fetch docs via API');
  return (await res.json()) as DocItem[];
};

export const fetchDocumentRawApi = async (docId: string) => {
  const res = await authFetch(`/api/documents/${docId}/raw`, { cache: 'no-store' });
  assertOk(res, 'Failed to load content');
  return res.text();
};

export const createDocumentApi = async (payload: Record<string, unknown>) => {
  const res = await authFetch('/api/documents', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  });
  assertOk(res, 'Failed to create document via API');
  return res.json() as Promise<{ id: string; [key: string]: unknown }>;
};

export const updateDocumentApi = async (docId: string, payload: Record<string, unknown>) => {
  const res = await authFetch(`/api/documents/${docId}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  });
  assertOk(res, 'Failed to update document');
};

export const deleteDocumentApi = async (docId: string) => {
  const res = await authFetch(`/api/documents/${docId}`, { method: 'DELETE' });
  return res.ok;
};

/**
 * Uploads a file directly to Firebase Storage via signed URL, then registers it in Firestore.
 * This bypasses Vercel's 4.5MB limit by not routing the file through serverless functions.
 */
export const uploadFileApi = async (formData: FormData) => {
  const file = formData.get('file') as File;
  const workspaceId = (formData.get('workspaceId') as string) || 'personal';
  const folder = (formData.get('folder') as string) || 'No estructurado';

  if (!file) {
    throw new Error('No file provided');
  }

  // Step 1: Get signed URL for direct upload
  const signedUrlRes = await authFetch('/api/upload/signed-url', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      workspaceId,
      folder
    })
  });
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
