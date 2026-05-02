/**
 * ST Language support para CodeMirror 6.
 *
 * Usa StreamLanguage (parser streaming basado en tokens) en lugar de Lezer grammar completo,
 * reutilizando los conjuntos léxicos ya definidos en st-editor/tokenizer.ts.
 * Incluye indentación inteligente para bloques ST (proof/qed, etc.)
 */

import { StreamLanguage, StringStream, LanguageSupport, indentService, foldService } from '@codemirror/language';
import { KEYWORDS, BUILTINS, PROFILES } from '../st-editor/tokenizer';

const _MULTI_OPS: Record<string, true> = {
  '<->': true,
  '->': true,
  '<-': true,
  '[]': true,
  '<>': true,
  '<=': true,
  '>=': true
};

interface STState {
  /** Depth de paréntesis/llaves (para rainbow) */
  parenDepth: number;
  /** Dentro de bloque comentario? */
  inBlockComment: boolean;
  /** Dentro de literal [[...]] ? */
  inDoubleBracket: boolean;
}

const stStreamParser = {
  name: 'st',

  startState(): STState {
    return { parenDepth: 0, inBlockComment: false, inDoubleBracket: false };
  },

  token(stream: StringStream, state: STState): string | null {
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

    if (stream.eatSpace()) return null;

    if (stream.match('//')) {
      stream.skipToEnd();
      return 'lineComment';
    }

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

    if (stream.peek() === '"') {
      stream.next();
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"') break;
      }
      return 'string';
    }

    if (stream.match('<->')) return 'operator';
    if (stream.match('<=')) return 'operator';
    if (stream.match('>=')) return 'operator';
    if (stream.match('->')) return 'operator';
    if (stream.match('<-')) return 'operator';
    if (stream.match('<>')) return 'operator';
    if (stream.match('!&')) return 'operator';
    if (stream.match('!|')) return 'operator';
    if (stream.match('[]') && stream.string.charAt(stream.pos - 3) !== '[') {
      // Only if not part of [[ (already handled above)
      return 'operator';
    }

    const ch = stream.peek();
    if (ch && '~&|!=+-*/%^<>'.includes(ch)) {
      stream.next();
      return 'operator';
    }
    if (ch === '≤' || ch === '≥' || ch === '⊕' || ch === '↑' || ch === '↓' || ch === '¬' || ch === '∧' || ch === '∨' || ch === '→' || ch === '↔' || ch === '⊢' || ch === '⊥' || ch === '⊤') {
      stream.next();
      return 'operator';
    }

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

    if (ch && '[],:;#'.includes(ch)) {
      stream.next();
      return 'punctuation';
    }

    if (ch && /\d/.test(ch)) {
      stream.match(/^\d+(\.\d+)?/);
      return 'number';
    }

    if (ch && /[a-zA-Z_]/.test(ch)) {
      stream.match(/^[a-zA-Z0-9_.]+/);
      const word = stream.current();
      const lower = word.toLowerCase();

      if (PROFILES.has(word as Parameters<typeof PROFILES.has>[0]) || PROFILES.has(lower as Parameters<typeof PROFILES.has>[0])) return 'typeName';
      if (KEYWORDS.has(lower as Parameters<typeof KEYWORDS.has>[0])) return 'keyword';
      if (BUILTINS.has(lower as Parameters<typeof BUILTINS.has>[0])) return 'builtin';
      // Uppercase single letters → atoms
      if (/^[A-Z]$/.test(word)) return 'atom';
      return 'variableName';
    }

    stream.next();
    return null;
  },

  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '{', '"', '['] }
  }
};

export const stLanguage = StreamLanguage.define(stStreamParser);

/**
 * Indentación inteligente para bloques ST.
 * - Después de una línea que abre bloque con `{` → indentar +2
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

  // After lines ending with "{" → indent +2
  if (prevText.endsWith('{')) {
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

const stFoldService = foldService.of((state, lineStart, _lineEnd) => {
  const doc = state.doc;
  const line = doc.lineAt(lineStart);
  const text = line.text;
  const trimmed = text.trim();

  if (trimmed.startsWith('//')) {
    let endLine = line.number;
    while (endLine < doc.lines && doc.line(endLine + 1).text.trim().startsWith('//')) {
      endLine += 1;
    }

    if (endLine > line.number) {
      return { from: line.to, to: doc.line(endLine).to };
    }
  }

  if (trimmed.startsWith('/*')) {
    const closingIndex = doc.sliceString(line.to, doc.length).indexOf('*/');
    if (closingIndex >= 0) {
      return { from: line.from + text.indexOf('/*') + 2, to: line.to + closingIndex + 2 };
    }
  }

  const openBraceIndex = text.indexOf('{');
  if (openBraceIndex >= 0) {
    let depth = 0;
    for (let position = line.from + openBraceIndex; position < doc.length; position += 1) {
      const ch = doc.sliceString(position, position + 1);
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return {
            from: line.from + openBraceIndex + 1,
            to: position
          };
        }
      }
    }
  }

  return null;
});

/**
 * Full language support for ST files in CodeMirror 6.
 */
export function stLanguageSupport(): LanguageSupport {
  return new LanguageSupport(stLanguage, [stIndentService, stFoldService]);
}
