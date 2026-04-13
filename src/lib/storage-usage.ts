import { adminDb, adminStorage } from '@/lib/firebase-admin';

const collectOwnedStoragePaths = async (uid: string): Promise<string[]> => {
  const snapshot = await adminDb
    .collection('documents')
    .where('ownerId', '==', uid)
    .select('storagePath', 'sourceStoragePath')
    .get();

  const uniquePaths = new Set<string>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data() as { storagePath?: unknown; sourceStoragePath?: unknown };
    if (typeof data.storagePath === 'string' && data.storagePath.trim()) {
      uniquePaths.add(data.storagePath.trim());
    }
    if (typeof data.sourceStoragePath === 'string' && data.sourceStoragePath.trim()) {
      uniquePaths.add(data.sourceStoragePath.trim());
    }
  });

  return Array.from(uniquePaths);
};

// In-memory cache for storage usage — avoids N+1 reads per check
const _usageCache = new Map<string, { bytes: number; ts: number }>();
const USAGE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export const calculateOwnedStorageUsageBytes = async (uid: string): Promise<number> => {
  const cached = _usageCache.get(uid);
  if (cached && Date.now() - cached.ts < USAGE_CACHE_TTL_MS) {
    return cached.bytes;
  }

  const bucket = adminStorage.bucket();
  if (!bucket?.name) {
    throw new Error('Storage bucket not configured');
  }

  const storagePaths = await collectOwnedStoragePaths(uid);
  let totalBytes = 0;

  // Process in parallel batches of 10 to reduce wall-clock time
  const BATCH_SIZE = 10;
  for (let i = 0; i < storagePaths.length; i += BATCH_SIZE) {
    const batch = storagePaths.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (sp) => {
        const [metadata] = await bucket.file(sp).getMetadata();
        return parseInt(String(metadata.size || '0'), 10) || 0;
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') totalBytes += r.value;
    }
  }

  _usageCache.set(uid, { bytes: totalBytes, ts: Date.now() });
  return totalBytes;
};

/** Invalidate cached storage usage after upload/delete. */
export const invalidateStorageUsageCache = (uid: string) => {
  _usageCache.delete(uid);
};
