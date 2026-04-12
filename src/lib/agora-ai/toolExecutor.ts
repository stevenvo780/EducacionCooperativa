import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { getErrorMessage } from '@/lib/error-utils';
import { normalizeFolderPath } from '@/lib/folder-utils';
import { buildStoragePath, ensureTextFileName } from '@/lib/storage-path';
import type {
  AgentExecutionContext,
  AgentToolCall,
  AgentToolExecutionResult,
  AgentRollbackAction
} from '@/lib/agora-ai/types';
import { isWorkspaceMember } from '@/lib/server-auth';
import { DocumentType } from '@/types/documents';
import { PERSONAL_WORKSPACE_ID, isPersonalWorkspaceId } from '@/types/workspace';

const DEFAULT_DOC_LIMIT = 25;
const MAX_DOC_SCAN = 200;
const MAX_CONTENT_PREVIEW = 800;

type StoredDocument = {
  id: string;
  name?: string;
  content?: string;
  type?: string;
  folder?: string;
  workspaceId?: string;
  ownerId?: string;
  mimeType?: string | null;
  storagePath?: string;
  url?: string;
  order?: number;
  size?: number;
  updatedAt?: unknown;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const excerpt = (value: string, maxLength = MAX_CONTENT_PREVIEW) => (
  value.length > maxLength ? `${value.slice(0, maxLength)}…` : value
);

const sanitizeFirestoreValue = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(item => sanitizeFirestoreValue(item));
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [key, sanitizeFirestoreValue(item)])
    );
  }
  return value;
};

const resolveSemanticDocId = (workspaceId: string, uid: string) => (
  isPersonalWorkspaceId(workspaceId) ? `${PERSONAL_WORKSPACE_ID}:${uid}` : workspaceId
);

async function ensureWorkspaceAccess(workspaceId: string, uid: string) {
  if (isPersonalWorkspaceId(workspaceId)) {
    return;
  }

  const allowed = await isWorkspaceMember(workspaceId, uid);
  if (!allowed) {
    throw new Error('No tienes acceso a este workspace');
  }
}

async function fetchWorkspaceDoc(workspaceId: string, uid: string) {
  if (isPersonalWorkspaceId(workspaceId)) {
    return {
      id: PERSONAL_WORKSPACE_ID,
      name: 'Workspace personal',
      ownerId: uid,
      members: [uid],
      type: 'personal'
    };
  }

  const snap = await adminDb.collection('workspaces').doc(workspaceId).get();
  if (!snap.exists) {
    throw new Error('Workspace no encontrado');
  }
  return { id: snap.id, ...snap.data() } as Record<string, unknown>;
}

async function fetchDocumentForUser(documentId: string, ctx: AgentExecutionContext): Promise<StoredDocument> {
  const snap = await adminDb.collection('documents').doc(documentId).get();
  if (!snap.exists) {
    throw new Error('Documento no encontrado');
  }
  const data = { id: snap.id, ...(snap.data() as Record<string, unknown>) } as StoredDocument;
  const docWorkspaceId = data.workspaceId || PERSONAL_WORKSPACE_ID;
  if (!isPersonalWorkspaceId(docWorkspaceId)) {
    await ensureWorkspaceAccess(docWorkspaceId, ctx.uid);
  } else if (data.ownerId && data.ownerId !== ctx.uid) {
    throw new Error('No tienes acceso a este documento');
  }
  return data;
}

async function syncTextDocumentToStorage(doc: StoredDocument, content: string) {
  try {
    const bucket = adminStorage.bucket();
    if (!bucket?.name) return null;
    const fileName = ensureTextFileName(doc.name || 'Sin titulo');
    const storagePath = doc.storagePath || buildStoragePath({
      workspaceId: doc.workspaceId || PERSONAL_WORKSPACE_ID,
      ownerId: doc.ownerId || 'unknown',
      folder: doc.folder,
      fileName
    });
    await bucket.file(storagePath).save(content, {
      contentType: doc.mimeType || 'text/markdown',
      metadata: { ownerId: doc.ownerId || 'unknown' }
    });
    return storagePath;
  } catch (error) {
    console.warn('Agora agent storage sync failed:', getErrorMessage(error));
    return null;
  }
}

