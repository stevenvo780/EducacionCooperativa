'use client';

import { useEffect } from 'react';

/**
 * Garantiza que body/html no acepten scroll vertical mientras el dashboard
 * está montado. Sin esto, los portales del MDXEditor (popup-container) suman
 * altura al body y aparece área negra al scrollear fuera del viewport.
 */
export default function BodyOverflowGuard() {
  useEffect(() => {
    const bodyPrev = document.body.style.overflow;
    const htmlPrev = document.documentElement.style.overflow;
    const heightPrev = document.body.style.height;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.height = '100dvh';
    return () => {
      document.body.style.overflow = bodyPrev;
      document.documentElement.style.overflow = htmlPrev;
      document.body.style.height = heightPrev;
    };
  }, []);
  return null;
}
