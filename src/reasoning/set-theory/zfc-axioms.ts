/**
 * Sanity checks of selected ZFC axioms restricted to the Vω fragment.
 *
 * Most axioms hold on Vω: extensionality, pairing, union, power set,
 * foundation, separation, replacement. Infinity FAILS on Vω because Vω
 * is exactly the universe of hereditarily finite sets — there is no
 * infinite set inside it.
 *
 * The "check" functions verify on a sample of HF sets. They return
 * `holds = false` plus a counterexample when violated.
 */

import {
  cardinality,
  canonicalize,
  EMPTY,
  HFSet,
  isElement,
  isSubset,
  nat,
  pair,
  powerSet,
  setEquals,
  singleton,
  succ,
  union,
  unionFamily
} from './hf-sets';

export interface ZFCAxiomCheck {
  readonly name: string;
  readonly holds: boolean;
  readonly note?: string;
  readonly counterexample?: ReadonlyArray<HFSet>;
}

/**
 * Sample universe of small HF sets used by the probabilistic checks.
 * Includes ∅, the first few naturals, singletons, pairs and a small
 * power-set tower. Bounded to keep the checks fast.
 */
function sampleUniverse(): HFSet[] {
  const universe: HFSet[] = [EMPTY];
  const seen = new Set<string>([canonicalize(EMPTY)]);
  const push = (s: HFSet): void => {
    const k = canonicalize(s);
    if (!seen.has(k)) {
      seen.add(k);
      universe.push(s);
    }
  };
  for (let i = 1; i <= 4; i++) {
    push(nat(i));
  }
  // Snapshot the length to avoid feeding new singletons back into the
  // iteration (would diverge: each singleton is distinct from prior).
  const snapshotLen = universe.length;
  for (let i = 0; i < snapshotLen; i++) {
    const base = universe[i];
    if (base !== undefined) {
      push(singleton(base));
    }
  }
  push(pair(EMPTY, singleton(EMPTY)));
  push(powerSet(nat(2)));
  return universe;
}

/**
 * Axiom of Extensionality: ∀A ∀B (A = B ↔ ∀x (x ∈ A ↔ x ∈ B)).
 * Our canonicalization implements extensionality directly, so we verify
 * agreement on a sample plus the contrapositive on intentionally distinct
 * sets.
 */
export function checkExtensionality(): ZFCAxiomCheck {
  const universe = sampleUniverse();
  for (const a of universe) {
    for (const b of universe) {
      const sameElements =
        a.elements.length === 0 && b.elements.length === 0
          ? true
          : isSubset(a, b) && isSubset(b, a);
      const eq = setEquals(a, b);
      if (eq !== sameElements) {
        return {
          name: 'Extensionality',
          holds: false,
          counterexample: [a, b]
        };
      }
    }
  }
  // Order/duplication invariance.
  const a1 = pair(EMPTY, singleton(EMPTY));
  const a2 = pair(singleton(EMPTY), EMPTY);
  if (!setEquals(a1, a2)) {
    return { name: 'Extensionality', holds: false, counterexample: [a1, a2] };
  }
  return { name: 'Extensionality', holds: true };
}

/**
 * Axiom of Pairing: ∀a ∀b ∃P (a ∈ P ∧ b ∈ P ∧ ∀x (x ∈ P → x = a ∨ x = b)).
 */
export function checkPairing(_samples = 0): ZFCAxiomCheck {
  const universe = sampleUniverse();
  for (const a of universe) {
    for (const b of universe) {
      const p = pair(a, b);
      if (!isElement(a, p) || !isElement(b, p)) {
        return { name: 'Pairing', holds: false, counterexample: [a, b, p] };
      }
      const expectedCard = setEquals(a, b) ? 1 : 2;
      if (cardinality(p) !== expectedCard) {
        return { name: 'Pairing', holds: false, counterexample: [a, b, p] };
      }
    }
  }
  return { name: 'Pairing', holds: true };
}

/**
 * Axiom of Union: for any family F there exists ⋃F such that x ∈ ⋃F iff
 * x ∈ A for some A ∈ F.
 */
