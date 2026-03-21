/**
 * Reglas de linting para Markdown — funciones puras, sin React.
 *
 * Cada regla:
 *  1. Tiene metadatos (id, name, description, category, defaultEnabled).
 *  2. Implementa check(text) → LinterDiagnostic[]
 *  3. Respeta bloques de código (no reporta dentro de ``` … ```)
 *
 * Las reglas se exportan como array para registro automático.
 */

import {
  type LinterRule,
  type LinterDiagnostic,
  getCodeBlockLines,
} from './types';

/**
 * Parses a correction string like "a ver / haber" or "hecho (¿participio?)"
 * into an array of clean replacement options: ["a ver", "haber"] or ["hecho"].
 */
function parseReplacements(correction: string): string[] {
  // Strip parenthetical notes like "(¿participio?)"
  const cleaned = correction.replace(/\s*\([^)]*\)\s*/g, '').trim();
  // Split by " / " separator
  return cleaned.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════
// 1. SPELLING — Ortografía
// ═══════════════════════════════════════════════════════════

const COMMON_TYPOS: Record<string, string> = {
  /* ─── b / v confusion ─── */
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

  /* ─── s / c / z confusion ─── */
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
  'correccion': 'corrección',
  'correcion': 'corrección',
  'ortografico': 'ortográfico',
  'ortograficos': 'ortográficos',
  'ortografia': 'ortografía',
  'ortografica': 'ortográfica',
  'corresion': 'corrección',
  'diresion': 'dirección',
  'direccion': 'dirección',
  'situasion': 'situación',
  'situacion': 'situación',
  'evaluasion': 'evaluación',
  'evaluacion': 'evaluación',
  'informasion': 'información',
  'informacion': 'información',
  'comunicasion': 'comunicación',
  'comunicacion': 'comunicación',
  'organisacion': 'organización',
  'organizacion': 'organización',
  'educacion': 'educación',
  'funcion': 'función',
  'operacion': 'operación',
  'relacion': 'relación',
  'investigacion': 'investigación',
  'participacion': 'participación',
  'presentacion': 'presentación',
  'solucion': 'solución',
  'construccion': 'construcción',
  'condision': 'condición',
  'condicion': 'condición',
  'nasion': 'nación',
  'nacion': 'nación',
  'posision': 'posición',
  'posicion': 'posición',
  'desision': 'decisión',
  'decision': 'decisión',
  'tradision': 'tradición',
  'tradicion': 'tradición',
  'conclucion': 'conclusión',
  'conclusion': 'conclusión',
  'expresion': 'expresión',
  'comprecion': 'comprensión',
  'comprension': 'comprensión',
  'dimencion': 'dimensión',
  'dimension': 'dimensión',
  'extencion': 'extensión',
  'extension': 'extensión',
  'sesion': 'sesión',
  'ocacion': 'ocasión',
  'ocasion': 'ocasión',
  'atencion': 'atención',
  'calificasion': 'calificación',
  'calificacion': 'calificación',
  'redaccion': 'redacción',
  'introducion': 'introducción',
  'introduccion': 'introducción',
  'aplicasion': 'aplicación',
  'aplicacion': 'aplicación',
  'produsion': 'producción',
  'produccion': 'producción',
  'institucion': 'institución',
  'resolucion': 'resolución',
  'explicasion': 'explicación',
  'explicacion': 'explicación',
  'suposicion': 'suposición',
  'proposicion': 'proposición',
  'asignasion': 'asignación',
  'asignacion': 'asignación',

  /* ─── h omission / addition ─── */
  'aver': 'a ver / haber',
  'aora': 'ahora',
  'asta': 'hasta',
  'aya': 'haya',
  'echo': 'hecho (¿participio?)',
  'allar': 'hallar',
  'eredar': 'heredar',
  'error': 'error',
  'herrores': 'errores',
  'herrror': 'error',
  'heror': 'error',
  'errror': 'error',

  /* ─── tildes / accents ─── */
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
  'especifico': 'específico',
  'tecnico': 'técnico',
  'teorico': 'teórico',
  'practica': 'práctica (si es sustantivo)',
  'logico': 'lógico',
  'basico': 'básico',
  'publico': 'público',
  'politica': 'política',
  'economico': 'económico',
  'historico': 'histórico',
  'filosofico': 'filosófico',
  'automatico': 'automático',
  'semantico': 'semántico',
  'pedagogico': 'pedagógico',
  'sistematico': 'sistemático',
  'matematico': 'matemático',
  'gramatico': 'gramático',
  'linguistico': 'lingüístico',
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

  /* ─── double / missing letters ─── */
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

  /* ─── ll / y confusion ─── */
  'llendo': 'yendo',
  'callendo': 'cayendo',
  'calleron': 'cayeron',
  'rallar': 'rayar (línea)',
  'arrollar': 'arrollar',
  'halla': 'haya (si es subjuntivo)',

  /* ─── g / j confusion ─── */
  'cojer': 'coger',
  'cojido': 'cogido',
  'dije': 'dije',
  'jente': 'gente',
  'jeneral': 'general',
  'rejistro': 'registro',
  'rejion': 'región',
  'lenguaje': 'lenguaje',
  'pasaje': 'pasaje',

  /* ─── common word-join mistakes ─── */
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

  /* ─── gender / number common errors ─── */
  'hubieron': 'hubo',
  'habemos': 'hay / somos',
  'habian': 'había',

  /* ─── very common everyday typos ─── */
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
  'espresion': 'expresión',
};

