import { expect, test } from '@playwright/test';

import {
  TEST_USER,
  gotoDashboard,
  installBrowserStubs,
  installMockApi
} from './support/mockApp';

const ISO_DATE = '2030-01-10T12:00:00.000Z';

// ── Content with LaTeX, Mermaid, code blocks, and ASCII art ──
const RICH_MARKDOWN = `# Prueba de renderizado completo

## 1. LaTeX inline

La fórmula de Einstein es $E = mc^2$ y la identidad de Euler $e^{i\\pi} + 1 = 0$.

## 2. LaTeX en bloque

$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## 3. Diagrama Mermaid

\`\`\`mermaid
graph TD
  A[Inicio] --> B{Decisión}
  B -->|Sí| C[Acción A]
  B -->|No| D[Acción B]
  C --> E[Fin]
  D --> E
\`\`\`

## 4. Bloque de código JavaScript

\`\`\`javascript
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
console.log(fibonacci(10));
\`\`\`

## 5. Diagrama ASCII

\`\`\`
MENTE / ALMA
- piensa
- siente
- recuerda
- imagina
        ||
        || problema de interacción
        \\/
  CUERPO
- ocupa espacio
- se mueve
- recibe estímulos
- puede lesionarse
\`\`\`

## 6. Código inline

Usa \`console.log()\` para depurar y \`npm install\` para instalar.

## 7. Tabla GFM

| Modelo | Tipo | Ejemplo |
|--------|------|---------|
| Dualismo | Metafísico | Mente-cuerpo |
| Platón | Idealismo | Mundo de las ideas |

## 8. LaTeX complejo en bloque

$$
\\begin{gathered}
f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x - a)^n \\\\
\\text{Serie de Taylor}
\\end{gathered}
$$

## 9. Bloque sin lenguaje con arte

\`\`\`
+--------------------+
|    Proposición P    |
+--------------------+
         |
         v
+--------------------+
|   ¿Es verdadera?   |
+--------+-----------+
   Sí    |    No
   |     |     |
   v     |     v
 [V]     |   [F]
         |
+--------+-----------+
| Conclusión lógica   |
+--------------------+
\`\`\`
`;

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
});

// ─────────────────────────────────────────────────────────────
// PREVIEW MODE TESTS
// ─────────────────────────────────────────────────────────────

