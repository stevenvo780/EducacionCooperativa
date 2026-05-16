import type { AcademicDiagnostic, CitationNode } from './types';

interface Cycle {
  nodes: string[];
}

function findCycles(nodes: CitationNode[]): Cycle[] {
  const graph = new Map<string, string[]>();
  for (const node of nodes) {
    graph.set(node.id, [...node.cites]);
  }

  const cycles: Cycle[] = [];
  const seenCycles = new Set<string>();

  const visiting = new Set<string>();
  const stack: string[] = [];

  const dfs = (node: string): void => {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      if (cycleStart === -1) return;
      const cycle = stack.slice(cycleStart);
      const key = canonicalCycleKey(cycle);
      if (!seenCycles.has(key)) {
        seenCycles.add(key);
        cycles.push({ nodes: cycle });
      }
      return;
    }

    if (!graph.has(node)) return;

    visiting.add(node);
    stack.push(node);

    const targets = graph.get(node) ?? [];
    for (const t of targets) {
      dfs(t);
    }

    stack.pop();
    visiting.delete(node);
  };

  for (const node of nodes) {
    dfs(node.id);
  }

  return cycles;
}

function canonicalCycleKey(cycle: string[]): string {
  if (cycle.length === 0) return '';
  let minIdx = 0;
  for (let i = 1; i < cycle.length; i++) {
    const current = cycle[i] ?? '';
    const best = cycle[minIdx] ?? '';
    if (current < best) minIdx = i;
  }
  return [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)].join('→');
}

export function detectCircularReasoning(
  citations: CitationNode[] | undefined
): AcademicDiagnostic[] {
  if (!citations || citations.length === 0) return [];

  const cycles = findCycles(citations);
  const out: AcademicDiagnostic[] = [];
  const seen = new Set<string>();

  for (const cycle of cycles) {
    const cyclePath = [...cycle.nodes, cycle.nodes[0] ?? ''].join(' → ');
    for (const node of cycle.nodes) {
      if (seen.has(node)) continue;
      seen.add(node);
      out.push({
        from: 0,
        to: 0,
        severity: 'warning',
        category: 'circular',
        message: `Razonamiento circular detectado en cita "${node}": ${cyclePath}.`,
        suggestion: 'Reemplaza al menos una arista del ciclo por una fuente independiente.'
      });
    }
  }

  return out;
}
