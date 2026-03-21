import {
  type LinterRule,
  type LinterDiagnostic,
  getCodeBlockLines
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
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const spellReady = isSpellEngineReady();

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      WORD_REGEX.lastIndex = 0;
      let wordMatch;
      while ((wordMatch = WORD_REGEX.exec(line)) !== null) {
        const word = wordMatch[0];
        const start = wordMatch.index;
        const end = start + word.length;

        if (!spellReady) continue;
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
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const regex = /\b(\w{2,})\s+\1\b/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      let match;
      while ((match = regex.exec(line)) !== null) {
        results.push({
          message: `Palabra duplicada: "${match[1]} ${match[1]}"`,
          suggestion: 'Elimina una de las repeticiones.',
          severity: 'warning',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Spelling',
          replacements: [match[1]]
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
  }
];

export const accentPatternRule: LinterRule = {
  id: 'spelling_accent_patterns',
  name: 'Tildes faltantes (patrones)',
  description: 'Detecta palabras que necesitan tilde usando patrones morfológicos del español (-ción, -sión, esdrújulas, etc.)',
  category: 'spelling',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];

      for (const rule of ACCENT_SUFFIX_RULES) {
        let match;
        rule.pattern.lastIndex = 0;
        while ((match = rule.pattern.exec(line)) !== null) {
          const word = match[0];
          if (/[áéíóú]/i.test(word)) continue;

          const fixed = rule.fix(word);
          if (fixed.toLowerCase() === word.toLowerCase()) continue;

          results.push({
            message: `${rule.msg} "${word}" → "${fixed}"`,
            suggestion: `Cambiar a "${fixed}"`,
            severity: 'warning',
            line: lineIdx + 1,
            column: match.index + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + 1 + word.length,
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
  'ennegrecer', 'cannabis', 'connectar'
]);

export const suspiciousPatternsRule: LinterRule = {
  id: 'spelling_suspicious_patterns',
  name: 'Secuencias de caracteres sospechosas',
  description: 'Detecta combinaciones de letras imposibles o muy raras en español (consonantes dobles inválidas, triples letras, inicios imposibles).',
  category: 'spelling',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      const wordRegex = /\b[a-záéíóúñü]{3,}\b/gi;
      let wordMatch;

      while ((wordMatch = wordRegex.exec(line)) !== null) {
        const word = wordMatch[0];
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
            column: wordMatch.index + 1,
            endLine: lineIdx + 1,
            endColumn: wordMatch.index + 1 + word.length,
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
            column: wordMatch.index + 1,
            endLine: lineIdx + 1,
            endColumn: wordMatch.index + 1 + word.length,
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
            column: wordMatch.index + 1,
            endLine: lineIdx + 1,
            endColumn: wordMatch.index + 1 + word.length,
            source: 'Spelling'
          });
        }
      }
    }

    return results;
  }
};