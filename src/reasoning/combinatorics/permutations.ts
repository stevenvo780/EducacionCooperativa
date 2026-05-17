function assertValidPermutation(perm: number[]): void {
  const n = perm.length;
  const seen = new Set<number>();
  for (const v of perm) {
    if (!Number.isInteger(v) || v < 0 || v >= n) {
      throw new RangeError(`permutación inválida: valor ${v} fuera de [0,${n})`);
    }
    if (seen.has(v)) {
      throw new RangeError(`permutación inválida: valor repetido ${v}`);
    }
    seen.add(v);
  }
}

export function permutationParity(perm: number[]): 1 | -1 {
  assertValidPermutation(perm);
  const n = perm.length;
  const visited = new Array<boolean>(n).fill(false);
  let totalTranspositions = 0;
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    let length = 0;
    let j = i;
    while (!visited[j]) {
      visited[j] = true;
      const next = perm[j];
      if (next === undefined) {
        throw new Error('permutationParity: índice inválido');
      }
      j = next;
      length++;
    }
    totalTranspositions += length - 1;
  }
  return totalTranspositions % 2 === 0 ? 1 : -1;
}

export function permutationCycles(perm: number[]): number[][] {
  assertValidPermutation(perm);
  const n = perm.length;
  const visited = new Array<boolean>(n).fill(false);
  const cycles: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const cycle: number[] = [];
    let j = i;
    while (!visited[j]) {
      visited[j] = true;
      cycle.push(j);
      const next = perm[j];
      if (next === undefined) {
        throw new Error('permutationCycles: índice inválido');
      }
      j = next;
    }
    cycles.push(cycle);
  }
  return cycles;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

export function permutationOrder(perm: number[]): number {
  const cycles = permutationCycles(perm);
  let order = 1;
  for (const c of cycles) {
    order = lcm(order, c.length);
  }
  return order;
}

export function composePermutations(p: number[], q: number[]): number[] {
  assertValidPermutation(p);
  assertValidPermutation(q);
  if (p.length !== q.length) {
    throw new RangeError('composePermutations: longitudes diferentes');
  }
  const n = p.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const qi = q[i];
    if (qi === undefined) {
      throw new Error('composePermutations: índice inválido en q');
    }
    const pqi = p[qi];
    if (pqi === undefined) {
      throw new Error('composePermutations: índice inválido en p');
    }
    out[i] = pqi;
  }
  return out;
}

export function inversePermutation(perm: number[]): number[] {
  assertValidPermutation(perm);
  const n = perm.length;
  const inv = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const pi = perm[i];
    if (pi === undefined) {
      throw new Error('inversePermutation: índice inválido');
    }
    inv[pi] = i;
  }
  return inv;
}
