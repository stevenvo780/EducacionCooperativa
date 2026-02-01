import type { BoardCard, BoardColumn, BoardData } from '@/components/dashboard/types';
import { authFetch } from '@/services/apiClient';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const assertOk = (res: Response, fallbackMessage: string) => {
  if (!res.ok) {
    throw new Error(fallbackMessage);
  }
};

export const fetchBoardApi = async (params: { workspaceId: string }) => {
  const search = new URLSearchParams();
  search.set('workspaceId', params.workspaceId);
  const res = await authFetch(`/api/boards?${search.toString()}`, { cache: 'no-store' });
  assertOk(res, 'Failed to fetch board');
  return res.json() as Promise<BoardData>;
};

export const createBoardColumnApi = async (params: { workspaceId: string; name: string }) => {
  const res = await authFetch('/api/boards', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      type: 'column',
      name: params.name
    })
  });
  assertOk(res, 'Failed to create column');
  return res.json() as Promise<BoardColumn>;
};

export const updateBoardColumnApi = async (params: { workspaceId: string; columnId: string; name?: string; order?: number }) => {
  const res = await authFetch('/api/boards', {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      type: 'column',
      id: params.columnId,
      data: {
        name: params.name,
        order: params.order
      }
    })
  });
  assertOk(res, 'Failed to update column');
};

export const deleteBoardColumnApi = async (params: { workspaceId: string; columnId: string }) => {
  const res = await authFetch('/api/boards', {
    method: 'DELETE',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      type: 'column',
      id: params.columnId
    })
  });
  assertOk(res, 'Failed to delete column');
};

export const createBoardCardApi = async (params: {
  workspaceId: string;
  columnId: string;
  title: string;
  description?: string;
  ownerId?: string | null;
}) => {
  const res = await authFetch('/api/boards', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      type: 'card',
      columnId: params.columnId,
      title: params.title,
      description: params.description,
      ownerId: params.ownerId || undefined
    })
  });
  assertOk(res, 'Failed to create card');
  return res.json() as Promise<BoardCard>;
};

export const updateBoardCardApi = async (params: {
  workspaceId: string;
  cardId: string;
  title?: string;
  description?: string;
  columnId?: string;
  order?: number;
}) => {
  const res = await authFetch('/api/boards', {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      type: 'card',
      id: params.cardId,
      data: {
        title: params.title,
        description: params.description,
        columnId: params.columnId,
        order: params.order
      }
    })
  });
  assertOk(res, 'Failed to update card');
};

export const deleteBoardCardApi = async (params: { workspaceId: string; cardId: string }) => {
  const res = await authFetch('/api/boards', {
    method: 'DELETE',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      type: 'card',
      id: params.cardId
    })
  });
  assertOk(res, 'Failed to delete card');
};
