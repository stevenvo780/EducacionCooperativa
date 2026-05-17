/**
 * Functions modelled as sets of Kuratowski ordered pairs (the graph), plus
 * an explicit domain and codomain. A graph is a valid function iff it is
 * functional: ⟨x, y₁⟩ ∈ f and ⟨x, y₂⟩ ∈ f implies y₁ = y₂.
 */

import {
  canonicalize,
  canonicalSet,
  cartesianProduct,
  EMPTY,
  fst,
  HFSet,
  isElement,
  isSubset,
  orderedPair,
  setEquals,
  snd
} from './hf-sets';

export interface HFFunction {
  readonly graph: HFSet;
  readonly domain: HFSet;
  readonly codomain: HFSet;
}

/**
 * The graph must be a subset of domain × codomain, every element must be
 * a Kuratowski pair, and the relation must be functional. We also require
 * the graph to be total on `domain` so that `apply` is well-defined for
 * every x in the declared domain.
 */
export function isValidFunction(f: HFFunction): boolean {
  const product = cartesianProduct(f.domain, f.codomain);
  if (!isSubset(f.graph, product)) {
    return false;
  }
  const fromX = new Map<string, string>();
  for (const p of f.graph.elements) {
    const x = fst(p);
    const y = snd(p);
    if (x === null || y === null) {
      return false;
    }
    const xk = canonicalize(x);
    const yk = canonicalize(y);
    const existing = fromX.get(xk);
    if (existing !== undefined && existing !== yk) {
      return false;
    }
    fromX.set(xk, yk);
  }
  // Totality on declared domain.
  const canonicalDomain = canonicalSet(f.domain);
  if (fromX.size !== canonicalDomain.elements.length) {
    return false;
  }
  return true;
}

export function applyHF(f: HFFunction, x: HFSet): HFSet | null {
  if (!isElement(x, f.domain)) {
    return null;
  }
  const xk = canonicalize(x);
  for (const p of f.graph.elements) {
    const px = fst(p);
    if (px !== null && canonicalize(px) === xk) {
      return snd(p);
    }
  }
  return null;
}

/**
 * (f ∘ g)(x) = f(g(x)). Returns null when the codomain of g is not the
 * domain of f, or either function is malformed.
 */
export function composeHF(f: HFFunction, g: HFFunction): HFFunction | null {
  if (!setEquals(g.codomain, f.domain)) {
    return null;
  }
  const pairs: HFSet[] = [];
  const seen = new Set<string>();
  for (const x of canonicalSet(g.domain).elements) {
    const mid = applyHF(g, x);
    if (mid === null) {
      return null;
    }
    const out = applyHF(f, mid);
    if (out === null) {
      return null;
    }
    const pp = orderedPair(x, out);
    const key = canonicalize(pp);
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push(pp);
    }
  }
  return {
    graph: { kind: 'set', elements: pairs },
    domain: g.domain,
    codomain: f.codomain
  };
}

export function isInjective(f: HFFunction): boolean {
  const images = new Set<string>();
  for (const p of f.graph.elements) {
    const y = snd(p);
    if (y === null) {
      return false;
    }
    const key = canonicalize(y);
    if (images.has(key)) {
      return false;
    }
    images.add(key);
  }
  return true;
}

export function isSurjective(f: HFFunction): boolean {
  const images = new Set<string>();
  for (const p of f.graph.elements) {
    const y = snd(p);
    if (y === null) {
      return false;
    }
    images.add(canonicalize(y));
  }
  for (const y of f.codomain.elements) {
    if (!images.has(canonicalize(y))) {
      return false;
    }
  }
  return true;
}

export function isBijective(f: HFFunction): boolean {
  return isInjective(f) && isSurjective(f);
}

/**
 * Constructor helper: builds an HFFunction from an explicit mapping. The
 * caller passes parallel arrays; we form the graph from Kuratowski pairs.
 * No validation here — call `isValidFunction` afterwards if you need it.
 */
export function makeFunction(
  domain: HFSet,
  codomain: HFSet,
  mapping: ReadonlyArray<readonly [HFSet, HFSet]>
): HFFunction {
  const pairs = mapping.map(([x, y]) => orderedPair(x, y));
  return {
    graph: { kind: 'set', elements: pairs },
    domain,
    codomain
  };
}

export const EMPTY_FUNCTION: HFFunction = {
  graph: EMPTY,
  domain: EMPTY,
  codomain: EMPTY
};
