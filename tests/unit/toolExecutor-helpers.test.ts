import { describe, it, expect } from 'vitest';
import {
  clamp,
  excerpt,
  sanitizeFirestoreValue,
  resolveSemanticDocId,
  normalizeLookupKey,
  MAX_CONTENT_PREVIEW
} from '@/lib/agora-ai/toolExecutor-helpers';
import { PERSONAL_WORKSPACE_ID } from '@/types/workspace';

describe('clamp', () => {
  it('respeta min/max', () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(99, 1, 10)).toBe(10);
  });
});

describe('excerpt', () => {
  it('no recorta texto corto', () => {
    expect(excerpt('hola')).toBe('hola');
  });
  it('recorta y agrega …', () => {
    const long = 'x'.repeat(MAX_CONTENT_PREVIEW + 100);
    const r = excerpt(long);
    expect(r.length).toBe(MAX_CONTENT_PREVIEW + 1);
    expect(r.endsWith('…')).toBe(true);
  });
  it('respeta maxLength custom', () => {
    expect(excerpt('hola mundo', 4)).toBe('hola…');
  });
});

describe('sanitizeFirestoreValue', () => {
  it('undefined → null', () => {
    expect(sanitizeFirestoreValue(undefined)).toBeNull();
  });
  it('preserva primitivos', () => {
    expect(sanitizeFirestoreValue(42)).toBe(42);
    expect(sanitizeFirestoreValue('foo')).toBe('foo');
    expect(sanitizeFirestoreValue(false)).toBe(false);
  });
  it('recursivo en arrays', () => {
    expect(sanitizeFirestoreValue([1, undefined, 'x'])).toEqual([1, null, 'x']);
  });
  it('recursivo en objetos', () => {
    expect(sanitizeFirestoreValue({ a: 1, b: undefined, c: { d: undefined } }))
      .toEqual({ a: 1, b: null, c: { d: null } });
  });
});

describe('resolveSemanticDocId', () => {
  it('personal → personal:<uid>', () => {
    expect(resolveSemanticDocId('personal', 'u1')).toBe(`${PERSONAL_WORKSPACE_ID}:u1`);
  });
  it('shared → workspaceId directo', () => {
    expect(resolveSemanticDocId('ws-abc', 'u1')).toBe('ws-abc');
  });
});

describe('normalizeLookupKey', () => {
  it('trim + lowercase', () => {
    expect(normalizeLookupKey('  HOLA Mundo  ')).toBe('hola mundo');
  });
});
