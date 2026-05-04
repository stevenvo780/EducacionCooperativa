import { describe, expect, it } from 'vitest';
import { detectTei, formatXmlSource, renderGenericXml, renderTei } from '@/lib/parsers/tei';

const TEI_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0">
  <teiHeader>
    <fileDesc>
      <titleStmt><title>Edición crítica</title><author>Anónimo</author></titleStmt>
      <publicationStmt><date>2024</date></publicationStmt>
    </fileDesc>
  </teiHeader>
  <text>
    <body>
      <div>
        <head>Sección 1</head>
        <p>Texto con <hi rend="italic">cursiva</hi> y <hi rend="bold">negrita</hi>.</p>
        <lg><l>Verso uno</l><l>Verso dos</l></lg>
        <p>Mención de <persName>Cervantes</persName> en <placeName>Madrid</placeName>.</p>
        <p>Una <note>nota crítica</note> al margen.</p>
        <quote>Cita textual</quote>
      </div>
    </body>
  </text>
</TEI>`;

describe('detectTei', () => {
  it('detecta TEI por tag raíz', () => {
    expect(detectTei(TEI_SAMPLE)).toBe(true);
  });
  it('detecta por teiHeader', () => {
    expect(detectTei('<root><teiHeader/></root>')).toBe(true);
  });
  it('XML genérico no es TEI', () => {
    expect(detectTei('<root><foo/></root>')).toBe(false);
  });
});

describe('renderTei', () => {
  const doc = new DOMParser().parseFromString(TEI_SAMPLE, 'application/xml');
  const html = renderTei(doc);

  it('incluye metadatos', () => {
    expect(html).toContain('Edición crítica');
    expect(html).toContain('Anónimo');
    expect(html).toContain('2024');
  });

  it('renderiza heads como h2', () => {
    expect(html).toContain('<h2>Sección 1</h2>');
  });

  it('renderiza hi rend="italic" como em', () => {
    expect(html).toContain('<em>cursiva</em>');
  });

  it('renderiza hi rend="bold" como strong', () => {
    expect(html).toContain('<strong>negrita</strong>');
  });

  it('renderiza lg como contenedor + l como spans', () => {
    expect(html).toContain('class="tei-lg"');
    expect(html).toContain('class="tei-l"');
  });

  it('persName y placeName como strong', () => {
    expect(html).toContain('<strong>Cervantes</strong>');
    expect(html).toContain('<strong>Madrid</strong>');
  });

  it('notas envueltas en span tei-note', () => {
    expect(html).toContain('class="tei-note"');
    expect(html).toContain('nota crítica');
  });

  it('quote como blockquote', () => {
    expect(html).toContain('<blockquote>Cita textual</blockquote>');
  });
});

describe('renderGenericXml', () => {
  it('genera estructura indentada', () => {
    const doc = new DOMParser().parseFromString('<root><a>texto</a></root>', 'application/xml');
    const html = renderGenericXml(doc.documentElement);
    expect(html).toContain('&lt;root&gt;');
    expect(html).toContain('&lt;a&gt;');
    expect(html).toContain('texto');
  });

  it('limita profundidad para evitar stack overflow', () => {
    let xml = '<a>';
    for (let i = 0; i < 50; i++) xml = `<a>${xml}</a>`;
    xml = `<root>${xml}</a></root>`;
    // Should not throw with deep nesting (depth cap = 10)
    const doc = new DOMParser().parseFromString(xml.replace('</a></root>', '</root>'), 'application/xml');
    expect(() => renderGenericXml(doc.documentElement)).not.toThrow();
  });
});

describe('formatXmlSource', () => {
  it('separa tags en líneas', () => {
    const lines = formatXmlSource('<a><b/></a>');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('aplica syntax highlight a tags', () => {
    const lines = formatXmlSource('<root>x</root>');
    const joined = lines.join('\n');
    expect(joined).toContain('color:#60a5fa'); // tags
  });

  it('aplica syntax highlight a atributos', () => {
    const lines = formatXmlSource('<root id="abc">x</root>');
    const joined = lines.join('\n');
    expect(joined).toContain('color:#fcd34d'); // attribute name
  });
});