export const spellingRule: LinterRule = {
  id: 'spelling_typos',
  name: 'Errores ortográficos comunes',
  description: 'Detecta errores frecuentes en español: confusión b/v, s/c/z, h muda, y faltas comunes.',
  category: 'spelling',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];

      for (const [typo, correction] of Object.entries(COMMON_TYPOS)) {
        const regex = new RegExp(`\\b${typo}\\b`, 'gi');
        let match;
        while ((match = regex.exec(line)) !== null) {
          const replacements = parseReplacements(correction);
          results.push({
            message: `Posible error ortográfico: "${match[0]}"`,
            suggestion: `¿Quisiste decir "${correction}"?`,
            severity: 'warning',
            line: lineIdx + 1,
            column: match.index + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + 1 + match[0].length,
            source: 'Spelling',
            replacements,
          });
        }
      }
    }
    return results;
  },
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
          suggestion: `Elimina una de las repeticiones.`,
          severity: 'warning',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Spelling',
          replacements: [match[1]],
        });
      }
    }
    return results;
  },
};

// ───────────────────────────────────────────────────────────
// 1c. ACCENT PATTERNS — Detección algorítmica de tildes faltantes
// ───────────────────────────────────────────────────────────

/**
 * Detecta palabras que necesitan tilde usando PATRONES, no diccionario.
 * Cubre:
 *  - Terminaciones -cion, -sion, -gion (→ -ción, -sión, -gión)
 *  - Palabras esdrújulas comunes sin tilde
 *  - Adverbios -mente derivados de adjetivos con tilde
 */
