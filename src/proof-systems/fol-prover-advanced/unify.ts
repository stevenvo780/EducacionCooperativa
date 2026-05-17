import type { FOLLiteral, FOLTerm, Substitution } from './types';

/**
 * Unificación de Robinson con occurs-check. Devuelve la sustitución más
 * general (mgu) o `null` si no unifica.
 *
 * Implementación iterativa sobre una pila de pares (t1,t2) para evitar
 * recursión profunda en cláusulas grandes.
 */
export function unify(t1: FOLTerm, t2: FOLTerm): Substitution | null {
  const sub: Substitution = new Map();
  const stack: Array<[FOLTerm, FOLTerm]> = [[t1, t2]];

  while (stack.length > 0) {
    const pair = stack.pop();
    if (!pair) break;
    const a = applySubToTerm(pair[0], sub);
    const b = applySubToTerm(pair[1], sub);

    if (termsEqual(a, b)) continue;

    if (a.kind === 'variable') {
      if (occurs(a.name, b)) return null;
      bindVariable(sub, a.name, b);
      continue;
    }
    if (b.kind === 'variable') {
      if (occurs(b.name, a)) return null;
      bindVariable(sub, b.name, a);
      continue;
    }

    // Ambos son funciones/constantes
    if (a.name !== b.name || a.args.length !== b.args.length) return null;
    for (let i = 0; i < a.args.length; i++) {
      const ai = a.args[i];
      const bi = b.args[i];
      if (ai === undefined || bi === undefined) return null;
      stack.push([ai, bi]);
    }
  }

  return sub;
}

export function unifyLiterals(l1: FOLLiteral, l2: FOLLiteral): Substitution | null {
  if (l1.predicate !== l2.predicate) return null;
  if (l1.args.length !== l2.args.length) return null;
  const sub: Substitution = new Map();
  for (let i = 0; i < l1.args.length; i++) {
    const a = l1.args[i];
    const b = l2.args[i];
    if (a === undefined || b === undefined) return null;
    const partial = unify(applySubToTerm(a, sub), applySubToTerm(b, sub));
    if (!partial) return null;
    for (const [k, v] of partial) sub.set(k, applySubToTerm(v, sub));
    // Re-aplicar sobre los ya existentes
    for (const [k, v] of sub) sub.set(k, applySubToTerm(v, partial));
  }
  return sub;
}

export function applySubToTerm(t: FOLTerm, sub: Substitution): FOLTerm {
  if (t.kind === 'variable') {
    const bound = sub.get(t.name);
    if (!bound) return t;
    // walk recursivo si la sustitución no está totalmente normalizada
    return applySubToTerm(bound, sub);
  }
  return {
    kind: 'function',
    name: t.name,
    args: t.args.map((a) => applySubToTerm(a, sub))
  };
}

export function applySubToLiteral(l: FOLLiteral, sub: Substitution): FOLLiteral {
  return {
    negated: l.negated,
    predicate: l.predicate,
    args: l.args.map((a) => applySubToTerm(a, sub))
  };
}

export function termsEqual(a: FOLTerm, b: FOLTerm): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'variable' && b.kind === 'variable') return a.name === b.name;
  if (a.kind === 'function' && b.kind === 'function') {
    if (a.name !== b.name || a.args.length !== b.args.length) return false;
    for (let i = 0; i < a.args.length; i++) {
      const ai = a.args[i];
      const bi = b.args[i];
      if (ai === undefined || bi === undefined) return false;
      if (!termsEqual(ai, bi)) return false;
    }
    return true;
  }
  return false;
}

export function literalsEqual(a: FOLLiteral, b: FOLLiteral): boolean {
  if (a.negated !== b.negated) return false;
  if (a.predicate !== b.predicate) return false;
  if (a.args.length !== b.args.length) return false;
  for (let i = 0; i < a.args.length; i++) {
    const ai = a.args[i];
    const bi = b.args[i];
    if (ai === undefined || bi === undefined) return false;
    if (!termsEqual(ai, bi)) return false;
  }
  return true;
}

function occurs(varName: string, term: FOLTerm): boolean {
  if (term.kind === 'variable') return term.name === varName;
  return term.args.some((a) => occurs(varName, a));
}

function bindVariable(sub: Substitution, name: string, value: FOLTerm): void {
  // Normalizar sustituciones previas para que no queden indirectas.
  for (const [k, v] of sub) {
    sub.set(k, applySubToTerm(v, new Map([[name, value]])));
  }
  sub.set(name, value);
}
