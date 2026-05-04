import { describe, it, expect } from 'vitest';
import { resolveMentions } from '@/lib/agora-ai/mentionResolver';
import type { DocItem } from '@/components/dashboard/types';

const doc = (id: string, name: string): DocItem => ({
  id, name, type: 'text'
} as DocItem);

describe('resolveMentions', () => {
  it('reemplaza @nombre por [doc:id]', () => {
    const out = resolveMentions('mira @notas.md y dime', [doc('d1', 'notas.md')]);
    expect(out.resolved).toBe('mira [doc:d1 "notas.md"] y dime');
    expect(out.matches).toEqual([{ raw: 'notas.md', docId: 'd1', docName: 'notas.md' }]);
  });

  it('matchea sin extensión', () => {
    const out = resolveMentions('@notas resume', [doc('d1', 'notas.md')]);
    expect(out.resolved).toContain('[doc:d1');
  });

  it('soporta @"nombre con espacios"', () => {
    const out = resolveMentions('lee @"mis apuntes" porfa', [doc('d2', 'mis apuntes.md')]);
    expect(out.resolved).toContain('[doc:d2');
  });

  it('marca ambiguo cuando hay varios docs con mismo nombre', () => {
    const out = resolveMentions('@notas', [doc('d1', 'notas.md'), doc('d2', 'notas.md')]);
    expect(out.ambiguous).toHaveLength(1);
    expect(out.ambiguous[0]?.candidates).toHaveLength(2);
    expect(out.resolved).toContain('candidates:d1, d2');
  });

  it('deja sin tocar mentions sin match', () => {
    const out = resolveMentions('@desconocido', [doc('d1', 'notas.md')]);
    expect(out.resolved).toBe('@desconocido');
    expect(out.missed).toEqual(['desconocido']);
  });

  it('ignora @ sin nombre', () => {
    const out = resolveMentions('un email a@b.com', [doc('d1', 'notas.md')]);
    expect(out.resolved).toBe('un email a@b.com');
  });
});
