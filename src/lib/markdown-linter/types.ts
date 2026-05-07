/**
 * Tipos compartidos del sistema de linting Markdown.
 *
 * Arquitectura estilo "plugin": cada regla es una función pura
 * (text → diagnostics) con metadatos que permiten activarla/desactivarla
 * desde la UI sin recompilar.
 */

export type LinterSeverity = 'error' | 'warning' | 'info';

export interface LinterDiagnostic {
  message: string;
  severity: LinterSeverity;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  source: string;
  suggestion?: string;
  /** El texto exacto que originó el diagnóstico (opcional) */
  text?: string;
  /** Replacement text(s) for quick-fix. Each entry is a clickable option. */
  replacements?: string[];
  /** Rule ID that generated this diagnostic (injected at aggregation level) */
  ruleId?: string;
}

export type RuleCategory =
  | 'spelling'
  | 'structure'
  | 'links'
  | 'readability'
  | 'accessibility'
  | 'consistency'
  | 'whitespace'
  | 'academic'
  | 'semantic'
  | 'citation'
  | 'thesis';

export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  spelling: 'Ortografía',
  structure: 'Estructura Markdown',
  links: 'Enlaces',
  readability: 'Legibilidad',
  accessibility: 'Accesibilidad',
  consistency: 'Consistencia',
  whitespace: 'Espacios en blanco',
  academic: 'Escritura académica',
  semantic: 'Semántica ST',
  citation: 'Citas y referencias',
  thesis: 'Formato de tesis'
};

export type ProfileId = 'default' | 'academic' | 'blog' | 'technical' | 'st-heavy' | 'thesis';

export interface LinterProfile {
  id: ProfileId;
  name: string;
  description: string;
}

export interface LinterRuleMeta {
  /** Identificador único (snake_case) */
  id: string;
  /** Nombre legible para la UI */
  name: string;
  /** Descripción corta de qué verifica */
  description: string;
  /** Categoría para agrupar en la UI */
  category: RuleCategory;
  /** ¿Activada por defecto? */
  defaultEnabled: boolean;
  /**
   * Si false, la regla necesita el documento completo y no puede ejecutarse
   * de forma incremental por párrafo. Por defecto: true.
   */
  supportsIncremental?: boolean;
}

export interface MathRange {
  from: number;
  to: number;
}

export interface HeadingInfo {
  line: number;
  level: number;
  text: string;
}

export interface BibliographyEntry {
  key: string;
  lineIdx: number;
  raw: string;
}

/**
 * Contexto pre-computado compartido entre reglas durante un mismo lint pass.
 * Pre-computar trabajo redundante (codeBlockLines, lines split, math ranges,
 * headings, bibliografía, etc.) evita que cada regla rehaga el mismo escaneo
 * sobre el mismo texto.
 *
 * Si el contexto no llega (ej. reglas custom de plugins externos), las reglas
 * lo derivan internamente como antes. Por eso es opcional.
 */
export interface LinterRuleContext {
  /** `text.split('\n')` cacheado */
  lines: string[];
  /** Resultado de `getCodeBlockLines(lines)` cacheado */
  codeBlockLines: Set<number>;
  /** Rangos de fórmulas LaTeX por línea (`$...$`, `$$...$$`). Compartido por reglas spelling. */
  mathRangesByLine: Map<number, MathRange[]>;
  /** Encabezados markdown del documento. Compartido por reglas thesis. */
  headings: HeadingInfo[];
  /** Índice (0-based) de la línea donde empieza la sección Referencias/Bibliografía, o `null`. */
  bibliographySectionLineIdx: number | null;
  /** Entradas bibliográficas pre-extraídas. Compartidas por las reglas citation. */
  bibliographyEntries: BibliographyEntry[];
}

export interface LinterRule extends LinterRuleMeta {
  /** Función pura: recibe texto markdown (y contexto opcional pre-computado), devuelve diagnósticos */
  check: (text: string, ctx?: LinterRuleContext) => LinterDiagnostic[];
}

