import {
  type LinterRule,
  type LinterDiagnostic,
  type LinterRuleContext,
  type HeadingInfo,
  getCodeBlockLines,
  lineAt
} from './types';

function extractHeadingsFallback(lines: readonly string[], codeLines: Set<number>): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (codeLines.has(i)) continue;
    const match = (lines[i] ?? '').match(/^(#{1,6})\s+(.+)/);
    const hashes = match?.[1];
    const headingText = match?.[2];
    if (hashes && headingText) headings.push({ level: hashes.length, text: headingText.trim(), line: i });
  }
  return headings;
}

function getHeadings(lines: readonly string[], codeLines: Set<number>, ctx?: LinterRuleContext): HeadingInfo[] {
  return ctx?.headings ?? extractHeadingsFallback(lines, codeLines);
}

function headingMatchesPattern(text: string, patterns: string[]): boolean {
  const lower = text.toLowerCase().replace(/[áéíóú]/g, (c) =>
    ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' }[c] ?? c)
  );
  return patterns.some((p) => lower.includes(p));
}

const REQUIRED_SECTIONS: Array<{
  key: string;
  label: string;
  patterns: string[];
  severity: 'error' | 'warning' | 'info';
}> = [
  {
    key: 'resumen',
    label: 'Resumen / Abstract',
    patterns: ['resumen', 'abstract', 'síntesis'],
    severity: 'warning'
  },
  {
    key: 'introduccion',
    label: 'Introducción',
    patterns: ['introduccion', 'introduccion'],
    severity: 'warning'
  },
  {
    key: 'marco',
    label: 'Marco Teórico / Revisión de literatura',
    patterns: ['marco teorico', 'marco conceptual', 'revision de literatura', 'revision bibliografica', 'antecedentes', 'estado del arte', 'fundamentacion'],
    severity: 'info'
  },
  {
    key: 'metodologia',
    label: 'Metodología',
    patterns: ['metodologia', 'metodo', 'materiales y metodos', 'diseño metodologico', 'procedimiento'],
    severity: 'warning'
  },
  {
    key: 'resultados',
    label: 'Resultados / Análisis',
    patterns: ['resultados', 'analisis', 'hallazgos', 'discusion de resultados'],
    severity: 'warning'
  },
  {
    key: 'conclusiones',
    label: 'Conclusiones',
    patterns: ['conclusiones', 'conclusion', 'consideraciones finales', 'reflexiones finales'],
    severity: 'warning'
  },
  {
    key: 'referencias',
    label: 'Referencias / Bibliografía',
    patterns: ['referencias', 'bibliografia', 'bibliography', 'fuentes'],
    severity: 'warning'
  }
];

export const thesisMissingSectionRule: LinterRule = {
  id: 'thesis_missing_section',
  name: 'Secciones de tesis faltantes',
  description: 'Verifica que el documento tenga las secciones canónicas de una tesis académica.',
  category: 'thesis',
  defaultEnabled: false,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const headings = getHeadings(lines, codeLines, ctx);

    for (const section of REQUIRED_SECTIONS) {
      const found = headings.some((h) => headingMatchesPattern(h.text, section.patterns));
      if (!found) {
        results.push({
          message: `Sección "${section.label}" no encontrada en el documento.`,
          suggestion: `Las tesis académicas suelen requerir esta sección. Considera agregarla o renombrar la existente.`,
          severity: section.severity,
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
          source: 'Thesis'
        });
      }
    }
    return results;
  }
};

export const thesisFirstPersonRule: LinterRule = {
  id: 'thesis_first_person_singular',
  name: 'Primera persona singular en tesis',
  description: 'Detecta uso de primera persona singular inapropiado en escritura académica formal.',
  category: 'thesis',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    const firstPersonRegex = /\b(yo\s+(?:creo|pienso|considero|opino|estimo|argumento|propongo|planteo|afirmo)|me\s+parece\s+que|en\s+mi\s+opinión|a\s+mi\s+juicio|según\s+mi\s+(?:criterio|perspectiva|punto\s+de\s+vista)|desde\s+mi\s+(?:perspectiva|punto\s+de\s+vista)|personalmente\s+(?:creo|considero|pienso))\b/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      if (/^[#>]/.test(line.trim())) continue;

      let match;
      while ((match = firstPersonRegex.exec(line)) !== null) {
        results.push({
          message: `Primera persona singular: "${match[0]}"`,
          suggestion: 'Las tesis usan construcciones impersonales: "se observa que", "los datos sugieren que", "el análisis indica que".',
          severity: 'warning',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Thesis'
        });
      }
    }
    return results;
  }
};

