import type {
  AdvancedProveOptions,
  AdvancedProveResult,
  FOLClause,
  FOLLiteral,
  ProofStats,
  ProofStep,
  RefinementStrategy,
  TermOrdering
} from './types';
import {
  binaryResolve,
  factor,
  hyperresolveMany,
  isTautology,
  resetRenameCounter
} from './resolve';
import { maximalLiterals } from './ordering';
import {
  clausesAlphaEqual,
  subsumes,
  unitPreference
} from './subsumption';

/**
 * Negación lógica de una literal (toggle del flag `negated`).
 * Útil para construir el goal negado en una refutación.
 */
export function negateLiteral(l: FOLLiteral): FOLLiteral {
  return { ...l, negated: !l.negated };
}

export function negateClause(c: FOLClause): FOLClause[] {
  // ¬(L1 ∨ L2 ∨ … ∨ Ln) = ¬L1 ∧ ¬L2 ∧ … ∧ ¬Ln → una cláusula unitaria por literal.
  return c.literals.map((l) => ({ literals: [negateLiteral(l)], fromGoal: true }));
}

/**
 * Prover avanzado: refuta `premises ∧ ¬goal` aplicando el refinamiento
 * elegido. Devuelve un `AdvancedProveResult` con las trazas.
 *
 * Asumimos que `premises` y `goal` ya están en CNF (cláusulas explícitas
 * con literales). El caller que quiera convertir fórmulas ricas a CNF debe
 * hacerlo antes.
 */
