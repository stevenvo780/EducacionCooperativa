import { describe, it, expect } from 'vitest';
import {
  factorial,
  binomial,
  multinomial,
  permutations,
  combinations,
  generatePermutations,
  generateCombinations,
  generatePowerSet,
  generateSubsetsOfSize,
  permutationParity,
  permutationCycles,
  permutationOrder,
  composePermutations,
  inversePermutation,
  partitions,
  partitionsCount,
  partitionsIntoParts,
  stirlingSecondKind,
  stirlingFirstKind,
  catalan,
  bellNumber,
  eulerNumber,
  eulerianNumber,
  setPartitions,
  setPartitionsCount,
  burnsideCount,
  cyclicRotations,
  multiplyPolynomials,
  generatingFunction,
  binomialGF,
  inclusionExclusion
} from '@/reasoning/combinatorics';

describe('basic counts', () => {
  it('factorial(0)=1, factorial(10)=3628800', () => {
    expect(factorial(0)).toBe(1n);
    expect(factorial(1)).toBe(1n);
    expect(factorial(10)).toBe(3628800n);
    expect(factorial(20)).toBe(2432902008176640000n);
  });

  it('binomial(10,3)=120 y simetría', () => {
    expect(binomial(10, 3)).toBe(120n);
    expect(binomial(10, 7)).toBe(120n);
    expect(binomial(5, 0)).toBe(1n);
    expect(binomial(5, 5)).toBe(1n);
    expect(binomial(5, 6)).toBe(0n);
    expect(binomial(52, 5)).toBe(2598960n);
  });

  it('multinomial(6,[1,2,3]) = 60', () => {
    expect(multinomial(6, [1, 2, 3])).toBe(60n);
    expect(multinomial(10, [2, 3, 5])).toBe(2520n);
    expect(() => multinomial(5, [1, 2])).toThrow();
  });

  it('permutations(5,2)=20 y P(n,n)=n!', () => {
    expect(permutations(5, 2)).toBe(20n);
    expect(permutations(5, 5)).toBe(120n);
    expect(permutations(5, 0)).toBe(1n);
    expect(permutations(5, 6)).toBe(0n);
  });

  it('combinations alias de binomial', () => {
    expect(combinations(7, 3)).toBe(35n);
  });

  it('factorial rechaza negativos y no enteros', () => {
    expect(() => factorial(-1)).toThrow();
    expect(() => factorial(1.5)).toThrow();
  });
});

describe('generators', () => {
  it('generatePermutations([1,2,3]) produce 6 únicos', () => {
    const perms = Array.from(generatePermutations([1, 2, 3]));
    expect(perms).toHaveLength(6);
    const uniq = new Set(perms.map((p) => p.join(',')));
    expect(uniq.size).toBe(6);
    expect(uniq.has('1,2,3')).toBe(true);
    expect(uniq.has('3,2,1')).toBe(true);
  });

  it('generatePermutations([]) = [[]]', () => {
    const perms = Array.from(generatePermutations<number>([]));
    expect(perms).toHaveLength(1);
    expect(perms[0]).toEqual([]);
  });

  it('generateCombinations([1,2,3,4],2) produce 6', () => {
    const combs = Array.from(generateCombinations([1, 2, 3, 4], 2));
    expect(combs).toHaveLength(6);
    expect(combs).toEqual([
      [1, 2],
      [1, 3],
      [1, 4],
      [2, 3],
      [2, 4],
      [3, 4]
    ]);
  });

  it('generateCombinations(r=0) emite [] y r>n nada', () => {
    expect(Array.from(generateCombinations([1, 2], 0))).toEqual([[]]);
    expect(Array.from(generateCombinations([1, 2], 5))).toEqual([]);
  });

  it('generatePowerSet([a,b,c]) tiene 8 subconjuntos', () => {
    const ps = Array.from(generatePowerSet(['a', 'b', 'c']));
    expect(ps).toHaveLength(8);
    expect(ps[0]).toEqual([]);
    expect(ps).toContainEqual(['a', 'b', 'c']);
  });

  it('generateSubsetsOfSize coincide con generateCombinations', () => {
    const a = Array.from(generateSubsetsOfSize([1, 2, 3, 4, 5], 3));
    const b = Array.from(generateCombinations([1, 2, 3, 4, 5], 3));
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
  });
});

