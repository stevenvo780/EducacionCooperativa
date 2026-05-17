import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  cardinality,
  cartesianProduct,
  difference,
  fst,
  intersection,
  isElement,
  isOrdinal,
  isSubset,
  isTransitive,
  nat,
  orderedPair,
  pair,
  powerSet,
  setEquals,
  singleton,
  snd,
  succ,
  union,
  unionFamily
} from '@/reasoning/set-theory';

describe('HF sets — basic operations', () => {
  it('EMPTY tiene cardinalidad 0', () => {
    expect(cardinality(EMPTY)).toBe(0);
  });

  it('singleton(EMPTY) tiene cardinalidad 1 y contiene a EMPTY', () => {
    const s = singleton(EMPTY);
    expect(cardinality(s)).toBe(1);
    expect(isElement(EMPTY, s)).toBe(true);
  });

  it('isSubset(EMPTY, A) siempre es true', () => {
    const a = nat(0);
    const b = nat(3);
    const c = pair(singleton(EMPTY), nat(2));
    expect(isSubset(EMPTY, a)).toBe(true);
    expect(isSubset(EMPTY, b)).toBe(true);
    expect(isSubset(EMPTY, c)).toBe(true);
  });

  it('setEquals es extensional: orden y duplicación no importan', () => {
    const a = pair(EMPTY, singleton(EMPTY));
    const b = pair(singleton(EMPTY), EMPTY);
    expect(setEquals(a, b)).toBe(true);
    // {a, a} = {a}
    expect(setEquals(pair(EMPTY, EMPTY), singleton(EMPTY))).toBe(true);
  });

  it('pair(a, a) = {a} (cardinalidad 1)', () => {
    const a = nat(2);
    const p = pair(a, a);
    expect(cardinality(p)).toBe(1);
    expect(isElement(a, p)).toBe(true);
  });

  it('union, intersection y difference cumplen leyes básicas', () => {
    const a = nat(3); // {0, 1, 2}
    const b = pair(nat(1), nat(4)); // {1, 4}
    const u = union(a, b);
    const i = intersection(a, b);
    const d = difference(a, b);
    // union contiene todos los elementos de ambos
    expect(isElement(nat(0), u)).toBe(true);
    expect(isElement(nat(4), u)).toBe(true);
    // intersection = {1}
    expect(cardinality(i)).toBe(1);
    expect(isElement(nat(1), i)).toBe(true);
    // difference = {0, 2}
    expect(cardinality(d)).toBe(2);
    expect(isElement(nat(1), d)).toBe(false);
  });

  it('powerSet({a, b}) tiene 4 elementos y los esperados', () => {
    const a = singleton(EMPTY); // {∅}
    const b = singleton(singleton(EMPTY)); // {{∅}}
    const ab = pair(a, b);
    const p = powerSet(ab);
    expect(cardinality(p)).toBe(4);
    expect(isElement(EMPTY, p)).toBe(true);
    expect(isElement(singleton(a), p)).toBe(true);
    expect(isElement(singleton(b), p)).toBe(true);
    expect(isElement(ab, p)).toBe(true);
  });

  it('powerSet(∅) = {∅} con cardinalidad 1', () => {
    const p = powerSet(EMPTY);
    expect(cardinality(p)).toBe(1);
    expect(isElement(EMPTY, p)).toBe(true);
  });

  it('cartesianProduct({a}, {b, c}) tiene 2 elementos', () => {
    const a = nat(1);
    const b = nat(2);
    const c = nat(3);
    const cp = cartesianProduct(singleton(a), pair(b, c));
    expect(cardinality(cp)).toBe(2);
    // Cada elemento es un par de Kuratowski con fst=a.
    for (const elem of cp.elements) {
      const f = fst(elem);
      expect(f).not.toBeNull();
      if (f !== null) {
        expect(setEquals(f, a)).toBe(true);
      }
    }
  });

  it('cartesianProduct(∅, B) y cartesianProduct(A, ∅) son ambos vacíos', () => {
    expect(cardinality(cartesianProduct(EMPTY, nat(3)))).toBe(0);
    expect(cardinality(cartesianProduct(nat(3), EMPTY))).toBe(0);
  });

  it('orderedPair: fst y snd recuperan los componentes (Kuratowski)', () => {
    const a = nat(2);
    const b = nat(5);
    const p = orderedPair(a, b);
    const f = fst(p);
    const s = snd(p);
    expect(f).not.toBeNull();
    expect(s).not.toBeNull();
    if (f !== null && s !== null) {
      expect(setEquals(f, a)).toBe(true);
      expect(setEquals(s, b)).toBe(true);
    }
  });

  it('orderedPair degenerado ⟨a, a⟩ recupera a en ambos componentes', () => {
    const a = nat(2);
    const p = orderedPair(a, a);
    const f = fst(p);
    const s = snd(p);
    expect(f).not.toBeNull();
    expect(s).not.toBeNull();
    if (f !== null && s !== null) {
      expect(setEquals(f, a)).toBe(true);
      expect(setEquals(s, a)).toBe(true);
    }
  });

  it('orderedPair distingue ⟨a, b⟩ de ⟨b, a⟩', () => {
    const a = EMPTY;
    const b = singleton(EMPTY);
    const ab = orderedPair(a, b);
    const ba = orderedPair(b, a);
    expect(setEquals(ab, ba)).toBe(false);
  });

  it('unionFamily de [A, B, C] coincide con union iterada', () => {
    const a = nat(2);
    const b = singleton(nat(5));
    const c = pair(nat(7), EMPTY);
    const big = unionFamily([a, b, c]);
    const iter = union(union(a, b), c);
    expect(setEquals(big, iter)).toBe(true);
  });
});

