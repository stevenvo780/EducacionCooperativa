'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          background: '#0a0a0a',
          color: '#e5e5e5'
        }}>
          <div style={{
            maxWidth: 480,
            padding: 24,
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 12,
            background: 'rgba(127,29,29,0.15)',
            textAlign: 'center'
          }}>
            <h1 style={{ color: '#ef4444', fontSize: 22, marginBottom: 12, fontWeight: 700 }}>
              Algo salió mal
            </h1>
            <p style={{ fontSize: 14, marginBottom: 20, color: '#d1d5db' }}>
              {error.message || 'Error inesperado.'}
            </p>
            <button
              onClick={reset}
              style={{
                padding: '10px 18px',
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
