/**
 * Auth HMAC para workers. Los workers no son usuarios Firebase; identifican
 * una workspace vía `WORKER_TOKEN` (= workspaceId) firmado con el
 * `WORKER_SECRET` compartido del host.
 *
 * Headers:
 *   X-Worker-Token: <workspaceId>
 *   X-Worker-Ts:    <unix-ms>
 *   X-Worker-Sig:   hex(hmacSha256(WORKER_SECRET, `${token}:${ts}`))
 *
 * Validez: ±5 min de skew. El secreto cubre cualquier workspace declarada por
 * `WORKER_TOKEN`, así que el host de los workers es el trust boundary.
 */
import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

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
