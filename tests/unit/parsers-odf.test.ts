import { describe, expect, it } from 'vitest';
import { renderOdfContent } from '@/lib/parsers/odf';

const ODT_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
  xmlns:xlink="http://www.w3.org/1999/xlink">
  <office:body>
    <office:text>
      <text:h text:outline-level="1">Título del documento</text:h>
      <text:p>Este es un párrafo simple.</text:p>
      <text:h text:outline-level="2">Subtítulo</text:h>
      <text:p text:style-name="Quote_20_Body">Una cita</text:p>
      <text:p>Link: <text:a xlink:href="https://example.com">aquí</text:a></text:p>
      <text:p>Bad: <text:a xlink:href="javascript:alert(1)">malo</text:a></text:p>
      <text:list>
        <text:list-item><text:p>uno</text:p></text:list-item>
        <text:list-item><text:p>dos</text:p></text:list-item>
      </text:list>
      <draw:frame><draw:image/></draw:frame>
    </office:text>
  </office:body>
</office:document-content>`;

describe('renderOdfContent ODT', () => {
  const r = renderOdfContent(ODT_SAMPLE, 'odt');

  it('h1 desde outline-level=1', () => expect(r.html).toContain('<h1>Título del documento</h1>'));
  it('h2 desde outline-level=2', () => expect(r.html).toContain('<h2>Subtítulo</h2>'));
  it('párrafos básicos', () => expect(r.html).toContain('<p>Este es un párrafo simple.</p>'));
  it('blockquote por style-name Quote', () => expect(r.html).toContain('<blockquote>Una cita</blockquote>'));
  it('lista', () => expect(r.html).toMatch(/<ul><li>.*uno.*<\/li>.*<li>.*dos.*<\/li><\/ul>/));
  it('imagen → placeholder + warning', () => {
    expect(r.html).toContain('odt-image-placeholder');
    expect(r.warnings).toContain('Imagen embebida no extraída');
  });
  it('href https permitido', () => expect(r.html).toContain('href="https://example.com"'));
  it('href javascript: bloqueado', () => {
    expect(r.html).not.toContain('javascript:');
    expect(r.html).toMatch(/href="#"/);
  });
});

const ODS_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0">
  <office:body>
    <office:spreadsheet>
      <table:table table:name="Hoja1">
        <table:table-row>
          <table:table-cell><text:p>A1</text:p></table:table-cell>
          <table:table-cell><text:p>B1</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell><text:p>A2</text:p></table:table-cell>
          <table:table-cell><text:p>B2</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document-content>`;

describe('renderOdfContent ODS', () => {
  const r = renderOdfContent(ODS_SAMPLE, 'ods');
  it('renderiza nombre de hoja', () => expect(r.html).toContain('<h2>Hoja1</h2>'));
  it('renderiza tabla', () => expect(r.html).toContain('<table>'));
  it('contiene celdas', () => {
    expect(r.html).toContain('A1');
    expect(r.html).toContain('B2');
  });
});

const ODP_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0">
  <office:body>
    <office:presentation>
      <draw:page draw:name="Diapositiva 1">
        <draw:frame><draw:text-box><text:p>Título de la diapositiva</text:p></draw:text-box></draw:frame>
      </draw:page>
    </office:presentation>
  </office:body>
</office:document-content>`;

describe('renderOdfContent ODP', () => {
  const r = renderOdfContent(ODP_SAMPLE, 'odp');
  it('renderiza el título de la diapositiva', () => expect(r.html).toContain('Diapositiva 1'));
  it('renderiza contenido del frame', () => expect(r.html).toContain('Título de la diapositiva'));
});

describe('renderOdfContent fallos', () => {
  it('XML inválido → mensaje + warning', () => {
    const r = renderOdfContent('<broken', 'odt');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('sin body → warning', () => {
    const r = renderOdfContent('<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"></office:document-content>', 'odt');
    expect(r.warnings).toContain('No body en content.xml');
  });
});
