import { useCallback } from 'react';
import { buildSTFromSemantic, companionSTName } from '@/lib/buildSTFromSemantic';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import { filterSemanticWorkspaceStateByDocument } from '@/lib/semantic/workspace-state';
import { createDocumentApi, fetchDocsApi, updateDocumentApi } from '@/services/dashboardApi';
import type { DocItem } from '@/components/dashboard/types';
import type { SemanticWorkspaceState } from '@/services/editorSemanticStore';

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
    const stFileName = companionSTName(docName);
    const scopedState = filterSemanticWorkspaceStateByDocument(semanticState, { docId, docName });
    const stContent = buildSTFromSemantic(scopedState, docName);

    const syncRegistry = () => {
      const definitions = STDefinitionsRegistry.extractFromSource(stContent, stFileName);
      if (definitions.length > 0) {
        STDefinitionsRegistry.setFileDefinitions(stFileName, definitions);
      } else {
        STDefinitionsRegistry.removeFile(stFileName);
      }
    };

    const allDocs = await fetchDocsApi({ workspaceId });
    const companionDocs = allDocs.filter((d: DocItem) => d.name === stFileName);

    if (companionDocs.length > 0) {
      await Promise.all(companionDocs.map((doc: DocItem) => updateDocumentApi(doc.id, { content: stContent })));
      if (!companionStDocId) setCompanionStDocId(companionDocs[0].id);
      syncRegistry();
      setSemanticNotice(`Concepto registrado → ${stFileName} actualizado.`);
    } else {
      const result = await createDocumentApi({
        name: stFileName,
        content: stContent,
        type: 'text',
        ownerId: userId,
        workspaceId,
        folder
      });
      if (result?.id) {
        setCompanionStDocId(result.id);
        companionDocs.push({ id: result.id, name: stFileName } as DocItem);
      }
      syncRegistry();
      setSemanticNotice(`Concepto registrado → ${stFileName} creado en ${folder}/.`);
      window.dispatchEvent(new CustomEvent('agora:docs-changed'));
    }

    for (const doc of companionDocs) {
      window.dispatchEvent(new CustomEvent('agora:doc-content-updated', {
        detail: { docId: doc.id, docName: stFileName }
      }));
    }

    return { stFileName, stContent, companionDocs, scopedState };
  }, [companionStDocId, setCompanionStDocId, setSemanticNotice]);

  return { syncCompanionST };
}
