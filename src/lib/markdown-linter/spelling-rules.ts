import {
  type LinterRule,
  type LinterDiagnostic,
  type LinterRuleContext,
  getCodeBlockLines,
  lineAt
} from './types';
import { isSpellEngineReady, isCorrect, suggest } from './spell-engine';

function restoreSuggestionCase(original: string, suggestion: string): string {
  if (original === original.toUpperCase()) return suggestion.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) {
    return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
  }
  return suggestion;
}

const WORD_REGEX = /\b[\p{L}\p{M}][\p{L}\p{M}'’-]*\b/gu;

type Range = { start: number; end: number };

function isEscapedDollar(text: string, index: number): boolean {
  let backslashes = 0;
  for (let pos = index - 1; pos >= 0 && text[pos] === '\\'; pos--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

function pushMathRange(rangesByLine: Range[][], startLine: number, startCol: number, endLine: number, endCol: number): void {
  for (let line = startLine; line <= endLine; line++) {
    const lineStart = line === startLine ? startCol : 0;
    const lineEnd = line === endLine ? endCol : Number.POSITIVE_INFINITY;
    rangesByLine[line]?.push({ start: lineStart, end: lineEnd });
  }
}

function getMathRangesByLine(lines: string[]): Range[][] {
  const rangesByLine = lines.map((): Range[] => []);
  let current:
    | { delimiter: '$' | '$$'; startLine: number; startCol: number }
    | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lineAt(lines, lineIndex);

    for (let column = 0; column < line.length; column++) {
      if (line[column] !== '$') continue;
      if (isEscapedDollar(line, column)) continue;

      const delimiter: '$' | '$$' = line[column + 1] === '$' && !isEscapedDollar(line, column + 1)
        ? '$$'
        : '$';
      const delimiterLength = delimiter.length;

      if (!current) {
        current = { delimiter, startLine: lineIndex, startCol: column };
        column += delimiterLength - 1;
        continue;
      }

      if (current.delimiter !== delimiter) continue;

      pushMathRange(
        rangesByLine,
        current.startLine,
        current.startCol,
        lineIndex,
        column + delimiterLength
      );
      current = null;
      column += delimiterLength - 1;
    }
  }

  return rangesByLine;
}

function overlapsMathRange(ranges: Range[], start: number, end: number): boolean {
  return ranges.some(range => start < range.end && end > range.start);
}

function matchesAccentPattern(word: string): boolean {
  return ACCENT_SUFFIX_RULES.some(rule => {
    rule.pattern.lastIndex = 0;
    return rule.pattern.test(word);
  });
}

export const spellingRule: LinterRule = {
  id: 'spelling_typos',
  name: 'Errores ortográficos',
  description: 'Detecta errores ortográficos usando el diccionario Hunspell en memoria.',
  category: 'spelling',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const mathRangesByLine = getMathRangesByLine(lines);
    const spellReady = isSpellEngineReady();

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      WORD_REGEX.lastIndex = 0;
      let wordMatch;
      while ((wordMatch = WORD_REGEX.exec(line)) !== null) {
        const word = wordMatch[0];
        const start = wordMatch.index;
        const end = start + word.length;

        if (!spellReady) continue;
        if (overlapsMathRange(mathRangesByLine[lineIdx] ?? [], start, end)) continue;
        if (word.length <= 2) continue;
        if (/^\d+$/.test(word)) continue;
        if (matchesAccentPattern(word)) continue;
        if (isCorrect(word)) continue;

        const replacements = suggest(word).map(option => restoreSuggestionCase(word, option));
        results.push({
          message: `Posible error ortográfico: "${word}"`,
          suggestion: replacements.length > 0
            ? `¿Quisiste decir "${replacements[0]}"?`
            : 'Revisa la ortografía de esta palabra.',
          severity: 'warning',
          line: lineIdx + 1,
          column: start + 1,
          endLine: lineIdx + 1,
          endColumn: end + 1,
          source: 'Spelling',
          replacements
        });
      }
    }
    return results;
  }
};

export const doubledWordsRule: LinterRule = {
  id: 'spelling_doubled_words',
  name: 'Palabras duplicadas',
  description: 'Detecta palabras repetidas consecutivamente (ej: "el el", "de de").',
  category: 'spelling',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const mathRangesByLine = getMathRangesByLine(lines);
    const regex = /\b(\w{2,})\s+\1\b/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      let match;
      while ((match = regex.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (overlapsMathRange(mathRangesByLine[lineIdx] ?? [], start, end)) continue;
        const repeatedWord = match[1];
        if (!repeatedWord) continue;
        results.push({
          message: `Palabra duplicada: "${repeatedWord} ${repeatedWord}"`,
          suggestion: 'Elimina una de las repeticiones.',
          severity: 'warning',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Spelling',
          replacements: [repeatedWord]
        });
      }
    }
    return results;
  }
};

