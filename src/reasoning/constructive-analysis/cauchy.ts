/**
 * Constructive Cauchy sequences with explicit modulus of convergence.
 *
 * In Bishop's school, a "Cauchy sequence" without a modulus is not enough
 * data to extract a limit constructively — one needs an explicit
 * `modulus(eps)` returning an index N(eps) such that
 *   for all m, n >= N(eps), |x_m - x_n| < eps.
 */

import { type CReal, fromRational, sub, abs, approxLT } from '../constructive-reals';

export interface ConstructiveCauchySeq {
  /** n-th term of the sequence (n >= 0). */
  approx: (n: number) => CReal;
  /**
   * Modulus of convergence: returns N such that for all m, n >= N,
   * |x_m - x_n| < 1/epsPrecision. `epsPrecision` is a positive integer
   * (we work with rational 1/k thresholds to stay constructive).
   */
  modulus: (epsPrecision: number) => number;
}

/**
 * Sound (one-sided) check: returns true if the modulus genuinely
 * witnesses Cauchy-ness at precision `eps` for the first few terms.
 *
 * Constructively we cannot inspect "all m, n >= N" — we sample a window
 * and verify the bound holds. If the modulus is correct this will
 * return true; if it is a counterexample for some sampled pair, false.
 *
 * `sampleWindow` controls how many terms past N we inspect. Default 8
 * is enough to expose almost all wrong moduli.
 */
export const isCauchy = (
  seq: ConstructiveCauchySeq,
  epsPrecision: number,
  sampleWindow = 8,
): boolean => {
  if (!Number.isInteger(epsPrecision) || epsPrecision <= 0) {
    throw new RangeError('[cauchy] epsPrecision must be a positive integer');
  }
  const N = seq.modulus(epsPrecision);
  if (!Number.isInteger(N) || N < 0) return false;
  for (let i = 0; i <= sampleWindow; i++) {
    for (let j = i + 1; j <= sampleWindow; j++) {
      const diff = abs(sub(seq.approx(N + i), seq.approx(N + j)));
      // We want diff < 1/eps. Pick precision p such that
      // approxLT(diff, 1/eps, p) is sensitive enough. p = 4 * eps works.
      if (!approxLT(diff, fromRational(1 / epsPrecision), 4 * epsPrecision)) {
        return false;
      }
    }
  }
  return true;
};

/**
 * Limit of a Cauchy sequence with modulus.
 *
 * Construction: define
 *   limApprox(n) := seq.approx(N).approx(2n), where N = modulus(2n)
 *
 * Then for any n, |limApprox(n) - lim| <= |limApprox(n) - x_N|
 *                                       + |x_N - lim|
 *                                       <= 1/(2n) + 1/(2n) = 1/n.
 *
 * The bound |x_N - lim| <= 1/(2n) follows from the Cauchy modulus:
 * for all m >= N, |x_N - x_m| < 1/(2n), and passing to the limit
 * preserves the non-strict bound.
 */
export const limit = (seq: ConstructiveCauchySeq): CReal => ({
  approx: (n: number) => {
    if (!Number.isInteger(n) || n <= 0) {
      throw new RangeError('[cauchy.limit] precision must be a positive integer');
    }
    const N = seq.modulus(2 * n);
    return seq.approx(N).approx(2 * n);
  }
});

/**
 * Convenience: builds a Cauchy seq from a generator + a known rate `1/f(eps)`.
 * `f(eps)` must return an integer N with |x_m - x_n| < 1/eps for m, n >= N.
 */
export const cauchyFrom = (
  term: (n: number) => CReal,
  modulus: (eps: number) => number,
): ConstructiveCauchySeq => ({
  approx: term,
  modulus
});
