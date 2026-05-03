import {
  evaluate,
  parse,
  type Diagnostic as STDiagnostic,
  type Formula,
  type Program,
  type Statement
} from '@/lib/st-api';
import { formulaToString } from '@stevenvo780/st-lang';
import { canonicalizeSTFormula } from '@/lib/st-formula';
import {
  mergeSemanticWorkspaceStates,
  normalizeSemanticWorkspaceState,
  type SemanticConceptRecord,
  type SemanticDocumentRef,
  type SemanticEntityKind,
  type SemanticFragmentRecord,
  type SemanticNodeOrigin,
  type SemanticRelationRecord,
  type SemanticRelationType,
  type SemanticScope,
  type SemanticSourceRef,
  type SemanticStatus,
  type SemanticWorkspaceState
} from '@/lib/semantic/workspace-state';
import { createStableSemanticId } from '@/lib/semantic/ids';

export type TheoryGraphNodeKind =
  | 'theory'
  | 'concept'
  | 'claim'
  | 'evidence'
  | 'definition'
  | 'source'
  | 'passage';

export interface TheoryGraphNode {
  id: string;
  kind: TheoryGraphNodeKind;
  label: string;
  origin: SemanticNodeOrigin;
  scope: SemanticScope;
  logicProfile?: string;
  sourceRefs: SemanticSourceRef[];
  updatedAt: number;
  confidence?: number;
  status: SemanticStatus;
  docId?: string | null;
  docName?: string | null;
  text?: string;
  formula?: string;
  metadata?: Record<string, unknown>;
}

export interface TheoryGraphEdge {
  id: string;
  from: string;
  to: string;
  relationType: Exclude<SemanticRelationType, 'related-to'>;
  origin: SemanticNodeOrigin;
  scope: SemanticScope;
  updatedAt: number;
  logicProfile?: string;
  confidence?: number;
  status?: SemanticStatus;
  sourceRefs: SemanticSourceRef[];
  metadata?: Record<string, unknown>;
}

export interface TheoryGraphOutlineItem {
  id: string;
  label: string;
  kind: TheoryGraphNodeKind | 'command';
  line?: number | null;
  column?: number | null;
}

export type TheoryGraphDiagnosticType =
  | 'parse-error'
  | 'contradiction'
  | 'unsupported-claim'
  | 'orphan-evidence'
  | 'isolated-concept'
  | 'incompatible-profile';

export type TheoryGraphQuickFixKind =
  | 'weaken-claim'
  | 'add-condition'
  | 'mark-dialectical-tension'
  | 'link-missing-evidence';

export interface TheoryGraphQuickFix {
  id: string;
  kind: TheoryGraphQuickFixKind;
  label: string;
  description: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  metadata?: Record<string, unknown>;
}

export interface TheoryGraphDiagnostic {
  id: string;
  type: TheoryGraphDiagnosticType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  nodeIds: string[];
  edgeIds: string[];
  quickFixes: TheoryGraphQuickFix[];
  sourceRefs: SemanticSourceRef[];
}

export interface TheoryGraph {
  nodes: TheoryGraphNode[];
  edges: TheoryGraphEdge[];
  diagnostics: TheoryGraphDiagnostic[];
  outline: TheoryGraphOutlineItem[];
  profileIds: string[];
  sourceDocument?: SemanticDocumentRef;
  sourceFileName?: string;
}

const relationAlias = (relationType: SemanticRelationType): Exclude<SemanticRelationType, 'related-to'> => {
  if (relationType === 'related-to') return 'supports';
  return relationType;
};

const statementSourceRefs = (statement: { source?: { file?: string; line?: number; column?: number } }): SemanticSourceRef[] => {
  if (!statement.source) return [];
  return [{
    fileName: statement.source.file ?? null,
    line: statement.source.line ?? null,
    column: statement.source.column ?? null
  }];
};

const safeFormulaToString = (formula?: Formula) => {
  if (!formula) return undefined;
  try {
    return formulaToString(formula);
  } catch {
    return undefined;
  }
};

const addSourceRef = (
  refs: SemanticSourceRef[],
  sourceRef: SemanticSourceRef
) => {
  const key = JSON.stringify(sourceRef);
  const hasRef = refs.some((item) => JSON.stringify(item) === key);
  if (!hasRef) refs.push(sourceRef);
};

const createEmptyGraph = (options?: { sourceDocument?: SemanticDocumentRef; sourceFileName?: string }): TheoryGraph => ({
  nodes: [],
  edges: [],
  diagnostics: [],
  outline: [],
  profileIds: [],
  sourceDocument: options?.sourceDocument,
  sourceFileName: options?.sourceFileName
});

const upsertNode = (nodes: Map<string, TheoryGraphNode>, node: TheoryGraphNode) => {
  const existing = nodes.get(node.id);
  if (!existing) {
    nodes.set(node.id, node);
    return;
  }

  const merged: TheoryGraphNode = {
    ...existing,
    ...node,
    logicProfile: node.logicProfile || existing.logicProfile,
    confidence: node.confidence ?? existing.confidence,
    formula: node.formula || existing.formula,
    text: node.text || existing.text,
    status: node.status || existing.status,
    metadata: { ...(existing.metadata || {}), ...(node.metadata || {}) },
    sourceRefs: [...existing.sourceRefs]
  };

  node.sourceRefs.forEach((sourceRef) => addSourceRef(merged.sourceRefs, sourceRef));
  nodes.set(node.id, merged);
};

