/**
 * Tests para HMAC del daemon. Garantizan match exacto con el verifier
 * server-side (src/lib/worker-auth.ts). Si esto se desfasa, los workers
 * empiezan a recibir 401 en silencio.
 */
import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
// @ts-expect-error — módulo .mjs sin tsconfig propio, vitest lo resuelve.
import { sign, buildAuthHeaders } from '../../services/worker-host-sync/auth.mjs';

const SECRET = 'test-secret';

describe('sign', () => {
  it('mismo input → mismo output', () => {
    const a = sign(SECRET, 'ws-1', 1700000000000, null);
    const b = sign(SECRET, 'ws-1', 1700000000000, null);
    expect(a).toBe(b);
  });

  it('userId diferente → firma diferente', () => {
    const a = sign(SECRET, 'personal:u1', 1, 'u1');
    const b = sign(SECRET, 'personal:u2', 1, 'u2');
    expect(a).not.toBe(b);
  });

  it('replica algoritmo de worker-auth.ts', () => {
    // Si esto cambia, romper el verifier del Hub.
    const ts = 1700000000000;
    const expected = crypto.createHmac('sha256', SECRET)
      .update('ws-1:1700000000000')
      .digest('hex');
    expect(sign(SECRET, 'ws-1', ts, null)).toBe(expected);
  });

  it('uid concatenado con :', () => {
    const ts = 1700000000000;
    const expected = crypto.createHmac('sha256', SECRET)
      .update('personal:u1:1700000000000:u1')
      .digest('hex');
    expect(sign(SECRET, 'personal:u1', ts, 'u1')).toBe(expected);
  });
});

describe('buildAuthHeaders', () => {
  it('shared workspace → sin X-Worker-Uid', () => {
    const h = buildAuthHeaders(SECRET, 'ws-1');
    expect(h['X-Worker-Token']).toBe('ws-1');
    expect(h['X-Worker-Uid']).toBeUndefined();
    expect(h['X-Worker-Sig']).toMatch(/^[0-9a-f]+$/);
  });

  it('personal:<uid> embebido extrae uid', () => {
    const h = buildAuthHeaders(SECRET, 'personal:u42');
    expect(h['X-Worker-Uid']).toBe('u42');
  });

  it('userId explícito gana sobre token', () => {
    const h = buildAuthHeaders(SECRET, 'personal:u1', 'u-explicit');
    expect(h['X-Worker-Uid']).toBe('u-explicit');
  });

  it('ts es numérico y string-coerced', () => {
    const h = buildAuthHeaders(SECRET, 'ws-1');
    expect(typeof h['X-Worker-Ts']).toBe('string');
    expect(Number.parseInt(h['X-Worker-Ts'], 10)).toBeGreaterThan(0);
  });
});
