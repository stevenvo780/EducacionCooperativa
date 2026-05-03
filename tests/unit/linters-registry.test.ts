import { describe, it, expect, beforeEach } from 'vitest';
import { LinterRegistry } from '@/lib/linters/registry';

describe('LinterRegistry', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem('agora.linters.enabled.v1'); } catch { /* ignore */ }
    }
  });

  it('registra los linters de plataforma por defecto', () => {
    const all = LinterRegistry.all().map((l) => l.id);
    expect(all).toContain('markdown');
    expect(all).toContain('st-definitions');
    expect(all).toContain('st-rules');
  });

  it('forScope filtra por extensión correctamente', () => {
    const md = LinterRegistry.forScope('md').map((l) => l.id);
    expect(md).toContain('markdown');
    expect(md).not.toContain('st-rules');

    const st = LinterRegistry.forScope('st').map((l) => l.id);
    expect(st).toContain('st-definitions');
    expect(st).toContain('st-rules');
    expect(st).not.toContain('markdown');

    expect(LinterRegistry.forScope(null)).toHaveLength(0);
    expect(LinterRegistry.forScope('json')).toHaveLength(0);
  });

  it('respeta el override de enabled y persiste', () => {
    expect(LinterRegistry.isEnabled('markdown')).toBe(true);
    LinterRegistry.setEnabled('markdown', false);
    expect(LinterRegistry.isEnabled('markdown')).toBe(false);
    LinterRegistry.setEnabled('markdown', true);
    expect(LinterRegistry.isEnabled('markdown')).toBe(true);
  });

  it('register es idempotente y permite añadir linters nuevos en runtime', () => {
    const initial = LinterRegistry.all().length;
    LinterRegistry.register({
      id: 'json-test',
      displayName: 'JSON test',
      description: 'demo',
      scope: ['json'],
      defaultEnabled: false
    });
    expect(LinterRegistry.all().length).toBe(initial + 1);
    expect(LinterRegistry.isEnabled('json-test')).toBe(false);
    LinterRegistry.register({
      id: 'json-test',
      displayName: 'JSON test v2',
      description: 'demo',
      scope: ['json'],
      defaultEnabled: false
    });
    expect(LinterRegistry.all().length).toBe(initial + 1); // upsert
    LinterRegistry.unregister('json-test');
    expect(LinterRegistry.all().length).toBe(initial);
  });

  it('subscribe notifica cambios', () => {
    let count = 0;
    const off = LinterRegistry.subscribe(() => { count++; });
    LinterRegistry.setEnabled('markdown', false);
    LinterRegistry.setEnabled('markdown', true);
    expect(count).toBeGreaterThanOrEqual(2);
    off();
    LinterRegistry.setEnabled('markdown', false);
    const stable = count;
    LinterRegistry.setEnabled('markdown', true);
    expect(count).toBe(stable);
  });
});
