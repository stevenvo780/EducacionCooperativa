export type {
  FOLTerm,
  FOLLiteral,
  FOLClause,
  Substitution,
  RefinementStrategy,
  TermOrdering,
  AdvancedProveOptions,
  AdvancedProveResult,
  ProofStep,
  ProofStats
} from './types';

export {
  unify,
  unifyLiterals,
  applySubToTerm,
  applySubToLiteral,
  termsEqual,
  literalsEqual
} from './unify';

export {
  kboGreater,
  lpoGreater,
  maximalLiterals
} from './ordering';

export {
  subsumes,
  removeSubsumed,
  unitPreference,
  clausesAlphaEqual
} from './subsumption';

export {
  binaryResolve,
  hyperresolve,
  hyperresolveMany,
  factor,
  dedupLiterals,
  isTautology,
  renameClause,
  resetRenameCounter
} from './resolve';

export {
  proveAdvanced,
  negateLiteral,
  negateClause,
  strategyLabel
} from './prover';
