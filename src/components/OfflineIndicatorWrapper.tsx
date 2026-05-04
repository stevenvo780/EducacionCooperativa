'use client';

import { useState } from 'react';
import OfflineIndicator from '@/components/OfflineIndicator';
import ConflictResolutionModal from '@/components/dashboard/ConflictResolutionModal';
import { useOfflineSync } from '@/hooks/useOfflineSync';

/**
 * Client wrapper que conecta OfflineIndicator + ConflictResolutionModal con
 * el hook `useOfflineSync`. Vive en layout.tsx (server component) como puente.
 */
export default function OfflineIndicatorWrapper() {
  const {
    isOnline, isSyncing, pendingCount, failedCount, conflictCount, conflicts,
    lastSyncAt, syncNow, retryFailed, keepLocalConflict, acceptServerConflict
  } = useOfflineSync();
  const [showConflicts, setShowConflicts] = useState(false);

  return (
    <>
      <OfflineIndicator
        syncStatus={{ isOnline, isSyncing, pendingCount, failedCount, conflictCount, lastSyncAt }}
        onSyncNow={syncNow}
        onRetryFailed={retryFailed}
        onResolveConflicts={() => setShowConflicts(true)}
      />
      <ConflictResolutionModal
        open={showConflicts && conflicts.length > 0}
        conflicts={conflicts}
        onClose={() => setShowConflicts(false)}
        onKeepLocal={async (item) => {
          await keepLocalConflict(item);
          if (conflicts.length <= 1) setShowConflicts(false);
        }}
        onAcceptServer={async (item) => {
          await acceptServerConflict(item);
          if (conflicts.length <= 1) setShowConflicts(false);
        }}
      />
    </>
  );
}
