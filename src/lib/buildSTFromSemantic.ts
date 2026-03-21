/**
 * Genera código ST (.st) a partir del estado semántico del editor.
 *
 * Convierte conceptos, evidencias y relaciones registradas en la
 * Mesa Semántica en declaraciones `interpret` y esqueletos de
 * verificación ejecutables por ST.
 */
import type { SemanticWorkspaceState } from '@/services/editorSemanticStore';

/** Stopwords en español para filtrar al generar identificadores. */
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

/**
 * Extrae 3-4 palabras clave de un texto, filtrando stopwords.
 * Produce identificadores legibles como TECNICA_NECESIDAD.
 */
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

/** Genera un identificador ST corto y legible a partir de texto. */
const toSTIdentifier = (text: string, fallback = 'CONCEPTO'): string => {
  const keywords = extractKeywords(text);
  if (keywords.length === 0) return fallback;
  const id = keywords.join('_').toUpperCase();
  // Asegurar que empiece con letra
  const safe = /^[A-Z]/.test(id) ? id : `C_${id}`;
  return safe.slice(0, 60);
};

/**
 * Subdivide un texto largo en cláusulas usando signos de puntuación.
 * Solo genera sub-cláusulas si tienen ≥ 3 palabras significativas.
 */
const splitIntoClauses = (text: string): string[] => {
  // Dividir por punto, punto y coma
  const sentences = text.split(/[.;]+/).map(s => s.trim()).filter(Boolean);
  const clauses: string[] = [];

  for (const sentence of sentences) {
    // Subdividir oraciones por coma solo si las partes son sustanciales
    const parts = sentence.split(/,/).map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1 || parts.every(p => p.split(/\s+/).length < 3)) {
      // La oración no se subdivide bien por comas → dejarla entera
      if (sentence.split(/\s+/).length >= 3) clauses.push(sentence);
    } else {
      for (const part of parts) {
        const wordCount = part.split(/\s+/).length;
        if (wordCount >= 3) clauses.push(part);
      }
    }
  }

  return clauses;
};

/** Escapa comillas dobles para strings ST. */
const escapeSTString = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');

/** Genera el bloque de encabezado. */
const buildHeader = (docName: string): string => [
  `// ═══════════════════════════════════════════════════════`,
  `// Interpretaciones ST`,
  `// Generado desde: ${docName}`,
  `// Fecha: ${new Date().toISOString().split('T')[0]}`,
  `// ═══════════════════════════════════════════════════════`,
  '',
  'logic classical.propositional',
  ''
].join('\n');

/** Genera declaraciones `interpret` y `define` para cada concepto semántico. */
const buildConceptDefines = (
  concepts: SemanticWorkspaceState['concepts']
): string => {
  if (concepts.length === 0) return '';

  const lines = [
    '// ── Conceptos ─────────────────────────────────────────',
    ''
  ];

  // Track used identifiers to avoid collisions
  const usedIds = new Set<string>();
  const uniqueId = (base: string): string => {
    let id = base;
    let counter = 2;
    while (usedIds.has(id)) { id = `${base}_${counter}`; counter++; }
    usedIds.add(id);
    return id;
  };

  concepts.forEach((concept, conceptIdx) => {
    const fullText = concept.excerpt || concept.title;
    const clauses = splitIntoClauses(fullText);
    const conceptLabel = concept.definition
      ? escapeSTString(concept.definition)
      : escapeSTString(concept.title.slice(0, 80));

    // Si el usuario eligió perfil lógico, emitirlo
    if (concept.logicProfile) {
      lines.push(`logic ${concept.logicProfile}`);
      lines.push('');
    }

    lines.push(`// Concepto ${conceptIdx + 1}: ${conceptLabel}`);

    if (clauses.length > 1) {
      // ── Subdivisión en cláusulas ──
      const clauseIds: string[] = [];
      clauses.forEach((clause) => {
        const id = uniqueId(toSTIdentifier(clause));
        clauseIds.push(id);
        lines.push(`interpret "${escapeSTString(clause)}" as ${id}`);
      });

      // Generar define que agrupa las sub-proposiciones
      if (concept.definition) {
        const groupId = uniqueId(toSTIdentifier(concept.definition, `CONCEPTO_${conceptIdx + 1}`));
        const conjunction = clauseIds.join(' & ');
        lines.push(`define ${groupId} = ${conjunction} description "${conceptLabel}"`);
      }
    } else {
      // Texto corto → un solo interpret
      const id = uniqueId(
        concept.definition
          ? toSTIdentifier(concept.definition, `CONCEPTO_${conceptIdx + 1}`)
          : toSTIdentifier(fullText, `CONCEPTO_${conceptIdx + 1}`)
      );
      lines.push(`interpret "${escapeSTString(fullText)}" as ${id}`);
      if (concept.definition) {
        lines.push(`define ${id}_DEF = ${id} description "${conceptLabel}"`);
      }
    }

    // Si el usuario escribió una fórmula, agregarla como axioma
    if (concept.formula) {
      const axiomId = uniqueId(`AX_${toSTIdentifier(concept.definition || concept.title, `CONCEPTO_${conceptIdx + 1}`)}`);
      lines.push(`axiom ${axiomId} = ${concept.formula}`);
    }

    lines.push('');
  });

  return lines.join('\n');
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
    buildConceptDefines(state.concepts),
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
  // Quitar extensiones .md / .markdown del nombre base
  const base = docName
    .replace(/\.(md|markdown)$/i, '')
    .replace(/\s+/g, '_');
  return `${base}.md.st`;
}
