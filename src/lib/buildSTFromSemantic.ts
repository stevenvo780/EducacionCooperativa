/**
 * Proyección ST estructurada desde el estado semántico.
 *
 * Este archivo mantiene la API pública histórica (`buildSTFromSemantic`,
 * `companionSTName`, `formalizeText`) pero ahora genera un companion
 * con zonas gestionadas y zona libre del usuario para soportar round-trip
 * progresivo sin destruir extensiones manuales.
 */
import { formalize, type LogicProfile } from '@stevenvo780/autologic';
import type { SemanticWorkspaceState } from '@/services/editorSemanticStore';
import { buildTheoryGraphFromSemanticState } from '@/lib/semantic/theory-graph';
import { ST_RUNTIME_PROFILE_IDS } from '@/lib/st-runtime-manifest';
import { createStableSemanticId } from '@/lib/semantic/ids';
import { canonicalizeSTFormula, toClaimExpression } from '@/lib/st-formula';

const VALID_PROFILES = new Set(ST_RUNTIME_PROFILE_IDS);

export const COMPANION_MANAGED_START = '// <agora:managed:start>';
export const COMPANION_MANAGED_END = '// <agora:managed:end>';
export const COMPANION_USER_START = '// <agora:user-extensions:start>';
export const COMPANION_USER_END = '// <agora:user-extensions:end>';

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'en', 'con', 'por', 'para', 'sin',
  'que', 'se', 'su', 'sus', 'es', 'son', 'ser', 'fue',
  'y', 'o', 'a', 'e', 'no', 'ni', 'si', 'como', 'pero',
  'mas', 'este', 'esta', 'esto', 'ese', 'esa', 'eso',
  'lo', 'le', 'les', 'me', 'te', 'nos', 'ya', 'muy',
  'sino', 'tambien', 'puede', 'pueden', 'ha', 'han', 'hay'
]);

const normalizeSemanticText = (text: string) => text.replace(/\s+/g, ' ').trim();

const extractKeywords = (text: string, maxWords = 4): string[] => {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !STOPWORDS.has(word))
    .slice(0, maxWords);
};

const toSTIdentifier = (text: string, fallback = 'CONCEPTO'): string => {
  const keywords = extractKeywords(text);
  if (keywords.length === 0) return fallback;
  const identifier = keywords.join('_').toUpperCase();
  const safe = /^[A-Z]/.test(identifier) ? identifier : `C_${identifier}`;
  return safe.slice(0, 60);
};

const escapeSTString = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');

const isValidProfile = (profile?: string): profile is LogicProfile =>
  !!profile && (VALID_PROFILES as Set<string>).has(profile);

const extractFirstFormula = (stCode: string) => {
  const axiomMatch = stCode.match(/(?:axiom|claim)\s+\w+\s*[:=]\s*(.+)/);
  return axiomMatch?.[1]?.trim() || '';
};

const extractUserExtensions = (existingContent?: string | null) => {
  if (!existingContent) return '';
  const start = existingContent.indexOf(COMPANION_USER_START);
  const end = existingContent.indexOf(COMPANION_USER_END);
  if (start === -1 || end === -1 || end <= start) return '';
  return existingContent
    .slice(start + COMPANION_USER_START.length, end)
    .trim()
    .replace(/^\n+|\n+$/g, '');
};

const makeManagedComment = (kind: string, stableId: string) => `// @agora:${kind}:${stableId}`;

