export function multiplyPolynomials(a: number[], b: number[]): number[] {
  if (a.length === 0 || b.length === 0) return [];
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    if (ai === undefined) throw new Error('multiplyPolynomials: coef indefinido en a');
    if (ai === 0) continue;
    for (let j = 0; j < b.length; j++) {
      const bj = b[j];
      if (bj === undefined) throw new Error('multiplyPolynomials: coef indefinido en b');
      const cur = out[i + j];
      if (cur === undefined) throw new Error('multiplyPolynomials: out indefinido');
      out[i + j] = cur + ai * bj;
    }
  }
  return out;
}

/**
 * Evalúa los primeros `n+1` coeficientes (grado 0..n) de la serie de potencias
 * formal cuyos coeficientes están dados explícitamente por `coefficients`.
 * Si `coefficients` tiene menos términos, los completa con 0.
 */
export function generatingFunction(coefficients: number[], n: number): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('generatingFunction: n debe ser entero no negativo');
  }
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const c = coefficients[i];
    out.push(c === undefined ? 0 : c);
  }
  return out;
}

/**
 * Devuelve los coeficientes de (1+x)^n (binomiales). Útil como GF estándar.
 */
export function binomialGF(n: number): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('binomialGF: n entero no negativo');
  }
  const row: number[] = [1];
  for (let i = 1; i <= n; i++) {
    const next: number[] = [1];
    for (let j = 1; j < i; j++) {
      const a = row[j - 1];
      const b = row[j];
      if (a === undefined || b === undefined) throw new Error('binomialGF: índice');
      next.push(a + b);
    }
    next.push(1);
    row.length = 0;
    row.push(...next);
  }
  return row;
}
