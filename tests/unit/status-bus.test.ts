import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerStatusSegment,
  unregisterStatusSegment,
  forceUnregisterStatusSegment,
  subscribeStatus,
  getStatusSegments,
  type StatusSegment
} from '@/lib/status-bus';

const make = (id: string, overrides: Partial<StatusSegment> = {}): StatusSegment => ({
  id,
  label: id,
  ...overrides
});

describe('status-bus', () => {
  beforeEach(() => {
    getStatusSegments().forEach((s) => forceUnregisterStatusSegment(s.id));
  });

  it('registerStatusSegment agrega un segmento', () => {
    registerStatusSegment(make('words'));
    expect(getStatusSegments()).toHaveLength(1);
  });

  it('upsert por id', () => {
    registerStatusSegment(make('words', { label: '100 palabras' }));
    registerStatusSegment(make('words', { label: '200 palabras' }));
    expect(getStatusSegments()).toHaveLength(1);
    expect(getStatusSegments()[0].label).toBe('200 palabras');
  });

  it('unregister respeta sticky', () => {
    registerStatusSegment(make('a', { sticky: true }));
    unregisterStatusSegment('a');
    expect(getStatusSegments()).toHaveLength(1);
    forceUnregisterStatusSegment('a');
    expect(getStatusSegments()).toHaveLength(0);
  });

  it('orden: left antes que right, priority asc dentro de cada slot', () => {
    registerStatusSegment(make('r2', { slot: 'right', priority: 20 }));
    registerStatusSegment(make('l1', { slot: 'left', priority: 10 }));
    registerStatusSegment(make('r1', { slot: 'right', priority: 10 }));
    registerStatusSegment(make('l2', { slot: 'left', priority: 20 }));
    const ids = getStatusSegments().map((s) => s.id);
    expect(ids).toEqual(['l1', 'l2', 'r1', 'r2']);
  });

  it('subscribe emite snapshot inicial y en cada cambio', () => {
    const snaps: StatusSegment[][] = [];
    const un = subscribeStatus((s) => snaps.push(s));
    expect(snaps).toHaveLength(1);
    registerStatusSegment(make('a'));
    expect(snaps).toHaveLength(2);
    un();
    registerStatusSegment(make('b'));
    expect(snaps).toHaveLength(2);
  });

  it('listener que falla no rompe a otros', () => {
    const ok: StatusSegment[][] = [];
    const un1 = subscribeStatus(() => { throw new Error('boom'); });
    const un2 = subscribeStatus((s) => ok.push(s));
    registerStatusSegment(make('a'));
    expect(ok.length).toBeGreaterThan(0);
    un1(); un2();
  });
});
