'use client';

import { useState } from 'react';
import BelnapLattice from './BelnapLattice';
import ModalFrame from './ModalFrame';

type ViewMode = 'belnap' | 'modal';

const EXAMPLE_WORLDS = ['w0', 'w1', 'w2', 'w3'];
const EXAMPLE_ACCESSIBILITY: Array<[string, string]> = [
  ['w0', 'w1'],
  ['w0', 'w2'],
  ['w1', 'w1'],
  ['w1', 'w3'],
  ['w2', 'w3'],
  ['w3', 'w0']
];

export default function LatticeViewerClient() {
  const [mode, setMode] = useState<ViewMode>('belnap');

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <div className="flex gap-2 rounded-lg border border-slate-700 p-1 bg-slate-900">
        <button
          type="button"
          onClick={() => setMode('belnap')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'belnap'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Belnap Bilattice
        </button>
        <button
          type="button"
          onClick={() => setMode('modal')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'modal'
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Modal Frame Example
        </button>
      </div>

      <div className="w-full max-w-lg">
        {mode === 'belnap' ? (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-100">
                Belnap Bilattice FOUR
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Bilattice de cuatro valores con dos órdenes parciales
                ortogonales.
              </p>
            </div>
            <BelnapLattice />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-100">
                Marco Modal de Ejemplo
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Estructura de Kripke con 4 mundos y relación de accesibilidad.
              </p>
            </div>
            <ModalFrame
              worlds={EXAMPLE_WORLDS}
              accessibility={EXAMPLE_ACCESSIBILITY}
            />
          </div>
        )}
      </div>

      <div className="max-w-md text-xs text-slate-500 text-center border-t border-slate-800 pt-4">
        {mode === 'belnap' ? (
          <span>
            El bilattice de Belnap representa estados epistémicos:{' '}
            <strong className="text-slate-300">⊤</strong> (sobreinformado),{' '}
            <strong className="text-slate-300">T</strong> (verdadero),{' '}
            <strong className="text-slate-300">F</strong> (falso),{' '}
            <strong className="text-slate-300">⊥</strong> (sin información).
          </span>
        ) : (
          <span>
            Un marco de Kripke ⟨W, R⟩ donde W son los mundos posibles y R es
            la relación de accesibilidad. Los bucles indican reflexividad local.
          </span>
        )}
      </div>
    </div>
  );
}
