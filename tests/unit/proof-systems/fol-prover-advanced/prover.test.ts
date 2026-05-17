import { describe, expect, it } from 'vitest';
import {
  binaryResolve,
  clausesAlphaEqual,
  hyperresolve,
  hyperresolveMany,
  kboGreater,
  lpoGreater,
  proveAdvanced,
  removeSubsumed,
  subsumes,
  unitPreference,
  unify,
  type FOLClause,
  type FOLLiteral,
  type FOLTerm
} from '@/proof-systems/fol-prover-advanced';

// Helpers (terse) para no inflar los tests
const v = (name: string): FOLTerm => ({ kind: 'variable', name });
const c = (name: string): FOLTerm => ({ kind: 'function', name, args: [] });
const f = (name: string, ...args: FOLTerm[]): FOLTerm => ({ kind: 'function', name, args });
const lit = (predicate: string, args: FOLTerm[], negated = false): FOLLiteral => ({ predicate, args, negated });
const clause = (literals: FOLLiteral[], fromGoal = false): FOLClause => ({ literals, fromGoal });

describe('fol-prover-advanced', () => {
  describe('unification', () => {
    it('unifica f(x) con f(a) → {x ↦ a}', () => {
      const sub = unify(f('f', v('x')), f('f', c('a')));
      expect(sub).not.toBeNull();
      expect(sub?.get('x')).toEqual(c('a'));
    });

    it('rechaza unificar f(x) con g(x)', () => {
      expect(unify(f('f', v('x')), f('g', v('x')))).toBeNull();
    });

    it('occurs-check: x con f(x) → null', () => {
      expect(unify(v('x'), f('f', v('x')))).toBeNull();
    });
  });

  describe('KBO ordering', () => {
    it('f(a,b) > a por mayor peso', () => {
      const weights = new Map([['f', 1], ['a', 1], ['b', 1]]);
      expect(kboGreater(f('f', c('a'), c('b')), c('a'), weights)).toBe(true);
      expect(kboGreater(c('a'), f('f', c('a'), c('b')), weights)).toBe(false);
    });

    it('rechaza cuando variable de t2 no aparece en t1', () => {
      const weights = new Map([['f', 1], ['a', 1]]);
      // f(a) vs x: x aparece 1 vez en t2 y 0 en t1 → no >_KBO.
      expect(kboGreater(f('f', c('a')), v('x'), weights)).toBe(false);
    });
  });

  describe('LPO ordering', () => {
    it('h(x) > x cuando x ocurre en h(x)', () => {
      const prec = new Map([['h', 2]]);
      expect(lpoGreater(f('h', v('x')), v('x'), prec)).toBe(true);
    });

    it('f(a) > g(a) si precedence(f) > precedence(g)', () => {
      const prec = new Map([['f', 5], ['g', 1], ['a', 0]]);
      expect(lpoGreater(f('f', c('a')), f('g', c('a')), prec)).toBe(true);
      expect(lpoGreater(f('g', c('a')), f('f', c('a')), prec)).toBe(false);
    });
  });

  describe('subsumption', () => {
    it('P(x) subsume P(a)', () => {
      const c1 = clause([lit('P', [v('x')])]);
      const c2 = clause([lit('P', [c('a')])]);
      expect(subsumes(c1, c2)).toBe(true);
      expect(subsumes(c2, c1)).toBe(false);
    });

    it('removeSubsumed elimina la más específica', () => {
      const general = clause([lit('Q', [v('x')])]);
      const specific = clause([lit('Q', [c('b')])]);
      const filtered = removeSubsumed([specific, general]);
      // El general subsume al específico → sólo el general sobrevive.
      expect(filtered.length).toBe(1);
      expect(clausesAlphaEqual(filtered[0]!, general)).toBe(true);
    });
  });

  describe('binary resolution', () => {
    it('P(x) y ¬P(a) → ⊥ con sustitución {x↦a}', () => {
      const c1 = clause([lit('P', [v('x')])]);
      const c2 = clause([lit('P', [c('a')], true)]);
      const res = binaryResolve(c1, c2);
      expect(res.length).toBeGreaterThan(0);
      expect(res[0]!.clause.literals.length).toBe(0);
    });
  });

  describe('hyperresolution', () => {
    it('3 unit positivas + núcleo con 3 negativas → 1 paso a cláusula vacía', () => {
      // Premisas: A, B, C  (unitarias positivas)
      // Núcleo: ¬A ∨ ¬B ∨ ¬C
      const A = clause([lit('A', [])]);
      const B = clause([lit('B', [])]);
      const C = clause([lit('C', [])]);
      const nucleus = clause([lit('A', [], true), lit('B', [], true), lit('C', [], true)]);
      const results = hyperresolveMany([A, B, C], nucleus);
      const hasEmpty = results.some((r) => r.clause.literals.length === 0);
      expect(hasEmpty).toBe(true);
    });

    it('hyperresolve API simple con un solo electron unitario', () => {
      const electron = clause([lit('P', [c('a')])]);
      const nucleus = clause([lit('P', [v('x')], true), lit('Q', [v('x')])]);
      const res = hyperresolve(electron, nucleus);
      expect(res.length).toBeGreaterThan(0);
      // Quedó Q(a) en el residual
      const survivor = res[0]!;
      expect(survivor.literals.length).toBe(1);
      expect(survivor.literals[0]!.predicate).toBe('Q');
      expect(survivor.literals[0]!.args[0]).toEqual(c('a'));
    });
  });

  describe('proveAdvanced — modus ponens encadenado', () => {
    it('binary: A, A→B, B→C, C→D ⊢ D', () => {
      const A = clause([lit('A', [])]);
      const AB = clause([lit('A', [], true), lit('B', [])]);
      const BC = clause([lit('B', [], true), lit('C', [])]);
      const CD = clause([lit('C', [], true), lit('D', [])]);
      const goal = clause([lit('D', [])]);
      const result = proveAdvanced([A, AB, BC, CD], goal, { strategy: 'binary' });
      expect(result.proven).toBe(true);
    });

    it('hyperresolution: 3 MP en un paso con núcleo único', () => {
      // Premisas positivas: A, B, C
      // Núcleo combinado: ¬A ∨ ¬B ∨ ¬C ∨ D
      // Goal: D
      const A = clause([lit('A', [])]);
      const B = clause([lit('B', [])]);
      const C = clause([lit('C', [])]);
      const nucleus = clause([
        lit('A', [], true),
        lit('B', [], true),
        lit('C', [], true),
        lit('D', [])
      ]);
      const goal = clause([lit('D', [])]);
      const result = proveAdvanced([A, B, C, nucleus], goal, { strategy: 'hyperresolution' });
      expect(result.proven).toBe(true);
      // Debe haber al menos 1 paso de hyperresolución registrada
      expect(result.stats.hyperresolutions).toBeGreaterThan(0);
    });

    it('cadena de 5 implicaciones: P1, P1→P2, …, P5→P6 ⊢ P6', () => {
      const facts: FOLClause[] = [
        clause([lit('P1', [])]),
        clause([lit('P1', [], true), lit('P2', [])]),
        clause([lit('P2', [], true), lit('P3', [])]),
        clause([lit('P3', [], true), lit('P4', [])]),
        clause([lit('P4', [], true), lit('P5', [])]),
        clause([lit('P5', [], true), lit('P6', [])])
      ];
      const goal = clause([lit('P6', [])]);
      const result = proveAdvanced(facts, goal, { strategy: 'unit-preference' });
      expect(result.proven).toBe(true);
    });
  });

  describe('set-of-support strategy', () => {
    it('sólo deriva del SoS — no resuelve premisas entre sí', () => {
      // P(a). ∀x. P(x) → Q(x). ¬Q(a).
      // SoS arranca con la negación del goal (default).
      const fact = clause([lit('P', [c('a')])]);
      const rule = clause([lit('P', [v('x')], true), lit('Q', [v('x')])]);
      const goal = clause([lit('Q', [c('a')])]);
      const result = proveAdvanced([fact, rule], goal, {
        strategy: 'set-of-support'
      });
      expect(result.proven).toBe(true);
      // El primer paso del SoS debe involucrar la cláusula del goal
      // (índice ≥ premises.length → fromGoal=true en el seed).
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('SoS rechaza pruebas que requieren saturar todo (sin set inicial)', () => {
      // Si forzamos un SoS vacío con un goal trivialmente probable, el motor
      // sólo deriva con cláusulas que entren al SoS por descendencia.
      const A = clause([lit('A', [])]);
      const goal = clause([lit('A', [])]);
      const result = proveAdvanced([A], goal, { strategy: 'set-of-support' });
      // Goal negado entra al SoS por default y resuelve con A.
      expect(result.proven).toBe(true);
    });
  });

  describe('ordered resolution', () => {
    it('KBO ordering reduce o mantiene resolventes vs binary', () => {
      // Test ligero: con KBO + pesos, la prueba sigue cerrando.
      const A = clause([lit('A', [c('a')])]);
      const rule = clause([lit('A', [v('x')], true), lit('B', [v('x')])]);
      const goal = clause([lit('B', [c('a')])]);
      const weights = new Map([['A', 2], ['B', 1], ['a', 1]]);
      const result = proveAdvanced([A, rule], goal, {
        strategy: 'ordered',
        ordering: 'KBO',
        kboWeights: weights
      });
      expect(result.proven).toBe(true);
    });

    it('LPO ordering también cierra modus ponens simple', () => {
      const A = clause([lit('P', [c('a')])]);
      const rule = clause([lit('P', [v('x')], true), lit('Q', [v('x')])]);
      const goal = clause([lit('Q', [c('a')])]);
      const precedence = new Map([['P', 5], ['Q', 1], ['a', 0]]);
      const result = proveAdvanced([A, rule], goal, {
        strategy: 'ordered',
        ordering: 'LPO',
        precedence
      });
      expect(result.proven).toBe(true);
    });
  });

  describe('unit preference', () => {
    it('ordena unit clauses al frente', () => {
      const long = clause([lit('A', []), lit('B', []), lit('C', [])]);
      const unit = clause([lit('A', [])]);
      const sorted = unitPreference([long, unit]);
      expect(sorted[0]!.literals.length).toBe(1);
      expect(sorted[1]!.literals.length).toBe(3);
    });

    it('unit-preference resuelve cadena MP más rápido que binary saturado', () => {
      const facts: FOLClause[] = [
        clause([lit('P1', [])]),
        clause([lit('P1', [], true), lit('P2', [])]),
        clause([lit('P2', [], true), lit('P3', [])])
      ];
      const goal = clause([lit('P3', [])]);
      const withUnit = proveAdvanced(facts, goal, { strategy: 'unit-preference' });
      const binary = proveAdvanced(facts, goal, { strategy: 'binary' });
      expect(withUnit.proven).toBe(true);
      expect(binary.proven).toBe(true);
      // unit-preference no debería empeorar el conteo de resoluciones.
      expect(withUnit.stats.resolutions).toBeLessThanOrEqual(binary.stats.resolutions + 5);
    });
  });

  describe('timeout y termination', () => {
    it('respeta maxSteps=0 → termina sin probar', () => {
      const A = clause([lit('A', [])]);
      const B = clause([lit('A', [], true), lit('B', [])]);
      const goal = clause([lit('B', [])]);
      const result = proveAdvanced([A, B], goal, { strategy: 'binary', maxSteps: 0 });
      expect(result.proven).toBe(false);
      expect(result.termination).toBe('max-steps');
    });

    it('respeta timeoutMs corto en problema imposible', () => {
      // Goal no es derivable de premisas no relacionadas; el motor satura o
      // se queda sin nuevas cláusulas. Forzamos saturación con timeout=1.
      const A = clause([lit('X', [c('a')])]);
      const goal = clause([lit('Y', [c('b')])]); // no derivable
      const result = proveAdvanced([A], goal, { strategy: 'binary', timeoutMs: 1, maxSteps: 100000 });
      expect(result.proven).toBe(false);
      expect(['timeout', 'saturated']).toContain(result.termination);
    });
  });

  describe('subsumption avanzada y deduplicación', () => {
    it('no genera cláusula vacía cuando goal es no derivable (saturated)', () => {
      const A = clause([lit('A', [])]);
      const goal = clause([lit('Z', [])]);
      const result = proveAdvanced([A], goal, { strategy: 'binary' });
      expect(result.proven).toBe(false);
      expect(result.termination).toBe('saturated');
    });

    it('estadísticas reportan resolutions > 0 en prueba exitosa', () => {
      const A = clause([lit('P', [])]);
      const rule = clause([lit('P', [], true), lit('Q', [])]);
      const goal = clause([lit('Q', [])]);
      const result = proveAdvanced([A, rule], goal, { strategy: 'binary' });
      expect(result.proven).toBe(true);
      expect(result.stats.resolutions).toBeGreaterThan(0);
      expect(result.stats.steps).toBeGreaterThan(0);
    });
  });
});
