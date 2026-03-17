/**
 * ST Language support para CodeMirror 6.
 *
 * Usa StreamLanguage (parser streaming basado en tokens) en lugar de Lezer grammar completo,
 * reutilizando los conjuntos léxicos ya definidos en st-editor/tokenizer.ts.
 * Incluye indentación inteligente para bloques ST (proof/qed, etc.)
 */

import { StreamLanguage, StringStream, LanguageSupport, indentService } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { KEYWORDS, BUILTINS, PROFILES } from '../st-editor/tokenizer';

// ── Operators multi-char ────────────────────────────────────

const MULTI_OPS: Record<string, true> = {
  '<->': true,
  '->': true,
  '<-': true,
  '[]': true,
  '<>': true
};

// ── State ───────────────────────────────────────────────────

interface STState {
  /** Depth de paréntesis/llaves (para rainbow) */
  parenDepth: number;
  /** Dentro de bloque comentario? */
  inBlockComment: boolean;
  /** Dentro de literal [[...]] ? */
  inDoubleBracket: boolean;
}

// ── Stream parser ───────────────────────────────────────────

const stStreamParser = {
  name: 'st',

  startState(): STState {
    return { parenDepth: 0, inBlockComment: false, inDoubleBracket: false };
  },

  token(stream: StringStream, state: STState): string | null {
    // ── Continue block comment ──
    if (state.inBlockComment) {
      const endIdx = stream.string.indexOf('*/', stream.pos);
      if (endIdx === -1) {
        stream.skipToEnd();
      } else {
        stream.pos = endIdx + 2;
        state.inBlockComment = false;
      }
      return 'blockComment';
    }

    // ── Continue [[ ... ]] literal ──
    if (state.inDoubleBracket) {
      const endIdx = stream.string.indexOf(']]', stream.pos);
      if (endIdx === -1) {
        stream.skipToEnd();
      } else {
        stream.pos = endIdx + 2;
        state.inDoubleBracket = false;
      }
      return 'string';
    }

    // ── Skip whitespace ──
    if (stream.eatSpace()) return null;

    // ── Line comment ──
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'lineComment';
    }

    // ── Block comment start ──
    if (stream.match('/*')) {
      state.inBlockComment = true;
      const endIdx = stream.string.indexOf('*/', stream.pos);
      if (endIdx === -1) {
        stream.skipToEnd();
      } else {
        stream.pos = endIdx + 2;
        state.inBlockComment = false;
      }
      return 'blockComment';
    }

    // ── Double bracket literal [[ ... ]] ──
    if (stream.match('[[')) {
      state.inDoubleBracket = true;
      const endIdx = stream.string.indexOf(']]', stream.pos);
      if (endIdx === -1) {
        stream.skipToEnd();
      } else {
        stream.pos = endIdx + 2;
        state.inDoubleBracket = false;
      }
      return 'string';
    }

    // ── String literal ──
    if (stream.peek() === '"') {
      stream.next();
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"') break;
      }
      return 'string';
    }

    // ── Multi-char operators ──
    if (stream.match('<->')) return 'operator';
    if (stream.match('->')) return 'operator';
    if (stream.match('<-')) return 'operator';
    if (stream.match('<>')) return 'operator';
    if (stream.match('[]') && stream.string.charAt(stream.pos - 3) !== '[') {
      // Only if not part of [[ (already handled above)
      return 'operator';
    }

    // ── Single-char operators ──
    const ch = stream.peek();
    if (ch && '~&|!='.includes(ch)) {
      stream.next();
      return 'operator';
    }

    // ── Parens / braces (coloreados por el ViewPlugin rainbow-parens) ──
    if (ch === '(' || ch === '{') {
      state.parenDepth++;
      stream.next();
      return 'punctuation';
    }
    if (ch === ')' || ch === '}') {
      state.parenDepth = Math.max(0, state.parenDepth - 1);
      stream.next();
      return 'punctuation';
    }

    // ── Punctuation ──
    if (ch && '[],:;#'.includes(ch)) {
      stream.next();
      return 'punctuation';
    }

    // ── Numbers ──
    if (ch && /\d/.test(ch)) {
      stream.match(/^\d+(\.\d+)?/);
      return 'number';
    }

    // ── Words (keywords, builtins, profiles, atoms, identifiers) ──
    if (ch && /[a-zA-Z_]/.test(ch)) {
      stream.match(/^[a-zA-Z0-9_.]+/);
      const word = stream.current();
      const lower = word.toLowerCase();

      if (PROFILES.has(word) || PROFILES.has(lower)) return 'typeName';
      if (KEYWORDS.has(lower)) return 'keyword';
      if (BUILTINS.has(lower)) return 'builtin';
      // Uppercase single letters → atoms
      if (/^[A-Z]$/.test(word)) return 'atom';
      return 'variableName';
    }

    // ── Anything else ──
    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '{', '"', '['] }
  }
};

// ── Language instance ───────────────────────────────────────

export const stLanguage = StreamLanguage.define(stStreamParser);

// ── Smart indentation for ST ────────────────────────────────

/**
 * Indentación inteligente para bloques ST.
 * - Después de `proof {` → indentar +2
 * - `} qed` → des-indentar
 * - Mantener indentación del contexto
 */
const stIndentService = indentService.of((context, pos) => {
  const doc = context.state.doc;
  const currentLine = doc.lineAt(pos);
  if (currentLine.number <= 1) return null;

  const prevLine = doc.line(currentLine.number - 1);
  const prevText = prevLine.text.trimEnd();
  const prevIndent = prevLine.text.match(/^(\s*)/)?.[1].length ?? 0;

  // After "proof {" or lines ending with "{" → indent +2
  if (prevText.endsWith('{') || /\bproof\s*\{?\s*$/.test(prevText)) {
    return prevIndent + 2;
  }

  // After "assume" or "show" inside proof → maintain indent
  if (/^\s*(assume|show|asumir|demostrar)\b/.test(prevText)) {
    return prevIndent;
  }

  // Current line starts with "}" or "qed" → deindent
  const currentText = currentLine.text.trim();
  if (currentText.startsWith('}') || currentText.startsWith('qed')) {
    return Math.max(0, prevIndent - 2);
  }

  return null; // Fall back to default
});

/**
 * Full language support for ST files in CodeMirror 6.
 */
export function stLanguageSupport(): LanguageSupport {
  return new LanguageSupport(stLanguage, [stIndentService]);
}
