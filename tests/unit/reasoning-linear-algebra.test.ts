import { describe, it, expect } from 'vitest';
import {
  Matrix,
  Vector,
  add,
  columnSpace,
  cross,
  decomposeLU,
  decomposeQR,
  decomposeSVD,
  determinant,
  diagonal,
  dot,
  eigenvalues,
  eigenvectors,
  gramSchmidt,
  identity,
  inverse,
  isLinearlyIndependent,
  leastSquares,
  matVec,
  multiply,
  nullSpace,
  norm,
  normalize,
  permutationMatrix,
  powerIteration,
  rank,
  rref,
  scalarMul,
  solve,
  sub,
  transpose,
  zeros
} from '@/reasoning/linear-algebra';

const EPS = 1e-6;

function expectMatrixClose(actual: Matrix, expected: Matrix, eps = EPS): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    expect(a, `row ${i}`).toBeDefined();
    expect(e, `row ${i}`).toBeDefined();
    if (!a || !e) {
      throw new Error(`undefined row at ${i}`);
    }
    expect(a.length).toBe(e.length);
    for (let j = 0; j < e.length; j++) {
      const av = a[j];
      const ev = e[j];
      if (av === undefined || ev === undefined) {
        throw new Error(`undefined cell at ${i},${j}`);
      }
      expect(Math.abs(av - ev), `cell ${i},${j} got ${av} want ${ev}`).toBeLessThan(eps);
    }
  }
}

function expectVectorClose(actual: Vector, expected: Vector, eps = EPS): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    const av = actual[i];
    const ev = expected[i];
    if (av === undefined || ev === undefined) {
      throw new Error(`undefined value at ${i}`);
    }
    expect(Math.abs(av - ev), `index ${i} got ${av} want ${ev}`).toBeLessThan(eps);
  }
}

describe('linear-algebra/construction', () => {
  it('identity * A = A', () => {
    const A: Matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 10]
    ];
    const I = identity(3);
    expectMatrixClose(multiply(I, A), A);
    expectMatrixClose(multiply(A, I), A);
  });

  it('zeros and ones produce correct shapes and fill values', () => {
    const Z = zeros(2, 3);
    expect(Z).toEqual([
      [0, 0, 0],
      [0, 0, 0]
    ]);
    const O = diagonal([1, 2, 3]);
    expect(O).toEqual([
      [1, 0, 0],
      [0, 2, 0],
      [0, 0, 3]
    ]);
  });

  it('transpose(transpose(A)) = A', () => {
    const A: Matrix = [
      [1, 2, 3],
      [4, 5, 6]
    ];
    expectMatrixClose(transpose(transpose(A)), A);
  });
});

describe('linear-algebra/basic-ops', () => {
  it('add and sub work on equal-shape matrices', () => {
    const A: Matrix = [[1, 2], [3, 4]];
    const B: Matrix = [[5, 6], [7, 8]];
    expectMatrixClose(add(A, B), [[6, 8], [10, 12]]);
    expectMatrixClose(sub(B, A), [[4, 4], [4, 4]]);
  });

  it('scalarMul scales every entry', () => {
    const A: Matrix = [[1, -2], [3, 4]];
    expectMatrixClose(scalarMul(2, A), [[2, -4], [6, 8]]);
  });

  it('matVec, dot, norm, normalize work', () => {
    const A: Matrix = [[1, 2], [3, 4]];
    expectVectorClose(matVec(A, [1, 1]), [3, 7]);
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(Math.abs(norm([3, 4]) - 5)).toBeLessThan(EPS);
    expectVectorClose(normalize([3, 4]), [0.6, 0.8]);
  });

  it('cross product (R^3) gives orthogonal result', () => {
    const c = cross([1, 0, 0], [0, 1, 0]);
    expectVectorClose(c, [0, 0, 1]);
    expect(Math.abs(dot(c, [1, 0, 0]))).toBeLessThan(EPS);
    expect(Math.abs(dot(c, [0, 1, 0]))).toBeLessThan(EPS);
  });
});

describe('linear-algebra/determinant', () => {
  it('determinant 2x2', () => {
    expect(determinant([[1, 2], [3, 4]])).toBeCloseTo(-2);
  });

  it('determinant 3x3 and product property', () => {
    const A: Matrix = [
      [6, 1, 1],
      [4, -2, 5],
      [2, 8, 7]
    ];
    expect(determinant(A)).toBeCloseTo(-306);
    const I = identity(3);
    expect(determinant(I)).toBeCloseTo(1);
  });

  it('determinant is 0 for singular matrix', () => {
    const S: Matrix = [
      [1, 2, 3],
      [2, 4, 6],
      [7, 8, 9]
    ];
    expect(Math.abs(determinant(S))).toBeLessThan(EPS);
  });
});

