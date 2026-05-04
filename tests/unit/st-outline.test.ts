import { describe, it, expect } from 'vitest';
import { parseSTOutline } from '@/lib/st-outline';

describe('parseSTOutline', () => {
  it('detecta logic, axiom, derive, check, assume', () => {
    const program = `
# comentario

logic classical.propositional

axiom a1 : P -> Q
axiom a2 : P
derive Q from {a1, a2}

check valid (P | !P)
assume r : R
`;
    const entries = parseSTOutline(program);
    expect(entries.map(e => e.kind)).toEqual([
      'logic', 'axiom', 'axiom', 'derive', 'check', 'assume'
    ]);
    expect(entries[0]?.label).toBe('classical.propositional');
    expect(entries[1]?.label).toBe('a1: P -> Q');
    expect(entries[3]?.label).toBe('Q from {a1, a2}');
  });

  it('ignora líneas dentro de fences markdown', () => {
    const program = '```\naxiom x : Y\n```\nlogic foo';
    const entries = parseSTOutline(program);
    expect(entries.map(e => e.kind)).toEqual(['logic']);
  });

  it('asigna depth 0 a logic y 1 al resto', () => {
    const entries = parseSTOutline('logic A\naxiom x : Y\nderive Y from {x}');
    expect(entries[0]?.depth).toBe(0);
    expect(entries[1]?.depth).toBe(1);
    expect(entries[2]?.depth).toBe(1);
  });

  it('no agrega entradas para contenido vacío', () => {
    expect(parseSTOutline('')).toEqual([]);
    expect(parseSTOutline('# solo comentarios\n# más')).toEqual([]);
  });
});
