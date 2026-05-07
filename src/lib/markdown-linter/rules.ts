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
  type LinterRuleContext,
  getCodeBlockLines,
  lineAt
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
import { ALL_ACADEMIC_RULES } from './academic-rules';
import { ALL_CITATION_RULES } from './citation-rules';
import { ALL_THESIS_RULES } from './thesis-rules';
export { ALL_ACADEMIC_RULES } from './academic-rules';
export { ALL_CITATION_RULES } from './citation-rules';
export { ALL_THESIS_RULES } from './thesis-rules';

// 2. STRUCTURE — Estructura Markdown

export const headingSpaceRule: LinterRule = {
  id: 'structure_heading_space',
  name: 'Espacio tras # en encabezados',
  description: 'Los encabezados Markdown deben tener un espacio después de los "#".',
  category: 'structure',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
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
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    let lastLevel = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const match = lineAt(lines, lineIdx).match(/^(#{1,6})\s/);
      if (match) {
        const hashes = match[1] ?? '';
        const level = hashes.length;
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
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    let h1Count = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      if (/^#\s/.test(lineAt(lines, lineIdx))) {
        h1Count++;
        if (h1Count > 1) {
          results.push({
            message: `Múltiples encabezados h1 (este es el #${h1Count}). Un documento debería tener solo uno.`,
            severity: 'info',
            line: lineIdx + 1,
            column: 1,
            endLine: lineIdx + 1,
            endColumn: lineAt(lines, lineIdx).length + 1,
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
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      if (/^#{1,6}\s*$/.test(lineAt(lines, lineIdx))) {
        results.push({
          message: 'Encabezado vacío — agrega texto descriptivo.',
          severity: 'warning',
          line: lineIdx + 1,
          column: 1,
          endLine: lineIdx + 1,
          endColumn: lineAt(lines, lineIdx).length + 1,
          source: 'Structure'
        });
      }
    }
    return results;
  }
};

// 3. LINKS — Validación de enlaces

export const linkSpacesRule: LinterRule = {
  id: 'links_url_spaces',
  name: 'Espacios en URLs',
  description: 'Las URLs de enlaces no deben contener espacios.',
  category: 'links',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      let match;
      while ((match = linkRegex.exec(line)) !== null) {
        const url = match[2] ?? '';
        if (url.includes(' ')) {
          results.push({
            message: 'La URL del enlace contiene espacios.',
            suggestion: 'Usa %20 en lugar de espacios.',
            severity: 'error',
            line: lineIdx + 1,
            column: match.index + match[0].indexOf(url) + 1,
            endLine: lineIdx + 1,
            endColumn: match.index + match[0].indexOf(url) + 1 + url.length,
            source: 'Links',
            replacements: [url.replace(/ /g, '%20')]
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
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      let match;
      while ((match = linkRegex.exec(line)) !== null) {
        const linkText = (match[1] ?? '').trim();
        const url = (match[2] ?? '').trim();
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
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    // Match URLs not preceded by ( or < or " or ]( which would be part of link syntax
    const urlRegex = /(?<![(<"[\]])https?:\/\/[^\s)>\]"]+/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
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

// 4. READABILITY — Legibilidad

export const longParagraphRule: LinterRule = {
  id: 'readability_long_paragraph',
  name: 'Párrafos extensos',
  description: 'Alerta cuando un párrafo supera las 150 palabras.',
  category: 'readability',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    let paragraphStart = -1;
    let paragraphWords = 0;
    let paragraphText = '';

    const flushParagraph = (endLineIdx: number) => {
      if (paragraphStart >= 0 && paragraphWords > 150) {
        results.push({
          message: `Párrafo de ${paragraphWords} palabras. Considere dividirlo para mejorar la legibilidad.`,
          suggestion: 'Los párrafos de menos de 150 palabras son más fáciles de leer.',
          severity: 'warning',
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
      const line = lineAt(lines, lineIdx);
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
  description: 'Alerta cuando una oración supera las 40 palabras.',
  category: 'readability',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      // Skip headings, lists, etc.
      if (/^[#\-*+>|]/.test(line.trim())) continue;

      // Split by sentence-ending punctuation
      const sentences = line.split(/(?<=[.!?;])\s+/);
      let col = 0;
      for (const sentence of sentences) {
        const words = sentence.trim().split(/\s+/).filter(Boolean);
        if (words.length > 40) {
          results.push({
            message: `Oración de ${words.length} palabras. Considere dividirla.`,
            suggestion: 'Las oraciones de 20-30 palabras son más claras.',
            severity: 'warning',
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

// 5. ACCESSIBILITY — Accesibilidad

export const imageAltTextRule: LinterRule = {
  id: 'accessibility_image_alt',
  name: 'Imágenes sin alt-text',
  description: 'Las imágenes deben tener texto alternativo para accesibilidad.',
  category: 'accessibility',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const imgRegex = /!\[([^\]]*)\]\([^)]+\)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      let match;
      while ((match = imgRegex.exec(line)) !== null) {
        if (!(match[1] ?? '').trim()) {
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

// 6. CONSISTENCY — Consistencia de estilo

export const mixedListMarkersRule: LinterRule = {
  id: 'consistency_list_markers',
  name: 'Marcadores de lista mixtos',
  description: 'Detecta uso mezclado de -, * y + como marcadores de lista.',
  category: 'consistency',
  defaultEnabled: false,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const markersUsed = new Map<string, number[]>();

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const match = lineAt(lines, lineIdx).match(/^(\s*)([-*+])\s/);
      if (match) {
        const marker = match[2];
        if (!marker) continue;
        const markerLines = markersUsed.get(marker) ?? [];
        markerLines.push(lineIdx);
        markersUsed.set(marker, markerLines);
      }
    }

    if (markersUsed.size > 1) {
      // Find the minority markers
      const sorted = Array.from(markersUsed.entries()).sort((a, b) => b[1].length - a[1].length);
      const dominant = sorted[0]?.[0];
      if (!dominant) return results;
      for (let i = 1; i < sorted.length; i++) {
        const entry = sorted[i];
        if (!entry) continue;
        const [marker, lineIdxs] = entry;
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

// 7. WHITESPACE — Espacios en blanco

export const trailingWhitespaceRule: LinterRule = {
  id: 'whitespace_trailing',
  name: 'Espacios al final de línea',
  description: 'Detecta espacios o tabs al final de las líneas (excepto "  " para <br>).',
  category: 'whitespace',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      // Markdown uses "  " (2 spaces) for <br>, so only flag >2 trailing spaces or trailing tabs
      const trailingMatch = line.match(/(\s+)$/);
      if (trailingMatch) {
        const trailing = trailingMatch[1];
        if (!trailing) continue;
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
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    let blankCount = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (lineAt(lines, lineIdx).trim() === '') {
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

// 8. ACADEMIC — Escritura académica

export const unclosedBracketsRule: LinterRule = {
  id: 'academic_unclosed_brackets',
  name: 'Paréntesis/corchetes sin cerrar',
  description: 'Detecta paréntesis, corchetes o llaves no balanceados en cada línea.',
  category: 'academic',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const pairs: [string, string][] = [['(', ')'], ['[', ']'], ['{', '}']];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);

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
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const markerRegex = /\b(TODO|FIXME|HACK|XXX|PENDIENTE|FALTA|COMPLETAR)\b/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
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

// ESTRUCTURA — Nuevas reglas

export const malformedTableRule: LinterRule = {
  id: 'structure_malformed_table',
  name: 'Tablas malformadas',
  description: 'Detecta tablas Markdown con columnas desiguales entre filas.',
  category: 'structure',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    let headerColCount = 0;
    let inTable = false;

    const countCols = (line: string) =>
      line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').length;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) { inTable = false; headerColCount = 0; continue; }
      const line = lineAt(lines, lineIdx);
      const isTableRow = line.trim().startsWith('|') && line.includes('|');

      if (isTableRow) {
        const cols = countCols(line);
        if (!inTable) {
          inTable = true;
          headerColCount = cols;
        } else {
          // Skip separator rows (---:|:---)
          if (/^\s*\|?[\s\-:|]+(\|[\s\-:|]+)*\|?\s*$/.test(line)) continue;
          if (cols !== headerColCount) {
            results.push({
              message: `Tabla malformada: esta fila tiene ${cols} columna(s) pero la cabecera tiene ${headerColCount}.`,
              suggestion: 'Asegúrate de que todas las filas tengan el mismo número de columnas.',
              severity: 'error',
              line: lineIdx + 1,
              column: 1,
              endLine: lineIdx + 1,
              endColumn: line.length + 1,
              source: 'Structure'
            });
          }
        }
      } else {
        inTable = false;
        headerColCount = 0;
      }
    }
    return results;
  }
};

export const codeBlockLangRule: LinterRule = {
  id: 'structure_code_block_lang',
  name: 'Bloques de código sin lenguaje',
  description: 'Detecta bloques de código (```) sin especificar el lenguaje.',
  category: 'structure',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    let inFence = false;
    let fenceChar = '';

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const trimmed = lineAt(lines, lineIdx).trim();
      if (!inFence) {
        const m = trimmed.match(/^(`{3,}|~{3,})(.*)/);
        if (m) {
          const fence = m[1] ?? '';
          inFence = true;
          fenceChar = fence[0] ?? '';
          if (!(m[2] ?? '').trim()) {
            results.push({
              message: 'Bloque de código sin lenguaje especificado.',
              suggestion: 'Agrega el lenguaje: ```javascript, ```python, ```st, etc.',
              severity: 'info',
              line: lineIdx + 1,
              column: 1,
              endLine: lineIdx + 1,
              endColumn: lineAt(lines, lineIdx).length + 1,
              source: 'Structure'
            });
          }
        }
      } else {
        const closeChar = fenceChar === '`' ? '`' : '~';
        if (new RegExp(`^${closeChar}{3,}\\s*$`).test(trimmed)) {
          inFence = false;
          fenceChar = '';
        }
      }
    }
    return results;
  }
};

export const unclosedFenceRule: LinterRule = {
  id: 'structure_unclosed_fence',
  name: 'Bloque de código sin cerrar',
  description: 'Detecta bloques de código (```) que no tienen cierre.',
  category: 'structure',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const lines = ctx?.lines ?? text.split('\n');
    let inFence = false;
    let fenceOpenLine = -1;
    let fenceChar = '';

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const trimmed = lineAt(lines, lineIdx).trim();
      if (!inFence) {
        const m = trimmed.match(/^(`{3,}|~{3,})/);
        if (m) {
          const fence = m[1] ?? '';
          inFence = true;
          fenceOpenLine = lineIdx;
          fenceChar = fence[0] ?? '';
        }
      } else {
        const closeChar = fenceChar === '`' ? '`' : '~';
        if (new RegExp(`^${closeChar}{3,}\\s*$`).test(trimmed)) {
          inFence = false; fenceChar = '';
        }
      }
    }

    if (inFence && fenceOpenLine >= 0) {
      return [{
        message: 'Bloque de código sin cerrar — falta el cierre ```.',
        severity: 'error',
        line: fenceOpenLine + 1,
        column: 1,
        endLine: fenceOpenLine + 1,
        endColumn: lineAt(lines, fenceOpenLine).length + 1,
        source: 'Structure'
      }];
    }
    return [];
  }
};

export const orphanFootnoteRule: LinterRule = {
  id: 'structure_orphan_footnote',
  name: 'Notas al pie huérfanas',
  description: 'Detecta notas al pie definidas pero no referenciadas, o usadas pero no definidas.',
  category: 'structure',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const defined = new Map<string, number>();
    const used = new Set<string>();

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      const defMatch = line.match(/^\s*\[\^([^\]]+)\]:/);
      const defId = defMatch?.[1];
      if (defId) { defined.set(defId, lineIdx); continue; }
      const useRegex = /\[\^([^\]]+)\](?!:)/g;
      let m;
      while ((m = useRegex.exec(line)) !== null) {
        const useId = m[1];
        if (useId) used.add(useId);
      }
    }

    for (const [id, lineIdx] of defined) {
      if (!used.has(id)) {
        results.push({
          message: `Nota al pie [^${id}] definida pero nunca referenciada.`,
          severity: 'warning',
          line: lineIdx + 1,
          column: 1,
          endLine: lineIdx + 1,
          endColumn: lineAt(lines, lineIdx).length + 1,
          source: 'Structure'
        });
      }
    }

    for (const id of used) {
      if (!defined.has(id)) {
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (codeLines.has(lineIdx)) continue;
          const col = lineAt(lines, lineIdx).indexOf(`[^${id}]`);
          if (col !== -1) {
            results.push({
              message: `Referencia [^${id}] usada pero sin definición.`,
              suggestion: `Agrega: [^${id}]: tu nota aquí.`,
              severity: 'error',
              line: lineIdx + 1,
              column: col + 1,
              endLine: lineIdx + 1,
              endColumn: col + id.length + 4,
              source: 'Structure'
            });
            break;
          }
        }
      }
    }
    return results;
  }
};

export const frontmatterRule: LinterRule = {
  id: 'structure_frontmatter',
  name: 'Validación de frontmatter',
  description: 'Valida los campos requeridos (title, date) y formato en el bloque YAML inicial.',
  category: 'structure',
  defaultEnabled: false,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    if (!lines[0]?.trim().startsWith('---')) return results;

    let endLine = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lineAt(lines, i).trim() === '---') { endLine = i; break; }
    }
    if (endLine === -1) {
      return [{ message: 'Frontmatter YAML sin cerrar — falta el "---" de cierre.', severity: 'error', line: 1, column: 1, endLine: 1, endColumn: lineAt(lines, 0).length + 1, source: 'Structure' }];
    }

    const fields = new Map<string, { value: string; lineIdx: number }>();
    for (let i = 1; i < endLine; i++) {
      const m = lineAt(lines, i).match(/^(\w[\w-]*):\s*(.*)$/);
      const key = m?.[1];
      if (key) fields.set(key, { value: (m[2] ?? '').trim(), lineIdx: i });
    }

    if (!fields.has('title')) {
      results.push({ message: 'Frontmatter: campo "title" requerido no encontrado.', suggestion: 'Agrega: title: "Título del documento"', severity: 'warning', line: 1, column: 1, endLine: 1, endColumn: 4, source: 'Structure' });
    }
    if (!fields.has('date')) {
      results.push({ message: 'Frontmatter: campo "date" requerido no encontrado.', suggestion: 'Agrega: date: YYYY-MM-DD', severity: 'warning', line: 1, column: 1, endLine: 1, endColumn: 4, source: 'Structure' });
    } else {
      const d = fields.get('date')!;
      const val = d.value.replace(/^["']|["']$/g, '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        results.push({ message: `Frontmatter: formato de fecha inválido "${d.value}". Use YYYY-MM-DD.`, severity: 'warning', line: d.lineIdx + 1, column: 1, endLine: d.lineIdx + 1, endColumn: lineAt(lines, d.lineIdx).length + 1, source: 'Structure' });
      }
    }
    return results;
  }
};

// LEGIBILIDAD — Nuevas reglas

export const fleschKincaidEsRule: LinterRule = {
  id: 'readability_flesch_kincaid_es',
  name: 'Legibilidad Flesch-Kincaid (español)',
  description: 'Calcula el índice de legibilidad Flesch adaptado al español por párrafo.',
  category: 'readability',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const countSyllables = (word: string) =>
      Math.max(1, (word.match(/[aeiouáéíóúü]+/gi) ?? []).length);

    let paraStart = -1;
    let paraLines: string[] = [];

    const flush = (endIdx: number) => {
      if (paraStart < 0 || paraLines.length === 0) return;
      const paraText = paraLines.join(' ').trim();
      const sentences = paraText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      if (!sentences.length) return;
      let words = 0, syllables = 0;
      for (const s of sentences) {
        const ws = s.trim().split(/\s+/).filter(Boolean);
        words += ws.length;
        syllables += ws.reduce((acc, w) => acc + countSyllables(w.replace(/[^a-záéíóúüñ]/gi, '')), 0);
      }
      if (!words) return;
      const re = 206.84 - 1.02 * (words / sentences.length) - 60.0 * (syllables / words);
      if (re < 30) {
        results.push({ message: `Párrafo muy difícil de leer (RE ≈ ${Math.round(re)}). Usa oraciones más cortas y palabras simples.`, severity: 'warning', line: paraStart + 1, column: 1, endLine: endIdx + 1, endColumn: 1, source: 'Readability' });
      } else if (re < 50) {
        results.push({ message: `Párrafo difícil de leer (RE ≈ ${Math.round(re)}). Puede simplificarse.`, severity: 'info', line: paraStart + 1, column: 1, endLine: endIdx + 1, endColumn: 1, source: 'Readability' });
      }
      paraStart = -1; paraLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      if (codeLines.has(i)) { flush(i - 1); continue; }
      const t = lineAt(lines, i).trim();
      if (!t || /^#{1,6}\s/.test(t) || /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t)) { flush(i - 1); continue; }
      if (paraStart < 0) paraStart = i;
      paraLines.push(t);
    }
    flush(lines.length - 1);
    return results;
  }
};

// CONSISTENCIA — Nuevas reglas

export const quoteStyleRule: LinterRule = {
  id: 'consistency_quote_style',
  name: 'Estilos de comillas mixtos',
  description: 'Detecta mezcla de comillas rectas (" ") y tipográficas (" " o « »).',
  category: 'consistency',
  defaultEnabled: false,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    let hasStraight = false, hasTypographic = false;

    for (let i = 0; i < lines.length; i++) {
      if (codeLines.has(i)) continue;
      if (/"/.test(lineAt(lines, i))) hasStraight = true;
      if (/[""«»]/.test(lineAt(lines, i))) hasTypographic = true;
    }
    if (!hasStraight || !hasTypographic) return results;

    const regex = /"([^"]*)"/g;
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      let m;
      while ((m = regex.exec(lineAt(lines, lineIdx))) !== null) {
        results.push({
          message: 'Comillas rectas mezcladas con tipográficas.',
          suggestion: 'Usa comillas tipográficas: \u201c\u2026\u201d o «\u2026»',
          severity: 'info',
          line: lineIdx + 1, column: m.index + 1, endLine: lineIdx + 1, endColumn: m.index + 1 + m[0].length,
          source: 'Consistency',
          replacements: [`\u201c${m[1]}\u201d`, `\u00ab${m[1]}\u00bb`]
        });
      }
    }
    return results;
  }
};

export const dashStyleRule: LinterRule = {
  id: 'consistency_dash_style',
  name: 'Guiones usados como rayas',
  description: 'Detecta guiones rodeados de espacios que probablemente deberían ser rayas (—).',
  category: 'consistency',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const regex = / - /g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      if (/^[#\-*+>|]/.test(line.trim())) continue;
      let m;
      while ((m = regex.exec(line)) !== null) {
        results.push({
          message: 'Guión rodeado de espacios — posiblemente debería ser una raya (—) o guión largo (–).',
          suggestion: 'Usa \u2014 (raya) para incisos o \u2013 (guión largo) para rangos.',
          severity: 'info',
          line: lineIdx + 1, column: m.index + 1, endLine: lineIdx + 1, endColumn: m.index + 4,
          source: 'Consistency',
          replacements: [' \u2014 ', ' \u2013 ']
        });
      }
    }
    return results;
  }
};

export const numberStyleRule: LinterRule = {
  id: 'consistency_number_style',
  name: 'Estilo de números mixto',
  description: 'Detecta mezcla de números arábigos y escritos en la misma línea.',
  category: 'consistency',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const written = /\b(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|cien|ciento|mil)\b/gi;
    const arabic = /\b\d+\b/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      if (/^[#\-*+>|]/.test(line.trim())) continue;
      const hasArabic = arabic.test(line); arabic.lastIndex = 0;
      const hasWritten = written.test(line); written.lastIndex = 0;
      if (hasArabic && hasWritten) {
        results.push({
          message: 'Mezcla de números arábigos y escritos en la misma línea.',
          suggestion: 'Elige un estilo consistente (arábigos o escritos) para todo el documento.',
          severity: 'info',
          line: lineIdx + 1, column: 1, endLine: lineIdx + 1, endColumn: line.length + 1,
          source: 'Consistency'
        });
      }
    }
    return results;
  }
};

// 10. STRUCTURE — Reglas adicionales de estructura

export const duplicateHeadingsRule: LinterRule = {
  id: 'structure_duplicate_headings',
  name: 'Encabezados duplicados',
  description: 'Detecta encabezados con texto idéntico en el mismo documento.',
  category: 'structure',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const seen = new Map<string, number>(); // normalized text → first line

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) continue;

      const headingText = match[2] ?? '';
      const normalized = headingText.trim().toLowerCase().replace(/\s+/g, ' ');
      const firstLine = seen.get(normalized);

      if (firstLine !== undefined) {
        results.push({
          message: `Encabezado duplicado: "${headingText.trim()}" (primera aparición en línea ${firstLine + 1}).`,
          suggestion: 'Diferencia los encabezados para mejorar la navegación y los anclas del documento.',
          severity: 'warning',
          line: lineIdx + 1,
          column: 1,
          endLine: lineIdx + 1,
          endColumn: line.length + 1,
          source: 'Structure'
        });
      } else {
        seen.set(normalized, lineIdx);
      }
    }
    return results;
  }
};

export const emptyListItemRule: LinterRule = {
  id: 'structure_empty_list_item',
  name: 'Elementos de lista vacíos',
  description: 'Detecta ítems de lista sin contenido.',
  category: 'structure',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      // Unordered: - , * , + or Ordered: 1.  2.  etc.
      if (/^(\s*[-*+]|\s*\d+\.)\s*$/.test(line)) {
        results.push({
          message: 'Elemento de lista vacío.',
          suggestion: 'Agrega contenido al elemento o elimínalo.',
          severity: 'warning',
          line: lineIdx + 1,
          column: 1,
          endLine: lineIdx + 1,
          endColumn: line.length + 1,
          source: 'Structure'
        });
      }
    }
    return results;
  }
};

// 11. ACCESSIBILITY — Reglas adicionales

export const linkTextQualityRule: LinterRule = {
  id: 'accessibility_link_text_quality',
  name: 'Texto de enlace descriptivo',
  description: 'Los enlaces deben usar texto descriptivo, no "clic aquí", "enlace", "aquí", etc.',
  category: 'accessibility',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const BAD_TEXTS = new Set([
      'clic aquí', 'haz clic aquí', 'click aquí', 'click here',
      'aquí', 'enlace', 'link', 'este enlace', 'this link',
      'haga clic', 'ver más', 'leer más', 'más info', 'pincha aquí',
      'pulse aquí', 'presione aquí', 'ver', 'ir'
    ]);

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      // Match [text](url) patterns
      const linkRegex = /\[([^\]]+)\]\([^)]+\)/g;
      let m;
      while ((m = linkRegex.exec(line)) !== null) {
        const rawLinkText = m[1] ?? '';
        const linkText = rawLinkText.trim().toLowerCase();
        if (BAD_TEXTS.has(linkText)) {
          results.push({
            message: `Texto de enlace poco descriptivo: "${rawLinkText.trim()}"`,
            suggestion: 'Usa texto que describa el destino: "[guía de instalación](url)" en lugar de "[clic aquí](url)".',
            severity: 'warning',
            line: lineIdx + 1,
            column: m.index + 1,
            endLine: lineIdx + 1,
            endColumn: m.index + 1 + m[0].length,
            source: 'Accessibility'
          });
        }
      }
    }
    return results;
  }
};

export const htmlInMarkdownRule: LinterRule = {
  id: 'accessibility_html_in_markdown',
  name: 'HTML crudo en Markdown',
  description: 'Detecta etiquetas HTML crudas que podrían reemplazarse con Markdown.',
  category: 'accessibility',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    // Common HTML tags that have Markdown equivalents
    const HTML_TAGS = /(<\/?(?:b|i|em|strong|h[1-6]|a|img|br|hr|p|ul|ol|li|blockquote|code|pre)\b[^>]*>)/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      let m;
      while ((m = HTML_TAGS.exec(line)) !== null) {
        const tag = m[1] ?? '';
        results.push({
          message: `HTML crudo detectado: "${tag}"`,
          suggestion: 'Usa la sintaxis Markdown equivalente para mejor portabilidad y accesibilidad.',
          severity: 'info',
          line: lineIdx + 1,
          column: m.index + 1,
          endLine: lineIdx + 1,
          endColumn: m.index + 1 + tag.length,
          source: 'Accessibility'
        });
      }
    }
    return results;
  }
};

// 12. READABILITY — Reglas adicionales

export const excessiveExclamationRule: LinterRule = {
  id: 'readability_excessive_exclamation',
  name: 'Exclamaciones excesivas',
  description: 'Detecta uso repetido de signos de exclamación en escritura formal.',
  category: 'readability',
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

      // Multiple consecutive exclamation marks
      const multiExcl = /!{2,}/g;
      let m;
      while ((m = multiExcl.exec(line)) !== null) {
        results.push({
          message: `Exclamaciones múltiples: "${m[0]}"`,
          suggestion: 'En escritura formal, un solo signo de exclamación es suficiente.',
          severity: 'info',
          line: lineIdx + 1,
          column: m.index + 1,
          endLine: lineIdx + 1,
          endColumn: m.index + 1 + m[0].length,
          source: 'Readability',
          replacements: ['!']
        });
      }
    }
    return results;
  }
};