const upsertEdge = (edges: Map<string, TheoryGraphEdge>, edge: TheoryGraphEdge) => {
  const existing = edges.get(edge.id);
  if (!existing) {
    edges.set(edge.id, edge);
    return;
  }

  const merged: TheoryGraphEdge = {
    ...existing,
    ...edge,
    logicProfile: edge.logicProfile || existing.logicProfile,
    confidence: edge.confidence ?? existing.confidence,
    metadata: { ...(existing.metadata || {}), ...(edge.metadata || {}) },
    sourceRefs: [...existing.sourceRefs]
  };

  edge.sourceRefs.forEach((sourceRef) => addSourceRef(merged.sourceRefs, sourceRef));
  edges.set(edge.id, merged);
};

const addProfile = (profiles: Set<string>, logicProfile?: string) => {
  if (logicProfile) profiles.add(logicProfile);
};

const createDiagnosticId = (type: TheoryGraphDiagnosticType, parts: string[]) => (
  createStableSemanticId(`diag-${type}`, ...parts)
);

const graphNodeIdFromConcept = (concept: SemanticConceptRecord, kind: TheoryGraphNodeKind) => (
  createStableSemanticId(kind, concept.id, concept.docId || concept.docName, concept.title)
);

const graphNodeIdFromFragment = (fragment: SemanticFragmentRecord, kind: TheoryGraphNodeKind) => (
  createStableSemanticId(kind, fragment.id, fragment.docId || fragment.docName, fragment.selectionHash)
);

const buildSourceRefsForConcept = (concept: SemanticConceptRecord): SemanticSourceRef[] => {
  const refs = [...(concept.sourceRefs || [])];
  if (concept.docId || concept.docName) {
    addSourceRef(refs, {
      docId: concept.docId,
      docName: concept.docName,
      nodeId: concept.id
    });
  }
  return refs;
};

const buildSourceRefsForFragment = (fragment: SemanticFragmentRecord): SemanticSourceRef[] => {
  const refs = [...(fragment.sourceRefs || [])];
  addSourceRef(refs, {
    docId: fragment.docId,
    docName: fragment.docName,
    nodeId: fragment.id,
    excerpt: fragment.excerpt || fragment.text
  });
  return refs;
};

