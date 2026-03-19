'use client';

import React, { useMemo, useState } from 'react';
import { Code2, Eye, Terminal, ChevronRight, ChevronDown } from 'lucide-react';
import type { STEvalResult } from '@stevenvo780/st-lang/api';
import type {
  Formula,
  RunResult,
  TruthTableResult,
  TruthTableRow,
  Proof,
  ProofStep,
  Model,
  Valuation,
  World
} from '@stevenvo780/st-lang/types';

// ── Tipos ───────────────────────────────────────────────────

export type OutputViewMode = 'steps' | 'json' | 'graphic';

export interface STHistoryEntryLike {
  id: number;
  input: string;
  result: STEvalResult;
  timestamp: number;
}

// ── Formula → Unicode (portada de st-lang v1 format.ts) ─────

function collectAssociativeArgs(
  f: Formula,
  kind: 'and' | 'or' | 'xor'
): Formula[] {
  if (f.kind !== kind || !f.args?.length) return [f];

  const items: Formula[] = [];
  for (const arg of f.args) {
    if (!arg) continue;
    items.push(...collectAssociativeArgs(arg, kind));
  }
  return items;
}

function formulaToUnicode(f: Formula): string {
  if (!f) return '?';
  switch (f.kind) {
    case 'atom':
      return f.name ?? '?';
    case 'not': {
      const inner = f.args?.[0];
      return inner
        ? inner.kind === 'atom'
          ? `¬${formulaToUnicode(inner)}`
          : `¬(${formulaToUnicode(inner)})`
        : '¬?';
    }
    case 'and':
      return f.args?.length === 2
        ? `(${collectAssociativeArgs(f, 'and').map(formulaToUnicode).join(' ∧ ')})`
        : '∧?';
    case 'or':
      return f.args?.length === 2
        ? `(${collectAssociativeArgs(f, 'or').map(formulaToUnicode).join(' ∨ ')})`
        : '∨?';
    case 'xor':
      return f.args?.length === 2
        ? `(${collectAssociativeArgs(f, 'xor').map(formulaToUnicode).join(' ⊕ ')})`
        : '⊕?';
    case 'nand':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} ↑ ${formulaToUnicode(f.args[1])})`
        : '↑?';
    case 'nor':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} ↓ ${formulaToUnicode(f.args[1])})`
        : '↓?';
    case 'implies':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} → ${formulaToUnicode(f.args[1])})`
        : '→?';
    case 'biconditional':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} ↔ ${formulaToUnicode(f.args[1])})`
        : '↔?';
    case 'modal_necessity':
      return f.args?.[0] ? `□(${formulaToUnicode(f.args[0])})` : '□?';
    case 'modal_possibility':
      return f.args?.[0] ? `◇(${formulaToUnicode(f.args[0])})` : '◇?';
    case 'temporal_next':
      return f.args?.[0] ? `X(${formulaToUnicode(f.args[0])})` : 'X?';
    case 'temporal_until':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} U ${formulaToUnicode(f.args[1])})`
        : 'U?';
    case 'forall':
      return f.args?.[0]
        ? `∀${f.variable ?? '?'}(${formulaToUnicode(f.args[0])})`
        : '∀?';
    case 'exists':
      return f.args?.[0]
        ? `∃${f.variable ?? '?'}(${formulaToUnicode(f.args[0])})`
        : '∃?';
    case 'predicate':
      return f.name
        ? `${f.name}(${(f.params ?? f.terms ?? []).join(', ')})`
        : 'P?';
    case 'equals':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} = ${formulaToUnicode(f.args[1])})`
        : '=?';
    case 'number':
      return String(f.value ?? '?');
    case 'add':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} + ${formulaToUnicode(f.args[1])})`
        : '+?';
    case 'subtract':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} - ${formulaToUnicode(f.args[1])})`
        : '-?';
    case 'multiply':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} * ${formulaToUnicode(f.args[1])})`
        : '*?';
    case 'divide':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} / ${formulaToUnicode(f.args[1])})`
        : '/?';
    case 'modulo':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} % ${formulaToUnicode(f.args[1])})`
        : '%?';
    case 'less':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} < ${formulaToUnicode(f.args[1])})`
        : '<?';
    case 'greater':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} > ${formulaToUnicode(f.args[1])})`
        : '>?';
    case 'less_eq':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} ≤ ${formulaToUnicode(f.args[1])})`
        : '≤?';
    case 'greater_eq':
      return f.args?.length === 2
        ? `(${formulaToUnicode(f.args[0])} ≥ ${formulaToUnicode(f.args[1])})`
        : '≥?';
    case 'fn_call': {
      const renderedArgs = (f.args ?? []).map(formulaToUnicode).join(', ');
      return `${f.name ?? 'fn'}(${renderedArgs})`;
    }
    default:
      return f.name ?? '?';
  }
}

