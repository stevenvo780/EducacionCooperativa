import { describe, expect, it } from 'vitest';
import {
  getFileExtension,
  isBibtexDocument,
  isComicArchiveDocument,
  isDjvuDocument,
  isEpubDocument,
  isFb2Document,
  isHiResImageDocument,
  isKindleEbookDocument,
  isLatexDocument,
  isMarkdownDocument,
  isMusicNotationDocument,
  isNotebookDocument,
  isOdpDocument,
  isOdsDocument,
  isOdtDocument,
  isOpenDocumentFormat,
  isPdfMime,
  isPlainTextDocument,
  isPowerPointDocument,
  isRisDocument,
  isRtfDocument,
  isSpreadsheetDocument,
  isSubtitleDocument,
  isTeiOrXmlDocument,
  isWordDocument
} from '@/lib/document-format';

describe('getFileExtension', () => {
  it('extrae extensión simple', () => expect(getFileExtension('foo.md')).toBe('md'));
  it('toma la última si hay varias', () => expect(getFileExtension('archive.tar.gz')).toBe('gz'));
  it('lowercase', () => expect(getFileExtension('Doc.PDF')).toBe('pdf'));
  it('vacío si no tiene punto', () => expect(getFileExtension('README')).toBe(''));
  it('hace trim', () => expect(getFileExtension('  foo.txt  ')).toBe('txt'));
  it('undefined → vacío', () => expect(getFileExtension(undefined)).toBe(''));
  it('dotfile sin extension', () => expect(getFileExtension('.gitignore')).toBe('gitignore'));
});

describe('detección por extensión', () => {
  it.each([
    ['paper.docx', isWordDocument, true],
    ['paper.doc', isWordDocument, true],
    ['paper.pdf', isWordDocument, false],
    ['libro.epub', isEpubDocument, true],
    ['libro.mobi', isKindleEbookDocument, true],
    ['libro.azw3', isKindleEbookDocument, true],
    ['libro.djvu', isDjvuDocument, true],
    ['libro.djv', isDjvuDocument, true],
    ['libro.fb2', isFb2Document, true],
    ['nota.ipynb', isNotebookDocument, true],
    ['paper.tex', isLatexDocument, true],
    ['package.sty', isLatexDocument, true],
    ['refs.bib', isBibtexDocument, true],
    ['refs.bibtex', isBibtexDocument, true],
    ['refs.ris', isRisDocument, true],
    ['comic.cbz', isComicArchiveDocument, true],
    ['comic.cbr', isComicArchiveDocument, true],
    ['comic.zip', isComicArchiveDocument, false],
    ['movie.srt', isSubtitleDocument, true],
    ['movie.vtt', isSubtitleDocument, true],
    ['movie.sbv', isSubtitleDocument, true],
    ['score.musicxml', isMusicNotationDocument, true],
    ['score.mxl', isMusicNotationDocument, true],
    ['score.mscz', isMusicNotationDocument, true],
    ['doc.tei', isTeiOrXmlDocument, true],
    ['doc.xml', isTeiOrXmlDocument, true],
    ['doc.html', isTeiOrXmlDocument, false],
    ['scan.tif', isHiResImageDocument, true],
    ['scan.tiff', isHiResImageDocument, true],
    ['scan.jpg', isHiResImageDocument, false],
    ['report.odt', isOdtDocument, true],
    ['data.ods', isOdsDocument, true],
    ['slides.odp', isOdpDocument, true],
    ['memo.rtf', isRtfDocument, true],
    ['notes.md', isMarkdownDocument, true],
    ['data.csv', isSpreadsheetDocument, true],
    ['data.xlsx', isSpreadsheetDocument, true],
    ['slides.pptx', isPowerPointDocument, true]
  ] as const)('%s → %s = %s', (name, fn, expected) => {
    expect(fn(name)).toBe(expected);
  });
});

describe('detección por mime', () => {
  it('PDF', () => {
    expect(isPdfMime('application/pdf')).toBe(true);
    expect(isPdfMime('APPLICATION/PDF')).toBe(true);
    expect(isPdfMime('text/plain')).toBe(false);
  });

  it('EPUB con mime', () => {
    expect(isEpubDocument(undefined, 'application/epub+zip')).toBe(true);
  });

  it('OpenDocument variantes', () => {
    expect(isOdtDocument(undefined, 'application/vnd.oasis.opendocument.text')).toBe(true);
    expect(isOdsDocument(undefined, 'application/vnd.oasis.opendocument.spreadsheet')).toBe(true);
    expect(isOdpDocument(undefined, 'application/vnd.oasis.opendocument.presentation')).toBe(true);
    expect(isOpenDocumentFormat('foo.odt')).toBe(true);
    expect(isOpenDocumentFormat('foo.pdf')).toBe(false);
  });

  it('RTF mime variantes', () => {
    expect(isRtfDocument(undefined, 'application/rtf')).toBe(true);
    expect(isRtfDocument(undefined, 'text/rtf')).toBe(true);
  });

  it('Word mime variantes', () => {
    expect(isWordDocument(undefined, 'application/msword')).toBe(true);
    expect(isWordDocument(undefined, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
  });
});

describe('isPlainTextDocument', () => {
  it('text/* mime', () => expect(isPlainTextDocument(undefined, 'text/csv')).toBe(true));
  it('json mime', () => expect(isPlainTextDocument(undefined, 'application/json')).toBe(true));
  it('yaml mime', () => expect(isPlainTextDocument(undefined, 'application/yaml')).toBe(true));
  it('dotfile sin extra ext', () => expect(isPlainTextDocument('.env')).toBe(true));
  it('binary mime → false', () => expect(isPlainTextDocument('foo.png', 'image/png')).toBe(false));
});
