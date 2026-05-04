'use client';

import { useEffect, useRef } from 'react';

/**
 * Mantiene un pool de object URLs que se revoca automáticamente al desmontar.
 * Útil para extracción de páginas/imágenes desde zips.
 */
export function useObjectUrls() {
  const urlsRef = useRef<string[]>([]);

  useEffect(() => () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
  }, []);

  const create = (blob: Blob): string => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    return url;
  };

  const revoke = (url: string) => {
    URL.revokeObjectURL(url);
    urlsRef.current = urlsRef.current.filter((u) => u !== url);
  };

  return { create, revoke };
}