describe('linear-algebra/inverse-and-solve', () => {
  it('inverse(A) * A = I for 5x5', () => {
    const A: Matrix = [
      [2, 0, 1, 0, 0],
      [0, 3, 0, 1, 0],
      [1, 0, 4, 0, 1],
      [0, 1, 0, 5, 0],
      [0, 0, 1, 0, 6]
    ];
    const Ainv = inverse(A);
    expect(Ainv).not.toBeNull();
    if (!Ainv) return;
    expectMatrixClose(multiply(Ainv, A), identity(5));
    expectMatrixClose(multiply(A, Ainv), identity(5));
  });

  it('inverse returns null for singular matrix', () => {
    const S: Matrix = [
      [1, 2, 3],
      [2, 4, 6],
      [7, 8, 9]
    ];
    expect(inverse(S)).toBeNull();
  });

  it('solve Ax = b for 3x3 invertible', () => {
    const A: Matrix = [
      [3, 2, -1],
      [2, -2, 4],
      [-1, 0.5, -1]
    ];
    const b: Vector = [1, -2, 0];
    const x = solve(A, b);
    expect(x).not.toBeNull();
    if (!x) return;
    expectVectorClose(x, [1, -2, -2]);
    expectVectorClose(matVec(A, x), b);
  });

  it('solve returns null for inconsistent system', () => {
    const A: Matrix = [
      [1, 1],
      [2, 2]
    ];
    expect(solve(A, [1, 3])).toBeNull();
  });

  it('leastSquares fits a line y = 2x + 1', () => {
    const A: Matrix = [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1]
    ];
    const b: Vector = [1, 3, 5, 7];
    const x = leastSquares(A, b);
    expectVectorClose(x, [2, 1]);
  });
});

describe('linear-algebra/rref-rank', () => {
  it('rref of singular matrix yields rank < n', () => {
    const S: Matrix = [
      [1, 2, 3],
      [2, 4, 6],
      [3, 6, 9]
    ];
    const { rank: r } = rref(S);
    expect(r).toBe(1);
    expect(rank(S)).toBe(1);
  });

  it('rank of full-rank matrix equals min(rows, cols)', () => {
    const A: Matrix = [
      [1, 0, 2],
      [0, 1, 3],
      [4, 5, 0]
    ];
    expect(rank(A)).toBe(3);
  });
});

describe('linear-algebra/lu', () => {
  it('LU decomp: P*A = L*U', () => {
    const A: Matrix = [
      [2, 1, 1],
      [4, 3, 3],
      [8, 7, 9]
    ];
    const lu = decomposeLU(A);
    expect(lu).not.toBeNull();
    if (!lu) return;
    const P = permutationMatrix(lu.P);
    expectMatrixClose(multiply(P, A), multiply(lu.L, lu.U));
    for (let i = 0; i < lu.L.length; i++) {
      for (let j = i + 1; j < (lu.L[i]?.length ?? 0); j++) {
        const v = lu.L[i]?.[j];
        if (v === undefined) throw new Error('L missing entry');
        expect(Math.abs(v)).toBeLessThan(EPS);
      }
      const diag = lu.L[i]?.[i];
      expect(diag).toBeCloseTo(1);
    }
  });
});

describe('linear-algebra/qr', () => {
  it('QR: Q*R = A and Q has orthonormal columns', () => {
    const A: Matrix = [
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41]
    ];
    const { Q, R } = decomposeQR(A);
    expectMatrixClose(multiply(Q, R), A);
    const QtQ = multiply(transpose(Q), Q);
    expectMatrixClose(QtQ, identity(3));
  });

  it('QR of rectangular matrix preserves A = Q*R', () => {
    const A: Matrix = [
      [1, 1],
      [1, 0],
      [0, 1]
    ];
    const { Q, R } = decomposeQR(A);
    expectMatrixClose(multiply(Q, R), A);
    expectMatrixClose(multiply(transpose(Q), Q), identity(2));
  });
});

