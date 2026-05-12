/**
 * GET /api/diag — proxy cacheado del health check del backend.
 *
 * El backend real vive en Cloud Run (AgoraBack). Sin este handler, el
 * rewrite de vercel.json redirige toda /api/* directo al backend, lo que
 * provocaba p95=9.37s @ 50 RPS por cold-starts serverless del probe NAS +
 * Forgejo. Este handler intercepta antes del rewrite y aplica:
 *
 *  - HTTP Cache-Control con s-maxage=60 (edge Vercel cachea 60s).
 *  - Cache in-memory module-scope con TTL 30s (warm instance).
 *  - Stale fallback: si el backend falla, sirve el último valor conocido.
 *
 * Subrutas (/api/diag/sync-test, /api/diag/inspect-doc) no son interceptadas
 * y siguen el rewrite normal hacia el backend.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/+$/, '') ||
  'https://agora-backend-578238159459.us-central1.run.app';

const TTL_MS = 30_000;
const STALE_MAX_MS = 5 * 60_000;
const UPSTREAM_TIMEOUT_MS = 8_000;

type CacheEntry = {
  body: unknown;
  status: number;
  fetchedAt: number;
};

let cached: CacheEntry | null = null;
let inFlight: Promise<CacheEntry> | null = null;

const buildResponse = (
  entry: CacheEntry,
  cacheState: 'HIT' | 'MISS' | 'STALE'
): NextResponse => {
  const response = NextResponse.json(entry.body, { status: entry.status });
  response.headers.set(
    'Cache-Control',
    'public, max-age=30, s-maxage=60, stale-while-revalidate=120'
  );
  response.headers.set('X-Cache', cacheState);
  response.headers.set('X-Cache-Age', String(Math.floor((Date.now() - entry.fetchedAt) / 1000)));
  return response;
};

const fetchUpstream = async (): Promise<CacheEntry> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${BACKEND_URL}/api/diag`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    const body = (await upstream.json().catch(() => ({
      error: 'upstream-non-json',
      status: upstream.status
    }))) as unknown;
    return { body, status: upstream.status, fetchedAt: Date.now() };
  } finally {
    clearTimeout(timer);
  }
};

export async function GET(): Promise<NextResponse> {
  const now = Date.now();

  if (cached && now - cached.fetchedAt < TTL_MS) {
    return buildResponse(cached, 'HIT');
  }

  if (!inFlight) {
    inFlight = fetchUpstream()
      .then((entry) => {
        cached = entry;
        return entry;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  try {
    const entry = await inFlight;
    return buildResponse(entry, 'MISS');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'upstream-unreachable';
    if (cached && now - cached.fetchedAt < STALE_MAX_MS) {
      console.warn('[diag] upstream-fail, sirviendo stale:', message.slice(0, 200));
      return buildResponse(cached, 'STALE');
    }
    console.error('[diag] upstream-fail sin cache disponible:', message.slice(0, 200));
    const response = NextResponse.json(
      { error: 'diag-proxy-failed', detail: message.slice(0, 200) },
      { status: 502 }
    );
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Cache', 'ERROR');
    return response;
  }
}
