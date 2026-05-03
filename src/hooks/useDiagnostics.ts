'use client';

import { useEffect, useRef, useMemo } from 'react';
import {
  createDiagnosticsCollection,
  type Diagnostic,
  type DiagnosticsCollection
} from '@/lib/diagnostics-bus';

/**
 * Hook para componentes que quieren publicar diagnostics estructurados
 * al panel "Problemas" sin manejar manualmente el ciclo de vida del
 * `DiagnosticsCollection`.
 *
 * Crea una collection con el `source` dado en el primer render y la
 * dispone (clearDiagnostics(source)) cuando el componente se desmonta.
 *
 * Uso:
 *   const diag = useDiagnostics('my-linter');
 *   useEffect(() => {
 *     diag.set(docId, [{ severity: 'error', message: '...' }]);
 *   }, [content]);
 */
export function useDiagnostics(source: string): DiagnosticsCollection {
  const ref = useRef<DiagnosticsCollection | null>(null);
  const collection = useMemo(() => {
    if (!ref.current) ref.current = createDiagnosticsCollection(source);
    return ref.current;
    // El source no debe cambiar en runtime para el mismo componente —
    // si cambiara, hay que dispose del anterior, pero ese caso se evita
    // documentadamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { collection.dispose(); };
  }, [collection]);

  return collection;
}

/** Versión "fire and forget" — publica una vez y devuelve un cleanup. */
export function publishOneShotDiagnostic(source: string, uri: string, item: Diagnostic) {
  const col = createDiagnosticsCollection(source);
  col.set(uri, [item]);
  return () => col.clear(uri);
}
