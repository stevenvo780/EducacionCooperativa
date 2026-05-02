'use client';

import {
  EMPTY_SEMANTIC_WORKSPACE_STATE,
  normalizeSemanticWorkspaceState,
  type SemanticConceptRecord,
  type SemanticEntityKind,
  type SemanticFragmentKind,
  type SemanticFragmentRecord,
  type SemanticNodeOrigin,
  type SemanticRelationRecord,
  type SemanticRelationType,
  type SemanticScope,
  type SemanticStatus,
  type SemanticWorkspacePreferences,
  type SemanticWorkspaceState
} from '@/lib/semantic/workspace-state';
import { createStableSemanticId } from '@/lib/semantic/ids';

export type {
  SemanticConceptRecord,
  SemanticEntityKind,
  SemanticFragmentKind,
  SemanticFragmentRecord,
  SemanticNodeOrigin,
  SemanticRelationRecord,
  SemanticRelationType,
  SemanticScope,
  SemanticStatus,
  SemanticWorkspacePreferences,
  SemanticWorkspaceState
} from '@/lib/semantic/workspace-state';
export { getRecentSemanticItems } from '@/lib/semantic/workspace-state';

export interface SemanticStoreContext {
  workspaceId: string;
  userId?: string | null;
}

export interface SemanticSelectionPayload {
  text: string;
  docId: string | null;
  docName: string;
  workspaceId: string;
}

export interface SemanticDocumentReference {
  docBlockId?: string;
}

interface SemanticMutationOptions {
  entityKind?: SemanticEntityKind;
  origin?: SemanticNodeOrigin;
  scope?: SemanticScope;
  logicProfile?: string;
  confidence?: number;
  status?: SemanticStatus;
}

interface RegisterConceptOptions extends SemanticMutationOptions {
  definition?: string;
  title?: string;
  formula?: string;
}

const getStorageKey = ({ workspaceId, userId }: SemanticStoreContext) => (
  `editor-semantic:${workspaceId}:${userId || 'anon'}`
);

const isBrowser = () => typeof window !== 'undefined';

const slugify = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
);

export const createSelectionHash = (payload: SemanticSelectionPayload) => {
  const slug = slugify(payload.text).slice(0, 48) || 'fragmento';
  return `${payload.docId || 'sin-doc'}:${slug}:${payload.text.length}`;
};

const excerptFromText = (value: string, maxLength = 140) => {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
};

const sanitizeNote = (value: string) => value.replace(/\r\n?/g, '\n').trim();

const clampConfidence = (value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value));
};

const defaultStatusForEntity = (entityKind: SemanticEntityKind, fallback: SemanticStatus = 'draft'): SemanticStatus => {
  if (entityKind === 'evidence' || entityKind === 'source' || entityKind === 'definition') return 'validated';
  return fallback;
};

const buildSourceRefs = (payload: SemanticSelectionPayload) => [{
  docId: payload.docId,
  docName: payload.docName,
  excerpt: excerptFromText(payload.text)
}];

export const loadSemanticWorkspaceState = (context: SemanticStoreContext): SemanticWorkspaceState => {
  if (!isBrowser()) return EMPTY_SEMANTIC_WORKSPACE_STATE;
  try {
    const raw = window.localStorage.getItem(getStorageKey(context));
    if (!raw) return EMPTY_SEMANTIC_WORKSPACE_STATE;
    return normalizeSemanticWorkspaceState(JSON.parse(raw));
  } catch {
    return EMPTY_SEMANTIC_WORKSPACE_STATE;
  }
};

export const saveSemanticWorkspaceState = (context: SemanticStoreContext, state: SemanticWorkspaceState) => {
  if (!isBrowser()) return state;
  const nextState: SemanticWorkspaceState = {
    ...normalizeSemanticWorkspaceState(state),
    updatedAt: Date.now()
  };
  window.localStorage.setItem(getStorageKey(context), JSON.stringify(nextState));
  return nextState;
};

const updateState = (
  context: SemanticStoreContext,
  updater: (state: SemanticWorkspaceState) => SemanticWorkspaceState
) => {
  const current = loadSemanticWorkspaceState(context);
  return saveSemanticWorkspaceState(context, updater(current));
};

