/**
 * Utilidades para renderizar diffs unificados sin libs externas.
 * El backend devuelve `patch` como string ya parseable; aquí lo
 * convertimos a hunks que el componente pinta línea por línea.
 */

export type DiffLineKind = 'context' | 'addition' | 'deletion' | 'header' | 'meta';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

/**
 * Parsea un patch unificado (un único archivo). Acepta el formato estándar
 * `git diff` con cabeceras `diff --git`, `index`, `---`, `+++`, `@@`.
 */
export const parsePatchToHunks = (patch: string): DiffHunk[] => {
  if (!patch) return [];
  const lines = patch.split('\n');
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;
  for (const raw of lines) {
    if (raw.startsWith('@@')) {
      if (current) hunks.push(current);
      current = { header: raw, lines: [] };
      const m = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldLine = m?.[1] ? parseInt(m[1], 10) : 0;
      newLine = m?.[2] ? parseInt(m[2], 10) : 0;
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('+++') || raw.startsWith('---') || raw.startsWith('diff ') || raw.startsWith('index ')
      || raw.startsWith('new file') || raw.startsWith('deleted file') || raw.startsWith('rename ')
      || raw.startsWith('similarity ') || raw.startsWith('Binary files ')) {
      continue;
    }
    if (raw.startsWith('+')) {
      current.lines.push({ kind: 'addition', text: raw.slice(1), newLineNo: newLine });
      newLine++;
    } else if (raw.startsWith('-')) {
      current.lines.push({ kind: 'deletion', text: raw.slice(1), oldLineNo: oldLine });
      oldLine++;
    } else if (raw.startsWith('\\')) {
      current.lines.push({ kind: 'meta', text: raw });
    } else {
      const text = raw.startsWith(' ') ? raw.slice(1) : raw;
      current.lines.push({ kind: 'context', text, oldLineNo: oldLine, newLineNo: newLine });
      oldLine++;
      newLine++;
    }
  }
  if (current) hunks.push(current);
  return hunks;
};
