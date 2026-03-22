'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';

/**
 * PWAUpdater - Componente para notificar nuevas versiones de la aplicación (PWA).
 * Se encarga de escuchar eventos de Workbox y mostrar una UI de actualización.
 */
export default function PWAUpdater() {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 1. Efecto inicial para marcar el componente como montado en el cliente.
  //    Esto previene errores de hidratación y fallos de Server Side Rendering.
  useEffect(() => {
    setMounted(true);
  }, []);

  const onWaiting = useCallback(() => {
    setShow(true);
  }, []);

  // 2. Efecto para registrar y escuchar eventos del Service Worker.
  useEffect(() => {
    // Si no estamos montados en el cliente, salimos prematuramente.
    if (!mounted || typeof window === 'undefined') return;

    // Solo actuamos si el Service Worker y Workbox están disponibles.
    if ('serviceWorker' in navigator && (window as any).workbox !== undefined) {
      const wb = (window as any).workbox;

      wb.addEventListener('waiting', onWaiting);
      wb.addEventListener('externalwaiting', onWaiting);

      // Comprobamos si ya hay un service worker esperando.
      // wb.register() devuelve una promesa con el registro.
      wb.register().then((registration: any) => {
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
    if (typeof window !== 'undefined' && (window as any).workbox !== undefined) {
      (window as any).workbox.addEventListener('controlling', () => {
        window.location.reload();
      });
      (window as any).workbox.messageSkipWaiting();
    } else {
      window.location.reload();
    }
  };

  // 3. Renderizado Condicional:
  //    Si el componente no está montado o no hay actualización disponible, no renderizamos nada.
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