const ACCENT_SUFFIX_RULES: Array<{
  pattern: RegExp;
  fix: (m: string) => string;
  msg: string;
}> = [
  // -cion → -ción  (educacion → educación)
  {
    pattern: /\b([a-záéíóúñü]{2,})cion\b/gi,
    fix: (m) => m.slice(0, -4) + 'ción',
    msg: 'Falta tilde: las palabras terminadas en "-ción" llevan acento.',
  },
  // -sion → -sión  (expresion → expresión)
  {
    pattern: /\b([a-záéíóúñü]{2,})sion\b/gi,
    fix: (m) => m.slice(0, -4) + 'sión',
    msg: 'Falta tilde: las palabras terminadas en "-sión" llevan acento.',
  },
  // -gion → -gión  (region → región)
  {
    pattern: /\b([a-záéíóúñü]{2,})gion\b/gi,
    fix: (m) => m.slice(0, -4) + 'gión',
    msg: 'Falta tilde: las palabras terminadas en "-gión" llevan acento.',
  },
  // -tico/a/os/as → -tico  (automatico → automático) — esdrújulas
  {
    pattern: /\b([a-záéíóúñü]{2,}[^áéíóú])tico(s|a|as)?\b/gi,
    fix: (m) => {
      const idx = m.lastIndexOf('tico');
      if (idx < 0) return m;
      const prefix = m.slice(0, idx);
      // Find the vowel before 'tico' and add accent
      const lastVowel = prefix.match(/[aeiou]$/i);
      if (lastVowel) {
        const accentMap: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
        const accented = accentMap[lastVowel[0].toLowerCase()] ?? lastVowel[0];
        return prefix.slice(0, -1) + accented + m.slice(idx);
      }
      return m;
    },
    msg: 'Posible esdrújula sin tilde (terminación "-tico").',
  },
  // -logico/a → -lógico/a
  {
    pattern: /\b([a-záéíóúñü]+)logico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/logico/i, 'lógico'),
    msg: 'Falta tilde: "-lógico" es esdrújula.',
  },
  // -grafico/a → -gráfico/a
  {
    pattern: /\b([a-záéíóúñü]+)grafico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/grafico/i, 'gráfico'),
    msg: 'Falta tilde: "-gráfico" es esdrújula.',
  },
  // -nomico/a → -nómico/a
  {
    pattern: /\b([a-záéíóúñü]+)nomico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/nomico/i, 'nómico'),
    msg: 'Falta tilde: "-nómico" es esdrújula.',
  },
  // -metrico/a → -métrico/a
  {
    pattern: /\b([a-záéíóúñü]+)metrico(s|a|as)?\b/gi,
    fix: (m) => m.replace(/metrico/i, 'métrico'),
    msg: 'Falta tilde: "-métrico" es esdrújula.',
  },
];

/** Words already handled by COMMON_TYPOS — skip in accent rule to avoid duplicates */
const ACCENT_SKIP = new Set(
  Object.keys(COMMON_TYPOS).map(k => k.toLowerCase()),
);

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
        // Reset lastIndex since regex is global
        rule.pattern.lastIndex = 0;
        while ((match = rule.pattern.exec(line)) !== null) {
          const word = match[0];
          // Skip words already in COMMON_TYPOS dict (avoid duplicate alerts)
          if (ACCENT_SKIP.has(word.toLowerCase())) continue;
          // Skip words that already have accents
          if (/[áéíóú]/i.test(word)) continue;

          const fixed = rule.fix(word);
          // If fix didn't change anything, skip
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
            replacements: [fixed],
          });
        }
      }
    }
    return results;
  },
};

// ───────────────────────────────────────────────────────────
// 1d. SUSPICIOUS PATTERNS — Secuencias imposibles en español
// ───────────────────────────────────────────────────────────

/**
 * Detects character sequences that are invalid or extremely rare in Spanish,
 * suggesting the word is likely a typo. This is ALGORITHMIC — no dictionary needed.
 *
 * Spanish only allows these double consonants: rr, ll, cc, nn
 * Spanish doesn't allow certain consonant clusters at word start/end.
 */
const INVALID_DOUBLE_CONSONANTS = /([bdfghjkmpqstvwxyz])\1/gi;
const TRIPLE_LETTER = /([a-záéíóúñü])\1\1/gi;
const WORD_START_IMPOSSIBLE = /\b([nm][bcdfgjklmnpqrstvwxyz](?=[a-záéíóúñü]))/gi;

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
    // Common valid words with unusual patterns to whitelist
    const whitelist = new Set([
      'innato', 'innata', 'innovar', 'innovación', 'innovador', 'innecesario',
      'innoble', 'innombrable', 'perenne', 'biennal', 'connotar', 'connotación',
      'ennegrecer', 'cannabis', 'connectar',
    ]);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];

      // Extract words (skip URLs, code spans, etc.)
      const wordRegex = /\b[a-záéíóúñü]{3,}\b/gi;
      let wordMatch;
      while ((wordMatch = wordRegex.exec(line)) !== null) {
        const word = wordMatch[0];
        const lower = word.toLowerCase();
        if (whitelist.has(lower)) continue;

        // Check 1: Invalid double consonants (not rr, ll, cc, nn)
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
            source: 'Spelling',
          });
          continue; // One diagnostic per word max
        }

        // Check 2: Triple letters (never valid in Spanish)
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
            source: 'Spelling',
          });
          continue;
        }

        // Check 3: Impossible word-start sequences (e.g., "nm", "nb", "mk")
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
            source: 'Spelling',
          });
        }
      }
    }
    return results;
  },
};

