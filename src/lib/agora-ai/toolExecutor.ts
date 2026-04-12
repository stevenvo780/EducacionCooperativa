import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { check as checkST, createInterpreter, evaluate as evaluateST, listProfiles } from '@stevenvo780/st-lang/api';
import { formalize as formalizeNLP, type LogicProfile } from '@stevenvo780/autologic';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import {
  analyzeMarkdown,
  compareMarkdownDocuments,
  extractChecklistTasks,
  summarizeMarkdown
} from '@/lib/agora-ai/documentIntelligence';
import { getErrorMessage } from '@/lib/error-utils';
import { normalizeFolderPath } from '@/lib/folder-utils';
import {
  EMPTY_SEMANTIC_WORKSPACE_STATE,
  normalizeSemanticWorkspaceState,
  type SemanticConceptRecord,
  type SemanticRelationRecord,
  type SemanticRelationType,
  type SemanticWorkspaceState
} from '@/lib/semantic/workspace-state';
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
const DEFAULT_BOARD_COLUMNS = ['Por hacer', 'En progreso', 'Hecho'];

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

type StoredSnippet = {
  id: string;
  title?: string;
  description?: string;
  markdown?: string;
  category?: string;
  order?: number;
  workspaceId?: string;
  ownerId?: string;
};

type StoredBoardColumn = {
  id: string;
  name?: string;
  order?: number;
};

type StoredBoardCard = {
  id: string;
  title?: string;
  description?: string;
  columnId?: string;
  order?: number;
  ownerId?: string;
  sourceDocId?: string | null;
  sourceDocName?: string | null;
  sourceFragment?: string | null;
  sourcePath?: string | null;
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

/**
 * Resolve a documentId that might be a Firebase ID or a document title/name.
 * If it looks like a valid Firestore document ID, return it directly.
 * Otherwise, search by name among the user's documents.
 */
async function resolveDocumentId(rawId: string, ctx: AgentExecutionContext): Promise<string> {
  // Try direct Firestore lookup first (valid IDs are typically 20-char alphanumeric)
  const directSnap = await adminDb.collection('documents').doc(rawId).get();
  if (directSnap.exists) {
    return rawId;
  }

  // Not found by ID — search by name (case-insensitive match)
  const nameNorm = rawId.trim().toLowerCase();
  const docsRef = adminDb.collection('documents');

  // Try personal workspace
  const query = isPersonalWorkspaceId(ctx.workspaceId)
    ? docsRef.where('ownerId', '==', ctx.uid).limit(MAX_DOC_SCAN)
    : docsRef.where('workspaceId', '==', ctx.workspaceId).limit(MAX_DOC_SCAN);

  const snap = await query.get();
  const matches = snap.docs.filter(d => {
    const name = (d.data().name || '').trim().toLowerCase();
    return name === nameNorm;
  });

  if (matches.length === 1) return matches[0].id;

  // Try partial / includes match if exact match failed
  if (matches.length === 0) {
    const partial = snap.docs.filter(d => {
      const name = (d.data().name || '').trim().toLowerCase();
      return name.includes(nameNorm) || nameNorm.includes(name);
    });
    if (partial.length === 1) return partial[0].id;
    if (partial.length > 1) {
      const names = partial.slice(0, 5).map(d => `"${d.data().name}" (${d.id})`).join(', ');
      throw new Error(`Múltiples documentos coinciden con "${rawId}": ${names}. Usa el ID exacto.`);
    }
  }

  if (matches.length > 1) {
    const names = matches.slice(0, 5).map(d => `"${d.data().name}" (${d.id})`).join(', ');
    throw new Error(`Múltiples documentos con nombre "${rawId}": ${names}. Usa el ID exacto.`);
  }

  throw new Error(`Documento no encontrado: "${rawId}". Usa list_documents para ver los documentos disponibles.`);
}

async function fetchDocumentForUser(documentId: string, ctx: AgentExecutionContext): Promise<StoredDocument> {
  const resolvedId = await resolveDocumentId(documentId, ctx);
  const snap = await adminDb.collection('documents').doc(resolvedId).get();
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

const normalizeLookupKey = (value: string) => value.trim().toLowerCase();

async function listWorkspaceSnippets(ctx: AgentExecutionContext): Promise<StoredSnippet[]> {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  let query: FirebaseFirestore.Query = adminDb.collection('snippets')
    .where('workspaceId', '==', ctx.workspaceId);
  if (isPersonalWorkspaceId(ctx.workspaceId)) {
    query = query.where('ownerId', '==', ctx.uid);
  }
  const snap = await query.limit(MAX_DOC_SCAN).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as StoredSnippet));
}

async function resolveSnippetId(rawId: string, ctx: AgentExecutionContext): Promise<string> {
  const direct = await adminDb.collection('snippets').doc(rawId).get();
  if (direct.exists) {
    const data = direct.data() as Record<string, unknown>;
    if ((data.workspaceId || ctx.workspaceId) !== ctx.workspaceId) {
      throw new Error('Snippet fuera del workspace actual');
    }
    return rawId;
  }

  const key = normalizeLookupKey(rawId);
  const snippets = await listWorkspaceSnippets(ctx);
  const exact = snippets.filter((snippet) => normalizeLookupKey(String(snippet.title || '')) === key);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) {
    throw new Error(`Múltiples snippets coinciden con "${rawId}". Usa el ID exacto.`);
  }

  const partial = snippets.filter((snippet) => {
    const title = normalizeLookupKey(String(snippet.title || ''));
    return title.includes(key) || key.includes(title);
  });
  if (partial.length === 1) return partial[0].id;
  if (partial.length > 1) {
    throw new Error(`Múltiples snippets coinciden parcialmente con "${rawId}". Usa el ID exacto.`);
  }

  throw new Error(`Snippet no encontrado: "${rawId}".`);
}

async function fetchSnippetForUser(snippetId: string, ctx: AgentExecutionContext): Promise<StoredSnippet> {
  const resolvedId = await resolveSnippetId(snippetId, ctx);
  const snap = await adminDb.collection('snippets').doc(resolvedId).get();
  if (!snap.exists) {
    throw new Error('Snippet no encontrado');
  }
  const data = { id: snap.id, ...(snap.data() as Record<string, unknown>) } as StoredSnippet;
  if ((data.workspaceId || ctx.workspaceId) !== ctx.workspaceId) {
    throw new Error('Snippet fuera del workspace actual');
  }
  return data;
}

