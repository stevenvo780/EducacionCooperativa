import { describe, expect, it } from 'vitest';
import { resolveViewerId, VIEWER_MATCHES } from '@/components/file-viewers/registry-match';

describe('resolveViewerId', () => {
  it.each([
    ['paper.pdf', undefined, 'pdf'],
    ['paper.docx', undefined, 'docx'],
    ['report.odt', undefined, 'odt'],
    ['data.ods', undefined, 'ods'],
    ['slides.odp', undefined, 'odp'],
    ['memo.rtf', undefined, 'rtf'],
    ['slides.pptx', undefined, 'pptx'],
    ['libro.epub', undefined, 'epub'],
    ['libro.fb2', undefined, 'fb2'],
    ['libro.mobi', undefined, 'kindle'],
    ['libro.azw3', undefined, 'kindle'],
    ['libro.djvu', undefined, 'djvu'],
    ['nota.ipynb', undefined, 'ipynb'],
    ['paper.tex', undefined, 'latex'],
    ['refs.bib', undefined, 'bibtex'],
    ['movie.srt', undefined, 'subtitle'],
    ['movie.vtt', undefined, 'subtitle'],
    ['comic.cbz', undefined, 'comic'],
    ['comic.cbr', undefined, 'comic'],
    ['score.musicxml', undefined, 'music-notation'],
    ['score.mxl', undefined, 'music-notation'],
    ['edition.tei', undefined, 'tei-xml'],
    ['data.xml', undefined, 'tei-xml'],
    ['scan.tiff', undefined, 'manuscript-image'],
    ['scan.tif', undefined, 'manuscript-image'],
    ['photo.jpg', 'image/jpeg', 'image'],
    ['photo.png', 'image/png', 'image'],
    ['movie.mp4', 'video/mp4', 'video'],
    ['song.mp3', 'audio/mpeg', 'audio'],
    ['song.flac', undefined, 'audio'],
    ['unknown.xyz', undefined, 'generic']
  ] as const)('resuelve %s (mime=%s) → %s', (docName, mimeType, expectedId) => {
    expect(resolveViewerId({ docName, mimeType })).toBe(expectedId);
  });

  it('XML genérico ahora rutea a tei-xml', () => {
    expect(resolveViewerId({ docName: 'tratado.xml' })).toBe('tei-xml');
  });

  it('MusicXML mime tiene precedencia sobre tei-xml', () => {
    expect(
      resolveViewerId({ docName: 'score.xml', mimeType: 'application/vnd.recordare.musicxml+xml' })
    ).toBe('music-notation');
  });

  it('PDF mime gana aunque la extensión no sea pdf', () => {
    expect(resolveViewerId({ docName: 'archivo', mimeType: 'application/pdf' })).toBe('pdf');
  });

  it('archivo sin nombre cae al genérico', () => {
    expect(resolveViewerId({ docName: '' })).toBe('generic');
  });

  it('respeta lowercase de extensión', () => {
    expect(resolveViewerId({ docName: 'PAPER.PDF' })).toBe('pdf');
    expect(resolveViewerId({ docName: 'Notas.IPYNB' })).toBe('ipynb');
  });

  it('todos los ids del registry son únicos', () => {
    const ids = VIEWER_MATCHES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('última entrada siempre matchea (fallback)', () => {
    const last = VIEWER_MATCHES[VIEWER_MATCHES.length - 1]!;
    expect(last.id).toBe('generic');
    expect(last.match({ docName: 'anything' })).toBe(true);
  });
});