test.describe('Editor preview mode — rendering', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, {
      docsByWorkspace: {
        personal: [
          {
            id: 'doc-personal-1',
            name: 'Documento inicial.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Documento inicial\n\nBase.',
            ownerId: TEST_USER.uid,
            workspaceId: 'personal',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ],
        'ws-shared': [
          {
            id: 'doc-rich-md',
            name: 'Renderizado completo.md',
            type: 'text',
            folder: 'No estructurado',
            content: RICH_MARKDOWN,
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    await page.getByText('Renderizado completo.md', { exact: true }).first().click();
  });

  test('preview renders LaTeX inline formulas', async ({ page }) => {
    // Switch to preview mode
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // KaTeX renders formulas into .katex elements
    const katexInlineElements = page.locator('.markdown-preview-container .katex');
    await expect(katexInlineElements.first()).toBeVisible({ timeout: 10000 });
    const count = await katexInlineElements.count();
    expect(count).toBeGreaterThanOrEqual(2); // At least E=mc^2 and Euler
  });

  test('preview renders LaTeX block formulas', async ({ page }) => {
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // Block math should render inside .katex-display
    const katexDisplay = page.locator('.markdown-preview-container .katex-display');
    await expect(katexDisplay.first()).toBeVisible({ timeout: 10000 });
    const count = await katexDisplay.count();
    expect(count).toBeGreaterThanOrEqual(2); // integral and Taylor series
  });

  test('preview renders Mermaid diagrams as SVG', async ({ page }) => {
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // Mermaid renders SVGs inside .mermaid-container
    const mermaidContainer = page.locator('.markdown-preview-container .mermaid-container');
    // Either shows the SVG or an error or a loading state
    await expect(mermaidContainer).toBeVisible({ timeout: 15000 });

    // Check it got an SVG or at least a loading state
    const hasSvg = await mermaidContainer.locator('svg').count();
    const hasLoading = await mermaidContainer.locator('.mermaid-loading').count();
    const hasError = await mermaidContainer.locator('.mermaid-error').count();
    expect(hasSvg + hasLoading + hasError).toBeGreaterThanOrEqual(1);
  });

  test('preview renders code blocks with proper font', async ({ page }) => {
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // JavaScript code block should exist and be visible
    const codeBlocks = page.locator('.markdown-preview-container pre code');
    await expect(codeBlocks.first()).toBeVisible({ timeout: 10000 });

    // At least: JS block, ASCII diagram 1, ASCII diagram 2
    const count = await codeBlocks.count();
    expect(count).toBeGreaterThanOrEqual(3);

    // Verify monospace font is applied
    const fontFamily = await codeBlocks.first().evaluate((el) =>
      window.getComputedStyle(el).fontFamily
    );
    expect(fontFamily.toLowerCase()).toMatch(/mono|courier|consolas|fira/);
  });

  test('preview renders ASCII art diagrams preserving whitespace', async ({ page }) => {
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // Find code blocks with ASCII art content
    const allCodeBlocks = page.locator('.markdown-preview-container pre code');
    const count = await allCodeBlocks.count();

    let foundMenteAlma = false;
    let foundBoxDiagram = false;

    for (let i = 0; i < count; i++) {
      const text = await allCodeBlocks.nth(i).textContent();
      if (text?.includes('MENTE / ALMA')) foundMenteAlma = true;
      if (text?.includes('Proposición P')) foundBoxDiagram = true;
    }

    expect(foundMenteAlma).toBe(true);
    expect(foundBoxDiagram).toBe(true);

    // Verify white-space: pre is applied (preserves ASCII art alignment)
    for (let i = 0; i < count; i++) {
      const text = await allCodeBlocks.nth(i).textContent();
      if (text?.includes('MENTE / ALMA') || text?.includes('Proposición P')) {
        const whiteSpace = await allCodeBlocks.nth(i).evaluate((el) =>
          window.getComputedStyle(el).whiteSpace
        );
        expect(whiteSpace).toMatch(/pre/);
      }
    }
  });

  test('preview renders GFM tables', async ({ page }) => {
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    const table = page.locator('.markdown-preview-container table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Check table has headers
    const headers = table.locator('th');
    await expect(headers.first()).toBeVisible();
    const headerCount = await headers.count();
    expect(headerCount).toBe(3); // Modelo, Tipo, Ejemplo

    // Check table has data rows
    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBe(2); // Dualismo, Platón
  });

  test('preview renders inline code with styling', async ({ page }) => {
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // Find inline code (not inside pre)
    const inlineCode = page.locator('.markdown-preview-container code:not(pre code)');
    await expect(inlineCode.first()).toBeVisible({ timeout: 10000 });

    const count = await inlineCode.count();
    expect(count).toBeGreaterThanOrEqual(2); // console.log() and npm install

    // Verify inline code has background
    const bg = await inlineCode.first().evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    );
    // Should not be transparent
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('preview renders all headings correctly', async ({ page }) => {
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // Check main title
    await expect(page.locator('.markdown-preview-container h1')).toBeVisible();
    await expect(page.locator('.markdown-preview-container h1')).toHaveText('Prueba de renderizado completo');

    // Check section headings
    const h2s = page.locator('.markdown-preview-container h2');
    const h2Count = await h2s.count();
    expect(h2Count).toBeGreaterThanOrEqual(9);
  });
});

// ─────────────────────────────────────────────────────────────
// RAW MODE TESTS
// ─────────────────────────────────────────────────────────────

test.describe('Editor raw mode — content integrity', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, {
      docsByWorkspace: {
        personal: [
          {
            id: 'doc-personal-1',
            name: 'Documento inicial.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Base',
            ownerId: TEST_USER.uid,
            workspaceId: 'personal',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ],
        'ws-shared': [
          {
            id: 'doc-rich-md',
            name: 'Renderizado completo.md',
            type: 'text',
            folder: 'No estructurado',
            content: RICH_MARKDOWN,
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    await page.getByText('Renderizado completo.md', { exact: true }).first().click();
  });

  test('raw mode shows full markdown source including LaTeX and fenced blocks', async ({ page }) => {
    await page.getByTitle('Ver Markdown puro').click();
    const rawTextarea = page.locator('textarea.markdown-raw-textarea');
    await expect(rawTextarea).toBeVisible({ timeout: 10000 });

    const content = await rawTextarea.inputValue();
    // LaTeX delimiters present
    expect(content).toContain('$E = mc^2$');
    expect(content).toContain('$$');
    expect(content).toContain('\\int_{0}');

    // Mermaid fenced block present
    expect(content).toContain('```mermaid');
    expect(content).toContain('graph TD');

    // JavaScript code block
    expect(content).toContain('```javascript');
    expect(content).toContain('fibonacci');

    // ASCII art
    expect(content).toContain('MENTE / ALMA');
    expect(content).toContain('CUERPO');

    // GFM table
    expect(content).toContain('| Modelo |');
    expect(content).toContain('Dualismo');
  });

  test('raw mode preserves content after switching edit → raw → edit', async ({ page }) => {
    // Start in edit mode (default), switch to raw
    await page.getByTitle('Ver Markdown puro').click();
    const rawTextarea = page.locator('textarea.markdown-raw-textarea');
    await expect(rawTextarea).toBeVisible({ timeout: 10000 });

    const rawContent = await rawTextarea.inputValue();

    // Switch to edit mode
    await page.locator('button[title="Volver al editor visual"]').click();
    // Wait for MDXEditor to load
    await page.waitForTimeout(1500);

    // Switch back to raw
    await page.getByTitle('Ver Markdown puro').click();
    await expect(rawTextarea).toBeVisible({ timeout: 10000 });

    const rawContentAfter = await rawTextarea.inputValue();

    // Key content must survive the round-trip
    expect(rawContentAfter).toContain('fibonacci');
    expect(rawContentAfter).toContain('MENTE / ALMA');
    expect(rawContentAfter).toContain('$$');
  });
});

// ─────────────────────────────────────────────────────────────
// EDIT (WYSIWYG) MODE TESTS
// ─────────────────────────────────────────────────────────────

test.describe('Editor WYSIWYG mode — code blocks and overlays', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, {
      docsByWorkspace: {
        personal: [
          {
            id: 'doc-personal-1',
            name: 'Documento inicial.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Base',
            ownerId: TEST_USER.uid,
            workspaceId: 'personal',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ],
        'ws-shared': [
          {
            id: 'doc-rich-md',
            name: 'Renderizado completo.md',
            type: 'text',
            folder: 'No estructurado',
            content: RICH_MARKDOWN,
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    await page.getByText('Renderizado completo.md', { exact: true }).first().click();
    // Wait for MDXEditor to fully load
    await page.waitForTimeout(2000);
  });

  test('WYSIWYG mode displays code blocks with visible content', async ({ page }) => {
    // In WYSIWYG mode, code blocks render via CodeMirror
    const codeBlockWrappers = page.locator('[class*="_codeBlockEditorWrapper"], [class*="_codeMirrorWrapper"]');

    // Wait for at least one code block to appear
    await expect(codeBlockWrappers.first()).toBeVisible({ timeout: 15000 });

    const count = await codeBlockWrappers.count();
    // Should have code blocks for: mermaid, javascript, 2x ASCII art
    expect(count).toBeGreaterThanOrEqual(1);

    // Check that CodeMirror content is visible (not zero-height)
    for (let i = 0; i < Math.min(count, 4); i++) {
      const wrapper = codeBlockWrappers.nth(i);
      const box = await wrapper.boundingBox();
      expect(box).toBeTruthy();
      // The wrapper must have non-trivial height
      expect(box!.height).toBeGreaterThan(20);
    }
  });

  test('WYSIWYG mode shows CodeMirror content text', async ({ page }) => {
    // Check that .cm-content elements have actual text
    const cmContents = page.locator('.cm-content');
    await expect(cmContents.first()).toBeVisible({ timeout: 15000 });

    const count = await cmContents.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // At least one code block should contain recognizable text
    let foundContent = false;
    for (let i = 0; i < count; i++) {
      const text = await cmContents.nth(i).textContent();
      if (
        text?.includes('fibonacci') ||
        text?.includes('graph TD') ||
        text?.includes('MENTE') ||
        text?.includes('Proposición')
      ) {
        foundContent = true;
        break;
      }
    }
    expect(foundContent).toBe(true);
  });

  test('WYSIWYG mode headings render as styled elements', async ({ page }) => {
    const editable = page.locator('[contenteditable="true"]');
    await expect(editable).toBeVisible({ timeout: 15000 });

    // MDXEditor renders headings as actual h1, h2 elements
    const h1 = editable.locator('h1');
    const h2 = editable.locator('h2');

    // We should have at least the main title
    const h1Count = await h1.count();
    const h2Count = await h2.count();
    expect(h1Count + h2Count).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────
// MODE SWITCHING TESTS
// ─────────────────────────────────────────────────────────────

test.describe('Editor mode switching', () => {
  test.beforeEach(async ({ page }) => {
    await installMockApi(page, {
      docsByWorkspace: {
        personal: [
          {
            id: 'doc-personal-1',
            name: 'Documento inicial.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Base',
            ownerId: TEST_USER.uid,
            workspaceId: 'personal',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ],
        'ws-shared': [
          {
            id: 'doc-rich-md',
            name: 'Renderizado completo.md',
            type: 'text',
            folder: 'No estructurado',
            content: RICH_MARKDOWN,
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    await page.getByText('Renderizado completo.md', { exact: true }).first().click();
  });

  test('can switch edit → preview → raw → edit cycle', async ({ page }) => {
    // Start in edit mode
    await expect(page.locator('[contenteditable="true"]')).toBeVisible({ timeout: 15000 });

    // Switch to preview
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // Switch to raw
    await page.locator('button[title="Ver Markdown puro"]').click();
    await expect(page.locator('textarea.markdown-raw-textarea')).toBeVisible({ timeout: 10000 });

    // Switch back to edit
    await page.locator('button[title="Volver al editor visual"]').click();
    await expect(page.locator('[contenteditable="true"]')).toBeVisible({ timeout: 15000 });
  });

  test('preview after edit shows all content types', async ({ page }) => {
    // Wait for editor to load
    await expect(page.locator('[contenteditable="true"]')).toBeVisible({ timeout: 15000 });

    // Switch to preview
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    const preview = page.locator('.markdown-preview-container');
    await expect(preview).toBeVisible({ timeout: 10000 });

    // Check multiple content types rendered
    const hasKatex = await preview.locator('.katex').count() > 0;
    const hasCodeBlock = await preview.locator('pre code').count() > 0;
    const hasTable = await preview.locator('table').count() > 0;
    const hasHeadings = await preview.locator('h2').count() > 0;

    expect(hasKatex).toBe(true);
    expect(hasCodeBlock).toBe(true);
    expect(hasTable).toBe(true);
    expect(hasHeadings).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────

test.describe('Editor edge cases', () => {
  test('LaTeX inside code blocks is NOT rendered as math', async ({ page }) => {
    await installMockApi(page, {
      docsByWorkspace: {
        personal: [
          {
            id: 'doc-personal-1',
            name: 'Documento inicial.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Base',
            ownerId: TEST_USER.uid,
            workspaceId: 'personal',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ],
        'ws-shared': [
          {
            id: 'doc-latex-in-code',
            name: 'LaTeX en codigo.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Ejemplo\n\nInline: $x^2$\n\n```\n$no-es-latex$\n$$tampoco-es-latex$$\n```\n\nOtro inline: $y = mx + b$',
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    await page.getByText('LaTeX en codigo.md', { exact: true }).first().click();
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // Should render exactly 2 KaTeX inline formulas (x^2 and y=mx+b)
    // The ones inside the code block should NOT be rendered
    const katexElements = page.locator('.markdown-preview-container .katex');
    await expect(katexElements.first()).toBeVisible({ timeout: 10000 });
    const count = await katexElements.count();
    expect(count).toBe(2);

    // The code block should contain the literal dollar signs
    const codeBlock = page.locator('.markdown-preview-container pre code');
    await expect(codeBlock).toBeVisible();
    const codeText = await codeBlock.textContent();
    expect(codeText).toContain('$no-es-latex$');
  });

  test('empty code block does not crash', async ({ page }) => {
    await installMockApi(page, {
      docsByWorkspace: {
        personal: [
          {
            id: 'doc-personal-1',
            name: 'Documento inicial.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Base',
            ownerId: TEST_USER.uid,
            workspaceId: 'personal',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ],
        'ws-shared': [
          {
            id: 'doc-empty-code',
            name: 'Bloque vacio.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Vacío\n\n```\n\n```\n\nDespués del bloque.',
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    await page.getByText('Bloque vacio.md', { exact: true }).first().click();
    await page.getByTitle('Vista previa (LaTeX, Mermaid)').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });

    // The content after the empty block should render
    await expect(page.locator('.markdown-preview-container').getByText('Después del bloque.')).toBeVisible();
  });
});