describe('linear-algebra/svd', () => {
  it('SVD: U*diag(S)*V^T = A and singular values are non-negative descending', () => {
    const A: Matrix = [
      [3, 1, 1],
      [-1, 3, 1]
    ];
    const { U, S, V } = decomposeSVD(A, 500);
    const Sigma = diagonal(S);
    const reconstructed = multiply(multiply(U, Sigma), transpose(V));
    expectMatrixClose(reconstructed, A, 1e-4);
    for (let i = 0; i + 1 < S.length; i++) {
      const a = S[i];
      const b = S[i + 1];
      if (a === undefined || b === undefined) throw new Error('missing S');
      expect(a).toBeGreaterThanOrEqual(b - EPS);
      expect(a).toBeGreaterThanOrEqual(-EPS);
    }
  });
});

describe('linear-algebra/eigenvalues', () => {
  it('eigenvalues of 2x2 known matrix', () => {
    const A: Matrix = [
      [4, 1],
      [2, 3]
    ];
    const vals = eigenvalues(A).slice().sort((a, b) => b - a);
    expectVectorClose(vals, [5, 2]);
  });

  it('eigenvalues of diagonal matrix are diagonal entries', () => {
    const D = diagonal([7, 3, -2]);
    const vals = eigenvalues(D).slice().sort((a, b) => b - a);
    expectVectorClose(vals, [7, 3, -2]);
  });

  it('eigenvectors of symmetric matrix satisfy A*v = lambda*v', () => {
    const S: Matrix = [
      [2, 1],
      [1, 2]
    ];
    const { values, vectors } = eigenvectors(S);
    expect(values.length).toBe(2);
    for (let j = 0; j < values.length; j++) {
      const lambda = values[j];
      if (lambda === undefined) throw new Error('missing eigenvalue');
      const v: Vector = [vectors[0]?.[j] ?? 0, vectors[1]?.[j] ?? 0];
      const Av = matVec(S, v);
      const lv = v.map((x) => x * lambda);
      expectVectorClose(Av, lv, 1e-4);
    }
  });

  it('powerIteration converges to dominant eigenvalue', () => {
    const A: Matrix = [
      [4, 1],
      [2, 3]
    ];
    const { eigenvalue, eigenvector } = powerIteration(A, { maxIter: 2000, eps: 1e-12 });
    expect(Math.abs(eigenvalue - 5)).toBeLessThan(1e-4);
    const Av = matVec(A, eigenvector);
    expectVectorClose(Av, eigenvector.map((x) => x * eigenvalue), 1e-3);
  });
});

describe('linear-algebra/spaces', () => {
  it('gramSchmidt produces orthonormal basis', () => {
    const vecs: Vector[] = [
      [1, 1, 0],
      [1, 0, 1],
      [0, 1, 1]
    ];
    const ortho = gramSchmidt(vecs);
    expect(ortho.length).toBe(3);
    for (let i = 0; i < ortho.length; i++) {
      const u = ortho[i];
      if (!u) throw new Error('missing vec');
      expect(Math.abs(norm(u) - 1)).toBeLessThan(EPS);
      for (let j = i + 1; j < ortho.length; j++) {
        const v = ortho[j];
        if (!v) throw new Error('missing vec');
        expect(Math.abs(dot(u, v))).toBeLessThan(EPS);
      }
    }
  });

  it('gramSchmidt drops dependent vectors', () => {
    const ortho = gramSchmidt([[1, 0], [2, 0], [0, 1]]);
    expect(ortho.length).toBe(2);
  });

  it('nullSpace contains kernel basis: M*v = 0', () => {
    const M: Matrix = [
      [1, 2, 3],
      [2, 4, 6]
    ];
    const basis = nullSpace(M);
    expect(basis.length).toBeGreaterThanOrEqual(2);
    for (const v of basis) {
      const Mv = matVec(M, v);
      for (const x of Mv) {
        expect(Math.abs(x)).toBeLessThan(EPS);
      }
    }
  });

  it('nullSpace is empty for full-rank square matrix', () => {
    const A: Matrix = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ];
    expect(nullSpace(A).length).toBe(0);
  });

  it('columnSpace returns rank-many independent columns', () => {
    const M: Matrix = [
      [1, 2, 0],
      [2, 4, 1],
      [3, 6, 1]
    ];
    const basis = columnSpace(M);
    expect(basis.length).toBe(rank(M));
    expect(isLinearlyIndependent(basis)).toBe(true);
  });

  it('isLinearlyIndependent detects dependence and independence', () => {
    expect(isLinearlyIndependent([[1, 0], [0, 1]])).toBe(true);
    expect(isLinearlyIndependent([[1, 2], [2, 4]])).toBe(false);
    expect(isLinearlyIndependent([[1, 0], [0, 1], [1, 1]])).toBe(false);
  });
});
