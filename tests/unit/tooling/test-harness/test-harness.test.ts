import {
  compareSnapshot,
  crossProduct,
  filter,
  filterByTags,
  makeSuite,
  mutateBoolean,
  mutateNumber,
  mutateString,
  nats,
  parameterize,
  randomInts,
  range,
  runWithCoverage,
  snapshotHash,
  tag,
  take,
  takeSnapshot,
  toArray,
  type TestCase,
  type TestSuite
} from '@/tooling/test-harness';

function suiteA(): TestSuite<number> {
  return makeSuite('A', [
    { name: 'a1', input: 1, tags: ['fast'] },
    { name: 'a2', input: 2, tags: ['slow'] },
    { name: 'a3', input: 3, tags: ['fast', 'edge'] }
  ]);
}

function suiteB(): TestSuite<string> {
  return makeSuite('B', [
    { name: 'b1', input: 'x', tags: ['fast'] },
    { name: 'b2', input: 'y', tags: ['slow'] }
  ]);
}

describe('test-harness combinators', () => {
  it('crossProduct cartesian 3x2 produces 6 cases', () => {
    const result = crossProduct(suiteA(), suiteB(), { combine: 'cartesian' });
    expect(result.cases).toHaveLength(6);
    expect(result.name).toBe('A × B');
    const names = result.cases.map((c) => c.name);
    expect(names).toContain('a1 × b1');
    expect(names).toContain('a3 × b2');
  });

  it('crossProduct intersect keeps only shared-tag pairs', () => {
    const result = crossProduct(suiteA(), suiteB(), { combine: 'intersect' });
    // shared tag pairs: a1(fast)×b1(fast), a2(slow)×b2(slow), a3(fast,edge)×b1(fast)
    expect(result.cases).toHaveLength(3);
    const names = result.cases.map((c) => c.name).sort();
    expect(names).toEqual(['a1 × b1', 'a2 × b2', 'a3 × b1']);
  });

  it('crossProduct respects filterTags', () => {
    const result = crossProduct(suiteA(), suiteB(), {
      combine: 'cartesian',
      filterTags: ['edge']
    });
    // only a3 has 'edge', combined with b1 and b2 → 2 cases
    expect(result.cases).toHaveLength(2);
    for (const c of result.cases) {
      expect(c.tags ?? []).toContain('edge');
    }
  });

  it('parameterize multiplies cases by params length', () => {
    const params = ['p1', 'p2', 'p3'] as const;
    const result = parameterize(suiteA(), [...params]);
    expect(result.cases).toHaveLength(suiteA().cases.length * params.length);
    const first = result.cases[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.input.param).toBe('p1');
      expect(first.input.input).toBe(1);
    }
  });

  it('filter by predicate keeps matching cases', () => {
    const filtered = filter(suiteA(), (c) => c.input >= 2);
    expect(filtered.cases.map((c) => c.input)).toEqual([2, 3]);
  });

  it('filterByTags returns only cases with at least one matching tag', () => {
    const filtered = filterByTags(suiteA(), ['edge']);
    expect(filtered.cases).toHaveLength(1);
    expect(filtered.cases[0]?.name).toBe('a3');
  });

  it('tag merges new tags onto cases without duplicates', () => {
    const tagged = tag(suiteA(), (c) => (c.input % 2 === 0 ? ['even'] : ['odd']));
    const a1 = tagged.cases.find((c) => c.name === 'a1');
    const a2 = tagged.cases.find((c) => c.name === 'a2');
    const a3 = tagged.cases.find((c) => c.name === 'a3');
    expect(a1?.tags).toContain('odd');
    expect(a1?.tags).toContain('fast');
    expect(a2?.tags).toContain('even');
    expect(a3?.tags).toEqual(expect.arrayContaining(['fast', 'edge', 'odd']));
  });
});

describe('test-harness generators', () => {
  it('nats yields 0..max inclusive', () => {
    expect(toArray(nats(4))).toEqual([0, 1, 2, 3, 4]);
    expect(toArray(nats(0))).toEqual([0]);
    expect(toArray(nats(-1))).toEqual([]);
  });

  it('range supports positive and negative steps', () => {
    expect(toArray(range(0, 5))).toEqual([0, 1, 2, 3, 4]);
    expect(toArray(range(0, 10, 3))).toEqual([0, 3, 6, 9]);
    expect(toArray(range(5, 0, -1))).toEqual([5, 4, 3, 2, 1]);
    expect(toArray(range(0, 5, 0))).toEqual([]);
  });

  it('randomInts is deterministic with the same seed', () => {
    const a = toArray(randomInts(42, 10, 1000));
    const b = toArray(randomInts(42, 10, 1000));
    const c = toArray(randomInts(43, 10, 1000));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a).toHaveLength(10);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1000);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('take limits an iterable to n elements', () => {
    expect(take(nats(100), 3)).toEqual([0, 1, 2]);
    expect(take(nats(100), 0)).toEqual([]);
  });
});