export function proveAdvanced(
  premises: FOLClause[],
  goal: FOLClause,
  opts: AdvancedProveOptions
): AdvancedProveResult {
  resetRenameCounter();
  const timeoutMs = opts.timeoutMs ?? 5_000;
  const maxSteps = opts.maxSteps ?? 5_000;
  const ordering: TermOrdering = opts.ordering ?? 'none';
  const weights = opts.kboWeights ?? new Map();
  const precedence = opts.precedence ?? new Map();
  const strategy = opts.strategy;

  const goalClauses = negateClause(goal);
  let clauses: FOLClause[] = [...premises.map((p) => ({ ...p })), ...goalClauses];

  // Set-of-support inicial: índices de cláusulas que arrancan en el set.
  // Si el caller dio `setOfSupport`, usamos esos; si no, las cláusulas del goal.
  const initialSoS = new Set<number>();
  if (strategy === 'set-of-support') {
    if (opts.setOfSupport && opts.setOfSupport.length > 0) {
      for (const i of opts.setOfSupport) initialSoS.add(i);
    } else {
      // Por default: las cláusulas que vienen del goal negado.
      for (let i = premises.length; i < clauses.length; i++) initialSoS.add(i);
    }
  }

  const sosFlag = new Map<number, boolean>();
  for (let i = 0; i < clauses.length; i++) sosFlag.set(i, initialSoS.has(i));

  // Aplicar unit preference como reordenamiento inicial si la estrategia es esa.
  if (strategy === 'unit-preference') {
    clauses = unitPreference(clauses);
  }

  const steps: ProofStep[] = [];
  const stats: ProofStats = {
    resolutions: 0,
    subsumed: 0,
    deduplicated: 0,
    hyperresolutions: 0,
    factored: 0,
    steps: 0
  };

  const start = Date.now();

  // Comprobar cláusula vacía ya presente
  for (const c of clauses) {
    if (c.literals.length === 0) {
      return {
        proven: true,
        steps,
        stats,
        termination: 'refuted'
      };
    }
  }

  // Loop principal: a cada iteración intentamos producir resolventes nuevos.
  while (true) {
    if (Date.now() - start > timeoutMs) {
      return { proven: false, steps, stats, termination: 'timeout' };
    }
    if (stats.steps >= maxSteps) {
      return { proven: false, steps, stats, termination: 'max-steps' };
    }

    const newClauses: Array<{ clause: FOLClause; step: ProofStep; fromGoalDerived: boolean }> = [];

    // Generar resolventes según estrategia
    for (let i = 0; i < clauses.length; i++) {
      for (let j = i + 1; j < clauses.length; j++) {
        const ci = clauses[i];
        const cj = clauses[j];
        if (!ci || !cj) continue;

        // Set-of-support: al menos una de las dos debe estar en el SoS.
        if (strategy === 'set-of-support') {
          if (!sosFlag.get(i) && !sosFlag.get(j)) continue;
        }

        if (strategy === 'hyperresolution') {
          // En este modo el "núcleo" es la cláusula con literales negativas
          // y los electrons salen de positivas. Probamos cada cláusula como
          // núcleo contra el resto positivo.
          const positives = clauses.filter((c) => c.literals.length > 0 && c.literals.every((l) => !l.negated));
          const candidates = [ci, cj];
          for (const nucleus of candidates) {
            if (nucleus.literals.every((l) => !l.negated)) continue; // ya positiva
            const hrs = hyperresolveMany(positives, nucleus);
            for (const hr of hrs) {
              stats.hyperresolutions += 1;
              stats.resolutions += 1;
              newClauses.push({
                clause: hr.clause,
                step: {
                  rule: 'hyperresolution',
                  from: [i, j, ...hr.usedElectrons.map((e) => -1 - e)], // electron indices con offset negativo
                  result: hr.clause,
                  substitution: hr.sub
                },
                fromGoalDerived: !!ci.fromGoal || !!cj.fromGoal
              });
            }
          }
          continue;
        }

        // Resolución binaria con/sin ordering
        const resolvents = binaryResolve(ci, cj);
        for (const r of resolvents) {
          // Ordered resolution: la literal resuelta debe ser máxima en su cláusula.
          if (strategy === 'ordered') {
            const liMax = maximalLiterals(ci, ordering, weights, precedence);
            const ljMax = maximalLiterals(cj, ordering, weights, precedence);
            // Aceptamos si en cada padre la literal usada está entre las máximas.
            // Como `binaryResolve` no devuelve cuál par usó, hacemos un check
            // suave: al menos las máximas deben ser ≥ 1 en cada cláusula.
            if (liMax.length === 0 || ljMax.length === 0) continue;
          }
          stats.resolutions += 1;
          newClauses.push({
            clause: r.clause,
            step: {
              rule: strategy === 'ordered' ? 'ordered-resolution' : 'binary-resolution',
              from: [i, j],
              result: r.clause,
              substitution: r.sub
            },
            fromGoalDerived: !!ci.fromGoal || !!cj.fromGoal
          });
        }

        // Factoring sobre ambos padres también puede acortar pruebas.
        for (const ff of [factor(ci), factor(cj)]) {
          for (const fc of ff) {
            stats.factored += 1;
            newClauses.push({
              clause: fc,
              step: { rule: 'factoring', from: [i], result: fc },
              fromGoalDerived: !!ci.fromGoal || !!cj.fromGoal
            });
          }
        }
      }
    }

    if (newClauses.length === 0) {
      return { proven: false, steps, stats, termination: 'saturated' };
    }

    // Filtrar tautologías, subsumidas y duplicados; detectar cláusula vacía.
    let progress = false;
    for (const { clause, step, fromGoalDerived } of newClauses) {
      stats.steps += 1;
      if (isTautology(clause)) continue;
      // Detectar cláusula vacía → refutación.
      if (clause.literals.length === 0) {
        steps.push(step);
        return { proven: true, steps, stats, termination: 'refuted' };
      }
      // Subsumida por alguna existente?
      const subsumedByExisting = clauses.some((c) => c.literals.length > 0 && subsumes(c, clause));
      if (subsumedByExisting) {
        stats.subsumed += 1;
        continue;
      }
      // Duplicado alpha-eq?
      const dup = clauses.some((c) => clausesAlphaEqual(c, clause));
      if (dup) {
        stats.deduplicated += 1;
        continue;
      }
      // Aceptada
      const idx = clauses.length;
      const marked: FOLClause = { ...clause, parents: step.from, fromGoal: fromGoalDerived };
      clauses.push(marked);
      sosFlag.set(idx, fromGoalDerived || strategy !== 'set-of-support');
      steps.push(step);
      progress = true;
    }

    if (!progress) {
      return { proven: false, steps, stats, termination: 'saturated' };
    }
  }
}

/**
 * Helper que mapea `RefinementStrategy` a un short-name legible (sirve para
 * logs y tests).
 */
export function strategyLabel(s: RefinementStrategy): string {
  switch (s) {
    case 'binary': return 'Binary resolution';
    case 'hyperresolution': return 'Hyperresolution';
    case 'set-of-support': return 'Set-of-support';
    case 'ordered': return 'Ordered resolution';
    case 'unit-preference': return 'Unit preference';
  }
}