describe('HF sets — von Neumann ordinals', () => {
  it('nat(0) = ∅, nat(1) = {∅}, nat(2) = {∅, {∅}}', () => {
    expect(setEquals(nat(0), EMPTY)).toBe(true);
    expect(setEquals(nat(1), singleton(EMPTY))).toBe(true);
    const two = pair(EMPTY, singleton(EMPTY));
    expect(setEquals(nat(2), two)).toBe(true);
  });

  it('succ(nat(3)) = nat(4)', () => {
    expect(setEquals(succ(nat(3)), nat(4))).toBe(true);
  });

  it('cardinality(nat(n)) = n para varios n', () => {
    for (let n = 0; n <= 6; n++) {
      expect(cardinality(nat(n))).toBe(n);
    }
  });

  it('nat(m) ∈ nat(n) iff m < n', () => {
    const five = nat(5);
    for (let m = 0; m < 5; m++) {
      expect(isElement(nat(m), five)).toBe(true);
    }
    expect(isElement(nat(5), five)).toBe(false);
    expect(isElement(nat(7), five)).toBe(false);
  });

  it('isTransitive cumple sobre nat(n)', () => {
    for (let n = 0; n <= 4; n++) {
      expect(isTransitive(nat(n))).toBe(true);
    }
  });

  it('isOrdinal cumple sobre nat(n)', () => {
    for (let n = 0; n <= 5; n++) {
      expect(isOrdinal(nat(n))).toBe(true);
    }
  });

  it('isOrdinal falla sobre conjuntos no transitivos', () => {
    // {{∅}} no es transitiva: contiene {∅} pero no ∅.
    const x = singleton(singleton(EMPTY));
    expect(isTransitive(x)).toBe(false);
    expect(isOrdinal(x)).toBe(false);
  });

  it('nat(n): cada elemento es subconjunto (transitividad)', () => {
    const six = nat(6);
    for (const e of six.elements) {
      expect(isSubset(e, six)).toBe(true);
    }
  });

  it('nat(-1) y nat(2.5) lanzan RangeError', () => {
    expect(() => nat(-1)).toThrow(RangeError);
    expect(() => nat(2.5)).toThrow(RangeError);
  });
});