export const sentenceStartConjunctionRule: LinterRule = {
  id: 'readability_sentence_start_conjunction',
  name: 'Oraciones que inician con conjunción',
  description: 'Detecta oraciones que inician con "Y", "Pero", "O", "Ni" en escritura formal.',
  category: 'readability',
  defaultEnabled: false,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    // After period+space or start of paragraph, conjunction + space
    const conjunctionRegex = /(?:^|[.!?]\s+)(Y|Pero|O|Ni|E)\s+[a-záéíóúüñ]/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      if (/^[#\->*+|`]/.test(line.trim())) continue;

      let m;
      while ((m = conjunctionRegex.exec(line)) !== null) {
        const conj = m[1];
        if (!conj) continue;
        const conjStart = m.index + m[0].indexOf(conj);
        results.push({
          message: `Oración inicia con la conjunción "${conj}".`,
          suggestion: 'En escritura académica, evita iniciar oraciones con conjunciones coordinantes. Reformula: "Además…", "Sin embargo…", "No obstante…".',
          severity: 'info',
          line: lineIdx + 1,
          column: conjStart + 1,
          endLine: lineIdx + 1,
          endColumn: conjStart + 1 + conj.length,
          source: 'Readability'
        });
      }
    }
    return results;
  }
};

// 13. CONSISTENCY — Reglas adicionales

