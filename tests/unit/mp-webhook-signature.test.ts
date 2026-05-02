/**
 * Tests para la firma HMAC del webhook MercadoPago. NO importa la ruta
 * (depende de Next + Firebase) — testea la lógica de verificación pura.
 *
 * Replica el algoritmo: manifest = `id:<dataId>;request-id:<requestId>;ts:<ts>;`
 * firmado con HMAC-SHA256, header `x-signature: ts=<ts>,v1=<hex>`.
 */
import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';

const buildSig = (secret: string, dataId: string, requestId: string, ts: string): string => {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return crypto.createHmac('sha256', secret).update(manifest).digest('hex');
};

const verify = (secret: string, dataId: string, requestId: string, sigHeader: string): boolean => {
  if (!secret) return false;
  if (!sigHeader || !requestId || !dataId) return false;
  const parts = Object.fromEntries(
    sigHeader.split(',').map((p) => p.trim().split('=', 2) as [string, string])
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch { return false; }
};

describe('MercadoPago webhook signature', () => {
  const secret = 'webhook-secret-for-tests';
  const dataId = '12345';
  const requestId = 'req-abc';
  const ts = '1700000000';

  it('acepta firma válida', () => {
    const v1 = buildSig(secret, dataId, requestId, ts);
    expect(verify(secret, dataId, requestId, `ts=${ts},v1=${v1}`)).toBe(true);
  });

  it('rechaza firma con dataId distinto', () => {
    const v1 = buildSig(secret, dataId, requestId, ts);
    expect(verify(secret, '99999', requestId, `ts=${ts},v1=${v1}`)).toBe(false);
  });

  it('rechaza firma con requestId distinto', () => {
    const v1 = buildSig(secret, dataId, requestId, ts);
    expect(verify(secret, dataId, 'req-other', `ts=${ts},v1=${v1}`)).toBe(false);
  });

  it('rechaza firma con secret distinto', () => {
    const v1 = buildSig('other-secret', dataId, requestId, ts);
    expect(verify(secret, dataId, requestId, `ts=${ts},v1=${v1}`)).toBe(false);
  });

  it('rechaza header sin v1', () => {
    expect(verify(secret, dataId, requestId, `ts=${ts}`)).toBe(false);
  });

  it('rechaza header sin ts', () => {
    const v1 = buildSig(secret, dataId, requestId, ts);
    expect(verify(secret, dataId, requestId, `v1=${v1}`)).toBe(false);
  });

  it('rechaza dataId vacío (regresión: no se debe firmar webhook sin payment id)', () => {
    const v1 = buildSig(secret, '', requestId, ts);
    expect(verify(secret, '', requestId, `ts=${ts},v1=${v1}`)).toBe(false);
  });

  it('rechaza requestId vacío', () => {
    const v1 = buildSig(secret, dataId, '', ts);
    expect(verify(secret, dataId, '', `ts=${ts},v1=${v1}`)).toBe(false);
  });

  it('rechaza secret vacío (modo permisivo SOLO en dev — aquí simulamos prod)', () => {
    const v1 = buildSig('', dataId, requestId, ts);
    expect(verify('', dataId, requestId, `ts=${ts},v1=${v1}`)).toBe(false);
  });

  it('rechaza v1 con bytes inválidos sin throw', () => {
    expect(verify(secret, dataId, requestId, `ts=${ts},v1=zzzz`)).toBe(false);
  });

  it('timingSafeEqual: misma longitud, contenido distinto → false sin throw', () => {
    const v1 = buildSig(secret, dataId, requestId, ts);
    const tampered = v1.replace(/^./, (c) => (c === 'a' ? 'b' : 'a'));
    expect(verify(secret, dataId, requestId, `ts=${ts},v1=${tampered}`)).toBe(false);
  });
});
