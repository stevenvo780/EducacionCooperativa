/**
 * Bishop-style constructive real analysis.
 *
 * Re-exports the four pillars:
 *   - Cauchy sequences with explicit modulus (`./cauchy`)
 *   - Uniform continuity on compact intervals (`./continuity`)
 *   - Bishop integral (`./integral`)
 *   - Heine-Borel compactness (`./compact`)
 *   - Intermediate value + mean value approximations (`./ivt`)
 *
 * All operations are constructive: no LEM, no unrestricted choice, and
 * every claim of convergence/continuity is backed by an explicit
 * modulus function. The CReal primitive lives in
 * `../constructive-reals`.
 */

export type { ConstructiveCauchySeq } from './cauchy';
export { isCauchy, limit, cauchyFrom } from './cauchy';

export type { ConstructiveContinuous } from './continuity';
export {
  isUniformlyContinuousOn,
  composition,
  constant,
  identity,
  lipschitz
} from './continuity';

export { bishopIntegral } from './integral';

export type { ConstructiveOpenCover } from './compact';
export { hasFiniteSubcover } from './compact';

export { intermediateValueTheorem, meanValueConstructive } from './ivt';
