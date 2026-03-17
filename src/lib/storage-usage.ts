import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { getErrorMessage } from '@/lib/error-utils';

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

export const calculateOwnedStorageUsageBytes = async (uid: string): Promise<number> => {
  const bucket = adminStorage.bucket();
  if (!bucket?.name) {
    throw new Error('Storage bucket not configured');
  }

  const storagePaths = await collectOwnedStoragePaths(uid);
  let totalBytes = 0;

  for (const storagePath of storagePaths) {
    try {
      const [metadata] = await bucket.file(storagePath).getMetadata();
      totalBytes += parseInt(String(metadata.size || '0'), 10) || 0;
    } catch (error) {
      console.warn(`Failed to read storage metadata for ${storagePath}:`, getErrorMessage(error));
    }
  }

  return totalBytes;
};
