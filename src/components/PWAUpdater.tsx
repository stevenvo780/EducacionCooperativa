'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

export default function PWAUpdater() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [updating, setUpdating] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  const reloadPage = () => {
    if (updating) return;
    setUpdating(true);

    if (typeof window !== 'undefined' && window.workbox !== undefined) {
      const wb = window.workbox;
      wb.addEventListener('controlling', () => {
        window.location.reload();
      });
      wb.messageSkipWaiting();

      fallbackTimerRef.current = setTimeout(() => {
        window.location.reload();
      }, 6000);
    } else {
      window.location.reload();
    }
  };

  if (!mounted || !show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] flex items-center gap-3 rounded-lg border border-sky-500/30 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-sm animate-in slide-in-from-bottom-5"
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
          <RefreshCw className={updating ? 'h-4 w-4 animate-spin' : 'h-4 w-4 animate-spin-slow'} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-100">
            {updating ? 'Actualizando…' : 'Nueva versión disponible'}
          </span>
          <span className="text-xs text-slate-400">
            {updating ? 'Aplicando la nueva versión, no cierres la pestaña.' : 'Actualiza para recibir las últimas mejoras.'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={reloadPage}
          disabled={updating}
          aria-busy={updating}
          className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-colors hover:bg-sky-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {updating && <RefreshCw className="h-3 w-3 animate-spin" />}
          {updating ? 'Actualizando…' : 'Actualizar'}
        </button>
        <button
          onClick={() => setShow(false)}
          disabled={updating}
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Cerrar notificación"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
