'use client';

/**
 * Contador global de descargas/cargas de contenido en vuelo. Las funciones
 * de red que traen contenido pesado (raw de un documento, lista de docs de
 * un workspace, descarga de blob) se envuelven con `trackContentLoading`
 * para que la status bar muestre un indicador mientras haya ≥1 activa.
 *
 * Es un contador (no un booleano) para que cargas concurrentes no se pisen:
 * el indicador desaparece sólo cuando la última termina, no la primera.
 */

type Listener = (active: boolean) => void;

let inFlight = 0;
const listeners = new Set<Listener>();

function emit() {
  const active = inFlight > 0;
  listeners.forEach((l) => {
    try { l(active); } catch (e) { void e; }
  });
}

export function beginContentLoading(): void {
  inFlight += 1;
  if (inFlight === 1) emit();
}

export function endContentLoading(): void {
  if (inFlight === 0) return;
  inFlight -= 1;
  if (inFlight === 0) emit();
}

/**
 * Envuelve una promesa de carga de contenido para que cuente en el indicador
 * global. El contador se decrementa siempre al terminar (éxito o error), de
 * modo que el indicador nunca queda pegado.
 */
export async function trackContentLoading<T>(work: Promise<T> | (() => Promise<T>)): Promise<T> {
  beginContentLoading();
  try {
    return await (typeof work === 'function' ? work() : work);
  } finally {
    endContentLoading();
  }
}

export function isContentLoading(): boolean {
  return inFlight > 0;
}

export function subscribeContentLoading(listener: Listener): () => void {
  listeners.add(listener);
  try { listener(inFlight > 0); } catch (e) { void e; }
  return () => listeners.delete(listener);
}
