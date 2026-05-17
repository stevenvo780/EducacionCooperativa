/**
 * Tipos base de primer orden para el prover avanzado.
 *
 * Variables: identificadores que empiezan con minúscula y se interpretan como
 * sustituibles durante la unificación (convención: `x`, `y`, `u`, `v`).
 * Constantes/funciones: identificadores en minúscula con `args` (aridad ≥ 0).
 * Diferenciamos `variable` vs `function` por el campo `kind` para evitar
 * ambigüedades.
 */

export type FOLTerm =
  | { kind: 'variable'; name: string }
  | { kind: 'function'; name: string; args: FOLTerm[] };

export interface FOLLiteral {
  /** Si la literal está negada (¬P(x)) o es positiva (P(x)). */
  negated: boolean;
  predicate: string;
  args: FOLTerm[];
}

export interface FOLClause {
  /** Disyunción de literales. Cláusula vacía ⇒ contradicción. */
  literals: FOLLiteral[];
  /** Trazabilidad: índices de cláusulas padre (si fue derivada). */
  parents?: number[];
  /** Marca cláusulas que provienen del goal o su negación (SoS). */
  fromGoal?: boolean;
}

export type Substitution = Map<string, FOLTerm>;

export type RefinementStrategy =
  | 'binary'
  | 'hyperresolution'
  | 'set-of-support'
  | 'ordered'
  | 'unit-preference';

export type TermOrdering = 'KBO' | 'LPO' | 'none';

export interface AdvancedProveOptions {
  strategy: RefinementStrategy;
  ordering?: TermOrdering;
  /** Pesos para KBO (símbolo → peso). Variables tienen peso fijo 1. */
  kboWeights?: Map<string, number>;
  /** Precedencia para LPO/ordered (símbolo → rank; mayor = más fuerte). */
  precedence?: Map<string, number>;
  /** Índices (en `premises` + goal-negado) que arrancan en el set-of-support. */
  setOfSupport?: number[];
  timeoutMs?: number;
  maxSteps?: number;
}

export interface ProofStep {
  rule: string;
  from: number[];
  result: FOLClause;
  substitution?: Substitution;
}

export interface ProofStats {
  resolutions: number;
  subsumed: number;
  deduplicated: number;
  hyperresolutions: number;
  factored: number;
  steps: number;
}

export interface AdvancedProveResult {
  proven: boolean;
  steps: ProofStep[];
  stats: ProofStats;
  /** Razón cuando `proven=false`: timeout, saturated, maxSteps. */
  termination: 'refuted' | 'saturated' | 'timeout' | 'max-steps';
}
