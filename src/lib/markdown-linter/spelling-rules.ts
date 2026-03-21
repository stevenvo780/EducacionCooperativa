import {
  type LinterRule,
  type LinterDiagnostic,
  getCodeBlockLines
} from './types';
import { isSpellEngineReady, isCorrect, suggest } from './spell-engine';

function parseReplacements(correction: string): string[] {
  const cleaned = correction.replace(/\s*\([^)]*\)\s*/g, '').trim();
  return cleaned.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
}

function restoreSuggestionCase(original: string, suggestion: string): string {
  if (original === original.toUpperCase()) return suggestion.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) {
    return suggestion.charAt(0).toUpperCase() + suggestion.slice(1);
  }
  return suggestion;
}

const WORD_REGEX = /\b[\p{L}\p{M}][\p{L}\p{M}'’-]*\b/gu;

const COMMON_TYPOS: Record<string, string> = {
  'entonses': 'entonces',
  'haver': 'haber / a ver',
  'valla': 'vaya',
  'cooperatiba': 'cooperativa',
  'edicasion': 'educación',
  'avierto': 'abierto',
  'abia': 'había',
  'estava': 'estaba',
  'hise': 'hice',
  'ubiera': 'hubiera',
  'alla': 'allá / haya',
  'ahi': 'ahí',
  'ay': 'hay',
  'berdad': 'verdad',
  'berde': 'verde',
  'bida': 'vida',
  'biejo': 'viejo',
  'bolber': 'volver',
  'boluntad': 'voluntad',
  'benir': 'venir',
  'beneno': 'veneno',
  'bentaja': 'ventaja',
  'bentana': 'ventana',
  'berbo': 'verbo',
  'botar': 'votar (emitir voto)',
  'cavo': 'cabo',
  'rebelion': 'rebelión',
  'savia': 'sabía (si es verbo saber)',
  'tubo': 'tuvo (si es verbo tener)',
  'iva': 'iba',
  'savemos': 'sabemos',
  'recivir': 'recibir',
  'escrivir': 'escribir',
  'pruevas': 'pruebas',
  'prueva': 'prueba',
  'aprovacion': 'aprobación',
  'govierno': 'gobierno',
  'inbierno': 'invierno',
  'conoser': 'conocer',
  'desir': 'decir',
  'haser': 'hacer',
  'resivir': 'recibir',
  'produsir': 'producir',
  'sierto': 'cierto',
  'sinco': 'cinco',
  'consiente': 'consciente',
  'exepcion': 'excepción',
  'esclusivo': 'exclusivo',
  'exepto': 'excepto',
  'exeso': 'exceso',
  'escases': 'escasez',
  'correcion': 'corrección',
  'corresion': 'corrección',
  'diresion': 'dirección',
  'situasion': 'situación',
  'evaluasion': 'evaluación',
  'informasion': 'información',
  'comunicasion': 'comunicación',
  'organisacion': 'organización',
  'condision': 'condición',
  'nasion': 'nación',
  'posision': 'posición',
  'desision': 'decisión',
  'tradision': 'tradición',
  'conclucion': 'conclusión',
  'comprecion': 'comprensión',
  'dimencion': 'dimensión',
  'extencion': 'extensión',
  'ocacion': 'ocasión',
  'calificasion': 'calificación',
  'introducion': 'introducción',
  'aplicasion': 'aplicación',
  'produsion': 'producción',
  'explicasion': 'explicación',
  'aver': 'a ver / haber',
  'aora': 'ahora',
  'asta': 'hasta',
  'aya': 'haya',
  'echo': 'hecho (¿participio?)',
  'allar': 'hallar',
  'eredar': 'heredar',
  'herrores': 'errores',
  'herrror': 'error',
  'heror': 'error',
  'errror': 'error',
  'tambien': 'también',
  'todavia': 'todavía',
  'mas': 'más (si es comparativo)',
  'aqui': 'aquí',
  'asi': 'así',
  'facil': 'fácil',
  'dificil': 'difícil',
  'rapido': 'rápido',
  'ultimo': 'último',
  'numero': 'número',
  'pagina': 'página',
  'articulo': 'artículo',
  'metodo': 'método',
  'capitulo': 'capítulo',
  'titulo': 'título',
  'analisis': 'análisis',
  'proposito': 'propósito',
  'practica': 'práctica (si es sustantivo)',
  'ademas': 'además',
  'detras': 'detrás',
  'traves': 'través',
  'quiza': 'quizá',
  'segun': 'según',
  'despues': 'después',
  'ingles': 'inglés',
  'frances': 'francés',
  'portugues': 'portugués',
  'interes': 'interés',
  'oportunitad': 'oportunidad',
  'nesecitar': 'necesitar',
  'nesecitamos': 'necesitamos',
  'nesecitas': 'necesitas',
  'nesecita': 'necesita',
  'nesesario': 'necesario',
  'nesesaria': 'necesaria',
  'nesecesario': 'necesario',
  'combeniente': 'conveniente',
  'obio': 'obvio',
  'travajo': 'trabajo',
  'deveria': 'debería',
  'deverian': 'deberían',
  'develar': 'develar',
  'vien': 'bien',
  'biene': 'viene / bien',
  'vienes': 'vienes',
  'tanbien': 'también',
  'tamvien': 'también',
  'tengamos': 'tengamos',
  'nmal': 'mal',
  'mmal': 'mal',
  'llendo': 'yendo',
  'callendo': 'cayendo',
  'calleron': 'cayeron',
  'rallar': 'rayar (línea)',
  'arrollar': 'arrollar',
  'halla': 'haya (si es subjuntivo)',
  'cojer': 'coger',
  'cojido': 'cogido',
  'dije': 'dije',
  'jente': 'gente',
  'jeneral': 'general',
  'rejistro': 'registro',
  'rejion': 'región',
  'lenguaje': 'lenguaje',
  'pasaje': 'pasaje',
  'atravez': 'a través',
  'enserio': 'en serio',
  'deveras': 'de veras',
  'osea': 'o sea',
  'asique': 'así que',
  'porqe': 'porque / por qué',
  'poreso': 'por eso',
  'esque': 'es que',
  'almenos': 'al menos',
  'amenudo': 'a menudo',
  'enparte': 'en parte',
  'deacuerdo': 'de acuerdo',
  'sobretodo': 'sobre todo',
  'acontinuacion': 'a continuación',
  'entorno': 'en torno (si es "alrededor")',
  'talvez': 'tal vez',
  'asimismo': 'asimismo / así mismo',
  'conque': 'con que (si es "con el que")',
  'nose': 'no sé',
  'enseñansa': 'enseñanza',
  'aprendisaje': 'aprendizaje',
  'aprendizage': 'aprendizaje',
  'lenguage': 'lenguaje',
  'porsentaje': 'porcentaje',
  'porcentage': 'porcentaje',
  'hubieron': 'hubo',
  'habemos': 'hay / somos',
  'habian': 'había',
  'qe': 'que',
  'qeu': 'que',
  'teh': 'the / te',
  'depsues': 'después',
  'porq': 'porque / por qué',
  'xq': 'porque / por qué',
  'cundo': 'cuando',
  'cuadno': 'cuando',
  'peusto': 'puesto',
  'peustos': 'puestos',
  'tiepo': 'tiempo',
  'tiemppo': 'tiempo',
  'perosna': 'persona',
  'persoan': 'persona',
  'probelma': 'problema',
  'porblema': 'problema',
  'problmea': 'problema',
  'ejemlpo': 'ejemplo',
  'ejmplo': 'ejemplo',
  'depdende': 'depende',
  'depnede': 'depende',
  'resutlado': 'resultado',
  'resulatdo': 'resultado',
  'perimtir': 'permitir',
  'permtiir': 'permitir',
  'obigetivo': 'objetivo',
  'obejtiov': 'objetivo',
  'documetno': 'documento',
  'documneto': 'documento',
  'recusos': 'recursos',
  'recuross': 'recursos',
  'diferetne': 'diferente',
  'diferenet': 'diferente',
  'importatne': 'importante',
  'importnate': 'importante',
  'necesraio': 'necesario',
  'neceasrio': 'necesario',
  'siguietne': 'siguiente',
  'sigueinte': 'siguiente',
  'desarollo': 'desarrollo',
  'desarrolo': 'desarrollo',
  'dessarrollo': 'desarrollo',
  'procesoo': 'proceso',
  'porceso': 'proceso',
  'estrcutura': 'estructura',
  'esturctura': 'estructura',
  'contenidoo': 'contenido',
  'conetindo': 'contenido',
  'sistmea': 'sistema',
  'sisetma': 'sistema',
  'elemtno': 'elemento',
  'elemneto': 'elemento',
  'seccion': 'sección',
  'seecion': 'sección',
  'capitlo': 'capítulo',
  'capiutlo': 'capítulo',
  'hervir': 'hervir',
  'escojido': 'escogido',
  'exijir': 'exigir',
  'exijencia': 'exigencia',
  'dijimos': 'dijimos',
  'dijeron': 'dijeron',
  'trajimos': 'trajimos',
  'reduje': 'reduje',
  'conduje': 'conduje',
  'produje': 'produje',
  'introduje': 'introduje',
  'estracto': 'extracto',
  'estraño': 'extraño',
  'espectativa': 'expectativa',
  'esperiencia': 'experiencia',
  'esplicar': 'explicar',
  'esponer': 'exponer',
  'espresion': 'expresión'
};

export const spellingRule: LinterRule = {
  id: 'spelling_typos',
  name: 'Errores ortográficos',
  description: 'Detecta errores ortográficos usando typos frecuentes y diccionario Hunspell en memoria.',
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
        const lower = word.toLowerCase();

        const typoCorrection = COMMON_TYPOS[lower];
        if (typoCorrection) {
          const replacements = parseReplacements(typoCorrection).map(option => restoreSuggestionCase(word, option));
          results.push({
            message: `Posible error ortográfico: "${word}"`,
            suggestion: `¿Quisiste decir "${replacements[0] ?? typoCorrection}"?`,
            severity: 'warning',
            line: lineIdx + 1,
            column: start + 1,
            endLine: lineIdx + 1,
            endColumn: end + 1,
            source: 'Spelling',
            replacements
          });
          continue;
        }

        if (!spellReady) continue;
        if (word.length <= 2) continue;
        if (/^\d+$/.test(word)) continue;
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

const ACCENT_SKIP = new Set(Object.keys(COMMON_TYPOS).map(k => k.toLowerCase()));

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
          if (ACCENT_SKIP.has(word.toLowerCase())) continue;
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