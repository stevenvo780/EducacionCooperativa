/**
 * Reglas de citación y referencias bibliográficas.
 *
 * Soporta formato APA (el más común en academias de habla hispana),
 * con detección de cross-referencias entre citas en texto y bibliografía.
 *
 * Integración con ST: los bloques `source` en archivos .st actúan como
 * entradas bibliográficas formalizadas y se cruzan con citas en texto.
 */

import { type LinterRule, type LinterDiagnostic, getCodeBlockLines } from './types';

// ── Helpers ──────────────────────────────────────────────────

/**
 * Detecta la línea donde empieza una sección de bibliografía/referencias.
 * Acepta variantes en español e inglés.
 */
function findBibliographySection(lines: string[]): number {
  const bibPattern = /^#{1,3}\s+(referencias?|bibliografía|bibliography|fuentes?|works\s+cited|literatura\s+citada)\s*$/i;
  for (let i = 0; i < lines.length; i++) {
    if (bibPattern.test(lines[i].trim())) return i;
  }
  return -1;
}

/**
 * Extrae el apellido y año de una cita APA en texto.
 * Formas válidas:
 *   (García, 2020)  (García y López, 2020)  (García et al., 2020)
 *   García (2020)   Smith (2020, p. 45)
 * Devuelve { author, year, raw } o null.
 */
function parseInTextCitation(raw: string): { key: string; raw: string } | null {
  // (Apellido, Año) o (Apellido y Apellido, Año) o (Apellido et al., Año)
  const parenMatch = raw.match(
    /\(([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+(?:y|and|&)\s+[A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+)?(?:\s+et\s+al\.?)?),\s*(\d{4}[a-z]?)(?:,\s*p[pág]+\.\s*[\d\-]+)?\)/
  );
  if (parenMatch) {
    const author = parenMatch[1].split(/\s+(?:y|and|&)\s+/)[0].split(/\s+et\s+al/)[0].trim();
    return { key: `${author.toLowerCase()}_${parenMatch[2]}`, raw };
  }

  // Apellido (Año) — narrativa
  const narrativeMatch = raw.match(
    /\b([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+et\s+al\.?)?)\s*\((\d{4}[a-z]?)(?:,\s*p[pág]+\.\s*[\d\-]+)?\)/
  );
  if (narrativeMatch) {
    return { key: `${narrativeMatch[1].toLowerCase()}_${narrativeMatch[2]}`, raw };
  }

  return null;
}

/**
 * Normaliza una entrada bibliográfica a una clave comparable con las citas en texto.
 * Acepta formatos como:
 *   García, J. (2020). Título...
 *   García, J., & López, M. (2020). Título...
 *   García García, J. M. (2020). Título...
 */
function parseBibEntry(line: string): string | null {
  const match = line.trim().match(/^([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:[A-Za-záéíóúüñ\s,\.]+)?)\s*\((\d{4}[a-z]?)\)/);
  if (!match) return null;
  const firstAuthor = match[1].split(',')[0].trim().split(/\s+/).pop()!;
  return `${firstAuthor.toLowerCase()}_${match[2]}`;
}

// ═══════════════════════════════════════════════════════════
// 1. CITAS APA MAL FORMADAS
// ═══════════════════════════════════════════════════════════

export const apaMalformedRule: LinterRule = {
  id: 'citation_apa_malformed',
  name: 'Citas APA mal formadas',
  description: 'Detecta citas entre paréntesis que no siguen el formato APA: (Autor, Año).',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    // Citas sin coma: (Smith 2020) o (Smith2020)
    const missingComma = /\(([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+[A-Za-záéíóúüñ]+)?)\s+(\d{4}[a-z]?)\)/g;
    // Comas sin espacio: (Smith,2020)
    const missingSpace = /\([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+,(\d{4})\)/g;
    // Corchetes en vez de paréntesis: [Smith, 2020]
    const wrongBrackets = /\[([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+),\s*(\d{4}[a-z]?)\]/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];

      let match;
      while ((match = missingComma.exec(line)) !== null) {
        results.push({
          message: `Cita sin coma entre autor y año: "${match[0]}"`,
          suggestion: `Formato APA correcto: (${match[1]}, ${match[2]})`,
          severity: 'warning',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Citation',
          replacements: [`(${match[1]}, ${match[2]})`]
        });
      }

      while ((match = missingSpace.exec(line)) !== null) {
        const author = match[0].match(/\(([^,]+),/)![1];
        results.push({
          message: `Cita APA sin espacio tras la coma: "${match[0]}"`,
          severity: 'info',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Citation',
          replacements: [`(${author}, ${match[1]})`]
        });
      }

      while ((match = wrongBrackets.exec(line)) !== null) {
        results.push({
          message: `Cita con corchetes: "${match[0]}" — APA usa paréntesis, no corchetes.`,
          severity: 'warning',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Citation',
          replacements: [`(${match[1]}, ${match[2]})`]
        });
      }
    }
    return results;
  }
};

// ═══════════════════════════════════════════════════════════
// 2. CITAS EN TEXTO SIN ENTRADA EN BIBLIOGRAFÍA
// ═══════════════════════════════════════════════════════════

export const missingBibliographyRule: LinterRule = {
  id: 'citation_missing_bibliography',
  name: 'Citas sin entrada bibliográfica',
  description: 'Detecta citas en el texto que no tienen entrada en la sección de Referencias.',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const bibStart = findBibliographySection(lines);
    if (bibStart === -1) return results; // No hay sección de referencias — otra regla lo detecta

    // Recopilar entradas bibliográficas
    const bibKeys = new Set<string>();
    for (let i = bibStart + 1; i < lines.length; i++) {
      const key = parseBibEntry(lines[i]);
      if (key) bibKeys.add(key);
    }
    if (bibKeys.size === 0) return results;

    // Buscar citas en el cuerpo del texto (antes de la bibliografía)
    const citationRegex = /\([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ\s,\.&]+,?\s*\d{4}[a-z]?(?:,\s*p[pág]+\.\s*[\d\-]+)?\)/g;
    const narrativeRegex = /\b[A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+et\s+al\.?)?\s*\(\d{4}[a-z]?(?:,\s*p[pág]+\.\s*[\d\-]+)?\)/g;

    for (let lineIdx = 0; lineIdx < Math.min(bibStart, lines.length); lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];

      for (const regex of [citationRegex, narrativeRegex]) {
        let match;
        while ((match = regex.exec(line)) !== null) {
          const parsed = parseInTextCitation(match[0]);
          if (!parsed) continue;
          if (!bibKeys.has(parsed.key)) {
            results.push({
              message: `Cita "${match[0]}" no encontrada en la sección de Referencias.`,
              suggestion: 'Agrega la entrada bibliográfica completa en APA al final del documento.',
              severity: 'warning',
              line: lineIdx + 1,
              column: match.index + 1,
              endLine: lineIdx + 1,
              endColumn: match.index + 1 + match[0].length,
              source: 'Citation'
            });
          }
        }
      }
    }
    return results;
  }
};

