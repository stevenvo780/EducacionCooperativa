'use client';

import { WifiOff, Wifi, RefreshCw, AlertTriangle, Check, CloudOff, Loader2, GitMerge } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface OfflineSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
  conflictCount?: number;
  lastSyncAt: number | null;
}

interface Props {
  syncStatus?: OfflineSyncStatus;
  onRetryFailed?: () => void;
  onSyncNow?: () => void;
  onResolveConflicts?: () => void;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10) return 'ahora mismo';
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

export default function OfflineIndicator({ syncStatus, onRetryFailed, onSyncNow, onResolveConflicts }: Props) {
  const isOnline = syncStatus?.isOnline ?? true;
  const isSyncing = syncStatus?.isSyncing ?? false;
  const pendingCount = syncStatus?.pendingCount ?? 0;
  const failedCount = syncStatus?.failedCount ?? 0;
  const conflictCount = syncStatus?.conflictCount ?? 0;
  const lastSyncAt = syncStatus?.lastSyncAt ?? null;

  const [expanded, setExpanded] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSyncLabel, setLastSyncLabel] = useState<string>('');

  // Update "time ago" label
  useEffect(() => {
    if (!lastSyncAt) return;
    const update = () => setLastSyncLabel(timeAgo(lastSyncAt));
    update();
    const interval = setInterval(update, 10_000);
    return () => clearInterval(interval);
  }, [lastSyncAt]);

  // Flash success when syncing completes
  useEffect(() => {
    if (!isSyncing && lastSyncAt && pendingCount === 0 && failedCount === 0) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, lastSyncAt, pendingCount, failedCount]);

  // Nothing to show — all is well and online
  const hasActivity = !isOnline || isSyncing || pendingCount > 0 || failedCount > 0 || conflictCount > 0 || showSuccess;
  if (!hasActivity) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Expanded detail panel */}
      {expanded && (
        <div className="bg-surface-800 border border-surface-600 rounded-lg shadow-xl p-3 min-w-[240px] text-sm text-surface-200">
          {/* Connection status */}
          <div className="flex items-center gap-2 mb-2">
            {isOnline ? (
              <><Wifi className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400">Conectado</span></>
            ) : (
              <><WifiOff className="w-4 h-4 text-red-400" /><span className="text-red-400">Sin conexión</span></>
            )}
          </div>

          {/* Pending changes */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <CloudOff className="w-3.5 h-3.5" />
              <span>{pendingCount} cambio{pendingCount !== 1 ? 's' : ''} pendiente{pendingCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Failed items */}
          {failedCount > 0 && (
            <div className="flex items-center justify-between gap-2 text-red-400 mb-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{failedCount} fallido{failedCount !== 1 ? 's' : ''}</span>
              </div>
              {onRetryFailed && (
                <button
                  onClick={onRetryFailed}
                  className="text-xs px-2 py-0.5 bg-red-600/20 hover:bg-red-600/30 rounded transition"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {/* Conflicts */}
          {conflictCount > 0 && (
            <div className="flex items-center justify-between gap-2 text-amber-300 mb-1">
              <div className="flex items-center gap-2">
                <GitMerge className="w-3.5 h-3.5" />
                <span>{conflictCount} conflicto{conflictCount !== 1 ? 's' : ''}</span>
              </div>
              {onResolveConflicts && (
                <button
                  onClick={onResolveConflicts}
                  className="text-xs px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 rounded transition"
                >
                  Resolver
                </button>
              )}
            </div>
          )}

          {/* Sync status */}
          {isSyncing && (
            <div className="flex items-center gap-2 text-sky-400 mb-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sincronizando...</span>
            </div>
          )}

          {/* Last sync */}
          {lastSyncLabel && !isSyncing && (
            <div className="text-xs text-surface-500 mt-2">
              Última sincronización: {lastSyncLabel}
            </div>
          )}

          {/* Manual sync button */}
          {isOnline && pendingCount > 0 && !isSyncing && onSyncNow && (
            <button
              onClick={onSyncNow}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 rounded transition"
            >
              <RefreshCw className="w-3 h-3" /> Sincronizar ahora
            </button>
          )}
        </div>
      )}

      {/* Main pill */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all duration-300 text-sm font-medium ${
          showSuccess
            ? 'bg-emerald-600 text-white'
            : isSyncing
            ? 'bg-sky-600 text-white'
            : !isOnline
            ? 'bg-red-600 text-white'
            : failedCount > 0
            ? 'bg-red-600 text-white'
            : pendingCount > 0
            ? 'bg-amber-600 text-white'
            : 'bg-surface-700 text-surface-200'
        }`}
      >
        {showSuccess ? (
          <><Check className="w-4 h-4" /><span>Sincronizado</span></>
        ) : isSyncing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /><span>Sincronizando…</span></>
        ) : !isOnline ? (
          <><WifiOff className="w-4 h-4" /><span>Offline</span>{pendingCount > 0 && <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{pendingCount}</span>}</>
        ) : conflictCount > 0 ? (
          <><GitMerge className="w-4 h-4" /><span>{conflictCount} conflicto{conflictCount !== 1 ? 's' : ''}</span></>
        ) : failedCount > 0 ? (
          <><AlertTriangle className="w-4 h-4" /><span>{failedCount} fallido{failedCount !== 1 ? 's' : ''}</span></>
        ) : pendingCount > 0 ? (
          <><CloudOff className="w-4 h-4" /><span>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span></>
        ) : null}
      </button>
    </div>
  );
}
