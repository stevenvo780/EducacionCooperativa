import { describe, expect, it } from 'vitest';
import {
  checkAllAxioms,
  checkExtensionality,
  checkFoundation,
  checkInfinity,
  checkPairing,
  checkPowerSet,
  checkUnion
} from '@/reasoning/set-theory';

describe('ZFC axioms on Vω', () => {
  it('Extensionality holds (canonicalization es extensional)', () => {
    const r = checkExtensionality();
    expect(r.holds).toBe(true);
    expect(r.name).toBe('Extensionality');
  });

  it('Pairing holds', () => {
    const r = checkPairing();
    expect(r.holds).toBe(true);
    expect(r.counterexample).toBeUndefined();
  });

  it('Union holds', () => {
    const r = checkUnion();
    expect(r.holds).toBe(true);
  });

  it('Power Set holds (|P(A)| = 2^|A|)', () => {
    const r = checkPowerSet();
    expect(r.holds).toBe(true);
  });

  it('Foundation holds (Vω es bien fundada)', () => {
    const r = checkFoundation();
    expect(r.holds).toBe(true);
  });

  it('Infinity FALLA en Vω (no hay conjunto inductivo)', () => {
    const r = checkInfinity();
    expect(r.holds).toBe(false);
    expect(r.note).toBeDefined();
    // El contraejemplo debe ser una cadena ascendente de successors.
    expect(r.counterexample).toBeDefined();
    if (r.counterexample !== undefined) {
      expect(r.counterexample.length).toBeGreaterThan(8);
    }
  });

  it('checkAllAxioms devuelve 6 resultados con shapes consistentes', () => {
    const all = checkAllAxioms();
    expect(all.length).toBe(6);
    const names = all.map((a) => a.name).sort();
    expect(names).toEqual([
      'Extensionality',
      'Foundation',
      'Infinity',
      'Pairing',
      'Power Set',
      'Union'
    ]);
    // Sólo Infinity falla.
    const failing = all.filter((a) => !a.holds);
    expect(failing.length).toBe(1);
    expect(failing[0]?.name).toBe('Infinity');
  });
});
