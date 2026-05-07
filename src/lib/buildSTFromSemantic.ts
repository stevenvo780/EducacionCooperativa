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
  tentative?: boolean;
  warning?: string;
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
  fragmentsById: Map<string, SemanticWorkspaceState['fragments'][number]>,
  conceptIndex: number
): ConceptProjection => {
  const sourceFragment = concept.sourceFragmentId
    ? fragmentsById.get(concept.sourceFragmentId)
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
  let tentative = false;
  let warning: string | undefined;
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
      } else {
        warning = 'formalizacion_tentativa: autologic no produjo una formula validada';
      }
    } catch (error) {
      warning = `formalizacion_tentativa: ${error instanceof Error ? error.message : 'error desconocido'}`;
    }
  }

  if (!formula) {
    tentative = true;
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
    tentative,
    warning,
    sourceConceptId: concept.id
  };
};

const buildHeader = (docName: string, state: SemanticWorkspaceState) => {
  // Antes: este header llamaba buildTheoryGraphFromSemanticState SOLO para
  // imprimir 3 contadores. En workspaces grandes esto duplicaba el costo
  // O(n²)·ST_eval del verifyTheoryGraph. Ahora usamos counters baratos.
  const conceptCount = state.concepts.length;
  const fragmentCount = state.fragments.length;
  const relationCount = state.relations.length;
  return [
    '// ============================================================',
    '// Agora ST companion',
    `// Documento origen: ${docName}`,
    `// Generado: ${new Date().toISOString()}`,
    `// Conceptos: ${conceptCount} | Fragments: ${fragmentCount} | Relaciones: ${relationCount}`,
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
    if (projection.tentative) {
      lines.push(`// formalización tentativa: revisar "${escapeSTString(projection.text)}"`);
    }
    if (projection.warning) {
      lines.push(`// warning: ${escapeSTString(projection.warning)}`);
    }
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
  // Indexar fragments por id para evitar O(R·F) en el render de relations.
  const fragmentsById = new Map(fragments.map((f) => [f.id, f]));
  relations.forEach((relation) => {
    const projection = projectionsByConceptId.get(relation.conceptId);
    const fragment = fragmentsById.get(relation.fragmentId);
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
  // Indexar fragments por id antes del map: antes era O(C·F) (find por concepto)
  const fragmentsById = new Map(state.fragments.map((f) => [f.id, f]));
  const projections = state.concepts.map((concept, index) => buildConceptProjection(concept, fragmentsById, index));
  const projectionsByConceptId = new Map(projections.map((projection) => [projection.sourceConceptId, projection]));
  const profileIds = Array.from(new Set([
    ...projections.map((projection) => projection.profile),
    ...state.fragments.map((fragment) => fragment.logicProfile).filter((profile): profile is string => !!profile),
    chooseDominantProfile(state)
  ]));

  // Pre-bucket O(C+R+F+P) en lugar de O(P·(C+R+F)). En workspaces con muchos
  // perfiles + relations el flatMap por profile re-iteraba todas las relations
  // y fragments una vez por profile (P pasadas). Con la indexación previa cada
  // profile-iteration es O(1) lookup + O(scoped) por sección.
  const projectionsByProfile = new Map<string, ConceptProjection[]>();
  for (const projection of projections) {
    const list = projectionsByProfile.get(projection.profile);
    if (list) list.push(projection);
    else projectionsByProfile.set(projection.profile, [projection]);
  }

  const conceptProfileById = new Map<string, string>();
  for (const projection of projections) {
    conceptProfileById.set(projection.sourceConceptId, projection.profile);
  }

  const firstProfile = profileIds[0];
  const relationsByProfile = new Map<string, SemanticWorkspaceState['relations']>();
  for (const relation of state.relations) {
    const profile = relation.conceptId
      ? conceptProfileById.get(relation.conceptId)
      : firstProfile;
    if (!profile) continue;
    const list = relationsByProfile.get(profile);
    if (list) list.push(relation);
    else relationsByProfile.set(profile, [relation]);
  }

  // Una sola pasada por fragments: cada fragment cae en al menos un bucket
  // de profile (puede ser múltiples si una relación lo arrastra). Pre-computamos
  // qué fragmentIds quedan arrastrados por cada profile via relations.
  const draggedFragmentIdsByProfile = new Map<string, Set<string>>();
  for (const [profile, rels] of relationsByProfile) {
    const ids = new Set<string>();
    for (const rel of rels) ids.add(rel.fragmentId);
    draggedFragmentIdsByProfile.set(profile, ids);
  }

  const fragmentsByProfile = new Map<string, SemanticWorkspaceState['fragments']>();
  const ensureFragmentBucket = (profile: string) => {
    let list = fragmentsByProfile.get(profile);
    if (!list) {
      list = [];
      fragmentsByProfile.set(profile, list);
    }
    return list;
  };
  for (const fragment of state.fragments) {
    if (fragment.conceptId) {
      const profile = conceptProfileById.get(fragment.conceptId);
      if (profile) {
        ensureFragmentBucket(profile).push(fragment);
        continue;
      }
    }
    let placed = false;
    for (const [profile, ids] of draggedFragmentIdsByProfile) {
      if (ids.has(fragment.id)) {
        ensureFragmentBucket(profile).push(fragment);
        placed = true;
      }
    }
    if (placed) continue;
    if (!fragment.conceptId && !fragment.logicProfile && firstProfile) {
      ensureFragmentBucket(firstProfile).push(fragment);
      continue;
    }
    if (fragment.logicProfile && !fragment.conceptId) {
      ensureFragmentBucket(fragment.logicProfile).push(fragment);
    }
  }

  const managedSections = [
    buildHeader(docName, state),
    COMPANION_MANAGED_START,
    buildImportsSection(),
    ...profileIds.flatMap((profile) => {
      const scopedProjections = projectionsByProfile.get(profile) ?? [];
      const scopedRelations = relationsByProfile.get(profile) ?? [];
      const scopedFragments = fragmentsByProfile.get(profile) ?? [];

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
