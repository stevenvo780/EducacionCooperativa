'use client';

import { Loader2, ShieldAlert } from 'lucide-react';
import type { AgentPendingConfirmation } from '@/lib/agora-ai/types';

interface InlineConfirmationProps {
  pending: AgentPendingConfirmation;
  busy?: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

export function InlineConfirmation({ pending, busy = false, onConfirm, onReject }: InlineConfirmationProps) {
  return (
    <div className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/10 p-2.5 text-xs text-amber-100">
      <div className="flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-300" />
        <div className="flex-1 space-y-2">
          <p className="leading-relaxed">{pending.prompt}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="px-2.5 py-1 rounded bg-amber-400 text-surface-950 font-medium hover:bg-amber-300 disabled:opacity-60 inline-flex items-center gap-1"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Confirmar
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={busy}
              className="px-2.5 py-1 rounded border border-amber-300/30 hover:bg-amber-500/10 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
