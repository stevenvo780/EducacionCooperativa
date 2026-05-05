'use client';

import { useEffect } from 'react';

export default function WorkspaceError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[workspace/error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="p-6 bg-red-950/20 border border-red-500/20 rounded-lg max-w-lg">
        <h2 className="text-xl font-bold text-red-500 mb-2">El workspace falló al cargar</h2>
        <p className="text-gray-300 text-sm mb-4">
          {error.message || 'Error inesperado al abrir este workspace.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
