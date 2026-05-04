'use client';

import { useEffect, useState } from 'react';

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
}

export type FileSource =
  | { kind: 'arrayBuffer'; data: ArrayBuffer; size: number }
  | { kind: 'text'; data: string; size: number }
  | { kind: 'blob'; data: Blob };

/**
 * Carga un fileUrl y aplica un transform asíncrono cancelable.
 * Reemplaza el patrón fetch+useEffect+cancelled+setState({kind:...})
 * que cada visor implementaba a mano.
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
      try {
        const response = await fetch(fileUrl, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (controller.signal.aborted) return;
        if (options.maxBytes && buffer.byteLength > options.maxBytes) {
          throw new Error(
            `Archivo demasiado grande (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB).`
          );
        }
        const data = await transform({ buffer, signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({ kind: 'ready', data });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Error desconocido';
        setState({ kind: 'error', error: message });
      }
    })();

    return () => controller.abort();
  }, [fileUrl, transform, options.maxBytes]);

  return state;
}

export function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}
