function arrayEquals<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function cartesianProduct<T>(items: T[], length: number): T[][] {
  if (length === 0) return [[]];
  const out: T[][] = [];
  function recurse(current: T[]): void {
    if (current.length === length) {
      out.push(current.slice());
      return;
    }
    for (const it of items) {
      current.push(it);
      recurse(current);
      current.pop();
    }
  }
  recurse([]);
  return out;
}

/**
 * Aplica el lema de Burnside para contar órbitas. `items` es el alfabeto;
 * el conjunto X sobre el que actúa el grupo son las cadenas de longitud
 * `length` (collares de `length` perlas con `items.length` colores).
 * `groupActions` son las funciones del grupo G actuando sobre X.
 *
 * |X/G| = (1/|G|) * sum_{g in G} |X^g|
 */
export function burnsideCount<T>(
  items: T[],
  length: number,
  groupActions: Array<(x: T[]) => T[]>
): number {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError('burnsideCount: length debe ser entero no negativo');
  }
  if (groupActions.length === 0) {
    throw new RangeError('burnsideCount: groupActions vacío');
  }
  const X = cartesianProduct(items, length);
  let totalFixed = 0;
  for (const g of groupActions) {
    let fixed = 0;
    for (const x of X) {
      const gx = g(x);
      if (gx.length !== x.length) {
        throw new Error('burnsideCount: acción cambió la longitud');
      }
      if (arrayEquals(x, gx)) fixed++;
    }
    totalFixed += fixed;
  }
  if (totalFixed % groupActions.length !== 0) {
    throw new Error('burnsideCount: total no es múltiplo de |G|, ¿G no es grupo?');
  }
  return totalFixed / groupActions.length;
}

/**
 * Genera las |group| rotaciones cíclicas de un arreglo de tamaño `length`.
 * Útil para contar collares con simetría cíclica.
 */
export function cyclicRotations(length: number): Array<(x: unknown[]) => unknown[]> {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError('cyclicRotations: length entero no negativo');
  }
  const rots: Array<(x: unknown[]) => unknown[]> = [];
  for (let k = 0; k < Math.max(1, length); k++) {
    rots.push((x) => {
      const n = x.length;
      const out: unknown[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const src = x[(i + k) % n];
        if (src === undefined && !((i + k) % n in x)) {
          throw new Error('cyclicRotations: índice inválido');
        }
        out[i] = src;
      }
      return out;
    });
  }
  return rots;
}
