'use client';

import { useEffect, useState } from 'react';
import { cacheBlob, getCachedBlob } from '@/lib/viewer-cache';

export type FileResourceState<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'error'; error: string };

export interface FileResourceOptions {
  /** Mensaje de error a propagar si fetch falla. */
  loaderName?: string;
  /** Tamaño máximo en bytes; rechaza la carga si se excede. */
  maxBytes?: number;
  /** Clave de cache. Si se provee, el blob se guarda en IndexedDB tras el
   *  primer fetch exitoso y se reusa cuando navigator.onLine es false o
   *  cuando el fetch falla con error de red. */
  cacheKey?: string;
}

/**
 * Carga un fileUrl y aplica un transform asíncrono cancelable.
 * Reemplaza el patrón fetch+useEffect+cancelled+setState({kind:...})
 * que cada visor implementaba a mano.
 *
 * Cache offline: si `options.cacheKey` se provee, el blob se guarda en
 * IndexedDB tras un fetch exitoso. Si el navegador está offline o el fetch
 * falla, se intenta servir desde cache.
 */
export function useFileResource<T>(
  fileUrl: string | null,
  transform: (source: { buffer: ArrayBuffer; signal: AbortSignal }) => Promise<T>,
  options: FileResourceOptions = {}
): FileResourceState<T> {
  const [state, setState] = useState<FileResourceState<T>>({ kind: 'idle' });

  useEffect(() => {
    if (!fileUrl) {
      setState({ kind: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });

    (async () => {
      const tryCache = async (): Promise<ArrayBuffer | null> => {
        if (!options.cacheKey) return null;
        const blob = await getCachedBlob(options.cacheKey);
        return blob ? await blob.arrayBuffer() : null;
      };

      const failOpenFromCache = async (originalError: unknown): Promise<void> => {
        const cached = await tryCache();
        if (controller.signal.aborted) return;
        if (cached) {
          try {
            const data = await transform({ buffer: cached, signal: controller.signal });
            if (controller.signal.aborted) return;
            setState({ kind: 'ready', data });
            return;
          } catch (err) {
            if (controller.signal.aborted) return;
            setState({ kind: 'error', error: err instanceof Error ? err.message : String(err) });
            return;
          }
        }
        const message = originalError instanceof Error ? originalError.message : 'Error desconocido';
        setState({ kind: 'error', error: message });
      };

      // Si está offline, intenta servir directo desde cache antes de fetch.
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        const cached = await tryCache();
        if (controller.signal.aborted) return;
        if (cached) {
          try {
            const data = await transform({ buffer: cached, signal: controller.signal });
            if (controller.signal.aborted) return;
            setState({ kind: 'ready', data });
            return;
          } catch (err) {
            if (controller.signal.aborted) return;
            setState({ kind: 'error', error: err instanceof Error ? err.message : String(err) });
            return;
          }
        }
        setState({ kind: 'error', error: 'Sin conexión y sin copia en caché para este archivo.' });
        return;
      }

      try {
        const response = await fetch(fileUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (options.maxBytes && blob.size > options.maxBytes) {
          throw new Error(
            `Archivo demasiado grande (${(blob.size / 1024 / 1024).toFixed(1)} MB).`
          );
        }
        const buffer = await blob.arrayBuffer();
        if (controller.signal.aborted) return;
        const data = await transform({ buffer, signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({ kind: 'ready', data });
        // Persistimos en background — no bloquea el render.
        if (options.cacheKey) {
          void cacheBlob(options.cacheKey, blob);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        // Fallback al cache si el fetch falló por red o servidor caído.
        await failOpenFromCache(error);
      }
    })();

    return () => controller.abort();
  }, [fileUrl, transform, options.maxBytes, options.cacheKey]);

  return state;
}

export function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

/**
 * Genera una clave de cache estable para un fileUrl. Útil para que cada
 * visualizador comparta el helper sin tener que parsear el URL.
 */
export function urlCacheKey(prefix: string, fileUrl: string | null): string | undefined {
  if (!fileUrl) return undefined;
  // Quita query params volátiles (timestamps de URLs firmadas) si es posible.
  try {
    const u = new URL(fileUrl, 'https://placeholder.invalid');
    const stable = `${u.origin}${u.pathname}`;
    return `${prefix}:${stable}`;
  } catch {
    return `${prefix}:${fileUrl}`;
  }
}
