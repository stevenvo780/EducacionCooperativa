export function* nats(max: number): Generator<number> {
  if (!Number.isFinite(max) || max < 0) return;
  const cap = Math.floor(max);
  for (let i = 0; i <= cap; i += 1) {
    yield i;
  }
}

export function* range(
  start: number,
  end: number,
  step?: number
): Generator<number> {
  const s = step ?? 1;
  if (s === 0 || !Number.isFinite(s)) return;
  if (s > 0) {
    for (let i = start; i < end; i += s) {
      yield i;
    }
  } else {
    for (let i = start; i > end; i += s) {
      yield i;
    }
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function* randomInts(
  seed: number,
  count: number,
  max: number
): Generator<number> {
  if (count <= 0) return;
  const rng = mulberry32(seed);
  const cap = Math.max(1, Math.floor(max));
  for (let i = 0; i < count; i += 1) {
    yield Math.floor(rng() * cap);
  }
}

export function take<T>(gen: Iterable<T>, n: number): T[] {
  const out: T[] = [];
  if (n <= 0) return out;
  let i = 0;
  for (const v of gen) {
    if (i >= n) break;
    out.push(v);
    i += 1;
  }
  return out;
}

export function toArray<T>(gen: Iterable<T>): T[] {
  return Array.from(gen);
}