// ═══════════════════════════════════════════════════════════
// 3. ENTRADAS BIBLIOGRÁFICAS SIN CITA EN TEXTO
// ═══════════════════════════════════════════════════════════

export const orphanBibliographyRule: LinterRule = {
  id: 'citation_orphan_bibliography',
  name: 'Referencias sin citar en el texto',
  description: 'Detecta entradas en la bibliografía que nunca se citan en el cuerpo del documento.',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const bibStart = findBibliographySection(lines);
    if (bibStart === -1) return results;

    // Recopilar entradas bibliográficas con su línea
    const bibEntries: Array<{ key: string; lineIdx: number; raw: string }> = [];
    for (let i = bibStart + 1; i < lines.length; i++) {
      const key = parseBibEntry(lines[i]);
      if (key) bibEntries.push({ key, lineIdx: i, raw: lines[i].trim() });
    }

    // Recopilar todas las claves citadas en el texto
    const citedKeys = new Set<string>();
    const citationRegex = /\([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ\s,\.&]+,?\s*\d{4}[a-z]?(?:,\s*p[pág]+\.\s*[\d\-]+)?\)/g;
    const narrativeRegex = /\b[A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+et\s+al\.?)?\s*\(\d{4}[a-z]?(?:,\s*p[pág]+\.\s*[\d\-]+)?\)/g;

    for (let lineIdx = 0; lineIdx < bibStart; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      for (const regex of [citationRegex, narrativeRegex]) {
        let match;
        while ((match = regex.exec(line)) !== null) {
          const parsed = parseInTextCitation(match[0]);
          if (parsed) citedKeys.add(parsed.key);
        }
      }
    }

    // Reportar entradas no citadas
    for (const entry of bibEntries) {
      if (!citedKeys.has(entry.key)) {
        results.push({
          message: `Referencia bibliográfica nunca citada en el texto: "${entry.raw.slice(0, 60)}…"`,
          suggestion: 'Cita esta fuente en el texto o elimínala de la bibliografía.',
          severity: 'info',
          line: entry.lineIdx + 1,
          column: 1,
          endLine: entry.lineIdx + 1,
          endColumn: lines[entry.lineIdx].length + 1,
          source: 'Citation'
        });
      }
    }
    return results;
  }
};

