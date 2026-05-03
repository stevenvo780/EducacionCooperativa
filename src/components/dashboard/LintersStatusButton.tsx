'use client';

import { useEffect, useState } from 'react';
import { Shield, ShieldOff } from 'lucide-react';
import { LinterRegistry } from '@/lib/linters/registry';

interface LintersStatusButtonProps {
  /** Extensión del archivo activo (lowercase, sin punto). Si null, se usa la lista global. */
  activeFileExt: string | null;
}

/**
 * Botón compacto del StatusBar:
 *  - Muestra `Linters: N/M` (activos/totales aplicables al archivo).
 *  - Click: activa/desactiva todos los linters aplicables (toggle global).
 *  - Para configurar individualmente cada linter, el usuario abre la
 *    sección Linters del modal de Configuración (UserMenu → Configuración).
 *
 * Justificación: dos iteraciones del popover modal terminaron en bugs
 * visuales (clipping por ancestros, posicionamiento). El status bar
 * mantiene SOLO la acción simple; la configuración rica vive en el modal.
 */
export default function LintersStatusButton({ activeFileExt }: LintersStatusButtonProps) {
  const [, force] = useState(0);

  useEffect(() => LinterRegistry.subscribe(() => force((n) => n + 1)), []);

  const scoped = LinterRegistry.forScope(activeFileExt);
  const linters = scoped.length > 0 ? scoped : LinterRegistry.all();
  const activeCount = linters.filter((l) => LinterRegistry.isEnabled(l.id)).length;
  const total = linters.length;
  const allOff = total > 0 && activeCount === 0;
  const Icon = allOff ? ShieldOff : Shield;

  const toggleAll = () => {
    const target = activeCount < total; // si hay alguno apagado, prendemos todos
    linters.forEach((l) => LinterRegistry.setEnabled(l.id, target));
  };

  return (
    <button
      type="button"
      onClick={toggleAll}
      title={
        total === 0
          ? 'No hay linters disponibles'
          : `Linters ${activeCount}/${total} activos · Click: ${
              activeCount < total ? 'activar todos' : 'desactivar todos'
            } · Configurar individualmente en Configuración`
      }
      aria-label="Toggle global de linters"
      className={`flex h-5 items-center gap-1 rounded px-1.5 transition ${
        allOff
          ? 'text-amber-300 hover:bg-surface-800/60'
          : 'text-surface-400 hover:bg-surface-800/60 hover:text-surface-100'
      }`}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">
        Linters {activeCount}/{total}
      </span>
    </button>
  );
}
