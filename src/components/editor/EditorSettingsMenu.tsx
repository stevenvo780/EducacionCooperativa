'use client';

import { Settings } from 'lucide-react';
import { dispatchOpenSettings } from '@/lib/settings-events';

export default function EditorSettingsMenu() {
  return (
    <button
      type="button"
      onClick={() => dispatchOpenSettings('editor-st')}
      className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
      title="Abrir Configuración > Editor ST"
      aria-label="Abrir configuración del editor ST"
    >
      <Settings className="w-3.5 h-3.5" />
    </button>
  );
}
