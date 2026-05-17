export function* generatePermutations<T>(items: T[]): Generator<T[]> {
  const n = items.length;
  if (n === 0) {
    yield [];
    return;
  }
  const arr = items.slice();

  function swap(i: number, j: number): void {
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) {
      if (!(i in arr) || !(j in arr)) {
        throw new Error('generatePermutations: índice fuera de rango');
      }
    }
    arr[i] = b as T;
    arr[j] = a as T;
  }

  function* heap(k: number): Generator<T[]> {
    if (k === 1) {
      yield arr.slice();
      return;
    }
    for (let i = 0; i < k; i++) {
      yield* heap(k - 1);
      if (k % 2 === 0) {
        swap(i, k - 1);
      } else {
        swap(0, k - 1);
      }
    }
  }

  yield* heap(n);
}

export function* generateCombinations<T>(items: T[], r: number): Generator<T[]> {
  if (!Number.isInteger(r) || r < 0) {
    throw new RangeError('generateCombinations: r debe ser entero no negativo');
  }
  const n = items.length;
  if (r > n) return;
  if (r === 0) {
    yield [];
    return;
  }
  const indices: number[] = [];
  for (let i = 0; i < r; i++) indices.push(i);
  while (true) {
    const out: T[] = [];
    for (const idx of indices) {
      const v = items[idx];
      if (v === undefined && !(idx in items)) {
        throw new Error('generateCombinations: índice fuera de rango');
      }
      out.push(v as T);
    }
    yield out;
    let i = r - 1;
    while (i >= 0) {
      const cur = indices[i];
      if (cur === undefined) {
        throw new Error('generateCombinations: índice undefined');
      }
      if (cur !== i + n - r) break;
      i--;
    }
    if (i < 0) return;
    const cur = indices[i];
    if (cur === undefined) return;
    indices[i] = cur + 1;
    for (let j = i + 1; j < r; j++) {
      const prev = indices[j - 1];
      if (prev === undefined) {
        throw new Error('generateCombinations: prev undefined');
      }
      indices[j] = prev + 1;
    }
  }
}

export function* generatePowerSet<T>(items: T[]): Generator<T[]> {
  const n = items.length;
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const subset: T[] = [];
    for (let i = 0; i < n; i++) {
      if ((mask >> i) & 1) {
        const v = items[i];
        if (v === undefined && !(i in items)) {
          throw new Error('generatePowerSet: índice fuera de rango');
        }
        subset.push(v as T);
      }
    }
    yield subset;
  }
}

export function* generateSubsetsOfSize<T>(items: T[], k: number): Generator<T[]> {
  yield* generateCombinations(items, k);
}
