'use client';

import OfflineIndicator from '@/components/OfflineIndicator';
import { useOfflineSync } from '@/hooks/useOfflineSync';

/**
 * Client wrapper that connects OfflineIndicator to the useOfflineSync hook.
 * Used in layout.tsx (server component) to bridge the gap.
 */
export default function OfflineIndicatorWrapper() {
  const { isOnline, isSyncing, pendingCount, failedCount, lastSyncAt, syncNow, retryFailed } =
    useOfflineSync();

  return (
    <OfflineIndicator
      syncStatus={{ isOnline, isSyncing, pendingCount, failedCount, lastSyncAt }}
      onSyncNow={syncNow}
      onRetryFailed={retryFailed}
    />
  );
}