const chooseDominantProfile = (state: SemanticWorkspaceState) => {
  const counts = new Map<string, number>();
  state.concepts.forEach((concept) => {
    if (!concept.logicProfile) return;
    counts.set(concept.logicProfile, (counts.get(concept.logicProfile) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])[0]?.[0] || 'classical.propositional';
};

interface ConceptProjection {
  stableId: string;
  conceptName: string;
  definitionName: string;
  claimName: string;
  formula: string;
  profile: string;
  text: string;
  definition?: string;
  confidence?: number;
  sourceConceptId: string;
}

interface SupportSourceProjection {
  stableId: string;
  sourceName: string;
  command: string[];
  claimNames: string[];
}

const buildConceptProjection = (
  concept: SemanticWorkspaceState['concepts'][number],
  fragments: SemanticWorkspaceState['fragments'],
  conceptIndex: number
): ConceptProjection => {
  const sourceFragment = concept.sourceFragmentId
    ? fragments.find((fragment) => fragment.id === concept.sourceFragmentId)
    : undefined;
  const fullText = normalizeSemanticText(sourceFragment?.text || concept.excerpt || concept.title);
  const profile: LogicProfile = isValidProfile(concept.logicProfile)
    ? concept.logicProfile
    : 'classical.propositional';
  const stableId = createStableSemanticId('companion-concept', concept.id, concept.docId || concept.docName, concept.title);
  const conceptName = toSTIdentifier(concept.definition || concept.title, `CONCEPTO_${conceptIndex + 1}`);
  const definitionName = `DEF_${conceptName}`;
  const claimName = `CLM_${conceptName}`;

  let formula = concept.formula?.trim() || '';
  if (!formula) {
    try {
      const result = formalize(fullText, {
        profile,
        language: 'es',
        atomStyle: 'keywords',
        includeComments: true
      });
      if (result.ok) {
        formula = extractFirstFormula(result.stCode);
      }
    } catch {
      // Fallback to a generated atom alias.
    }
  }

  if (!formula) {
    formula = conceptName;
  }

  formula = canonicalizeSTFormula(formula, profile);

  return {
    stableId,
    conceptName,
    definitionName,
    claimName,
    formula,
    profile,
    text: fullText,
    definition: concept.definition,
    confidence: concept.confidence,
    sourceConceptId: concept.id
  };
};

const buildHeader = (docName: string, state: SemanticWorkspaceState) => {
  const graph = buildTheoryGraphFromSemanticState(state, { sourceDocument: { docName } });
  return [
    '// ============================================================',
    '// Agora ST companion',
    `// Documento origen: ${docName}`,
    `// Generado: ${new Date().toISOString()}`,
    `// Nodos: ${graph.nodes.length} | Aristas: ${graph.edges.length} | Diagnosticos: ${graph.diagnostics.length}`,
    '// ============================================================',
    ''
  ].join('\n');
};

const buildProfileSection = (profile: string) => [
  '// [profile]',
  `logic ${profile}`,
  ''
].join('\n');

const buildImportsSection = () => [
  '// [imports]',
  '// Mantener imports manuales dentro de user extensions si no pertenecen al companion gestionado.',
  ''
].join('\n');

const buildDefinitionsSection = (projections: ConceptProjection[]) => {
  if (projections.length === 0) {
    return '// [definitions]\n// Sin definiciones gestionadas.\n';
  }

  const lines = ['// [definitions]'];
  projections.forEach((projection) => {
    lines.push(makeManagedComment('definition', projection.stableId));
    lines.push(`interpret "${escapeSTString(projection.text)}" as ${projection.conceptName}`);
    lines.push(
      `define ${projection.definitionName} = ${projection.formula}${projection.definition ? ` description "${escapeSTString(projection.definition)}"` : ''}`
    );
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
};

const buildClaimsSection = (projections: ConceptProjection[]) => {
  if (projections.length === 0) {
    return '// [claims]\n// Sin claims gestionados.\n';
  }

  const lines = ['// [claims]'];
  projections.forEach((projection) => {
    lines.push(makeManagedComment('claim', projection.stableId));
    lines.push(`claim ${projection.claimName} = ${toClaimExpression(projection.formula)}`);
    if (projection.confidence !== undefined) {
      lines.push(`confidence ${projection.claimName} = ${projection.confidence.toFixed(2)}`);
    }
    lines.push(`context ${projection.claimName} = "${escapeSTString(projection.definition || projection.text)}"`);
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
};

const buildEvidenceSection = (
  fragments: SemanticWorkspaceState['fragments'],
  relations: SemanticWorkspaceState['relations'],
  projectionsByConceptId: Map<string, ConceptProjection>
) => {
  const supportLikeRelations = relations.filter((relation) => (
    relation.relationType === 'supports'
    || relation.relationType === 'evidence-for'
    || relation.relationType === 'restates'
  ));
  const claimNamesByFragmentId = new Map<string, string[]>();

  supportLikeRelations.forEach((relation) => {
    const projection = projectionsByConceptId.get(relation.conceptId);
    if (!projection) return;
    const current = claimNamesByFragmentId.get(relation.fragmentId) ?? [];
    if (!current.includes(projection.claimName)) current.push(projection.claimName);
    claimNamesByFragmentId.set(relation.fragmentId, current);
  });

  const supportSources: SupportSourceProjection[] = fragments
    .filter((fragment) => fragment.kind === 'evidence' || fragment.kind === 'passage' || fragment.kind === 'source')
    .map((fragment, index) => {
      const claimNames = [
        ...(fragment.conceptId && projectionsByConceptId.has(fragment.conceptId)
          ? [projectionsByConceptId.get(fragment.conceptId)!.claimName]
          : []),
        ...(claimNamesByFragmentId.get(fragment.id) ?? [])
      ].filter((claimName, claimIndex, list) => list.indexOf(claimName) === claimIndex);

      const stableId = createStableSemanticId(
        'companion-evidence',
        fragment.id,
        fragment.docId || fragment.docName,
        fragment.selectionHash
      );
      const stableToken = stableId.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase() || String(index + 1);
      const sourceName = fragment.kind === 'passage'
        ? `PSG_${stableToken}`
        : fragment.kind === 'source'
          ? `SRC_${stableToken}`
          : `EV_${stableToken}`;
      const anchorPath = typeof fragment.metadata?.anchorPath === 'string' && fragment.metadata.anchorPath.trim()
        ? fragment.metadata.anchorPath.trim()
        : null;

      let command: string[] = [];
      if (fragment.kind === 'passage' && anchorPath) {
        command = [`let ${sourceName} = passage([[${anchorPath}]])`];
      } else if (fragment.linkedDocName) {
        command = [
          `source ${sourceName} {`,
          `  work "${escapeSTString(fragment.linkedDocName)}"`,
          '}'
        ];
      } else {
        command = [`interpret "${escapeSTString(fragment.excerpt || fragment.text)}" as ${sourceName}`];
      }

      return {
        stableId,
        sourceName,
        command,
        claimNames
      };
    });

  if (supportSources.length === 0) {
    return '// [evidence]\n// Sin evidencias gestionadas.\n';
  }

  const lines = ['// [evidence]'];
  supportSources.forEach((source) => {
    lines.push(makeManagedComment('evidence', source.stableId));
    lines.push(...source.command);
    source.claimNames.forEach((claimName) => {
      lines.push(`support ${claimName} <- ${source.sourceName}`);
    });
    lines.push('');
  });

  return `${lines.join('\n')}\n`;
};

const buildRelationsSection = (
  relations: SemanticWorkspaceState['relations'],
  fragments: SemanticWorkspaceState['fragments'],
  projectionsByConceptId: Map<string, ConceptProjection>
) => {
  if (relations.length === 0) {
    return '// [relations]\n// Sin relaciones gestionadas.\n';
  }

  const lines = ['// [relations]'];
  relations.forEach((relation) => {
    const projection = projectionsByConceptId.get(relation.conceptId);
    const fragment = fragments.find((item) => item.id === relation.fragmentId);
    if (!projection || !fragment) return;
    const stableId = createStableSemanticId('companion-relation', relation.id, relation.relationType, projection.stableId);
    lines.push(makeManagedComment('relation', stableId));
    lines.push(`// ${relation.relationType}: "${escapeSTString(fragment.excerpt || fragment.text)}" -> ${projection.claimName}`);
    if (relation.relationType === 'questions') {
      lines.push(`context ${projection.claimName} = "${escapeSTString(`Pregunta abierta: ${fragment.excerpt || fragment.text}`)}"`);
    }
    if (relation.relationType === 'contradicts') {
      lines.push(`context ${projection.claimName} = "${escapeSTString(`Tension: ${fragment.excerpt || fragment.text}`)}"`);
    }
    lines.push('');
  });
  return `${lines.join('\n')}\n`;
};

const buildChecksSection = (projections: ConceptProjection[]) => {
  if (projections.length === 0) {
    return '// [checks]\n// Sin verificaciones gestionadas.\n';
  }

  const lines = [
    '// [checks]',
    '// Verificacion generada para background checks y mapa argumental.'
  ];

  projections.slice(0, 8).forEach((projection) => {
    lines.push(`check satisfiable ${toClaimExpression(projection.formula)}`);
  });

  for (let index = 0; index < Math.min(projections.length, 5); index += 1) {
    const current = projections[index];
    const next = projections[index + 1];
    if (!current) break;
    if (!next) break;
    lines.push(`check satisfiable ${toClaimExpression(`(${current.formula}) & (${next.formula})`)}`);
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
};

const buildUserExtensionsSection = (existingContent?: string | null) => {
  const preserved = extractUserExtensions(existingContent);
  return [
    COMPANION_USER_START,
    preserved || '// Espacio libre del usuario. Esta zona se preserva en resincronizaciones.',
    COMPANION_USER_END,
    ''
  ].join('\n');
};

export function buildSTFromSemantic(
  state: SemanticWorkspaceState,
  docName: string,
  options?: { existingContent?: string | null }
): string {
  const projections = state.concepts.map((concept, index) => buildConceptProjection(concept, state.fragments, index));
  const projectionsByConceptId = new Map(projections.map((projection) => [projection.sourceConceptId, projection]));
  const profileIds = Array.from(new Set([
    ...projections.map((projection) => projection.profile),
    ...state.fragments.map((fragment) => fragment.logicProfile).filter((profile): profile is string => !!profile),
    chooseDominantProfile(state)
  ]));

  const managedSections = [
    buildHeader(docName, state),
    COMPANION_MANAGED_START,
    buildImportsSection(),
    ...profileIds.flatMap((profile, index) => {
      const scopedProjections = projections.filter((projection) => projection.profile === profile);
      const scopedConceptIds = new Set(scopedProjections.map((projection) => projection.sourceConceptId));
      const scopedRelations = state.relations.filter((relation) => (
        scopedConceptIds.has(relation.conceptId)
        || (!relation.conceptId && index === 0)
      ));
      const scopedFragmentIds = new Set(scopedRelations.map((relation) => relation.fragmentId));
      const scopedFragments = state.fragments.filter((fragment) => {
        if (fragment.conceptId && scopedConceptIds.has(fragment.conceptId)) return true;
        if (scopedFragmentIds.has(fragment.id)) return true;
        if (index === 0 && !fragment.conceptId && !fragment.logicProfile) return true;
        return fragment.logicProfile === profile && !fragment.conceptId;
      });

      return [
        buildProfileSection(profile),
        buildDefinitionsSection(scopedProjections),
        buildClaimsSection(scopedProjections),
        buildEvidenceSection(scopedFragments, scopedRelations, projectionsByConceptId),
        buildRelationsSection(scopedRelations, scopedFragments, projectionsByConceptId),
        buildChecksSection(scopedProjections)
      ];
    }),
    COMPANION_MANAGED_END,
    ''
  ];

  return `${managedSections.join('\n')}${buildUserExtensionsSection(options?.existingContent)}`.replace(/\n{3,}/g, '\n\n');
}

export function companionSTName(docName: string): string {
  const base = docName
    .replace(/\.(md|markdown)$/i, '')
    .replace(/\s+/g, '_');
  return `${base}.md.st`;
}

export function formalizeText(
  text: string,
  profile?: string
): {
  ok: boolean;
  stCode: string;
  patterns: string[];
  atomCount: number;
  formulaCount: number;
} {
  try {
    const logicProfile: LogicProfile = isValidProfile(profile)
      ? profile
      : 'classical.propositional';

    const result = formalize(text, {
      profile: logicProfile,
      language: 'es',
      atomStyle: 'keywords',
      includeComments: true
    });

    return {
      ok: result.ok,
      stCode: result.stCode,
      patterns: result.analysis.detectedPatterns,
      atomCount: result.atoms.size,
      formulaCount: result.formulas.length
    };
  } catch {
    return { ok: false, stCode: '', patterns: [], atomCount: 0, formulaCount: 0 };
  }
}
