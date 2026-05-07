'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Loader2, Play, RotateCcw } from 'lucide-react';
import type { STEvalResult } from '@stevenvo780/st-lang/api';
import { OutputViewer, ViewModeToggle, type OutputViewMode } from '@/components/editor/STOutputViewer';
import { useSTInterpreter } from '@/hooks/useSTInterpreter';
import { ST_RUNTIME_KEYWORDS } from '@/lib/st-runtime-manifest';

const STCodeEditor = dynamic(() => import('@/components/editor/STCodeEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-full min-h-[220px] flex items-center justify-center text-xs text-surface-500">
      Cargando editor ST...
    </div>
  )
});

const SHELL_PREFIX = /^(npm|pnpm|yarn|bun|node|bash|sh|st)\b/;
const ST_RUN_KEYWORDS = new RegExp(
  `(?:^|\\n)\\s*(${ST_RUNTIME_KEYWORDS.filter((keyword) => /^[a-z_]+$/i.test(keyword)).join('|')})\\b`
);
const DEFAULT_PROFILE = 'logic classical.propositional';

function canRunAsST(code: string): boolean {
  const trimmed = code.trimStart();
  if (!trimmed) return false;
  if (SHELL_PREFIX.test(trimmed)) return false;
  return ST_RUN_KEYWORDS.test(code);
}

function prepareExecution(code: string): { script: string; injectedProfile: boolean } {
  if (/^\s*logic\b/m.test(code)) {
    return { script: code, injectedProfile: false };
  }

  return {
    script: `${DEFAULT_PROFILE}\n\n${code}`,
    injectedProfile: true
  };
}

interface STDocCodeBlockProps {
  code: string;
  label?: string;
  defaultExpanded?: boolean;
  minEditorHeight?: number;
  runnable?: boolean;
}

export default function STDocCodeBlock({
  code,
  label,
  defaultExpanded = false,
  minEditorHeight = 240,
  runnable
}: STDocCodeBlockProps) {
  const { run, isRunning } = useSTInterpreter();
  const [copied, setCopied] = useState(false);
  const [editorOpen, setEditorOpen] = useState(defaultExpanded);
  const [draft, setDraft] = useState(code);
  const [result, setResult] = useState<STEvalResult | null>(null);
  const [viewMode, setViewMode] = useState<OutputViewMode>('graphic');
  const [injectedProfile, setInjectedProfile] = useState(false);

  const isRunnable = useMemo(() => runnable ?? canRunAsST(code), [code, runnable]);
  const isDirty = draft !== code;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [draft]);

  const handleRun = useCallback(() => {
    if (!isRunnable) return;
    const prepared = prepareExecution(draft);
    setInjectedProfile(prepared.injectedProfile);
    setResult(run(prepared.script));
  }, [draft, isRunnable, run]);

  const handleReset = useCallback(() => {
    setDraft(code);
    setInjectedProfile(false);
    setResult(null);
  }, [code]);

  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const hotkey = event.ctrlKey || event.metaKey;
    if (!hotkey) return;

    const key = event.key.toLowerCase();
    if (key === 'enter') {
      event.preventDefault();
      handleRun();
    }
    if (key === 'r') {
      event.preventDefault();
      handleReset();
    }
  }, [handleReset, handleRun]);

  return (
    <div className="group relative my-3 min-w-0">
      {label && <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-1 font-semibold">{label}</div>}
      <div className="bg-surface-950 border border-surface-700/50 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-surface-800/50 border-b border-surface-700/30">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] text-surface-500 font-mono">st</span>
            {isRunnable && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold">
                ejecutable
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {isRunnable && (
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-surface-300 hover:text-white hover:bg-surface-700/60 transition disabled:opacity-60"
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                {isRunning ? 'Ejecutando' : 'Ejecutar'}
              </button>
            )}
            {isRunnable && (
              <button
                onClick={() => setEditorOpen(prev => !prev)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-surface-300 hover:text-white hover:bg-surface-700/60 transition"
              >
                {editorOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {editorOpen ? 'Ocultar editor' : 'Editar'}
              </button>
            )}
            {editorOpen && (
              <button
                onClick={handleReset}
                disabled={!isDirty && !result}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-surface-300 hover:text-white hover:bg-surface-700/60 transition disabled:opacity-40"
              >
                <RotateCcw className="w-3 h-3" />
                Restaurar
              </button>
            )}
            <button onClick={handleCopy} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-surface-300 hover:text-emerald-400 hover:bg-surface-700/60 transition">
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        {editorOpen ? (
          <div className="border-b border-surface-700/30" style={{ minHeight: `${minEditorHeight}px` }}>
            <STCodeEditor
              value={draft}
              onChange={setDraft}
              onKeyDown={isRunnable ? handleEditorKeyDown : undefined}
              className="min-h-[220px]"
            />
          </div>
        ) : (
          <pre className="p-3 text-sm text-emerald-300 overflow-x-auto leading-relaxed font-mono"><code>{draft}</code></pre>
        )}

        {isRunnable && result && (
          <div className="border-t border-surface-700/30 bg-surface-900/70">
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-surface-700/30">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-surface-200">Resultado inline</p>
                {injectedProfile && (
                  <p className="text-[10px] text-surface-500">
                    Se ejecutó con <code className="text-mandy-300">{DEFAULT_PROFILE}</code> porque el fragmento no declaraba perfil.
                  </p>
                )}
              </div>
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>
            {result.diagnostics && result.diagnostics.length > 0 && (
              <div className="px-3 py-2 border-b border-surface-700/20 text-[11px] text-amber-300">
                {result.diagnostics.length} diagnóstico(s) detectado(s) en la ejecución.
              </div>
            )}
            <div className="p-3 max-h-[28rem] overflow-auto">
              <OutputViewer result={result} mode={viewMode} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