export const buildTheoryGraphFromSemanticState = (
  state: SemanticWorkspaceState,
  options?: { sourceDocument?: SemanticDocumentRef }
): TheoryGraph => {
  const normalized = normalizeSemanticWorkspaceState(state);
  const nodes = new Map<string, TheoryGraphNode>();
  const edges = new Map<string, TheoryGraphEdge>();
  const profiles = new Set<string>();
  const outline: TheoryGraphOutlineItem[] = [];
  const fragmentNodeIds = new Map<string, string>();
  const conceptNodeIds = new Map<string, { conceptId: string; claimId?: string; definitionId?: string }>();

  normalized.concepts.forEach((concept) => {
    const conceptId = graphNodeIdFromConcept(concept, concept.entityKind === 'source' ? 'source' : 'concept');
    conceptNodeIds.set(concept.id, { conceptId });
    upsertNode(nodes, {
      id: conceptId,
      kind: concept.entityKind === 'source' ? 'source' : 'concept',
      label: concept.title,
      origin: concept.origin || 'semantic-ui',
      scope: concept.scope || 'document',
      logicProfile: concept.logicProfile,
      sourceRefs: buildSourceRefsForConcept(concept),
      updatedAt: concept.updatedAt,
      confidence: concept.confidence,
      status: concept.status || 'draft',
      docId: concept.docId,
      docName: concept.docName,
      text: concept.excerpt,
      metadata: {
        ...(concept.metadata || {}),
        conceptId: concept.id
      }
    });
    addProfile(profiles, concept.logicProfile);
    outline.push({ id: conceptId, label: concept.title, kind: 'concept' });

    if (concept.definition) {
      const definitionId = graphNodeIdFromConcept(concept, 'definition');
      conceptNodeIds.get(concept.id)!.definitionId = definitionId;
      upsertNode(nodes, {
        id: definitionId,
        kind: 'definition',
        label: concept.definition,
        origin: concept.origin || 'semantic-ui',
        scope: concept.scope || 'document',
        logicProfile: concept.logicProfile,
        sourceRefs: buildSourceRefsForConcept(concept),
        updatedAt: concept.updatedAt,
        confidence: concept.confidence,
        status: concept.status || 'validated',
        docId: concept.docId,
        docName: concept.docName,
      text: concept.definition,
      metadata: {
          ...(concept.metadata || {}),
          conceptId: concept.id,
          title: concept.title
        }
      });
      upsertEdge(edges, {
        id: createStableSemanticId('edge-defines', definitionId, conceptId),
        from: definitionId,
        to: conceptId,
        relationType: 'defines',
        origin: concept.origin || 'semantic-ui',
        scope: concept.scope || 'document',
        updatedAt: concept.updatedAt,
        logicProfile: concept.logicProfile,
        confidence: concept.confidence,
        status: concept.status,
        sourceRefs: buildSourceRefsForConcept(concept)
      });
    }

    if (concept.formula) {
      const claimId = graphNodeIdFromConcept(concept, 'claim');
      conceptNodeIds.get(concept.id)!.claimId = claimId;
      upsertNode(nodes, {
        id: claimId,
        kind: 'claim',
        label: concept.title,
        origin: concept.origin || 'semantic-ui',
        scope: concept.scope || 'document',
        logicProfile: concept.logicProfile,
        sourceRefs: buildSourceRefsForConcept(concept),
        updatedAt: concept.updatedAt,
        confidence: concept.confidence,
        status: concept.status || 'draft',
        docId: concept.docId,
        docName: concept.docName,
      formula: concept.formula,
      metadata: {
          ...(concept.metadata || {}),
          conceptId: concept.id,
          definition: concept.definition
        }
      });
      upsertEdge(edges, {
        id: createStableSemanticId('edge-restates', claimId, conceptId),
        from: claimId,
        to: conceptId,
        relationType: 'restates',
        origin: concept.origin || 'semantic-ui',
        scope: concept.scope || 'document',
        updatedAt: concept.updatedAt,
        logicProfile: concept.logicProfile,
        confidence: concept.confidence,
        status: concept.status,
        sourceRefs: buildSourceRefsForConcept(concept)
      });
    }
  });

  normalized.fragments.forEach((fragment) => {
    let nodeKind: TheoryGraphNodeKind | null = null;
    if (fragment.kind === 'evidence') nodeKind = 'evidence';
    if (fragment.kind === 'note' || fragment.kind === 'pinned' || fragment.kind === 'semantic-block' || fragment.kind === 'passage') nodeKind = 'passage';
    if (fragment.kind === 'source') nodeKind = 'source';
    if (fragment.kind === 'relation') nodeKind = 'passage';
    if (!nodeKind) return;

    const nodeId = graphNodeIdFromFragment(fragment, nodeKind);
    fragmentNodeIds.set(fragment.id, nodeId);
    upsertNode(nodes, {
      id: nodeId,
      kind: nodeKind,
      label: fragment.excerpt || fragment.text.slice(0, 64),
      origin: fragment.origin || 'semantic-ui',
      scope: fragment.scope || 'document',
      logicProfile: fragment.logicProfile,
      sourceRefs: buildSourceRefsForFragment(fragment),
      updatedAt: fragment.updatedAt,
      confidence: fragment.confidence,
      status: fragment.status || (fragment.kind === 'evidence' ? 'validated' : 'draft'),
      docId: fragment.docId,
      docName: fragment.docName,
      text: fragment.text,
      metadata: {
        ...(fragment.metadata || {}),
        fragmentId: fragment.id,
        conceptId: fragment.conceptId,
        linkedDocId: fragment.linkedDocId,
        linkedDocName: fragment.linkedDocName
      }
    });
    addProfile(profiles, fragment.logicProfile);
  });

  normalized.fragments.forEach((fragment) => {
    const sourceNodeId = fragmentNodeIds.get(fragment.id);
    const target = fragment.conceptId ? conceptNodeIds.get(fragment.conceptId) : undefined;
    const targetId = target?.claimId || target?.conceptId;
    if (!sourceNodeId || !targetId) return;

    const relationType = fragment.kind === 'evidence' ? 'evidence-for' : 'supports';
    upsertEdge(edges, {
      id: createStableSemanticId('edge-fragment', fragment.id, targetId, relationType),
      from: sourceNodeId,
      to: targetId,
      relationType,
      origin: fragment.origin || 'semantic-ui',
      scope: fragment.scope || 'document',
      updatedAt: fragment.updatedAt,
      logicProfile: fragment.logicProfile,
      confidence: fragment.confidence,
      status: fragment.status,
      sourceRefs: buildSourceRefsForFragment(fragment)
    });
  });

  normalized.relations.forEach((relation) => {
    const sourceId = fragmentNodeIds.get(relation.fragmentId);
    const target = conceptNodeIds.get(relation.conceptId);
    const targetId = relation.targetEntityId || target?.claimId || target?.conceptId;
    if (!sourceId || !targetId) return;

    upsertEdge(edges, {
      id: createStableSemanticId('edge-relation', relation.id, sourceId, targetId, relation.relationType),
      from: relation.sourceEntityId || sourceId,
      to: targetId,
      relationType: relationAlias(relation.relationType),
      origin: relation.origin || 'semantic-ui',
      scope: relation.scope || 'document',
      updatedAt: relation.updatedAt ?? relation.createdAt,
      logicProfile: relation.logicProfile,
      confidence: relation.confidence,
      status: relation.status,
      sourceRefs: relation.sourceRefs || [],
      metadata: relation.metadata
    });
    addProfile(profiles, relation.logicProfile);
  });

  const graph = {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    diagnostics: [] as TheoryGraphDiagnostic[],
    outline,
    profileIds: Array.from(profiles.values()),
    sourceDocument: options?.sourceDocument
  };

  graph.diagnostics = verifyTheoryGraph(graph);
  return graph;
};

interface WalkContext {
  currentProfile?: string;
  theoryPrefix?: string;
  theoryNodeId?: string;
}

interface FormulaBinding {
  formula?: string;
  sourceNodeId?: string;
  letType: 'formula' | 'formalize';
}

