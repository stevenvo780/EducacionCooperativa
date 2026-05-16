export interface Span {
  from: number;
  to: number;
  text: string;
}

const SENTENCE_BOUNDARY = /([.!?]+["')\]]*)(\s+|$)/g;

export function splitSentences(text: string, baseOffset = 0): Span[] {
  const out: Span[] = [];
  if (text.length === 0) return out;

  let lastIndex = 0;
  SENTENCE_BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SENTENCE_BOUNDARY.exec(text)) !== null) {
    const punctuation = match[1] ?? '';
    const trailing = match[2] ?? '';
    const endChunk = match.index + punctuation.length;
    const slice = text.slice(lastIndex, endChunk);
    if (slice.trim().length > 0) {
      const leadingWs = slice.length - slice.trimStart().length;
      out.push({
        from: baseOffset + lastIndex + leadingWs,
        to: baseOffset + endChunk,
        text: slice.trim()
      });
    }
    lastIndex = endChunk + trailing.length;
    if (SENTENCE_BOUNDARY.lastIndex === match.index) {
      SENTENCE_BOUNDARY.lastIndex++;
    }
  }

  if (lastIndex < text.length) {
    const slice = text.slice(lastIndex);
    if (slice.trim().length > 0) {
      const leadingWs = slice.length - slice.trimStart().length;
      out.push({
        from: baseOffset + lastIndex + leadingWs,
        to: baseOffset + text.length,
        text: slice.trim()
      });
    }
  }

  return out;
}

export function splitParagraphs(text: string): Span[] {
  const out: Span[] = [];
  const re = /\n\s*\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const slice = text.slice(lastIndex, match.index);
    if (slice.trim().length > 0) {
      const leadingWs = slice.length - slice.trimStart().length;
      out.push({
        from: lastIndex + leadingWs,
        to: match.index,
        text: slice
      });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const slice = text.slice(lastIndex);
    if (slice.trim().length > 0) {
      const leadingWs = slice.length - slice.trimStart().length;
      out.push({
        from: lastIndex + leadingWs,
        to: text.length,
        text: slice
      });
    }
  }

  return out;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Quita signos finales y normaliza espacios para facilitar comparaciones
 * de contradicción literal entre frases.
 */
export function normalizeClaim(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'`""'']/g, '')
    .replace(/[.,;:!?¿¡()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detecta si un párrafo contiene al menos una cita bibliográfica al estilo
 * APA `(Autor, 2020)`, una referencia numérica `[12]`, o una nota Markdown
 * `[^nota]`. Es heurístico, no exhaustivo.
 */
export function hasCitation(paragraph: string): boolean {
  if (/\([A-ZÁÉÍÓÚÜÑ][^()]{0,80}?\d{4}[a-z]?\)/.test(paragraph)) return true;
  if (/\[\d+\]/.test(paragraph)) return true;
  if (/\[\^[\w-]+\]/.test(paragraph)) return true;
  if (/\bvéase\b|\bsee\b|\bcf\.\b/i.test(paragraph) && /\d{4}/.test(paragraph)) return true;
  return false;
}
