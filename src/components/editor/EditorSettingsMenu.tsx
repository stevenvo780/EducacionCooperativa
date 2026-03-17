'use client';

/**
 * EditorSettingsMenu — Dropdown para habilitar/deshabilitar features del editor ST.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Settings, RotateCcw } from 'lucide-react';
import {
  type EditorConfig,
  type EditorFeature,
  FEATURE_LABELS,
  ALL_FEATURES,
  DEFAULT_CONFIG,
  saveConfig
} from './codemirror';

interface EditorSettingsMenuProps {
  config: EditorConfig;
  onChange: (config: EditorConfig) => void;
}

export default function EditorSettingsMenu({ config, onChange }: EditorSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (feature: EditorFeature) => {
    const next = { ...config, [feature]: !config[feature] };
    saveConfig(next);
    onChange(next);
  };

  const resetDefaults = () => {
    saveConfig(DEFAULT_CONFIG);
    onChange({ ...DEFAULT_CONFIG });
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`p-1.5 rounded transition-colors ${
          open
            ? 'text-indigo-400 bg-slate-800'
            : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }`}
        title="Configuración del editor"
      >
        <Settings className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-slate-850 border border-slate-700 rounded-lg shadow-xl overflow-hidden"
          style={{ backgroundColor: '#0f1729' }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
            <span className="text-xs font-medium text-slate-300">Editor</span>
            <button
              onClick={resetDefaults}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              title="Restaurar valores predeterminados"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
          <div className="py-1 max-h-72 overflow-y-auto">
            {ALL_FEATURES.map((feature) => (
              <label
                key={feature}
                className="flex items-center gap-3 px-3 py-1.5 hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={config[feature]}
                    onChange={() => toggle(feature)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-slate-700 rounded-full peer-checked:bg-indigo-600 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-slate-400 rounded-full peer-checked:translate-x-3 peer-checked:bg-white transition-all" />
                </div>
                <span className="text-xs text-slate-300">{FEATURE_LABELS[feature]}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
