/**
 * Parser ligero de outline para documentos ST (.st).
 *
 * Reconoce las construcciones top-level de ST que son útiles como esquema:
 *   - logic <profile>
 *   - axiom <name> : <formula>
 *   - assume [<name> :] <formula>
 *   - derive <conclusion> [from {<axiom>...}]
 *   - check valid|sat|... <formula>
 *
 * Ignora líneas dentro de fences ``` y comentarios `# …`.
 */

export type STOutlineKind = 'logic' | 'axiom' | 'assume' | 'derive' | 'check';

export interface STOutlineEntry {
  kind: STOutlineKind;
  label: string;
  /** Línea 1-indexada en el documento. */
  line: number;
  /** Indentación visual (logic = 0, statements = 1). */
  depth: number;
  id: string;
}

const slug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);

const stripComment = (line: string): string => {
  const idx = line.indexOf('#');
  if (idx < 0) return line;
  return line.slice(0, idx);
};

export function parseSTOutline(content: string): STOutlineEntry[] {
  if (typeof content !== 'string' || content.length === 0) return [];
  const lines = content.split('\n');
  const out: STOutlineEntry[] = [];
  let inFence = false;
  let fenceMarker = '';

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    const fenceMatch = raw.match(/^(```|~~~)/);
    if (fenceMatch && fenceMatch[1]) {
      const marker = fenceMatch[1];
      if (!inFence) { inFence = true; fenceMarker = marker; }
      else if (raw.startsWith(fenceMarker)) { inFence = false; fenceMarker = ''; }
      continue;
    }
    if (inFence) continue;

    const stripped = stripComment(raw).trim();
    if (!stripped) continue;

    const lower = stripped.toLowerCase();
    let entry: STOutlineEntry | null = null;

    if (lower.startsWith('logic ')) {
      const profile = stripped.slice(6).trim();
      entry = { kind: 'logic', label: profile || '(perfil)', line: i + 1, depth: 0, id: `${i + 1}-logic-${slug(profile)}` };
    } else if (lower.startsWith('axiom ')) {
      const rest = stripped.slice(6).trim();
      const [namePart, formulaPart] = rest.split(/\s*:\s*/, 2);
      const name = (namePart || '').trim();
      const formula = (formulaPart || '').trim();
      const label = name ? (formula ? `${name}: ${formula}` : name) : rest;
      entry = { kind: 'axiom', label, line: i + 1, depth: 1, id: `${i + 1}-axiom-${slug(name || formula)}` };
    } else if (lower.startsWith('assume ')) {
      const rest = stripped.slice(7).trim();
      entry = { kind: 'assume', label: rest, line: i + 1, depth: 1, id: `${i + 1}-assume-${slug(rest)}` };
    } else if (lower.startsWith('derive ')) {
      const rest = stripped.slice(7).trim();
      entry = { kind: 'derive', label: rest, line: i + 1, depth: 1, id: `${i + 1}-derive-${slug(rest)}` };
    } else if (lower.startsWith('check ')) {
      const rest = stripped.slice(6).trim();
      entry = { kind: 'check', label: rest, line: i + 1, depth: 1, id: `${i + 1}-check-${slug(rest)}` };
    }

    if (entry) out.push(entry);
  }

  return out;
}
