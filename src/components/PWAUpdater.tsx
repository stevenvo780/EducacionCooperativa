'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';

interface WorkboxInstance {
  addEventListener(event: string, handler: () => void): void;
  removeEventListener(event: string, handler: () => void): void;
  register(): Promise<{ waiting: unknown } | null>;
  messageSkipWaiting(): void;
}

declare global {
  interface Window {
    workbox?: WorkboxInstance;
  }
}

/**
 * PWAUpdater - Componente para notificar nuevas versiones de la aplicación (PWA).
 * Se encarga de escuchar eventos de Workbox y mostrar una UI de actualización.
 */
export default function PWAUpdater() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onWaiting = useCallback(() => {
    setShow(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    if ('serviceWorker' in navigator && window.workbox !== undefined) {
      const wb = window.workbox;

      wb.addEventListener('waiting', onWaiting);
      wb.addEventListener('externalwaiting', onWaiting);

      wb.register().then((registration) => {
        if (registration && registration.waiting) {
          setShow(true);
        }
      });

      return () => {
        wb.removeEventListener('waiting', onWaiting);
        wb.removeEventListener('externalwaiting', onWaiting);
      };
    }
  }, [mounted, onWaiting]);

  const reloadPage = () => {
    if (typeof window !== 'undefined' && window.workbox !== undefined) {
      window.workbox.addEventListener('controlling', () => {
        window.location.reload();
      });
      window.workbox.messageSkipWaiting();
    } else {
      window.location.reload();
    }
  };

  if (!mounted || !show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-3 rounded-lg border border-sky-500/30 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-5">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
          <RefreshCw className="h-4 w-4 animate-spin-slow" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-100">Nueva versión disponible</span>
          <span className="text-xs text-slate-400">Actualiza para recibir las últimas mejoras.</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={reloadPage}
          className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 transition-colors shadow-lg active:scale-95"
        >
          Actualizar
        </button>
        <button
          onClick={() => setShow(false)}
          className="rounded p-1.5 text-slate-400 hover:bg-slate-800 transition-colors"
          aria-label="Cerrar notificación"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