async function maybeDeleteStorageObject(storagePath?: string, documentId?: string) {
  if (!storagePath || !documentId) return;
  try {
    const countSnap = await adminDb.collection('documents')
      .where('storagePath', '==', storagePath)
      .where(FieldPath.documentId(), '!=', documentId)
      .count()
      .get();
    const hasOtherRefs = countSnap.data().count > 0;
    if (hasOtherRefs) return;

    const bucket = adminStorage.bucket();
    if (!bucket?.name) return;
    await bucket.file(storagePath).delete().catch(() => undefined);
  } catch (error) {
    console.warn('Agora agent storage delete failed:', getErrorMessage(error));
  }
}

async function writeAuditLog(ctx: AgentExecutionContext, call: AgentToolCall, result: AgentToolExecutionResult) {
  try {
    await adminDb.collection('agentAuditLog').add({
      workspaceId: ctx.workspaceId,
      userId: ctx.uid,
      userEmail: ctx.email ?? null,
      toolName: call.name,
      toolArgs: sanitizeFirestoreValue(call.args),
      ok: result.ok,
      summary: result.summary,
      error: result.error ?? null,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.warn('Unable to persist Agora agent audit log:', getErrorMessage(error));
  }
}

const ok = (
  call: AgentToolCall,
  summary: string,
  data: Record<string, unknown> = {},
  rollback: AgentRollbackAction[] = []
): AgentToolExecutionResult => ({
  ok: true,
  name: call.name,
  callId: call.id,
  summary,
  data,
  rollback
});

const fail = (call: AgentToolCall, error: unknown): AgentToolExecutionResult => ({
  ok: false,
  name: call.name,
  callId: call.id,
  summary: getErrorMessage(error),
  error: getErrorMessage(error)
});

const confirm = (
  call: AgentToolCall,
  prompt: string,
  data: Record<string, unknown> = {}
): AgentToolExecutionResult => ({
  ok: true,
  name: call.name,
  callId: call.id,
  summary: prompt,
  data,
  requiresConfirmation: true,
  pendingConfirmation: {
    toolCallId: call.id,
    toolName: call.name,
    prompt,
    args: call.args
  }
});

async function listDocuments(call: AgentToolCall, ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const folder = typeof call.args.folder === 'string' && call.args.folder.trim()
    ? normalizeFolderPath(call.args.folder)
    : null;
  const type = typeof call.args.type === 'string' ? call.args.type : null;
  const limit = clamp(typeof call.args.limit === 'number' ? call.args.limit : DEFAULT_DOC_LIMIT, 1, 100);

  let query: FirebaseFirestore.Query = adminDb.collection('documents');
  if (isPersonalWorkspaceId(ctx.workspaceId)) {
    query = query.where('ownerId', '==', ctx.uid);
    query = query.where('workspaceId', '==', PERSONAL_WORKSPACE_ID);
  } else {
    query = query.where('workspaceId', '==', ctx.workspaceId);
  }
  if (type) {
    query = query.where('type', '==', type);
  }

  const snap = await query.limit(limit * 3).get();
  const documents = snap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as StoredDocument))
    .filter(doc => !folder || normalizeFolderPath(doc.folder) === folder)
    .slice(0, limit)
    .map(doc => ({
      id: doc.id,
      name: doc.name || 'Sin título',
      type: doc.type || DocumentType.Text,
      folder: normalizeFolderPath(doc.folder),
      updatedAt: doc['updatedAt'] ?? null
    }));

  return ok(call, `Encontré ${documents.length} documento(s).`, { documents });
}

async function readDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  if (!documentId) throw new Error('documentId es requerido');
  const doc = await fetchDocumentForUser(documentId, ctx);
  return ok(call, `Leí "${doc.name || 'Sin título'}".`, {
    document: {
      id: doc.id,
      name: doc.name || 'Sin título',
      type: doc.type || DocumentType.Text,
      folder: normalizeFolderPath(doc.folder),
      content: doc.content || '',
      preview: excerpt(doc.content || ''),
      mimeType: doc.mimeType || null
    }
  });
}