// ═══════════════════════════════════════════════════════════
// 2. STRUCTURE — Estructura Markdown
// ═══════════════════════════════════════════════════════════

export const headingSpaceRule: LinterRule = {
  id: 'structure_heading_space',
  name: 'Espacio tras # en encabezados',
  description: 'Los encabezados Markdown deben tener un espacio después de los "#".',
  category: 'structure',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      if (/^#{1,6}[^ #\n]/.test(line)) {
        const hashes = line.match(/^#+/)![0];
        results.push({
          message: 'Los encabezados deben tener un espacio después de los "#".',
          suggestion: `Cambia a: ${hashes} ${line.slice(hashes.length)}`,
          severity: 'info',
          line: lineIdx + 1,
          column: 1,
          endLine: lineIdx + 1,
          endColumn: hashes.length + 1,
          source: 'Structure',
          replacements: [`${hashes} `],
        });
      }
    }
    return results;
  },
};

export const headingHierarchyRule: LinterRule = {
  id: 'structure_heading_hierarchy',
  name: 'Jerarquía de encabezados',
  description: 'Detecta saltos de nivel (ej: h1 → h3 sin h2 intermedio).',
  category: 'structure',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    let lastLevel = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const match = lines[lineIdx].match(/^(#{1,6})\s/);
      if (match) {
        const level = match[1].length;
        if (lastLevel > 0 && level > lastLevel + 1) {
          results.push({
            message: `Salto de encabezado: h${lastLevel} → h${level}. Falta un h${lastLevel + 1} intermedio.`,
            suggestion: `Considera usar ${'#'.repeat(lastLevel + 1)} en su lugar.`,
            severity: 'warning',
            line: lineIdx + 1,
            column: 1,
            endLine: lineIdx + 1,
            endColumn: level + 1,
            source: 'Structure',
          });
        }
        lastLevel = level;
      }
    }
    return results;
  },
};

export const multipleH1Rule: LinterRule = {
  id: 'structure_multiple_h1',
  name: 'Múltiples h1',
  description: 'Un documento debería tener un solo encabezado de nivel 1.',
  category: 'structure',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    let h1Count = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      if (/^#\s/.test(lines[lineIdx])) {
        h1Count++;
        if (h1Count > 1) {
          results.push({
            message: `Múltiples encabezados h1 (este es el #${h1Count}). Un documento debería tener solo uno.`,
            severity: 'info',
            line: lineIdx + 1,
            column: 1,
            endLine: lineIdx + 1,
            endColumn: lines[lineIdx].length + 1,
            source: 'Structure',
          });
        }
      }
    }
    return results;
  },
};

export const emptyHeadingRule: LinterRule = {
  id: 'structure_empty_heading',
  name: 'Encabezados vacíos',
  description: 'Detecta encabezados sin contenido de texto.',
  category: 'structure',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      if (/^#{1,6}\s*$/.test(lines[lineIdx])) {
        results.push({
          message: 'Encabezado vacío — agrega texto descriptivo.',
          severity: 'warning',
          line: lineIdx + 1,
          column: 1,
          endLine: lineIdx + 1,
          endColumn: lines[lineIdx].length + 1,
          source: 'Structure',
        });
      }
    }
    return results;
  },
};

// ═══════════════════════════════════════════════════════════
// 3. LINKS — Validación de enlaces
// ═══════════════════════════════════════════════════════════

export const linkSpacesRule: LinterRule = {
  id: 'links_url_spaces',
  name: 'Espacios en URLs',
  description: 'Las URLs de enlaces no deben contener espacios.',
  category: 'links',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      let match;
      while ((match = linkRegex.exec(line)) !== null) {
        if (match[2].includes(' ')) {
          results.push({
            message: 'La URL del enlace contiene espacios.',
            suggestion: 'Usa %20 en lugar de espacios.',
            severity: 'error',
            line: lineIdx + 1,
            column: match.index + match[0].indexOf(match[2]) + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + match[0].indexOf(match[2]) + 1 + match[2].length,
            source: 'Links',
            replacements: [match[2].replace(/ /g, '%20')],
          });
        }
      }
    }
    return results;
  },
};

