/**
 * Genera código ST (.st) a partir del estado semántico del editor.
 *
 * Convierte conceptos, evidencias y relaciones registradas en la
 * Mesa Semántica en declaraciones `interpret` y esqueletos de
 * verificación ejecutables por ST.
 */
import type { SemanticWorkspaceState } from '@/services/editorSemanticStore';

/** Sanitiza texto para usarlo como identificador ST válido. */
const toSTIdentifier = (text: string): string => {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();
  // Asegurar que empiece con letra
  const safe = /^[A-Z]/.test(normalized) ? normalized : `C_${normalized}`;
  return safe.slice(0, 60) || 'CONCEPTO';
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

  concepts.forEach((concept) => {
    const id = toSTIdentifier(concept.title);
    const desc = escapeSTString(concept.excerpt || concept.title);
    // interpret es un statement de nivel top; define solo acepta fórmulas.
    // Usamos interpret para mapear texto→proposición y opcionalmente
    // define como alias si hay definición adicional.
    if (concept.definition) {
      const def = escapeSTString(concept.definition);
      lines.push(`// Definición: ${def}`);
      lines.push(`interpret "${desc}" as ${id}`);
      lines.push(`define ${id}_DEF = ${id} description "${def}"`);
    } else {
      lines.push(`interpret "${desc}" as ${id}`);
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

  const ids = concepts.slice(0, 5).map((c) => toSTIdentifier(c.title));

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
