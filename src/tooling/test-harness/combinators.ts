import type {
  CombineMode,
  CrossProductOptions,
  TestCase,
  TestSuite
} from './types';

function caseTags<T>(c: TestCase<T>): string[] {
  return c.tags ?? [];
}

function hasAnyTag<T>(c: TestCase<T>, wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  const tags = caseTags(c);
  for (const t of wanted) {
    if (tags.includes(t)) return true;
  }
  return false;
}

function tagsMatchMode(
  a: string[],
  b: string[],
  mode: CombineMode
): boolean {
  if (mode === 'cartesian') return true;
  if (mode === 'union') {
    if (a.length === 0 && b.length === 0) return true;
    return true;
  }
  if (a.length === 0 || b.length === 0) return false;
  for (const t of a) {
    if (b.includes(t)) return true;
  }
  return false;
}

export function crossProduct<T1, T2>(
  s1: TestSuite<T1>,
  s2: TestSuite<T2>,
  opts?: CrossProductOptions
): TestSuite<{ a: T1; b: T2 }> {
  const mode: CombineMode = opts?.combine ?? 'cartesian';
  const filterTags = opts?.filterTags ?? [];
  const cases: TestCase<{ a: T1; b: T2 }>[] = [];
  for (const ca of s1.cases) {
    for (const cb of s2.cases) {
      if (!tagsMatchMode(caseTags(ca), caseTags(cb), mode)) continue;
      const mergedTags = Array.from(
        new Set([...caseTags(ca), ...caseTags(cb)])
      );
      if (filterTags.length > 0) {
        let hit = false;
        for (const t of filterTags) {
          if (mergedTags.includes(t)) {
            hit = true;
            break;
          }
        }
        if (!hit) continue;
      }
      cases.push({
        name: `${ca.name} × ${cb.name}`,
        input: { a: ca.input, b: cb.input },
        tags: mergedTags.length > 0 ? mergedTags : undefined
      });
    }
  }
  return { name: `${s1.name} × ${s2.name}`, cases };
}

export function parameterize<T, P>(
  suite: TestSuite<T>,
  params: P[]
): TestSuite<{ input: T; param: P }> {
  const cases: TestCase<{ input: T; param: P }>[] = [];
  for (let i = 0; i < suite.cases.length; i += 1) {
    const c = suite.cases[i];
    if (!c) continue;
    for (let j = 0; j < params.length; j += 1) {
      const p = params[j] as P;
      cases.push({
        name: `${c.name} [param=${formatParam(p)}]`,
        input: { input: c.input, param: p },
        tags: c.tags
      });
    }
  }
  return { name: `${suite.name} ⊗ params`, cases };
}

function formatParam(p: unknown): string {
  if (p === null) return 'null';
  if (p === undefined) return 'undefined';
  if (typeof p === 'string') return p;
  if (typeof p === 'number' || typeof p === 'boolean') return String(p);
  try {
    return JSON.stringify(p);
  } catch {
    return '[unserializable]';
  }
}

export function filter<T>(
  suite: TestSuite<T>,
  pred: (c: TestCase<T>) => boolean
): TestSuite<T> {
  return {
    name: suite.name,
    cases: suite.cases.filter(pred)
  };
}

export function filterByTags<T>(
  suite: TestSuite<T>,
  tags: string[]
): TestSuite<T> {
  return filter(suite, (c) => hasAnyTag(c, tags));
}

export function tag<T>(
  suite: TestSuite<T>,
  tagFn: (c: TestCase<T>) => string[]
): TestSuite<T> {
  return {
    name: suite.name,
    cases: suite.cases.map((c) => {
      const extra = tagFn(c);
      const merged = Array.from(new Set([...(c.tags ?? []), ...extra]));
      return { ...c, tags: merged.length > 0 ? merged : undefined };
    })
  };
}

export function makeSuite<T>(
  name: string,
  cases: TestCase<T>[]
): TestSuite<T> {
  return { name, cases };
}