const resolveBoardWorkspaceId = (workspaceId: string, uid: string) => (
  isPersonalWorkspaceId(workspaceId) ? `${PERSONAL_WORKSPACE_ID}:${uid}` : workspaceId
);

async function ensureBoardRef(ctx: AgentExecutionContext) {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const boardId = resolveBoardWorkspaceId(ctx.workspaceId, ctx.uid);
  const boardRef = adminDb.collection('boards').doc(boardId);
  const snap = await boardRef.get();
  if (!snap.exists) {
    await boardRef.set({
      workspaceId: boardId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  const columnsRef = boardRef.collection('columns');
  const columnsSnap = await columnsRef.limit(1).get();
  if (columnsSnap.empty) {
    const batch = adminDb.batch();
    DEFAULT_BOARD_COLUMNS.forEach((name, index) => {
      const ref = columnsRef.doc();
      batch.set(ref, {
        name,
        order: (index + 1) * 1000,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
  }

  return boardRef;
}

async function loadBoardState(ctx: AgentExecutionContext) {
  const boardRef = await ensureBoardRef(ctx);
  const [columnsSnap, cardsSnap] = await Promise.all([
    boardRef.collection('columns').orderBy('order').get(),
    boardRef.collection('cards').orderBy('order').get()
  ]);
  const columns = columnsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as StoredBoardColumn));
  const cards = cardsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as StoredBoardCard));
  return { boardRef, columns, cards };
}

async function resolveBoardColumn(boardRef: FirebaseFirestore.DocumentReference, rawId: string): Promise<StoredBoardColumn> {
  const direct = await boardRef.collection('columns').doc(rawId).get();
  if (direct.exists) {
    return { id: direct.id, ...(direct.data() as Record<string, unknown>) } as StoredBoardColumn;
  }

  const key = normalizeLookupKey(rawId);
  const snap = await boardRef.collection('columns').orderBy('order').get();
  const columns = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as StoredBoardColumn));
  const exact = columns.filter((column) => normalizeLookupKey(String(column.name || '')) === key);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new Error(`Múltiples columnas coinciden con "${rawId}".`);
  const partial = columns.filter((column) => normalizeLookupKey(String(column.name || '')).includes(key));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) throw new Error(`Múltiples columnas coinciden parcialmente con "${rawId}".`);
  throw new Error(`Columna no encontrada: "${rawId}".`);
}

async function resolveBoardCard(boardRef: FirebaseFirestore.DocumentReference, rawId: string): Promise<StoredBoardCard> {
  const direct = await boardRef.collection('cards').doc(rawId).get();
  if (direct.exists) {
    return { id: direct.id, ...(direct.data() as Record<string, unknown>) } as StoredBoardCard;
  }

  const key = normalizeLookupKey(rawId);
  const snap = await boardRef.collection('cards').orderBy('order').get();
  const cards = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as StoredBoardCard));
  const exact = cards.filter((card) => normalizeLookupKey(String(card.title || '')) === key);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new Error(`Múltiples tarjetas coinciden con "${rawId}".`);
  const partial = cards.filter((card) => normalizeLookupKey(String(card.title || '')).includes(key));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) throw new Error(`Múltiples tarjetas coinciden parcialmente con "${rawId}".`);
  throw new Error(`Tarjeta no encontrada: "${rawId}".`);
}

async function loadSemanticState(ctx: AgentExecutionContext): Promise<SemanticWorkspaceState> {
  await ensureWorkspaceAccess(ctx.workspaceId, ctx.uid);
  const storageId = resolveSemanticDocId(ctx.workspaceId, ctx.uid);
  const snap = await adminDb.collection('workspaceSemanticStates').doc(storageId).get();
  if (!snap.exists) return EMPTY_SEMANTIC_WORKSPACE_STATE;
  return normalizeSemanticWorkspaceState(snap.data());
}

async function saveSemanticState(ctx: AgentExecutionContext, state: SemanticWorkspaceState) {
  const storageId = resolveSemanticDocId(ctx.workspaceId, ctx.uid);
  const normalized = normalizeSemanticWorkspaceState({
    ...state,
    updatedAt: Date.now()
  });
  // Strip undefined values that Firestore rejects
  const clean = JSON.parse(JSON.stringify({
    workspaceId: ctx.workspaceId,
    storageId,
    concepts: normalized.concepts,
    fragments: normalized.fragments,
    relations: normalized.relations,
    updatedAt: normalized.updatedAt,
    updatedBy: ctx.uid,
  }));
  clean.serverUpdatedAt = FieldValue.serverTimestamp();
  await adminDb.collection('workspaceSemanticStates').doc(storageId).set(clean, { merge: true });
  return normalized;
}

function resolveConcept(state: SemanticWorkspaceState, rawId: string): SemanticConceptRecord {
  const direct = state.concepts.find((concept) => concept.id === rawId);
  if (direct) return direct;
  const key = normalizeLookupKey(rawId);
  const exact = state.concepts.filter((concept) => normalizeLookupKey(concept.title) === key);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) throw new Error(`Múltiples conceptos coinciden con "${rawId}".`);
  const partial = state.concepts.filter((concept) => normalizeLookupKey(concept.title).includes(key));
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) throw new Error(`Múltiples conceptos coinciden parcialmente con "${rawId}".`);
  throw new Error(`Concepto no encontrado: "${rawId}".`);
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
  await adminDb.collection('documents').doc(doc.id).update(updateData);

  return ok(call, `Actualicé "${title}".`, {
    document: {
      id: doc.id,
      name: title,
      previousPreview: excerpt(previousSnapshot.content),
      preview: excerpt(content)
    }
  }, [{ action: 'restore_document', args: { documentId: doc.id, snapshot: previousSnapshot } }]);
}

async function renameDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  const newTitle = String(call.args.newTitle || '').trim();
  if (!documentId || !newTitle) throw new Error('documentId y newTitle son requeridos');
  const doc = await fetchDocumentForUser(documentId, ctx);
  await adminDb.collection('documents').doc(doc.id).update({
    name: newTitle,
    updatedAt: FieldValue.serverTimestamp(),
    lastUpdatedBy: ctx.uid
  });

  return ok(call, `Renombré "${doc.name || 'Sin título'}" a "${newTitle}".`, {
    document: { id: doc.id, previousName: doc.name || 'Sin título', name: newTitle }
  }, [{ action: 'rename_document', args: { documentId: doc.id, newTitle: doc.name || 'Sin título' } }]);
}

