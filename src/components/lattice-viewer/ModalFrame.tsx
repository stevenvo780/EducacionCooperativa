'use client';

const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;
const RADIUS = 140;
const NODE_R = 20;

export interface ModalFrameProps {
  worlds: string[];
  accessibility: Array<[string, string]>;
}

function worldPosition(
  index: number,
  total: number
): { x: number; y: number } {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle)
  };
}

interface StraightEdgeProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function StraightEdge({ x1, y1, x2, y2 }: StraightEdgeProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return null;
  const nx = dx / dist;
  const ny = dy / dist;
  const offset = NODE_R + 3;
  return (
    <line
      x1={x1 + nx * offset}
      y1={y1 + ny * offset}
      x2={x2 - nx * offset}
      y2={y2 - ny * offset}
      stroke="#a855f7"
      strokeWidth={2}
      markerEnd="url(#arrow-modal)"
      opacity={0.85}
    />
  );
}

interface LoopEdgeProps {
  cx: number;
  cy: number;
}

function LoopEdge({ cx, cy }: LoopEdgeProps) {
  const r = NODE_R;
  const loopW = r * 1.5;
  const startAngle = -Math.PI / 4;
  const endAngle = Math.PI / 4;
  const sx = cx + r * Math.cos(startAngle);
  const sy = cy + r * Math.sin(startAngle);
  const ex = cx + r * Math.cos(endAngle);
  const ey = cy + r * Math.sin(endAngle);
  const controlX = cx + r + loopW * 2;
  return (
    <path
      d={`M ${sx.toFixed(1)} ${sy.toFixed(1)} C ${controlX.toFixed(1)} ${sy.toFixed(1)} ${controlX.toFixed(1)} ${ey.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`}
      fill="none"
      stroke="#a855f7"
      strokeWidth={2}
      markerEnd="url(#arrow-modal)"
      opacity={0.85}
    />
  );
}

interface WorldNodeProps {
  label: string;
  x: number;
  y: number;
}

function WorldNode({ label, x, y }: WorldNodeProps) {
  return (
    <g className="modal-node">
      <circle
        cx={x}
        cy={y}
        r={NODE_R}
        fill="#1e293b"
        stroke="#64748b"
        strokeWidth={2}
        style={{ transition: 'stroke 0.15s, fill 0.15s', cursor: 'default' }}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#f1f5f9"
        fontSize={12}
        fontFamily="monospace"
        style={{ userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

export default function ModalFrame({ worlds, accessibility }: ModalFrameProps) {
  const posMap = new Map<string, { x: number; y: number }>();
  worlds.forEach((w, i) => {
    posMap.set(w, worldPosition(i, worlds.length));
  });

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <style>{`
        .modal-node:hover circle {
          fill: #334155;
          stroke: #94a3b8;
        }
      `}</style>
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto max-w-[400px]"
        aria-label="Modal frame diagram"
        role="img"
      >
        <defs>
          <marker
            id="arrow-modal"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
          </marker>
        </defs>

        {accessibility.map(([from, to], idx) => {
          const src = posMap.get(from);
          const dst = posMap.get(to);
          if (!src || !dst) return null;

          if (from === to) {
            return (
              <LoopEdge
                key={`loop-${from}-${idx}`}
                cx={src.x}
                cy={src.y}
              />
            );
          }
          return (
            <StraightEdge
              key={`edge-${from}-${to}-${idx}`}
              x1={src.x}
              y1={src.y}
              x2={dst.x}
              y2={dst.y}
            />
          );
        })}

        {worlds.map((w) => {
          const pos = posMap.get(w);
          if (!pos) return null;
          return <WorldNode key={w} label={w} x={pos.x} y={pos.y} />;
        })}
      </svg>

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2">
          <span
            style={{
              display: 'inline-block',
              width: 24,
              height: 3,
              background: '#a855f7',
              borderRadius: 2
            }}
          />
          Relación de accesibilidad R
        </span>
      </div>

      <p className="text-xs text-slate-400 max-w-xs text-center">
        Mundos posibles dispuestos en círculo. Las flechas representan la
        relación de accesibilidad R(w, w′).
      </p>
    </div>
  );
}
