import { binomial } from './basic-counts';
import { ZERO, ONE, TWO } from './bigint-helpers';

const STIRLING2_CACHE = new Map<string, bigint>();

export function stirlingSecondKind(n: number, k: number): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0) {
    throw new RangeError('stirlingSecondKind requiere enteros no negativos');
  }
  if (k === 0) return n === 0 ? ONE : ZERO;
  if (k > n) return ZERO;
  if (k === n) return ONE;
  if (k === 1) return ONE;
  const key = `${n}|${k}`;
  const cached = STIRLING2_CACHE.get(key);
  if (cached !== undefined) return cached;
  // S(n,k) = k*S(n-1,k) + S(n-1,k-1)
  const v = BigInt(k) * stirlingSecondKind(n - 1, k) + stirlingSecondKind(n - 1, k - 1);
  STIRLING2_CACHE.set(key, v);
  return v;
}

const STIRLING1_CACHE = new Map<string, bigint>();

export function stirlingFirstKind(n: number, k: number): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0) {
    throw new RangeError('stirlingFirstKind requiere enteros no negativos');
  }
  if (k === 0) return n === 0 ? ONE : ZERO;
  if (k > n) return ZERO;
  if (k === n) return ONE;
  const key = `${n}|${k}`;
  const cached = STIRLING1_CACHE.get(key);
  if (cached !== undefined) return cached;
  // c(n,k) = c(n-1,k-1) + (n-1)*c(n-1,k)  (unsigned)
  const v = stirlingFirstKind(n - 1, k - 1) + BigInt(n - 1) * stirlingFirstKind(n - 1, k);
  STIRLING1_CACHE.set(key, v);
  return v;
}

export function catalan(n: number): bigint {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('catalan requiere entero no negativo');
  }
  // C_n = C(2n,n) / (n+1)
  return binomial(2 * n, n) / BigInt(n + 1);
}

const BELL_CACHE: bigint[] = [ONE];

export function bellNumber(n: number): bigint {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('bellNumber requiere entero no negativo');
  }
  for (let m = BELL_CACHE.length; m <= n; m++) {
    let total = ZERO;
    for (let k = 0; k < m; k++) {
      const bk = BELL_CACHE[k];
      if (bk === undefined) throw new Error('bellNumber cache miss');
      total += binomial(m - 1, k) * bk;
    }
    BELL_CACHE[m] = total;
  }
  const v = BELL_CACHE[n];
  if (v === undefined) throw new Error('bellNumber cache miss');
  return v;
}

const EULER_CACHE = new Map<string, bigint>();

function eulerianFirstOrder(n: number, k: number): bigint {
  if (k < 0 || k >= n) return ZERO;
  if (k === 0) return ONE;
  const key = `${n}|${k}`;
  const cached = EULER_CACHE.get(key);
  if (cached !== undefined) return cached;
  // <n,k> = (k+1) <n-1,k> + (n-k) <n-1,k-1>
  const v = BigInt(k + 1) * eulerianFirstOrder(n - 1, k) + BigInt(n - k) * eulerianFirstOrder(n - 1, k - 1);
  EULER_CACHE.set(key, v);
  return v;
}

const ZIGZAG_CACHE: bigint[] = [ONE, ONE];

export function eulerNumber(n: number): bigint {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('eulerNumber requiere entero no negativo');
  }
  // Número de permutaciones alternantes ("zigzag"): A(0)=1, A(1)=1,
  // 2*A(n+1) = sum_{k=0..n} C(n,k) * A(k) * A(n-k).
  for (let m = ZIGZAG_CACHE.length; m <= n; m++) {
    const prev = m - 1;
    let total = ZERO;
    for (let k = 0; k <= prev; k++) {
      const ak = ZIGZAG_CACHE[k];
      const ank = ZIGZAG_CACHE[prev - k];
      if (ak === undefined || ank === undefined) throw new Error('eulerNumber cache miss');
      total += binomial(prev, k) * ak * ank;
    }
    if (total % TWO !== ZERO) {
      throw new Error('eulerNumber: total impar inesperado');
    }
    ZIGZAG_CACHE[m] = total / TWO;
  }
  const v = ZIGZAG_CACHE[n];
  if (v === undefined) throw new Error('eulerNumber cache miss');
  return v;
}

export function eulerianNumber(n: number, k: number): bigint {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0) {
    throw new RangeError('eulerianNumber requiere enteros no negativos');
  }
  return eulerianFirstOrder(n, k);
}
