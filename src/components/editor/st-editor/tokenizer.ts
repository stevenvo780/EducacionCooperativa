import { ST_RUNTIME_KEYWORDS, ST_RUNTIME_PROFILE_IDS } from '@/lib/st-runtime-manifest';

/**
 * Tokenizer & syntax highlighting para el editor ST.
 * Extraído de STCodeEditor para modularidad.
 */

// ── Categorías de tokens ────────────────────────────────────

export type TokenCategory =
  | 'keyword'
  | 'builtin'
  | 'operator'
  | 'comment'
  | 'string'
  | 'number'
  | 'atom'
  | 'identifier'
  | 'profile'
  | 'punctuation'
  | 'paren' // rainbow parentheses
  | 'plain';

export interface HighlightToken {
  text: string;
  category: TokenCategory;
  /** Nesting depth for rainbow parens (0-based) */
  depth?: number;
}

// ── Conjuntos léxicos ───────────────────────────────────────

export const KEYWORDS = new Set(ST_RUNTIME_KEYWORDS);

export const BUILTINS = new Set([
  'valid', 'invalid', 'satisfiable', 'unsatisfiable', 'equivalent', 'claims',
  'typeof', 'is_valid', 'is_satisfiable', 'get_atoms', 'input',
  'valido', 'invalido', 'satisfacible', 'insatisfacible', 'equivalente'
]);

export const PROFILES = new Set(ST_RUNTIME_PROFILE_IDS);

// ── Helpers ─────────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function classifyWord(word: string): HighlightToken {
  const lower = word.toLowerCase();
  if (KEYWORDS.has(lower as any)) return { text: word, category: 'keyword' };
  if (BUILTINS.has(lower as any)) return { text: word, category: 'builtin' };
  if (/^[A-Z]$/.test(word)) return { text: word, category: 'atom' };
  return { text: word, category: 'identifier' };
}

// ── Tokenizador principal ───────────────────────────────────

const OPEN_PARENS = new Set(['(', '{']);
const CLOSE_PARENS = new Set([')', '}']);

/**
 * Tokeniza una línea de ST con soporte de rainbow parens.
 * @param line       Texto de la línea
 * @param parenDepth Profundidad actual de paréntesis (para continuidad entre líneas)
 * @returns          { tokens, parenDepth } — tokens y profundidad al final de la línea
 */
export function tokenizeLine(
  line: string,
  parenDepth: number = 0
): { tokens: HighlightToken[]; parenDepth: number } {
  const tokens: HighlightToken[] = [];
  let i = 0;
  let depth = parenDepth;

  while (i < line.length) {
    // ── 1. Comentario de línea ──
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.slice(i), category: 'comment' });
      return { tokens, parenDepth: depth };
    }

    // ── 1b. Comentario de bloque ──
    if (line[i] === '/' && line[i + 1] === '*') {
      let j = i + 2;
      while (j < line.length - 1 && !(line[j] === '*' && line[j + 1] === '/')) j++;
      if (j < line.length - 1) j += 2; else j = line.length;
      tokens.push({ text: line.slice(i, j), category: 'comment' });
      i = j;
      continue;
    }

    // ── 2. String literal ──
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      if (j < line.length) j++;
      tokens.push({ text: line.slice(i, j), category: 'string' });
      i = j;
      continue;
    }

    // ── 3. Double bracket literal ──
    if (line[i] === '[' && line[i + 1] === '[') {
      let j = i + 2;
      while (j < line.length - 1 && !(line[j] === ']' && line[j + 1] === ']')) j++;
      if (j < line.length - 1) j += 2; else j = line.length;
      tokens.push({ text: line.slice(i, j), category: 'string' });
      i = j;
      continue;
    }

    // ── 4. Rainbow parens ──
    if (OPEN_PARENS.has(line[i])) {
      tokens.push({ text: line[i], category: 'paren', depth });
      depth++;
      i++;
      continue;
    }
    if (CLOSE_PARENS.has(line[i])) {
      depth = Math.max(0, depth - 1);
      tokens.push({ text: line[i], category: 'paren', depth });
      i++;
      continue;
    }

    // ── 5. Operators (multi-char first) ──
    if (line[i] === '[' && line[i + 1] === ']') {
      tokens.push({ text: '[]', category: 'operator' });
      i += 2;
      continue;
    }
    if (line[i] === '<' && line[i + 1] === '-' && line[i + 2] === '>') {
      tokens.push({ text: '<->', category: 'operator' });
      i += 3;
      continue;
    }
    if (line[i] === '<' && line[i + 1] === '=') {
      tokens.push({ text: '<=', category: 'operator' });
      i += 2;
      continue;
    }
    if (line[i] === '>' && line[i + 1] === '=') {
      tokens.push({ text: '>=', category: 'operator' });
      i += 2;
      continue;
    }
    if (line[i] === '<' && line[i + 1] === '>') {
      tokens.push({ text: '<>', category: 'operator' });
      i += 2;
      continue;
    }
    if (line[i] === '!' && line[i + 1] === '&') {
      tokens.push({ text: '!&', category: 'operator' });
      i += 2;
      continue;
    }
    if (line[i] === '!' && line[i + 1] === '|') {
      tokens.push({ text: '!|', category: 'operator' });
      i += 2;
      continue;
    }
    if (line[i] === '-' && line[i + 1] === '>') {
      tokens.push({ text: '->', category: 'operator' });
      i += 2;
      continue;
    }
    if (line[i] === '<' && line[i + 1] === '-') {
      tokens.push({ text: '<-', category: 'operator' });
      i += 2;
      continue;
    }
    if ('~&|!=+-*/%^<>'.includes(line[i]) || line[i] === '≤' || line[i] === '≥' || line[i] === '⊕' || line[i] === '↑' || line[i] === '↓') {
      tokens.push({ text: line[i], category: 'operator' });
      i++;
      continue;
    }

    // ── 6. Punctuation ──
    if ('[],:;#'.includes(line[i])) {
      tokens.push({ text: line[i], category: 'punctuation' });
      i++;
      continue;
    }

    // ── 7. Number ──
    if (/\d/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\d.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), category: 'number' });
      i = j;
      continue;
    }

    // ── 8. Word ──
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_.]/.test(line[j])) j++;
      const word = line.slice(i, j);

      if (PROFILES.has(word as any)) {
        tokens.push({ text: word, category: 'profile' });
      } else {
        const parts = word.split('.');
        if (parts.length > 1 && !PROFILES.has(word as any)) {
          for (let p = 0; p < parts.length; p++) {
            if (p > 0) tokens.push({ text: '.', category: 'punctuation' });
            tokens.push(classifyWord(parts[p]));
          }
        } else {
          tokens.push(classifyWord(word));
        }
      }
      i = j;
      continue;
    }

    // ── 9. Whitespace ──
    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), category: 'plain' });
      i = j;
      continue;
    }

    // ── 10. Anything else ──
    tokens.push({ text: line[i], category: 'plain' });
    i++;
  }

  return { tokens, parenDepth: depth };
}

