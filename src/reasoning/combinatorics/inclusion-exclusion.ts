/**
 * Calcula |A_1 ∪ A_2 ∪ ... ∪ A_n| usando el principio de inclusión-exclusión
 * a fuerza bruta sobre el reticulado de subconjuntos no vacíos de índices.
 *
 * |⋃ A_i| = Σ_{S≠∅} (-1)^(|S|+1) |⋂_{i∈S} A_i|
 */
export function inclusionExclusion(sets: Array<Set<number>>): number {
  const n = sets.length;
  if (n === 0) return 0;
  let total = 0;
  const totalMasks = 1 << n;
  for (let mask = 1; mask < totalMasks; mask++) {
    let popcount = 0;
    let intersection: Set<number> | null = null;
    for (let i = 0; i < n; i++) {
      if ((mask >> i) & 1) {
        popcount++;
        const si = sets[i];
        if (si === undefined) throw new Error('inclusionExclusion: set inválido');
        if (intersection === null) {
          intersection = new Set(si);
        } else {
          const next = new Set<number>();
          for (const v of intersection) {
            if (si.has(v)) next.add(v);
          }
          intersection = next;
        }
      }
    }
    if (intersection === null) continue;
    const sign = popcount % 2 === 1 ? 1 : -1;
    total += sign * intersection.size;
  }
  return total;
}
