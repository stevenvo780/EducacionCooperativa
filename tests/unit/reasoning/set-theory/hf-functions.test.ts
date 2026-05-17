import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  HFFunction,
  applyHF,
  cardinality,
  composeHF,
  isBijective,
  isInjective,
  isSurjective,
  isValidFunction,
  makeFunction,
  nat,
  orderedPair,
  pair,
  setEquals,
  singleton
} from '@/reasoning/set-theory';

describe('HF functions', () => {
  it('makeFunction + isValidFunction sobre identidad', () => {
    const dom = nat(3); // {0, 1, 2}
    const cod = nat(3);
    const id = makeFunction(dom, cod, [
      [nat(0), nat(0)],
      [nat(1), nat(1)],
      [nat(2), nat(2)]
    ]);
    expect(isValidFunction(id)).toBe(true);
    expect(isInjective(id)).toBe(true);
    expect(isSurjective(id)).toBe(true);
    expect(isBijective(id)).toBe(true);
  });

  it('applyHF devuelve el valor correcto y null fuera de dominio', () => {
    const dom = nat(3);
    const cod = nat(5);
    const f = makeFunction(dom, cod, [
      [nat(0), nat(2)],
      [nat(1), nat(4)],
      [nat(2), nat(0)]
    ]);
    const y = applyHF(f, nat(1));
    expect(y).not.toBeNull();
    if (y !== null) {
      expect(setEquals(y, nat(4))).toBe(true);
    }
    expect(applyHF(f, nat(7))).toBeNull();
  });

  it('isInjective falla si dos inputs comparten imagen', () => {
    const dom = nat(3);
    const cod = nat(3);
    const f = makeFunction(dom, cod, [
      [nat(0), nat(1)],
      [nat(1), nat(1)],
      [nat(2), nat(2)]
    ]);
    expect(isInjective(f)).toBe(false);
    expect(isSurjective(f)).toBe(false);
  });

  it('isSurjective: función cubre el codominio', () => {
    const dom = pair(EMPTY, singleton(EMPTY));
    const cod = singleton(nat(7));
    const f = makeFunction(dom, cod, [
      [EMPTY, nat(7)],
      [singleton(EMPTY), nat(7)]
    ]);
    expect(isSurjective(f)).toBe(true);
    expect(isInjective(f)).toBe(false);
  });

  it('composeHF: composición de inyectivas es inyectiva', () => {
    const a = nat(3);
    const b = nat(4);
    const c = nat(5);
    const g: HFFunction = makeFunction(a, b, [
      [nat(0), nat(1)],
      [nat(1), nat(2)],
      [nat(2), nat(3)]
    ]);
    const f: HFFunction = makeFunction(b, c, [
      [nat(0), nat(0)],
      [nat(1), nat(2)],
      [nat(2), nat(3)],
      [nat(3), nat(4)]
    ]);
    expect(isValidFunction(g)).toBe(true);
    expect(isValidFunction(f)).toBe(true);
    const fg = composeHF(f, g);
    expect(fg).not.toBeNull();
    if (fg !== null) {
      expect(isValidFunction(fg)).toBe(true);
      expect(isInjective(fg)).toBe(true);
      // (f ∘ g)(0) = f(1) = 2
      const out = applyHF(fg, nat(0));
      expect(out).not.toBeNull();
      if (out !== null) {
        expect(setEquals(out, nat(2))).toBe(true);
      }
    }
  });

  it('composeHF retorna null si codominio(g) ≠ dominio(f)', () => {
    const g = makeFunction(nat(2), nat(2), [
      [nat(0), nat(0)],
      [nat(1), nat(1)]
    ]);
    const f = makeFunction(nat(3), nat(3), [
      [nat(0), nat(0)],
      [nat(1), nat(1)],
      [nat(2), nat(2)]
    ]);
    expect(composeHF(f, g)).toBeNull();
  });

  it('isValidFunction rechaza relaciones no funcionales', () => {
    // 0 ↦ 0 y 0 ↦ 1: dos imágenes para el mismo input.
    const badGraph = {
      kind: 'set' as const,
      elements: [
        orderedPair(nat(0), nat(0)),
        orderedPair(nat(0), nat(1)),
        orderedPair(nat(1), nat(1))
      ]
    };
    const f: HFFunction = {
      graph: badGraph,
      domain: nat(2),
      codomain: nat(2)
    };
    expect(isValidFunction(f)).toBe(false);
  });

  it('función vacía: dominio y codominio vacíos, válida y vacía', () => {
    const empty = makeFunction(EMPTY, EMPTY, []);
    expect(isValidFunction(empty)).toBe(true);
    expect(cardinality(empty.graph)).toBe(0);
    expect(isInjective(empty)).toBe(true);
    expect(isSurjective(empty)).toBe(true);
  });
});
