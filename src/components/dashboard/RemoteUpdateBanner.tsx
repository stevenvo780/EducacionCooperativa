'use client';

import React from 'react';
import { DownloadCloud, X } from 'lucide-react';

interface RemoteUpdateBannerProps {
  visible: boolean;
  /** Nombre legible (opcional) del doc afectado. */
  docName?: string;
  /** Callback para recargar el contenido descartando ediciones locales no guardadas. */
  onReload: () => void;
  /** Callback para descartar el aviso (mantiene el contenido local). */
  onDismiss: () => void;
}

/**
 * Banner discreto sobre el editor cuando otro usuario modifica el doc abierto
 * mientras lo estás editando. Se muestra solo si hay cambios locales sin
 * guardar; si no, el caller puede aplicar el remoto silenciosamente.
 */
export default function RemoteUpdateBanner({
  visible,
  docName,
  onReload,
  onDismiss
}: RemoteUpdateBannerProps) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-amber-700/50 bg-amber-950/40 px-4 py-2 text-xs text-amber-200"
    >
      <DownloadCloud className="h-4 w-4 shrink-0 text-amber-300" />
      <span className="flex-1 truncate">
        {docName ? `"${docName}"` : 'Este documento'} fue actualizado por otra persona.
      </span>
      <button
        type="button"
        onClick={onReload}
        className="rounded border border-amber-700/50 bg-amber-900/30 px-2.5 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-800/50"
      >
        Recargar
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Descartar aviso"
        className="rounded p-1 text-amber-300 hover:bg-amber-900/30 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
