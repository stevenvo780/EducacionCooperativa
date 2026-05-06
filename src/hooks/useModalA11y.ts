'use client';

import { useEffect } from 'react';

export function useEscapeClose(open: boolean, onClose: (() => void) | undefined) {
  useEffect(() => {
    if (!open || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // e.target puede ser el `document` si el ESC se dispara con un evento
      // sintético. `document.closest` no existe — sólo Element. Hacemos guard
      // tipado para no romper en ese caso.
      const target = e.target;
      if (target instanceof Element && target.closest('[data-prevent-modal-escape="true"]')) {
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);
}
