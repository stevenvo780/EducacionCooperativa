import {
  type LinterRule,
  type LinterDiagnostic,
  type LinterRuleContext,
  type BibliographyEntry,
  getCodeBlockLines,
  lineAt
} from './types';

const BIB_HEADING_REGEX = /^#{1,3}\s+(referencias?|bibliografía|bibliography|fuentes?|works\s+cited|literatura\s+citada)\s*$/i;
const BIB_ENTRY_REGEX = /^([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:[A-Za-záéíóúüñ\s,\.]+)?)\s*\((\d{4}[a-z]?)\)/;

const CITATION_LINE_MAX_LEN = 4000;
const CITATION_SPECIAL_DENSITY_LIMIT = 50;

function isAdversarialCitationLine(line: string): boolean {
  if (line.length > CITATION_LINE_MAX_LEN) return true;
  let specials = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line.charCodeAt(i);
    if (
      ch === 0x28 ||
      ch === 0x29 ||
      ch === 0x2c ||
      ch === 0x2e ||
      ch === 0x26 ||
      ch === 0x5b ||
      ch === 0x5d ||
      ch === 0x2d ||
      ch === 0x5c ||
      ch === 0x2f
    ) {
      specials++;
      if (specials > CITATION_SPECIAL_DENSITY_LIMIT) return true;
    }
  }
  return false;
}

function findBibliographySection(lines: readonly string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (BIB_HEADING_REGEX.test(lineAt(lines, i).trim())) return i;
  }
  return -1;
}

function parseBibEntry(line: string): string | null {
  const match = line.trim().match(BIB_ENTRY_REGEX);
  if (!match) return null;
  const firstAuthor = (match[1] ?? '').split(',')[0]?.trim().split(/\s+/).pop();
  const year = match[2];
  if (!firstAuthor || !year) return null;
  return `${firstAuthor.toLowerCase()}_${year}`;
}

function getBibStart(lines: readonly string[], ctx?: LinterRuleContext): number {
  if (ctx) return ctx.bibliographySectionLineIdx ?? -1;
  return findBibliographySection(lines);
}

function getBibEntries(lines: readonly string[], bibStart: number, ctx?: LinterRuleContext): BibliographyEntry[] {
  if (ctx && bibStart === ctx.bibliographySectionLineIdx) return ctx.bibliographyEntries;
  if (bibStart === -1) return [];
  const entries: BibliographyEntry[] = [];
  for (let i = bibStart + 1; i < lines.length; i++) {
    const raw = lineAt(lines, i).trim();
    const key = parseBibEntry(raw);
    if (key) entries.push({ key, lineIdx: i, raw });
  }
  return entries;
}

