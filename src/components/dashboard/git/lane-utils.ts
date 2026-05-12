/**
 * Algoritmo de asignación de lanes para gitgraph SVG.
 *
 * Cada commit ocupa un lane (columna). Cuando un commit "cierra" un parent
 * (ya pintado en otro lane), libera el lane del parent. Greedy: el primer
 * commit toma lane 0; cada siguiente toma el lane mínimo libre.
 *
 * El algoritmo asume `commits` ordenados HEAD → root (más nuevo primero),
 * que es lo que devuelve Forgejo `/commits`.
 */

export interface LaneCommit {
  sha: string;
  parents: string[];
}

export interface LaneAssignment {
  /** sha → índice de lane asignado al commit */
  laneBySha: Map<string, number>;
  /** sha → padre principal (parents[0]) si existe — útil para dibujar la
   * arista "down" sin ambigüedad. */
  primaryParent: Map<string, string>;
  /** ancho máximo en lanes (para calcular viewBox del SVG) */
  width: number;
}

export const computeLanes = (commits: readonly LaneCommit[]): LaneAssignment => {
  const laneBySha = new Map<string, number>();
  const primaryParent = new Map<string, string>();
  // activeLanes[i] = sha del commit que actualmente "vive" en ese lane
  // (i.e. estamos esperando que un descendiente lo cierre).
  const activeLanes: (string | null)[] = [];
  let maxWidth = 0;

  const acquireLane = (preferred?: number): number => {
    if (typeof preferred === 'number' && preferred >= 0 && activeLanes[preferred] === null) {
      return preferred;
    }
    for (let i = 0; i < activeLanes.length; i++) {
      if (activeLanes[i] === null) return i;
    }
    activeLanes.push(null);
    return activeLanes.length - 1;
  };

  // "reserva" para parents conocidos: si ya vimos a un commit cuyo parent es
  // este, le reservamos un lane (la lane que lo apuntaba).
  const reservedParentLane = new Map<string, number>();

  for (const commit of commits) {
    let lane: number;
    if (reservedParentLane.has(commit.sha)) {
      lane = reservedParentLane.get(commit.sha)!;
      reservedParentLane.delete(commit.sha);
    } else {
      lane = acquireLane();
    }
    activeLanes[lane] = commit.sha;
    laneBySha.set(commit.sha, lane);
    if (lane + 1 > maxWidth) maxWidth = lane + 1;

    if (commit.parents.length > 0) {
      const primary = commit.parents[0];
      if (typeof primary === 'string') {
        primaryParent.set(commit.sha, primary);
        // El parent principal "hereda" el lane (continuidad vertical).
        if (!reservedParentLane.has(primary) && !laneBySha.has(primary)) {
          reservedParentLane.set(primary, lane);
        }
      }
      // Parents secundarios (merges) reservan otros lanes para diverger.
      for (let i = 1; i < commit.parents.length; i++) {
        const p = commit.parents[i];
        if (typeof p !== 'string') continue;
        if (!reservedParentLane.has(p) && !laneBySha.has(p)) {
          const free = acquireLane();
          activeLanes[free] = p;
          reservedParentLane.set(p, free);
          if (free + 1 > maxWidth) maxWidth = free + 1;
        }
      }
    }
    // Si este commit no tiene hijos (ya nadie lo va a referenciar),
    // libera su lane salvo que esté reservada por su parent principal.
    // Heurística: lo liberamos si el primer parent toma el mismo lane;
    // en otro caso (sin parents = root) también liberamos.
    if (commit.parents.length === 0) {
      activeLanes[lane] = null;
    } else {
      const primary = commit.parents[0];
      if (typeof primary === 'string' && reservedParentLane.get(primary) === lane) {
        // herencia: el lane sigue ocupado pero por el parent
        activeLanes[lane] = primary;
      } else {
        activeLanes[lane] = null;
      }
    }
  }

  return { laneBySha, primaryParent, width: Math.max(maxWidth, 1) };
};

/** Color determinístico por lane. Usa un hash trivial para variar. */
export const laneColor = (lane: number): string => {
  const palette = [
    '#10b981',
    '#3b82f6',
    '#a855f7',
    '#f59e0b',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#ef4444'
  ];
  const i = ((lane % palette.length) + palette.length) % palette.length;
  return palette[i] ?? palette[0]!;
};
