/**
 * Constructive real numbers (Bishop / Bridges & Richman style).
 *
 * A CReal is a regular sequence of rationals: a function n -> q_n such that
 * |q_m - q_n| <= 1/m + 1/n for all positive m, n.
 *
 * Equivalently we store an approximation function `approx(n)` returning a
 * rational with |x - approx(n)| < 1/n. All operations are total and
 * constructive: there is no LEM, no decidable equality on reals, no
 * dependent choice — every operation produces an explicit witness
 * function with explicit modulus.
 *
 * Internally we use JavaScript `number` for the rationals. This is a
 * finite-precision approximation of the constructive object, but is
 * faithful as long as the requested precision n stays well below 2^53.
 * The intended use is reasoning / tests, not arbitrary-precision crunching.
 */

export interface CReal {
  /** Returns a rational q with |x - q| < 1/n. Requires n > 0 integer. */
  approx: (n: number) => number;
}

const assertPositiveInt = (n: number, label: string): void => {
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new RangeError(`[constructive-reals] ${label} must be a positive integer, got ${n}`);
  }
};

/** Promote a JS number / rational to a CReal (exact value, error 0). */
export const fromRational = (q: number): CReal => {
  if (!Number.isFinite(q)) {
    throw new RangeError('[constructive-reals] fromRational requires a finite number');
  }
  return { approx: () => q };
};

export const zero: CReal = fromRational(0);
export const one: CReal = fromRational(1);

/**
 * Addition.
 *
 *   |(x + y) - (approx(2n) + bApprox(2n))| <= 1/(2n) + 1/(2n) = 1/n.
 */
export const add = (x: CReal, y: CReal): CReal => ({
  approx: (n: number) => {
    assertPositiveInt(n, 'add precision');
    return x.approx(2 * n) + y.approx(2 * n);
  }
});

export const neg = (x: CReal): CReal => ({
  approx: (n: number) => {
    assertPositiveInt(n, 'neg precision');
    return -x.approx(n);
  }
});

export const sub = (x: CReal, y: CReal): CReal => add(x, neg(y));

/**
 * Multiplication.
 *
 * To get |xy - q| < 1/n we pick a bound K with |x|, |y| < K and use:
 *   xa * yb - xy = xa * (yb - y) + (xa - x) * y
 * so the error is bounded by K * eps_y + K * eps_x.
 *
 * We bound |x| <= |x.approx(1)| + 1 and |y| <= |y.approx(1)| + 1.
 */
export const mul = (x: CReal, y: CReal): CReal => ({
  approx: (n: number) => {
    assertPositiveInt(n, 'mul precision');
    const boundX = Math.abs(x.approx(1)) + 1;
    const boundY = Math.abs(y.approx(1)) + 1;
    const K = Math.max(boundX, boundY, 1);
    // We need 1/m * K + 1/m * K = 2K/m < 1/n  =>  m > 2 K n
    const m = Math.max(1, Math.ceil(2 * K * n) + 1);
    return x.approx(m) * y.approx(m);
  }
});

export const scale = (k: number, x: CReal): CReal => {
  if (!Number.isFinite(k)) {
    throw new RangeError('[constructive-reals] scale requires a finite k');
  }
  if (k === 0) return zero;
  const absK = Math.abs(k);
  return {
    approx: (n: number) => {
      assertPositiveInt(n, 'scale precision');
      const m = Math.max(1, Math.ceil(absK * n) + 1);
      return k * x.approx(m);
    }
  };
};

/**
 * Absolute value.
 *
 * abs is constructively 1-Lipschitz: ||x| - |q|| <= |x - q|. So
 * `(abs x).approx(n) := |x.approx(n)|` is a valid 1/n approximation.
 */
export const abs = (x: CReal): CReal => ({
  approx: (n: number) => {
    assertPositiveInt(n, 'abs precision');
    return Math.abs(x.approx(n));
  }
});

/**
 * Constructive comparison with an explicit precision budget.
 *
 * `approxLT(x, y, n)` returns true if we can witness x < y at precision n,
 * i.e. y.approx(2n) - x.approx(2n) > 1/n. This is decidable on rationals.
 *
 * It is **not** an exact `<` — constructively the strict order on reals
 * is undecidable. But for any n we get a sound monotone approximation:
 * if it returns true, x < y holds in the standard model.
 */
export const approxLT = (x: CReal, y: CReal, precision: number): boolean => {
  assertPositiveInt(precision, 'approxLT precision');
  const diff = y.approx(2 * precision) - x.approx(2 * precision);
  return diff > 1 / precision;
};

/**
 * `approxEq(x, y, n)` returns true if |x - y| < 1/n is witnessed,
 * i.e. |x.approx(2n) - y.approx(2n)| < 1/n - 1/n = 0 ... we use a looser
 * sound test: |x.approx(4n) - y.approx(4n)| < 1/(2n). If this holds then
 * |x - y| <= |x.approx(4n) - y.approx(4n)| + 1/(4n) + 1/(4n) < 1/n.
 */
export const approxEq = (x: CReal, y: CReal, precision: number): boolean => {
  assertPositiveInt(precision, 'approxEq precision');
  const m = 4 * precision;
  const diff = Math.abs(x.approx(m) - y.approx(m));
  return diff < 1 / (2 * precision);
};

/** Decimal estimate of a CReal, accurate to ~1/precision. */
export const toNumber = (x: CReal, precision = 1_000_000): number => {
  assertPositiveInt(precision, 'toNumber precision');
  return x.approx(precision);
};