const TERMINOLOGY_PAIRS: Array<[RegExp, RegExp, string, string]> = [
  [/\bcap\.\s/gi, /\bcapítulo\s/gi, 'cap.', 'capítulo'],
  [/\bfig\.\s/gi, /\bfigura\s/gi, 'fig.', 'figura'],
  [/\btab\.\s/gi, /\btabla\s/gi, 'tab.', 'tabla'],
  [/\bec\.\s/gi, /\becuación\s/gi, 'ec.', 'ecuación'],
  [/\bpág\.\s/gi, /\bpágina\s/gi, 'pág.', 'página'],
  [/\bsec\.\s/gi, /\bsección\s/gi, 'sec.', 'sección']
];

export const inconsistentTerminologyRule: LinterRule = {
  id: 'consistency_terminology',
  name: 'Terminología inconsistente',
  description: 'Detecta mezcla de abreviaturas y formas completas: "cap." vs "capítulo", "fig." vs "figura", etc.',
  category: 'consistency',
  defaultEnabled: false,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const plainText = lines.filter((_, i) => !codeLines.has(i)).join('\n');

    for (const [abbrRe, fullRe, abbrLabel, fullLabel] of TERMINOLOGY_PAIRS) {
      abbrRe.lastIndex = 0;
      fullRe.lastIndex = 0;
      const hasAbbr = abbrRe.test(plainText);
      const hasFull = fullRe.test(plainText);

      if (hasAbbr && hasFull) {
        // Find the first occurrence of the abbreviation to mark
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (codeLines.has(lineIdx)) continue;
          const re = new RegExp(`\\b${abbrLabel.replace('.', '\\.')}\\s`, 'i');
          const m = re.exec(lineAt(lines, lineIdx));
          if (m) {
            results.push({
              message: `Mezcla de "${abbrLabel}" y "${fullLabel}" en el documento.`,
              suggestion: `Elige un estilo consistente: usa siempre "${abbrLabel}" o siempre "${fullLabel}".`,
              severity: 'info',
              line: lineIdx + 1,
              column: m.index + 1,
              endLine: lineIdx + 1,
              endColumn: m.index + 1 + abbrLabel.length,
              source: 'Consistency'
            });
            break;
          }
        }
      }
    }
    return results;
  }
};

