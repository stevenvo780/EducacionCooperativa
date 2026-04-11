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
  !!profile && VALID_PROFILES.has(profile as any);

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
    lines.push(`claim ${projection.claimName} = ${projection.formula}`);
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
  projectionsByConceptId: Map<string, ConceptProjection>
) => {
  const evidence = fragments.filter((fragment) => fragment.kind === 'evidence');
  if (evidence.length === 0) {
    return '// [evidence]\n// Sin evidencias gestionadas.\n';
  }

  const lines = ['// [evidence]'];
  evidence.forEach((fragment, index) => {
    const stableId = createStableSemanticId('companion-evidence', fragment.id, fragment.docId || fragment.docName, fragment.selectionHash);
    const evidenceName = `EV_${index + 1}`;
    lines.push(makeManagedComment('evidence', stableId));
    if (fragment.linkedDocName) {
      const sourceName = toSTIdentifier(fragment.linkedDocName, `SRC_${index + 1}`);
      lines.push(`source ${sourceName} {`);
      lines.push(`  work "${escapeSTString(fragment.linkedDocName)}"`);
      lines.push('}');
      if (fragment.conceptId && projectionsByConceptId.has(fragment.conceptId)) {
        lines.push(`support ${projectionsByConceptId.get(fragment.conceptId)!.claimName} <- ${sourceName}`);
      }
    } else {
      lines.push(`interpret "${escapeSTString(fragment.excerpt || fragment.text)}" as ${evidenceName}`);
      if (fragment.conceptId && projectionsByConceptId.has(fragment.conceptId)) {
        lines.push(`support ${projectionsByConceptId.get(fragment.conceptId)!.claimName} <- ${evidenceName}`);
      }
    }
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
    lines.push(`check satisfiable (${projection.formula})`);
  });

  for (let index = 0; index < Math.min(projections.length, 5); index += 1) {
    const current = projections[index];
    const next = projections[index + 1];
    if (!next) break;
    lines.push(`check satisfiable ((${current.formula}) & (${next.formula}))`);
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
  const dominantProfile = chooseDominantProfile(state);
  const projections = state.concepts.map((concept, index) => buildConceptProjection(concept, state.fragments, index));
  const projectionsByConceptId = new Map(projections.map((projection) => [projection.sourceConceptId, projection]));

  const managedSections = [
    buildHeader(docName, state),
    COMPANION_MANAGED_START,
    buildProfileSection(dominantProfile),
    buildImportsSection(),
    buildDefinitionsSection(projections),
    buildClaimsSection(projections),
    buildEvidenceSection(state.fragments, projectionsByConceptId),
    buildRelationsSection(state.relations, state.fragments, projectionsByConceptId),
    buildChecksSection(projections),
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