async function createDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const title = String(call.args.title || '').trim() || 'Nuevo documento';
  const content = typeof call.args.content === 'string' ? call.args.content : '';
  const type = call.args.type === DocumentType.Folder ? DocumentType.Folder : DocumentType.Text;
  const folder = normalizeFolderPath(typeof call.args.folder === 'string' ? call.args.folder : undefined);

  const payload: Record<string, unknown> = {
    workspaceId: ctx.workspaceId,
    ownerId: ctx.uid,
    name: title,
    type,
    folder,
    content: type === DocumentType.Folder ? '' : content,
    mimeType: type === DocumentType.Folder ? null : 'text/markdown',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: ctx.uid,
    lastUpdatedBy: ctx.uid
  };

  const ref = await adminDb.collection('documents').add(payload);
  const storagePath = type === DocumentType.Text
    ? await syncTextDocumentToStorage({
      id: ref.id,
      name: title,
      content,
      type,
      folder,
      workspaceId: ctx.workspaceId,
      ownerId: ctx.uid,
      mimeType: 'text/markdown'
    }, content)
    : null;

  if (storagePath) {
    await ref.update({ storagePath });
  }

  return ok(
    call,
    type === DocumentType.Folder ? `Creé la carpeta "${title}".` : `Creé el documento "${title}".`,
    {
      document: {
        id: ref.id,
        name: title,
        type,
        folder,
        content: type === DocumentType.Text ? content : ''
      }
    },
    [{ action: 'delete_document', args: { documentId: ref.id, confirmed: true } }]
  );
}

async function restoreDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const snapshot = call.args.snapshot as Record<string, unknown> | undefined;
  if (!snapshot) throw new Error('snapshot es requerido para restaurar');
  const explicitId = typeof call.args.documentId === 'string' ? call.args.documentId : undefined;
  const ref = explicitId ? adminDb.collection('documents').doc(explicitId) : adminDb.collection('documents').doc();
  const content = typeof snapshot.content === 'string' ? snapshot.content : '';
  const nextData = {
    ...snapshot,
    workspaceId: snapshot.workspaceId || ctx.workspaceId,
    ownerId: snapshot.ownerId || ctx.uid,
    updatedAt: FieldValue.serverTimestamp(),
    restoredBy: ctx.uid
  };
  await ref.set(nextData, { merge: true });
  if ((snapshot.type as string | undefined) !== DocumentType.Folder) {
    await syncTextDocumentToStorage({
      id: ref.id,
      name: typeof snapshot.name === 'string' ? snapshot.name : 'Documento restaurado',
      content,
      type: typeof snapshot.type === 'string' ? snapshot.type : DocumentType.Text,
      folder: typeof snapshot.folder === 'string' ? snapshot.folder : undefined,
      workspaceId: typeof snapshot.workspaceId === 'string' ? snapshot.workspaceId : ctx.workspaceId,
      ownerId: typeof snapshot.ownerId === 'string' ? snapshot.ownerId : ctx.uid,
      mimeType: typeof snapshot.mimeType === 'string' ? snapshot.mimeType : 'text/markdown',
      storagePath: typeof snapshot.storagePath === 'string' ? snapshot.storagePath : undefined
    }, content);
  }
  return ok(call, `Restauré "${String(snapshot.name || ref.id)}".`, { documentId: ref.id });
}

async function updateDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  if (!documentId) throw new Error('documentId es requerido');
  const doc = await fetchDocumentForUser(documentId, ctx);
  const previousSnapshot = {
    name: doc.name || 'Sin título',
    content: doc.content || '',
    folder: normalizeFolderPath(doc.folder),
    type: doc.type || DocumentType.Text,
    workspaceId: doc.workspaceId || ctx.workspaceId,
    ownerId: doc.ownerId || ctx.uid,
    mimeType: doc.mimeType || 'text/markdown',
    storagePath: doc.storagePath || null
  };

  const title = typeof call.args.title === 'string' ? call.args.title.trim() : doc.name || 'Sin título';
  const content = typeof call.args.content === 'string' ? call.args.content : doc.content || '';
  const updateData: Record<string, unknown> = {
    name: title,
    content,
    updatedAt: FieldValue.serverTimestamp(),
    lastUpdatedBy: ctx.uid
  };
  const storagePath = await syncTextDocumentToStorage({
    ...doc,
    name: title,
    content,
    ownerId: doc.ownerId || ctx.uid,
    workspaceId: doc.workspaceId || ctx.workspaceId,
    mimeType: doc.mimeType || 'text/markdown'
  }, content);
  if (storagePath) {
    updateData.storagePath = storagePath;
  }
  await adminDb.collection('documents').doc(documentId).update(updateData);

  return ok(call, `Actualicé "${title}".`, {
    document: {
      id: documentId,
      name: title,
      previousPreview: excerpt(previousSnapshot.content),
      preview: excerpt(content)
    }
  }, [{ action: 'restore_document', args: { documentId, snapshot: previousSnapshot } }]);
}

