import { describe, expect, it } from 'vitest';
import { parseBibtex } from '@/lib/parsers/bibtex';

describe('parseBibtex', () => {
  it('parsea una entrada simple', () => {
    const text = `@article{smith2020,
  author = {John Smith},
  title = {A study},
  year = {2020}
}`;
    const entries = parseBibtex(text);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.type).toBe('article');
    expect(entries[0]!.key).toBe('smith2020');
    const fields = Object.fromEntries(entries[0]!.fields.map((f) => [f.name, f.value]));
    expect(fields.author).toBe('John Smith');
    expect(fields.title).toBe('A study');
    expect(fields.year).toBe('2020');
  });

  it('parsea múltiples entradas', () => {
    const text = `@book{a, title={X}, year={2020}\n}\n@article{b, title={Y}, year={2021}\n}`;
    const entries = parseBibtex(text);
    expect(entries.map((e) => e.key)).toEqual(['a', 'b']);
    expect(entries.map((e) => e.type)).toEqual(['book', 'article']);
  });

  it('soporta valores con comillas dobles', () => {
    const text = `@misc{q, title="hello world", year={2020}\n}`;
    const entries = parseBibtex(text);
    expect(entries[0]!.fields.find((f) => f.name === 'title')?.value).toBe('hello world');
  });

  it('normaliza whitespace múltiple', () => {
    const text = `@misc{q, title={hello\n   world\n   foo}, year={2020}\n}`;
    const entries = parseBibtex(text);
    expect(entries[0]!.fields.find((f) => f.name === 'title')?.value).toBe('hello world foo');
  });

  it('lowercase del tipo', () => {
    const text = `@ARTICLE{a, year={2020}\n}`;
    expect(parseBibtex(text)[0]!.type).toBe('article');
  });

  it('texto sin entradas devuelve array vacío', () => {
    expect(parseBibtex('')).toEqual([]);
    expect(parseBibtex('plain text without bibtex')).toEqual([]);
  });
});
