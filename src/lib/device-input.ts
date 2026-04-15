'use client';

import { useEffect, useState } from 'react';

export function matchesMediaQuery(query: string): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(query).matches;
}

export function isTouchDeviceProfile(): boolean {
  if (typeof window === 'undefined') return false;

  const primaryCoarsePointer = matchesMediaQuery('(pointer: coarse)');
  const anyCoarsePointer = matchesMediaQuery('(any-pointer: coarse)');
  const primaryFinePointer = matchesMediaQuery('(pointer: fine)');
  const hoverCapable = matchesMediaQuery('(hover: hover)') || matchesMediaQuery('(any-hover: hover)');
  const noHover = matchesMediaQuery('(hover: none)') || matchesMediaQuery('(any-hover: none)');
  const hasTouchPoints = typeof navigator !== 'undefined'
    && typeof navigator.maxTouchPoints === 'number'
    && navigator.maxTouchPoints > 0;
  const touchOnlyDevice = (primaryCoarsePointer || (hasTouchPoints && !primaryFinePointer)) && !hoverCapable;
  const compactTouchViewport = typeof window.innerWidth === 'number'
    && window.innerWidth <= 1180
    && (primaryCoarsePointer || anyCoarsePointer || hasTouchPoints)
    && noHover;

  return touchOnlyDevice || compactTouchViewport;
}

export function useIsTouchDeviceProfile(): boolean {
  const [isTouchProfile, setIsTouchProfile] = useState(() => isTouchDeviceProfile());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const queries = [
      '(pointer: coarse)',
      '(any-pointer: coarse)',
      '(pointer: fine)',
      '(hover: hover)',
      '(any-hover: hover)',
      '(hover: none)',
      '(any-hover: none)'
    ];
    const mediaLists = queries.map(query => window.matchMedia(query));
    const update = () => {
      setIsTouchProfile(prev => {
        const next = isTouchDeviceProfile();
        return prev === next ? prev : next;
      });
    };

    update();
    mediaLists.forEach(media => {
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', update);
      } else if (typeof media.addListener === 'function') {
        media.addListener(update);
      }
    });
    window.addEventListener('resize', update, { passive: true });

    return () => {
      mediaLists.forEach(media => {
        if (typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', update);
        } else if (typeof media.removeListener === 'function') {
          media.removeListener(update);
        }
      });
      window.removeEventListener('resize', update);
    };
  }, []);

  return isTouchProfile;
}
