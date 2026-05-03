'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Registro modular de canales del panel inferior (estilo "Output" de
 * VS Code). Cualquier subsistema puede registrar un canal con
 * `registerChannel(id, channel)` y aparecera como tab en el BottomDock.
 *
 * Diseño:
 * - ID único por canal. Volver a registrar con el mismo id reemplaza el
 *   contenido (upsert) — útil para "última ejecución de ST" donde el
 *   canal se actualiza al re-ejecutar.
 * - Render lazy: el canal expone un `render` que solo se invoca cuando
 *   el tab esta activo. Asi un canal con datos pesados no penaliza si
 *   no se ve.
 * - Badge opcional con count + tone para mostrar en el tab (ej: 3
 *   problemas, 12 símbolos). Mismas variantes que diagnostics severity.
 * - sticky=true mantiene el canal aunque el origen desaparezca; útil
 *   para "último ST ejecutado" que el usuario quiere seguir viendo
 *   aunque cierre el editor ST.
 */

export type ChannelTone = 'error' | 'warning' | 'info' | 'success' | 'neutral';

export interface ChannelBadge {
  count?: number;
  text?: string;
  tone?: ChannelTone;
}

export interface OutputChannel {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Indicador opcional al lado del label (count, severity tone). */
  badge?: ChannelBadge;
  /** Render del contenido — solo se invoca cuando el tab está activo. */
  render: () => ReactNode;
  /** Si true, el canal persiste aunque su productor lo dé de baja sin reemplazo. */
  sticky?: boolean;
  /** Orden sugerido (los menores primero). Defaults a 100. */
  order?: number;
}

type Listener = (snapshot: OutputChannel[]) => void;

const channels = new Map<string, OutputChannel>();
const listeners = new Set<Listener>();
let inEmit = false;
let pendingEmit = false;

function snapshot(): OutputChannel[] {
  return Array.from(channels.values()).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

function emit() {
  if (inEmit) {
    pendingEmit = true;
    return;
  }
  inEmit = true;
  try {
    const snap = snapshot();
    listeners.forEach((l) => {
      try { l(snap); } catch (e) { void e; }
    });
  } finally {
    inEmit = false;
    if (pendingEmit) {
      pendingEmit = false;
      emit();
    }
  }
}

/** Upsert de un canal por id. Si ya existe, reemplaza. */
export function registerChannel(channel: OutputChannel) {
  channels.set(channel.id, channel);
  emit();
}

/** Quita un canal. Si era sticky=true, no hace nada. */
export function unregisterChannel(id: string) {
  const ch = channels.get(id);
  if (!ch) return;
  if (ch.sticky) return;
  channels.delete(id);
  emit();
}

/** Quita un canal aunque sea sticky (cuando se llega a un punto de reset real). */
export function forceUnregisterChannel(id: string) {
  if (channels.delete(id)) emit();
}

export function subscribeChannels(listener: Listener): () => void {
  listeners.add(listener);
  try { listener(snapshot()); } catch (e) { void e; }
  return () => listeners.delete(listener);
}

export function getChannels(): OutputChannel[] {
  return snapshot();
}

export function getChannel(id: string): OutputChannel | undefined {
  return channels.get(id);
}
