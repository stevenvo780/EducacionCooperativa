import { describe, expect, it } from 'vitest';
import { rtfToHtml } from '@/lib/parsers/rtf';

describe('rtfToHtml', () => {
  it('texto plano simple', () => {
    const html = rtfToHtml('{\\rtf1 hola mundo}');
    expect(html).toContain('hola mundo');
    expect(html).toContain('<p>');
  });

  it('negrita con \\b ... \\b0', () => {
    const html = rtfToHtml('{\\rtf1 \\b texto en negrita\\b0}');
    expect(html).toContain('<strong>texto en negrita</strong>');
  });

  it('itálica con \\i ... \\i0', () => {
    const html = rtfToHtml('{\\rtf1 \\i italic text\\i0}');
    expect(html).toContain('<em>italic text</em>');
  });

  it('párrafo con \\par', () => {
    const html = rtfToHtml('{\\rtf1 primero\\par segundo}');
    expect(html).toMatch(/<p>primero<\/p>.*<p>segundo<\/p>/s);
  });

  it('decodifica hex escape (acentos)', () => {
    // \'e1 = á (latin1)
    const html = rtfToHtml("{\\rtf1 caf\\'e9}");
    expect(html).toContain('café');
  });

  it('decodifica unicode escape \\u', () => {
    const html = rtfToHtml('{\\rtf1 \\u8364?euro}');
    expect(html).toContain('€');
  });

  it('escapa HTML del contenido', () => {
    const html = rtfToHtml('{\\rtf1 <script>alert(1)</script>}');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('tab \\tab → 4 espacios', () => {
    const html = rtfToHtml('{\\rtf1 col1\\tab col2}');
    expect(html).toContain('col1    col2');
  });

  it('ignora bloques de destino (\\*)', () => {
    const html = rtfToHtml('{\\rtf1 antes{\\*\\info{\\title secret}} despues}');
    expect(html).toContain('antes');
    expect(html).toContain('despues');
    expect(html).not.toContain('secret');
  });

  it('subraya con \\ul ... \\ulnone', () => {
    const html = rtfToHtml('{\\rtf1 \\ul subrayado\\ulnone}');
    expect(html).toContain('<u>subrayado</u>');
  });

  it('manejo correcto de grupos anidados', () => {
    const html = rtfToHtml('{\\rtf1 normal {\\b grueso} normal2}');
    expect(html).toContain('normal');
    expect(html).toContain('<strong>grueso</strong>');
    expect(html).toContain('normal2');
  });

  it('texto vacío produce salida vacía', () => {
    expect(rtfToHtml('')).toBe('');
  });
});
