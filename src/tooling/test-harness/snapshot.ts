import type { Snapshot, SnapshotComparison } from './types';

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null) return null;
    if (typeof v === 'undefined') return '__undefined__';
    if (typeof v === 'bigint') return `__bigint__:${v.toString()}`;
    if (typeof v === 'function') return `__fn__:${v.name || 'anon'}`;
    if (typeof v === 'symbol') return `__sym__:${v.toString()}`;
    if (typeof v !== 'object') return v;
    if (seen.has(v as object)) return '__cycle__';
    seen.add(v as object);
    if (Array.isArray(v)) {
      return v.map(walk);
    }
    if (v instanceof Map) {
      const entries: Array<[unknown, unknown]> = [];
      for (const [k, val] of v.entries()) entries.push([k, val]);
      entries.sort((a, b) => {
        const ka = String(a[0]);
        const kb = String(b[0]);
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
      return { __map__: entries.map(([k, val]) => [walk(k), walk(val)]) };
    }
    if (v instanceof Set) {
      const arr = Array.from(v.values()).map(walk);
      arr.sort((a, b) => {
        const sa = JSON.stringify(a);
        const sb = JSON.stringify(b);
        return sa < sb ? -1 : sa > sb ? 1 : 0;
      });
      return { __set__: arr };
    }
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      out[k] = walk(obj[k]);
    }
    return out;
  };
  return JSON.stringify(walk(value));
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function snapshotHash(input: unknown, output: unknown): string {
  return fnv1a(`${stableStringify(input)}|${stableStringify(output)}`);
}

export function takeSnapshot(input: unknown, output: unknown): Snapshot {
  return {
    input,
    output,
    hash: snapshotHash(input, output)
  };
}

export function compareSnapshot(
  snap: Snapshot,
  current: unknown
): SnapshotComparison {
  const expected = stableStringify(snap.output);
  const actual = stableStringify(current);
  if (expected === actual) {
    return { match: true };
  }
  return {
    match: false,
    diff: `expected: ${expected}\nactual:   ${actual}`
  };
}
