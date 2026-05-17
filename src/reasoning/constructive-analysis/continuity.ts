/**
 * Constructive (uniform) continuity on a compact interval.
 *
 * Bishop's framework: a function f : [a, b] -> R is continuous iff it
 * comes with an explicit modulus of uniform continuity
 *   omega : Q_>0 -> Q_>0
 * such that |x - y| < omega(eps) implies |f(x) - f(y)| < eps,
 * for all x, y in [a, b].
 *
 * On a general (non-compact) domain, "pointwise" continuity is the wrong
 * notion constructively. We only model uniform continuity on intervals.
 *
 * Modulus convention: we use `modulus(epsPrecision) -> deltaPrecision`,
 * both positive integers, encoding `1/eps -> 1/delta`. So
 *   modulus(k) = m  means  |x - y| < 1/m  =>  |f(x) - f(y)| < 1/k.
 */

import {
  type CReal,
  fromRational,
  sub,
  abs,
  approxLT,
  toNumber
} from '../constructive-reals';

export interface ConstructiveContinuous {
  /** The function itself. */
  fn: (x: CReal) => CReal;
  /**
   * Modulus of uniform continuity.
   * Given `epsPrecision = k`, returns `deltaPrecision = m` with
   *   |x - y| < 1/m  =>  |f(x) - f(y)| < 1/k.
   */
  modulus: (epsPrecision: number) => number;
}

/**
 * Sound sampling-based check that the modulus is correct on `[a, b]`.
 *
 * Constructively, "for all x, y in [a, b]" is not decidable. Instead we
 * sample `samples` pairs of points at distance ~1/m within [a, b] and
 * verify the implication holds at each one. If the modulus is correct
 * this returns true; a wrong modulus gets exposed on any failing sample.
 */
export const isUniformlyContinuousOn = (
  f: ConstructiveContinuous,
  interval: readonly [CReal, CReal],
  epsPrecision = 100,
  samples = 32,
): boolean => {
  if (!Number.isInteger(epsPrecision) || epsPrecision <= 0) {
    throw new RangeError('[continuity] epsPrecision must be a positive integer');
  }
  if (!Number.isInteger(samples) || samples <= 0) {
    throw new RangeError('[continuity] samples must be a positive integer');
  }
  const [aR, bR] = interval;
  const a = toNumber(aR);
  const b = toNumber(bR);
  if (!(b > a)) return false;
  const m = f.modulus(epsPrecision);
  if (!Number.isInteger(m) || m <= 0) return false;
  const delta = 1 / (m + 1);
  const epsBound = fromRational(1 / epsPrecision);
  for (let i = 0; i < samples; i++) {
    const t = i / Math.max(1, samples - 1);
    const x = a + t * (b - a);
    // Pair x with x + delta/2, clipped into [a, b]. Distance < 1/m.
    let y = x + delta / 2;
    if (y > b) y = x - delta / 2;
    if (y < a) y = (a + b) / 2;
    const fx = f.fn(fromRational(x));
    const fy = f.fn(fromRational(y));
    const diff = abs(sub(fx, fy));
    // We need diff < 1/eps. Use precision 4 * eps for sound comparison.
    if (!approxLT(diff, epsBound, 4 * epsPrecision)) {
      return false;
    }
  }
  return true;
};

/**
 * Composition of uniformly continuous functions.
 *
 * If g has modulus `omega_g` and f has modulus `omega_f`, then `f . g`
 * has modulus `omega_g . omega_f`:
 *   |x - y| < 1 / omega_g(omega_f(eps))
 *     => |g(x) - g(y)| < 1/omega_f(eps)
 *     => |f(g(x)) - f(g(y))| < 1/eps.
 */
export const composition = (
  f: ConstructiveContinuous,
  g: ConstructiveContinuous,
): ConstructiveContinuous => ({
  fn: (x: CReal) => f.fn(g.fn(x)),
  modulus: (eps: number) => g.modulus(f.modulus(eps))
});

/**
 * Constant function. Modulus is trivial (any positive integer works).
 */
export const constant = (c: CReal): ConstructiveContinuous => ({
  fn: () => c,
  modulus: () => 1
});

/**
 * Identity. Lipschitz-1, modulus(eps) = eps.
 */
export const identity = (): ConstructiveContinuous => ({
  fn: (x: CReal) => x,
  modulus: (eps: number) => eps
});

/**
 * Lipschitz function from a JS callback with known Lipschitz constant L.
 * Useful for tests. Modulus(eps) = ceil(L * eps).
 *
 * The caller is responsible for the Lipschitz bound being correct.
 */
export const lipschitz = (
  fn: (x: CReal) => CReal,
  lipschitzConstant: number,
): ConstructiveContinuous => {
  if (!(lipschitzConstant > 0) || !Number.isFinite(lipschitzConstant)) {
    throw new RangeError('[continuity.lipschitz] L must be finite positive');
  }
  return {
    fn,
    modulus: (eps: number) => Math.max(1, Math.ceil(lipschitzConstant * eps))
  };
};
