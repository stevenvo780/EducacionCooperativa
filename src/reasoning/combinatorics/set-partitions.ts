import { bellNumber } from './special-numbers';

export function setPartitions<T>(items: T[]): T[][][] {
  const n = items.length;
  if (n === 0) return [[]];
  const result: T[][][] = [];
  // restricted growth strings: a[i] indica el bloque de items[i].
  const assignment = new Array<number>(n).fill(0);
  function recurse(i: number, maxUsed: number): void {
    if (i === n) {
      const blocks: T[][] = [];
      for (let b = 0; b <= maxUsed; b++) {
        blocks.push([]);
      }
      for (let idx = 0; idx < n; idx++) {
        const bIdx = assignment[idx];
        const item = items[idx];
        if (bIdx === undefined) throw new Error('setPartitions: assignment inválido');
        if (item === undefined && !(idx in items)) {
          throw new Error('setPartitions: ítem inválido');
        }
        const block = blocks[bIdx];
        if (block === undefined) throw new Error('setPartitions: bloque inválido');
        block.push(item as T);
      }
      result.push(blocks);
      return;
    }
    for (let b = 0; b <= maxUsed + 1; b++) {
      assignment[i] = b;
      recurse(i + 1, Math.max(maxUsed, b));
    }
  }
  recurse(0, -1);
  return result;
}

export function setPartitionsCount(n: number): bigint {
  return bellNumber(n);
}
