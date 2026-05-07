'use client';

import { evictViewerCacheLRU } from './viewer-cache';
import { evictOldDocsCache } from './offlineStorage';

const HIGH_WATERMARK = 0.85;
const VIEWER_TARGET_RATIO = 0.7;
const DOCS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function checkQuotaAndEvict(): Promise<void> {
  if (typeof navigator === 'undefined') return;
  const storage = navigator.storage;
  if (!storage || typeof storage.estimate !== 'function') return;

  let estimate: StorageEstimate;
  try {
    estimate = await storage.estimate();
  } catch {
    return;
  }

  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  if (quota <= 0) return;
  const ratio = usage / quota;
  if (ratio <= HIGH_WATERMARK) return;

  await evictViewerCacheLRU(VIEWER_TARGET_RATIO);

  let postEstimate: StorageEstimate | null = null;
  try {
    postEstimate = await storage.estimate();
  } catch {
    postEstimate = null;
  }

  const postUsage = postEstimate?.usage ?? usage;
  const postQuota = postEstimate?.quota ?? quota;
  const postRatio = postQuota > 0 ? postUsage / postQuota : 0;
  if (postRatio > HIGH_WATERMARK) {
    await evictOldDocsCache(DOCS_MAX_AGE_MS);
  }
}

export function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; code?: unknown };
  if (typeof e.name === 'string') {
    if (e.name === 'QuotaExceededError') return true;
    if (e.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  }
  if (typeof e.code === 'number' && (e.code === 22 || e.code === 1014)) return true;
  return false;
}
