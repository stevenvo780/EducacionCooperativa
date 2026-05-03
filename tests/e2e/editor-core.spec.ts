import { expect, type Locator, type Page, type Request, test } from '@playwright/test';

import {
  TEST_USER,
  gotoDashboard,
  installBrowserStubs,
  installInsecureAuth,
  installMockApi
} from './support/mockApp';

const ISO_DATE = '2030-01-10T12:00:00.000Z';

const personalDocs = () => ([
  {
    id: 'doc-personal-1',
    name: 'Documento inicial.md',
    type: 'text' as const,
    folder: 'No estructurado',
    content: '# Documento inicial\n\nContenido base del espacio personal.',
    ownerId: TEST_USER.uid,
    workspaceId: 'personal',
    mimeType: 'text/markdown',
    updatedAt: ISO_DATE
  }
]);

const openMarkdownDocumentInRawMode = async (page: Page, name: string) => {
  await page.getByText(name, { exact: true }).first().click();
  await expect(page.getByTitle('Ver Markdown puro').first()).toBeVisible({ timeout: 10000 });
  await page.getByTitle('Ver Markdown puro').first().click();
  const rawTextarea = page.locator('textarea.markdown-raw-textarea');
  await expect(rawTextarea).toBeVisible({ timeout: 10000 });
  return rawTextarea;
};

const openSemanticMenu = async (page: Page, rawTextarea: Locator, text: string) => {
  await rawTextarea.fill(text);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await rawTextarea.click();
    await page.keyboard.press('Control+A');
    await rawTextarea.click({ button: 'right' });

    try {
      await expect(page.getByText('Menú semántico', { exact: true })).toBeVisible({ timeout: 3000 });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await page.waitForTimeout(250);
    }
  }
};

const requestJson = (request: Request) => {
  const raw = request.postData();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
  await installInsecureAuth(page);
});

