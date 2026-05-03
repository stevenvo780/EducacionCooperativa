'use client';

import { useEffect, useState } from 'react';

/**
 * Reactive media query hook. Renders to `false` on the server to avoid
 * hydration drift; subscribes after mount and stays in sync via
 * `matchMedia.addEventListener`. Pass any valid CSS media query string.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mql = window.matchMedia(query);
    const apply = () => setMatches(mql.matches);
    apply();

    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
export const useIsCompact = () => useMediaQuery('(max-width: 1023px)');
