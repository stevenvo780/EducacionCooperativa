'use client';

export function RightPanelSkeleton() {
  return (
    <aside
      className="relative flex h-full w-full flex-col bg-surface-900 border-l border-surface-700/60"
      aria-label="Panel Agora AI"
      aria-busy="true"
      data-shell="copilot"
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-surface-700/60 px-3">
        <div className="h-3 w-3 rounded-full bg-surface-700/70 animate-pulse" />
        <div className="h-2.5 w-24 rounded bg-surface-700/70 animate-pulse" />
      </div>
      <div className="flex-1 min-h-0 space-y-3 p-3">
        <div className="h-3 w-3/4 rounded bg-surface-800 animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-surface-800 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-surface-800 animate-pulse" />
      </div>
      <div className="border-t border-surface-700/60 p-3">
        <div className="h-9 w-full rounded bg-surface-800 animate-pulse" />
      </div>
    </aside>
  );
}

export function LeftPanelSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-surface-900" aria-busy="true">
      <div className="flex h-9 shrink-0 items-center border-b border-surface-700/60 px-3">
        <div className="h-2.5 w-20 rounded bg-surface-700/70 animate-pulse" />
      </div>
      <div className="flex-1 min-h-0 space-y-2 p-3">
        <div className="h-3 w-full rounded bg-surface-800 animate-pulse" />
        <div className="h-3 w-5/6 rounded bg-surface-800 animate-pulse" />
        <div className="h-3 w-4/6 rounded bg-surface-800 animate-pulse" />
      </div>
    </div>
  );
}

export function BottomDockSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-surface-900 border-t border-surface-700/60" aria-busy="true">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-surface-700/60 px-3">
        <div className="h-2.5 w-16 rounded bg-surface-700/70 animate-pulse" />
        <div className="h-2.5 w-12 rounded bg-surface-700/70 animate-pulse" />
        <div className="h-2.5 w-14 rounded bg-surface-700/70 animate-pulse" />
      </div>
      <div className="flex-1 min-h-0 p-3 space-y-2">
        <div className="h-3 w-2/3 rounded bg-surface-800 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-surface-800 animate-pulse" />
      </div>
    </div>
  );
}
