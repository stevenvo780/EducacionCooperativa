import { describe, it, expect } from 'vitest';
import { parsePatchToHunks } from '@/components/dashboard/git/diff-utils';

const PATCH = `diff --git a/foo.ts b/foo.ts
index abc..def 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1,4 +1,4 @@
 una
-vieja
+nueva
 tres
 cuatro
@@ -10,2 +10,3 @@
 diez
 once
+doce
`;

describe('parsePatchToHunks', () => {
  it('separa hunks por header @@', () => {
    const hunks = parsePatchToHunks(PATCH);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].header).toMatch(/^@@ -1,4 \+1,4 @@/);
    expect(hunks[1].header).toMatch(/^@@ -10,2 \+10,3 @@/);
  });

  it('clasifica líneas en context, addition y deletion', () => {
    const [hunk] = parsePatchToHunks(PATCH);
    const kinds = hunk.lines.map((l) => l.kind);
    expect(kinds).toContain('context');
    expect(kinds).toContain('addition');
    expect(kinds).toContain('deletion');
    const add = hunk.lines.find((l) => l.kind === 'addition');
    expect(add?.text).toBe('nueva');
    const del = hunk.lines.find((l) => l.kind === 'deletion');
    expect(del?.text).toBe('vieja');
  });

  it('asigna numeros de linea coherentes', () => {
    const [hunk] = parsePatchToHunks(PATCH);
    const ctx = hunk.lines.filter((l) => l.kind === 'context');
    expect(ctx[0].oldLineNo).toBe(1);
    expect(ctx[0].newLineNo).toBe(1);
  });

  it('vacio devuelve []', () => {
    expect(parsePatchToHunks('')).toEqual([]);
  });

  it('ignora binary files header', () => {
    const binary = `diff --git a/img.png b/img.png
Binary files a/img.png and b/img.png differ
`;
    expect(parsePatchToHunks(binary)).toEqual([]);
  });
});
