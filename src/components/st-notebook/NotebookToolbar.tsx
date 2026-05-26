'use client';

import React from 'react';

const PROFILES: Array<{ id: string; label: string }> = [
  { id: 'classical.propositional', label: 'Clásica proposicional' },
  { id: 'classical.first_order', label: 'Clásica primer orden' },
  { id: 'intuitionistic.propositional', label: 'Intuicionista' },
  { id: 'modal.k', label: 'Modal K' },
  { id: 'epistemic.s5', label: 'Epistémica S5' },
  { id: 'deontic.standard', label: 'Deóntica' },
  { id: 'temporal.ltl', label: 'Temporal LTL' },
  { id: 'paraconsistent.belnap', label: 'Paraconsistente (Belnap)' },
  { id: 'aristotelian.syllogistic', label: 'Aristotélica (silogística)' },
  { id: 'probabilistic.basic', label: 'Probabilística' },
  { id: 'arithmetic', label: 'Aritmética' }
];

interface Props {
  title: string;
  profile: string;
  saving: boolean;
  running: boolean;
  onTitleChange: (title: string) => void;
  onProfileChange: (profile: string) => void;
  onSave: () => void;
  onRunAll: () => void;
  onExportStnb: () => void;
  onExportHtml: () => void;
  onAddCode: () => void;
  onAddMarkdown: () => void;
  onBack: () => void;
}

export default function NotebookToolbar({
  title,
  profile,
  saving,
  running,
  onTitleChange,
  onProfileChange,
  onSave,
  onRunAll,
  onExportStnb,
  onExportHtml,
  onAddCode,
  onAddMarkdown,
  onBack
}: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white flex-wrap">
      <button
        onClick={onBack}
        className="text-xs text-gray-500 hover:text-gray-800 mr-1"
        title="Volver a la lista"
      >
        ← Notebooks
      </button>

      <input
        type="text"
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        className="flex-1 min-w-32 max-w-64 text-sm font-medium border-b border-transparent hover:border-gray-300 focus:border-indigo-400 focus:outline-none bg-transparent py-0.5"
        placeholder="Título del notebook"
      />

      <select
        value={profile}
        onChange={e => onProfileChange(e.target.value)}
        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
        title="Perfil lógico"
      >
        {PROFILES.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={onAddCode}
          className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
          title="Añadir celda de código"
        >
          + Código
        </button>
        <button
          onClick={onAddMarkdown}
          className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
          title="Añadir celda markdown"
        >
          + Markdown
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onClick={onRunAll}
          disabled={running}
          className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          title="Ejecutar todas las celdas"
        >
          {running ? '▶ Ejecutando…' : '▶ Run all'}
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          title="Guardar"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <button
          onClick={onExportStnb}
          className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
          title="Exportar como .stnb"
        >
          Export .stnb
        </button>
        <button
          onClick={onExportHtml}
          className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
          title="Exportar como HTML"
        >
          Export HTML
        </button>
      </div>
    </div>
  );
}
