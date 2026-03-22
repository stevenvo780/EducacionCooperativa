'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, RotateCcw, Trash2, Zap, BookOpen, Terminal, AlertTriangle, List, Info, ChevronUp, ChevronDown, Save, Loader2, Check, X, Lightbulb } from 'lucide-react';
import { useSTInterpreter, type STHistoryEntry } from '@/hooks/useSTInterpreter';
import type { Diagnostic, STEvalResult, SymbolInfo } from '@stevenvo780/st-lang/api';
import STCodeEditor from '@/components/editor/STCodeEditor';
import EditorSettingsMenu from '@/components/editor/EditorSettingsMenu';
import { type EditorConfig, loadConfig, isTouchDeviceProfile } from '@/components/editor/codemirror';
import { OutputViewer, ViewModeToggle, type OutputViewMode } from '@/components/editor/STOutputViewer';
import { STDefinitionsRegistry } from '@/lib/st-definitions-registry';
import SnippetGallery from '@/components/SnippetGallery';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

// ── Constantes ──────────────────────────────────────────────

const DEFAULT_SCRIPT = `// ST — Motor de Lógica Formal
// Escribe tu script ST aquí

logic classical.propositional

// Declara axiomas
axiom a1 : P -> Q
axiom a2 : P

// Deriva por Modus Ponens
derive Q from {a1, a2}

// Verifica tautología
check valid ((P -> Q) -> (!Q -> !P))

// Tabla de verdad
truth_table (P & Q)
`;

function runWhenBrowserIdle(task: () => void, timeout: number): () => void {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const idleId = window.requestIdleCallback(task, { timeout });
    return () => window.cancelIdleCallback(idleId);
  }

  const timer = globalThis.setTimeout(task, 0);
  return () => globalThis.clearTimeout(timer);
}

