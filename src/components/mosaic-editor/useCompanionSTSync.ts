import { useCallback } from 'react';
import type { SemanticWorkspaceState } from '@/services/editorSemanticStore';
import { filterSemanticWorkspaceStateByDocument } from '@/lib/semantic/workspace-state';
import { syncSemanticCompanionForDocument } from '@/services/semanticSyncService';

interface SyncParams {
  semanticState: SemanticWorkspaceState;
  docName: string;
  docId: string | null;
  folder: string;
  workspaceId: string;
  userId: string | undefined;
}

interface UseCompanionSTSyncOptions {
  companionStDocId: string | null;
  setCompanionStDocId: (id: string) => void;
  setSemanticNotice: (msg: string) => void;
}

export function useCompanionSTSync({
  companionStDocId,
  setCompanionStDocId,
  setSemanticNotice
}: UseCompanionSTSyncOptions) {
  const syncCompanionST = useCallback(async ({
    semanticState,
    docName,
    docId,
    folder,
    workspaceId,
    userId
  }: SyncParams) => {
    const scopedState = filterSemanticWorkspaceStateByDocument(semanticState, { docId, docName });
    const result = await syncSemanticCompanionForDocument({
      workspaceId,
      state: semanticState,
      docId,
      docName,
      folder,
      ownerId: userId || null
    });

    if (!companionStDocId && result.companionDocIds[0]) {
      setCompanionStDocId(result.companionDocIds[0]);
    }

    if (result.action === 'created') {
      setSemanticNotice(`Concepto registrado -> ${result.companionName} creado en ${folder}/.`);
    } else if (result.action === 'updated') {
      setSemanticNotice(`Concepto registrado -> ${result.companionName} actualizado.`);
    } else {
      setSemanticNotice(`Sin items semanticos suficientes para generar ${result.companionName}.`);
    }

    return {
      ...result,
      scopedState
    };
  }, [companionStDocId, setCompanionStDocId, setSemanticNotice]);

  return { syncCompanionST };
}