// ── CSS class mapping ───────────────────────────────────────

const TOKEN_CLASSES: Record<TokenCategory, string> = {
  keyword: 'st-keyword',
  builtin: 'st-builtin',
  operator: 'st-operator',
  comment: 'st-comment',
  string: 'st-string',
  number: 'st-number',
  atom: 'st-atom',
  identifier: 'st-identifier',
  profile: 'st-profile',
  punctuation: 'st-punctuation',
  paren: '', // handled specially for rainbow
  plain: ''
};

const RAINBOW_COLORS = 4; // st-paren-0 through st-paren-3

function tokenToHtml(t: HighlightToken): string {
  const escaped = escapeHtml(t.text);
  if (t.category === 'paren') {
    const cls = `st-paren-${(t.depth ?? 0) % RAINBOW_COLORS}`;
    return `<span class="${cls}">${escaped}</span>`;
  }
  const cls = TOKEN_CLASSES[t.category];
  return cls ? `<span class="${cls}">${escaped}</span>` : escaped;
}

// ── Highlight completo ──────────────────────────────────────

export function highlightCode(code: string): string {
  const lines = code.split('\n');
  let parenDepth = 0;
  const parts: string[] = [];

  for (const line of lines) {
    if (line === '') {
      parts.push('\n');
      continue;
    }
    const result = tokenizeLine(line, parenDepth);
    parenDepth = result.parenDepth;
    parts.push(result.tokens.map(tokenToHtml).join(''));
    parts.push('\n');
  }

  return parts.join('');
}

// ── Extract dynamic completions del código ──────────────────

export interface CompletionItem {
  label: string;
  kind: string;
  detail?: string;
  insertText?: string;
}

export function extractDynamicCompletions(code: string): CompletionItem[] {
  const items: CompletionItem[] = [];
  const lines = code.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const axiomMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:axiom|axioma)\s+(\w+)\s*[=:]/i);
    if (axiomMatch) {
      items.push({ label: axiomMatch[1], kind: 'variable', detail: 'axiom (definido en script)' });
    }
    const theoremMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:theorem|teorema)\s+(\w+)\s*[=:]/i);
    if (theoremMatch) {
      items.push({ label: theoremMatch[1], kind: 'variable', detail: 'theorem (definido en script)' });
    }
    const letMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:let|sea)\s+(\w+)\s*=/i);
    if (letMatch) {
      items.push({ label: letMatch[1], kind: 'variable', detail: 'let (definido en script)' });
    }
    const claimMatch = trimmed.match(/^(?:claim|afirmacion)\s+(\w+)\s*=/i);
    if (claimMatch) {
      items.push({ label: claimMatch[1], kind: 'variable', detail: 'claim (definido en script)' });
    }
    const theoryMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:theory|teoria)\s+(\w+)/i);
    if (theoryMatch) {
      items.push({ label: theoryMatch[1], kind: 'type', detail: 'theory (definida en script)' });
    }
    const fnMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:fn|funcion)\s+(\w+)\s*\(/i);
    if (fnMatch) {
      items.push({ label: fnMatch[1], kind: 'function', detail: 'función (definida en script)' });
    }
    const defineMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:define|definir)\s+(\w+)/i);
    if (defineMatch) {
      items.push({ label: defineMatch[1], kind: 'variable', detail: 'define (definido en script)' });
    }
    const sourceMatch = trimmed.match(/^(?:(?:export|exportar)\s+)?(?:source|fuente)\s+(\w+)/i);
    if (sourceMatch) {
      items.push({ label: sourceMatch[1], kind: 'variable', detail: 'source (definido en script)' });
    }
  }
  return items;
}

// ── Token-at-position (para hover info) ─────────────────────

export interface TokenAtPosition {
  text: string;
  category: TokenCategory;
  start: number; // column offset in line
  end: number;
  depth?: number;
}

/**
 * Obtiene el token en una posición (línea, columna).
 */
export function getTokenAtPosition(code: string, line: number, col: number): TokenAtPosition | null {
  const lines = code.split('\n');
  if (line < 1 || line > lines.length) return null;
  const lineText = lines[line - 1];
  const { tokens } = tokenizeLine(lineText);
  let offset = 0;
  for (const t of tokens) {
    const start = offset;
    const end = offset + t.text.length;
    if (col >= start && col < end) {
      return { text: t.text, category: t.category, start, end, depth: t.depth };
    }
    offset = end;
  }
  return null;
}