const HEADING_REGEX = /^(#{1,6})\s+(.+)/;
const BIBLIOGRAPHY_HEADING_REGEX = /^#{1,3}\s+(referencias?|bibliografía|bibliography|fuentes?|works\s+cited|literatura\s+citada)\s*$/i;
const BIBLIOGRAPHY_ENTRY_REGEX = /^([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:[A-Za-záéíóúüñ\s,\.]+)?)\s*\((\d{4}[a-z]?)\)/;

function isEscapedDollarChar(line: string, index: number): boolean {
  let backslashes = 0;
  for (let pos = index - 1; pos >= 0 && line[pos] === '\\'; pos--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

function computeMathRangesByLine(lines: readonly string[]): Map<number, MathRange[]> {
  const rangesByLine = new Map<number, MathRange[]>();
  let current:
    | { delimiter: '$' | '$$'; startLine: number; startCol: number }
    | null = null;

  const push = (startLine: number, startCol: number, endLine: number, endCol: number): void => {
    for (let line = startLine; line <= endLine; line++) {
      const lineStart = line === startLine ? startCol : 0;
      const lineEnd = line === endLine ? endCol : Number.POSITIVE_INFINITY;
      const list = rangesByLine.get(line);
      const range: MathRange = { from: lineStart, to: lineEnd };
      if (list) list.push(range);
      else rangesByLine.set(line, [range]);
    }
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex] ?? '';

    for (let column = 0; column < line.length; column++) {
      if (line[column] !== '$') continue;
      if (isEscapedDollarChar(line, column)) continue;

      const delimiter: '$' | '$$' = line[column + 1] === '$' && !isEscapedDollarChar(line, column + 1)
        ? '$$'
        : '$';
      const delimiterLength = delimiter.length;

      if (!current) {
        current = { delimiter, startLine: lineIndex, startCol: column };
        column += delimiterLength - 1;
        continue;
      }

      if (current.delimiter !== delimiter) continue;

      push(current.startLine, current.startCol, lineIndex, column + delimiterLength);
      current = null;
      column += delimiterLength - 1;
    }
  }

  return rangesByLine;
}

function computeHeadings(lines: readonly string[], codeBlockLines: Set<number>): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (codeBlockLines.has(i)) continue;
    const match = (lines[i] ?? '').match(HEADING_REGEX);
    const hashes = match?.[1];
    const headingText = match?.[2];
    if (hashes && headingText) {
      headings.push({ line: i, level: hashes.length, text: headingText.trim() });
    }
  }
  return headings;
}

function computeBibliographySectionLineIdx(lines: readonly string[]): number | null {
  for (let i = 0; i < lines.length; i++) {
    if (BIBLIOGRAPHY_HEADING_REGEX.test((lines[i] ?? '').trim())) return i;
  }
  return null;
}

function computeBibliographyEntries(lines: readonly string[], bibStart: number | null): BibliographyEntry[] {
  if (bibStart === null) return [];
  const entries: BibliographyEntry[] = [];
  for (let i = bibStart + 1; i < lines.length; i++) {
    const raw = (lines[i] ?? '').trim();
    const match = raw.match(BIBLIOGRAPHY_ENTRY_REGEX);
    if (!match) continue;
    const firstAuthor = (match[1] ?? '').split(',')[0]?.trim().split(/\s+/).pop();
    const year = match[2];
    if (!firstAuthor || !year) continue;
    entries.push({ key: `${firstAuthor.toLowerCase()}_${year}`, lineIdx: i, raw });
  }
  return entries;
}

/**
 * Construye un contexto para un texto. Pasar el contexto resultante a cada
 * regla en un mismo pass evita que cada regla rehaga `text.split`,
 * `getCodeBlockLines`, math-ranges, headings y entradas bibliográficas por
 * separado.
 */
export function buildLinterRuleContext(text: string): LinterRuleContext {
  const lines = text.split('\n');
  const codeBlockLines = getCodeBlockLines(lines);
  const mathRangesByLine = computeMathRangesByLine(lines);
  const headings = computeHeadings(lines, codeBlockLines);
  const bibliographySectionLineIdx = computeBibliographySectionLineIdx(lines);
  const bibliographyEntries = computeBibliographyEntries(lines, bibliographySectionLineIdx);
  return {
    lines,
    codeBlockLines,
    mathRangesByLine,
    headings,
    bibliographySectionLineIdx,
    bibliographyEntries
  };
}

export function lineAt(lines: readonly string[], index: number): string {
  return lines[index] ?? '';
}

/**
 * Detecta si una línea está dentro de un bloque de código fenced.
 * Devuelve un Set con los índices de línea que están en code blocks.
 */
export function getCodeBlockLines(lines: string[]): Set<number> {
  const inCode = new Set<number>();
  let inside = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lineAt(lines, i).trim();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCode.add(i);
      inside = !inside;
    } else if (inside) {
      inCode.add(i);
    }
  }
  return inCode;
}

/**
 * Escape regex special characters.
 */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