const WEAK_ASSERTIONS: Array<[string, string]> = [
  ['es obvio que', 'Sustituye "es obvio que" por evidencia o cita bibliográfica.'],
  ['claramente', 'Evita "claramente" — lo que es claro para el autor puede no serlo para el lector.'],
  ['evidentemente', 'Reemplaza "evidentemente" por datos o argumentos concretos.'],
  ['sin duda', '"Sin duda" es una afirmación no fundamentada. Cita una fuente.'],
  ['todos saben que', '"Todos saben que" es una falacia de apelación al conocimiento común.'],
  ['es bien sabido que', 'Reemplaza por una cita: "Como señala [Autor, Año]..."'],
  ['está demostrado que', 'Si está demostrado, cita la demostración.'],
  ['es innegable que', 'Sustituye por evidencia verificable.'],
  ['naturalmente', '"Naturalmente" asume consenso no demostrado.'],
  ['por supuesto', '"Por supuesto" asume conocimiento compartido sin evidencia.'],
  ['lógicamente', '"Lógicamente" como comodín retórico debilita el argumento.']
];

const WEAK_ASSERTION_REGEXES: Array<{ regex: RegExp; suggestion: string }> = WEAK_ASSERTIONS.map(
  ([phrase, suggestion]) => {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { regex: new RegExp(`\\b${escaped}\\b`, 'gi'), suggestion };
  }
);

export const thesisWeakAssertionRule: LinterRule = {
  id: 'thesis_weak_assertion',
  name: 'Afirmaciones sin respaldo',
  description: 'Detecta expresiones que hacen afirmaciones sin evidencia: "es obvio que", "claramente", etc.',
  category: 'thesis',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      if (/^[#>]/.test(line.trim())) continue;

      for (const { regex, suggestion } of WEAK_ASSERTION_REGEXES) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(line)) !== null) {
          results.push({
            message: `Afirmación sin respaldo: "${match[0]}"`,
            suggestion,
            severity: 'warning',
            line: lineIdx + 1,
            column: match.index + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + 1 + match[0].length,
            source: 'Thesis'
          });
        }
      }
    }
    return results;
  }
};

export const thesisHypothesisRule: LinterRule = {
  id: 'thesis_hypothesis_statement',
  name: 'Hipótesis no identificada',
  description: 'Verifica que la Introducción contenga una declaración de hipótesis o pregunta de investigación.',
  category: 'thesis',
  defaultEnabled: false,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const headings = getHeadings(lines, codeLines, ctx);

    const introHeading = headings.find((h) =>
      headingMatchesPattern(h.text, ['introduccion', 'introducción'])
    );
    if (!introHeading) return [];

    const introIdx = headings.indexOf(introHeading);
    const nextIntroHeading = headings[introIdx + 1];
    const nextHeadingLine = nextIntroHeading ? nextIntroHeading.line : lines.length;

    const introText = lines
      .slice(introHeading.line + 1, nextHeadingLine)
      .filter((_, i) => !codeLines.has(introHeading.line + 1 + i))
      .join(' ')
      .toLowerCase();

    const hypothesisIndicators = [
      'hipótesis', 'hipotesis', 'se plantea que', 'se propone que',
      'se sostiene que', 'pregunta de investigación', 'pregunta de investigacion',
      'objetivo general', 'objetivo principal', 'esta investigación busca',
      'esta tesis argumenta', 'el presente trabajo propone'
    ];

    const hasHypothesis = hypothesisIndicators.some((h) => introText.includes(h));

    if (!hasHypothesis) {
      return [{
        message: 'La Introducción no contiene una hipótesis, pregunta de investigación ni objetivo explícito.',
        suggestion: 'Incluye una declaración clara: "La hipótesis de este trabajo es...", "Se propone que..." o "El objetivo principal es..."',
        severity: 'info',
        line: introHeading.line + 1,
        column: 1,
        endLine: introHeading.line + 1,
        endColumn: lineAt(lines, introHeading.line).length + 1,
        source: 'Thesis'
      }];
    }
    return [];
  }
};

export const thesisAbstractLengthRule: LinterRule = {
  id: 'thesis_abstract_length',
  name: 'Longitud del resumen',
  description: 'El resumen/abstract debe tener entre 150 y 300 palabras según normas APA.',
  category: 'thesis',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const headings = getHeadings(lines, codeLines, ctx);

    const abstractHeading = headings.find((h) =>
      headingMatchesPattern(h.text, ['resumen', 'abstract', 'sintesis'])
    );
    if (!abstractHeading) return [];

    const headingIdx = headings.indexOf(abstractHeading);
    const nextHeading = headings[headingIdx + 1];
    const nextLine = nextHeading ? nextHeading.line : lines.length;

    const abstractText = lines
      .slice(abstractHeading.line + 1, nextLine)
      .filter((_, i) => !codeLines.has(abstractHeading.line + 1 + i))
      .join(' ')
      .trim();

    const wordCount = abstractText.split(/\s+/).filter(Boolean).length;

    if (wordCount < 150) {
      return [{
        message: `Resumen demasiado corto: ${wordCount} palabras (mínimo recomendado: 150).`,
        suggestion: 'El resumen APA debe incluir: objetivo, metodología, resultados principales y conclusiones.',
        severity: 'warning',
        line: abstractHeading.line + 1,
        column: 1,
        endLine: abstractHeading.line + 1,
        endColumn: lineAt(lines, abstractHeading.line).length + 1,
        source: 'Thesis'
      }];
    }

    if (wordCount > 300) {
      return [{
        message: `Resumen demasiado largo: ${wordCount} palabras (máximo recomendado: 300).`,
        suggestion: 'APA 7ª ed. limita el resumen a 250-300 palabras para artículos y tesis.',
        severity: 'info',
        line: abstractHeading.line + 1,
        column: 1,
        endLine: abstractHeading.line + 1,
        endColumn: lineAt(lines, abstractHeading.line).length + 1,
        source: 'Thesis'
      }];
    }

    return [];
  }
};