const ensureFragment = (
  state: SemanticWorkspaceState,
  kind: SemanticFragmentKind,
  payload: SemanticSelectionPayload,
  extra?: Partial<SemanticFragmentRecord> & SemanticMutationOptions
) => {
  const selectionHash = createSelectionHash(payload);
  const stableKey = createStableSemanticId(
    'fragment',
    payload.workspaceId,
    payload.docId || payload.docName,
    kind,
    selectionHash,
    extra?.conceptId,
    extra?.linkedDocId,
    extra?.docBlockId
  );

  const existing = state.fragments.find((fragment) => (
    fragment.stableKey === stableKey
    || (
      fragment.kind === kind
      && fragment.selectionHash === selectionHash
      && fragment.docId === payload.docId
      && fragment.conceptId === extra?.conceptId
    )
  ));

  const entityKind = extra?.entityKind || (
    kind === 'evidence'
      ? 'evidence'
      : kind === 'source'
        ? 'source'
        : kind === 'passage' || kind === 'semantic-block' || kind === 'note' || kind === 'pinned' || kind === 'relation'
          ? 'passage'
          : 'concept'
  );
  const origin = extra?.origin || 'semantic-ui';
  const scope = extra?.scope || 'document';
  const confidence = clampConfidence(extra?.confidence);
  const status = extra?.status || defaultStatusForEntity(entityKind);

  if (existing) {
    existing.updatedAt = Date.now();
    existing.entityKind = entityKind;
    existing.origin = origin;
    existing.scope = scope;
    existing.status = status;
    existing.stableKey = stableKey;
    existing.sourceRefs = buildSourceRefs(payload);
    if (confidence !== undefined) existing.confidence = confidence;
    if (extra) {
      Object.assign(existing, extra);
    }
    return existing;
  }

  const fragment: SemanticFragmentRecord = {
    id: createStableSemanticId('fragment', payload.workspaceId, payload.docId || payload.docName, kind, selectionHash, extra?.conceptId, extra?.linkedDocId, extra?.docBlockId),
    kind,
    entityKind,
    text: payload.text,
    excerpt: excerptFromText(payload.text),
    docId: payload.docId,
    docName: payload.docName,
    workspaceId: payload.workspaceId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    selectionHash,
    origin,
    scope,
    status,
    stableKey,
    sourceRefs: buildSourceRefs(payload),
    ...(confidence !== undefined ? { confidence } : {}),
    ...extra
  };
  state.fragments.unshift(fragment);
  return fragment;
};

export const registerConceptFromSelection = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  options?: RegisterConceptOptions
) => updateState(context, (state) => {
  const sourceFragment = ensureFragment(state, 'concept', payload, options);
  const normalizedTitle = options?.title?.trim() || excerptFromText(payload.text, 60);
  const entityKind = options?.entityKind || (options?.formula ? 'claim' : options?.definition ? 'definition' : 'concept');
  const scope = options?.scope || 'document';
  const origin = options?.origin || 'semantic-ui';
  const confidence = clampConfidence(options?.confidence);
  const stableKey = createStableSemanticId(
    'concept',
    payload.workspaceId,
    scope === 'workspace' ? 'workspace' : payload.docId || payload.docName,
    normalizedTitle,
    sourceFragment.selectionHash
  );

  const existing = state.concepts.find((concept) => (
    concept.stableKey === stableKey
    || concept.id === stableKey
    || concept.sourceFragmentId === sourceFragment.id
  ));

  if (existing) {
    existing.updatedAt = Date.now();
    existing.title = normalizedTitle;
    existing.entityKind = entityKind;
    existing.excerpt = excerptFromText(payload.text);
    existing.docId = payload.docId;
    existing.docName = payload.docName;
    existing.sourceFragmentId = sourceFragment.id;
    existing.origin = origin;
    existing.scope = scope;
    existing.status = options?.status || defaultStatusForEntity(entityKind);
    existing.stableKey = stableKey;
    existing.sourceRefs = buildSourceRefs(payload);
    if (options?.definition !== undefined) existing.definition = options.definition;
    if (options?.logicProfile !== undefined) existing.logicProfile = options.logicProfile;
    if (options?.formula !== undefined) existing.formula = options.formula;
    if (confidence !== undefined) existing.confidence = confidence;
    return state;
  }

  state.concepts.unshift({
    id: stableKey,
    title: normalizedTitle,
    entityKind,
    ...(options?.definition ? { definition: options.definition } : {}),
    ...(options?.logicProfile ? { logicProfile: options.logicProfile } : {}),
    ...(options?.formula ? { formula: options.formula } : {}),
    excerpt: excerptFromText(payload.text),
    docId: payload.docId,
    docName: payload.docName,
    workspaceId: payload.workspaceId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourceFragmentId: sourceFragment.id,
    origin,
    scope,
    status: options?.status || defaultStatusForEntity(entityKind),
    stableKey,
    sourceRefs: buildSourceRefs(payload),
    ...(confidence !== undefined ? { confidence } : {})
  });

  return state;
});

