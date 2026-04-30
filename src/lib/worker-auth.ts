/**
 * Auth para workers (HMAC con WORKER_SECRET compartido).
 *
 * Los workers no son usuarios Firebase; identifican una workspace mediante
 * `WORKER_TOKEN` (= workspaceId). El secreto `WORKER_SECRET` se comparte
 * entre todos los workers del mismo host (mismo trust boundary).
 *
 * Uso:
 *   Headers:
 *     X-Worker-Token: <workspaceId>
 *     X-Worker-Ts:    <unix-ms>
 *     X-Worker-Sig:   hex(hmacSha256(WORKER_SECRET, `${token}:${ts}`))
 *
 * El hub valida que el ts esté dentro de ±5 min y la sig sea correcta.
 *
 * Modelo de seguridad: todo el host del worker es un trust boundary; el
 * `WORKER_SECRET` da acceso de lectura/escritura a *cualquier* workspace,
 * sólo restringido por el `WORKER_TOKEN` declarado. No usar para
 * identificar usuarios finales.
 */
import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

// Strip whitespace por si la env trae \n/\r al final (pasa con `echo X | vercel env add`).
const SECRET = (process.env.WORKER_SECRET ?? '').trim();
const MAX_SKEW_MS = 5 * 60 * 1000;

export interface WorkerAuthContext {
  workspaceId: string;
  ts: number;
}

export const isWorkerAuthConfigured = () => SECRET.length > 0;

export const verifyWorkerAuth = (req: NextRequest): WorkerAuthContext | null => {
  if (!SECRET) return null;
  const token = req.headers.get('x-worker-token');
  const tsStr = req.headers.get('x-worker-ts');
  const sig = req.headers.get('x-worker-sig');
  if (!token || !tsStr || !sig) return null;

  const ts = Number.parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return null;
  if (Math.abs(Date.now() - ts) > MAX_SKEW_MS) return null;

  const expected = crypto.createHmac('sha256', SECRET).update(`${token}:${ts}`).digest('hex');
  let ok = expected.length === sig.length;
  if (ok) {
    try { ok = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex')); }
    catch { ok = false; }
  }
  if (!ok) return null;

  return { workspaceId: token, ts };
};
