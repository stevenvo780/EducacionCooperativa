import { describe, it, expect } from 'vitest';

import {
  fromRational,
  add,
  mul,
  sub,
  abs,
  toNumber,
  approxEq,
  zero,
  one
} from '@/reasoning/constructive-reals';

import {
  cauchyFrom,
  isCauchy,
  limit,
  type ConstructiveCauchySeq,
  isUniformlyContinuousOn,
  composition,
  constant,
  identity,
  lipschitz,
  bishopIntegral,
  hasFiniteSubcover,
  intermediateValueTheorem,
  meanValueConstructive,
  type ConstructiveContinuous
} from '@/reasoning/constructive-analysis';

describe('constructive-reals primitives (smoke)', () => {
  it('add and mul are exact on rationals', () => {
    expect(toNumber(add(fromRational(1), fromRational(2)))).toBeCloseTo(3, 6);
    expect(toNumber(mul(fromRational(3), fromRational(4)))).toBeCloseTo(12, 6);
  });
});

describe('Cauchy sequences', () => {
  // x_n = 1/n. Cauchy modulus: to get |x_m - x_n| < 1/eps for m, n >= N,
  // suffice N >= 2 * eps (since |1/m - 1/n| <= 1/m + 1/n <= 2/N).
  const oneOverN: ConstructiveCauchySeq = cauchyFrom(
    (n: number) => fromRational(1 / (n + 1)), // n >= 0
    (eps: number) => 2 * eps + 1,
  );

  it('1/n is constructively Cauchy (modulus sound at eps=10)', () => {
    expect(isCauchy(oneOverN, 10)).toBe(true);
  });

  it('1/n is constructively Cauchy at eps=100', () => {
    expect(isCauchy(oneOverN, 100)).toBe(true);
  });

  it('limit of 1/n is 0', () => {
    const lim = limit(oneOverN);
    expect(approxEq(lim, zero, 50)).toBe(true);
    expect(toNumber(lim, 10_000)).toBeCloseTo(0, 3);
  });

  it('Cauchy detection rejects a bogus modulus', () => {
    const bogus: ConstructiveCauchySeq = cauchyFrom(
      (n: number) => fromRational((-1) ** n),
      () => 1, // claims convergence at N=1, but the seq alternates +/-1
    );
    expect(isCauchy(bogus, 4)).toBe(false);
  });

  it('constant sequence is trivially Cauchy and converges to itself', () => {
    const c = cauchyFrom(() => fromRational(7), () => 1);
    expect(isCauchy(c, 100)).toBe(true);
    expect(toNumber(limit(c))).toBeCloseTo(7, 6);
  });

  it('partial sums of 1/2^n converge to 2', () => {
    // S_n = sum_{k=0}^{n} 1/2^k = 2 - 1/2^n.
    // |S_m - S_n| < 1/2^min(m,n). To get < 1/eps, take N = ceil(log2(eps)) + 1.
    const partial: ConstructiveCauchySeq = cauchyFrom(
      (n: number) => fromRational(2 - Math.pow(2, -n)),
      (eps: number) => Math.max(1, Math.ceil(Math.log2(eps)) + 2),
    );
    expect(isCauchy(partial, 100)).toBe(true);
    const lim = limit(partial);
    expect(toNumber(lim, 10_000)).toBeCloseTo(2, 3);
  });
});

describe('Uniform continuity', () => {
  // f(x) = x^2. On [0, 1], Lipschitz constant is 2 (since |f'| <= 2).
  // So modulus(eps) = ceil(2 * eps) works.
  const xSquared: ConstructiveContinuous = {
    fn: (x) => mul(x, x),
    modulus: (eps) => Math.max(1, 2 * eps)
  };

  it('x^2 is uniformly continuous on [0, 1]', () => {
    expect(isUniformlyContinuousOn(xSquared, [zero, one], 50)).toBe(true);
  });

  it('x^2 modulus is sound at finer precision', () => {
    expect(isUniformlyContinuousOn(xSquared, [zero, one], 200, 16)).toBe(true);
  });

  it('identity is uniformly continuous on [-1, 1]', () => {
    const id = identity();
    expect(isUniformlyContinuousOn(id, [fromRational(-1), one], 100)).toBe(true);
  });

  it('constant function is uniformly continuous everywhere', () => {
    const k = constant(fromRational(3.14));
    expect(isUniformlyContinuousOn(k, [zero, fromRational(10)], 100)).toBe(true);
  });

  it('composition of two Lipschitz continuous functions is continuous', () => {
    const g = lipschitz((x) => add(x, one), 1); // g(x) = x + 1
    const f = lipschitz((x) => mul(x, fromRational(2)), 2); // f(y) = 2y
    const fog = composition(f, g);
    expect(toNumber(fog.fn(fromRational(3)))).toBeCloseTo(8, 6); // 2*(3+1)
    expect(isUniformlyContinuousOn(fog, [zero, one], 50)).toBe(true);
  });

  it('a wrong modulus is rejected', () => {
    const wrongMod: ConstructiveContinuous = {
      fn: (x) => mul(x, mul(x, x)), // x^3
      modulus: () => 1 // claims |x-y| < 1 => |f(x)-f(y)| < 1/eps. False.
    };
    expect(isUniformlyContinuousOn(wrongMod, [zero, fromRational(5)], 10)).toBe(false);
  });
});

