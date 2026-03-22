/**
 * Genera código ST (.st) a partir del estado semántico del editor.
 *
 * Delega la formalización de conceptos a @stevenvo780/autologic,
 * que aplica NLP basado en reglas para extraer estructura argumental,
 * detectar patrones lógicos y generar ST ejecutable.
 *
 * Mantiene compatibilidad con el flujo existente: evidencias, relaciones
 * y skeleton de verificación se generan igual que antes.
 */
import { formalize, type LogicProfile } from '@stevenvo780/autologic';
import type { SemanticWorkspaceState } from '@/services/editorSemanticStore';

/* ── Utilidades de escape / identificadores ────────────────── */

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'en', 'con', 'por', 'para', 'sin',
  'que', 'se', 'su', 'sus', 'es', 'son', 'ser', 'fue',
  'y', 'o', 'a', 'e', 'no', 'ni', 'si', 'como', 'pero',
  'mas', 'este', 'esta', 'esto', 'ese', 'esa', 'eso',
  'lo', 'le', 'les', 'me', 'te', 'nos', 'ya', 'muy',
  'por eso', 'sino', 'tambien', 'puede', 'pueden',
  'ha', 'han', 'hay', 'he', 'ser', 'era', 'eso',
  'todo', 'toda', 'todos', 'todas', 'otro', 'otra'
]);

const extractKeywords = (text: string, maxWords = 4): string[] => {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const words = normalized
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w));
  return words.slice(0, maxWords);
};

const toSTIdentifier = (text: string, fallback = 'CONCEPTO'): string => {
  const keywords = extractKeywords(text);
  if (keywords.length === 0) return fallback;
  const id = keywords.join('_').toUpperCase();
  const safe = /^[A-Z]/.test(id) ? id : `C_${id}`;
  return safe.slice(0, 60);
};

const escapeSTString = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');

const normalizeSemanticText = (text: string) => text.replace(/\s+/g, ' ').trim();

/* ── Perfiles lógicos válidos para autologic ────────────────── */

const VALID_PROFILES: Set<string> = new Set([
  'classical.propositional', 'classical.first_order', 'modal.k',
  'deontic.standard', 'epistemic.s5', 'intuitionistic.propositional',
  'temporal.ltl', 'paraconsistent.belnap', 'aristotelian.syllogistic',
  'probabilistic.basic', 'arithmetic'
]);

const isValidProfile = (profile?: string): profile is LogicProfile =>
  !!profile && VALID_PROFILES.has(profile);

/* ── Generación de secciones ─────────────────────────────────── */

/** Encabezado del archivo .st */
const buildHeader = (docName: string): string => [
  `// ═══════════════════════════════════════════════════════`,
  `// Interpretaciones ST — autologic`,
  `// Generado desde: ${docName}`,
  `// Fecha: ${new Date().toISOString().split('T')[0]}`,
  `// ═══════════════════════════════════════════════════════`,
  ''
].join('\n');

/**
 * Extrae el cuerpo útil del código ST generado por autologic,
 * omitiendo el header autogenerado y añadiendo un comentario de contexto.
 */
function extractSTBody(
  stCode: string,
  concept: SemanticWorkspaceState['concepts'][number],
  conceptIdx: number
): string {
  const lines = stCode.split('\n');
  const bodyLines: string[] = [];
  let pastHeader = false;

  const conceptLabel = escapeSTString(concept.definition || concept.title.slice(0, 80));
  bodyLines.push(`// Concepto ${conceptIdx + 1}: ${conceptLabel}`);

  for (const line of lines) {
    if (!pastHeader) {
      if (line.startsWith('// ═')) continue;
      if (line.startsWith('// Formalización automática')) continue;
      if (line.startsWith('// Perfil:')) continue;
      if (line.startsWith('// Idioma:')) continue;
      if (line.startsWith('// Patrones:')) continue;
      if (line.trim() === '' && bodyLines.length <= 1) continue;
      pastHeader = true;
    }
    bodyLines.push(line);
  }

  bodyLines.push('');
  return bodyLines.join('\n');
}

