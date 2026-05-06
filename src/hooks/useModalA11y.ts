'use client';

import { useEffect } from 'react';

export function useEscapeClose(open: boolean, onClose: (() => void) | undefined) {
  useEffect(() => {
    if (!open || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-prevent-modal-escape="true"]')) return;
      onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);
}