describe('Bishop integral', () => {
  it('integral of constant c over [a, b] equals c * (b - a)', () => {
    const c = constant(fromRational(2.5));
    const I = bishopIntegral(c, fromRational(1), fromRational(4), 100);
    expect(toNumber(I, 10_000)).toBeCloseTo(2.5 * 3, 2);
  });

  it('integral of identity over [0, 1] is 0.5', () => {
    const id = identity();
    const I = bishopIntegral(id, zero, one, 200);
    expect(toNumber(I, 10_000)).toBeCloseTo(0.5, 2);
  });

  it('integral of x^2 over [0, 1] is approximately 1/3', () => {
    const xSq: ConstructiveContinuous = {
      fn: (x) => mul(x, x),
      modulus: (eps) => Math.max(1, 2 * eps)
    };
    const I = bishopIntegral(xSq, zero, one, 200);
    expect(toNumber(I, 10_000)).toBeCloseTo(1 / 3, 2);
  });

  it('integral is sign-aware (reversing limits flips sign)', () => {
    const id = identity();
    const Iup = bishopIntegral(id, zero, one, 100);
    const Idn = bishopIntegral(id, one, zero, 100);
    expect(toNumber(Iup, 1_000)).toBeCloseTo(0.5, 2);
    expect(toNumber(Idn, 1_000)).toBeCloseTo(-0.5, 2);
  });
});

describe('Heine-Borel finite subcover', () => {
  it('three open intervals cover [0, 1]', () => {
    const cover = {
      intervals: [
        [fromRational(-0.1), fromRational(0.5)],
        [fromRational(0.3), fromRational(0.8)],
        [fromRational(0.7), fromRational(1.2)]
      ] as ReadonlyArray<readonly [import('@/reasoning/constructive-reals').CReal, import('@/reasoning/constructive-reals').CReal]>
    };
    expect(hasFiniteSubcover(cover, [zero, one])).toBe(true);
  });

  it('a gap in the cover is rejected', () => {
    const cover = {
      intervals: [
        [fromRational(-0.1), fromRational(0.3)],
        [fromRational(0.7), fromRational(1.2)]
      ] as ReadonlyArray<readonly [import('@/reasoning/constructive-reals').CReal, import('@/reasoning/constructive-reals').CReal]>
    };
    expect(hasFiniteSubcover(cover, [zero, one])).toBe(false);
  });
});

describe('Intermediate Value Theorem (constructive)', () => {
  it('IVT for f(x) = x^2 - 2 on [1, 2] finds c with f(c) ≈ 0', () => {
    const f: ConstructiveContinuous = {
      fn: (x) => sub(mul(x, x), fromRational(2)),
      modulus: (eps) => Math.max(1, 4 * eps) // L = 4 on [1, 2]
    };
    const c = intermediateValueTheorem(f, one, fromRational(2), zero, 200);
    expect(c).not.toBeNull();
    if (c !== null) {
      // c should be close to sqrt(2).
      expect(toNumber(c, 10_000)).toBeCloseTo(Math.SQRT2, 1);
      // f(c) should be close to 0.
      const fc = f.fn(c);
      expect(toNumber(abs(fc), 10_000)).toBeLessThan(1 / 50);
    }
  });

  it('IVT for f(x) = x - 0.5 on [0, 1] hits target 0', () => {
    const f: ConstructiveContinuous = {
      fn: (x) => sub(x, fromRational(0.5)),
      modulus: (eps) => Math.max(1, eps)
    };
    const c = intermediateValueTheorem(f, zero, one, zero, 100);
    expect(c).not.toBeNull();
    if (c !== null) {
      expect(toNumber(c, 1_000)).toBeCloseTo(0.5, 2);
    }
  });

  it('IVT returns null when target is not bracketed', () => {
    // f(x) = 1 (constant) on [0, 1]: target 0 is not in the image.
    const f = constant(one);
    const c = intermediateValueTheorem(f, zero, one, zero, 50);
    expect(c).toBeNull();
  });
});

describe('Mean value (constructive)', () => {
  it('mean of x on [0, 1] is 0.5 and IVT finds c with f(c) ≈ 0.5', () => {
    const id = identity();
    const c = meanValueConstructive(id, zero, one, 100);
    expect(c).not.toBeNull();
    if (c !== null) {
      expect(toNumber(c, 1_000)).toBeCloseTo(0.5, 2);
    }
  });
});
