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
  definition?: string;
  /** Perfil lógico ST para formalización (ej. 'classical.propositional') */
  logicProfile?: string;
  /** Fórmula ST escrita por el usuario para formalizar el concepto */
  formula?: string;
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
  selectionHash?: string;
  docId?: string | null;
}

export interface SemanticWorkspaceState {
  concepts: SemanticConceptRecord[];
  fragments: SemanticFragmentRecord[];
  relations: SemanticRelationRecord[];
  updatedAt: number;
}

export const EMPTY_SEMANTIC_WORKSPACE_STATE: SemanticWorkspaceState = {
  concepts: [],
  fragments: [],
  relations: [],
  updatedAt: 0
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const sortByUpdatedAt = <T extends { updatedAt?: number; createdAt?: number }>(items: T[]) => (
  items.slice().sort((left, right) => {
    const leftUpdated = left.updatedAt ?? left.createdAt ?? 0;
    const rightUpdated = right.updatedAt ?? right.createdAt ?? 0;
    if (rightUpdated !== leftUpdated) return rightUpdated - leftUpdated;
    return 0;
  })
);

const normalizeConcept = (value: unknown): SemanticConceptRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<SemanticConceptRecord>;
  if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null;
  return {
    id: raw.id,
    title: raw.title,
    ...(typeof raw.definition === 'string' && raw.definition ? { definition: raw.definition } : {}),
    ...(typeof raw.logicProfile === 'string' && raw.logicProfile ? { logicProfile: raw.logicProfile } : {}),
    ...(typeof raw.formula === 'string' && raw.formula ? { formula: raw.formula } : {}),
    excerpt: typeof raw.excerpt === 'string' ? raw.excerpt : '',
    docId: typeof raw.docId === 'string' ? raw.docId : null,
    docName: typeof raw.docName === 'string' ? raw.docName : 'Documento',
    workspaceId: typeof raw.workspaceId === 'string' ? raw.workspaceId : '',
    createdAt: toNumber(raw.createdAt),
    updatedAt: toNumber(raw.updatedAt),
    sourceFragmentId: typeof raw.sourceFragmentId === 'string' ? raw.sourceFragmentId : ''
  };
};

const normalizeFragment = (value: unknown): SemanticFragmentRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<SemanticFragmentRecord>;
  if (typeof raw.id !== 'string' || typeof raw.kind !== 'string' || typeof raw.selectionHash !== 'string') return null;
  return {
    id: raw.id,
    kind: raw.kind as SemanticFragmentKind,
    text: typeof raw.text === 'string' ? raw.text : '',
    excerpt: typeof raw.excerpt === 'string' ? raw.excerpt : '',
    docId: typeof raw.docId === 'string' ? raw.docId : null,
    docName: typeof raw.docName === 'string' ? raw.docName : 'Documento',
    workspaceId: typeof raw.workspaceId === 'string' ? raw.workspaceId : '',
    createdAt: toNumber(raw.createdAt),
    updatedAt: toNumber(raw.updatedAt),
    selectionHash: raw.selectionHash,
    conceptId: typeof raw.conceptId === 'string' ? raw.conceptId : undefined,
    conceptTitle: typeof raw.conceptTitle === 'string' ? raw.conceptTitle : undefined,
    linkedDocId: typeof raw.linkedDocId === 'string' ? raw.linkedDocId : undefined,
    linkedDocName: typeof raw.linkedDocName === 'string' ? raw.linkedDocName : undefined
  };
};

const normalizeRelation = (value: unknown): SemanticRelationRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<SemanticRelationRecord>;
  if (typeof raw.id !== 'string' || typeof raw.conceptId !== 'string' || typeof raw.fragmentId !== 'string') return null;
  return {
    id: raw.id,
    fragmentId: raw.fragmentId,
    conceptId: raw.conceptId,
    conceptTitle: typeof raw.conceptTitle === 'string' ? raw.conceptTitle : '',
    relationType: raw.relationType === 'related-to' ? 'related-to' : 'related-to',
    createdAt: toNumber(raw.createdAt),
    selectionHash: typeof raw.selectionHash === 'string' ? raw.selectionHash : undefined,
    docId: typeof raw.docId === 'string' ? raw.docId : null
  };
};

