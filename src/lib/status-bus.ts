'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Registro modular de "segmentos" de la status bar global. Cada editor
 * o componente publica los datos relevantes del archivo en foco
 * (palabras, lineas, linter status, modo edición, encoding, etc.) sin
 * tener su propia status bar duplicada.
 *
 * Mismo patrón que output-channels:
 * - registerSegment(seg) hace upsert por id
 * - unregisterSegment(id) lo quita (los sticky no se quitan)
 * - subscribeStatus(listener) recibe snapshots ordenados por priority
 *
 * Convención de slots:
 * - "left:*" → segmentos pegados a la izquierda
 * - "right:*" → segmentos pegados a la derecha
 *
 * El priority menor aparece primero dentro de su slot.
 */

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'error' | 'muted';

export type StatusSlot = 'left' | 'right';

export interface StatusSegment {
  id: string;
  /** Texto principal visible. Puede ser un node si necesita riqueza. */
  label: ReactNode;
  /** Icono opcional del lado izquierdo del label. */
  icon?: LucideIcon;
  /** Tone aplica color; ej: error pinta el segmento en rosa. */
  tone?: StatusTone;
  /** Tooltip opcional. */
  title?: string;
  /** Click handler opcional — vuelve el segmento clicable. */
  onClick?: () => void;
  /** Slot a la izquierda o derecha de la barra. Default: 'left'. */
  slot?: StatusSlot;
  /** Orden dentro del slot. Default: 100. Menor = más cerca del extremo. */
  priority?: number;
  /** Si true, el segmento no se desregistra automáticamente. */
  sticky?: boolean;
  /** Visibilidad mínima — oculta en pantallas estrechas. */
  hideBelow?: 'sm' | 'md' | 'lg';
}

type Listener = (snapshot: StatusSegment[]) => void;

const segments = new Map<string, StatusSegment>();
const listeners = new Set<Listener>();
let inEmit = false;
let pendingEmit = false;

function snapshot(): StatusSegment[] {
  return Array.from(segments.values()).sort((a, b) => {
    const slotDiff = (a.slot ?? 'left') === (b.slot ?? 'left') ? 0 : (a.slot === 'right' ? 1 : -1);
    if (slotDiff !== 0) return slotDiff;
    return (a.priority ?? 100) - (b.priority ?? 100);
  });
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

export function registerStatusSegment(seg: StatusSegment) {
  segments.set(seg.id, seg);
  emit();
}

export function unregisterStatusSegment(id: string) {
  const s = segments.get(id);
  if (!s) return;
  if (s.sticky) return;
  segments.delete(id);
  emit();
}

export function forceUnregisterStatusSegment(id: string) {
  if (segments.delete(id)) emit();
}

export function subscribeStatus(listener: Listener): () => void {
  listeners.add(listener);
  try { listener(snapshot()); } catch (e) { void e; }
  return () => listeners.delete(listener);
}

export function getStatusSegments(): StatusSegment[] {
  return snapshot();
}