const qualifySymbol = (name: string, context: WalkContext) => (
  context.theoryPrefix ? `${context.theoryPrefix}.${name}` : name
);

const registerAlias = (index: Map<string, string>, alias: string, nodeId: string) => {
  if (!alias) return;
  index.set(alias, nodeId);
  const simple = alias.split('.').pop();
  if (simple && !index.has(simple)) {
    index.set(simple, nodeId);
  }
};

const buildOutlineFromProgram = (program: Program | null): TheoryGraphOutlineItem[] => {
  if (!program) return [];
  const outline: TheoryGraphOutlineItem[] = [];

  const visitStatements = (statements: Statement[], prefix?: string) => {
    statements.forEach((statement) => {
      switch (statement.kind) {
        case 'theory_decl': {
          const label = prefix ? `${prefix}.${statement.name}` : statement.name;
          outline.push({
            id: createStableSemanticId('outline-theory', label),
            label,
            kind: 'theory',
            line: statement.source.line,
            column: statement.source.column
          });
          visitStatements(statement.members.map((member) => member.statement), label);
          break;
        }
        case 'let_decl': {
          const rawLabel = statement.name;
          outline.push({
            id: createStableSemanticId('outline', prefix || '', statement.kind, rawLabel),
            label: prefix ? `${prefix}.${rawLabel}` : rawLabel,
            kind: statement.letType === 'passage' ? 'passage' : 'definition',
            line: statement.source.line,
            column: statement.source.column
          });
          break;
        }
        case 'define_decl':
        case 'claim_decl':
        case 'source_decl':
        case 'interpret_cmd':
        case 'axiom_decl':
        case 'theorem_decl': {
          const rawLabel = 'name' in statement && typeof statement.name === 'string'
            ? statement.name
            : statement.kind === 'interpret_cmd'
              ? statement.text.slice(0, 40)
              : statement.kind;
          outline.push({
            id: createStableSemanticId('outline', prefix || '', statement.kind, rawLabel),
            label: prefix ? `${prefix}.${rawLabel}` : rawLabel,
            kind: statement.kind === 'source_decl'
              ? 'source'
              : statement.kind === 'interpret_cmd'
                ? 'passage'
                : statement.kind === 'define_decl'
                  ? 'definition'
                  : 'claim',
            line: statement.source.line,
            column: statement.source.column
          });
          break;
        }
        default:
          outline.push({
            id: createStableSemanticId('outline-command', prefix || '', statement.kind, String(statement.source.line)),
            label: prefix ? `${prefix}.${statement.kind}` : statement.kind,
            kind: 'command',
            line: statement.source.line,
            column: statement.source.column
          });
      }
    });
  };

  visitStatements(program.statements);
  return outline;
};

