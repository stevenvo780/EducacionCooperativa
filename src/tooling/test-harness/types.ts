export interface TestCase<T> {
  name: string;
  input: T;
  expected?: unknown;
  tags?: string[];
}

export interface TestSuite<T> {
  name: string;
  cases: TestCase<T>[];
}

export type CombineMode = 'union' | 'intersect' | 'cartesian';

export interface CrossProductOptions {
  combine: CombineMode;
  filterTags?: string[];
}

export interface CoverageReport {
  totalCases: number;
  passing: number;
  failing: number;
  errored: number;
  tagDistribution: Map<string, number>;
}

export interface Snapshot {
  input: unknown;
  output: unknown;
  hash: string;
}

export interface SnapshotComparison {
  match: boolean;
  diff?: string;
}
