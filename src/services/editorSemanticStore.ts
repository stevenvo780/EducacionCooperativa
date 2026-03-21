'use client';

import {
  EMPTY_SEMANTIC_WORKSPACE_STATE,
  normalizeSemanticWorkspaceState,
  type SemanticConceptRecord,
  type SemanticFragmentKind,
  type SemanticFragmentRecord,
  type SemanticRelationRecord,
  type SemanticWorkspaceState
} from '@/lib/semantic/workspace-state';

export type {
  SemanticConceptRecord,
  SemanticFragmentKind,
  SemanticFragmentRecord,
  SemanticRelationRecord,
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

const makeId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const createSelectionHash = (payload: SemanticSelectionPayload) => {
  const slug = slugify(payload.text).slice(0, 48) || 'fragmento';
  return `${payload.docId || 'sin-doc'}:${slug}:${payload.text.length}`;
};

const excerptFromText = (value: string, maxLength = 140) => {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
};

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
  extra?: Partial<SemanticFragmentRecord>
) => {
  const selectionHash = createSelectionHash(payload);
  const existing = state.fragments.find((fragment) => (
    fragment.kind === kind
    && fragment.selectionHash === selectionHash
    && fragment.docId === payload.docId
  ));

  if (existing) {
    existing.updatedAt = Date.now();
    if (extra) {
      Object.assign(existing, extra);
    }
    return existing;
  }

  const fragment: SemanticFragmentRecord = {
    id: makeId('fragment'),
    kind,
    text: payload.text,
    excerpt: excerptFromText(payload.text),
    docId: payload.docId,
    docName: payload.docName,
    workspaceId: payload.workspaceId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    selectionHash,
    ...extra
  };
  state.fragments.unshift(fragment);
  return fragment;
};

export const registerConceptFromSelection = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  options?: { definition?: string; title?: string; logicProfile?: string; formula?: string }
) => updateState(context, (state) => {
  const sourceFragment = ensureFragment(state, 'concept', payload);
  const normalizedTitle = options?.title?.trim() || excerptFromText(payload.text, 60);
  const existing = state.concepts.find((concept) => concept.title.toLowerCase() === normalizedTitle.toLowerCase());

  if (existing) {
    existing.updatedAt = Date.now();
    existing.excerpt = excerptFromText(payload.text);
    existing.docId = payload.docId;
    existing.docName = payload.docName;
    existing.sourceFragmentId = sourceFragment.id;
    if (options?.definition) existing.definition = options.definition;
    if (options?.logicProfile) existing.logicProfile = options.logicProfile;
    if (options?.formula) existing.formula = options.formula;
    return state;
  }

  state.concepts.unshift({
    id: makeId('concept'),
    title: normalizedTitle,
    ...(options?.definition ? { definition: options.definition } : {}),
    ...(options?.logicProfile ? { logicProfile: options.logicProfile } : {}),
    ...(options?.formula ? { formula: options.formula } : {}),
    excerpt: excerptFromText(payload.text),
    docId: payload.docId,
    docName: payload.docName,
    workspaceId: payload.workspaceId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourceFragmentId: sourceFragment.id
  });

  return state;
});

export const pinSelectionFragment = (context: SemanticStoreContext, payload: SemanticSelectionPayload) => updateState(context, (state) => {
  ensureFragment(state, 'pinned', payload);
  return state;
});

export const markSelectionAsEvidence = (context: SemanticStoreContext, payload: SemanticSelectionPayload) => updateState(context, (state) => {
  ensureFragment(state, 'evidence', payload);
  return state;
});

export const captureAnalyticalFragment = (context: SemanticStoreContext, payload: SemanticSelectionPayload) => updateState(context, (state) => {
  ensureFragment(state, 'evidence', payload);
  ensureFragment(state, 'pinned', payload);
  return state;
});

export const registerSemanticBlock = (context: SemanticStoreContext, payload: SemanticSelectionPayload) => updateState(context, (state) => {
  ensureFragment(state, 'semantic-block', payload);
  return state;
});

export const relateSelectionToConcept = (
  context: SemanticStoreContext,
  payload: SemanticSelectionPayload,
  conceptId: string
) => updateState(context, (state) => {
  const concept = state.concepts.find((item) => item.id === conceptId);
  if (!concept) return state;

  const fragment = ensureFragment(state, 'relation', payload, {
    conceptId: concept.id,
    conceptTitle: concept.title
  });

  const relationExists = state.relations.some((relation) => relation.fragmentId === fragment.id && relation.conceptId === concept.id);
  if (!relationExists) {
    state.relations.unshift({
      id: makeId('relation'),
      fragmentId: fragment.id,
      conceptId: concept.id,
      conceptTitle: concept.title,
      relationType: 'related-to',
      createdAt: Date.now(),
      selectionHash: fragment.selectionHash,
      docId: payload.docId
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
    linkedDocId,
    linkedDocName
  });
  return state;
});

/* ── Delete / Edit operations ── */

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
  updates: { title?: string; definition?: string; formula?: string; logicProfile?: string }
) => updateState(context, (state) => {
  const concept = state.concepts.find(c => c.id === conceptId);
  if (!concept) return state;
  if (updates.title !== undefined) concept.title = updates.title;
  if (updates.definition !== undefined) concept.definition = updates.definition;
  if (updates.formula !== undefined) concept.formula = updates.formula;
  if (updates.logicProfile !== undefined) concept.logicProfile = updates.logicProfile;
  concept.updatedAt = Date.now();
  return state;
});

export const updateFragment = (
  context: SemanticStoreContext,
  fragmentId: string,
  updates: { text?: string }
) => updateState(context, (state) => {
  const fragment = state.fragments.find(f => f.id === fragmentId);
  if (!fragment) return state;
  if (updates.text !== undefined) {
    fragment.text = updates.text;
    fragment.excerpt = updates.text.replace(/\s+/g, ' ').trim().slice(0, 139);
  }
  fragment.updatedAt = Date.now();
  return state;
});
