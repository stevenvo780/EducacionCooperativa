'use client';

import { useMemo } from 'react';
import { computeLanes, laneColor, type LaneCommit } from './lane-utils';
import type { GitGraphCommit } from './schemas';

interface GitGraphPanelProps {
  commits: readonly GitGraphCommit[];
  selectedSha: string | null;
  onSelect: (sha: string) => void;
}

const ROW_HEIGHT = 28;
const LANE_WIDTH = 20;
const NODE_RADIUS = 5;
const LEFT_PAD = 12;

export default function GitGraphPanel({ commits, selectedSha, onSelect }: GitGraphPanelProps) {
  const lanes = useMemo(() => {
    const input: LaneCommit[] = commits.map((c) => ({ sha: c.sha, parents: c.parents }));
    return computeLanes(input);
  }, [commits]);

  if (commits.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500 dark:border-zinc-700">
        Sin commits aún.
      </div>
    );
  }

  const svgWidth = lanes.width * LANE_WIDTH + LEFT_PAD * 2;
  const svgHeight = commits.length * ROW_HEIGHT + 8;

  const indexBySha = new Map<string, number>();
  commits.forEach((c, i) => indexBySha.set(c.sha, i));

  return (
    <div className="flex w-full overflow-x-auto" role="tree" aria-label="Historial de commits">
      <svg
        width={svgWidth}
        height={svgHeight}
        className="shrink-0"
        aria-hidden="true"
      >
        {commits.map((commit, idx) => {
          const lane = lanes.laneBySha.get(commit.sha) ?? 0;
          const cx = lane * LANE_WIDTH + LEFT_PAD;
          const cy = idx * ROW_HEIGHT + ROW_HEIGHT / 2;
          return (
            <g key={`edges-${commit.sha}`}>
              {commit.parents.map((parentSha) => {
                const parentIdx = indexBySha.get(parentSha);
                if (typeof parentIdx !== 'number') return null;
                const parentLane = lanes.laneBySha.get(parentSha) ?? lane;
                const px = parentLane * LANE_WIDTH + LEFT_PAD;
                const py = parentIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                const stroke = laneColor(parentLane);
                if (parentLane === lane) {
                  return (
                    <line
                      key={`${commit.sha}->${parentSha}`}
                      x1={cx} y1={cy + NODE_RADIUS}
                      x2={px} y2={py - NODE_RADIUS}
                      stroke={stroke}
                      strokeWidth={1.5}
                    />
                  );
                }
                const midY = cy + ROW_HEIGHT / 2;
                return (
                  <path
                    key={`${commit.sha}->${parentSha}`}
                    d={`M ${cx} ${cy + NODE_RADIUS} C ${cx} ${midY}, ${px} ${midY}, ${px} ${py - NODE_RADIUS}`}
                    stroke={stroke}
                    fill="none"
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          );
        })}
        {commits.map((commit, idx) => {
          const lane = lanes.laneBySha.get(commit.sha) ?? 0;
          const cx = lane * LANE_WIDTH + LEFT_PAD;
          const cy = idx * ROW_HEIGHT + ROW_HEIGHT / 2;
          const isSelected = selectedSha === commit.sha;
          return (
            <circle
              key={commit.sha}
              cx={cx} cy={cy} r={isSelected ? NODE_RADIUS + 2 : NODE_RADIUS}
              fill={laneColor(lane)}
              stroke={isSelected ? '#0f172a' : 'white'}
              strokeWidth={isSelected ? 2 : 1.5}
              className="cursor-pointer"
              onClick={() => onSelect(commit.sha)}
            >
              <title>{commit.shortSha} · {commit.message.split('\n')[0]}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="flex-1 min-w-0 text-xs">
        {commits.map((commit, idx) => {
          const isSelected = selectedSha === commit.sha;
          const headline = commit.message.split('\n')[0] ?? '';
          return (
            <li
              key={commit.sha}
              style={{ height: ROW_HEIGHT }}
              className={`flex items-center gap-2 px-2 ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'} cursor-pointer`}
              onClick={() => onSelect(commit.sha)}
            >
              <span className="font-mono text-[10px] text-zinc-500 shrink-0">{commit.shortSha}</span>
              <span className="truncate text-zinc-800 dark:text-zinc-200 flex-1">{headline}</span>
              {commit.refs.length > 0 && (
                <span className="flex shrink-0 gap-1">
                  {commit.refs.slice(0, 3).map((ref) => (
                    <span
                      key={ref}
                      className={`rounded px-1 text-[9px] uppercase tracking-wider ${ref.startsWith('tag:') ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'}`}
                    >
                      {ref}
                    </span>
                  ))}
                </span>
              )}
              <span className="shrink-0 text-[10px] text-zinc-400">{commit.authorName.split(' ')[0]}</span>
              {/* Position marker invisible para tests / scroll */}
              <span className="sr-only">commit {idx + 1}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