async function moveDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  const targetFolder = normalizeFolderPath(String(call.args.targetFolder || '').trim());
  if (!documentId) throw new Error('documentId es requerido');
  const doc = await fetchDocumentForUser(documentId, ctx);
  const previousFolder = normalizeFolderPath(doc.folder);
  await adminDb.collection('documents').doc(doc.id).update({
    folder: targetFolder,
    updatedAt: FieldValue.serverTimestamp(),
    lastUpdatedBy: ctx.uid
  });
  return ok(call, `Moví "${doc.name || 'Sin título'}" a "${targetFolder}".`, {
    document: {
      id: doc.id,
      name: doc.name || 'Sin título',
      previousFolder,
      folder: targetFolder
    }
  }, [{ action: 'move_document', args: { documentId: doc.id, targetFolder: previousFolder } }]);
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

  await adminDb.collection('documents').doc(doc.id).delete();
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
  let query: FirebaseFirestore.Query = adminDb.collection('snippets')
    .where('workspaceId', '==', ctx.workspaceId);
  if (isPersonalWorkspaceId(ctx.workspaceId)) {
    query = query.where('ownerId', '==', ctx.uid);
  }
  const snap = await query.limit(100).get();

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
  const snippet = await fetchSnippetForUser(snippetId, ctx);
  const ref = adminDb.collection('snippets').doc(snippet.id);
  await ref.delete();
  return ok(call, `Eliminé el snippet "${String(snippet.title || snippetId)}".`, { snippetId: snippet.id }, [{
    action: 'create_snippet',
    args: {
      title: snippet.title || 'Sin título',
      markdown: snippet.markdown || '',
      description: snippet.description || '',
      category: snippet.category || 'general'
    }
  }]);
}

async function formalizeText(call: AgentToolCall, _ctx: AgentExecutionContext) {
  const text = String(call.args.text || '').trim();
  if (!text) throw new Error('text es requerido');

  const profileRaw = typeof call.args.profile === 'string' ? call.args.profile : 'classical.propositional';
  const language = call.args.language === 'en' ? 'en' : 'es';

  try {
    const r = formalizeNLP(text, {
      profile: profileRaw as LogicProfile,
      language: language as 'es' | 'en',
      atomStyle: 'keywords',
      includeComments: true
    });

    const confidence = r.ok ? 0.85 : 0.25;
    return ok(call, 'Texto formalizado correctamente.', {
      result: {
        stCode: r.stCode || '',
        confidence,
        diagnostics: r.diagnostics || [],
        patterns: r.analysis?.detectedPatterns || [],
        atomCount: r.atoms?.size || 0,
        formulaCount: r.formulas?.length || 0
      }
    });
  } catch (err) {
    throw new Error(`Error al formalizar: ${getErrorMessage(err)}`);
  }
}

