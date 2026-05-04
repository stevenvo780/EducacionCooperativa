import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '@/lib/safe-html';

describe('sanitizeHtml', () => {
  it('preserva texto y tags básicos', () => {
    expect(sanitizeHtml('<p>hola</p>')).toBe('<p>hola</p>');
  });

  it('elimina scripts', () => {
    const dirty = '<p>antes</p><script>alert(1)</script><p>despues</p>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('antes');
    expect(clean).toContain('despues');
  });

  it('elimina event handlers inline', () => {
    const dirty = '<a href="#" onclick="alert(1)">click</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toMatch(/onclick/i);
  });

  it('elimina iframe', () => {
    const dirty = '<iframe src="https://evil"></iframe>';
    expect(sanitizeHtml(dirty)).not.toContain('<iframe');
  });

  it('bloquea javascript: en href', () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('javascript:');
  });

  it('preserva https:// en href', () => {
    const dirty = '<a href="https://example.com">link</a>';
    expect(sanitizeHtml(dirty)).toContain('https://example.com');
  });

  it('preserva data:image en src', () => {
    const dirty = '<img src="data:image/png;base64,iVBOR">';
    expect(sanitizeHtml(dirty)).toContain('data:image/png');
  });

  it('elimina form/input', () => {
    const clean = sanitizeHtml('<form><input name="a"/></form>');
    expect(clean).not.toContain('<form');
    expect(clean).not.toContain('<input');
  });

  it('elimina meta/link tags', () => {
    const clean = sanitizeHtml('<meta http-equiv="refresh" content="0;url=evil"/>');
    expect(clean).not.toContain('<meta');
  });

  it('preserva clases y estilos seguros', () => {
    const clean = sanitizeHtml('<p class="x" style="color:red">x</p>');
    expect(clean).toContain('class="x"');
  });
});
