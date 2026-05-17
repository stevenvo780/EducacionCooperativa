/**
 * Constructive Heine-Borel: every covering of a compact interval [a, b]
 * by open rational intervals has a finite subcover.
 *
 * Bishop's proof is fully constructive: enumerate the cover, and use
 * uniform continuity of the indicator-as-membership predicate via the
 * Lebesgue number lemma. We give a direct algorithmic version: walk
 * from `a` to `b` taking the rightmost reachable endpoint of any
 * interval that contains the current frontier; if we can always
 * advance, we accept; if we get stuck, we reject.
 *
 * The intervals are pairs `[lo, hi]` of CReals; the cover is "open" in
 * the sense `lo < x < hi` (we work with the open interior).
 */

import { type CReal, toNumber } from '../constructive-reals';

export interface ConstructiveOpenCover {
  intervals: ReadonlyArray<readonly [CReal, CReal]>;
}

/**
 * Returns true if `cover` constructively covers `[a, b]` and the algorithm
 * found a finite subcover (which in this case is just a subset of the
 * given finite list, so trivially finite — the question is whether the
 * cover suffices).
 *
 * Approach: scan with a frontier `x` initialized to `a`. At each step we
 * search for an interval `(lo, hi)` with `lo < x < hi` (or `lo < x` and
 * `x <= a + tol` at the start) and advance `x := hi`. If we reach
 * `x >= b`, we accept. If we cannot advance, we reject.
 *
 * `tol` is a tiny tolerance for the frontier to handle the fact that we
 * read CReals as JS numbers. Default 1e-12 (well above floating noise
 * for the precision range we use).
 */
export const hasFiniteSubcover = (
  cover: ConstructiveOpenCover,
  compact: readonly [CReal, CReal],
  tol = 1e-12,
): boolean => {
  const [aR, bR] = compact;
  const a = toNumber(aR);
  const b = toNumber(bR);
  if (!(b >= a)) return false;
  const ivs = cover.intervals.map(([loR, hiR]) => ({
    lo: toNumber(loR),
    hi: toNumber(hiR)
  }));
  let x = a;
  // Ensure start is covered: some interval has lo < a < hi (or a == b edge).
  let safety = ivs.length + 2;
  while (x < b - tol && safety-- > 0) {
    let bestHi = x;
    for (const iv of ivs) {
      if (iv.lo < x + tol && iv.hi > x + tol && iv.hi > bestHi) {
        bestHi = iv.hi;
      }
    }
    if (bestHi <= x + tol) return false; // stuck
    x = bestHi;
  }
  return x >= b - tol;
};
