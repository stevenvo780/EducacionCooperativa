import { describe, expect, it } from 'vitest';
import { parseFb2 } from '@/lib/parsers/fb2';

const SAMPLE_FB2 = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:l="http://www.w3.org/1999/xlink">
  <description>
    <title-info>
      <author><first-name>Jorge</first-name><last-name>Borges</last-name></author>
      <book-title>Ficciones</book-title>
      <annotation><p>Una colección.</p></annotation>
    </title-info>
  </description>
  <body>
    <section>
      <title><p>Capítulo 1</p></title>
      <p>Texto con <emphasis>énfasis</emphasis> y <strong>fuerza</strong>.</p>
      <p>Link: <a l:href="https://example.com">aquí</a></p>
      <p>Bad: <a l:href="javascript:alert(1)">malo</a></p>
    </section>
  </body>
</FictionBook>`;

describe('parseFb2', () => {
  it('extrae título y autor', () => {
    const r = parseFb2(SAMPLE_FB2);
    expect(r.meta.title).toBe('Ficciones');
    expect(r.meta.author).toBe('Jorge Borges');
  });

  it('renderiza annotation', () => {
    const r = parseFb2(SAMPLE_FB2);
    expect(r.meta.annotationHtml).toContain('Una colección.');
  });

  it('renderiza sections + emphasis + strong', () => {
    const r = parseFb2(SAMPLE_FB2);
    expect(r.html).toContain('<section');
    expect(r.html).toContain('<em>énfasis</em>');
    expect(r.html).toContain('<strong>fuerza</strong>');
  });

  it('respeta links http(s)', () => {
    const r = parseFb2(SAMPLE_FB2);
    expect(r.html).toContain('href="https://example.com"');
    expect(r.html).toContain('rel="noreferrer"');
  });

  it('bloquea javascript: en links', () => {
    const r = parseFb2(SAMPLE_FB2);
    expect(r.html).not.toContain('javascript:');
    expect(r.html).toMatch(/href="#"/);
  });

  it('XML inválido lanza error', () => {
    expect(() => parseFb2('<broken>')).toThrow(/FB2 inválido/);
  });

  it('FB2 sin metadatos no rompe', () => {
    const minimal = `<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><body><p>solo</p></body></FictionBook>`;
    const r = parseFb2(minimal);
    expect(r.meta.title).toBeUndefined();
    expect(r.meta.author).toBeUndefined();
    expect(r.html).toContain('solo');
  });
});
