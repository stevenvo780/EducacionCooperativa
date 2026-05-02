/**
 * Tests para los módulos del daemon agora-host-sync. Cada regla cubre
 * casos del git log:
 *  - .syncignore con node_modules/ NO se debe imponer al user
 *    (CLAUDE.md §8: defaults agresivos están prohibidos)
 *  - .syncignore y .gitignore mismos NUNCA se ignoran
 *  - .git/ siempre HARD_SKIP (en ambas direcciones)
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — módulo .mjs sin tsconfig propio, vitest lo resuelve.
import { compileIgnore, matchIgnore, isHardSkipped, isWorkspacePathIgnored, BUILTIN_IGNORE_RULES } from '../../services/worker-host-sync/ignore.mjs';

describe('compileIgnore + matchIgnore', () => {
  it('compila glob simple', () => {
    const rules = compileIgnore('*.tmp');
    expect(matchIgnore(rules, 'foo.tmp')).toBe(true);
    expect(matchIgnore(rules, 'foo.txt')).toBe(false);
  });

  it('respeta negación con !', () => {
    const rules = compileIgnore('*.log\n!keepme.log');
    expect(matchIgnore(rules, 'random.log')).toBe(true);
    expect(matchIgnore(rules, 'keepme.log')).toBe(false);
  });

  it('ignora comentarios y blancos', () => {
    const rules = compileIgnore('# comment\n\n  *.bak\n');
    expect(rules.length).toBe(1);
    expect(matchIgnore(rules, 'a.bak')).toBe(true);
  });

  it('directorio sólo → trailing slash', () => {
    const rules = compileIgnore('build/');
    expect(matchIgnore(rules, 'build/out.js')).toBe(true);
  });
});

describe('BUILTIN_IGNORE_RULES', () => {
  it('cubre vim swap files', () => {
    expect(matchIgnore(BUILTIN_IGNORE_RULES, '.foo.swp')).toBe(true);
    expect(matchIgnore(BUILTIN_IGNORE_RULES, 'bar.swo')).toBe(true);
  });
  it('cubre LibreOffice lockfiles', () => {
    expect(matchIgnore(BUILTIN_IGNORE_RULES, '.~lock.docx#')).toBe(true);
  });
  it('cubre macOS/Windows turds', () => {
    expect(matchIgnore(BUILTIN_IGNORE_RULES, '.DS_Store')).toBe(true);
    expect(matchIgnore(BUILTIN_IGNORE_RULES, 'sub/dir/Thumbs.db')).toBe(true);
  });
  it('NO incluye node_modules/ — el user decide (CLAUDE.md §8)', () => {
    expect(matchIgnore(BUILTIN_IGNORE_RULES, 'node_modules/foo.js')).toBe(false);
  });
});

describe('isHardSkipped', () => {
  it('skip .git/ y subdirs', () => {
    expect(isHardSkipped('.git')).toBe(true);
    expect(isHardSkipped('.git/HEAD')).toBe(true);
    expect(isHardSkipped('.git/refs/heads/main')).toBe(true);
  });
  it('skip repos/', () => {
    expect(isHardSkipped('repos/foo')).toBe(true);
  });
  it('skip metadata interna', () => {
    expect(isHardSkipped('.agora-host-sync.json')).toBe(true);
    expect(isHardSkipped('.st-guide.md')).toBe(true);
  });
  it('NO skip .gitignore (es archivo, no dir)', () => {
    expect(isHardSkipped('.gitignore')).toBe(false);
  });
  it('NO skip .gitattributes', () => {
    expect(isHardSkipped('.gitattributes')).toBe(false);
  });
  it('rechaza vacío', () => {
    expect(isHardSkipped('')).toBe(false);
  });
});

describe('isWorkspacePathIgnored', () => {
  it('.syncignore se sincroniza siempre', () => {
    const rules = compileIgnore('.syncignore');
    expect(matchIgnore(rules, '.syncignore')).toBe(true); // matchIgnore raw
    expect(isWorkspacePathIgnored(rules, '.syncignore')).toBe(false); // pero el wrapper lo protege
  });

  it('.gitignore se sincroniza siempre', () => {
    const rules = compileIgnore('.gitignore');
    expect(isWorkspacePathIgnored(rules, '.gitignore')).toBe(false);
  });

  it('respeta reglas para otros archivos', () => {
    const rules = compileIgnore('*.tmp');
    expect(isWorkspacePathIgnored(rules, 'foo.tmp')).toBe(true);
    expect(isWorkspacePathIgnored(rules, 'foo.txt')).toBe(false);
  });
});