export const normalizeSemanticWorkspaceState = (value: unknown): SemanticWorkspaceState => {
  if (!value || typeof value !== 'object') return EMPTY_SEMANTIC_WORKSPACE_STATE;
  const raw = value as Partial<SemanticWorkspaceState>;
  const concepts = Array.isArray(raw.concepts)
    ? raw.concepts.map(normalizeConcept).filter((item): item is SemanticConceptRecord => item !== null)
    : [];
  const fragments = Array.isArray(raw.fragments)
    ? raw.fragments.map(normalizeFragment).filter((item): item is SemanticFragmentRecord => item !== null)
    : [];
  const relations = Array.isArray(raw.relations)
    ? raw.relations.map(normalizeRelation).filter((item): item is SemanticRelationRecord => item !== null)
    : [];

  return {
    concepts: sortByUpdatedAt(concepts),
    fragments: sortByUpdatedAt(fragments),
    relations: relations
      .slice()
      .sort((left, right) => {
        if (right.createdAt !== left.createdAt) return right.createdAt - left.createdAt;
        return 0;
      }),
    updatedAt: toNumber(raw.updatedAt)
  };
};

const pickNewer = <T extends { updatedAt?: number; createdAt?: number }>(left: T, right: T) => {
  const leftUpdated = left.updatedAt ?? left.createdAt ?? 0;
  const rightUpdated = right.updatedAt ?? right.createdAt ?? 0;
  return rightUpdated >= leftUpdated ? { ...left, ...right } : { ...right, ...left };
};

const normalizeTitleKey = (value: string) => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
);

const getConceptKey = (concept: SemanticConceptRecord) => (
  concept.id || `title:${normalizeTitleKey(concept.title)}`
);

const getFragmentKey = (fragment: SemanticFragmentRecord) => {
  const conceptKey = fragment.conceptId || '-';
  const linkedDocKey = fragment.linkedDocId || '-';
  return `${fragment.kind}:${fragment.docId || 'sin-doc'}:${fragment.selectionHash}:${conceptKey}:${linkedDocKey}`;
};

const getRelationKey = (relation: SemanticRelationRecord) => {
  const semanticKey = relation.selectionHash
    ? `${relation.docId || 'sin-doc'}:${relation.selectionHash}:${relation.conceptId}:${relation.relationType}`
    : relation.id;
  return semanticKey;
};

export const mergeSemanticWorkspaceStates = (...states: SemanticWorkspaceState[]): SemanticWorkspaceState => {
  const concepts = new Map<string, SemanticConceptRecord>();
  const fragments = new Map<string, SemanticFragmentRecord>();
  const relations = new Map<string, SemanticRelationRecord>();
  let updatedAt = 0;

  states.forEach((state) => {
    const normalized = normalizeSemanticWorkspaceState(state);
    updatedAt = Math.max(updatedAt, normalized.updatedAt);

    normalized.concepts.forEach((concept) => {
      const key = getConceptKey(concept);
      const existing = concepts.get(key);
      concepts.set(key, existing ? pickNewer(existing, concept) : concept);
    });

    normalized.fragments.forEach((fragment) => {
      const key = getFragmentKey(fragment);
      const existing = fragments.get(key);
      fragments.set(key, existing ? pickNewer(existing, fragment) : fragment);
    });

    normalized.relations.forEach((relation) => {
      const key = getRelationKey(relation);
      const existing = relations.get(key);
      if (!existing) {
        relations.set(key, relation);
        return;
      }
      relations.set(key, existing.createdAt >= relation.createdAt ? existing : relation);
    });
  });

  return {
    concepts: sortByUpdatedAt(Array.from(concepts.values())),
    fragments: sortByUpdatedAt(Array.from(fragments.values())),
    relations: Array.from(relations.values()).sort((left, right) => right.createdAt - left.createdAt),
    updatedAt
  };
};

export const hasSemanticWorkspaceStateChanged = (left: SemanticWorkspaceState, right: SemanticWorkspaceState) => {
  return JSON.stringify(normalizeSemanticWorkspaceState(left)) !== JSON.stringify(normalizeSemanticWorkspaceState(right));
};

export const getRecentSemanticItems = (state: SemanticWorkspaceState) => {
  const normalized = normalizeSemanticWorkspaceState(state);
  return {
    concepts: normalized.concepts.slice(0, 5),
    pinned: normalized.fragments.filter((item) => item.kind === 'pinned').slice(0, 5),
    evidence: normalized.fragments.filter((item) => item.kind === 'evidence').slice(0, 5),
    relations: normalized.relations.slice(0, 5)
  };
};
