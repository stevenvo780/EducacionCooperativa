import { describe, it, expect } from 'vitest';
import { stripUndefinedDeep } from '@/lib/notebooks';

describe('stripUndefinedDeep', () => {
  it('elimina claves undefined en el nivel raíz', () => {
    expect(stripUndefinedDeep({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('preserva valores falsy válidos (0, false, "", null)', () => {
    const input = { zero: 0, no: false, empty: '', nada: null };
    expect(stripUndefinedDeep(input)).toEqual(input);
  });

  it('elimina undefined dentro de outputs de celdas (repro del bug)', () => {
    const notebook = {
      version: '1',
      metadata: { title: 't', profile: 'classical' },
      cells: [
        {
          id: 'c1',
          type: 'code',
          source: 'p',
          outputs: [
            {
              type: 'result',
              data: { valid: true, stdout: undefined, results: undefined },
              metadata: { executionTime: 5 }
            }
          ]
        }
      ]
    };
    const out = stripUndefinedDeep(notebook) as typeof notebook;
    const data = out.cells[0]!.outputs[0]!.data as Record<string, unknown>;
    expect('stdout' in data).toBe(false);
    expect('results' in data).toBe(false);
    expect(data['valid']).toBe(true);
    expect(out.cells[0]!.outputs[0]!.metadata).toEqual({ executionTime: 5 });
  });

  it('no contiene ningún undefined tras serializar a JSON (lo que rechaza Firestore)', () => {
    const payload = {
      notebook: {
        cells: [{ id: 'x', data: { a: undefined, b: 'ok', c: [{ d: undefined, e: 0 }] } }]
      },
      title: 't'
    };
    const clean = stripUndefinedDeep(payload);
    const findUndefined = (v: unknown): boolean => {
      if (Array.isArray(v)) return v.some(findUndefined);
      if (v !== null && typeof v === 'object') {
        return Object.values(v).some(x => x === undefined || findUndefined(x));
      }
      return false;
    };
    expect(findUndefined(clean)).toBe(false);
  });

  it('preserva arrays anidados intactos salvo sus undefined', () => {
    const out = stripUndefinedDeep({ list: [{ keep: 1, drop: undefined }, { keep: 2 }] });
    expect(out).toEqual({ list: [{ keep: 1 }, { keep: 2 }] });
  });
});