async function renameDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  const newTitle = String(call.args.newTitle || '').trim();
  if (!documentId || !newTitle) throw new Error('documentId y newTitle son requeridos');
  const doc = await fetchDocumentForUser(documentId, ctx);
  await adminDb.collection('documents').doc(documentId).update({
    name: newTitle,
    updatedAt: FieldValue.serverTimestamp(),
    lastUpdatedBy: ctx.uid
  });

  return ok(call, `Renombré "${doc.name || 'Sin título'}" a "${newTitle}".`, {
    document: { id: documentId, previousName: doc.name || 'Sin título', name: newTitle }
  }, [{ action: 'rename_document', args: { documentId, newTitle: doc.name || 'Sin título' } }]);
}

async function moveDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  const targetFolder = normalizeFolderPath(String(call.args.targetFolder || '').trim());
  if (!documentId) throw new Error('documentId es requerido');
  const doc = await fetchDocumentForUser(documentId, ctx);
  const previousFolder = normalizeFolderPath(doc.folder);
  await adminDb.collection('documents').doc(documentId).update({
    folder: targetFolder,
    updatedAt: FieldValue.serverTimestamp(),
    lastUpdatedBy: ctx.uid
  });
  return ok(call, `Moví "${doc.name || 'Sin título'}" a "${targetFolder}".`, {
    document: {
      id: documentId,
      name: doc.name || 'Sin título',
      previousFolder,
      folder: targetFolder
    }
  }, [{ action: 'move_document', args: { documentId, targetFolder: previousFolder } }]);
}

async function deleteDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  const confirmed = call.args.confirmed === true;
  if (!documentId) throw new Error('documentId es requerido');
  const doc = await fetchDocumentForUser(documentId, ctx);

  if (!confirmed) {
    return confirm(call, `¿Confirmas eliminar "${doc.name || 'Sin título'}"?`, {
      document: { id: doc.id, name: doc.name || 'Sin título', folder: normalizeFolderPath(doc.folder) }
    });
  }

  const snapshot = {
    name: doc.name || 'Sin título',
    content: doc.content || '',
    folder: normalizeFolderPath(doc.folder),
    type: doc.type || DocumentType.Text,
    workspaceId: doc.workspaceId || ctx.workspaceId,
    ownerId: doc.ownerId || ctx.uid,
    mimeType: doc.mimeType || 'text/markdown',
    storagePath: doc.storagePath || null,
    size: doc.size || null,
    order: doc.order || null,
    url: doc.url || null
  };

  await adminDb.collection('documents').doc(documentId).delete();
  await maybeDeleteStorageObject(doc.storagePath, doc.id);

  return ok(call, `Eliminé "${doc.name || 'Sin título'}".`, {
    document: { id: doc.id, name: doc.name || 'Sin título' }
  }, [{ action: 'restore_document', args: { documentId: doc.id, snapshot } }]);
}

async function searchDocuments(call: AgentToolCall, ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const queryText = String(call.args.query || '').trim().toLowerCase();
  if (!queryText) throw new Error('query es requerido');
  const limit = clamp(typeof call.args.limit === 'number' ? call.args.limit : 10, 1, 25);

  let query: FirebaseFirestore.Query = adminDb.collection('documents');
  if (isPersonalWorkspaceId(ctx.workspaceId)) {
    query = query.where('ownerId', '==', ctx.uid);
    query = query.where('workspaceId', '==', PERSONAL_WORKSPACE_ID);
  } else {
    query = query.where('workspaceId', '==', ctx.workspaceId);
  }

  const snap = await query.limit(MAX_DOC_SCAN).get();
  const results = snap.docs
    .map(doc => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as StoredDocument))
    .filter(doc => {
      const haystack = [doc.name, doc.folder, doc.content].map(part => String(part || '').toLowerCase()).join('\n');
      return haystack.includes(queryText);
    })
    .slice(0, limit)
    .map(doc => ({
      id: doc.id,
      name: doc.name || 'Sin título',
      folder: normalizeFolderPath(doc.folder),
      type: doc.type || DocumentType.Text,
      preview: excerpt(doc.content || '', 180)
    }));

  return ok(call, `La búsqueda devolvió ${results.length} resultado(s).`, { results });
}