export const emptyLinkRule: LinterRule = {
  id: 'links_empty',
  name: 'Enlaces vacíos',
  description: 'Detecta enlaces sin texto o sin URL.',
  category: 'links',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      let match;
      while ((match = linkRegex.exec(line)) !== null) {
        const linkText = match[1].trim();
        const url = match[2].trim();
        if (!linkText) {
          results.push({
            message: 'Enlace sin texto descriptivo: [](…)',
            suggestion: 'Agrega texto descriptivo dentro de los corchetes.',
            severity: 'warning',
            line: lineIdx + 1,
            column: match.index + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + 1 + match[0].length,
            source: 'Links',
          });
        }
        if (!url) {
          results.push({
            message: 'Enlace sin URL: [texto]()',
            suggestion: 'Agrega una URL válida dentro de los paréntesis.',
            severity: 'error',
            line: lineIdx + 1,
            column: match.index + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + 1 + match[0].length,
            source: 'Links',
          });
        }
      }
    }
    return results;
  },
};

export const bareUrlRule: LinterRule = {
  id: 'links_bare_url',
  name: 'URLs sin formato',
  description: 'Detecta URLs escritas directamente en el texto sin formato de enlace.',
  category: 'links',
  defaultEnabled: false,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    // Match URLs not preceded by ( or < or " or ]( which would be part of link syntax
    const urlRegex = /(?<![(<"[\]])https?:\/\/[^\s)>\]"]+/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      let match;
      while ((match = urlRegex.exec(line)) !== null) {
        // Check it's not already in a markdown link or angle bracket
        const before = line.slice(0, match.index);
        if (before.endsWith('](') || before.endsWith('<')) continue;
        results.push({
          message: `URL sin formato Markdown: ${match[0].slice(0, 50)}…`,
          suggestion: 'Envuelve la URL en un enlace: [texto](url) o <url>',
          severity: 'info',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Links',
        });
      }
    }
    return results;
  },
};

// ═══════════════════════════════════════════════════════════
// 4. READABILITY — Legibilidad
// ═══════════════════════════════════════════════════════════

export const longParagraphRule: LinterRule = {
  id: 'readability_long_paragraph',
  name: 'Párrafos extensos',
  description: 'Alerta cuando un párrafo supera las 300 palabras.',
  category: 'readability',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    let paragraphStart = -1;
    let paragraphWords = 0;
    let paragraphText = '';

    const flushParagraph = (endLineIdx: number) => {
      if (paragraphStart >= 0 && paragraphWords > 300) {
        results.push({
          message: `Párrafo de ${paragraphWords} palabras. Considere dividirlo para mejorar la legibilidad.`,
          suggestion: 'Los párrafos de menos de 150 palabras son más fáciles de leer.',
          severity: 'info',
          line: paragraphStart + 1,
          column: 1,
          endLine: endLineIdx + 1,
          endColumn: 1,
          source: 'Readability',
        });
      }
      paragraphStart = -1;
      paragraphWords = 0;
      paragraphText = '';
    };

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) {
        flushParagraph(lineIdx - 1);
        continue;
      }
      const line = lines[lineIdx];
      const trimmed = line.trim();

      // Blank line or heading = paragraph boundary
      if (trimmed === '' || /^#{1,6}\s/.test(trimmed) || /^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
        flushParagraph(lineIdx - 1);
        continue;
      }

      if (paragraphStart < 0) paragraphStart = lineIdx;
      paragraphText += ' ' + trimmed;
      paragraphWords = paragraphText.trim().split(/\s+/).length;
    }
    flushParagraph(lines.length - 1);
    return results;
  },
};