export const pinSelectionFragment = (context: SemanticStoreContext, payload: SemanticSelectionPayload) => updateState(context, (state) => {
  ensureFragment(state, 'pinned', payload, { entityKind: 'passage', status: 'draft' });
  return state;
});

export const markSelectionAsEvidence = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  options?: SemanticMutationOptions
) => updateState(context, (state) => {
  ensureFragment(state, 'evidence', payload, { entityKind: 'evidence', status: 'validated', ...options });
  return state;
});

export const saveSelectionNote = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  note: string
) => updateState(context, (state) => {
  const normalizedNote = sanitizeNote(note);
  if (!normalizedNote) return state;
  ensureFragment(state, 'note', payload, { note: normalizedNote, entityKind: 'passage', status: 'draft' });
  return state;
});

export const captureAnalyticalFragment = (context: SemanticStoreContext, payload: SemanticSelectionPayload) => updateState(context, (state) => {
  ensureFragment(state, 'evidence', payload, { entityKind: 'evidence', status: 'validated' });
  ensureFragment(state, 'pinned', payload, { entityKind: 'passage', status: 'draft' });
  return state;
});

export const captureAnalyticalFragmentWithReference = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  reference: SemanticDocumentReference
) => updateState(context, (state) => {
  ensureFragment(state, 'evidence', payload, { entityKind: 'evidence', status: 'validated', ...reference });
  ensureFragment(state, 'pinned', payload, { entityKind: 'passage', status: 'draft', ...reference });
  return state;
});

export const registerSemanticBlock = (context: SemanticStoreContext, payload: SemanticSelectionPayload) => updateState(context, (state) => {
  ensureFragment(state, 'semantic-block', payload, { entityKind: 'passage', status: 'draft' });
  return state;
});

export const registerSemanticBlockWithReference = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  reference: SemanticDocumentReference
) => updateState(context, (state) => {
  ensureFragment(state, 'semantic-block', payload, { entityKind: 'passage', status: 'draft', ...reference });
  return state;
});

export const relateSelectionToConcept = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  conceptId: string,
  relationType: SemanticRelationType = 'supports'
) => updateState(context, (state) => {
  const concept = state.concepts.find((item) => item.id === conceptId);
  if (!concept) return state;

  const fragment = ensureFragment(state, 'relation', payload, {
    entityKind: 'passage',
    conceptId: concept.id,
    conceptTitle: concept.title,
    logicProfile: concept.logicProfile,
    status: 'draft'
  });

  const stableKey = createStableSemanticId(
    'relation',
    context.workspaceId,
    payload.docId || payload.docName,
    fragment.id,
    concept.id,
    relationType
  );
  const relationExists = state.relations.some((relation) => relation.stableKey === stableKey || (
    relation.fragmentId === fragment.id
    && relation.conceptId === concept.id
    && relation.relationType === relationType
  ));
  if (!relationExists) {
    state.relations.unshift({
      id: stableKey,
      fragmentId: fragment.id,
      conceptId: concept.id,
      conceptTitle: concept.title,
      relationType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      selectionHash: fragment.selectionHash,
      docId: payload.docId,
      origin: 'semantic-ui',
      scope: concept.scope || 'document',
      logicProfile: concept.logicProfile,
      status: 'draft',
      stableKey,
      sourceEntityId: fragment.id,
      targetEntityId: concept.id,
      sourceRefs: buildSourceRefs(payload)
    });
  }

  return state;
});

export const attachLinkedDocumentToSelection = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  linkedDocId: string,
  linkedDocName: string
) => updateState(context, (state) => {
  ensureFragment(state, 'relation', payload, {
    entityKind: 'source',
    linkedDocId,
    linkedDocName,
    status: 'draft'
  });
  return state;
});