describe('permutation ops', () => {
  it('parity: identidad par, transposición impar', () => {
    expect(permutationParity([0, 1, 2])).toBe(1);
    expect(permutationParity([1, 0, 2])).toBe(-1);
    expect(permutationParity([1, 2, 0])).toBe(1); // 3-ciclo = 2 transposiciones
    expect(permutationParity([2, 0, 1])).toBe(1);
    expect(permutationParity([3, 2, 1, 0])).toBe(1); // dos transposiciones
  });

  it('cycles de (2,0,1) = [[0,2,1]]', () => {
    // perm[0]=2 => 0->2; perm[2]=1 => 2->1; perm[1]=0 => 1->0
    const cycles = permutationCycles([2, 0, 1]);
    expect(cycles).toHaveLength(1);
    const c = cycles[0];
    expect(c).toBeDefined();
    expect(c?.sort()).toEqual([0, 1, 2]);
  });

  it('cycles de identidad son fijos', () => {
    expect(permutationCycles([0, 1, 2, 3])).toEqual([[0], [1], [2], [3]]);
  });

  it('order de un 3-ciclo es 3, de dos transposiciones disjuntas es 2', () => {
    expect(permutationOrder([1, 2, 0])).toBe(3);
    expect(permutationOrder([1, 0, 3, 2])).toBe(2);
    expect(permutationOrder([0, 1, 2])).toBe(1);
  });

  it('composePermutations componiendo con inversa = identidad', () => {
    const p = [2, 0, 3, 1];
    const inv = inversePermutation(p);
    expect(composePermutations(p, inv)).toEqual([0, 1, 2, 3]);
    expect(composePermutations(inv, p)).toEqual([0, 1, 2, 3]);
  });

  it('inversePermutation([2,0,1]) = [1,2,0]', () => {
    expect(inversePermutation([2, 0, 1])).toEqual([1, 2, 0]);
  });

  it('rechaza permutaciones inválidas', () => {
    expect(() => permutationParity([0, 0, 1])).toThrow();
    expect(() => permutationCycles([3, 0, 1])).toThrow(); // 3 fuera de [0,3)
  });
});

describe('partitions', () => {
  it('partitions(5) tiene 7 particiones', () => {
    const ps = partitions(5);
    expect(ps).toHaveLength(7);
    // representamos cada partición como string ordenado descendente
    const set = new Set(ps.map((p) => p.join('+')));
    expect(set.has('5')).toBe(true);
    expect(set.has('4+1')).toBe(true);
    expect(set.has('3+2')).toBe(true);
    expect(set.has('3+1+1')).toBe(true);
    expect(set.has('2+2+1')).toBe(true);
    expect(set.has('2+1+1+1')).toBe(true);
    expect(set.has('1+1+1+1+1')).toBe(true);
  });

  it('partitionsCount coincide con secuencia p(n)', () => {
    const expected = [1n, 1n, 2n, 3n, 5n, 7n, 11n, 15n, 22n, 30n, 42n];
    for (let n = 0; n < expected.length; n++) {
      expect(partitionsCount(n)).toBe(expected[n]);
    }
    expect(partitionsCount(50)).toBe(204226n);
  });

  it('partitionsIntoParts: p_3(7) = 4', () => {
    // particiones de 7 en exactamente 3 partes: 5+1+1, 4+2+1, 3+3+1, 3+2+2
    expect(partitionsIntoParts(7, 3)).toBe(4n);
    expect(partitionsIntoParts(0, 0)).toBe(1n);
    expect(partitionsIntoParts(5, 5)).toBe(1n);
  });
});