export const longSentenceRule: LinterRule = {
  id: 'readability_long_sentence',
  name: 'Oraciones largas',
  description: 'Alerta cuando una oración supera las 50 palabras.',
  category: 'readability',
  defaultEnabled: false,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      // Skip headings, lists, etc.
      if (/^[#\-*+>|]/.test(line.trim())) continue;

      // Split by sentence-ending punctuation
      const sentences = line.split(/(?<=[.!?;])\s+/);
      let col = 0;
      for (const sentence of sentences) {
        const words = sentence.trim().split(/\s+/).filter(Boolean);
        if (words.length > 50) {
          results.push({
            message: `Oración de ${words.length} palabras. Considere dividirla.`,
            suggestion: 'Las oraciones de 20-30 palabras son más claras.',
            severity: 'info',
            line: lineIdx + 1,
            column: col + 1,
            endLine: lineIdx + 1,
            endColumn: col + 1 + sentence.length,
            source: 'Readability',
          });
        }
        col += sentence.length + 1;
      }
    }
    return results;
  },
};

// ═══════════════════════════════════════════════════════════
// 5. ACCESSIBILITY — Accesibilidad
// ═══════════════════════════════════════════════════════════

export const imageAltTextRule: LinterRule = {
  id: 'accessibility_image_alt',
  name: 'Imágenes sin alt-text',
  description: 'Las imágenes deben tener texto alternativo para accesibilidad.',
  category: 'accessibility',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const imgRegex = /!\[([^\]]*)\]\([^)]+\)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      let match;
      while ((match = imgRegex.exec(line)) !== null) {
        if (!match[1].trim()) {
          results.push({
            message: 'Imagen sin texto alternativo: ![](…)',
            suggestion: 'Agrega una descripción: ![descripción de la imagen](url)',
            severity: 'warning',
            line: lineIdx + 1,
            column: match.index + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + 1 + match[0].length,
            source: 'Accessibility',
          });
        }
      }
    }
    return results;
  },
};

// ═══════════════════════════════════════════════════════════
// 6. CONSISTENCY — Consistencia de estilo
// ═══════════════════════════════════════════════════════════

export const mixedListMarkersRule: LinterRule = {
  id: 'consistency_list_markers',
  name: 'Marcadores de lista mixtos',
  description: 'Detecta uso mezclado de -, * y + como marcadores de lista.',
  category: 'consistency',
  defaultEnabled: false,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const markersUsed = new Map<string, number[]>();

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const match = lines[lineIdx].match(/^(\s*)([-*+])\s/);
      if (match) {
        const marker = match[2];
        if (!markersUsed.has(marker)) markersUsed.set(marker, []);
        markersUsed.get(marker)!.push(lineIdx);
      }
    }

    if (markersUsed.size > 1) {
      // Find the minority markers
      const sorted = Array.from(markersUsed.entries()).sort((a, b) => b[1].length - a[1].length);
      const dominant = sorted[0][0];
      for (let i = 1; i < sorted.length; i++) {
        const [marker, lineIdxs] = sorted[i];
        for (const lineIdx of lineIdxs) {
          results.push({
            message: `Marcador de lista "${marker}" inconsistente — el documento usa mayoritariamente "${dominant}".`,
            suggestion: `Cambia "${marker}" por "${dominant}" para consistencia.`,
            severity: 'info',
            line: lineIdx + 1,
            column: 1,
            endLine: lineIdx + 1,
            endColumn: 2,
            source: 'Consistency',
          });
        }
      }
    }
    return results;
  },
};

// ═══════════════════════════════════════════════════════════
// 7. WHITESPACE — Espacios en blanco
// ═══════════════════════════════════════════════════════════

export const trailingWhitespaceRule: LinterRule = {
  id: 'whitespace_trailing',
  name: 'Espacios al final de línea',
  description: 'Detecta espacios o tabs al final de las líneas (excepto "  " para <br>).',
  category: 'whitespace',
  defaultEnabled: false,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      // Markdown uses "  " (2 spaces) for <br>, so only flag >2 trailing spaces or trailing tabs
      const trailingMatch = line.match(/(\s+)$/);
      if (trailingMatch) {
        const trailing = trailingMatch[1];
        // Allow exactly 2 trailing spaces (markdown linebreak)
        if (trailing === '  ') continue;
        results.push({
          message: 'Espacios en blanco al final de la línea.',
          suggestion: 'Elimina los espacios sobrantes.',
          severity: 'info',
          line: lineIdx + 1,
          column: line.length - trailing.length + 1,
          endLine: lineIdx + 1,
          endColumn: line.length + 1,
          source: 'Whitespace',
          replacements: [''],
        });
      }
    }
    return results;
  },
};

