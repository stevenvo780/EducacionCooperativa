import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerChannel,
  unregisterChannel,
  forceUnregisterChannel,
  subscribeChannels,
  getChannels,
  getChannel,
  type OutputChannel
} from '@/lib/output-channels';

const make = (id: string, overrides: Partial<OutputChannel> = {}): OutputChannel => ({
  id,
  label: id,
  render: () => null,
  ...overrides
});

describe('output-channels registry', () => {
  beforeEach(() => {
    getChannels().forEach((c) => forceUnregisterChannel(c.id));
  });

  it('registerChannel agrega un canal', () => {
    registerChannel(make('terminal'));
    expect(getChannels()).toHaveLength(1);
    expect(getChannel('terminal')?.id).toBe('terminal');
  });

  it('registerChannel con id existente reemplaza', () => {
    registerChannel(make('a', { label: 'v1' }));
    registerChannel(make('a', { label: 'v2' }));
    expect(getChannels()).toHaveLength(1);
    expect(getChannel('a')?.label).toBe('v2');
  });

  it('unregisterChannel quita un canal no-sticky', () => {
    registerChannel(make('a'));
    unregisterChannel('a');
    expect(getChannels()).toHaveLength(0);
  });

  it('unregisterChannel respeta sticky=true', () => {
    registerChannel(make('a', { sticky: true }));
    unregisterChannel('a');
    expect(getChannels()).toHaveLength(1);
  });

  it('forceUnregisterChannel quita aunque sea sticky', () => {
    registerChannel(make('a', { sticky: true }));
    forceUnregisterChannel('a');
    expect(getChannels()).toHaveLength(0);
  });

  it('subscribeChannels emite snapshot inicial y en cada cambio', () => {
    const snaps: OutputChannel[][] = [];
    const un = subscribeChannels((s) => snaps.push(s));
    expect(snaps).toHaveLength(1); // inicial
    registerChannel(make('a'));
    expect(snaps).toHaveLength(2);
    un();
    registerChannel(make('b'));
    expect(snaps).toHaveLength(2); // ya desuscrito
  });

  it('listeners aislados: un listener que falla no bloquea a otros', () => {
    const ok: OutputChannel[][] = [];
    const un1 = subscribeChannels(() => { throw new Error('boom'); });
    const un2 = subscribeChannels((s) => ok.push(s));
    registerChannel(make('a'));
    expect(ok.length).toBeGreaterThan(0);
    un1(); un2();
  });

  it('order ordena los canales', () => {
    registerChannel(make('z', { order: 200 }));
    registerChannel(make('a', { order: 10 }));
    registerChannel(make('m', { order: 50 }));
    const ids = getChannels().map((c) => c.id);
    expect(ids).toEqual(['a', 'm', 'z']);
  });

  it('canales sin order van al final (default 100)', () => {
    registerChannel(make('a', { order: 10 }));
    registerChannel(make('b'));
    registerChannel(make('c', { order: 200 }));
    const ids = getChannels().map((c) => c.id);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('badge se preserva al re-registrar', () => {
    registerChannel(make('a', { badge: { count: 3, tone: 'error' } }));
    expect(getChannel('a')?.badge?.count).toBe(3);
    registerChannel(make('a', { badge: { count: 10, tone: 'warning' } }));
    expect(getChannel('a')?.badge?.count).toBe(10);
    expect(getChannel('a')?.badge?.tone).toBe('warning');
  });
});