// Compound tool: formalize natural text → run ST → return unified result
async function checkLogic(call: AgentToolCall, ctx: AgentExecutionContext) {
  const text = String(call.args.text || '').trim();
  if (!text) throw new Error('text es requerido');

  // Step 1: Formalize
  const formalizeResult = await formalizeText({
    ...call,
    id: `${call.id}-formalize`,
    name: 'formalize_text'
  }, ctx);

  const stCode = String((formalizeResult.data?.result as Record<string, unknown>)?.stCode || '').trim();
  const confidence = (formalizeResult.data?.result as Record<string, unknown>)?.confidence;
  const formalizeDiags = ((formalizeResult.data?.result as Record<string, unknown>)?.diagnostics || []) as unknown[];

  if (!stCode) {
    return ok(call, 'No se pudo formalizar el texto. El motor no produjo código ST.', {
      formalization: { ok: false, stCode: '', confidence: null, diagnostics: formalizeDiags },
      execution: null
    });
  }

  // Step 2: Execute the generated ST code
  let execution: Record<string, unknown>;
  try {
    const execResult = evaluateST(stCode);
    execution = {
      ok: execResult.ok,
      stdout: execResult.stdout || '',
      stderr: execResult.stderr || '',
      diagnostics: Array.isArray(execResult.diagnostics) ? execResult.diagnostics : []
    };
  } catch (err) {
    execution = {
      ok: false,
      stdout: '',
      stderr: getErrorMessage(err),
      diagnostics: []
    };
  }

  const summary = [
    `**Texto original:** ${text}`,
    `**Código ST generado:**\n\`\`\`\n${stCode}\n\`\`\``,
    `**Confianza de formalización:** ${typeof confidence === 'number' ? `${(confidence * 100).toFixed(0)}%` : 'no reportada'}`,
    execution.ok
      ? `**Resultado:** ${String(execution.stdout || 'Ejecución exitosa sin salida.')}`
      : `**Error de ejecución:** ${String(execution.stderr || 'Error desconocido.')}`
  ].join('\n\n');

  return ok(call, summary, {
    formalization: { ok: true, stCode, confidence, diagnostics: formalizeDiags },
    execution
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

async function readSnippet(call: AgentToolCall, ctx: AgentExecutionContext) {
  const snippetId = String(call.args.snippetId || '').trim();
  if (!snippetId) throw new Error('snippetId es requerido');
  const snippet = await fetchSnippetForUser(snippetId, ctx);
  return ok(call, `Leí el snippet "${snippet.title || 'Sin título'}".`, {
    snippet: {
      id: snippet.id,
      title: snippet.title || 'Sin título',
      description: snippet.description || '',
      markdown: snippet.markdown || '',
      category: snippet.category || 'general',
      order: snippet.order || 0
    }
  });
}

async function searchSnippets(call: AgentToolCall, ctx: AgentExecutionContext) {
  const queryText = String(call.args.query || '').trim().toLowerCase();
  if (!queryText) throw new Error('query es requerido');
  const limit = clamp(typeof call.args.limit === 'number' ? call.args.limit : 10, 1, 25);
  const snippets = await listWorkspaceSnippets(ctx);
  const results = snippets
    .filter((snippet) => [snippet.title, snippet.description, snippet.category, snippet.markdown]
      .map((value) => String(value || '').toLowerCase())
      .join('\n')
      .includes(queryText))
    .slice(0, limit)
    .map((snippet) => ({
      id: snippet.id,
      title: snippet.title || 'Sin título',
      description: snippet.description || '',
      category: snippet.category || 'general',
      preview: excerpt(snippet.markdown || '', 180)
    }));
  return ok(call, `La búsqueda devolvió ${results.length} snippet(s).`, { results });
}

async function updateSnippet(call: AgentToolCall, ctx: AgentExecutionContext) {
  const snippetId = String(call.args.snippetId || '').trim();
  if (!snippetId) throw new Error('snippetId es requerido');
  const snippet = await fetchSnippetForUser(snippetId, ctx);
  const previous = {
    title: snippet.title || 'Sin título',
    description: snippet.description || '',
    markdown: snippet.markdown || '',
    category: snippet.category || 'general',
    order: snippet.order || 0,
    workspaceId: snippet.workspaceId || ctx.workspaceId,
    ownerId: snippet.ownerId || ctx.uid
  };
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof call.args.title === 'string') updates.title = call.args.title.trim() || previous.title;
  if (typeof call.args.description === 'string') updates.description = call.args.description.trim();
  if (typeof call.args.markdown === 'string') updates.markdown = call.args.markdown;
  if (typeof call.args.category === 'string') updates.category = call.args.category.trim() || previous.category;
  if (typeof call.args.order === 'number') updates.order = call.args.order;
  if (Object.keys(updates).length === 1) throw new Error('No hay cambios para aplicar al snippet');
  await adminDb.collection('snippets').doc(snippet.id).update(updates);
  return ok(call, `Actualicé el snippet "${updates.title || previous.title}".`, {
    snippet: { id: snippet.id, ...previous, ...updates }
  }, [{ action: 'update_snippet', args: { snippetId: snippet.id, ...previous } }]);
}

async function getBoard(call: AgentToolCall, ctx: AgentExecutionContext) {
  const { boardRef, columns, cards } = await loadBoardState(ctx);
  return ok(call, `Recuperé el tablero con ${columns.length} columna(s) y ${cards.length} tarjeta(s).`, {
    board: {
      id: boardRef.id,
      columns: columns.map((column) => ({ id: column.id, name: column.name || 'Sin título', order: column.order || 0 })),
      cards: cards.map((card) => ({
        id: card.id,
        title: card.title || 'Sin título',
        description: card.description || '',
        columnId: card.columnId || '',
        order: card.order || 0,
        ownerId: card.ownerId || null,
        sourceDocId: card.sourceDocId || null,
        sourceDocName: card.sourceDocName || null,
        sourceFragment: card.sourceFragment || null,
        sourcePath: card.sourcePath || null
      }))
    }
  });
}

async function createBoardColumn(call: AgentToolCall, ctx: AgentExecutionContext) {
  const name = String(call.args.name || '').trim();
  if (!name) throw new Error('name es requerido');
  const { boardRef, columns } = await loadBoardState(ctx);
  const order = typeof call.args.order === 'number'
    ? call.args.order
    : (columns.reduce((max, column) => Math.max(max, column.order || 0), 0) + 1000);
  const ref = boardRef.collection('columns').doc();
  await ref.set({
    name,
    order,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return ok(call, `Creé la columna "${name}".`, {
    column: { id: ref.id, name, order }
  }, [{ action: 'delete_board_column', args: { columnId: ref.id, confirmed: true } }]);
}

async function renameBoardColumn(call: AgentToolCall, ctx: AgentExecutionContext) {
  const columnId = String(call.args.columnId || '').trim();
  const name = String(call.args.name || '').trim();
  if (!columnId || !name) throw new Error('columnId y name son requeridos');
  const boardRef = await ensureBoardRef(ctx);
  const column = await resolveBoardColumn(boardRef, columnId);
  await boardRef.collection('columns').doc(column.id).update({ name, updatedAt: FieldValue.serverTimestamp() });
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return ok(call, `Renombré la columna "${column.name || 'Sin título'}" a "${name}".`, {
    column: { id: column.id, previousName: column.name || 'Sin título', name }
  }, [{ action: 'rename_board_column', args: { columnId: column.id, name: column.name || 'Sin título' } }]);
}

async function restoreBoardCard(call: AgentToolCall, ctx: AgentExecutionContext) {
  const snapshot = call.args.snapshot as Record<string, unknown> | undefined;
  if (!snapshot) throw new Error('snapshot es requerido');
  const boardRef = await ensureBoardRef(ctx);
  const explicitId = typeof call.args.cardId === 'string' ? call.args.cardId : boardRef.collection('cards').doc().id;
  await boardRef.collection('cards').doc(explicitId).set({
    title: snapshot.title || 'Sin título',
    description: snapshot.description || '',
    columnId: snapshot.columnId || '',
    order: snapshot.order || Date.now(),
    ownerId: snapshot.ownerId || ctx.uid,
    sourceDocId: snapshot.sourceDocId || null,
    sourceDocName: snapshot.sourceDocName || null,
    sourceFragment: snapshot.sourceFragment || null,
    sourcePath: snapshot.sourcePath || null,
    updatedAt: FieldValue.serverTimestamp(),
    restoredBy: ctx.uid
  }, { merge: true });
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return ok(call, `Restauré la tarjeta "${String(snapshot.title || explicitId)}".`, { cardId: explicitId });
}

async function restoreBoardColumn(call: AgentToolCall, ctx: AgentExecutionContext) {
  const snapshot = call.args.snapshot as Record<string, unknown> | undefined;
  if (!snapshot) throw new Error('snapshot es requerido');
  const boardRef = await ensureBoardRef(ctx);
  const explicitId = typeof call.args.columnId === 'string' ? call.args.columnId : boardRef.collection('columns').doc().id;
  await boardRef.collection('columns').doc(explicitId).set({
    name: snapshot.name || 'Sin título',
    order: snapshot.order || 1000,
    updatedAt: FieldValue.serverTimestamp(),
    restoredBy: ctx.uid
  }, { merge: true });
  const cards = Array.isArray(snapshot.cards) ? snapshot.cards as Array<Record<string, unknown>> : [];
  for (const card of cards) {
    const cardId = typeof card.id === 'string' ? card.id : boardRef.collection('cards').doc().id;
    await boardRef.collection('cards').doc(cardId).set({
      title: card.title || 'Sin título',
      description: card.description || '',
      columnId: explicitId,
      order: card.order || Date.now(),
      ownerId: card.ownerId || ctx.uid,
      sourceDocId: card.sourceDocId || null,
      sourceDocName: card.sourceDocName || null,
      sourceFragment: card.sourceFragment || null,
      sourcePath: card.sourcePath || null,
      updatedAt: FieldValue.serverTimestamp(),
      restoredBy: ctx.uid
    }, { merge: true });
  }
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return ok(call, `Restauré la columna "${String(snapshot.name || explicitId)}" con ${cards.length} tarjeta(s).`, { columnId: explicitId });
}

async function deleteBoardColumn(call: AgentToolCall, ctx: AgentExecutionContext) {
  const columnId = String(call.args.columnId || '').trim();
  const confirmed = call.args.confirmed === true;
  if (!columnId) throw new Error('columnId es requerido');
  const boardRef = await ensureBoardRef(ctx);
  const column = await resolveBoardColumn(boardRef, columnId);
  const cardsSnap = await boardRef.collection('cards').where('columnId', '==', column.id).get();
  const cards = cardsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
  if (!confirmed) {
    return confirm(call, `¿Confirmas eliminar la columna "${column.name || 'Sin título'}" y ${cards.length} tarjeta(s)?`, {
      column: { id: column.id, name: column.name || 'Sin título', cardsCount: cards.length }
    });
  }
  const batch = adminDb.batch();
  batch.delete(boardRef.collection('columns').doc(column.id));
  cardsSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return ok(call, `Eliminé la columna "${column.name || 'Sin título'}" y ${cards.length} tarjeta(s).`, {
    column: { id: column.id, name: column.name || 'Sin título', cardsCount: cards.length }
  }, [{ action: 'restore_board_column', args: { columnId: column.id, snapshot: { name: column.name || 'Sin título', order: column.order || 0, cards } } }]);
}

async function createBoardCard(call: AgentToolCall, ctx: AgentExecutionContext) {
  const columnId = String(call.args.columnId || '').trim();
  const title = String(call.args.title || '').trim();
  if (!columnId || !title) throw new Error('columnId y title son requeridos');
  const boardRef = await ensureBoardRef(ctx);
  const column = await resolveBoardColumn(boardRef, columnId);
  const cardsSnap = await boardRef.collection('cards').where('columnId', '==', column.id).get();
  const order = cardsSnap.docs.reduce((max, doc) => Math.max(max, Number(doc.data().order || 0)), 0) + 1000;
  const ref = boardRef.collection('cards').doc();
  await ref.set({
    title,
    description: typeof call.args.description === 'string' ? call.args.description : '',
    columnId: column.id,
    order,
    ownerId: ctx.uid,
    sourceDocId: typeof call.args.sourceDocId === 'string' ? call.args.sourceDocId : null,
    sourceDocName: typeof call.args.sourceDocName === 'string' ? call.args.sourceDocName : null,
    sourceFragment: typeof call.args.sourceFragment === 'string' ? call.args.sourceFragment : null,
    sourcePath: typeof call.args.sourcePath === 'string' ? call.args.sourcePath : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return ok(call, `Creé la tarjeta "${title}" en "${column.name || 'Sin título'}".`, {
    card: { id: ref.id, title, columnId: column.id, columnName: column.name || 'Sin título', order }
  }, [{ action: 'delete_board_card', args: { cardId: ref.id, confirmed: true } }]);
}

async function updateBoardCard(call: AgentToolCall, ctx: AgentExecutionContext) {
  const cardId = String(call.args.cardId || '').trim();
  if (!cardId) throw new Error('cardId es requerido');
  const boardRef = await ensureBoardRef(ctx);
  const card = await resolveBoardCard(boardRef, cardId);
  const previous = {
    title: card.title || 'Sin título',
    description: card.description || '',
    columnId: card.columnId || '',
    order: card.order || 0,
    ownerId: card.ownerId || ctx.uid,
    sourceDocId: card.sourceDocId || null,
    sourceDocName: card.sourceDocName || null,
    sourceFragment: card.sourceFragment || null,
    sourcePath: card.sourcePath || null
  };
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof call.args.title === 'string') updates.title = call.args.title.trim() || previous.title;
  if (typeof call.args.description === 'string') updates.description = call.args.description;
  if (typeof call.args.order === 'number') updates.order = call.args.order;
  if (typeof call.args.columnId === 'string' && call.args.columnId.trim()) {
    const column = await resolveBoardColumn(boardRef, call.args.columnId.trim());
    updates.columnId = column.id;
  }
  if (Object.keys(updates).length === 1) throw new Error('No hay cambios para aplicar a la tarjeta');
  await boardRef.collection('cards').doc(card.id).update(updates);
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return ok(call, `Actualicé la tarjeta "${updates.title || previous.title}".`, {
    card: { id: card.id, ...previous, ...updates }
  }, [{ action: 'update_board_card', args: { cardId: card.id, ...previous } }]);
}

async function moveBoardCard(call: AgentToolCall, ctx: AgentExecutionContext) {
  const cardId = String(call.args.cardId || '').trim();
  const targetColumnId = String(call.args.targetColumnId || '').trim();
  if (!cardId || !targetColumnId) throw new Error('cardId y targetColumnId son requeridos');
  const boardRef = await ensureBoardRef(ctx);
  const card = await resolveBoardCard(boardRef, cardId);
  const targetColumn = await resolveBoardColumn(boardRef, targetColumnId);
  const cardsSnap = await boardRef.collection('cards').where('columnId', '==', targetColumn.id).get();
  const order = typeof call.args.order === 'number'
    ? call.args.order
    : cardsSnap.docs.reduce((max, doc) => Math.max(max, Number(doc.data().order || 0)), 0) + 1000;
  await boardRef.collection('cards').doc(card.id).update({
    columnId: targetColumn.id,
    order,
    updatedAt: FieldValue.serverTimestamp()
  });
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return ok(call, `Moví la tarjeta "${card.title || 'Sin título'}" a "${targetColumn.name || 'Sin título'}".`, {
    card: {
      id: card.id,
      title: card.title || 'Sin título',
      previousColumnId: card.columnId || '',
      columnId: targetColumn.id,
      columnName: targetColumn.name || 'Sin título',
      order
    }
  }, [{ action: 'update_board_card', args: { cardId: card.id, columnId: card.columnId || '', order: card.order || 0 } }]);
}

async function deleteBoardCard(call: AgentToolCall, ctx: AgentExecutionContext) {
  const cardId = String(call.args.cardId || '').trim();
  const confirmed = call.args.confirmed === true;
  if (!cardId) throw new Error('cardId es requerido');
  const boardRef = await ensureBoardRef(ctx);
  const card = await resolveBoardCard(boardRef, cardId);
  if (!confirmed) {
    return confirm(call, `¿Confirmas eliminar la tarjeta "${card.title || 'Sin título'}"?`, {
      card: { id: card.id, title: card.title || 'Sin título', columnId: card.columnId || '' }
    });
  }
  const snapshot = {
    title: card.title || 'Sin título',
    description: card.description || '',
    columnId: card.columnId || '',
    order: card.order || 0,
    ownerId: card.ownerId || ctx.uid,
    sourceDocId: card.sourceDocId || null,
    sourceDocName: card.sourceDocName || null,
    sourceFragment: card.sourceFragment || null,
    sourcePath: card.sourcePath || null
  };
  await boardRef.collection('cards').doc(card.id).delete();
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return ok(call, `Eliminé la tarjeta "${card.title || 'Sin título'}".`, {
    card: { id: card.id, title: card.title || 'Sin título' }
  }, [{ action: 'restore_board_card', args: { cardId: card.id, snapshot } }]);
}

async function listStProfilesTool(call: AgentToolCall) {
  const profiles = listProfiles();
  return ok(call, `Hay ${profiles.length} perfil(es) ST disponibles.`, { profiles });
}

async function validateStSyntax(call: AgentToolCall) {
  const program = String(call.args.program || call.args.code || '').trim();
  if (!program) throw new Error('program (o code) es requerido');
  const result = checkST(program);
  const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  return ok(call, errors ? `El programa ST tiene ${errors} error(es).` : 'El programa ST no tiene errores de sintaxis.', {
    diagnostics,
    errors,
    warnings: diagnostics.filter((item) => item.severity === 'warning').length
  });
}

async function runStProgram(call: AgentToolCall) {
  const program = String(call.args.program || call.args.code || '').trim();
  if (!program) throw new Error('program (o code) es requerido');
  const result = evaluateST(program);
  return ok(call, result.ok ? 'Programa ST ejecutado correctamente.' : 'La ejecución ST produjo errores.', {
    result: {
      ok: result.ok,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics : []
    }
  });
}

async function renderStGlossary(call: AgentToolCall) {
  const program = String(call.args.program || call.args.code || '').trim();
  if (!program) throw new Error('program (o code) es requerido');
  const format = call.args.format === 'markdown' ? 'markdown' : 'plain';
  const interpreter = createInterpreter();
  const bootstrap = interpreter.exec(program);
  if (!bootstrap.ok) {
    return ok(call, 'El programa base ST tiene errores y no se pudo renderizar el glosario.', {
      result: {
        ok: bootstrap.ok,
        stdout: bootstrap.stdout || '',
        stderr: bootstrap.stderr || '',
        diagnostics: Array.isArray(bootstrap.diagnostics) ? bootstrap.diagnostics : []
      }
    });
  }
  const glossaryCommand = format === 'markdown' ? 'render glossary as markdown' : 'glossary';
  const result = interpreter.exec(glossaryCommand);
  return ok(call, 'Glosario ST generado correctamente.', {
    result: {
      ok: result.ok,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics : []
    }
  });
}

async function explainFormalization(call: AgentToolCall, ctx: AgentExecutionContext) {
  const formalized = await formalizeText({
    ...call,
    id: `${call.id}-formalize`,
    name: 'formalize_text'
  }, ctx);
  const payload = formalized.data?.result as Record<string, unknown> | undefined;
  const stCode = String(payload?.stCode || '');
  const confidence = typeof payload?.confidence === 'number' ? payload.confidence : null;
  const profile = typeof call.args.profile === 'string' ? call.args.profile : 'classical.propositional';
  const explanation = [
    `Perfil lógico sugerido: ${profile}.`,
    'El texto se convirtió a ST para poder validarlo y reutilizarlo en el runtime.',
    stCode ? `Se obtuvo un bloque ST reutilizable de ${stCode.split(/\r?\n/).length} línea(s).` : 'No se obtuvo código ST.',
    confidence !== null ? `Confianza estimada: ${(confidence * 100).toFixed(0)}%.` : 'La confianza no fue reportada por el motor.',
    'Conviene revisar diagnósticos y, si hace falta, ejecutar el programa con run_st_program.'
  ].join(' ');
  return ok(call, 'Expliqué la formalización solicitada.', {
    explanation,
    result: payload || null
  });
}

async function listConcepts(call: AgentToolCall, ctx: AgentExecutionContext) {
  const state = await loadSemanticState(ctx);
  const queryText = typeof call.args.query === 'string' ? call.args.query.trim().toLowerCase() : '';
  const limit = clamp(typeof call.args.limit === 'number' ? call.args.limit : 25, 1, 50);
  const concepts = state.concepts
    .filter((concept) => !queryText || [concept.title, concept.definition, concept.formula, concept.logicProfile]
      .map((value) => String(value || '').toLowerCase())
      .join('\n')
      .includes(queryText))
    .slice(0, limit)
    .map((concept) => ({
      id: concept.id,
      title: concept.title,
      definition: concept.definition || '',
      formula: concept.formula || '',
      logicProfile: concept.logicProfile || null,
      status: concept.status || 'draft',
      updatedAt: concept.updatedAt
    }));
  return ok(call, `Encontré ${concepts.length} concepto(s).`, { concepts });
}

async function defineConcept(call: AgentToolCall, ctx: AgentExecutionContext) {
  const title = String(call.args.title || '').trim();
  if (!title) throw new Error('title es requerido');
  const state = await loadSemanticState(ctx);
  const existing = state.concepts.find((concept) => normalizeLookupKey(concept.title) === normalizeLookupKey(title));
  const now = Date.now();
  const excerpt = typeof call.args.excerpt === 'string' && call.args.excerpt.trim()
    ? call.args.excerpt.trim()
    : (typeof call.args.definition === 'string' ? call.args.definition.trim() : title);
  const fragmentId = existing?.sourceFragmentId || `semantic-fragment-${now}-${Math.random().toString(36).slice(2, 7)}`;
  const docId = typeof call.args.docId === 'string' ? call.args.docId : null;
  const docName = typeof call.args.docName === 'string' && call.args.docName.trim() ? call.args.docName.trim() : 'Agora AI';

  if (!state.fragments.some((fragment) => fragment.id === fragmentId)) {
    state.fragments.unshift({
      id: fragmentId,
      kind: 'concept',
      entityKind: typeof call.args.formula === 'string' ? 'claim' : typeof call.args.definition === 'string' ? 'definition' : 'concept',
      text: excerpt,
      excerpt: excerpt.slice(0, 160),
      docId,
      docName,
      workspaceId: ctx.workspaceId,
      createdAt: now,
      updatedAt: now,
      selectionHash: `${title}:${now}`,
      origin: 'llm',
      scope: 'workspace',
      status: typeof call.args.definition === 'string' ? 'validated' : 'draft',
      sourceRefs: [{ docId, docName, excerpt: excerpt.slice(0, 160) }]
    });
  }

  if (existing) {
    existing.title = title;
    if (typeof call.args.definition === 'string') existing.definition = call.args.definition.trim();
    if (typeof call.args.formula === 'string') existing.formula = call.args.formula.trim();
    if (typeof call.args.logicProfile === 'string') existing.logicProfile = call.args.logicProfile.trim();
    existing.updatedAt = now;
    existing.origin = 'llm';
    existing.scope = 'workspace';
    existing.status = typeof call.args.definition === 'string' ? 'validated' : existing.status;
    existing.docId = docId;
    existing.docName = docName;
  } else {
    state.concepts.unshift({
      id: `semantic-concept-${now}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      entityKind: typeof call.args.formula === 'string' ? 'claim' : typeof call.args.definition === 'string' ? 'definition' : 'concept',
      definition: typeof call.args.definition === 'string' ? call.args.definition.trim() : undefined,
      formula: typeof call.args.formula === 'string' ? call.args.formula.trim() : undefined,
      logicProfile: typeof call.args.logicProfile === 'string' ? call.args.logicProfile.trim() : undefined,
      excerpt: excerpt.slice(0, 160),
      docId,
      docName,
      workspaceId: ctx.workspaceId,
      createdAt: now,
      updatedAt: now,
      sourceFragmentId: fragmentId,
      origin: 'llm',
      scope: 'workspace',
      status: typeof call.args.definition === 'string' ? 'validated' : 'draft',
      sourceRefs: [{ docId, docName, excerpt: excerpt.slice(0, 160) }]
    });
  }

  const saved = await saveSemanticState(ctx, state);
  const concept = saved.concepts.find((item) => normalizeLookupKey(item.title) === normalizeLookupKey(title));
  return ok(call, `Registré el concepto "${title}" en el glosario semántico.`, {
    concept: concept || null
  });
}

async function createRelation(call: AgentToolCall, ctx: AgentExecutionContext) {
  const sourceConceptId = String(call.args.sourceConceptId || '').trim();
  const targetConceptId = String(call.args.targetConceptId || '').trim();
  const relationType = (typeof call.args.relationType === 'string' ? call.args.relationType : 'supports') as SemanticRelationType;
  if (!sourceConceptId || !targetConceptId) throw new Error('sourceConceptId y targetConceptId son requeridos');
  const state = await loadSemanticState(ctx);
  const source = resolveConcept(state, sourceConceptId);
  const target = resolveConcept(state, targetConceptId);
  const now = Date.now();
  const fragmentId = `semantic-relation-fragment-${now}-${Math.random().toString(36).slice(2, 7)}`;
  state.fragments.unshift({
    id: fragmentId,
    kind: 'relation',
    entityKind: 'passage',
    text: `${source.title} ${relationType} ${target.title}`,
    excerpt: `${source.title} ${relationType} ${target.title}`,
    docId: source.docId || target.docId || null,
    docName: source.docName || target.docName || 'Agora AI',
    workspaceId: ctx.workspaceId,
    createdAt: now,
    updatedAt: now,
    selectionHash: `${source.id}:${target.id}:${relationType}`,
    conceptId: target.id,
    conceptTitle: target.title,
    origin: 'llm',
    scope: 'workspace',
    status: 'draft',
    sourceRefs: [{ docId: source.docId || null, docName: source.docName || null, excerpt: `${source.title} → ${target.title}` }]
  });
  const relation: SemanticRelationRecord = {
    id: `semantic-relation-${now}-${Math.random().toString(36).slice(2, 7)}`,
    fragmentId,
    conceptId: target.id,
    conceptTitle: target.title,
    relationType,
    createdAt: now,
    updatedAt: now,
    docId: source.docId || target.docId || null,
    origin: 'llm',
    scope: 'workspace',
    logicProfile: source.logicProfile || target.logicProfile || undefined,
    status: 'draft',
    sourceEntityId: source.id,
    targetEntityId: target.id,
    selectionHash: `${source.id}:${target.id}:${relationType}`,
    sourceRefs: [{ docId: source.docId || null, docName: source.docName || null, excerpt: `${source.title} → ${target.title}` }]
  };
  state.relations.unshift(relation);
  await saveSemanticState(ctx, state);
  return ok(call, `Registré la relación ${relationType} entre "${source.title}" y "${target.title}".`, { relation });
}

async function listGlossaryEntries(call: AgentToolCall, ctx: AgentExecutionContext) {
  return listConcepts({ ...call, name: 'list_concepts' }, ctx);
}

async function searchGlossaryEntries(call: AgentToolCall, ctx: AgentExecutionContext) {
  return listConcepts({ ...call, name: 'list_concepts' }, ctx);
}

async function summarizeDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  if (!documentId) throw new Error('documentId es requerido');
  const doc = await fetchDocumentForUser(documentId, ctx);
  const maxSentences = clamp(typeof call.args.maxSentences === 'number' ? call.args.maxSentences : 4, 1, 8);
  const { summary, headings } = summarizeMarkdown(doc.content || '', maxSentences);
  return ok(call, `Resumí "${doc.name || 'Sin título'}".`, {
    document: { id: doc.id, name: doc.name || 'Sin título' },
    summary,
    headings: headings.slice(0, 10)
  });
}

async function compareDocuments(call: AgentToolCall, ctx: AgentExecutionContext) {
  const leftDocumentId = String(call.args.leftDocumentId || '').trim();
  const rightDocumentId = String(call.args.rightDocumentId || '').trim();
  if (!leftDocumentId || !rightDocumentId) throw new Error('leftDocumentId y rightDocumentId son requeridos');
  const [left, right] = await Promise.all([
    fetchDocumentForUser(leftDocumentId, ctx),
    fetchDocumentForUser(rightDocumentId, ctx)
  ]);
  const comparison = compareMarkdownDocuments(left.content || '', right.content || '');
  return ok(call, `Comparé "${left.name || 'Documento A'}" con "${right.name || 'Documento B'}".`, {
    left: { id: left.id, name: left.name || 'Documento A' },
    right: { id: right.id, name: right.name || 'Documento B' },
    comparison
  });
}

async function analyzeDocument(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  if (!documentId) throw new Error('documentId es requerido');
  const doc = await fetchDocumentForUser(documentId, ctx);
  const analysis = analyzeMarkdown(doc.content || '');
  return ok(call, `Analicé "${doc.name || 'Sin título'}".`, {
    document: { id: doc.id, name: doc.name || 'Sin título' },
    analysis
  });
}

async function extractPendingTasks(call: AgentToolCall, ctx: AgentExecutionContext) {
  const documentId = String(call.args.documentId || '').trim();
  if (!documentId) throw new Error('documentId es requerido');
  const doc = await fetchDocumentForUser(documentId, ctx);
  const tasks = extractChecklistTasks(doc.content || '');
  const createCards = call.args.createCards === true;
  if (!createCards || tasks.length === 0) {
    return ok(call, `Extraje ${tasks.length} pendiente(s) de "${doc.name || 'Sin título'}".`, {
      document: { id: doc.id, name: doc.name || 'Sin título' },
      tasks
    });
  }

  const { boardRef, columns } = await loadBoardState(ctx);
  const targetColumn = typeof call.args.targetColumnId === 'string' && call.args.targetColumnId.trim()
    ? await resolveBoardColumn(boardRef, call.args.targetColumnId.trim())
    : (columns.find((column) => /por hacer|backlog|todo/i.test(String(column.name || ''))) || columns[0]);
  if (!targetColumn) throw new Error('No hay columnas disponibles en el tablero');

  const createdCards: Array<{ id: string; title: string }> = [];
  let maxOrder = (await boardRef.collection('cards').where('columnId', '==', targetColumn.id).get())
    .docs.reduce((max, item) => Math.max(max, Number(item.data().order || 0)), 0);
  for (const task of tasks) {
    maxOrder += 1000;
    const ref = boardRef.collection('cards').doc();
    await ref.set({
      title: task,
      description: `Pendiente extraído desde ${doc.name || 'documento'}`,
      columnId: targetColumn.id,
      order: maxOrder,
      ownerId: ctx.uid,
      sourceDocId: doc.id,
      sourceDocName: doc.name || 'Sin título',
      sourceFragment: task,
      sourcePath: normalizeFolderPath(doc.folder),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    createdCards.push({ id: ref.id, title: task });
  }
  await boardRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  return ok(call, `Extraje ${tasks.length} pendiente(s) y creé ${createdCards.length} tarjeta(s) en "${targetColumn.name || 'Sin título'}".`, {
    document: { id: doc.id, name: doc.name || 'Sin título' },
    tasks,
    createdCards,
    targetColumn: { id: targetColumn.id, name: targetColumn.name || 'Sin título' }
  }, createdCards.map((card) => ({ action: 'delete_board_card', args: { cardId: card.id, confirmed: true } })));
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
      case 'read_snippet':
        result = await readSnippet(call, ctx);
        break;
      case 'search_snippets':
        result = await searchSnippets(call, ctx);
        break;
      case 'update_snippet':
        result = await updateSnippet(call, ctx);
        break;
      case 'delete_snippet':
        result = await deleteSnippet(call, ctx);
        break;
      case 'get_board':
        result = await getBoard(call, ctx);
        break;
      case 'create_board_column':
        result = await createBoardColumn(call, ctx);
        break;
      case 'rename_board_column':
        result = await renameBoardColumn(call, ctx);
        break;
      case 'delete_board_column':
        result = await deleteBoardColumn(call, ctx);
        break;
      case 'create_board_card':
        result = await createBoardCard(call, ctx);
        break;
      case 'update_board_card':
        result = await updateBoardCard(call, ctx);
        break;
      case 'move_board_card':
        result = await moveBoardCard(call, ctx);
        break;
      case 'delete_board_card':
        result = await deleteBoardCard(call, ctx);
        break;
      case 'check_logic':
        result = await checkLogic(call, ctx);
        break;
      case 'formalize_text':
        result = await formalizeText(call, ctx);
        break;
      case 'list_st_profiles':
        result = await listStProfilesTool(call);
        break;
      case 'validate_st_syntax':
        result = await validateStSyntax(call);
        break;
      case 'run_st_program':
        result = await runStProgram(call);
        break;
      case 'render_st_glossary':
        result = await renderStGlossary(call);
        break;
      case 'explain_formalization':
        result = await explainFormalization(call, ctx);
        break;
      case 'list_concepts':
        result = await listConcepts(call, ctx);
        break;
      case 'define_concept':
        result = await defineConcept(call, ctx);
        break;
      case 'create_relation':
        result = await createRelation(call, ctx);
        break;
      case 'list_glossary_entries':
        result = await listGlossaryEntries(call, ctx);
        break;
      case 'search_glossary_entries':
        result = await searchGlossaryEntries(call, ctx);
        break;
      case 'summarize_document':
        result = await summarizeDocument(call, ctx);
        break;
      case 'compare_documents':
        result = await compareDocuments(call, ctx);
        break;
      case 'analyze_document':
        result = await analyzeDocument(call, ctx);
        break;
      case 'extract_pending_tasks':
        result = await extractPendingTasks(call, ctx);
        break;
      case 'restore_document':
        result = await restoreDocument(call, ctx);
        break;
      case 'restore_board_card':
        result = await restoreBoardCard(call, ctx);
        break;
      case 'restore_board_column':
        result = await restoreBoardColumn(call, ctx);
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
