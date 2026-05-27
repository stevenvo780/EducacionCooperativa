'use client';

import { useId } from 'react';
import { Play, Loader2, RotateCcw } from 'lucide-react';

interface EditorPanelProps {
  formula: string;
  profile: string;
  profiles: readonly string[];
  validating: boolean;
  onFormulaChange: (value: string) => void;
  onProfileChange: (value: string) => void;
  onValidate: () => void;
  onReset: () => void;
}

export default function EditorPanel({
  formula,
  profile,
  profiles,
  validating,
  onFormulaChange,
  onProfileChange,
  onValidate,
  onReset
}: EditorPanelProps) {
  const profileId = useId();
  const editorId = useId();
  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-surface-700/80 bg-surface-800/60 backdrop-blur">
      <header className="flex flex-wrap items-center gap-2 border-b border-surface-700/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-surface-50">Editor ST</h2>
        <span className="text-[10px] uppercase tracking-wider text-surface-400">
          {formula.length} chars
        </span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] text-surface-400" htmlFor={profileId}>
            Perfil
          </label>
          <select
            id={profileId}
            value={profile}
            onChange={(e) => onProfileChange(e.target.value)}
            className="rounded-md border border-surface-600 bg-surface-900/80 px-2 py-1 text-xs text-surface-100 focus:border-mandy-500 focus:outline-none"
          >
            {profiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="flex-1 min-h-0 p-3">
        <textarea
          id={editorId}
          name="st-formula"
          value={formula}
          onChange={(e) => onFormulaChange(e.target.value)}
          spellCheck={false}
          className="h-full w-full resize-none rounded-lg border border-surface-600 bg-surface-900/80 px-3 py-2 font-mono text-xs leading-relaxed text-surface-50 focus:border-mandy-500 focus:outline-none"
          placeholder={`logic ${profile}\n\ncheck valid (P -> P)\n`}
          aria-label="Editor ST"
        />
      </div>

      <div className="flex items-center gap-2 border-t border-surface-700/80 px-3 py-2">
        <button
          type="button"
          onClick={onValidate}
          disabled={validating || !formula.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-mandy-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-mandy-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {validating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Validar
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-surface-200 hover:bg-surface-700/60"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        <span className="ml-auto text-[10px] text-surface-500">
          Cmd/Ctrl + Enter para validar
        </span>
      </div>
    </section>
  );
}
