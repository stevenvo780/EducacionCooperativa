'use client';

import { useMemo } from 'react';
import type { StPlaygroundEvalResult } from '@/lib/st-eval';

interface ProofTreeViewProps {
  result: StPlaygroundEvalResult['results'][number] | null;
  fullResult: StPlaygroundEvalResult;
}

interface ParsedStep {
  num: number;
  formula: string;
  justification: string;
  premises: number[];
}

/**
 * Extrae pasos numerados de la salida textual del proof. La API
 * `evaluate()` ya formatea con líneas tipo "  1. P -> Q [premise:a1]"
 * o "  3. Q [modus_ponens 1,2]"; las parseamos para dibujar SVG.
 */
function parseProofSteps(output: string | undefined): ParsedStep[] {
  if (!output) return [];
  const steps: ParsedStep[] = [];
  const re =
    /^\s*(\d+)\.\s+([^\n[]+?)\s*\[([^\]]+)\]\s*$/;
  for (const rawLine of output.split('\n')) {
    const match = re.exec(rawLine);
    if (!match) continue;
    const numStr = match[1] ?? '';
    const formula = (match[2] ?? '').trim();
    const justification = (match[3] ?? '').trim();
    const num = Number(numStr);
    if (!Number.isFinite(num)) continue;
    const premises: number[] = [];
    for (const p of justification.matchAll(/\b(\d+)\b/g)) {
      const v = Number(p[1]);
      if (Number.isFinite(v) && v !== num) premises.push(v);
    }
    steps.push({ num, formula, justification, premises });
  }
  return steps;
}

export default function ProofTreeView({
  result,
  fullResult
}: ProofTreeViewProps) {
  const steps = useMemo(
    () => parseProofSteps(result?.output),
    [result?.output]
  );

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8 text-center text-xs text-slate-500">
        Ningún resultado produjo un proof tree.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex items-center gap-2 border-b border-slate-800/60 px-3 py-2">
        <span className="font-mono text-slate-400">status:</span>
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-emerald-300">
          {result.status}
        </span>
        {result.reasoningType && (
          <span className="rounded bg-violet-500/15 px-2 py-0.5 font-mono text-violet-300">
            {result.reasoningType}
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          {steps.length} pasos · {fullResult.results.length} resultados
        </span>
      </div>
      {steps.length === 0 ? (
        <div className="flex-1 overflow-auto px-3 py-2">
          <pre className="whitespace-pre-wrap rounded border border-slate-800 bg-slate-900/60 p-3 font-mono text-[12px] text-slate-100">
            {result.output ?? '(sin output)'}
          </pre>
        </div>
      ) : (
        <ProofSvg steps={steps} />
      )}
    </div>
  );
}

const NODE_WIDTH = 220;
const NODE_HEIGHT = 56;
const ROW_HEIGHT = 90;
const COL_GAP = 32;

function ProofSvg({ steps }: { steps: ParsedStep[] }) {
  // Layout: cada paso ocupa una fila; los nodos se agrupan por "rama"
  // según el primer premise referenced. Si un step no tiene premises,
  // empieza columna nueva.
  const positions = useMemo(() => {
    const cols = new Map<number, number>(); // step.num → col index
    let nextCol = 0;
    for (const s of steps) {
      const firstPremise = s.premises[0];
      const col =
        firstPremise !== undefined && cols.has(firstPremise)
          ? cols.get(firstPremise)!
          : nextCol++;
      cols.set(s.num, col);
    }
    const maxCol = Math.max(0, ...Array.from(cols.values())) + 1;
    return { cols, maxCol };
  }, [steps]);

  const width = positions.maxCol * (NODE_WIDTH + COL_GAP) + COL_GAP;
  const height = steps.length * ROW_HEIGHT + ROW_HEIGHT / 2;
  const nodeLayout = steps.map((step, i) => {
    const col = positions.cols.get(step.num) ?? 0;
    return {
      step,
      x: col * (NODE_WIDTH + COL_GAP) + COL_GAP,
      y: i * ROW_HEIGHT + 16,
      col
    };
  });
  const nodeByNum = new Map(nodeLayout.map((n) => [n.step.num, n]));

  return (
    <div className="flex-1 overflow-auto">
      <svg
        width={width}
        height={height}
        className="block min-w-full"
        role="img"
        aria-label="Proof tree"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
          </marker>
        </defs>
        {nodeLayout.map((n) =>
          n.step.premises.map((p) => {
            const from = nodeByNum.get(p);
            if (!from) return null;
            const x1 = from.x + NODE_WIDTH / 2;
            const y1 = from.y + NODE_HEIGHT;
            const x2 = n.x + NODE_WIDTH / 2;
            const y2 = n.y;
            const cx = (x1 + x2) / 2;
            return (
              <path
                key={`${p}-${n.step.num}`}
                d={`M ${x1} ${y1} C ${x1} ${cx > x1 ? y1 + 24 : y1 + 24}, ${x2} ${y2 - 24}, ${x2} ${y2}`}
                stroke="#475569"
                strokeWidth={1.5}
                fill="none"
                markerEnd="url(#arrow)"
              />
            );
          })
        )}
        {nodeLayout.map((n) => (
          <g key={n.step.num} transform={`translate(${n.x}, ${n.y})`}>
            <rect
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={8}
              ry={8}
              fill="#0f172a"
              stroke="#7c3aed"
              strokeOpacity={0.4}
              strokeWidth={1}
            />
            <text
              x={10}
              y={18}
              fontFamily="ui-monospace, monospace"
              fontSize={10}
              fill="#a78bfa"
            >
              #{n.step.num}
            </text>
            <text
              x={NODE_WIDTH - 10}
              y={18}
              fontFamily="ui-monospace, monospace"
              fontSize={9}
              fill="#64748b"
              textAnchor="end"
            >
              {n.step.justification}
            </text>
            <text
              x={NODE_WIDTH / 2}
              y={42}
              fontFamily="ui-monospace, monospace"
              fontSize={12}
              fill="#e2e8f0"
              textAnchor="middle"
            >
              {clampText(n.step.formula, 28)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function clampText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