// 14. LINKS — Reglas adicionales

export const brokenInternalLinkRule: LinterRule = {
  id: 'links_broken_internal',
  name: 'Enlaces internos rotos',
  description: 'Detecta enlaces a anclas (#seccion) que no corresponden a ningún encabezado del documento.',
  category: 'links',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    // Collect all heading anchors (GitHub-style slugification)
    const anchors = new Set<string>();
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const match = lineAt(lines, lineIdx).match(/^#{1,6}\s+(.+)$/);
      if (match) {
        const headingText = match[1] ?? '';
        const slug = headingText
          .trim()
          .toLowerCase()
          .replace(/[^\w\s\-áéíóúüñ]/g, '')
          .replace(/\s+/g, '-');
        anchors.add(slug);
      }
    }

    // Find internal links [text](#anchor) or bare #anchor in [text](#anchor)
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      const linkRegex = /\[[^\]]*\]\(#([^)]+)\)/g;
      let m;
      while ((m = linkRegex.exec(line)) !== null) {
        const anchor = (m[1] ?? '').trim().toLowerCase();
        if (!anchors.has(anchor)) {
          results.push({
            message: `Enlace interno roto: "#${m[1] ?? ''}" no corresponde a ningún encabezado.`,
            suggestion: 'Verifica el ancla o crea un encabezado que la genere.',
            severity: 'warning',
            line: lineIdx + 1,
            column: m.index + 1,
            endLine: lineIdx + 1,
            endColumn: m.index + 1 + m[0].length,
            source: 'Links'
          });
        }
      }
    }
    return results;
  }
};

