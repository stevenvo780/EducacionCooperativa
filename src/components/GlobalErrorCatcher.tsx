'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { isAbortError } from '@/lib/error-utils';

export default function GlobalErrorCatcher() {
  useEffect(() => {
    // Escuchar errores no capturados (ej. errores de render o de scripts)
    const handleError = (event: ErrorEvent) => {
      // Ignoramos errores de origen cruzado u otros que ya estén prevenidos
      if (event.defaultPrevented) return;
      if (isAbortError(event.error)) return;

      const msg = event.message || 'Ocurrió un error inesperado';
      toast.error('Error de Aplicación', {
        description: msg
      });
      // Importante: No llamamos a event.preventDefault() aquí si queremos
      // que el ErrorBoundary de React también pueda capturarlo.
    };

    // Escuchar promesas rechazadas (ej. llamadas asíncronas no capturadas)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // AbortError de fetches en cleanup de useEffect no debe alarmar al user.
      if (isAbortError(event.reason)) {
        event.preventDefault();
        return;
      }
      let msg = 'Operación fallida inesperadamente';
      if (event.reason instanceof Error) {
        msg = event.reason.message;
      } else if (typeof event.reason === 'string') {
        msg = event.reason;
      }

      toast.error('Promesa no controlada', {
        description: msg
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null; // Este componente solo añade listeners, no renderiza nada
}
