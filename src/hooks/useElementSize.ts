'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Observa el tamaño de un elemento DOM. Patrón ref-callback para que
 * funcione con elementos que aparecen/desaparecen sin re-renderizar
 * el padre. ResizeObserver opcional (no se rompe en SSR).
 */
export const useElementSize = <T extends HTMLElement>() => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node !== null) {
      const updateSize = () => {
        const rect = node.getBoundingClientRect();
        setSize({ width: rect.width, height: rect.height });
      };

      updateSize();

      if (typeof ResizeObserver !== 'undefined') {
        observerRef.current = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry) {
            const { width, height } = entry.contentRect;
            setSize({ width, height });
          }
        });
        observerRef.current.observe(node);
      }
    }
  }, []);

  return [ref, size] as const;
};
