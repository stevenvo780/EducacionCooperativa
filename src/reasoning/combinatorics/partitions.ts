import { ZERO, ONE, NEG_ONE } from './bigint-helpers';

export function partitions(n: number): number[][] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('partitions requiere entero no negativo');
  }
  if (n === 0) return [[]];
  const result: number[][] = [];
  function recurse(remaining: number, maxPart: number, current: number[]): void {
    if (remaining === 0) {
      result.push(current.slice());
      return;
    }
    const upper = Math.min(maxPart, remaining);
    for (let i = upper; i >= 1; i--) {
      current.push(i);
      recurse(remaining - i, i, current);
      current.pop();
    }
  }
  recurse(n, n, []);
  return result;
}

const PARTITION_COUNT_CACHE: bigint[] = [ONE];

export function partitionsCount(n: number): bigint {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('partitionsCount requiere entero no negativo');
  }
  // Euler pentagonal number recurrence:
  // p(n) = sum_{k!=0} (-1)^(k-1) [p(n - k(3k-1)/2) + p(n - k(3k+1)/2)]
  for (let m = PARTITION_COUNT_CACHE.length; m <= n; m++) {
    let total = ZERO;
    for (let k = 1; ; k++) {
      const g1 = (k * (3 * k - 1)) / 2;
      const g2 = (k * (3 * k + 1)) / 2;
      if (g1 > m && g2 > m) break;
      const sign = k % 2 === 1 ? ONE : NEG_ONE;
      if (g1 <= m) {
        const v = PARTITION_COUNT_CACHE[m - g1];
        if (v === undefined) throw new Error('partitionsCount cache miss');
        total += sign * v;
      }
      if (g2 <= m) {
        const v = PARTITION_COUNT_CACHE[m - g2];
        if (v === undefined) throw new Error('partitionsCount cache miss');
        total += sign * v;
      }
    }
    PARTITION_COUNT_CACHE[m] = total;
  }
  const v = PARTITION_COUNT_CACHE[n];
  if (v === undefined) throw new Error('partitionsCount cache miss inesperado');
  return v;
}

export function partitionsIntoParts(n: number, k: number): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0) {
    throw new RangeError('partitionsIntoParts requiere n,k enteros no negativos');
  }
  if (k === 0) return n === 0 ? ONE : ZERO;
  if (k > n) return ZERO;
  // p_k(n) = p_k(n-k) + p_{k-1}(n-1)
  // memoization 2D
  const memo = new Map<string, bigint>();
  function pk(nn: number, kk: number): bigint {
    if (kk === 0) return nn === 0 ? ONE : ZERO;
    if (nn <= 0 || kk > nn) return ZERO;
    const key = `${nn}|${kk}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    const v = pk(nn - kk, kk) + pk(nn - 1, kk - 1);
    memo.set(key, v);
    return v;
  }
  return pk(n, k);
}
