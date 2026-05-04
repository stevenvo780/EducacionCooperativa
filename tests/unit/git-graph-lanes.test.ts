import { describe, it, expect } from 'vitest';
import { computeLanes, type LaneCommit } from '@/components/dashboard/git/lane-utils';

describe('computeLanes', () => {
  it('historia lineal: todos en lane 0', () => {
    const commits: LaneCommit[] = [
      { sha: 'c', parents: ['b'] },
      { sha: 'b', parents: ['a'] },
      { sha: 'a', parents: [] }
    ];
    const { laneBySha, width } = computeLanes(commits);
    expect(laneBySha.get('c')).toBe(0);
    expect(laneBySha.get('b')).toBe(0);
    expect(laneBySha.get('a')).toBe(0);
    expect(width).toBe(1);
  });

  it('merge: dos parents → 2 lanes', () => {
    const commits: LaneCommit[] = [
      { sha: 'm', parents: ['a', 'b'] },
      { sha: 'a', parents: ['root'] },
      { sha: 'b', parents: ['root'] },
      { sha: 'root', parents: [] }
    ];
    const { laneBySha, width } = computeLanes(commits);
    expect(width).toBeGreaterThanOrEqual(2);
    expect(laneBySha.get('m')).toBeDefined();
    expect(laneBySha.get('a')).toBeDefined();
    expect(laneBySha.get('b')).toBeDefined();
  });

  it('parent principal hereda lane', () => {
    const commits: LaneCommit[] = [
      { sha: 'tip', parents: ['mid'] },
      { sha: 'mid', parents: ['root'] },
      { sha: 'root', parents: [] }
    ];
    const { laneBySha } = computeLanes(commits);
    expect(laneBySha.get('tip')).toBe(laneBySha.get('mid'));
    expect(laneBySha.get('mid')).toBe(laneBySha.get('root'));
  });

  it('vacio retorna estructuras vacias', () => {
    const { laneBySha, width } = computeLanes([]);
    expect(laneBySha.size).toBe(0);
    expect(width).toBe(1);
  });
});