describe('special numbers', () => {
  it('stirlingSecondKind(4,2)=7', () => {
    expect(stirlingSecondKind(4, 2)).toBe(7n);
    expect(stirlingSecondKind(0, 0)).toBe(1n);
    expect(stirlingSecondKind(5, 3)).toBe(25n);
    expect(stirlingSecondKind(6, 2)).toBe(31n);
  });

  it('stirlingFirstKind valores conocidos', () => {
    // c(4,2) = 11; c(5,2)=50
    expect(stirlingFirstKind(4, 2)).toBe(11n);
    expect(stirlingFirstKind(5, 2)).toBe(50n);
    expect(stirlingFirstKind(0, 0)).toBe(1n);
  });

  it('catalan(5)=42 y secuencia', () => {
    const expected = [1n, 1n, 2n, 5n, 14n, 42n, 132n, 429n, 1430n];
    for (let n = 0; n < expected.length; n++) {
      expect(catalan(n)).toBe(expected[n]);
    }
  });

  it('bellNumber(4)=15 y secuencia', () => {
    const expected = [1n, 1n, 2n, 5n, 15n, 52n, 203n, 877n, 4140n];
    for (let n = 0; n < expected.length; n++) {
      expect(bellNumber(n)).toBe(expected[n]);
    }
  });

  it('eulerNumber (zigzag) secuencia A000111', () => {
    // 1, 1, 1, 2, 5, 16, 61, 272, 1385
    const expected = [1n, 1n, 1n, 2n, 5n, 16n, 61n, 272n, 1385n];
    for (let n = 0; n < expected.length; n++) {
      expect(eulerNumber(n)).toBe(expected[n]);
    }
  });

  it('eulerianNumber(4,2)=11 (descents)', () => {
    // <4,0>=1, <4,1>=11, <4,2>=11, <4,3>=1; suma 24 = 4!
    expect(eulerianNumber(4, 1)).toBe(11n);
    expect(eulerianNumber(4, 2)).toBe(11n);
    expect(eulerianNumber(4, 0)).toBe(1n);
    expect(eulerianNumber(4, 3)).toBe(1n);
  });
});

describe('set partitions', () => {
  it('setPartitions([a,b,c]) tiene 5 = Bell(3)', () => {
    const ps = setPartitions(['a', 'b', 'c']);
    expect(ps).toHaveLength(5);
  });

  it('setPartitionsCount coincide con bellNumber', () => {
    for (let n = 0; n < 7; n++) {
      expect(setPartitionsCount(n)).toBe(bellNumber(n));
    }
  });

  it('setPartitions ítems vacíos = [[]]', () => {
    const ps = setPartitions<number>([]);
    expect(ps).toEqual([[]]);
  });
});

describe('burnside', () => {
  it('cuenta collares de 3 perlas con 3 colores y rotaciones', () => {
    // |collares| = (1/3)*(3^3 + 3 + 3) = (27+3+3)/3 = 11
    const rots = cyclicRotations(3) as Array<(x: string[]) => string[]>;
    const count = burnsideCount(['R', 'G', 'B'], 3, rots);
    expect(count).toBe(11);
  });

  it('grupo trivial reproduce |X|', () => {
    const id: (x: string[]) => string[] = (x) => x.slice();
    const count = burnsideCount(['a', 'b'], 3, [id]);
    expect(count).toBe(8);
  });

  it('rechaza groupActions vacío', () => {
    expect(() => burnsideCount([1], 2, [])).toThrow();
  });
});

describe('generating functions', () => {
  it('multiplyPolynomials (1+x)*(1+x) = 1+2x+x^2', () => {
    expect(multiplyPolynomials([1, 1], [1, 1])).toEqual([1, 2, 1]);
  });

  it('multiplyPolynomials (1+x)^4 coeficientes son binomiales', () => {
    let p = [1, 1];
    for (let i = 0; i < 3; i++) p = multiplyPolynomials(p, [1, 1]);
    expect(p).toEqual([1, 4, 6, 4, 1]);
  });

  it('binomialGF(5) = fila 5 del triángulo de Pascal', () => {
    expect(binomialGF(5)).toEqual([1, 5, 10, 10, 5, 1]);
    expect(binomialGF(0)).toEqual([1]);
  });

  it('generatingFunction trunca/rellena', () => {
    expect(generatingFunction([1, 2, 3], 5)).toEqual([1, 2, 3, 0, 0, 0]);
    expect(generatingFunction([1, 2, 3, 4, 5, 6], 2)).toEqual([1, 2, 3]);
  });
});

describe('inclusion-exclusion', () => {
  it('|A∪B∪C| con A={1,2,3}, B={2,3,4}, C={3,4,5} = 5', () => {
    const A = new Set([1, 2, 3]);
    const B = new Set([2, 3, 4]);
    const C = new Set([3, 4, 5]);
    expect(inclusionExclusion([A, B, C])).toBe(5);
  });

  it('conjuntos disjuntos suman', () => {
    const A = new Set([1, 2]);
    const B = new Set([3, 4]);
    const C = new Set([5, 6]);
    expect(inclusionExclusion([A, B, C])).toBe(6);
  });

  it('vacío = 0, un solo set = |set|', () => {
    expect(inclusionExclusion([])).toBe(0);
    expect(inclusionExclusion([new Set([1, 2, 3, 4])])).toBe(4);
  });
});
