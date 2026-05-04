import { describe, expect, it } from 'vitest';
import { escapeHtml, safeUrl } from '@/lib/html-utils';

describe('escapeHtml', () => {
  it('escapa los 5 caracteres peligrosos', () => {
    expect(escapeHtml('<script>"&\'</script>'))
      .toBe('&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');
  });

  it('deja texto inocuo intacto', () => {
    expect(escapeHtml('hola mundo')).toBe('hola mundo');
  });

  it('escapa & primero (no doble-escape)', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
});

describe('safeUrl', () => {
  it('rechaza javascript:', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('#');
  });

  it('rechaza vbscript:', () => {
    expect(safeUrl('vbscript:msgbox(1)')).toBe('#');
  });

  it('acepta https://', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com');
  });

  it('acepta http://', () => {
    expect(safeUrl('http://example.com')).toBe('http://example.com');
  });

  it('acepta mailto:', () => {
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('acepta tel:', () => {
    expect(safeUrl('tel:+5551234567')).toBe('tel:+5551234567');
  });

  it('acepta data:image/png', () => {
    expect(safeUrl('data:image/png;base64,iVBOR')).toBe('data:image/png;base64,iVBOR');
  });

  it('rechaza data:text/html', () => {
    expect(safeUrl('data:text/html,<script>')).toBe('#');
  });

  it('acepta anchors locales', () => {
    expect(safeUrl('#section')).toBe('#section');
  });

  it('acepta paths relativos', () => {
    expect(safeUrl('/foo/bar')).toBe('/foo/bar');
  });

  it('null/undefined/vacío → fallback', () => {
    expect(safeUrl(null)).toBe('#');
    expect(safeUrl(undefined)).toBe('#');
    expect(safeUrl('')).toBe('#');
  });

  it('respeta fallback custom', () => {
    expect(safeUrl(null, '/error')).toBe('/error');
    expect(safeUrl('javascript:x', '/blocked')).toBe('/blocked');
  });

  it('rechaza URLs malformadas', () => {
    expect(safeUrl('http://[invalid')).toBe('#');
  });

  it('hace trim de whitespace', () => {
    expect(safeUrl('  https://example.com  ')).toBe('https://example.com');
  });
});