export const buildTheoryGraphFromSTSource = (
  source: string,
  options?: {
    docId?: string | null;
    docName?: string;
    sourceFileName?: string;
    workspaceId?: string;
  }
): TheoryGraph => {
  const parsed = parse(source, options?.sourceFileName || options?.docName || '<st>');
  const nodes = new Map<string, TheoryGraphNode>();
  const edges = new Map<string, TheoryGraphEdge>();
  const profiles = new Set<string>();
  const diagnostics: TheoryGraphDiagnostic[] = [];
  const symbolIndex = new Map<string, string>();
  const claimIds = new Map<string, string>();
  const formulaBindings = new Map<string, FormulaBinding>();

  const baseGraph = createEmptyGraph({
    sourceDocument: {
      docId: options?.docId ?? null,
      docName: options?.docName ?? options?.sourceFileName ?? null
    },
    sourceFileName: options?.sourceFileName || options?.docName
  });
  baseGraph.outline = buildOutlineFromProgram(parsed.program);

  if (!parsed.ok || !parsed.program) {
    const parseErrors = parsed.diagnostics.map((diagnostic) => stDiagnosticToTheoryGraphDiagnostic(diagnostic));
    baseGraph.diagnostics = parseErrors;
    return baseGraph;
  }

  const applyStatements = (statements: Statement[], context: WalkContext = {}) => {
    let currentProfile = context.currentProfile;
    const setFormulaBinding = (name: string, binding: FormulaBinding) => {
      formulaBindings.set(name, binding);
      const simple = name.split('.').pop();
      if (simple && !formulaBindings.has(simple)) {
        formulaBindings.set(simple, binding);
      }
    };

    statements.forEach((statement) => {
      if (statement.kind === 'logic_decl') {
        currentProfile = statement.profile;
        addProfile(profiles, currentProfile);
        return;
      }

      if (statement.kind === 'theory_decl') {
        const label = qualifySymbol(statement.name, context);
        const theoryNodeId = createStableSemanticId('theory', label, options?.docId || options?.docName);
        upsertNode(nodes, {
          id: theoryNodeId,
          kind: 'theory',
          label,
          origin: 'st-source',
          scope: 'theory-file',
          logicProfile: currentProfile,
          sourceRefs: statementSourceRefs(statement),
          updatedAt: Date.now(),
          status: 'validated',
          docId: options?.docId ?? null,
          docName: options?.docName ?? options?.sourceFileName ?? null
        });
        registerAlias(symbolIndex, label, theoryNodeId);
        applyStatements(statement.members.map((member) => member.statement), {
          currentProfile,
          theoryPrefix: label,
          theoryNodeId
        });
        return;
      }

      if (statement.kind === 'define_decl') {
        const label = qualifySymbol(statement.name, context);
        const nodeId = createStableSemanticId('st-definition', label, options?.docId || options?.docName);
        upsertNode(nodes, {
          id: nodeId,
          kind: 'definition',
          label,
          origin: 'st-source',
          scope: 'theory-file',
          logicProfile: currentProfile,
          sourceRefs: statementSourceRefs(statement),
          updatedAt: Date.now(),
          status: 'validated',
          docId: options?.docId ?? null,
          docName: options?.docName ?? options?.sourceFileName ?? null,
          formula: safeFormulaToString(statement.body),
          text: statement.description,
          metadata: {
            description: statement.description
          }
        });
        registerAlias(symbolIndex, label, nodeId);
        if (context.theoryNodeId) {
          upsertEdge(edges, {
            id: createStableSemanticId('edge-theory-def', context.theoryNodeId, nodeId),
            from: context.theoryNodeId,
            to: nodeId,
            relationType: 'defines',
            origin: 'st-source',
            scope: 'theory-file',
            updatedAt: Date.now(),
            logicProfile: currentProfile,
            sourceRefs: statementSourceRefs(statement)
          });
        }
        return;
      }

      if (statement.kind === 'let_decl') {
        const label = qualifySymbol(statement.name, context);

        if (statement.letType === 'passage') {
          const nodeId = createStableSemanticId('st-passage', label, options?.docId || options?.docName);
          upsertNode(nodes, {
            id: nodeId,
            kind: 'passage',
            label,
            origin: 'st-source',
            scope: 'theory-file',
            logicProfile: currentProfile,
            sourceRefs: statementSourceRefs(statement),
            updatedAt: Date.now(),
            status: 'validated',
            docId: options?.docId ?? null,
            docName: options?.docName ?? options?.sourceFileName ?? null,
            text: statement.anchorPath,
            metadata: {
              anchorPath: statement.anchorPath,
              letType: statement.letType
            }
          });
          registerAlias(symbolIndex, label, nodeId);
          return;
        }

        if (statement.letType === 'formalize') {
          const passageLookupName = qualifySymbol(statement.passageName, context);
          const sourceNodeId = symbolIndex.get(passageLookupName) || symbolIndex.get(statement.passageName);
          setFormulaBinding(label, {
            formula: safeFormulaToString(statement.formula),
            sourceNodeId,
            letType: statement.letType
          });
          return;
        }

        if (statement.letType === 'formula') {
          setFormulaBinding(label, {
            formula: safeFormulaToString(statement.formula),
            letType: statement.letType
          });
        }
        return;
      }

      if (statement.kind === 'claim_decl' || statement.kind === 'axiom_decl' || statement.kind === 'theorem_decl') {
        const rawName = statement.name;
        const label = qualifySymbol(rawName, context);
        const formalizationRef = 'formalization' in statement && typeof statement.formalization === 'string'
          ? statement.formalization
          : undefined;
        const resolvedBinding = formalizationRef
          ? formulaBindings.get(qualifySymbol(formalizationRef, context)) || formulaBindings.get(formalizationRef)
          : undefined;
        const formula = 'formula' in statement && statement.formula
          ? safeFormulaToString(statement.formula)
          : resolvedBinding?.formula;
        const nodeId = createStableSemanticId('st-claim', label, options?.docId || options?.docName);
        upsertNode(nodes, {
          id: nodeId,
          kind: 'claim',
          label,
          origin: 'st-source',
          scope: 'theory-file',
          logicProfile: currentProfile,
          sourceRefs: statementSourceRefs(statement),
          updatedAt: Date.now(),
          status: 'draft',
          docId: options?.docId ?? null,
          docName: options?.docName ?? options?.sourceFileName ?? null,
          formula,
          text: statement.kind === 'claim_decl' ? statement.value : undefined,
          metadata: {
            statementKind: statement.kind,
            ...(formalizationRef ? { formalizationRef } : {}),
            ...(resolvedBinding?.letType ? { letType: resolvedBinding.letType } : {})
          }
        });
        registerAlias(symbolIndex, label, nodeId);
        claimIds.set(label, nodeId);
        claimIds.set(rawName, nodeId);
        return;
      }

      if (statement.kind === 'source_decl') {
        const label = qualifySymbol(statement.name, context);
        const nodeId = createStableSemanticId('st-source', label, options?.docId || options?.docName);
        upsertNode(nodes, {
          id: nodeId,
          kind: 'source',
          label,
          origin: 'st-source',
          scope: 'theory-file',
          logicProfile: currentProfile,
          sourceRefs: statementSourceRefs(statement),
          updatedAt: Date.now(),
          status: 'validated',
          docId: options?.docId ?? null,
          docName: options?.docName ?? options?.sourceFileName ?? null,
          text: statement.fields.map((field) => `${field.key} ${field.value}`).join(' · '),
          metadata: {
            fields: statement.fields
          }
        });
        registerAlias(symbolIndex, label, nodeId);
        return;
      }

      if (statement.kind === 'interpret_cmd') {
        const label = statement.text;
        const alias = safeFormulaToString(statement.formula);
        const nodeId = createStableSemanticId('st-passage', label, options?.docId || options?.docName);
        upsertNode(nodes, {
          id: nodeId,
          kind: 'passage',
          label,
          origin: 'st-source',
          scope: 'theory-file',
          logicProfile: currentProfile,
          sourceRefs: statementSourceRefs(statement),
          updatedAt: Date.now(),
          status: 'validated',
          docId: options?.docId ?? null,
          docName: options?.docName ?? options?.sourceFileName ?? null,
          text: statement.text,
          formula: safeFormulaToString(statement.formula),
          metadata: {
            passageRef: statement.passageRef,
            ...(alias ? { alias } : {})
          }
        });
        registerAlias(symbolIndex, label, nodeId);
        if (alias) registerAlias(symbolIndex, alias, nodeId);
        return;
      }

      if (statement.kind === 'support_decl') {
        const claimNodeId = claimIds.get(qualifySymbol(statement.claimName, context)) || claimIds.get(statement.claimName);
        const sourceNodeId = symbolIndex.get(qualifySymbol(statement.sourceName, context)) || symbolIndex.get(statement.sourceName);
        if (claimNodeId && sourceNodeId) {
          upsertEdge(edges, {
            id: createStableSemanticId('st-support', sourceNodeId, claimNodeId),
            from: sourceNodeId,
            to: claimNodeId,
            relationType: 'supports',
            origin: 'st-source',
            scope: 'theory-file',
            updatedAt: Date.now(),
            logicProfile: currentProfile,
            sourceRefs: statementSourceRefs(statement)
          });
        }
        return;
      }

      if (statement.kind === 'confidence_decl') {
        const claimNodeId = claimIds.get(qualifySymbol(statement.claimName, context)) || claimIds.get(statement.claimName);
        const claimNode = claimNodeId ? nodes.get(claimNodeId) : undefined;
        if (claimNode) {
          upsertNode(nodes, {
            ...claimNode,
            confidence: statement.value
          });
        }
        return;
      }

      if (statement.kind === 'context_decl') {
        const claimNodeId = claimIds.get(qualifySymbol(statement.claimName, context)) || claimIds.get(statement.claimName);
        const claimNode = claimNodeId ? nodes.get(claimNodeId) : undefined;
        if (claimNode) {
          upsertNode(nodes, {
            ...claimNode,
            text: statement.text,
            metadata: {
              ...(claimNode.metadata || {}),
              context: statement.text
            }
          });
        }
      }
    });
  };

  applyStatements(parsed.program.statements);

  const graph: TheoryGraph = {
    ...baseGraph,
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    diagnostics,
    profileIds: Array.from(profiles.values())
  };
  graph.diagnostics = verifyTheoryGraph(graph);
  return graph;
};

