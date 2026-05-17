'use client';

const WIDTH = 400;
const HEIGHT = 400;
const NODE_R = 22;

const NODES = [
  { id: 'top', label: '⊤', x: 200, y: 60 },
  { id: 'T', label: 'T', x: 100, y: 200 },
  { id: 'F', label: 'F', x: 300, y: 200 },
  { id: 'bot', label: '⊥', x: 200, y: 340 }
] as const;

type NodeId = (typeof NODES)[number]['id'];

const INFO_EDGES: Array<[NodeId, NodeId]> = [
  ['top', 'T'],
  ['top', 'F'],
  ['T', 'bot'],
  ['F', 'bot']
];

const TRUTH_EDGES: Array<[NodeId, NodeId]> = [
  ['T', 'top'],
  ['T', 'bot'],
  ['top', 'F'],
  ['bot', 'F']
];

function nodePos(id: NodeId): { x: number; y: number } {
  const node = NODES.find((n) => n.id === id);
  if (!node) throw new Error(`Node not found: ${id}`);
  return { x: node.x, y: node.y };
}

function arrowPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
  offset: number
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x1: x1 + nx * r + -ny * offset,
    y1: y1 + ny * r + nx * offset,
    x2: x2 - nx * r + -ny * offset,
    y2: y2 - ny * r + nx * offset
  };
}

interface EdgeProps {
  from: NodeId;
  to: NodeId;
  color: string;
  markerId: string;
  offset: number;
}

function Edge({ from, to, color, markerId, offset }: EdgeProps) {
  const src = nodePos(from);
  const dst = nodePos(to);
  const pts = arrowPoints(src.x, src.y, dst.x, dst.y, NODE_R + 2, offset);
  return (
    <line
      x1={pts.x1}
      y1={pts.y1}
      x2={pts.x2}
      y2={pts.y2}
      stroke={color}
      strokeWidth={2}
      markerEnd={`url(#${markerId})`}
      opacity={0.8}
    />
  );
}

interface NodeCircleProps {
  id: NodeId;
  label: string;
  x: number;
  y: number;
}

function NodeCircle({ label, x, y }: NodeCircleProps) {
  return (
    <g className="lattice-node">
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
        fontSize={16}
        fontFamily="serif"
        style={{ userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

export default function BelnapLattice() {
  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <style>{`
        .lattice-node:hover circle {
          fill: #334155;
          stroke: #94a3b8;
        }
      `}</style>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto max-w-[400px]"
        aria-label="Belnap bilattice diagram"
        role="img"
      >
        <defs>
          <marker
            id="arrow-info"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
          </marker>
          <marker
            id="arrow-truth"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
          </marker>
        </defs>

        {INFO_EDGES.map(([from, to]) => (
          <Edge
            key={`info-${from}-${to}`}
            from={from}
            to={to}
            color="#3b82f6"
            markerId="arrow-info"
            offset={-6}
          />
        ))}

        {TRUTH_EDGES.map(([from, to]) => (
          <Edge
            key={`truth-${from}-${to}`}
            from={from}
            to={to}
            color="#ef4444"
            markerId="arrow-truth"
            offset={6}
          />
        ))}

        {NODES.map((node) => (
          <NodeCircle key={node.id} {...node} />
        ))}
      </svg>

      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
        <span className="flex items-center gap-2">
          <span
            style={{
              display: 'inline-block',
              width: 24,
              height: 3,
              background: '#3b82f6',
              borderRadius: 2
            }}
          />
          Info order (≤<sub>i</sub>)
        </span>
        <span className="flex items-center gap-2">
          <span
            style={{
              display: 'inline-block',
              width: 24,
              height: 3,
              background: '#ef4444',
              borderRadius: 2
            }}
          />
          Truth order (≤<sub>t</sub>)
        </span>
      </div>

      <p className="text-xs text-slate-400 max-w-xs text-center">
        Hover sobre un nodo para resaltarlo. Diamante: ⊤ (both), T (true), F
        (false), ⊥ (neither).
      </p>
    </div>
  );
}
