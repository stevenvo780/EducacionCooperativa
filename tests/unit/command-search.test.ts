import { describe, it, expect } from 'vitest';
import { scoreCommand, rankCommands } from '@/lib/command-search';

describe('scoreCommand', () => {
  it('query vacía da score = 1 a todo', () => {
    expect(scoreCommand({ label: 'a' }, '')).toBe(1);
    expect(scoreCommand({ label: 'b', category: 'C' }, '')).toBe(1);
  });

  it('match exacto en label da score alto', () => {
    const a = scoreCommand({ label: 'Nuevo archivo' }, 'nuevo');
    const b = scoreCommand({ label: 'Cerrar pestaña' }, 'nuevo');
    expect(a).toBeGreaterThan(b);
  });

  it('prefix en label gana sobre match en medio', () => {
    const prefix = scoreCommand({ label: 'Nuevo archivo' }, 'nuevo');
    const middle = scoreCommand({ label: 'Crear nuevo archivo' }, 'nuevo');
    expect(prefix).toBeGreaterThan(middle);
  });

  it('subsequence match da score bajo pero positivo', () => {
    const s = scoreCommand({ label: 'Nuevo archivo' }, 'nv');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(100);
  });

  it('sin match devuelve 0', () => {
    expect(scoreCommand({ label: 'Nuevo archivo' }, 'xyz123')).toBe(0);
  });

  it('busca también en keywords y category', () => {
    const cmd = { label: 'Tablero', category: 'Herramientas', keywords: ['kanban', 'tareas'] };
    expect(scoreCommand(cmd, 'kanban')).toBeGreaterThan(0);
    expect(scoreCommand(cmd, 'herramient')).toBeGreaterThan(0);
  });

  it('case insensitive', () => {
    const a = scoreCommand({ label: 'Nuevo Archivo' }, 'nuevo');
    const b = scoreCommand({ label: 'Nuevo Archivo' }, 'NUEVO');
    expect(a).toBe(b);
  });

  it('insensible a acentos', () => {
    const cmd = { label: 'Búsqueda Semántica' };
    expect(scoreCommand(cmd, 'busqueda')).toBeGreaterThan(0);
    expect(scoreCommand(cmd, 'semantica')).toBeGreaterThan(0);
  });
});

describe('rankCommands', () => {
  const commands = [
    { label: 'Nuevo archivo', category: 'Archivos' },
    { label: 'Buscar archivos', category: 'Archivos' },
    { label: 'Cerrar pestaña', category: 'Pestañas' },
    { label: 'Modo Zen', category: 'Vista' }
  ];

  it('devuelve solo los que matchean', () => {
    const r = rankCommands(commands, 'archiv');
    expect(r).toHaveLength(2);
    expect(r.map((c) => c.label)).toContain('Nuevo archivo');
    expect(r.map((c) => c.label)).toContain('Buscar archivos');
  });

  it('ordena por relevancia (prefix gana)', () => {
    const r = rankCommands(commands, 'modo');
    expect(r[0].label).toBe('Modo Zen');
  });

  it('query vacía mantiene orden de entrada', () => {
    const r = rankCommands(commands, '');
    expect(r.map((c) => c.label)).toEqual(commands.map((c) => c.label));
  });
});