// ── Subcomponentes ──────────────────────────────────────────

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        ok
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-red-500/20 text-red-400'
      }`}
    >
      {ok ? <><Check className="w-3 h-3 inline mr-1" />OK</> : <><X className="w-3 h-3 inline mr-1" />Error</>}
    </span>
  );
}

function HistoryPanel({ entries, viewMode }: { entries: STHistoryEntry[]; viewMode: OutputViewMode }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Ejecuta código ST para ver resultados aquí
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-2 p-2">
      {entries.map(entry => (
        <div key={entry.id} className="border border-slate-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/50 border-b border-slate-700">
            <code className="text-xs text-slate-400 truncate max-w-[70%]">
              {entry.input.split('\n')[0]}
              {entry.input.includes('\n') ? ' ...' : ''}
            </code>
            <StatusBadge ok={entry.result.ok} />
          </div>
          <div className="p-3 bg-slate-900/50 text-sm">
            <OutputViewer result={entry.result} mode={viewMode} />
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function ProblemsPanel({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <Info className="w-4 h-4 mr-2" />
        Sin diagnósticos
      </div>
    );
  }

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <X className="w-3 h-3 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-3 h-3 text-amber-400" />;
      case 'hint': return <Info className="w-3 h-3 text-blue-400" />;
      default: return <span className="text-slate-400">·</span>;
    }
  };

  const severityClass = (severity: string) => {
    switch (severity) {
      case 'error': return 'border-red-800/50 bg-red-950/30';
      case 'warning': return 'border-amber-800/50 bg-amber-950/30';
      default: return 'border-blue-800/50 bg-blue-950/30';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {diagnostics.map((d, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 px-3 py-2 rounded border text-xs ${severityClass(d.severity)}`}
        >
          <span className="mt-0.5 flex-shrink-0">{severityIcon(d.severity)}</span>
          <div className="flex-1 min-w-0">
            <span className="text-slate-200">{d.message}</span>
            {d.line && (
              <span className="text-slate-500 ml-2">línea {d.line}{d.column ? `:${d.column}` : ''}</span>
            )}
            {d.code && (
              <span className="text-slate-600 ml-2">[{d.code}]</span>
            )}
            {d.suggestion && (
              <div className="flex items-start gap-1 text-cyan-400/80 mt-0.5"><Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />{d.suggestion}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SymbolsPanel({ symbolsList }: { symbolsList: SymbolInfo[] }) {
  if (symbolsList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        <List className="w-4 h-4 mr-2" />
        Sin símbolos definidos
      </div>
    );
  }

  const kindBadge = (kind: string) => {
    const colors: Record<string, string> = {
      axiom: 'bg-emerald-500/20 text-emerald-400',
      theorem: 'bg-blue-500/20 text-blue-400',
      claim: 'bg-purple-500/20 text-purple-400',
      passage: 'bg-amber-500/20 text-amber-400',
      variable: 'bg-slate-500/20 text-slate-400',
      formula: 'bg-cyan-500/20 text-cyan-400'
    };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${colors[kind] || colors.variable}`}>
        {kind}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {symbolsList.map((sym, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-1.5 rounded border border-slate-800 bg-slate-900/50 text-xs hover:bg-slate-800/50 transition-colors"
        >
          {kindBadge(sym.kind)}
          <span className="text-slate-200 font-mono">{sym.name}</span>
          {sym.location?.line && (
            <span className="text-slate-600 ml-auto">:{sym.location.line}</span>
          )}
        </div>
      ))}
    </div>
  );
}

type OutputTab = 'output' | 'problems' | 'symbols';

// ── Componente principal ────────────────────────────────────

export type STRunnerMode = 'script' | 'repl';

interface STRunnerProps {
  /** Código inicial */
  initialCode?: string;
  /** Modo inicial */
  initialMode?: STRunnerMode;
  /** Altura del componente (CSS) */
  height?: string;
  /** Callback cuando se ejecuta código */
  onExecute?: (code: string, result: STEvalResult) => void;
  /** Clase CSS extra */
  className?: string;
  /** Workspace para snippets dinámicos */
  workspaceId?: string;
  /** Modo editor de archivo: permite guardar y manejar cambios externos */
  fileMode?: {
    docName: string;
    isDirty: boolean;
    isSaving: boolean;
    onSave: () => void;
    onContentChange: (content: string) => void;
  };
}

export default function STRunner({
  initialCode,
  initialMode = 'script',
  height = '100%',
  onExecute,
  className = '',
  workspaceId = PERSONAL_WORKSPACE_ID,
  fileMode
}: STRunnerProps) {
  const { run, execLine, quick, reset, history, clearHistory, theorySummary, profiles, isRunning, getSymbols, validate, lastDiagnostics } =
    useSTInterpreter();

  const [mode, setMode] = useState<STRunnerMode>(initialMode);
  const [internalCode, setInternalCode] = useState(initialCode || DEFAULT_SCRIPT);

  // Use fileMode content if available, otherwise internal
  const code = fileMode ? initialCode || '' : internalCode;
  const setCode = useCallback((val: string) => {
    if (fileMode) {
      fileMode.onContentChange(val);
    } else {
      setInternalCode(val);
    }
  }, [fileMode]);

  const replInputRef = useRef<HTMLInputElement>(null);
  const [replInput, setReplInput] = useState('');
  const [replHistory, setReplHistory] = useState<string[]>([]);
  const [replHistoryIdx, setReplHistoryIdx] = useState(-1);
  const [activeTab, setActiveTab] = useState<OutputTab>('output');
  const [currentSymbols, setCurrentSymbols] = useState<SymbolInfo[]>([]);
  const [viewMode, setViewMode] = useState<OutputViewMode>('graphic');
  const [outputHeight, setOutputHeight] = useState(300); // Height of the output panel in pixels
  const [showOutput, setShowOutput] = useState(true);
  const [isResizingOutput, setIsResizingOutput] = useState(false);
  const [editorConfig, setEditorConfig] = useState<EditorConfig>(loadConfig);
  const isTouchTablet = useMemo(() => isTouchDeviceProfile(), []);
  const [showSnippetGallery, setShowSnippetGallery] = useState(false);

  const runAnalysis = useCallback(() => {
    const diagnostics = validate(code);
    const symbols = getSymbols(code);
    setCurrentSymbols(symbols);
    setActiveTab(diagnostics.length > 0 ? 'problems' : symbols.length > 0 ? 'symbols' : 'output');
    return diagnostics;
  }, [code, getSymbols, validate]);

  // ── Background Validation ──
  useEffect(() => {
    if (mode !== 'script' || isTouchTablet) return;

    let cancelIdleTask = () => {};
    const timer = window.setTimeout(() => {
      cancelIdleTask = runWhenBrowserIdle(() => {
        runAnalysis();
      }, 1200);
    }, 900);

    return () => {
      window.clearTimeout(timer);
      cancelIdleTask();
    };
  }, [code, isTouchTablet, mode, runAnalysis]);

  // ── Sync ST definitions to cross-doc registry ──
  useEffect(() => {
    const fileId = fileMode?.docName || 'st-runner-scratch';
    const defs = STDefinitionsRegistry.extractFromSource(code, fileId);
    STDefinitionsRegistry.setFileDefinitions(fileId, defs);
    return () => { STDefinitionsRegistry.removeFile(fileId); };
  }, [code, fileMode?.docName]);

  const startResizingOutput = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingOutput(true);
  }, []);

  const stopResizingOutput = useCallback(() => {
    setIsResizingOutput(false);
  }, []);

  const resizeOutput = useCallback((e: MouseEvent) => {
    if (isResizingOutput) {
      // Invert Y calculation since panel is at the bottom
      const container = document.querySelector('.st-runner-body');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newHeight = rect.bottom - e.clientY;
        if (newHeight >= 100 && newHeight <= rect.height - 100) {
          setOutputHeight(newHeight);
        }
      }
    }
  }, [isResizingOutput]);

  useEffect(() => {
    if (isResizingOutput) {
      window.addEventListener('mousemove', resizeOutput);
      window.addEventListener('mouseup', stopResizingOutput);
    } else {
      window.removeEventListener('mousemove', resizeOutput);
      window.removeEventListener('mouseup', stopResizingOutput);
    }
    return () => {
      window.removeEventListener('mousemove', resizeOutput);
      window.removeEventListener('mouseup', stopResizingOutput);
    };
  }, [isResizingOutput, resizeOutput, stopResizingOutput]);

  // ── Ejecutar script completo ──
  const handleRun = useCallback(() => {
    const result = run(code);
    setCurrentSymbols(getSymbols(code));
    if (result.diagnostics && result.diagnostics.length > 0) {
      setActiveTab('problems');
    } else {
      setActiveTab('output');
    }
    onExecute?.(code, result);
  }, [code, run, getSymbols, onExecute]);

  const handleAnalyze = useCallback(() => {
    runAnalysis();
  }, [runAnalysis]);

  const handleInsertSnippet = useCallback((snippetContent: string) => {
    const normalized = snippetContent.trim();
    if (!normalized) return;
    const nextCode = code.trim()
      ? `${code.replace(/\s+$/, '')}\n\n${normalized}\n`
      : `${normalized}\n`;
    setCode(nextCode);
  }, [code, setCode]);

  // ── Ejecutar línea REPL ──
  const handleReplSubmit = useCallback(() => {
    const line = replInput.trim();
    if (!line) return;

    const result = execLine(line);
    onExecute?.(line, result);
    setReplHistory(prev => [...prev, line]);
    setReplHistoryIdx(-1);
    setReplInput('');
  }, [replInput, execLine, onExecute]);

  // ── Quick eval ──
  const handleQuickEval = useCallback(() => {
    const expr = replInput.trim();
    if (!expr) return;
    const result = quick(expr);
    onExecute?.(expr, result);
    setReplHistory(prev => [...prev, expr]);
    setReplHistoryIdx(-1);
    setReplInput('');
  }, [replInput, quick, onExecute]);

  // ── Navegación historial REPL ──
  const handleReplKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleReplSubmit();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (replHistory.length > 0) {
          const newIdx =
            replHistoryIdx === -1
              ? replHistory.length - 1
              : Math.max(0, replHistoryIdx - 1);
          setReplHistoryIdx(newIdx);
          setReplInput(replHistory[newIdx]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (replHistoryIdx >= 0) {
          const newIdx = replHistoryIdx + 1;
          if (newIdx >= replHistory.length) {
            setReplHistoryIdx(-1);
            setReplInput('');
          } else {
            setReplHistoryIdx(newIdx);
            setReplInput(replHistory[newIdx]);
          }
        }
      }
    },
    [handleReplSubmit, replHistory, replHistoryIdx]
  );

  // ── Atajos de teclado ──
  const handleCodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && fileMode) {
        e.preventDefault();
        fileMode.onSave();
      }
      // Tab → 2 espacios
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const value = ta.value;
        setCode(`${value.substring(0, start)}  ${value.substring(end)}`);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    },
    [fileMode, handleRun, setCode]
  );

  // ── Resumen de teoría (sidebar info) ──
  const theoryInfo = useMemo(() => {
    if (!theorySummary) return null;
    return (
      <div className="text-xs text-slate-500 px-3 py-1 border-t border-slate-700 flex gap-3 flex-wrap">
        {theorySummary.profile && (
          <span>
            Perfil: <span className="text-slate-400">{theorySummary.profile}</span>
          </span>
        )}
        {theorySummary.axioms.length > 0 && (
          <span>
            Axiomas: <span className="text-emerald-400">{theorySummary.axioms.length}</span>
          </span>
        )}
        {theorySummary.theorems.length > 0 && (
          <span>
            Teoremas: <span className="text-blue-400">{theorySummary.theorems.length}</span>
          </span>
        )}
        {theorySummary.claims.length > 0 && (
          <span>
            Claims: <span className="text-purple-400">{theorySummary.claims.length}</span>
          </span>
        )}
      </div>
    );
  }, [theorySummary]);

  return (
    <div
      className={`flex flex-col bg-slate-950 text-slate-200 border border-slate-800 rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    >
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        {fileMode ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-slate-400 font-mono truncate max-w-[200px]" title={fileMode.docName}>
              {fileMode.docName}
            </span>
            <button
              onClick={fileMode.onSave}
              disabled={fileMode.isSaving || !fileMode.isDirty}
              className={`flex items-center gap-1.5 px-2 py-1 text-[10px] rounded transition ${
                fileMode.isDirty
                  ? 'bg-sky-600/20 text-sky-400 hover:bg-sky-600/30'
                  : 'bg-slate-800 text-slate-500 cursor-default'
              }`}
              title="Guardar (Ctrl+S)"
            >
              {fileMode.isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {fileMode.isSaving ? '...' : fileMode.isDirty ? 'Guardar' : 'Guardado'}
            </button>
          </div>
        ) : (
          <div className="flex bg-slate-800 rounded-md p-0.5">
            <button
              onClick={() => setMode('script')}
              className={`px-3 py-1 text-xs rounded ${
                mode === 'script'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 inline mr-1" />
              Script
            </button>
            <button
              onClick={() => setMode('repl')}
              className={`px-3 py-1 text-xs rounded ${
                mode === 'repl'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 inline mr-1" />
              REPL
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* Actions */}
        {(mode === 'script' || !!fileMode) && (
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md transition-colors"
            title="Ejecutar (Ctrl+Enter)"
          >
            <Play className="w-3.5 h-3.5" />
            Ejecutar
          </button>
        )}

        {mode === 'script' && isTouchTablet && (
          <button
            onClick={handleAnalyze}
            disabled={isRunning}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-sky-600/20 hover:bg-sky-600/30 disabled:bg-slate-700 disabled:text-slate-500 text-sky-300 rounded-md transition-colors"
            title="Analizar sintaxis y símbolos"
          >
            <Zap className="w-3.5 h-3.5" />
            Analizar
          </button>
        )}

        <button
          onClick={() => { reset(); clearHistory(); }}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          title="Reiniciar"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={clearHistory}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          title="Limpiar salida"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setShowSnippetGallery((current) => !current)}
          className={`p-1.5 rounded transition ${showSnippetGallery ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          title={showSnippetGallery ? 'Ocultar snippets ST' : 'Mostrar snippets ST'}
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>

        <EditorSettingsMenu config={editorConfig} onChange={setEditorConfig} />
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {showSnippetGallery && (
          <div className="w-80 shrink-0 border-r border-slate-800 overflow-y-auto bg-slate-900">
            <SnippetGallery
              workspaceId={workspaceId}
              allowedCategories={['st']}
              title="Snippets ST"
              emptyLabel="Todavía no hay snippets ST en este workspace."
              onInsert={handleInsertSnippet}
              onClose={() => setShowSnippetGallery(false)}
            />
          </div>
        )}

        <div className="flex flex-col flex-1 overflow-hidden st-runner-body relative">
          {/* Global overlay during output resizing to prevent iframe interference */}
          {isResizingOutput && (
            <div
              className="fixed inset-0 z-[100] cursor-row-resize"
              onMouseUp={stopResizingOutput}
            />
          )}
          {mode === 'script' ? (
            /* Script mode: editor arriba, output con tabs abajo */
            <>
              <div className="flex-1 min-h-[100px] border-b border-slate-800 relative">
                <STCodeEditor
                  value={code}
                  onChange={setCode}
                  onKeyDown={handleCodeKeyDown}
                  placeholder="// Escribe tu script ST aquí..."
                  className="bg-slate-950 h-full"
                  diagnostics={lastDiagnostics}
                  editorConfig={editorConfig}
                />
              </div>

              {/* Resize Handle and Tabs */}
              <div className="flex flex-col flex-shrink-0 bg-slate-900 border-t border-slate-800">
                {/* Actual resize handle bar */}
                <div
                  onMouseDown={startResizingOutput}
                  className={`h-1 cursor-row-resize hover:bg-indigo-500/50 transition-colors ${isResizingOutput ? 'bg-indigo-500' : 'bg-transparent'}`}
                  title="Redimensionar salida"
                />

                <div className="flex items-center gap-0 border-b border-slate-800 px-1">
                  <button
                    onClick={() => setActiveTab('output')}
                    className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
                      activeTab === 'output'
                        ? 'border-indigo-500 text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Terminal className="w-3 h-3 inline mr-1" />
                    Salida
                  </button>
                  <button
                    onClick={() => setActiveTab('problems')}
                    className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
                      activeTab === 'problems'
                        ? 'border-amber-500 text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Problemas
                    {lastDiagnostics.length > 0 && (
                      <span className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                        lastDiagnostics.some(d => d.severity === 'error')
                          ? 'bg-red-500/30 text-red-400'
                          : 'bg-amber-500/30 text-amber-400'
                      }`}>
                        {lastDiagnostics.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveTab('symbols')}
                    className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
                      activeTab === 'symbols'
                        ? 'border-emerald-500 text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <List className="w-3 h-3 inline mr-1" />
                    Símbolos
                    {currentSymbols.length > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-400">
                        {currentSymbols.length}
                      </span>
                    )}
                  </button>
                  <div className="flex-1" />
                  {activeTab === 'output' && (
                    <ViewModeToggle mode={viewMode} onChange={setViewMode} />
                  )}
                  <button
                    onClick={() => setShowOutput(prev => !prev)}
                    className="px-3 py-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    title={showOutput ? 'Ocultar panel' : 'Mostrar panel'}
                  >
                    {showOutput ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </button>
                </div>

                {showOutput && (
                  <div style={{ height: outputHeight }} className="flex flex-col bg-slate-900/50 overflow-hidden flex-shrink-0">
                    {activeTab === 'output' && <HistoryPanel entries={history} viewMode={viewMode} />}
                    {activeTab === 'problems' && <ProblemsPanel diagnostics={lastDiagnostics} />}
                    {activeTab === 'symbols' && <SymbolsPanel symbolsList={currentSymbols} />}
                  </div>
                )}
              </div>
            </>
          ) : (
          /* REPL mode: output arriba, input abajo */
          <>
            <HistoryPanel entries={history} viewMode={viewMode} />
            {theoryInfo}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-t border-slate-800 flex-shrink-0">
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              <span className="text-emerald-400 font-mono text-sm">st&gt;</span>
              <input
                ref={replInputRef}
                value={replInput}
                onChange={e => setReplInput(e.target.value)}
                onKeyDown={handleReplKeyDown}
                className="flex-1 bg-transparent text-slate-200 font-mono text-sm focus:outline-none"
                placeholder="check valid (P -> P)"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                onClick={handleQuickEval}
                className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-slate-800"
                title="Quick eval (auto classical.propositional)"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button
                onClick={handleReplSubmit}
                disabled={!replInput.trim()}
                className="p-1 text-emerald-400 hover:text-emerald-300 disabled:text-slate-600 rounded hover:bg-slate-800"
                title="Ejecutar (Enter)"
              >
                <Play className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