const stDiagnosticToTheoryGraphDiagnostic = (diagnostic: STDiagnostic): TheoryGraphDiagnostic => ({
  id: createDiagnosticId('parse-error', [
    diagnostic.file || '<api>',
    String(diagnostic.line || 0),
    String(diagnostic.column || 0),
    diagnostic.message
  ]),
  type: 'parse-error',
  severity: diagnostic.severity === 'error' ? 'error' : 'warning',
  message: diagnostic.message,
  nodeIds: [],
  edgeIds: [],
  quickFixes: [],
  sourceRefs: [{
    fileName: diagnostic.file ?? null,
    line: diagnostic.line ?? null,
    column: diagnostic.column ?? null
  }]
});

export const verifyTheoryGraph = (graph: TheoryGraph): TheoryGraphDiagnostic[] => {
  const diagnostics: TheoryGraphDiagnostic[] = [];
  const incoming = new Map<string, TheoryGraphEdge[]>();
  const outgoing = new Map<string, TheoryGraphEdge[]>();

  graph.edges.forEach((edge) => {
    const inList = incoming.get(edge.to) ?? [];
    inList.push(edge);
    incoming.set(edge.to, inList);

    const outList = outgoing.get(edge.from) ?? [];
    outList.push(edge);
    outgoing.set(edge.from, outList);
  });

  graph.edges
    .filter((edge) => edge.relationType === 'contradicts')
    .forEach((edge) => {
      diagnostics.push({
        id: createDiagnosticId('contradiction', [edge.from, edge.to]),
        type: 'contradiction',
        severity: 'warning',
        message: 'Se detectó una contradicción explícita entre nodos del mapa argumental.',
        nodeIds: [edge.from, edge.to],
        edgeIds: [edge.id],
        quickFixes: [{
          id: createStableSemanticId('quick-fix', 'mark-dialectical-tension', edge.id),
          kind: 'mark-dialectical-tension',
          label: 'Marcar tensión dialéctica',
          description: 'Mantiene ambos nodos, pero deja la contradicción como tensión intencional.',
          sourceNodeId: edge.from,
          targetNodeId: edge.to
        }],
        sourceRefs: edge.sourceRefs
      });
    });

  const claimNodes = graph.nodes.filter((node) => node.kind === 'claim');
  const evidenceNodes = graph.nodes.filter((node) => node.kind === 'evidence');

  claimNodes.forEach((node) => {
    const claimIncoming = incoming.get(node.id) ?? [];
    const supported = claimIncoming.some((edge) => (
      edge.relationType === 'supports'
      || edge.relationType === 'evidence-for'
      || edge.relationType === 'restates'
    ));
    if (!supported) {
      diagnostics.push({
        id: createDiagnosticId('unsupported-claim', [node.id]),
        type: 'unsupported-claim',
        severity: 'warning',
        message: `El claim "${node.label}" no tiene soporte suficiente en el grafo actual.`,
        nodeIds: [node.id],
        edgeIds: [],
        quickFixes: [
          {
            id: createStableSemanticId('quick-fix', 'link-missing-evidence', node.id),
            kind: 'link-missing-evidence',
            label: 'Vincular evidencia faltante',
            description: 'Conecta la evidencia más reciente disponible con este claim.',
            targetNodeId: node.id
          },
          {
            id: createStableSemanticId('quick-fix', 'weaken-claim', node.id),
            kind: 'weaken-claim',
            label: 'Debilitar claim',
            description: 'Rebaja el claim a borrador para indicar que requiere revisión.',
            targetNodeId: node.id
          },
          {
            id: createStableSemanticId('quick-fix', 'add-condition', node.id),
            kind: 'add-condition',
            label: 'Agregar condición',
            description: 'Marca que el claim necesita una condición o contexto adicional.',
            targetNodeId: node.id
          }
        ],
        sourceRefs: node.sourceRefs
      });
    }
  });

  evidenceNodes.forEach((node) => {
    const evidenceOutgoing = outgoing.get(node.id) ?? [];
    const linked = evidenceOutgoing.some((edge) => (
      edge.relationType === 'supports'
      || edge.relationType === 'evidence-for'
      || edge.relationType === 'evidence-against'
    ));
    if (!linked) {
      diagnostics.push({
        id: createDiagnosticId('orphan-evidence', [node.id]),
        type: 'orphan-evidence',
        severity: 'info',
        message: `La evidencia "${node.label}" todavía no está conectada con ningún claim.`,
        nodeIds: [node.id],
        edgeIds: [],
        quickFixes: [{
          id: createStableSemanticId('quick-fix', 'link-missing-evidence', node.id),
          kind: 'link-missing-evidence',
          label: 'Vincular con claim',
          description: 'Asocia esta evidencia a un claim aún no soportado.',
          sourceNodeId: node.id
        }],
        sourceRefs: node.sourceRefs
      });
    }
  });

  graph.nodes
    .filter((node) => node.kind === 'concept')
    .forEach((node) => {
      const hasIncoming = (incoming.get(node.id) ?? []).length > 0;
      const hasOutgoing = (outgoing.get(node.id) ?? []).length > 0;
      if (!hasIncoming && !hasOutgoing) {
        diagnostics.push({
          id: createDiagnosticId('isolated-concept', [node.id]),
          type: 'isolated-concept',
          severity: 'info',
          message: `El concepto "${node.label}" quedó aislado del resto del grafo argumental.`,
          nodeIds: [node.id],
          edgeIds: [],
          quickFixes: [],
          sourceRefs: node.sourceRefs
        });
      }
    });

  graph.edges.forEach((edge) => {
    const fromNode = graph.nodes.find((node) => node.id === edge.from);
    const toNode = graph.nodes.find((node) => node.id === edge.to);
    if (!fromNode?.logicProfile || !toNode?.logicProfile || fromNode.logicProfile === toNode.logicProfile) {
      return;
    }
    diagnostics.push({
      id: createDiagnosticId('incompatible-profile', [edge.id, fromNode.logicProfile, toNode.logicProfile]),
      type: 'incompatible-profile',
      severity: 'warning',
      message: `La relación "${edge.relationType}" conecta perfiles lógicos incompatibles: ${fromNode.logicProfile} vs ${toNode.logicProfile}.`,
      nodeIds: [edge.from, edge.to],
      edgeIds: [edge.id],
      quickFixes: [],
      sourceRefs: edge.sourceRefs
    });
  });

  const formulaClaims = claimNodes.filter((node) => node.formula && node.logicProfile);
  for (let index = 0; index < formulaClaims.length; index += 1) {
    const left = formulaClaims[index];
    if (!left) continue;
    for (let next = index + 1; next < formulaClaims.length; next += 1) {
      const right = formulaClaims[next];
      if (!right) continue;
      if (!left.logicProfile || left.logicProfile !== right.logicProfile || !left.formula || !right.formula) continue;
      try {
        const leftFormula = canonicalizeSTFormula(left.formula, left.logicProfile);
        const rightFormula = canonicalizeSTFormula(right.formula, right.logicProfile);
        const result = evaluate(
          `logic ${left.logicProfile}\ncheck satisfiable ((${leftFormula}) & (${rightFormula}))`
        );
        if (result.results[0]?.status === 'unsatisfiable') {
          diagnostics.push({
            id: createDiagnosticId('contradiction', [left.id, right.id, left.logicProfile]),
            type: 'contradiction',
            severity: 'warning',
            message: `Los claims "${left.label}" y "${right.label}" no son satisfacibles juntos en ${left.logicProfile}.`,
            nodeIds: [left.id, right.id],
            edgeIds: [],
            quickFixes: [{
              id: createStableSemanticId('quick-fix', 'mark-dialectical-tension', left.id, right.id),
              kind: 'mark-dialectical-tension',
              label: 'Marcar tensión dialéctica',
              description: 'Conserva ambos claims y explicita la tensión como parte del argumento.',
              sourceNodeId: left.id,
              targetNodeId: right.id
            }],
            sourceRefs: [...left.sourceRefs, ...right.sourceRefs]
          });
        }
      } catch {
        // Ignore verification failures for profiles/formulas the runtime cannot compare safely here.
      }
    }
  }

  return diagnostics;
};

