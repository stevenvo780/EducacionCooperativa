import { describe, it, expect } from 'vitest';
import { parseMarkdownOutline } from '@/lib/markdown-outline';

describe('parseMarkdownOutline', () => {
  it('devuelve [] para input vacío', () => {
    expect(parseMarkdownOutline('')).toEqual([]);
    expect(parseMarkdownOutline('texto sin headings')).toEqual([]);
  });

  it('extrae headings ATX de niveles 1-6', () => {
    const md = `# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(6);
    expect(out.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('línea 1-indexada', () => {
    const md = `Texto\n\n# Primer Heading`;
    const out = parseMarkdownOutline(md);
    expect(out[0].line).toBe(3);
  });

  it('ignora headings dentro de code fences (```)', () => {
    const md = `# Real\n\`\`\`\n# Falso\n## Tampoco\n\`\`\`\n## Real 2`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(2);
    expect(out[0].text).toBe('Real');
    expect(out[1].text).toBe('Real 2');
  });

  it('ignora headings dentro de fences ~~~', () => {
    const md = `# Real\n~~~\n# Falso\n~~~\n## Real 2`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(2);
  });

  it('elimina los # de cierre opcional ("## Title ##")', () => {
    const md = `## Title ##\n### Otro ###`;
    const out = parseMarkdownOutline(md);
    expect(out[0].text).toBe('Title');
    expect(out[1].text).toBe('Otro');
  });

  it('genera id estable basado en línea y slug', () => {
    const md = `# Hola Mundo\n## Otro Título`;
    const out = parseMarkdownOutline(md);
    expect(out[0].id).toMatch(/^1-hola-mundo$/);
    expect(out[1].id).toMatch(/^2-otro-titulo$/);
  });

  it('descarta headings con texto vacío', () => {
    const md = `# \n## \n### Real`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Real');
  });

  it('soporta caracteres unicode en el slug (los normaliza)', () => {
    const md = `# Filosofía Antigua`;
    const out = parseMarkdownOutline(md);
    expect(out[0].id).toContain('filosofia-antigua');
  });

  it('rechaza input no-string sin lanzar', () => {
    expect(parseMarkdownOutline(null as unknown as string)).toEqual([]);
    expect(parseMarkdownOutline(undefined as unknown as string)).toEqual([]);
  });
});