// ── Selector de modo ────────────────────────────────────────

interface ViewModeToggleProps {
  mode: OutputViewMode;
  onChange: (mode: OutputViewMode) => void;
}

function ViewModeToggle({ mode, onChange }: ViewModeToggleProps) {
  const modes: { key: OutputViewMode; icon: React.ReactNode; label: string }[] = [
    { key: 'steps', icon: <Terminal className="w-3 h-3" />, label: 'Texto' },
    { key: 'graphic', icon: <Eye className="w-3 h-3" />, label: 'Visual' },
    { key: 'json', icon: <Code2 className="w-3 h-3" />, label: 'JSON' }
  ];

  return (
    <div className="flex bg-slate-800/50 rounded p-0.5 gap-0.5">
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
            mode === m.key
              ? 'bg-indigo-600/80 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
          title={m.label}
        >
          {m.icon}
          <span className="hidden sm:inline">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Vista Step-by-step (texto plano coloreado) ──────────────

function OutputLine({ line }: { line: string }) {
  let color = 'text-slate-300';
  if (line.startsWith('✓')) color = 'text-emerald-400';
  else if (line.startsWith('✗')) color = 'text-red-400';
  else if (line.startsWith('◎')) color = 'text-sky-400';
  else if (line.startsWith('⊘')) color = 'text-amber-400';
  else if (line.startsWith('◇') || line.startsWith('□')) {
    color = 'text-violet-400';
  } else if (line.includes('⊛ Designado')) {
    color = 'text-emerald-400';
  } else if (line.includes('Valores designados')) {
    color = 'text-violet-300';
  } else if (line.startsWith('│') || line.startsWith('┌') || line.startsWith('└') || line.startsWith('├')) {
    color = 'text-slate-500';
  } else if (line.startsWith('  ──') || line.startsWith('──')) {
    color = 'text-slate-600';
  }

  return (
    <div className={`font-mono text-xs leading-5 whitespace-pre-wrap ${color}`}>
      {line}
    </div>
  );
}

function StepsView({ stdout, stderr }: { stdout: string; stderr: string }) {
  const lines = stdout.split('\n').filter((l) => l.length > 0);
  const errLines = stderr ? stderr.split('\n').filter((l) => l.length > 0) : [];

  return (
    <div className="space-y-0">
      {lines.map((line, i) => (
        <OutputLine key={i} line={line} />
      ))}
      {errLines.map((line, i) => (
        <div key={`err-${i}`} className="font-mono text-xs leading-5 text-red-400">
          {line}
        </div>
      ))}
    </div>
  );
}

// ── Vista JSON (syntax highlighted) ─────────────────────────

function JsonView({ result }: { result: STEvalResult }) {
  const highlighted = useMemo(() => {
    const json = JSON.stringify(result, null, 2);
    // Simple syntax highlighting via regex
    return json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(
        /("(?:[^"\\]|\\.)*")\s*:/g,
        '<span class="text-sky-400">$1</span>:'
      )
      .replace(
        /:\s*("(?:[^"\\]|\\.)*")/g,
        ': <span class="text-amber-300">$1</span>'
      )
      .replace(
        /:\s*(true|false)/g,
        ': <span class="text-violet-400">$1</span>'
      )
      .replace(
        /:\s*(\d+(?:\.\d+)?)/g,
        ': <span class="text-emerald-400">$1</span>'
      )
      .replace(
        /:\s*(null)/g,
        ': <span class="text-slate-500">$1</span>'
      );
  }, [result]);

  return (
    <pre
      className="font-mono text-[11px] leading-4 text-slate-300 whitespace-pre overflow-auto max-h-full"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

// ── Subcomponentes Gráficos ─────────────────────────────────

/** Indicador de estado lógico */
function StatusChip({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    valid: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '✓ Válido' },
    invalid: { bg: 'bg-red-500/20', text: 'text-red-400', label: '✗ Inválido' },
    satisfiable: { bg: 'bg-sky-500/20', text: 'text-sky-400', label: '◎ Satisfacible' },
    unsatisfiable: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '⊘ Insatisfacible' },
    provable: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '✓ Demostrable' },
    refutable: { bg: 'bg-red-500/20', text: 'text-red-400', label: '✗ Refutable' },
    unknown: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: '? Desconocido' },
    error: { bg: 'bg-red-600/20', text: 'text-red-500', label: '⚠ Error' }
  };
  const s = map[status] ?? map['unknown'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

/** Tabla de verdad visual (soporta clásica V/F y Belnap T/F/B/N) */
function TruthTableView({ table }: { table: TruthTableResult }) {
  // Detectar si es Belnap (4 valores con resultados string)
  const isBelnap = table.rows.length > 0 && typeof table.rows[0].result === 'string'
    && ['T', 'F', 'B', 'N'].includes(table.rows[0].result as string);

  const belnapDesignated = new Set(['T', 'B']);

  function belnapColor(val: string): string {
    switch (val) {
      case 'T': return 'text-emerald-400';
      case 'F': return 'text-red-400';
      case 'B': return 'text-amber-400';
      case 'N': return 'text-slate-400';
      default: return val ? 'text-emerald-400' : 'text-red-400';
    }
  }

  function belnapLabel(val: string): string {
    switch (val) {
      case 'T': return 'T (verdadero)';
      case 'F': return 'F (falso)';
      case 'B': return 'B (ambos)';
      case 'N': return 'N (ninguno)';
      default: return String(val);
    }
  }

  return (
    <div className="overflow-auto">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-400">
          Tabla de verdad{isBelnap ? ' (Belnap 4-valores)' : ''}
        </span>
        {table.isTautology && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
            Tautología
          </span>
        )}
        {table.isContradiction && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
            Contradicción
          </span>
        )}
        {!table.isTautology && !table.isContradiction && table.isSatisfiable && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-medium">
            Contingente
          </span>
        )}
        {isBelnap && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-medium">
            Designados: {'{'} T, B {'}'}
          </span>
        )}
      </div>
      <table className="text-[11px] font-mono border-collapse">
        <thead>
          <tr>
            {table.variables.map((v) => (
              <th
                key={v}
                className="px-2 py-1 text-slate-400 font-semibold border-b border-slate-700 text-center"
              >
                {v}
              </th>
            ))}
            <th className="px-3 py-1 text-indigo-400 font-bold border-b border-l border-slate-700 text-center">
              Resultado
            </th>
            {isBelnap && (
              <th className="px-2 py-1 text-violet-400 font-semibold border-b border-l border-slate-700 text-center">
                ⊛
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row: TruthTableRow, i: number) => {
            const resStr = typeof row.result === 'string' ? row.result : (row.result ? 'T' : 'F');
            const resBoolean = typeof row.result === 'boolean' ? row.result : row.result === 'T';
            const isDesignated = isBelnap && belnapDesignated.has(resStr);

            return (
              <tr
                key={i}
                className={`${
                  i % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-800/20'
                } hover:bg-slate-700/30 transition-colors ${isDesignated ? 'ring-1 ring-inset ring-emerald-500/20' : ''}`}
              >
                {table.variables.map((v) => {
                  const val = row.valuation[v];
                  if (isBelnap && typeof val === 'string') {
                    return (
                      <td key={v} className={`px-2 py-0.5 text-center ${belnapColor(val)}`}>
                        {val}
                      </td>
                    );
                  }
                  return (
                    <td
                      key={v}
                      className={`px-2 py-0.5 text-center ${
                        val ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {val ? 'V' : 'F'}
                    </td>
                  );
                })}
                <td
                  className={`px-3 py-0.5 text-center font-bold border-l border-slate-700 ${
                    isBelnap ? belnapColor(resStr) : (resBoolean ? 'text-emerald-400' : 'text-red-400')
                  }`}
                >
                  {isBelnap ? resStr : (resBoolean ? 'V' : 'F')}
                </td>
                {isBelnap && (
                  <td className={`px-2 py-0.5 text-center border-l border-slate-700 ${isDesignated ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {isDesignated ? '⊛' : '·'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {isBelnap && (
        <div className="mt-2 text-[10px] text-slate-500">
          ⊛ = Designado (portador de verdad). Valores designados: {'{'} T, B {'}'}.
          <span className="ml-2">
            T = verdadero · F = falso · B = ambos (⊤) · N = ninguno (⊥)
          </span>
        </div>
      )}
    </div>
  );
}

/** Vista de prueba / demostración */
function ProofView({ proof }: { proof: Proof }) {
  const statusColor =
    proof.status === 'complete'
      ? 'text-emerald-400'
      : proof.status === 'failed'
        ? 'text-red-400'
        : 'text-amber-400';

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-400">Demostración</span>
        <span className={`text-[10px] font-medium ${statusColor}`}>
          [{proof.status === 'complete' ? 'Completa' : proof.status === 'failed' ? 'Fallida' : 'Incompleta'}]
        </span>
      </div>
      <div className="text-xs text-slate-400 mb-2">
        Meta: <span className="text-indigo-300 font-mono">{formulaToUnicode(proof.goal)}</span>
      </div>
      <div className="space-y-0.5">
        {proof.steps.map((step: ProofStep) => (
          <div
            key={step.stepNumber}
            className="flex items-start gap-2 py-0.5 hover:bg-slate-800/40 rounded px-1 transition-colors"
          >
            <span className="text-slate-600 font-mono text-[10px] w-5 text-right flex-shrink-0">
              {step.stepNumber}.
            </span>
            <span className="text-indigo-300 font-mono text-[11px] flex-1">
              {formulaToUnicode(step.formula)}
            </span>
            <span className="text-slate-500 text-[10px] flex-shrink-0">
              {step.justification}
              {step.premises.length > 0 && (
                <span className="text-slate-600 ml-1">
                  [{step.premises.join(', ')}]
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Vista de modelo */
function ModelView({ model }: { model: Model }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-slate-400">Modelo</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
          {model.type}
        </span>
      </div>

      {/* Valuación proposicional */}
      {model.valuation && (
        <ValuationGrid label="Valuación" valuation={model.valuation} />
      )}

      {/* Dominio */}
      {model.domain && model.domain.length > 0 && (
        <div className="text-xs text-slate-400 mt-1">
          Dominio:{' '}
          <span className="text-slate-300 font-mono">
            {'{'}{model.domain.join(', ')}{'}'}
          </span>
        </div>
      )}

      {/* Mundos (Kripke) */}
      {model.worlds && model.worlds.length > 0 && (
        <div className="mt-2 space-y-2">
          {model.worlds.map((w: World) => (
            <div
              key={w.name}
              className="border border-slate-700/50 rounded p-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold text-violet-400">
                  Mundo {w.name}
                </span>
                {w.accessible.length > 0 && (
                  <span className="text-[10px] text-slate-500">
                    → {w.accessible.join(', ')}
                  </span>
                )}
              </div>
              <ValuationGrid valuation={w.valuation} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Grid de valuación p:V / q:F (soporta Belnap strings T/F/B/N) */
function ValuationGrid({ label, valuation }: { label?: string; valuation: Valuation }) {
  const entries = Object.entries(valuation);
  if (entries.length === 0) return null;

  function valColor(val: unknown): string {
    if (typeof val === 'string') {
      switch (val) {
        case 'T': return 'bg-emerald-500/10 text-emerald-400';
        case 'F': return 'bg-red-500/10 text-red-400';
        case 'B': case 'Both': return 'bg-amber-500/10 text-amber-400';
        case 'N': case 'Neither': return 'bg-slate-500/10 text-slate-400';
        default: return 'bg-slate-500/10 text-slate-300';
      }
    }
    return val ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400';
  }

  function valLabel(val: unknown): string {
    if (typeof val === 'string') return val;
    return val ? 'V' : 'F';
  }

  return (
    <div>
      {label && (
        <span className="text-[10px] text-slate-500 block mb-0.5">{label}</span>
      )}
      <div className="flex flex-wrap gap-1">
        {entries.map(([key, val]) => (
          <span
            key={key}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${valColor(val)}`}
          >
            <span className="text-slate-400">{key}</span>
            <span className="font-bold">{valLabel(val)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Fórmula grande renderizada en Unicode */
function FormulaDisplay({ formula, label }: { formula: Formula; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-[10px] text-slate-500">{label}</span>
      )}
      <span className="text-indigo-300 font-mono text-sm">
        {formulaToUnicode(formula)}
      </span>
    </div>
  );
}

// ── RunResult individual (tarjeta gráfica) ──────────────────

function RunResultCard({ result, index }: { result: RunResult; index: number }) {
  const [expanded, setExpanded] = useState(true);

  const hasRichContent = result.proof || result.truthTable || result.model || result.formula;

  return (
    <div className="border border-slate-700/40 rounded-lg overflow-hidden bg-slate-900/30 mb-2">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-slate-800/40 transition-colors"
      >
        {hasRichContent ? (
          expanded ? (
            <ChevronDown className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-500" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="text-slate-600 text-[10px] font-mono">#{index + 1}</span>
        <StatusChip status={result.status} />
        {result.formula && (
          <span className="text-indigo-300/70 font-mono text-[11px] truncate max-w-[300px]">
            {formulaToUnicode(result.formula)}
          </span>
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-2 space-y-3">
          {/* Output text si no hay datos ricos */}
          {result.output && !hasRichContent && (
            <div className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-5">
              {result.output}
            </div>
          )}

          {/* Fórmula principal */}
          {result.formula && (
            <FormulaDisplay formula={result.formula} label="Fórmula:" />
          )}

          {/* Tabla de verdad */}
          {result.truthTable && <TruthTableView table={result.truthTable} />}

          {/* Prueba */}
          {result.proof && <ProofView proof={result.proof} />}

          {/* Modelo */}
          {result.model && <ModelView model={result.model} />}

          {/* Output text adicional si también hay datos ricos */}
          {result.output && hasRichContent && (
            <details className="group">
              <summary className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-300 transition-colors">
                Salida texto
              </summary>
              <div className="font-mono text-[11px] text-slate-400 whitespace-pre-wrap leading-4 mt-1">
                {result.output}
              </div>
            </details>
          )}

          {/* Diagnósticos del resultado individual */}
          {result.diagnostics.length > 0 && (
            <div className="space-y-0.5 mt-1">
              {result.diagnostics.map((d, i) => (
                <div
                  key={i}
                  className={`text-[10px] font-mono ${
                    d.severity === 'error'
                      ? 'text-red-400'
                      : d.severity === 'warning'
                        ? 'text-amber-400'
                        : 'text-slate-500'
                  }`}
                >
                  {d.severity === 'error' ? '✗' : d.severity === 'warning' ? '⚠' : 'ℹ'}{' '}
                  {d.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Vista gráfica completa de un STEvalResult ───────────────

function GraphicView({ result }: { result: STEvalResult }) {
  const { results, stderr } = result;

  if (results.length === 0 && !stderr) {
    return (
      <div className="text-xs text-slate-500 italic py-2">
        Sin resultados estructurados. Prueba la vista &quot;Texto&quot;.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {results.map((r, i) => (
        <RunResultCard key={i} result={r} index={i} />
      ))}
      {stderr && (
        <div className="font-mono text-xs text-red-400 whitespace-pre-wrap border-t border-red-500/20 pt-1 mt-1">
          {stderr}
        </div>
      )}
    </div>
  );
}

// ── Componente principal: OutputViewer ───────────────────────

interface OutputViewerProps {
  result: STEvalResult;
  mode: OutputViewMode;
}

export function OutputViewer({ result, mode }: OutputViewerProps) {
  switch (mode) {
    case 'steps':
      return <StepsView stdout={result.stdout} stderr={result.stderr} />;
    case 'json':
      return <JsonView result={result} />;
    case 'graphic':
      return <GraphicView result={result} />;
  }
}

// ── Export del toggle ───────────────────────────────────────

export { ViewModeToggle };