async function listFolders(call: AgentToolCall, ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  let query: FirebaseFirestore.Query = adminDb.collection('documents');
  if (isPersonalWorkspaceId(ctx.workspaceId)) {
    query = query.where('ownerId', '==', ctx.uid);
    query = query.where('workspaceId', '==', PERSONAL_WORKSPACE_ID);
  } else {
    query = query.where('workspaceId', '==', ctx.workspaceId);
  }

  const snap = await query.limit(MAX_DOC_SCAN).get();
  const folders = new Set<string>();
  snap.docs.forEach(doc => {
    const data = doc.data() as Record<string, unknown>;
    folders.add(normalizeFolderPath(typeof data.folder === 'string' ? data.folder : undefined));
    if (data.type === DocumentType.Folder && typeof data.name === 'string') {
      folders.add(normalizeFolderPath(data.name));
    }
  });

  return ok(call, `Encontré ${folders.size} carpeta(s).`, { folders: Array.from(folders).sort() });
}

async function getWorkspaceInfo(call: AgentToolCall, ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const workspace = await fetchWorkspaceDoc(ctx.workspaceId, ctx.uid);
  const members = Array.isArray(workspace.members) ? workspace.members : [ctx.uid];
  return ok(call, 'Recuperé la información del workspace.', {
    workspace: {
      id: String(workspace.id),
      name: String(workspace.name || 'Workspace'),
      ownerId: String(workspace.ownerId || ctx.uid),
      type: String(workspace.type || 'shared'),
      members,
      membersCount: members.length,
      pendingInvites: Array.isArray(workspace.pendingInvites) ? workspace.pendingInvites : []
    }
  });
}

async function getSemanticState(call: AgentToolCall, ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const storageId = resolveSemanticDocId(ctx.workspaceId, ctx.uid);
  const snap = await adminDb.collection('workspaceSemanticStates').doc(storageId).get();
  const state = snap.exists ? snap.data() as Record<string, unknown> : { concepts: [], fragments: [], relations: [] };
  return ok(call, 'Recuperé el estado semántico.', {
    state: {
      concepts: Array.isArray(state.concepts) ? state.concepts : [],
      fragments: Array.isArray(state.fragments) ? state.fragments : [],
      relations: Array.isArray(state.relations) ? state.relations : [],
      updatedAt: state.updatedAt ?? null
    }
  });
}

async function listSnippets(call: AgentToolCall, ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const snap = await adminDb.collection('snippets')
    .where('workspaceId', '==', ctx.workspaceId)
    .orderBy('order', 'asc')
    .limit(100)
    .get();

  const snippets = snap.docs.map(doc => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      title: String(data.title || 'Sin título'),
      description: String(data.description || ''),
      category: String(data.category || 'general')
    };
  });

  return ok(call, `Encontré ${snippets.length} snippet(s).`, { snippets });
}

async function createSnippet(call: AgentToolCall, ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const title = String(call.args.title || '').trim();
  const markdown = typeof call.args.markdown === 'string' ? call.args.markdown : '';
  if (!title || !markdown) throw new Error('title y markdown son requeridos');

  const data = {
    title,
    markdown,
    description: typeof call.args.description === 'string' ? call.args.description.trim() : '',
    category: typeof call.args.category === 'string' ? call.args.category.trim() : 'general',
    workspaceId: ctx.workspaceId,
    ownerId: ctx.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    order: 0
  };

  const ref = await adminDb.collection('snippets').add(data);

  return ok(call, `Creé el snippet "${title}".`, {
    snippet: { id: ref.id, title, category: data.category }
  }, [{ action: 'delete_snippet', args: { snippetId: ref.id } }]);
}

