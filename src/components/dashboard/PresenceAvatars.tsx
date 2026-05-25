'use client';

import React, { useState } from 'react';
import type { PresenceEntry } from '@/lib/presence';

interface PresenceAvatarsProps {
  peers: PresenceEntry[];
  /** Si se provee, las personas mirando ese doc se destacan. */
  highlightDocId?: string | null;
  /** Resolución opcional de docId → nombre legible para el tooltip. */
  resolveDocName?: (docId: string) => string | null;
  /** Máximo de avatares antes de mostrar "+N". */
  maxVisible?: number;
}

/**
 * Pila de avatares de las personas presentes en el workspace.
 * Se integra en la barra superior. Tooltip al hover muestra qué
 * está viendo cada persona.
 */
export default function PresenceAvatars({
  peers,
  highlightDocId,
  resolveDocName,
  maxVisible = 5
}: PresenceAvatarsProps) {
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  if (peers.length === 0) return null;

  const visible = peers.slice(0, maxVisible);
  const overflow = peers.length - visible.length;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((peer) => (
        <div
          key={peer.sessionId}
          className="relative"
          onMouseEnter={() => setHoveredSession(peer.sessionId)}
          onMouseLeave={() => setHoveredSession(null)}
          onFocus={() => setHoveredSession(peer.sessionId)}
          onBlur={() => setHoveredSession(null)}
        >
          <Avatar
            peer={peer}
            isViewingHighlighted={!!highlightDocId && peer.currentDocId === highlightDocId}
          />
          {hoveredSession === peer.sessionId && (
            <PresenceTooltip peer={peer} resolveDocName={resolveDocName} />
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-700 text-[10px] font-semibold text-surface-200 ring-2 ring-surface-925"
          title={`${overflow} más`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

function Avatar({ peer, isViewingHighlighted }: { peer: PresenceEntry; isViewingHighlighted: boolean }) {
  const initial = peer.displayName.trim().charAt(0).toUpperCase() || '?';
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!peer.photoURL && !photoFailed;
  return (
    <button
      type="button"
      aria-label={`${peer.displayName} está conectado`}
      className={`relative flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 transition ${
        isViewingHighlighted ? 'ring-emerald-300/80 scale-110' : 'ring-surface-925'
      }`}
      style={{ backgroundColor: peer.color }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar remoto arbitrario, optimizado por el provider
        <img
          src={peer.photoURL ?? undefined}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setPhotoFailed(true)}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        initial
      )}
      <span
        className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-surface-925"
        aria-hidden
      />
    </button>
  );
}

function PresenceTooltip({
  peer,
  resolveDocName
}: {
  peer: PresenceEntry;
  resolveDocName?: (docId: string) => string | null;
}) {
  const docLabel = peer.currentDocId
    ? resolveDocName?.(peer.currentDocId) ?? 'un documento'
    : null;
  return (
    <div
      role="tooltip"
      className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-md border border-surface-700 bg-surface-925 px-2.5 py-1.5 text-xs text-surface-200 shadow-lg"
    >
      <div className="font-medium" style={{ color: peer.color }}>{peer.displayName}</div>
      {docLabel ? (
        <div className="text-[11px] text-surface-400 truncate">Viendo: {docLabel}</div>
      ) : (
        <div className="text-[11px] text-surface-500">Explorando el espacio</div>
      )}
    </div>
  );
}

/**
 * Indicador compacto de "N viendo este doc". Usalo junto al título
 * de un documento abierto.
 */
export function DocViewersIndicator({
  viewers
}: {
  viewers: PresenceEntry[];
}) {
  if (viewers.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5" title={viewers.map((v) => v.displayName).join(', ')}>
      <div className="flex -space-x-1">
        {viewers.slice(0, 3).map((v) => (
          <div
            key={v.sessionId}
            className="h-4 w-4 rounded-full ring-1 ring-surface-925"
            style={{ backgroundColor: v.color }}
            aria-label={v.displayName}
          />
        ))}
      </div>
      <span className="text-[10px] text-surface-500">
        {viewers.length === 1 ? '1 mirando' : `${viewers.length} mirando`}
      </span>
    </div>
  );
}