export const thesisKeywordsRule: LinterRule = {
  id: 'thesis_keywords',
  name: 'Palabras clave faltantes',
  description: 'Las tesis deben incluir palabras clave (keywords) debajo del resumen.',
  category: 'thesis',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const headings = getHeadings(lines, codeLines, ctx);

    const abstractHeading = headings.find((h) =>
      headingMatchesPattern(h.text, ['resumen', 'abstract'])
    );
    if (!abstractHeading) return [];

    const headingIdx = headings.indexOf(abstractHeading);
    const nextHeading = headings[headingIdx + 1];
    const nextLine = nextHeading ? nextHeading.line : lines.length;

    const abstractLines = lines.slice(abstractHeading.line + 1, nextLine);
    const keywordPattern = /^\s*\*{0,2}(?:palabras?\s+clave|keywords?)\s*[:*]/i;
    const hasKeywords = abstractLines.some((l) => keywordPattern.test(l));

    if (!hasKeywords) {
      return [{
        message: 'No se encontraron palabras clave después del resumen.',
        suggestion: 'APA requiere 3–5 palabras clave. Ejemplo:\n**Palabras clave:** aprendizaje, cooperativo, formalización.',
        severity: 'info',
        line: abstractHeading.line + 1,
        column: 1,
        endLine: abstractHeading.line + 1,
        endColumn: lineAt(lines, abstractHeading.line).length + 1,
        source: 'Thesis'
      }];
    }
    return [];
  }
};

export const thesisSectionOrderRule: LinterRule = {
  id: 'thesis_section_order',
  name: 'Orden de secciones de tesis',
  description: 'Las secciones de la tesis deben aparecer en el orden canónico académico.',
  category: 'thesis',
  defaultEnabled: false,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const headings = getHeadings(lines, codeLines, ctx);

    const ORDER = [
      { patterns: ['resumen', 'abstract'], label: 'Resumen' },
      { patterns: ['introduccion'], label: 'Introducción' },
      { patterns: ['marco teorico', 'marco conceptual', 'revision', 'antecedentes', 'estado del arte'], label: 'Marco Teórico' },
      { patterns: ['metodologia', 'metodo'], label: 'Metodología' },
      { patterns: ['resultados', 'hallazgos', 'analisis'], label: 'Resultados' },
      { patterns: ['conclusiones', 'conclusion'], label: 'Conclusiones' },
      { patterns: ['referencias', 'bibliografia'], label: 'Referencias' }
    ];

    const foundOrder: Array<{ orderIdx: number; label: string; lineIdx: number }> = [];
    for (const heading of headings) {
      for (let oi = 0; oi < ORDER.length; oi++) {
        const orderedSection = ORDER[oi];
        if (orderedSection && headingMatchesPattern(heading.text, orderedSection.patterns)) {
          foundOrder.push({ orderIdx: oi, label: orderedSection.label, lineIdx: heading.line });
          break;
        }
      }
    }

    for (let i = 1; i < foundOrder.length; i++) {
      const current = foundOrder[i];
      const previous = foundOrder[i - 1];
      if (!current || !previous) continue;
      if (current.orderIdx < previous.orderIdx) {
        results.push({
          message: `Sección fuera de orden: "${current.label}" aparece antes de "${previous.label}".`,
          suggestion: `El orden canónico es: ${ORDER.map((s) => s.label).join(' → ')}`,
          severity: 'info',
          line: current.lineIdx + 1,
          column: 1,
          endLine: current.lineIdx + 1,
          endColumn: lineAt(lines, current.lineIdx).length + 1,
          source: 'Thesis'
        });
      }
    }
    return results;
  }
};

export const ALL_THESIS_RULES: LinterRule[] = [
  thesisMissingSectionRule,
  thesisFirstPersonRule,
  thesisWeakAssertionRule,
  thesisHypothesisRule,
  thesisAbstractLengthRule,
  thesisKeywordsRule,
  thesisSectionOrderRule
];