async function deleteSnippet(call: AgentToolCall, ctx: AgentExecutionContext) {
  const snippetId = String(call.args.snippetId || '').trim();
  if (!snippetId) throw new Error('snippetId es requerido');
  const ref = adminDb.collection('snippets').doc(snippetId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Snippet no encontrado');
  const data = snap.data() as Record<string, unknown>;
  const workspaceId = typeof data.workspaceId === 'string' ? data.workspaceId : ctx.workspaceId;
  if (workspaceId !== ctx.workspaceId) throw new Error('Snippet fuera del workspace actual');
  await ensureWorkspaceAccess(workspaceId, ctx.uid);
  await ref.delete();
  return ok(call, `Eliminé el snippet "${String(data.title || snippetId)}".`, { snippetId });
}

async function formalizeText(call: AgentToolCall, ctx: AgentExecutionContext) {
  const text = String(call.args.text || '').trim();
  if (!text) throw new Error('text es requerido');
  if (!ctx.origin) throw new Error('No se pudo resolver el origen del request para formalizar');

  const res = await fetch(`${ctx.origin}/api/formalize-llm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      profile: typeof call.args.profile === 'string' ? call.args.profile : 'classical.propositional',
      language: call.args.language === 'en' ? 'en' : 'es'
    })
  });

  const data = await res.json() as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    throw new Error(String(data.error || data.message || 'No se pudo formalizar el texto'));
  }

  return ok(call, 'Texto formalizado correctamente.', {
    result: {
      stCode: String(data.stCode || ''),
      confidence: typeof data.confidence === 'number' ? data.confidence : null,
      diagnostics: Array.isArray(data.diagnostics) ? data.diagnostics : []
    }
  });
}

async function createFolder(call: AgentToolCall, ctx: AgentExecutionContext) {
  const name = String(call.args.name || '').trim();
  if (!name) throw new Error('name es requerido');
  const parentFolder = typeof call.args.parentFolder === 'string' ? normalizeFolderPath(call.args.parentFolder) : undefined;
  const folderPath = parentFolder ? normalizeFolderPath(`${parentFolder}/${name}`) : normalizeFolderPath(name);
  return createDocument({
    ...call,
    args: {
      title: name,
      type: DocumentType.Folder,
      folder: folderPath,
      content: ''
    }
  }, ctx);
}

export async function executeAgentTool(call: AgentToolCall, ctx: AgentExecutionContext): Promise<AgentToolExecutionResult> {
  try {
    let result: AgentToolExecutionResult;
    switch (call.name) {
      case 'list_documents':
      case 'list_files':
        result = await listDocuments(call, ctx);
        break;
      case 'read_document':
      case 'read_file':
        result = await readDocument(call, ctx);
        break;
      case 'create_document':
      case 'create_file':
        result = await createDocument(call, ctx);
        break;
      case 'update_document':
        result = await updateDocument(call, ctx);
        break;
      case 'rename_document':
      case 'rename_file':
        result = await renameDocument(call, ctx);
        break;
      case 'move_document':
        result = await moveDocument(call, ctx);
        break;
      case 'delete_document':
      case 'delete_file':
        result = await deleteDocument(call, ctx);
        break;
      case 'search_documents':
        result = await searchDocuments(call, ctx);
        break;
      case 'list_folders':
        result = await listFolders(call, ctx);
        break;
      case 'create_folder':
        result = await createFolder(call, ctx);
        break;
      case 'get_workspace_info':
        result = await getWorkspaceInfo(call, ctx);
        break;
      case 'get_semantic_state':
        result = await getSemanticState(call, ctx);
        break;
      case 'list_snippets':
        result = await listSnippets(call, ctx);
        break;
      case 'create_snippet':
        result = await createSnippet(call, ctx);
        break;
      case 'delete_snippet':
        result = await deleteSnippet(call, ctx);
        break;
      case 'formalize_text':
        result = await formalizeText(call, ctx);
        break;
      case 'restore_document':
        result = await restoreDocument(call, ctx);
        break;
      default:
        throw new Error(`Tool desconocida: ${call.name}`);
    }

    await writeAuditLog(ctx, call, result);
    return result;
  } catch (error) {
    const result = fail(call, error);
    await writeAuditLog(ctx, call, result);
    return result;
  }
}
