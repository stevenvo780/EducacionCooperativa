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

export interface LinterRule extends LinterRuleMeta {
  /** Función pura: recibe texto markdown, devuelve diagnósticos */
  check: (text: string) => LinterDiagnostic[];
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
