'use client';

import { useEffect, useState } from 'react';

/**
 * Difere el montaje real hasta que el navegador esté ocioso (o tras un
 * timeout corto si no soporta requestIdleCallback). El componente que use
 * el flag puede renderizar un placeholder ligero antes y los nodos pesados
 * (con sus listeners y DOM) sólo se materializan después del primer paint.
 *
 * Reduce el delta de heap en el primer render del editor: la toolbar avanzada
 * y otras zonas raramente usadas no inflan código + native size en T0.
 */
export function useDeferredMount(timeoutMs = 800): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const finish = () => {
      if (!cancelled) setReady(true);
    };

    const ric = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    }).requestIdleCallback;

    if (typeof ric === 'function') {
      const id = ric(finish, { timeout: timeoutMs });
      return () => {
        cancelled = true;
        const cic = (window as Window & {
          cancelIdleCallback?: (handle: number) => void;
        }).cancelIdleCallback;
        if (typeof cic === 'function') cic(id);
      };
    }

    const handle = window.setTimeout(finish, timeoutMs);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [timeoutMs]);

  return ready;
}