test.describe('Mosaic editor core workflows', () => {
  test('loads raw content from /raw without saving an empty overwrite first', async ({ page }) => {
    const rawContent = '# Raw tardío\n\nContenido cargado desde el plano de datos.';
    const emptyOverwriteRequests: string[] = [];

    page.on('request', (request) => {
      const url = new URL(request.url());
      if (request.method() !== 'PUT' || url.pathname !== '/api/documents/doc-raw-late') return;
      const body = requestJson(request);
      if (body?.content === '') {
        emptyOverwriteRequests.push(request.url());
      }
    });

    const state = await installMockApi(page, {
      docsByWorkspace: {
        personal: personalDocs(),
        'ws-shared': [
          {
            id: 'doc-raw-late',
            name: 'Raw tardío.md',
            type: 'text',
            folder: 'No estructurado',
            rawContent,
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            storagePath: 'documents/ws-shared/doc-raw-late.md',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    const rawTextarea = await openMarkdownDocumentInRawMode(page, 'Raw tardío.md');

    await expect.poll(async () => rawTextarea.inputValue()).toBe(rawContent);
    await page.waitForTimeout(2800);
    expect(emptyOverwriteRequests).toEqual([]);

    await rawTextarea.fill(`${rawContent}\n\nLínea guardada por el usuario.`);
    await expect.poll(() => state.docsByWorkspace['ws-shared']?.[0]?.content ?? '').toContain('Línea guardada');
  });

  test('preserves markdown through edit, raw and preview mode changes', async ({ page }) => {
    await installMockApi(page, {
      docsByWorkspace: {
        personal: personalDocs(),
        'ws-shared': [
          {
            id: 'doc-cycle',
            name: 'Ciclo editor.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Ciclo inicial\n\nTexto base.',
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    const rawTextarea = await openMarkdownDocumentInRawMode(page, 'Ciclo editor.md');
    const editedMarkdown = '# Ciclo edit raw preview\n\n- [ ] Mantener texto exacto';

    await rawTextarea.fill(editedMarkdown);
    await page.getByTitle('Abrir vista previa renderizada').click();
    await expect(page.locator('.markdown-preview-container')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.markdown-preview-container')).toContainText('Ciclo edit raw preview');

    await page.getByTitle('Volver al editor visual').click();
    await expect(page.locator('.mdx-editor-root, .cm-editor').first()).toBeVisible({ timeout: 10000 });
    await page.getByTitle('Ver Markdown puro').first().click();
    const cycledRawTextarea = page.locator('textarea.markdown-raw-textarea');
    await expect.poll(async () => cycledRawTextarea.inputValue()).toContain('Ciclo edit raw preview');
    await expect.poll(async () => cycledRawTextarea.inputValue()).toContain('[ ] Mantener texto exacto');
  });

  test('opens dotfiles as plain text instead of the binary file viewer', async ({ page }) => {
    await installMockApi(page, {
      docsByWorkspace: {
        personal: personalDocs(),
        'ws-shared': [
          {
            id: 'doc-syncignore',
            name: '.syncignore',
            type: 'file',
            folder: 'No estructurado',
            content: 'node_modules\n.env\n',
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'application/octet-stream',
            url: 'https://files.test/.syncignore',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    await page.getByText('.syncignore', { exact: true }).first().click();

    await expect(page.locator('.cm-content').filter({ hasText: 'node_modules' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Descargar' })).toHaveCount(0);
  });

  test('scans markdown task checkboxes into the workspace board', async ({ page }) => {
    const state = await installMockApi(page, {
      docsByWorkspace: {
        personal: personalDocs(),
        'ws-shared': [
          {
            id: 'doc-pendings',
            name: 'Pendientes.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Pendientes\n\n- [ ] Revisar acta cooperativa\n- [ ] Preparar consenso',
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    await page.getByText('Pendientes.md', { exact: true }).first().click();
    await expect(page.getByTitle('Detectar pendientes en texto')).toBeVisible({ timeout: 10000 });
    await page.getByTitle('Detectar pendientes en texto').click();

    await expect.poll(() => state.boardsByWorkspace['ws-shared']?.cards.length ?? 0).toBe(2);
    const cards = state.boardsByWorkspace['ws-shared']?.cards ?? [];
    expect(cards.map((card) => card.title)).toEqual([
      'Revisar acta cooperativa',
      'Preparar consenso'
    ]);
    expect(cards.every((card) => card.sourceDocId === 'doc-pendings')).toBe(true);
  });

  test('persists a semantic definition through /api/semantic', async ({ page }) => {
    const state = await installMockApi(page, {
      docsByWorkspace: {
        personal: personalDocs(),
        'ws-shared': [
          {
            id: 'doc-semantic-core',
            name: 'Semántica core.md',
            type: 'text',
            folder: 'No estructurado',
            content: '# Semántica\n\nFragmento base.',
            ownerId: TEST_USER.uid,
            workspaceId: 'ws-shared',
            mimeType: 'text/markdown',
            updatedAt: ISO_DATE
          }
        ]
      }
    });

    await gotoDashboard(page, 'ws-shared');
    const rawTextarea = await openMarkdownDocumentInRawMode(page, 'Semántica core.md');

    await openSemanticMenu(page, rawTextarea, 'Memoria cooperativa persistida.');
    await page.getByRole('button', { name: 'Definir concepto', exact: true }).first().click();

    const dialog = page.locator('div.fixed.inset-0').filter({
      has: page.getByRole('heading', { name: 'Definir concepto' })
    }).last();
    await expect(dialog).toBeVisible();
    await dialog.locator('input').nth(1).fill('Concepto guardado en API');
    await dialog.getByRole('button', { name: 'Definir concepto', exact: true }).click();

    await expect.poll(() => state.semanticStatesByWorkspace['ws-shared']?.concepts.length ?? 0).toBe(1);
    const concept = state.semanticStatesByWorkspace['ws-shared']?.concepts[0];
    expect(concept?.title).toBe('Memoria cooperativa persistida.');
    expect(concept?.definition).toBe('Concepto guardado en API');
  });
});
