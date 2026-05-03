/**
 * Parser ligero de outline para Markdown. Reusa solo expresiones regulares
 * — sin dependencias — y tolera contenido parcial o malformado.
 *
 * Reglas:
 * - Solo headings ATX (# H1, ## H2, ...). No setext (=== / ---) por ahora.
 * - Ignora headings dentro de fences ``` ```.
 * - Trim del trailing # en headings cerrados ("## Title ##").
 * - Niveles de 1 a 6.
 */

export interface OutlineHeading {
  level: number;
  text: string;
  /** Línea 1-indexada en el documento original. */
  line: number;
  /** Identificador estable basado en línea + slug del título. */
  id: string;
}

function slugify(text: string): string {
  // Normaliza acentos a ASCII (NFD + strip de combining marks).
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

export function parseMarkdownOutline(content: string): OutlineHeading[] {
  if (typeof content !== 'string' || content.length === 0) return [];
  const lines = content.split('\n');
  const headings: OutlineHeading[] = [];
  let inFence = false;
  let fenceMarker = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (typeof line !== 'string') continue;
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch && fenceMatch[1]) {
      const marker = fenceMatch[1];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (line.startsWith(fenceMarker)) {
        inFence = false;
        fenceMarker = '';
      }
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m && m[1] && m[2]) {
      const level = m[1].length;
      const text = m[2].trim();
      if (text.length === 0) continue;
      headings.push({
        level,
        text,
        line: i + 1,
        id: `${i + 1}-${slugify(text)}`
      });
    }
  }

  return headings;
}