export const attachLinkedDocumentToSelectionWithReference = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  linkedDocId: string,
  linkedDocName: string,
  reference: SemanticDocumentReference
) => updateState(context, (state) => {
  ensureFragment(state, 'relation', payload, {
    entityKind: 'source',
    linkedDocId,
    linkedDocName,
    status: 'draft',
    ...reference
  });
  return state;
});

export const setSemanticWorkspacePreferences = (
  context: SemanticStoreContext,
  updates: Partial<SemanticWorkspacePreferences>
) => updateState(context, (state) => ({
  ...state,
  preferences: {
    ...state.preferences,
    ...updates
  }
}));


export const deleteConcept = (context: SemanticStoreContext, conceptId: string) => updateState(context, (state) => {
  state.concepts = state.concepts.filter(c => c.id !== conceptId);
  const relatedRelationFragmentIds = state.relations
    .filter(r => r.conceptId === conceptId)
    .map(r => r.fragmentId);
  state.relations = state.relations.filter(r => r.conceptId !== conceptId);
  state.fragments = state.fragments.filter(f => {
    if (f.conceptId === conceptId) return false;
    if (relatedRelationFragmentIds.includes(f.id) && f.kind === 'relation') return false;
    return true;
  });
  return state;
});

export const deleteFragment = (context: SemanticStoreContext, fragmentId: string) => updateState(context, (state) => {
  state.fragments = state.fragments.filter(f => f.id !== fragmentId);
  state.relations = state.relations.filter(r => r.fragmentId !== fragmentId);
  return state;
});

export const deleteFragmentsByDocBlockId = (context: SemanticStoreContext, docBlockId: string) => updateState(context, (state) => {
  const fragmentIds = new Set(
    state.fragments
      .filter((fragment) => fragment.docBlockId === docBlockId)
      .map((fragment) => fragment.id)
  );

  state.fragments = state.fragments.filter((fragment) => fragment.docBlockId !== docBlockId);
  state.relations = state.relations.filter((relation) => !fragmentIds.has(relation.fragmentId));
  return state;
});

export const deleteRelation = (context: SemanticStoreContext, relationId: string) => updateState(context, (state) => {
  const relation = state.relations.find(r => r.id === relationId);
  if (relation) {
    state.fragments = state.fragments.filter(f => !(f.id === relation.fragmentId && f.kind === 'relation'));
  }
  state.relations = state.relations.filter(r => r.id !== relationId);
  return state;
});

export const updateConcept = (
  context: SemanticStoreContext,
  conceptId: string,
  updates: {
    title?: string;
    definition?: string;
    formula?: string;
    logicProfile?: string;
    status?: SemanticStatus;
    confidence?: number;
    entityKind?: SemanticEntityKind;
  }
) => updateState(context, (state) => {
  const concept = state.concepts.find(c => c.id === conceptId);
  if (!concept) return state;
  if (updates.title !== undefined) concept.title = updates.title;
  if (updates.definition !== undefined) concept.definition = updates.definition;
  if (updates.formula !== undefined) concept.formula = updates.formula;
  if (updates.logicProfile !== undefined) concept.logicProfile = updates.logicProfile;
  if (updates.status !== undefined) concept.status = updates.status;
  if (updates.entityKind !== undefined) concept.entityKind = updates.entityKind;
  if (updates.confidence !== undefined) concept.confidence = clampConfidence(updates.confidence);
  concept.updatedAt = Date.now();
  return state;
});

export const updateFragment = (
  context: SemanticStoreContext,
  fragmentId: string,
  updates: { text?: string; note?: string; status?: SemanticStatus; confidence?: number }
) => updateState(context, (state) => {
  const fragment = state.fragments.find(f => f.id === fragmentId);
  if (!fragment) return state;
  if (updates.text !== undefined) {
    fragment.text = updates.text;
    fragment.excerpt = updates.text.replace(/\s+/g, ' ').trim().slice(0, 139);
  }
  if (updates.note !== undefined) {
    const normalizedNote = sanitizeNote(updates.note);
    if (normalizedNote) {
      fragment.note = normalizedNote;
    } else {
      delete fragment.note;
    }
  }
  if (updates.status !== undefined) fragment.status = updates.status;
  if (updates.confidence !== undefined) fragment.confidence = clampConfidence(updates.confidence);
  fragment.updatedAt = Date.now();
  return state;
});

