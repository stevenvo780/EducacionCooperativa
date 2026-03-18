'use client';

export type SemanticFragmentKind = 'concept' | 'evidence' | 'pinned' | 'relation' | 'semantic-block';

export interface SemanticFragmentRecord {
  id: string;
  kind: SemanticFragmentKind;
  text: string;
  excerpt: string;
  docId: string | null;
  docName: string;
  workspaceId: string;
  createdAt: number;
  updatedAt: number;
  selectionHash: string;
  conceptId?: string;
  conceptTitle?: string;
  linkedDocId?: string;
  linkedDocName?: string;
}

export interface SemanticConceptRecord {
  id: string;
  title: string;
  excerpt: string;
  docId: string | null;
  docName: string;
  workspaceId: string;
  createdAt: number;
  updatedAt: number;
  sourceFragmentId: string;
}

export interface SemanticRelationRecord {
  id: string;
  fragmentId: string;
  conceptId: string;
  conceptTitle: string;
  relationType: 'related-to';
  createdAt: number;
}

export interface SemanticWorkspaceState {
  concepts: SemanticConceptRecord[];
  fragments: SemanticFragmentRecord[];
  relations: SemanticRelationRecord[];
  updatedAt: number;
}

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

const EMPTY_STATE: SemanticWorkspaceState = {
  concepts: [],
  fragments: [],
  relations: [],
  updatedAt: 0
};

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

const normalizeState = (value: unknown): SemanticWorkspaceState => {
  if (!value || typeof value !== 'object') return EMPTY_STATE;
  const raw = value as Partial<SemanticWorkspaceState>;
  return {
    concepts: Array.isArray(raw.concepts) ? raw.concepts : [],
    fragments: Array.isArray(raw.fragments) ? raw.fragments : [],
    relations: Array.isArray(raw.relations) ? raw.relations : [],
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
  };
};

export const loadSemanticWorkspaceState = (context: SemanticStoreContext): SemanticWorkspaceState => {
  if (!isBrowser()) return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(getStorageKey(context));
    if (!raw) return EMPTY_STATE;
    return normalizeState(JSON.parse(raw));
  } catch {
    return EMPTY_STATE;
  }
};

export const saveSemanticWorkspaceState = (context: SemanticStoreContext, state: SemanticWorkspaceState) => {
  if (!isBrowser()) return state;
  const nextState: SemanticWorkspaceState = {
    ...state,
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

export const registerConceptFromSelection = (context: SemanticStoreContext, payload: SemanticSelectionPayload) => updateState(context, (state) => {
  const sourceFragment = ensureFragment(state, 'concept', payload);
  const normalizedTitle = excerptFromText(payload.text, 60);
  const existing = state.concepts.find((concept) => concept.title.toLowerCase() === normalizedTitle.toLowerCase());

  if (existing) {
    existing.updatedAt = Date.now();
    existing.excerpt = excerptFromText(payload.text);
    existing.docId = payload.docId;
    existing.docName = payload.docName;
    existing.sourceFragmentId = sourceFragment.id;
    return state;
  }

  state.concepts.unshift({
    id: makeId('concept'),
    title: normalizedTitle,
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
      createdAt: Date.now()
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

export const getRecentSemanticItems = (state: SemanticWorkspaceState) => ({
  concepts: state.concepts.slice(0, 5),
  pinned: state.fragments.filter((item) => item.kind === 'pinned').slice(0, 5),
  evidence: state.fragments.filter((item) => item.kind === 'evidence').slice(0, 5),
  relations: state.relations.slice(0, 5)
});
