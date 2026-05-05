'use client';

import { useSyncExternalStore } from 'react';
import { Settings2, Loader2 } from 'lucide-react';
import { MarkdownLinterRegistry } from '@/lib/markdown-linter/registry';
import type { LinterStatus } from '@/hooks/useMarkdownLinter';
import { dispatchOpenSettings } from '@/lib/settings-events';

function subscribe(cb: () => void): () => void {
  return MarkdownLinterRegistry.subscribe(cb);
}
function getEnabledCount(): string {
  return `${MarkdownLinterRegistry.getEnabledCount()}/${MarkdownLinterRegistry.getTotalCount()}`;
}

interface LinterConfigPanelProps {
  linterStatus?: LinterStatus;
}

export function LinterConfigPanel({ linterStatus = 'ready' }: LinterConfigPanelProps) {
  const countLabel = useSyncExternalStore(subscribe, getEnabledCount, getEnabledCount);
  const isLoading = linterStatus === 'initializing';
  const isLinting = linterStatus === 'linting';

  return (
    <button
      type="button"
      onClick={() => dispatchOpenSettings('linter')}
      className={`relative flex items-center gap-1.5 overflow-hidden rounded-md px-2 py-1 text-[11px] transition-colors ${
        isLoading
          ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25'
          : isLinting
            ? 'text-blue-400 hover:bg-slate-800'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
      title={isLoading ? 'Inicializando linter…' : isLinting ? 'Analizando…' : `Reglas markdown activas: ${countLabel}. Click para abrir Configuración > Linter Markdown`}
      aria-label="Abrir configuración del linter Markdown"
    >
      {isLoading && (
        <span className="absolute bottom-0 left-0 h-[2px] w-full">
          <span className="block h-full w-1/2 rounded-full bg-blue-400/70 animate-slideRight" />
        </span>
      )}
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
      ) : isLinting ? (
        <Settings2 className="w-3.5 h-3.5 animate-pulse text-blue-400" />
      ) : (
        <Settings2 className="w-3.5 h-3.5" />
      )}
      <span>
        {isLoading ? (
          <span className="font-medium text-blue-300">Cargando linter…</span>
        ) : isLinting ? (
          <span className="text-blue-400">Analizando…</span>
        ) : (
          <>Reglas {countLabel}</>
        )}
      </span>
    </button>
  );
}
