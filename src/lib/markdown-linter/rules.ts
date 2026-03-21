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
  getCodeBlockLines
} from './types';
import {
  spellingRule,
  doubledWordsRule,
  accentPatternRule,
  suspiciousPatternsRule
} from './spelling-rules';
export {
  spellingRule,
  doubledWordsRule,
  accentPatternRule,
  suspiciousPatternsRule
} from './spelling-rules';

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
          replacements: [`${hashes} `]
        });
      }
    }
    return results;
  }
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
            source: 'Structure'
          });
        }
        lastLevel = level;
      }
    }
    return results;
  }
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
            source: 'Structure'
          });
        }
      }
    }
    return results;
  }
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
          source: 'Structure'
        });
      }
    }
    return results;
  }
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
            replacements: [match[2].replace(/ /g, '%20')]
          });
        }
      }
    }
    return results;
  }
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
            source: 'Links'
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
            source: 'Links'
          });
        }
      }
    }
    return results;
  }
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
          source: 'Links'
        });
      }
    }
    return results;
  }
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
          source: 'Readability'
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
      paragraphText += ` ${trimmed}`;
      paragraphWords = paragraphText.trim().split(/\s+/).length;
    }
    flushParagraph(lines.length - 1);
    return results;
  }
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
            source: 'Readability'
          });
        }
        col += sentence.length + 1;
      }
    }
    return results;
  }
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
            source: 'Accessibility'
          });
        }
      }
    }
    return results;
  }
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
            source: 'Consistency'
          });
        }
      }
    }
    return results;
  }
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
          replacements: ['']
        });
      }
    }
    return results;
  }
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
            source: 'Whitespace'
          });
        }
      } else {
        blankCount = 0;
      }
    }
    return results;
  }
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
            source: 'Academic'
          });
        } else if (count < 0) {
          results.push({
            message: `${close} extra: hay ${-count} ${close} sin su ${open} correspondiente.`,
            severity: 'warning',
            line: lineIdx + 1,
            column: 1,
            endLine: lineIdx + 1,
            endColumn: line.length + 1,
            source: 'Academic'
          });
        }
      }
    }
    return results;
  }
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
          source: 'Academic'
        });
      }
    }
    return results;
  }
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
  todoMarkersRule
];
