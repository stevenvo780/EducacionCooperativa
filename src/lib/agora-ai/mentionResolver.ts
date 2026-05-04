import type { DocItem } from '@/components/dashboard/types';

/**
 * Resuelve menciones `@nombre` o `@nombre.md` en el input del usuario y las
 * reemplaza por una referencia explícita `[doc:<id> "<nombre>"]` antes de
 * enviar el mensaje al agente. El modelo recibe IDs reales en lugar de
 * tener que adivinarlos.
 *
 * Reglas:
 *   - Coincide el nombre del doc (case-insensitive, sin extensión).
 *   - Si hay ambigüedad (varios docs con mismo nombre), incluye los IDs
 *     candidatos en un comentario para que el modelo decida.
 *   - Mentions sin match se dejan tal cual (el modelo verá el `@nombre`
 *     literal y puede pedir aclaración).
 */

export interface MentionResolution {
  resolved: string;
  matches: Array<{ raw: string; docId: string; docName: string }>;
  ambiguous: Array<{ raw: string; candidates: Array<{ id: string; name: string }> }>;
  missed: string[];
}

const stripExtension = (name: string): string => name.replace(/\.[a-zA-Z0-9]+$/, '');

const normalize = (value: string): string => value.toLowerCase().trim();

export function resolveMentions(input: string, availableDocs: DocItem[]): MentionResolution {
  if (!input || !availableDocs.length) {
    return { resolved: input, matches: [], ambiguous: [], missed: [] };
  }

  const docsByNormalized = new Map<string, DocItem[]>();
  for (const doc of availableDocs) {
    if (doc.type === 'folder') continue;
    const candidates = [doc.name, stripExtension(doc.name || '')]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map(normalize);
    for (const key of candidates) {
      const existing = docsByNormalized.get(key);
      if (existing) existing.push(doc);
      else docsByNormalized.set(key, [doc]);
    }
  }

  const matches: MentionResolution['matches'] = [];
  const ambiguous: MentionResolution['ambiguous'] = [];
  const missed: string[] = [];

  // @"nombre con espacios.md"   o   @nombre   o   @nombre.md
  const mentionRegex = /(^|\s)@(?:"([^"]+)"|([\w.\-/]+))/g;

  const resolved = input.replace(mentionRegex, (_, prefix: string, quoted?: string, plain?: string) => {
    const raw = quoted ?? plain ?? '';
    if (!raw) return `${prefix}@`;
    const lookup = normalize(raw);
    const candidates = docsByNormalized.get(lookup) ?? docsByNormalized.get(stripExtension(lookup)) ?? [];
    if (candidates.length === 0) {
      missed.push(raw);
      return `${prefix}@${quoted ? `"${raw}"` : raw}`;
    }
    if (candidates.length > 1) {
      const candidateInfo = candidates.map(c => ({ id: c.id, name: c.name || 'Sin título' }));
      ambiguous.push({ raw, candidates: candidateInfo });
      const ids = candidateInfo.map(c => c.id).join(', ');
      return `${prefix}[mention:"${raw}" candidates:${ids}]`;
    }
    const doc = candidates[0]!;
    matches.push({ raw, docId: doc.id, docName: doc.name || 'Sin título' });
    return `${prefix}[doc:${doc.id} "${doc.name || raw}"]`;
  });

  return { resolved, matches, ambiguous, missed };
}
