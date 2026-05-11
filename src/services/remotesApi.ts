/**
 * Cliente API para remotes Git externos por workspace.
 * Forgejo sigue siendo source-of-truth (no aparece en esta lista).
 */
import { authFetch, parseApiResponse } from '@/services/apiClient';

export type RemoteProvider = 'github' | 'gitlab' | 'bitbucket' | 'custom';
export type RemoteAuthMethod = 'ssh-key' | 'token' | 'none';

export interface WorkspaceRemote {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  provider: RemoteProvider;
  authMethod: RemoteAuthMethod;
  hasCredentials: boolean;
  isDefault: boolean;
  enabled: boolean;
  lastSyncAt: number | null;
  lastSyncStatus: 'ok' | 'error' | null;
  lastSyncError: string | null;
  createdAt: number;
  updatedAt: number;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

function parseRemote(raw: unknown): WorkspaceRemote {
  if (!isObject(raw)) throw new Error('parseRemote: respuesta no es objeto');
  const id = raw['id'];
  const workspaceId = raw['workspaceId'];
  if (typeof id !== 'string' || !id) throw new Error('parseRemote: id ausente');
  if (typeof workspaceId !== 'string') throw new Error('parseRemote: workspaceId ausente');
  const provider = raw['provider'];
  const authMethod = raw['authMethod'];
  const validProviders: RemoteProvider[] = ['github', 'gitlab', 'bitbucket', 'custom'];
  const validAuth: RemoteAuthMethod[] = ['ssh-key', 'token', 'none'];

  return {
    id,
    workspaceId,
    name: typeof raw['name'] === 'string' ? raw['name'] : '',
    url: typeof raw['url'] === 'string' ? raw['url'] : '',
    provider: validProviders.includes(provider as RemoteProvider) ? (provider as RemoteProvider) : 'custom',
    authMethod: validAuth.includes(authMethod as RemoteAuthMethod) ? (authMethod as RemoteAuthMethod) : 'none',
    hasCredentials: Boolean(raw['hasCredentials']),
    isDefault: Boolean(raw['isDefault']),
    enabled: raw['enabled'] !== false,
    lastSyncAt: typeof raw['lastSyncAt'] === 'number' ? raw['lastSyncAt'] : null,
    lastSyncStatus: raw['lastSyncStatus'] === 'ok' || raw['lastSyncStatus'] === 'error'
      ? raw['lastSyncStatus']
      : null,
    lastSyncError: typeof raw['lastSyncError'] === 'string' ? raw['lastSyncError'] : null,
    createdAt: typeof raw['createdAt'] === 'number' ? raw['createdAt'] : 0,
    updatedAt: typeof raw['updatedAt'] === 'number' ? raw['updatedAt'] : 0
  };
}

function parseList(raw: unknown): WorkspaceRemote[] {
  if (!isObject(raw) || !Array.isArray(raw['remotes'])) {
    throw new Error('parseList: respuesta inválida');
  }
  return raw['remotes'].map(parseRemote);
}

export interface CreateRemoteInput {
  name: string;
  url: string;
  provider?: RemoteProvider;
  authMethod: RemoteAuthMethod;
  authData?: string;
}

export interface OperationResult {
  ok: boolean;
  ref?: string | null;
  error?: string;
  notImplemented?: boolean;
  durationMs?: number;
}

const base = (workspaceId: string) =>
  `/api/workspaces/${encodeURIComponent(workspaceId)}/remotes`;

export async function listRemotes(workspaceId: string): Promise<WorkspaceRemote[]> {
  const res = await authFetch(base(workspaceId));
  if (!res.ok) throw new Error(`listRemotes HTTP ${res.status}`);
  const data = await parseApiResponse<unknown>(res);
  return parseList(data);
}

export async function createRemote(workspaceId: string, input: CreateRemoteInput): Promise<WorkspaceRemote> {
  const res = await authFetch(base(workspaceId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `createRemote HTTP ${res.status}`);
  }
  const data = await parseApiResponse<unknown>(res);
  if (!isObject(data) || !data['remote']) throw new Error('createRemote: respuesta inválida');
  return parseRemote(data['remote']);
}

export async function updateRemote(
  workspaceId: string,
  remoteId: string,
  patch: { name?: string; enabled?: boolean; authData?: string; authMethod?: RemoteAuthMethod }
): Promise<WorkspaceRemote> {
  const res = await authFetch(`${base(workspaceId)}/${encodeURIComponent(remoteId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `updateRemote HTTP ${res.status}`);
  }
  const data = await parseApiResponse<unknown>(res);
  if (!isObject(data) || !data['remote']) throw new Error('updateRemote: respuesta inválida');
  return parseRemote(data['remote']);
}

export async function deleteRemote(workspaceId: string, remoteId: string): Promise<void> {
  const res = await authFetch(`${base(workspaceId)}/${encodeURIComponent(remoteId)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `deleteRemote HTTP ${res.status}`);
  }
}

async function runOp(workspaceId: string, remoteId: string, op: 'push' | 'pull'): Promise<OperationResult> {
  const res = await authFetch(`${base(workspaceId)}/${encodeURIComponent(remoteId)}/${op}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const body = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return { ok: false, error: `${op} HTTP ${res.status}` };

  if (!res.ok) {
    return {
      ok: false,
      error: typeof body['error'] === 'string' ? body['error'] : `${op} HTTP ${res.status}`,
      notImplemented: body['notImplemented'] === true,
      durationMs: typeof body['durationMs'] === 'number' ? body['durationMs'] : undefined
    };
  }
  return {
    ok: true,
    ref: typeof body['ref'] === 'string' ? body['ref'] : null,
    durationMs: typeof body['durationMs'] === 'number' ? body['durationMs'] : undefined
  };
}

export const pushRemote = (workspaceId: string, remoteId: string) => runOp(workspaceId, remoteId, 'push');
export const pullRemote = (workspaceId: string, remoteId: string) => runOp(workspaceId, remoteId, 'pull');