// ═══════════════════════════════════════════════════════════
// 4. FORMATO DOI
// ═══════════════════════════════════════════════════════════

export const doiFormatRule: LinterRule = {
  id: 'citation_doi_format',
  name: 'Formato DOI inválido',
  description: 'Los DOIs en bibliografía deben usar https://doi.org/10.XXXX/XXX',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    // DOI sin protocolo https: doi.org/... o 10.xxxx/...
    const badDoi = /(?<![/\w])(?:doi:\s*|DOI:\s*)(10\.\d{4,}\/\S+)/g;
    // DOI con http en vez de https
    const httpDoi = /\bhttp:\/\/doi\.org\/(10\.\d{4,}\/\S+)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];

      let match;
      while ((match = badDoi.exec(line)) !== null) {
        results.push({
          message: `DOI sin formato URL completo: "${match[0]}"`,
          suggestion: 'APA 7ª ed. requiere: https://doi.org/' + match[1],
          severity: 'warning',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Citation',
          replacements: [`https://doi.org/${match[1]}`]
        });
      }

      while ((match = httpDoi.exec(line)) !== null) {
        results.push({
          message: `DOI con http (inseguro): "${match[0]}"`,
          suggestion: 'Usa https://doi.org/' + match[1],
          severity: 'info',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Citation',
          replacements: [`https://doi.org/${match[1]}`]
        });
      }
    }
    return results;
  }
};

// ═══════════════════════════════════════════════════════════
// 5. SECCIÓN DE REFERENCIAS FALTANTE
// ═══════════════════════════════════════════════════════════

export const missingReferenceSectionRule: LinterRule = {
  id: 'citation_missing_reference_section',
  name: 'Sección de Referencias faltante',
  description: 'Si el documento tiene citas en texto, debe tener una sección de Referencias.',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string): LinterDiagnostic[] => {
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);

    // ¿Hay citas en el texto?
    const citationRegex = /\([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+,\s*\d{4}\)/;
    let hasCitations = false;
    for (let i = 0; i < lines.length; i++) {
      if (!codeLines.has(i) && citationRegex.test(lines[i])) {
        hasCitations = true;
        break;
      }
    }

    if (!hasCitations) return [];
    if (findBibliographySection(lines) !== -1) return [];

    return [{
      message: 'El documento contiene citas bibliográficas pero no tiene sección de "Referencias" o "Bibliografía".',
      suggestion: 'Agrega una sección ## Referencias al final del documento con las entradas en formato APA.',
      severity: 'warning',
      line: lines.length,
      column: 1,
      endLine: lines.length,
      endColumn: 1,
      source: 'Citation'
    }];
  }
};

// ═══════════════════════════════════════════════════════════
// 6. CITAS IBID / OP. CIT. (obsoletas en APA)
// ═══════════════════════════════════════════════════════════

export const ibidOpCitRule: LinterRule = {
  id: 'citation_ibid_op_cit',
  name: 'Ibid. / Op. cit. (obsoletos en APA)',
  description: 'APA no usa "ibid." ni "op. cit." — repite la cita completa.',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = text.split('\n');
    const codeLines = getCodeBlockLines(lines);
    const ibidRegex = /\b(ibid\.?|ibídem\.?|op\.\s*cit\.?|loc\.\s*cit\.?)\b/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lines[lineIdx];
      let match;
      while ((match = ibidRegex.exec(line)) !== null) {
        results.push({
          message: `"${match[0]}" es una abreviatura obsoleta en APA.`,
          suggestion: 'Repite la cita completa: (Autor, Año) o Autor (Año).',
          severity: 'warning',
          line: lineIdx + 1,
          column: match.index + 1,
          endLine: lineIdx + 1,
          endColumn: match.index + 1 + match[0].length,
          source: 'Citation'
        });
      }
    }
    return results;
  }
};

export const ALL_CITATION_RULES: LinterRule[] = [
  apaMalformedRule,
  missingBibliographyRule,
  orphanBibliographyRule,
  doiFormatRule,
  missingReferenceSectionRule,
  ibidOpCitRule
];