const nodeKindToEntityKind = (kind: TheoryGraphNodeKind): SemanticEntityKind => {
  switch (kind) {
    case 'claim':
      return 'claim';
    case 'definition':
      return 'definition';
    case 'evidence':
      return 'evidence';
    case 'source':
      return 'source';
    case 'passage':
      return 'passage';
    default:
      return 'concept';
  }
};

export const projectTheoryGraphToSemanticState = (
  graph: TheoryGraph,
  context: {
    workspaceId: string;
    docId?: string | null;
    docName: string;
  }
): SemanticWorkspaceState => {
  const concepts: SemanticConceptRecord[] = [];
  const fragments: SemanticFragmentRecord[] = [];
  const relations: SemanticRelationRecord[] = [];
  const conceptNodeIds = new Map<string, string>();
  const fragmentNodeIds = new Map<string, string>();

  graph.nodes.forEach((node) => {
    if (node.kind === 'concept' || node.kind === 'claim' || node.kind === 'definition' || node.kind === 'source') {
      const conceptId = createStableSemanticId('semantic-concept', context.workspaceId, context.docId || context.docName, node.id);
      concepts.push({
        id: conceptId,
        title: node.label,
        entityKind: nodeKindToEntityKind(node.kind),
        ...(node.kind === 'definition' || node.kind === 'source' ? { definition: node.text || node.label } : {}),
        ...(node.logicProfile ? { logicProfile: node.logicProfile } : {}),
        ...(node.formula ? { formula: node.formula } : {}),
        excerpt: node.text || node.label,
        docId: context.docId ?? null,
        docName: context.docName,
        workspaceId: context.workspaceId,
        createdAt: node.updatedAt,
        updatedAt: node.updatedAt,
        sourceFragmentId: '',
        origin: 'st-source',
        scope: 'theory-file',
        ...(node.confidence !== undefined ? { confidence: node.confidence } : {}),
        status: node.status,
        ...(node.sourceRefs.length > 0 ? { sourceRefs: node.sourceRefs } : {}),
        stableKey: createStableSemanticId('semantic-concept-key', context.workspaceId, node.id),
        metadata: node.metadata
      });
      conceptNodeIds.set(node.id, conceptId);
      return;
    }

    const fragmentId = createStableSemanticId('semantic-fragment', context.workspaceId, context.docId || context.docName, node.id);
    fragments.push({
      id: fragmentId,
      kind: node.kind === 'evidence' ? 'evidence' : 'passage',
      entityKind: nodeKindToEntityKind(node.kind),
      text: node.text || node.label,
      excerpt: node.label,
      docId: context.docId ?? null,
      docName: context.docName,
      workspaceId: context.workspaceId,
      createdAt: node.updatedAt,
      updatedAt: node.updatedAt,
      selectionHash: createStableSemanticId('semantic-selection', context.workspaceId, node.id),
      origin: 'st-source',
      scope: 'theory-file',
      ...(node.logicProfile ? { logicProfile: node.logicProfile } : {}),
      ...(node.confidence !== undefined ? { confidence: node.confidence } : {}),
      status: node.status,
      ...(node.sourceRefs.length > 0 ? { sourceRefs: node.sourceRefs } : {}),
      stableKey: createStableSemanticId('semantic-fragment-key', context.workspaceId, node.id),
      metadata: node.metadata
    });
    fragmentNodeIds.set(node.id, fragmentId);
  });

  graph.edges.forEach((edge) => {
    const conceptId = conceptNodeIds.get(edge.to);
    const fragmentId = fragmentNodeIds.get(edge.from);
    if (!conceptId || !fragmentId) return;
    relations.push({
      id: createStableSemanticId('semantic-relation', context.workspaceId, edge.id),
      fragmentId,
      conceptId,
      conceptTitle: concepts.find((concept) => concept.id === conceptId)?.title || edge.to,
      relationType: edge.relationType,
      createdAt: edge.updatedAt,
      updatedAt: edge.updatedAt,
      docId: context.docId ?? null,
      origin: 'st-source',
      scope: 'theory-file',
      ...(edge.logicProfile ? { logicProfile: edge.logicProfile } : {}),
      ...(edge.confidence !== undefined ? { confidence: edge.confidence } : {}),
      ...(edge.status ? { status: edge.status } : {}),
      sourceRefs: edge.sourceRefs,
      sourceEntityId: fragmentId,
      targetEntityId: conceptId,
      stableKey: createStableSemanticId('semantic-relation-key', context.workspaceId, edge.id)
    });
  });

  return mergeSemanticWorkspaceStates({
    concepts,
    fragments,
    relations,
    updatedAt: Date.now(),
    preferences: {
      experienceMode: 'hybrid',
      showSTPreview: true,
      showPedagogicalHints: true
    }
  });
};