export function checkUnion(_samples = 0): ZFCAxiomCheck {
  const universe = sampleUniverse();
  for (const a of universe) {
    for (const b of universe) {
      const u = union(a, b);
      for (const x of a.elements) {
        if (!isElement(x, u)) {
          return { name: 'Union', holds: false, counterexample: [a, b, x] };
        }
      }
      for (const x of b.elements) {
        if (!isElement(x, u)) {
          return { name: 'Union', holds: false, counterexample: [a, b, x] };
        }
      }
      for (const x of u.elements) {
        if (!isElement(x, a) && !isElement(x, b)) {
          return { name: 'Union', holds: false, counterexample: [a, b, x] };
        }
      }
    }
  }
  // Generalized union over a small family.
  const family = [nat(2), singleton(nat(3)), pair(EMPTY, nat(1))];
  const big = unionFamily(family);
  for (const member of family) {
    for (const x of member.elements) {
      if (!isElement(x, big)) {
        return { name: 'Union', holds: false, counterexample: [member, x] };
      }
    }
  }
  return { name: 'Union', holds: true };
}

/**
 * Axiom of Power Set: ∀A ∃P (∀x (x ∈ P ↔ x ⊆ A)). Sample over small sets
 * to keep |P(A)| = 2^|A| manageable.
 */
export function checkPowerSet(_samples = 0): ZFCAxiomCheck {
  const universe = sampleUniverse().filter((s) => cardinality(s) <= 3);
  for (const a of universe) {
    const p = powerSet(a);
    const expected = 1 << cardinality(a);
    if (cardinality(p) !== expected) {
      return { name: 'Power Set', holds: false, counterexample: [a, p] };
    }
    for (const s of p.elements) {
      if (!isSubset(s, a)) {
        return { name: 'Power Set', holds: false, counterexample: [a, s] };
      }
    }
    // ∅ and A itself are always in P(A).
    if (!isElement(EMPTY, p)) {
      return { name: 'Power Set', holds: false, counterexample: [a, p] };
    }
    if (!isElement(a, p)) {
      return { name: 'Power Set', holds: false, counterexample: [a, p] };
    }
  }
  return { name: 'Power Set', holds: true };
}

/**
 * Axiom of Infinity: ∃I (∅ ∈ I ∧ ∀x (x ∈ I → succ(x) ∈ I)). This is
 * exactly what fails on Vω: there is no HF set closed under successor,
 * because successor strictly increases rank and HF sets have finite rank.
 *
 * We "witness" the failure by attempting a closure construction: start
 * with ∅, repeatedly add successors, and observe that the inductive set
 * cannot terminate inside Vω. Programmatically we cap the search depth
 * and report holds=false with the partial witness.
 */
export function checkInfinity(): ZFCAxiomCheck {
  const seen = new Set<string>([canonicalize(EMPTY)]);
  let current: HFSet = EMPTY;
  const witnesses: HFSet[] = [current];
  const CAP = 32;
  for (let i = 0; i < CAP; i++) {
    const next = succ(current);
    const key = canonicalize(next);
    if (seen.has(key)) {
      // Would mean closure — should never happen in Vω.
      return {
        name: 'Infinity',
        holds: true,
        note: 'closure detected (unexpected for Vω)',
        counterexample: witnesses
      };
    }
    seen.add(key);
    witnesses.push(next);
    current = next;
  }
  return {
    name: 'Infinity',
    holds: false,
    note: 'Vω no contiene un conjunto inductivo: successor strictamente aumenta el rango',
    counterexample: witnesses
  };
}

/**
 * Axiom of Foundation (Regularity): every nonempty set A has an element
 * disjoint from A. On HF sets this holds automatically because the
 * membership relation is well-founded by construction (no cycles, no
 * infinite descending chains).
 */
export function checkFoundation(_samples = 0): ZFCAxiomCheck {
  const universe = sampleUniverse().filter((s) => s.elements.length > 0);
  for (const a of universe) {
    let foundDisjoint = false;
    for (const e of a.elements) {
      let disjoint = true;
      for (const inner of e.elements) {
        if (isElement(inner, a)) {
          disjoint = false;
          break;
        }
      }
      if (disjoint) {
        foundDisjoint = true;
        break;
      }
    }
    if (!foundDisjoint) {
      return { name: 'Foundation', holds: false, counterexample: [a] };
    }
  }
  return { name: 'Foundation', holds: true };
}

export function checkAllAxioms(): ZFCAxiomCheck[] {
  return [
    checkExtensionality(),
    checkPairing(),
    checkUnion(),
    checkPowerSet(),
    checkInfinity(),
    checkFoundation()
  ];
}