/** Fallback: genera interpret básico cuando autologic no puede formalizar */
function buildFallbackInterpret(
  concept: SemanticWorkspaceState['concepts'][number],
  fullText: string,
  conceptIdx: number,
  uniqueId: (base: string) => string
): string {
  const lines: string[] = [];
  const conceptLabel = escapeSTString(concept.definition || concept.title.slice(0, 80));

  if (concept.logicProfile) {
    lines.push(`logic ${concept.logicProfile}`);
    lines.push('');
  }

  lines.push(`// Concepto ${conceptIdx + 1}: ${conceptLabel} (fallback)`);
  const id = uniqueId(toSTIdentifier(concept.definition || concept.title, `CONCEPTO_${conceptIdx + 1}`));
  lines.push(`interpret "${escapeSTString(fullText)}" as ${id}`);

  if (concept.definition) {
    lines.push(`define ${id}_DEF = ${id} description "${conceptLabel}"`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Genera código ST para cada concepto usando autologic.
 *
 * Para cada concepto:
 *  - Si el usuario escribió una fórmula manual, se respeta y se agrega como axiom.
 *  - Si no hay fórmula manual, autologic formaliza el texto automáticamente.
 *  - Si autologic falla, se genera un interpret básico como fallback.
 */
const buildConceptDefines = (
  concepts: SemanticWorkspaceState['concepts'],
  fragments: SemanticWorkspaceState['fragments']
): string => {
  if (concepts.length === 0) return '';

  const sections: string[] = [
    '// ── Conceptos (formalización autologic) ────────────────',
    ''
  ];

  const usedIds = new Set<string>();
  const uniqueId = (base: string): string => {
    let id = base;
    let counter = 2;
    while (usedIds.has(id)) { id = `${base}_${counter}`; counter++; }
    usedIds.add(id);
    return id;
  };

  concepts.forEach((concept, conceptIdx) => {
    const sourceFragment = concept.sourceFragmentId
      ? fragments.find((fragment) => fragment.id === concept.sourceFragmentId)
      : undefined;
    const fullText = normalizeSemanticText(sourceFragment?.text || concept.excerpt || concept.title);
    const profile: LogicProfile = isValidProfile(concept.logicProfile)
      ? concept.logicProfile
      : 'classical.propositional';

    // ── Opción A: El usuario ya escribió una fórmula manual ──
    if (concept.formula && concept.formula.trim()) {
      const conceptLabel = escapeSTString(concept.definition || concept.title.slice(0, 80));
      if (concept.logicProfile) {
        sections.push(`logic ${concept.logicProfile}`);
        sections.push('');
      }
      sections.push(`// Concepto ${conceptIdx + 1}: ${conceptLabel}`);

      const id = uniqueId(toSTIdentifier(concept.definition || concept.title, `CONCEPTO_${conceptIdx + 1}`));
      sections.push(`interpret "${escapeSTString(fullText)}" as ${id}`);

      if (concept.definition) {
        sections.push(`define ${id}_DEF = ${id} description "${conceptLabel}"`);
      }

      const axiomId = uniqueId(`AX_${toSTIdentifier(concept.definition || concept.title, `CONCEPTO_${conceptIdx + 1}`)}`);
      sections.push(`axiom ${axiomId} = ${concept.formula.trim()}`);
      sections.push('');
      return;
    }

    // ── Opción B: Autologic formaliza automáticamente ──
    try {
      const result = formalize(fullText, {
        profile,
        language: 'es',
        atomStyle: 'keywords',
        includeComments: true
      });

      if (result.ok && result.stCode.trim()) {
        const stBody = extractSTBody(result.stCode, concept, conceptIdx);
        sections.push(stBody);

        for (const [atomId] of result.atoms) {
          usedIds.add(atomId);
        }
      } else {
        sections.push(buildFallbackInterpret(concept, fullText, conceptIdx, uniqueId));
      }
    } catch {
      sections.push(buildFallbackInterpret(concept, fullText, conceptIdx, uniqueId));
    }
  });

  return sections.join('\n');
};

/** Genera sección de evidencias como comentarios + interpret. */
const buildEvidenceSection = (
  fragments: SemanticWorkspaceState['fragments']
): string => {
  const evidence = fragments.filter((f) => f.kind === 'evidence');
  if (evidence.length === 0) return '';

  const lines = [
    '// ── Evidencias ────────────────────────────────────────',
    ''
  ];

  evidence.forEach((ev, i) => {
    const id = `EV_${i + 1}`;
    const text = escapeSTString(ev.excerpt || ev.text).slice(0, 120);
    const origin = ev.docName || 'Documento';
    lines.push(`// [${origin}] ${text}`);
    lines.push(`interpret "${text}" as ${id}`);
    lines.push('');
  });

  return lines.join('\n');
};

/** Genera sección de relaciones como comentarios descriptivos. */
const buildRelationsSection = (
  relations: SemanticWorkspaceState['relations'],
  fragments: SemanticWorkspaceState['fragments']
): string => {
  if (relations.length === 0) return '';

  const lines = [
    '// ── Relaciones ────────────────────────────────────────',
    ''
  ];

  relations.forEach((rel) => {
    const fragment = fragments.find((f) => f.id === rel.fragmentId);
    const excerpt = fragment
      ? escapeSTString(fragment.excerpt || fragment.text).slice(0, 80)
      : '(fragmento)';
    lines.push(`// ${rel.conceptTitle} ←→ "${excerpt}"`);
  });

  lines.push('');
  return lines.join('\n');
};

/** Genera sección de verificación (esqueleto). */
const buildVerificationSkeleton = (
  concepts: SemanticWorkspaceState['concepts']
): string => {
  if (concepts.length < 2) return '';

  const lines = [
    '// ── Verificación (esqueleto) ──────────────────────────',
    '// Descomenta y adapta las fórmulas para conectar conceptos.',
    ''
  ];

  const ids = concepts.slice(0, 5).map((c) =>
    toSTIdentifier(c.definition || c.title)
  );

  if (ids.length >= 2) {
    lines.push(`// axiom conexion_1 = ${ids[0]} -> ${ids[1]}`);
    lines.push(`// check valid (${ids[0]} -> ${ids[1]})`);
  }
  if (ids.length >= 3) {
    lines.push(`// derive ${ids[2]} from {conexion_1}`);
  }

  lines.push('');
  return lines.join('\n');
};

/**
 * Construye un script ST completo a partir del estado semántico.
 *
 * Usa autologic para formalizar automáticamente el texto de cada concepto.
 * Respeta fórmulas manuales escritas por el usuario.
 *
 * @param state  Estado actual de la Mesa Semántica
 * @param docName  Nombre del documento markdown origen
 * @returns Código ST listo para guardarse como archivo .st
 */
export function buildSTFromSemantic(
  state: SemanticWorkspaceState,
  docName: string
): string {
  const parts = [
    buildHeader(docName),
    buildConceptDefines(state.concepts, state.fragments),
    buildEvidenceSection(state.fragments),
    buildRelationsSection(state.relations, state.fragments),
    buildVerificationSkeleton(state.concepts)
  ];

  return `${parts.filter(Boolean).join('\n').trimEnd()}\n`;
}

/**
 * Nombre canónico del archivo .st companion para un documento markdown.
 */
export function companionSTName(docName: string): string {
  const base = docName
    .replace(/\.(md|markdown)$/i, '')
    .replace(/\s+/g, '_');
  return `${base}.md.st`;
}

/* ── Utilidad pública: formalizar texto individual ──────────── */

/**
 * Formaliza un texto individual usando autologic.
 * Útil para previews en el modal de definición de conceptos.
 */
export function formalizeText(
  text: string,
  profile?: string
): { ok: boolean; stCode: string; patterns: string[]; atomCount: number; formulaCount: number } {
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
