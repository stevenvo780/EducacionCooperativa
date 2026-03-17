import nodeCrypto from 'crypto';

import { hashPassword, verifyPassword } from '@/lib/crypto';
import { bufferToMarkdown, canConvertToMarkdown } from '@/lib/markdownConversion';

const pdfParseMock = vi.fn();
const mammothConvertMock = vi.fn();
const turndownMock = vi.fn();

vi.mock('pdf-parse', () => ({
  default: pdfParseMock
}));

vi.mock('mammoth', () => ({
  convertToHtml: mammothConvertMock
}));

vi.mock('turndown', () => ({
  default: class FakeTurndownService {
    turndown(input: string) {
      return turndownMock(input);
    }
  }
}));

describe('crypto helpers', () => {
  it('hashes passwords with scrypt format and verifies them', async () => {
    const hash = await hashPassword('super-secreto');

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    await expect(verifyPassword('super-secreto', hash)).resolves.toEqual({
      ok: true,
      needsUpgrade: false
    });
    await expect(verifyPassword('otro', hash)).resolves.toEqual({
      ok: false,
      needsUpgrade: false
    });
  });

  it('handles missing, malformed and legacy hashes', async () => {
    await expect(verifyPassword('x', undefined)).resolves.toEqual({
      ok: false,
      needsUpgrade: false
    });
    await expect(verifyPassword('x', 'scrypt$bad$hash')).resolves.toEqual({
      ok: false,
      needsUpgrade: false
    });

    const legacyHash = nodeCrypto.createHash('sha256').update('legacy').digest('hex');
    const result = await verifyPassword('legacy', legacyHash);

    expect(result.ok).toBe(true);
    expect(result.needsUpgrade).toBe(true);
    expect(result.newHash).toMatch(/^scrypt\$/);

    await expect(verifyPassword('incorrecta', legacyHash)).resolves.toEqual({
      ok: false,
      needsUpgrade: false
    });
  });

  it('propagates scrypt failures', async () => {
    vi.spyOn(nodeCrypto, 'scrypt').mockImplementation(((
      _password: string,
      _salt: Buffer,
      _keylen: number,
      _options: nodeCrypto.ScryptOptions,
      callback: (error: Error | null, derivedKey: Buffer) => void
    ) => {
      callback(new Error('scrypt exploded'), Buffer.alloc(0));
    }) as never);

    await expect(hashPassword('falla')).rejects.toThrow('scrypt exploded');
  });
});

describe('markdown conversion helpers', () => {
  beforeEach(() => {
    pdfParseMock.mockReset();
    mammothConvertMock.mockReset();
    turndownMock.mockReset();
  });

  it('detects convertible mime types and extensions', () => {
    expect(canConvertToMarkdown('application/pdf', 'archivo.bin')).toBe(true);
    expect(canConvertToMarkdown(undefined, 'archivo.docx')).toBe(true);
    expect(canConvertToMarkdown('text/plain', 'archivo.bin')).toBe(true);
    expect(canConvertToMarkdown('application/octet-stream', 'archivo.csv')).toBe(true);
    expect(canConvertToMarkdown('application/octet-stream', 'archivo.bin')).toBe(false);
  });

  it('converts pdf buffers to normalized markdown', async () => {
    pdfParseMock.mockResolvedValue({
      text: 'Linea 1\r\n\r\n\r\nLinea 2'
    });

    await expect(bufferToMarkdown(Buffer.from('pdf'), {
      mimeType: 'application/pdf',
      fileName: 'Informe.PDF'
    })).resolves.toEqual({
      markdown: 'Linea 1\n\nLinea 2',
      suggestedName: 'Informe.md',
      sourceFormat: 'pdf'
    });
  });

  it('uses pdf fallback text when extraction is empty', async () => {
    pdfParseMock.mockResolvedValue({ text: '' });

    await expect(bufferToMarkdown(Buffer.from('pdf'), {
      mimeType: 'application/pdf'
    })).resolves.toEqual({
      markdown: '# Documento PDF\nNo se pudo extraer texto legible.',
      suggestedName: 'documento.md',
      sourceFormat: 'pdf'
    });
  });

  it('converts docx buffers through mammoth and turndown', async () => {
    mammothConvertMock.mockResolvedValue({ value: '<h1>Titulo</h1><p>Texto</p>' });
    turndownMock.mockReturnValue('Titulo\n\nTexto');

    await expect(bufferToMarkdown(Buffer.from('docx'), {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: 'Clase.docx'
    })).resolves.toEqual({
      markdown: 'Titulo\n\nTexto',
      suggestedName: 'Clase.md',
      sourceFormat: 'docx'
    });
  });

  it('uses docx fallback text when turndown yields empty markdown', async () => {
    mammothConvertMock.mockResolvedValue({ value: '<p></p>' });
    turndownMock.mockReturnValue('');

    await expect(bufferToMarkdown(Buffer.from('docx'), {
      fileName: 'Clase.docx'
    })).resolves.toEqual({
      markdown: '# Documento DOCX\nNo se pudo extraer contenido.',
      suggestedName: 'Clase.md',
      sourceFormat: 'docx'
    });
  });

  it('converts text buffers and rejects unsupported files', async () => {
    await expect(bufferToMarkdown(Buffer.from('hola\r\n\r\n\r\nmundo'), {
      mimeType: 'text/markdown'
    })).resolves.toEqual({
      markdown: 'hola\n\nmundo',
      suggestedName: 'documento.md',
      sourceFormat: 'text'
    });

    await expect(bufferToMarkdown(Buffer.from('hola'), {
      mimeType: 'text/plain',
      fileName: 'registro.log'
    })).resolves.toEqual({
      markdown: 'hola',
      suggestedName: 'registro.md',
      sourceFormat: 'text'
    });

    await expect(bufferToMarkdown(Buffer.from('binario'), {
      mimeType: 'application/octet-stream',
      fileName: 'archivo.exe'
    })).rejects.toThrow('Tipo de archivo no soportado para conversión a Markdown');
  });
});
