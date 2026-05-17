import type { CoverageReport, TestCase, TestSuite } from './types';

export async function runWithCoverage<T>(
  suite: TestSuite<T>,
  runner: (c: TestCase<T>) => Promise<boolean>
): Promise<CoverageReport> {
  let passing = 0;
  let failing = 0;
  let errored = 0;
  const tagDistribution = new Map<string, number>();

  for (const c of suite.cases) {
    for (const t of c.tags ?? []) {
      tagDistribution.set(t, (tagDistribution.get(t) ?? 0) + 1);
    }
    try {
      const ok = await runner(c);
      if (ok) passing += 1;
      else failing += 1;
    } catch {
      errored += 1;
    }
  }

  return {
    totalCases: suite.cases.length,
    passing,
    failing,
    errored,
    tagDistribution
  };
}