describe('test-harness coverage', () => {
  it('runWithCoverage counts passing/failing/errored and tag distribution', async () => {
    const suite = makeSuite<number>('mix', [
      { name: 'ok1', input: 1, tags: ['pos'] },
      { name: 'ok2', input: 2, tags: ['pos', 'even'] },
      { name: 'bad', input: -1, tags: ['neg'] },
      { name: 'boom', input: 0, tags: ['zero'] }
    ]);
    const report = await runWithCoverage(suite, async (c: TestCase<number>) => {
      if (c.name === 'boom') throw new Error('explode');
      return c.input > 0;
    });
    expect(report.totalCases).toBe(4);
    expect(report.passing).toBe(2);
    expect(report.failing).toBe(1);
    expect(report.errored).toBe(1);
    expect(report.tagDistribution.get('pos')).toBe(2);
    expect(report.tagDistribution.get('even')).toBe(1);
    expect(report.tagDistribution.get('neg')).toBe(1);
    expect(report.tagDistribution.get('zero')).toBe(1);
  });

  it('runWithCoverage on empty suite returns zeros', async () => {
    const empty = makeSuite<number>('empty', []);
    const report = await runWithCoverage(empty, async () => true);
    expect(report.totalCases).toBe(0);
    expect(report.passing).toBe(0);
    expect(report.failing).toBe(0);
    expect(report.errored).toBe(0);
    expect(report.tagDistribution.size).toBe(0);
  });
});

describe('test-harness snapshot', () => {
  it('snapshotHash is deterministic across key order', () => {
    const h1 = snapshotHash({ a: 1, b: 2 }, { x: [1, 2, 3] });
    const h2 = snapshotHash({ b: 2, a: 1 }, { x: [1, 2, 3] });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('takeSnapshot returns a stable hash and stores input/output', () => {
    const snap = takeSnapshot({ q: 'hola' }, { ok: true, n: 7 });
    expect(snap.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(snap.input).toEqual({ q: 'hola' });
    expect(snap.output).toEqual({ ok: true, n: 7 });
    const again = takeSnapshot({ q: 'hola' }, { ok: true, n: 7 });
    expect(again.hash).toBe(snap.hash);
  });

  it('compareSnapshot detects matches and diffs', () => {
    const snap = takeSnapshot({ name: 'p' }, { score: 10 });
    expect(compareSnapshot(snap, { score: 10 })).toEqual({ match: true });
    const cmp = compareSnapshot(snap, { score: 11 });
    expect(cmp.match).toBe(false);
    expect(cmp.diff).toBeDefined();
    expect(cmp.diff).toContain('10');
    expect(cmp.diff).toContain('11');
  });
});

describe('test-harness mutation', () => {
  it('mutateNumber produces 5 mutations', () => {
    expect(mutateNumber(3)).toEqual([4, 2, 0, -3, 6]);
    expect(mutateNumber(0)).toEqual([1, -1, 0, -0, 0]);
  });

  it('mutateBoolean flips the value', () => {
    expect(mutateBoolean(true)).toEqual([false]);
    expect(mutateBoolean(false)).toEqual([true]);
  });

  it('mutateString produces multiple distinct variants', () => {
    const variants = mutateString('Hello');
    expect(variants.length).toBeGreaterThanOrEqual(4);
    expect(variants).toContain('');
    expect(variants).toContain('Hello ');
    // empty input also yields variants
    const empties = mutateString('');
    expect(empties.length).toBeGreaterThanOrEqual(4);
    expect(empties).toContain('');
  });
});

describe('test-harness end-to-end', () => {
  it('crossProduct + runWithCoverage works on a logical-profile-style scenario', async () => {
    const profiles = makeSuite<string>('profiles', [
      { name: 'classical', input: 'classical', tags: ['profile'] },
      { name: 'intuitionistic', input: 'intuitionistic', tags: ['profile'] },
      { name: 'paraconsistent', input: 'paraconsistent', tags: ['profile'] }
    ]);
    const formulas = makeSuite<string>('formulas', [
      { name: 'p∧¬p', input: 'contradiction', tags: ['formula'] },
      { name: 'p∨¬p', input: 'tautology', tags: ['formula'] }
    ]);
    const matrix = crossProduct(profiles, formulas, { combine: 'cartesian' });
    expect(matrix.cases).toHaveLength(6);

    const report = await runWithCoverage(matrix, async (c) => {
      // simulate invariant: every profile evaluates p∨¬p as truthy except paraconsistent contradictions
      return c.input.b === 'tautology';
    });
    expect(report.totalCases).toBe(6);
    expect(report.passing).toBe(3);
    expect(report.failing).toBe(3);
    expect(report.errored).toBe(0);
    expect(report.tagDistribution.get('profile')).toBe(6);
    expect(report.tagDistribution.get('formula')).toBe(6);
  });
});