// EXPORTACIÓN — Todas las reglas built-in

export const ALL_BUILTIN_RULES: LinterRule[] = [
  // Spelling
  spellingRule,
  doubledWordsRule,
  accentPatternRule,
  suspiciousPatternsRule,
  // Structure — originales
  headingSpaceRule,
  headingHierarchyRule,
  multipleH1Rule,
  emptyHeadingRule,
  // Structure — nuevas
  malformedTableRule,
  codeBlockLangRule,
  unclosedFenceRule,
  orphanFootnoteRule,
  frontmatterRule,
  duplicateHeadingsRule,
  emptyListItemRule,
  // Links
  linkSpacesRule,
  emptyLinkRule,
  bareUrlRule,
  brokenInternalLinkRule,
  // Readability
  longParagraphRule,
  longSentenceRule,
  fleschKincaidEsRule,
  excessiveExclamationRule,
  sentenceStartConjunctionRule,
  // Accessibility
  imageAltTextRule,
  linkTextQualityRule,
  htmlInMarkdownRule,
  // Consistency — originales
  mixedListMarkersRule,
  // Consistency — nuevas
  quoteStyleRule,
  dashStyleRule,
  numberStyleRule,
  inconsistentTerminologyRule,
  // Whitespace
  trailingWhitespaceRule,
  consecutiveBlankLinesRule,
  // Academic — originales
  unclosedBracketsRule,
  todoMarkersRule,
  // Academic — nuevas (de academic-rules.ts)
  ...ALL_ACADEMIC_RULES,
  // Citation
  ...ALL_CITATION_RULES,
  // Thesis
  ...ALL_THESIS_RULES
];

export const BUILTIN_RULES_BY_ID = new Map(ALL_BUILTIN_RULES.map((rule) => [rule.id, rule]));
export const BUILTIN_RULE_IDS = new Set(ALL_BUILTIN_RULES.map((rule) => rule.id));
