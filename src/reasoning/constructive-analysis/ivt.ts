/**
 * Constructive Intermediate Value Theorem and Mean Value approximation.
 *
 * Classically: if f is continuous on [a, b] and f(a) <= target <= f(b),
 * then there exists c in [a, b] with f(c) = target. Constructively the
 * exact statement is unprovable without LEM (deciding equality on R is
 * not decidable), but the *approximate* IVT is fully constructive:
 *
 *   Given precision N, we can compute c in [a, b] with |f(c) - target| < 1/N.
 *
 * Algorithm (bisection with explicit witness):
 *   - require f(a) and f(b) to bracket `target` (with a tolerance);
 *   - bisect, picking the half where the target still lies between the
 *     endpoints' images at sufficient precision;
 *   - stop when |f(c) - target| < 1/N (witnessed at precision 4N).
 *
 * Mean value (constructive): for uniformly continuous f, the average
 * value `(1/(b-a)) * ∫_a^b f` is a real in the closure of the image of f.
 * The constructive MVT-approximation finds c in [a, b] with
 *   |f(c) - average| < 1/N.
 */

import {
  type CReal,
  fromRational,
  sub,
  abs,
  toNumber,
  approxLT
} from '../constructive-reals';
import type { ConstructiveContinuous } from './continuity';
import { bishopIntegral } from './integral';

const MAX_BISECT = 200;

/**
 * Returns a CReal `c` with |f(c) - target| < 1/precision, or null if no
 * such c is bracketed in [a, b] at the given precision.
 *
 * Requires f(a) <= target <= f(b) or the reverse (we don't assume a
 * specific direction; we use a generalized sign test).
 */
export const intermediateValueTheorem = (
  f: ConstructiveContinuous,
  a: CReal,
  b: CReal,
  target: CReal,
  precision: number,
): CReal | null => {
  if (!Number.isInteger(precision) || precision <= 0) {
    throw new RangeError('[ivt] precision must be a positive integer');
  }
  const aNum = toNumber(a);
  const bNum = toNumber(b);
  if (!(bNum > aNum)) return null;
  const tgt = toNumber(target, Math.max(4 * precision, 1_000));
  let lo = aNum;
  let hi = bNum;
  const fAt = (x: number) => toNumber(f.fn(fromRational(x)), Math.max(4 * precision, 1_000));
  let fLo = fAt(lo);
  let fHi = fAt(hi);
  // Normalize so fLo - tgt and fHi - tgt have opposite signs.
  // If neither bracket, we cannot proceed constructively.
  if ((fLo - tgt) * (fHi - tgt) > 0) {
    // No sign change witnessed at this precision.
    return null;
  }
  const epsBound = 1 / precision;
  for (let i = 0; i < MAX_BISECT; i++) {
    const mid = (lo + hi) / 2;
    const fMid = fAt(mid);
    // Witnessed at precision 4 * N: if |f(mid) - target| < 1/(2N) we are done.
    if (Math.abs(fMid - tgt) < epsBound / 2) {
      const c = fromRational(mid);
      const diff = abs(sub(f.fn(c), target));
      if (approxLT(diff, fromRational(epsBound), 4 * precision)) {
        return c;
      }
    }
    if ((fLo - tgt) * (fMid - tgt) <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
    if (hi - lo < epsBound / Math.max(1, f.modulus(precision))) {
      // Geometric stop: any c in [lo, hi] is close enough.
      const c = fromRational((lo + hi) / 2);
      const diff = abs(sub(f.fn(c), target));
      if (approxLT(diff, fromRational(epsBound), 4 * precision)) {
        return c;
      }
    }
  }
  // Fallback: emit best candidate and let the caller check.
  const c = fromRational((lo + hi) / 2);
  const diff = abs(sub(f.fn(c), target));
  return approxLT(diff, fromRational(epsBound), 4 * precision) ? c : null;
};

/**
 * Constructive mean value approximation: find c in [a, b] with
 *   |f(c) - (1/(b-a)) * ∫_a^b f(x) dx| < 1/precision,
 * if such c is bracketed at this precision; null otherwise.
 *
 * Strategy: compute the average via Bishop integral, then call IVT to
 * locate c.
 */
export const meanValueConstructive = (
  f: ConstructiveContinuous,
  a: CReal,
  b: CReal,
  precision: number,
): CReal | null => {
  if (!Number.isInteger(precision) || precision <= 0) {
    throw new RangeError('[meanValue] precision must be a positive integer');
  }
  const aNum = toNumber(a);
  const bNum = toNumber(b);
  if (!(bNum > aNum)) return null;
  // Compute integral at higher precision so dividing by (b - a) keeps
  // the error budget under 1/(2 precision).
  const length = bNum - aNum;
  const intPrec = Math.max(1, Math.ceil(2 * precision / Math.max(length, 1e-12)));
  const integral = bishopIntegral(f, a, b, intPrec);
  const average = fromRational(toNumber(integral, Math.max(4 * intPrec, 1_000)) / length);
  return intermediateValueTheorem(f, a, b, average, precision);
};
