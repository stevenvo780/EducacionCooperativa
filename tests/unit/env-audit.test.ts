/**
 * Tests para src/lib/env.ts. Mockean process.env para verificar:
 *  - .trim() en cada lector (regresión: WORKER_SECRET con \n romper HMAC).
 *  - auditProductionEnv detecta faltantes en NODE_ENV=production.
 *  - En dev/test no falla aunque falten críticas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

const resetEnv = () => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, originalEnv);
};

const setEnv = (overrides: Record<string, string | undefined>) => {
  for (const k of Object.keys(process.env)) delete process.env[k];
  Object.assign(process.env, originalEnv);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

describe('env', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { resetEnv(); });

  it('WORKER_SECRET aplica .trim()', async () => {
    setEnv({ WORKER_SECRET: '  secret-with-spaces\n' });
    const { env } = await import('@/lib/env');
    expect(env.WORKER_SECRET()).toBe('secret-with-spaces');
  });

  it('FORGEJO_ORG default agora si vacío', async () => {
    setEnv({ FORGEJO_ORG: '' });
    const { env } = await import('@/lib/env');
    expect(env.FORGEJO_ORG()).toBe('agora');
  });

  it('FORGEJO_ORG respeta valor con espacios', async () => {
    setEnv({ FORGEJO_ORG: '   custom   ' });
    const { env } = await import('@/lib/env');
    expect(env.FORGEJO_ORG()).toBe('custom');
  });

  it('vacíos retornan ""', async () => {
    setEnv({ MERCADOPAGO_WEBHOOK_SECRET: undefined });
    const { env } = await import('@/lib/env');
    expect(env.MERCADOPAGO_WEBHOOK_SECRET()).toBe('');
  });

  it('APP_BASE_URL fallback a APP_BASE_URL si no hay NEXT_PUBLIC_APP_URL', async () => {
    setEnv({ NEXT_PUBLIC_APP_URL: undefined, APP_BASE_URL: 'https://x.test' });
    const { env } = await import('@/lib/env');
    expect(env.APP_BASE_URL()).toBe('https://x.test');
  });
});

describe('auditProductionEnv', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { resetEnv(); });

  it('en NODE_ENV=development retorna ok=true sin chequear', async () => {
    setEnv({ NODE_ENV: 'development', WORKER_SECRET: undefined });
    const { auditProductionEnv } = await import('@/lib/env');
    const r = auditProductionEnv();
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('en producción reporta faltantes', async () => {
    setEnv({
      NODE_ENV: 'production',
      WORKER_SECRET: undefined,
      CRON_SECRET: 'x',
      FORGEJO_API_URL: 'x',
      FORGEJO_ADMIN_TOKEN: 'x',
      NAS_S3_ENDPOINT: 'x',
      NAS_S3_BUCKET: 'x',
      NAS_S3_ACCESS_KEY: 'x',
      NAS_S3_SECRET_KEY: 'x',
      FIREBASE_DATABASE_URL: 'x'
    });
    const { auditProductionEnv } = await import('@/lib/env');
    const r = auditProductionEnv();
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('WORKER_SECRET');
  });

  it('warn cuando MERCADOPAGO_WEBHOOK_SECRET falta en prod', async () => {
    setEnv({
      NODE_ENV: 'production',
      WORKER_SECRET: 'x',
      CRON_SECRET: 'x',
      FORGEJO_API_URL: 'x',
      FORGEJO_ADMIN_TOKEN: 'x',
      NAS_S3_ENDPOINT: 'x',
      NAS_S3_BUCKET: 'x',
      NAS_S3_ACCESS_KEY: 'x',
      NAS_S3_SECRET_KEY: 'x',
      FIREBASE_DATABASE_URL: 'x',
      MERCADOPAGO_WEBHOOK_SECRET: undefined
    });
    const { auditProductionEnv } = await import('@/lib/env');
    const r = auditProductionEnv();
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('MERCADOPAGO_WEBHOOK_SECRET'))).toBe(true);
  });
});