function parseInTextCitation(raw: string): { key: string; raw: string } | null {
  if (raw.length > 200) return null;
  const parenMatch = raw.match(
    /\(([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+(?:y|and|&)\s+[A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+)?(?:\s+et\s+al\.?)?),\s*(\d{4}[a-z]?)(?:,\s*p{1,2}(?:ág)?\.\s*[\d-]{1,30})?\)/
  );
  if (parenMatch) {
    const author = (parenMatch[1] ?? '').split(/\s+(?:y|and|&)\s+/)[0]?.split(/\s+et\s+al/)[0]?.trim();
    const year = parenMatch[2];
    if (!author || !year) return null;
    return { key: `${author.toLowerCase()}_${year}`, raw };
  }

  const narrativeMatch = raw.match(
    /\b([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+et\s+al\.?)?)\s*\((\d{4}[a-z]?)(?:,\s*p{1,2}(?:ág)?\.\s*[\d-]{1,30})?\)/
  );
  if (narrativeMatch) {
    const author = narrativeMatch[1];
    const year = narrativeMatch[2];
    if (!author || !year) return null;
    return { key: `${author.toLowerCase()}_${year}`, raw };
  }

  return null;
}

export const apaMalformedRule: LinterRule = {
  id: 'citation_apa_malformed',
  name: 'Citas APA mal formadas',
  description: 'Detecta citas entre paréntesis que no siguen el formato APA: (Autor, Año).',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    const missingComma = /\(([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+[A-Za-záéíóúüñ]+)?)\s+(\d{4}[a-z]?)\)/g;
    const missingSpace = /\([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+,(\d{4})\)/g;
    const wrongBrackets = /\[([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+),\s*(\d{4}[a-z]?)\]/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      if (isAdversarialCitationLine(line)) continue;

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

export const missingBibliographyRule: LinterRule = {
  id: 'citation_missing_bibliography',
  name: 'Citas sin entrada bibliográfica',
  description: 'Detecta citas en el texto que no tienen entrada en la sección de Referencias.',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const bibStart = getBibStart(lines, ctx);
    if (bibStart === -1) return results;

    const entries = getBibEntries(lines, bibStart, ctx);
    if (entries.length === 0) return results;
    const bibKeys = new Set(entries.map((e) => e.key));

    const citationRegex = /\([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ\s,\.&]+,?\s*\d{4}[a-z]?(?:,\s*p{1,2}(?:ág)?\.\s*[\d-]{1,30})?\)/g;
    const narrativeRegex = /\b[A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+et\s+al\.?)?\s*\(\d{4}[a-z]?(?:,\s*p{1,2}(?:ág)?\.\s*[\d-]{1,30})?\)/g;

    for (let lineIdx = 0; lineIdx < Math.min(bibStart, lines.length); lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      if (isAdversarialCitationLine(line)) continue;

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

export const orphanBibliographyRule: LinterRule = {
  id: 'citation_orphan_bibliography',
  name: 'Referencias sin citar en el texto',
  description: 'Detecta entradas en la bibliografía que nunca se citan en el cuerpo del documento.',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const bibStart = getBibStart(lines, ctx);
    if (bibStart === -1) return results;

    const bibEntries = getBibEntries(lines, bibStart, ctx);

    const citedKeys = new Set<string>();
    const citationRegex = /\([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ\s,\.&]+,?\s*\d{4}[a-z]?(?:,\s*p{1,2}(?:ág)?\.\s*[\d-]{1,30})?\)/g;
    const narrativeRegex = /\b[A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+(?:\s+et\s+al\.?)?\s*\(\d{4}[a-z]?(?:,\s*p{1,2}(?:ág)?\.\s*[\d-]{1,30})?\)/g;

    for (let lineIdx = 0; lineIdx < bibStart; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
      if (isAdversarialCitationLine(line)) continue;
      for (const regex of [citationRegex, narrativeRegex]) {
        let match;
        while ((match = regex.exec(line)) !== null) {
          const parsed = parseInTextCitation(match[0]);
          if (parsed) citedKeys.add(parsed.key);
        }
      }
    }

    for (const entry of bibEntries) {
      if (!citedKeys.has(entry.key)) {
        results.push({
          message: `Referencia bibliográfica nunca citada en el texto: "${entry.raw.slice(0, 60)}…"`,
          suggestion: 'Cita esta fuente en el texto o elimínala de la bibliografía.',
          severity: 'info',
          line: entry.lineIdx + 1,
          column: 1,
          endLine: entry.lineIdx + 1,
          endColumn: lineAt(lines, entry.lineIdx).length + 1,
          source: 'Citation'
        });
      }
    }
    return results;
  }
};

export const doiFormatRule: LinterRule = {
  id: 'citation_doi_format',
  name: 'Formato DOI inválido',
  description: 'Los DOIs en bibliografía deben usar https://doi.org/10.XXXX/XXX',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    const badDoi = /(?<![/\w])(?:doi:\s*|DOI:\s*)(10\.\d{4,}\/\S+)/g;
    const httpDoi = /\bhttp:\/\/doi\.org\/(10\.\d{4,}\/\S+)/g;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);

      let match;
      while ((match = badDoi.exec(line)) !== null) {
        results.push({
          message: `DOI sin formato URL completo: "${match[0]}"`,
          suggestion: `APA 7ª ed. requiere: https://doi.org/${match[1]}`,
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
          suggestion: `Usa https://doi.org/${match[1]}`,
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

export const missingReferenceSectionRule: LinterRule = {
  id: 'citation_missing_reference_section',
  name: 'Sección de Referencias faltante',
  description: 'Si el documento tiene citas en texto, debe tener una sección de Referencias.',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: false,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);

    const citationRegex = /\([A-ZÁÉÍÓÚÜÑ][A-Za-záéíóúüñ]+,\s*\d{4}\)/;
    let hasCitations = false;
    for (let i = 0; i < lines.length; i++) {
      if (!codeLines.has(i) && citationRegex.test(lineAt(lines, i))) {
        hasCitations = true;
        break;
      }
    }

    if (!hasCitations) return [];
    if (getBibStart(lines, ctx) !== -1) return [];

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

export const ibidOpCitRule: LinterRule = {
  id: 'citation_ibid_op_cit',
  name: 'Ibid. / Op. cit. (obsoletos en APA)',
  description: 'APA no usa "ibid." ni "op. cit." — repite la cita completa.',
  category: 'citation',
  defaultEnabled: true,
  supportsIncremental: true,
  check: (text: string, ctx?: LinterRuleContext): LinterDiagnostic[] => {
    const results: LinterDiagnostic[] = [];
    const lines = ctx?.lines ?? text.split('\n');
    const codeLines = ctx?.codeBlockLines ?? getCodeBlockLines(lines);
    const ibidRegex = /\b(ibid\.?|ibídem\.?|op\.\s*cit\.?|loc\.\s*cit\.?)\b/gi;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      if (codeLines.has(lineIdx)) continue;
      const line = lineAt(lines, lineIdx);
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
