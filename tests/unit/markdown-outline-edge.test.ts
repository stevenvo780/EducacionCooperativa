import { describe, it, expect } from 'vitest';
import { parseMarkdownOutline } from '@/lib/markdown-outline';

describe('parseMarkdownOutline edge cases', () => {
  it('soporta documentos muy largos sin colgarse (10k líneas)', () => {
    const lines = Array.from({ length: 10000 }, (_, i) =>
      i % 100 === 0 ? `## Sección ${i / 100}` : `Texto línea ${i}`
    );
    const out = parseMarkdownOutline(lines.join('\n'));
    expect(out).toHaveLength(100);
  });

  it('fence sin cerrar: ignora todo el resto', () => {
    const md = `# Real\n\`\`\`\n# Falso\n## Tampoco`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('Real');
  });

  it('múltiples fences del mismo tipo', () => {
    const md = `# A\n\`\`\`\nfake1\n\`\`\`\n## B\n\`\`\`\nfake2\n\`\`\`\n### C`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(3);
    expect(out.map((h) => h.text)).toEqual(['A', 'B', 'C']);
  });

  it('mezcla de fences ``` y ~~~', () => {
    const md = `# A\n\`\`\`\n# en-fence-back\n\`\`\`\n## B\n~~~\n# en-fence-tilde\n~~~\n### C`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(3);
  });

  it('headings con caracteres especiales en el texto', () => {
    const md = `# **Bold** y *Italic*\n## \`Código\`\n### [Link](url)`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(3);
    expect(out[0].text).toContain('Bold');
  });

  it('# con espacio extra adelante NO es heading', () => {
    const md = ` # Esto no es heading`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(0);
  });

  it('heading en última línea sin newline final', () => {
    const md = `texto\n## Último`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(1);
    expect(out[0].line).toBe(2);
  });

  it('niveles 7+ son ignorados (no son headings válidos)', () => {
    const md = `####### no es heading`;
    const out = parseMarkdownOutline(md);
    expect(out).toHaveLength(0);
  });
});
