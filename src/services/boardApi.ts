import { fetchZod } from '@/lib/fetch-zod';
import { boardDataSchema, boardColumnSchema, boardCardSchema } from '@agora/contracts';
import { authFetch } from '@/services/apiClient';
import type { BoardCard, BoardColumn, BoardData } from '@/components/dashboard/types';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const assertOk = (res: Response, fallbackMessage: string) => {
    if (!res.ok) {
        throw new Error(fallbackMessage);
    }
};
export const fetchBoardApi = async (params: {
    workspaceId: string;
}): Promise<BoardData> => {
    const search = new URLSearchParams({ workspaceId: params.workspaceId });
    const data = await fetchZod(`/api/boards?${search.toString()}`, boardDataSchema, { cache: 'no-store' });
    return data as BoardData;
};
export interface BoardSnapshotPayload {
    columns: BoardColumn[];
    cards: BoardCard[];
}

export const subscribeBoardApi = (
  workspaceId: string,
  onChange: (payload: BoardSnapshotPayload) => void,
  onError?: (error: Error) => void
): (() => void) => {
  let active = true;
  let pending = false;
  let previous = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = async () => {
    if (!active || pending) return;
    if (typeof document !== 'undefined' && document.hidden) {
      timer = setTimeout(refresh, 5000);
      return;
    }
    pending = true;
    try {
      const board = await fetchBoardApi({ workspaceId });
      const payload = { columns: board.columns, cards: board.cards };
      const digest = JSON.stringify(payload);
      if (active && digest !== previous) { previous = digest; onChange(payload); }
    } catch (cause) {
      if (active) onError?.(cause instanceof Error ? cause : new Error('Board update failed'));
    } finally {
      pending = false;
      if (active) timer = setTimeout(refresh, 5000);
    }
  };
  void refresh();
  return () => { active = false; if (timer) clearTimeout(timer); };
};
export const createBoardColumnApi = async (params: {
    workspaceId: string;
    name: string;
}): Promise<BoardColumn> => {
    const data = await fetchZod('/api/boards', boardColumnSchema, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            workspaceId: params.workspaceId,
            type: 'column',
            name: params.name
        })
    });
    return data as BoardColumn;
};
export const updateBoardColumnApi = async (params: {
    workspaceId: string;
    columnId: string;
    name?: string;
    order?: number;
}) => {
    const res = await authFetch('/api/boards', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            workspaceId: params.workspaceId,
            type: 'column',
            id: params.columnId,
            data: {
                ...(params.name !== undefined ? { name: params.name } : {}),
                ...(params.order !== undefined ? { order: params.order } : {})
            }
        })
    });
    assertOk(res, 'Failed to update board column');
    return;
};
export const deleteBoardColumnApi = async (params: {
    workspaceId: string;
    columnId: string;
}) => {
    const res = await authFetch('/api/boards', {
        method: 'DELETE',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            workspaceId: params.workspaceId,
            type: 'column',
            id: params.columnId
        })
    });
    assertOk(res, 'Failed to delete board column');
    return;
};
export const createBoardCardApi = async (params: {
    workspaceId: string;
    columnId: string;
    title: string;
    description?: string;
    ownerId?: string | null;
    sourceDocId?: string;
    sourceDocName?: string;
    sourceFragment?: string;
    sourcePath?: string;
}): Promise<BoardCard> => {
    const data = await fetchZod('/api/boards', boardCardSchema, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            workspaceId: params.workspaceId,
            type: 'card',
            columnId: params.columnId,
            title: params.title,
            description: params.description,
            ownerId: params.ownerId,
            sourceDocId: params.sourceDocId,
            sourceDocName: params.sourceDocName,
            sourceFragment: params.sourceFragment,
            sourcePath: params.sourcePath
        })
    });
    return data as BoardCard;
};
export const updateBoardCardApi = async (params: {
    workspaceId: string;
    cardId: string;
    title?: string;
    description?: string;
    columnId?: string;
    order?: number;
    sourceDocId?: string;
    sourceDocName?: string;
    sourceFragment?: string;
    sourcePath?: string;
}) => {
    const res = await authFetch('/api/boards', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            workspaceId: params.workspaceId,
            type: 'card',
            id: params.cardId,
            data: {
                ...(params.title !== undefined ? { title: params.title } : {}),
                ...(params.description !== undefined ? { description: params.description } : {}),
                ...(params.columnId !== undefined ? { columnId: params.columnId } : {}),
                ...(params.order !== undefined ? { order: params.order } : {}),
                ...(params.sourceDocId !== undefined ? { sourceDocId: params.sourceDocId } : {}),
                ...(params.sourceDocName !== undefined ? { sourceDocName: params.sourceDocName } : {}),
                ...(params.sourceFragment !== undefined ? { sourceFragment: params.sourceFragment } : {}),
                ...(params.sourcePath !== undefined ? { sourcePath: params.sourcePath } : {})
            }
        })
    });
    assertOk(res, 'Failed to update board card');
    return;
};
export const deleteBoardCardApi = async (params: {
    workspaceId: string;
    cardId: string;
}) => {
    const res = await authFetch('/api/boards', {
        method: 'DELETE',
        headers: JSON_HEADERS,
        body: JSON.stringify({
            workspaceId: params.workspaceId,
            type: 'card',
            id: params.cardId
        })
    });
    assertOk(res, 'Failed to delete board card');
    return;
};