const ACCENT_SUFFIX_RULES: Array<{
  pattern: RegExp;
  fix: (m: string) => string;
  msg: string;
}> = [
  {
    pattern: /\b([a-záéíóúñü]{2,})cion\b/gi,
    fix: (m) => `${m.slice(0, -4)}ción`,
    msg: 'Falta tilde: las palabras terminadas en "-ción" llevan acento.'
  },
  {
    pattern: /\b([a-záéíóúñü]{2,})sion\b/gi,
    fix: (m) => `${m.slice(0, -4)}sión`,
    msg: 'Falta tilde: las palabras terminadas en "-sión" llevan acento.'
  },
  {
    pattern: /\b([a-záéíóúñü]{2,})gion\b/gi,
    fix: (m) => `${m.slice(0, -4)}gión`,
    msg: 'Falta tilde: las palabras terminadas en "-gión" llevan acento.'
  },
  {
    pattern: /\b([a-záéíóúñü]{2,}[^áéíóú])tico(s|a|as)?\b/gi,
    fix: (m) => {
      const idx = m.lastIndexOf('tico');
      if (idx < 0) return m;
      const prefix = m.slice(0, idx);
      const lastVowel = prefix.match(/[aeiou]$/i);
      if (lastVowel) {
        const accentMap: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
        const accented = accentMap[lastVowel[0].toLowerCase()] ?? lastVowel[0];
        return prefix.slice(0, -1) + accented + m.slice(idx);
      }
      return m;
    },
    msg: 'Posible esdrújula sin tilde (terminación "-tico").'
  },
  {
    pattern: /\b([a-záéíóúñü]+)logico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/logico/i, 'lógico'),
    msg: 'Falta tilde: "-lógico" es esdrújula.'
  },
  {
    pattern: /\b([a-záéíóúñü]+)grafico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/grafico/i, 'gráfico'),
    msg: 'Falta tilde: "-gráfico" es esdrújula.'
  },
  {
    pattern: /\b([a-záéíóúñü]+)nomico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/nomico/i, 'nómico'),
    msg: 'Falta tilde: "-nómico" es esdrújula.'
  },
  {
    pattern: /\b([a-záéíóúñü]+)metrico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/metrico/i, 'métrico'),
    msg: 'Falta tilde: "-métrico" es esdrújula.'
  },
  {
    pattern: /\b([a-záéíóúñü]+)fonico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/fonico/i, 'fónico'),
    msg: 'Falta tilde: "-fónico" es esdrújula.'
  },
  {
    pattern: /\b([a-záéíóúñü]+)sofico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/sofico/i, 'sófico'),
    msg: 'Falta tilde: "-sófico" es esdrújula.'
  },
  {
    pattern: /\b([a-záéíóúñü]+)gogico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/gogico/i, 'gógico'),
    msg: 'Falta tilde: "-gógico" es esdrújula.'
  },
  {
    pattern: /\btambien\b/gi,
    fix: () => 'también',
    msg: 'Falta tilde: "también" es aguda terminada en "n".'
  },
  {
    pattern: /\bademas\b/gi,
    fix: () => 'además',
    msg: 'Falta tilde: "además" es aguda terminada en "s".'
  },
  {
    pattern: /\btodavia\b/gi,
    fix: () => 'todavía',
    msg: 'Falta tilde: "todavía" lleva acento por hiato.'
  },
  {
    pattern: /\bdespues\b/gi,
    fix: () => 'después',
    msg: 'Falta tilde: "después" es aguda terminada en "s".'
  },
  {
    pattern: /\btraves\b/gi,
    fix: () => 'través',
    msg: 'Falta tilde: "través" es aguda terminada en "s".'
  },
  {
    pattern: /\bmetodo(s)?\b/gi,
    fix: (m) => m.replace(/metodo/i, 'método'),
    msg: 'Falta tilde: "método" es esdrújula.'
  },
  {
    pattern: /\bnumero(s)?\b/gi,
    fix: (m) => m.replace(/numero/i, 'número'),
    msg: 'Falta tilde: "número" es esdrújula.'
  },
  {
    pattern: /\bultimo(s|a|as)?\b/gi,
    fix: (m) => m.replace(/ultimo/i, 'último'),
    msg: 'Falta tilde: "último" es esdrújula.'
  },
  {
    pattern: /\bpublico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/publico/i, 'público'),
    msg: 'Falta tilde: "público" es esdrújula.'
  },
  {
    pattern: /\bproposito(s)?\b/gi,
    fix: (m) => m.replace(/proposito/i, 'propósito'),
    msg: 'Falta tilde: "propósito" es esdrújula.'
  }
];

