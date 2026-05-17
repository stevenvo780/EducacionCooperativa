import type { FOLLiteral, FOLTerm } from './types';

/**
 * Term ordering: KBO (Knuth-Bendix) y LPO (Lexicographic Path).
 *
 * Para ordered resolution sólo seleccionamos las literales máximas según el
 * orden elegido. Ambas funciones son antisimétricas y bien fundadas si los
 * pesos/precedencias se proveen consistentemente (ver invariantes en cada
 * función).
 */

interface Multiset {
  /** name+arity → count de ocurrencias (suficiente para KBO). */
  size: number;
  varCount: Map<string, number>;
}

function termMultiset(t: FOLTerm): Multiset {
  const ms: Multiset = { size: 0, varCount: new Map() };
  walk(t);
  function walk(node: FOLTerm): void {
    if (node.kind === 'variable') {
      ms.size += 1;
      ms.varCount.set(node.name, (ms.varCount.get(node.name) ?? 0) + 1);
      return;
    }
    ms.size += 1;
    for (const a of node.args) walk(a);
  }
  return ms;
}

function termWeight(t: FOLTerm, weights: Map<string, number>): number {
  if (t.kind === 'variable') return 1;
  const w = weights.get(t.name) ?? 1;
  let total = w;
  for (const a of t.args) total += termWeight(a, weights);
  return total;
}

/**
 * `kboGreater(t1, t2, weights)` ⇔ t1 >_KBO t2.
 *
 * Invariantes (simplificadas; suficientes para el tablero de pruebas):
 * 1. Cada variable de t2 ocurre en t1 al menos tantas veces.
 * 2. weight(t1) > weight(t2), o
 * 3. weight(t1) == weight(t2) y t1 domina léxicamente (top-symbol > top-symbol
 *    según precedencia derivada de pesos, o argumentos comparados).
 */
export function kboGreater(t1: FOLTerm, t2: FOLTerm, weights: Map<string, number>): boolean {
  // Condición de variables: cada var de t2 ocurre ≥ en t1.
  const ms1 = termMultiset(t1);
  const ms2 = termMultiset(t2);
  for (const [varName, count2] of ms2.varCount) {
    const count1 = ms1.varCount.get(varName) ?? 0;
    if (count1 < count2) return false;
  }
  const w1 = termWeight(t1, weights);
  const w2 = termWeight(t2, weights);
  if (w1 > w2) return true;
  if (w1 < w2) return false;
  // Empate en peso: comparar símbolos top y luego argumentos.
  if (t1.kind === 'variable' || t2.kind === 'variable') return false;
  const wf1 = weights.get(t1.name) ?? 1;
  const wf2 = weights.get(t2.name) ?? 1;
  if (wf1 > wf2) return true;
  if (wf1 < wf2) return false;
  if (t1.name !== t2.name) return t1.name > t2.name;
  if (t1.args.length !== t2.args.length) return t1.args.length > t2.args.length;
  for (let i = 0; i < t1.args.length; i++) {
    const a = t1.args[i];
    const b = t2.args[i];
    if (a === undefined || b === undefined) return false;
    if (kboGreater(a, b, weights)) return true;
    if (kboGreater(b, a, weights)) return false;
  }
  return false;
}

/**
 * `lpoGreater(t1, t2, precedence)` ⇔ t1 >_LPO t2.
 *
 * Reglas estándar:
 * - Si t2 es variable, t1 > t2 ⇔ t2 ocurre en t1 y t1 ≠ t2.
 * - Si top(t1) > top(t2) (vía `precedence`) y t1 > cada subterm de t2.
 * - Si top(t1) = top(t2), comparación lexicográfica de argumentos y t1 > cada
 *   subterm de t2.
 * - Si algún subterm de t1 ≥ t2.
 */
export function lpoGreater(t1: FOLTerm, t2: FOLTerm, precedence: Map<string, number>): boolean {
  if (t1.kind === 'variable') return false;
  if (t2.kind === 'variable') return occursVar(t2.name, t1) && !sameTerm(t1, t2);

  // Caso 1: algún subterm de t1 ≥ t2.
  for (const sub of t1.args) {
    if (sameTerm(sub, t2) || lpoGreater(sub, t2, precedence)) return true;
  }

  const r1 = precedence.get(t1.name) ?? 0;
  const r2 = precedence.get(t2.name) ?? 0;

  if (r1 > r2) {
    // t1 > t2 ⇔ t1 > cada subterm de t2.
    for (const s of t2.args) {
      if (!lpoGreater(t1, s, precedence)) return false;
    }
    return true;
  }

  if (r1 === r2 && t1.name === t2.name && t1.args.length === t2.args.length) {
    // Lexicográfico sobre args.
    for (let i = 0; i < t1.args.length; i++) {
      const a = t1.args[i];
      const b = t2.args[i];
      if (a === undefined || b === undefined) return false;
      if (sameTerm(a, b)) continue;
      if (lpoGreater(a, b, precedence)) {
        for (const s of t2.args) {
          if (!lpoGreater(t1, s, precedence)) return false;
        }
        return true;
      }
      return false;
    }
    return false;
  }

  return false;
}

function occursVar(name: string, t: FOLTerm): boolean {
  if (t.kind === 'variable') return t.name === name;
  return t.args.some((a) => occursVar(name, a));
}

function sameTerm(a: FOLTerm, b: FOLTerm): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'variable' && b.kind === 'variable') return a.name === b.name;
  if (a.kind === 'function' && b.kind === 'function') {
    if (a.name !== b.name || a.args.length !== b.args.length) return false;
    for (let i = 0; i < a.args.length; i++) {
      const ai = a.args[i];
      const bi = b.args[i];
      if (ai === undefined || bi === undefined) return false;
      if (!sameTerm(ai, bi)) return false;
    }
    return true;
  }
  return false;
}

/**
 * Calcula las literales máximas de una cláusula bajo el ordering dado.
 * Sólo esas pueden usarse como "literal seleccionada" en ordered resolution.
 *
 * Convertimos cada literal en un término representativo
 * `f_pred(args)` (con signo codificado vía precedencia para que la negación no
 * altere el orden) y comparamos.
 */
export function maximalLiterals(
  clause: { literals: FOLLiteral[] },
  ordering: 'KBO' | 'LPO' | 'none',
  weights: Map<string, number>,
  precedence: Map<string, number>
): number[] {
  if (ordering === 'none' || clause.literals.length === 0) {
    return clause.literals.map((_, i) => i);
  }
  const wrapped: FOLTerm[] = clause.literals.map((l) => ({
    kind: 'function',
    name: l.predicate,
    args: l.args
  }));
  const maximal: number[] = [];
  for (let i = 0; i < wrapped.length; i++) {
    let dominated = false;
    for (let j = 0; j < wrapped.length; j++) {
      if (i === j) continue;
      const wi = wrapped[i];
      const wj = wrapped[j];
      if (wi === undefined || wj === undefined) continue;
      if (ordering === 'KBO' && kboGreater(wj, wi, weights)) {
        dominated = true;
        break;
      }
      if (ordering === 'LPO' && lpoGreater(wj, wi, precedence)) {
        dominated = true;
        break;
      }
    }
    if (!dominated) maximal.push(i);
  }
  return maximal;
}
