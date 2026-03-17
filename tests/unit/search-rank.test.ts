import { buildSemanticSearchResults } from '@/lib/search/rank';
import { SearchKind } from '@/lib/search/types';

const docs = [
  {
    id: 'doc-1',
    name: 'Archivo de memoria',
    folder: 'Curso/Unidad',
    mimeType: 'text/markdown',
    updatedAt: { toMillis: () => 1_700_000_000_000 },
    content: `---
authors:
  - Ana Testigo
works: ["Crónica del recuerdo", "Crónica del recuerdo"]
tags:
  - Memoria
  - Archivo
---
# Memoria
author: Berta Archivo
source: Crónica del recuerdo; Diario común

Texto principal sobre recuerdo y autor dentro del archivo.
Otra línea con #Memoria y #Archivo para reforzar conceptos.
`
  },
  {
    id: 'doc-2',
    name: 'Bitácora reciente',
    folder: 'Investigación',
    mimeType: 'text/plain',
    updatedAt: '2024-03-01T00:00:00.000Z',
    content: 'Apunte rápido con autor y recuerdo.'
  },
  {
    id: 'doc-3',
    name: 'Bitacora',
    folder: 'Raiz',
    mimeType: 'text/plain',
    updatedAt: { seconds: 1_700_500_000 },
    content: ''
  },
  {
    id: 'doc-4',
    name: 'Documento sin fecha',
    folder: 'Varios',
    mimeType: 'application/octet-stream',
    updatedAt: 'fecha-invalida',
    content: 'Nada relevante'
  }
];

describe('semantic search ranking', () => {
  it('returns recent documents for empty queries with pagination clamping', () => {
    const result = buildSemanticSearchResults({
      docs,
      query: '   ',
      limit: 0,
      offset: 1
    });

    expect(result.totalCandidates).toBe(4);
    expect(result.offset).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      kind: SearchKind.Document,
      title: 'Bitacora',
      subtitle: 'Raiz',
      preview: 'text/plain'
    });
  });

  it('handles fallback timestamps and partial token matches', () => {
    const results = buildSemanticSearchResults({
      docs: [
        {
          id: 'doc-partial',
          name: 'Colonialidad',
          folder: 'Archivo',
          updatedAt: {},
          content: 'Texto breve'
        }
      ],
      query: 'colonial'
    });

    expect(results.results[0]).toMatchObject({
      kind: SearchKind.Document,
      title: 'Colonialidad'
    });
  });

  it('builds document, concept, fragment, author and work results from a rich query', () => {
    const result = buildSemanticSearchResults({
      docs,
      query: 'ana cronica memoria autor'
    });

    const kinds = new Set(result.results.map((item) => item.kind));
    expect(kinds).toEqual(new Set([
      SearchKind.Document,
      SearchKind.Concept,
      SearchKind.Fragment,
      SearchKind.Author,
      SearchKind.Work
    ]));

    const documentResult = result.results.find((item) => item.kind === SearchKind.Document);
    expect(documentResult).toBeDefined();
    expect(documentResult?.sourceDoc.id).toBe('doc-1');
    expect(documentResult?.matchedTerms).toContain('autor');
    expect(documentResult?.matchedTerms).toContain('recuerdo');

    const conceptTitles = result.results
      .filter((item) => item.kind === SearchKind.Concept)
      .map((item) => item.title);
    expect(conceptTitles.filter((title) => title === 'Memoria')).toHaveLength(1);

    const fragment = result.results.find((item) => item.kind === SearchKind.Fragment);
    expect(fragment?.preview).toContain('Crónica del recuerdo');

    const author = result.results.find((item) => item.kind === SearchKind.Author);
    expect(author?.title).toContain('Ana Testigo');
    expect(author?.subtitle).toBe('Autor en Archivo de memoria');

    const work = result.results.find((item) => item.kind === SearchKind.Work);
    expect(work).toMatchObject({
      title: 'Crónica del recuerdo',
      subtitle: 'Obra en Archivo de memoria'
    });
  });

  it('supports kind filters and low-score queries', () => {
    const onlyAuthors = buildSemanticSearchResults({
      docs,
      query: 'ana',
      kinds: [SearchKind.Author]
    });
    expect(onlyAuthors.results.every((item) => item.kind === SearchKind.Author)).toBe(true);
    expect(onlyAuthors.results.map((item) => item.title)).toEqual(['- Ana Testigo', 'Ana Testigo']);

    const none = buildSemanticSearchResults({
      docs,
      query: 'zzzzzz'
    });
    expect(none.results).toEqual([]);
    expect(none.totalCandidates).toBe(0);
    expect(none.hasMore).toBe(false);
  });
});