export const accentPatternRule: LinterRule = {
  id: 'spelling_accent_patterns',
  name: 'Tildes faltantes (patrones)',
  description: 'Detecta palabras que necesitan tilde usando patrones morfológicos del español (-ción, -sión, esdrújulas, etc.)',
  category: 'spelling',
  defaultEnabled: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const mathRangesByLine = getMathRangesByLine(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);

      for (const rule of ACCENT_SUFFIX_RULES) {
        let match;
        rule.pattern.lastIndex = 0;
        while ((match = rule.pattern.exec(line)) !== null) {
          const word = match[0];
          const start = match.index;
          const end = start + word.length;
          if (overlapsMathRange(mathRangesByLine[lineIdx] ?? [], start, end)) continue;
          if (/[áéíóú]/i.test(word)) continue;

          const fixed = rule.fix(word);
          if (fixed.toLowerCase() === word.toLowerCase()) continue;

          results.push({
            message: `${rule.msg} "${word}" → "${fixed}"`,
            suggestion: `Cambiar a "${fixed}"`,
            severity: 'warning',
            line: lineIdx + 1,
            column: start + 1,
            endLine: lineIdx + 1,
            endColumn: end + 1,
            source: 'Spelling',
            replacements: [fixed]
          });
        }
      }
    }
    return results;
  }
};

const INVALID_DOUBLE_CONSONANTS = /([bdfghjkmpqstvwxyz])\1/gi;
const TRIPLE_LETTER = /([a-záéíóúñü])\1\1/gi;
const WORD_START_IMPOSSIBLE = /\b([nm][bcdfgjklmnpqrstvwxyz](?=[a-záéíóúñü]))/gi;
const SUSPICIOUS_WHITELIST = new Set([
  'innato', 'innata', 'innovar', 'innovación', 'innovador', 'innecesario',
  'innoble', 'innombrable', 'perenne', 'biennal', 'connotar', 'connotación',
  'ennegrecer', 'cannabis', 'connectar', 'connivencia', 'connatural',
  'innegable', 'innocuo', 'innocua', 'innumerable', 'innumerables',
  'ennegrecer', 'ennoblecimiento', 'ennoblecer', 'innominado',
  'sinnúmero', 'sinrazón', 'perruno', 'perrito', 'perrita',
  'carretera', 'carretilla', 'arrojar', 'arroyo', 'arroz',
  'corredor', 'correlación', 'corresponder', 'corriente',
  'narración', 'narrativa', 'narrador', 'erróneo', 'error',
  'terror', 'terrible', 'llevar', 'llegar', 'llave', 'lluvia',
  'llamar', 'llamada', 'lleno', 'llenado', 'llanura', 'lloriquear',
  'acceso', 'acción', 'accidente', 'occidental', 'occiput',
  'acceder', 'accesible', 'accesibilidad', 'accionar', 'accidentado'
]);

export const suspiciousPatternsRule: LinterRule = {
  id: 'spelling_suspicious_patterns',
  name: 'Secuencias de caracteres sospechosas',
  description: 'Detecta combinaciones de letras imposibles o muy raras en español (consonantes dobles inválidas, triples letras, inicios imposibles).',
  category: 'spelling',
  defaultEnabled: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const mathRangesByLine = getMathRangesByLine(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      const wordRegex = /\b[a-záéíóúñü]{3,}\b/gi;
      let wordMatch;

      while ((wordMatch = wordRegex.exec(line)) !== null) {
        const word = wordMatch[0];
        const start = wordMatch.index;
        const end = start + word.length;
        if (overlapsMathRange(mathRangesByLine[lineIdx] ?? [], start, end)) continue;
        const lower = word.toLowerCase();
        if (SUSPICIOUS_WHITELIST.has(lower)) continue;

        INVALID_DOUBLE_CONSONANTS.lastIndex = 0;
        const dblMatch = INVALID_DOUBLE_CONSONANTS.exec(lower);
        if (dblMatch) {
          const pair = dblMatch[0];
          results.push({
            message: `Secuencia sospechosa "${pair}" en "${word}" — en español solo "rr", "ll", "cc" y "nn" son consonantes dobles válidas.`,
            suggestion: `Revisa la ortografía de "${word}".`,
            severity: 'info',
            line: lineIdx + 1,
            column: start + 1,
            endLine: lineIdx + 1,
            endColumn: end + 1,
            source: 'Spelling'
          });
          continue;
        }

        TRIPLE_LETTER.lastIndex = 0;
        const tripleMatch = TRIPLE_LETTER.exec(lower);
        if (tripleMatch) {
          results.push({
            message: `Triple letra "${tripleMatch[0]}" en "${word}" — probablemente un error de tecleo.`,
            suggestion: `Revisa la ortografía de "${word}".`,
            severity: 'warning',
            line: lineIdx + 1,
            column: start + 1,
            endLine: lineIdx + 1,
            endColumn: end + 1,
            source: 'Spelling'
          });
          continue;
        }

        WORD_START_IMPOSSIBLE.lastIndex = 0;
        if (WORD_START_IMPOSSIBLE.test(lower)) {
          results.push({
            message: `"${word}" empieza con una secuencia de consonantes inusual en español.`,
            suggestion: `Revisa la ortografía de "${word}".`,
            severity: 'info',
            line: lineIdx + 1,
            column: start + 1,
            endLine: lineIdx + 1,
            endColumn: end + 1,
            source: 'Spelling'
          });
        }
      }
    }

    return results;
  }
};