export const consecutiveBlankLinesRule: LinterRule = {
  id: 'whitespace_consecutive_blanks',
  name: 'Líneas en blanco consecutivas',
  description: 'Detecta más de dos líneas en blanco seguidas.',
  category: 'whitespace',
  defaultEnabled: false,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    let blankCount = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (lines[lineIdx].trim() === '') {
        blankCount++;
        if (blankCount === 3) {
          results.push({
            message: 'Más de dos líneas en blanco consecutivas.',
            suggestion: 'Reduce a máximo una línea en blanco para separar secciones.',
            severity: 'info',
            line: lineIdx + 1,
            column: 1,
            endLine: lineIdx + 1,
            endColumn: 1,
            source: 'Whitespace',
          });
        }
      } else {
        blankCount = 0;
      }
    }
    return results;
  },
};

// ═══════════════════════════════════════════════════════════
// 8. ACADEMIC — Escritura académica
// ═══════════════════════════════════════════════════════════

export const unclosedBracketsRule: LinterRule = {
  id: 'academic_unclosed_brackets',
  name: 'Paréntesis/corchetes sin cerrar',
  description: 'Detecta paréntesis, corchetes o llaves no balanceados en cada línea.',
  category: 'academic',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const pairs: [string, string][] = [['(', ')'], ['[', ']'], ['{', '}']];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];

      for (const [open, close] of pairs) {
        let count = 0;
        for (const ch of line) {
          if (ch === open) count++;
          if (ch === close) count--;
        }
        if (count > 0) {
          results.push({
            message: `${open}…${close} sin cerrar: hay ${count} ${open} sin su ${close} correspondiente.`,
            severity: 'warning',
            line: lineIdx + 1,
            column: 1,
            endLine: lineIdx + 1,
            endColumn: line.length + 1,
            source: 'Academic',
          });
        } else if (count < 0) {
          results.push({
            message: `${close} extra: hay ${-count} ${close} sin su ${open} correspondiente.`,
            severity: 'warning',
            line: lineIdx + 1,
            column: 1,
            endLine: lineIdx + 1,
            endColumn: line.length + 1,
            source: 'Academic',
          });
        }
      }
    }
    return results;
  },
};

export const todoMarkersRule: LinterRule = {
  id: 'academic_todo_markers',
  name: 'Marcadores TODO/FIXME',
  description: 'Detecta TODOs, FIXMEs y notas pendientes en el texto.',
  category: 'academic',
  defaultEnabled: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const markerRegex = /\b(TODO|FIXME|HACK|XXX|PENDIENTE|FALTA|COMPLETAR)\b/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      let match;
      while ((match = markerRegex.exec(line)) !== null) {
        results.push({
          message: `Marcador pendiente: "${match[0]}" — ¿ya se completó esta tarea?`,
          severity: 'info',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Academic',
        });
      }
    }
    return results;
  },
};

// ═══════════════════════════════════════════════════════════
// EXPORTACIÓN — Todas las reglas built-in
// ═══════════════════════════════════════════════════════════

export const ALL_BUILTIN_RULES: LinterRule[] = [
  // Spelling
  spellingRule,
  doubledWordsRule,
  accentPatternRule,
  suspiciousPatternsRule,
  // Structure
  headingSpaceRule,
  headingHierarchyRule,
  multipleH1Rule,
  emptyHeadingRule,
  // Links
  linkSpacesRule,
  emptyLinkRule,
  bareUrlRule,
  // Readability
  longParagraphRule,
  longSentenceRule,
  // Accessibility
  imageAltTextRule,
  // Consistency
  mixedListMarkersRule,
  // Whitespace
  trailingWhitespaceRule,
  consecutiveBlankLinesRule,
  // Academic
  unclosedBracketsRule,
  todoMarkersRule,
];
