import { expect, Page, test } from '@playwright/test';

import {
  TEST_USER,
  gotoDashboard,
  installBrowserStubs,
  installInsecureAuth,
  installMockApi
} from './support/mockApp';

const ISO_DATE = '2030-01-10T12:00:00.000Z';
const SEMANTIC_STORAGE_KEY = 'editor-semantic:ws-shared:user-e2e';

const fileExplorerContent = (page: Page) => (
  page.locator('section').filter({
    has: page.getByText('Contenido', { exact: true })
  }).last()
);

const openFilesExplorer = async (page: Page) => {
  await page.getByRole('banner').getByRole('button', { name: 'Archivos', exact: true }).click();
  await expect(fileExplorerContent(page)).toBeVisible();
};

const openPricingModal = async (page: Page) => {
  await page.locator(`button[title="${TEST_USER.email}"]`).click();
  await page.getByRole('button', { name: 'Planes y precios' }).click();
  await expect(page.getByRole('heading', { name: 'Planes y Precios' })).toBeVisible();
};

const currentPlanCard = (page: Page) => (
  page.getByText('Plan actual', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")]').first()
);

const docRow = (page: Page, name: string) => (
  fileExplorerContent(page).locator(
    `xpath=.//div[.//input[@title="Seleccionar archivo"] and .//*[normalize-space(text())=${JSON.stringify(name)}]]`
  ).last()
);

const folderRow = (page: Page, name: string) => (
  fileExplorerContent(page).locator(
    `xpath=.//div[.//input[@title="Seleccionar carpeta"] and .//*[normalize-space(text())=${JSON.stringify(name)}]]`
  ).last()
);

const selectFileCheckbox = async (page: Page, name: string) => {
  const row = docRow(page, name);
  await expect(row).toBeVisible();
  await row.getByTitle('Seleccionar archivo').click();
};

const selectFolderCheckbox = async (page: Page, name: string) => {
  const row = folderRow(page, name);
  await expect(row).toBeVisible();
  await row.getByTitle('Seleccionar carpeta').click();
};

const dragHandleToTarget = async (
  page: Page,
  source: ReturnType<typeof docRow> | ReturnType<typeof folderRow>,
  handleTitle: 'Reordenar archivo' | 'Reordenar carpeta',
  target: ReturnType<typeof docRow> | ReturnType<typeof folderRow>,
  position: 'before' | 'after' = 'before'
) => {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const targetBox = await target.boundingBox();

  if (!targetBox) {
    throw new Error(`No bounding box for ${handleTitle}`);
  }

  const clientY = position === 'before'
    ? targetBox.y + 4
    : targetBox.y + targetBox.height - 4;

  await source.getByTitle(handleTitle).dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer, clientY });
  await target.dispatchEvent('drop', { dataTransfer, clientY });
  await source.getByTitle(handleTitle).dispatchEvent('dragend', { dataTransfer });
};

const openMarkdownDocumentInRawMode = async (page: Page, name: string) => {
  await page.getByText(name, { exact: true }).first().click();
  await page.getByTitle('Ver Markdown puro').click();
  const rawTextarea = page.locator('textarea.markdown-raw-textarea');
  await expect(rawTextarea).toBeVisible();
  return rawTextarea;
};

const openSemanticMenu = async (page: Page, rawTextarea: ReturnType<Page['locator']>, text: string) => {
  await rawTextarea.fill(text);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await rawTextarea.click();
    await page.keyboard.press('Control+A');

    try {
      await expect(page.getByText('Menú semántico', { exact: true })).toBeVisible({ timeout: 3000 });
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      await page.waitForTimeout(250);
    }
  }
};

const readSemanticState = async (page: Page) => (
  page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  }, SEMANTIC_STORAGE_KEY)
);

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
  await installInsecureAuth(page);
});

test('dashboard verifies successful payment callbacks and upgrades the current plan', async ({ page }) => {
  const state = await installMockApi(page, {
    subscription: {
      planId: 'basic',
      status: 'active'
    },
    verifyPaymentResult: {
      status: 'active',
      planId: 'pro',
      message: 'payment verified',
      mutateSubscription: true,
      endDate: '2031-01-31T00:00:00.000Z'
    }
  });

  await page.goto('/api/payments/callback/success?collection_status=approved', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard\?payment=success/);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect.poll(() => state.verifyCallCount).toBe(1);
  await expect.poll(() => state.subscription.planId).toBe('pro');

  await openPricingModal(page);
  await expect(currentPlanCard(page)).toContainText('Pro');
});

test('dashboard verifies pending payment callbacks without changing the active plan', async ({ page }) => {
  const state = await installMockApi(page, {
    subscription: {
      planId: 'basic',
      status: 'active'
    },
    verifyPaymentResult: {
      status: 'pending',
      message: 'payment pending'
    }
  });

  await page.goto('/api/payments/callback/pending?collection_status=pending', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/dashboard\?payment=pending/);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect.poll(() => state.verifyCallCount).toBe(1);
  await expect.poll(() => state.subscription.planId).toBe('basic');

  await openPricingModal(page);
  await expect(currentPlanCard(page)).toContainText('Básico');
});

test('dashboard supports full snippets CRUD from the markdown editor', async ({ page }) => {
  const state = await installMockApi(page, {
    snippetsByWorkspace: {
      'ws-shared': [
        {
          id: 'snippet-seeded',
          title: 'Snippet base',
          description: 'Base del workspace',
          markdown: 'Texto base',
          workspaceId: 'ws-shared',
          category: 'general',
          order: 0,
          ownerId: TEST_USER.uid
        }
      ]
    },
    docsByWorkspace: {
      personal: [
        {
          id: 'doc-personal-1',
          name: 'Documento inicial.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Documento inicial\n\nContenido base del espacio personal.',
          ownerId: TEST_USER.uid,
          workspaceId: 'personal',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ],
      'ws-shared': [
        {
          id: 'doc-snippet-1',
          name: 'Notas de snippets.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Snippets\n\nDocumento para pruebas.',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ]
    }
  });

  await gotoDashboard(page, 'ws-shared');
  await page.getByText('Notas de snippets.md', { exact: true }).first().click();
  await page.getByTitle('Galería de snippets').click();

  await page.getByTitle('Nuevo snippet').click();
  await expect(page.getByText('Nuevo snippet', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Título del snippet').fill('Resumen QA');
  await page.getByPlaceholder('Descripción corta (opcional)').fill('Snippet para pruebas CRUD');
  await page.getByPlaceholder('Escribe el markdown del snippet...').fill('## Resumen QA');
  await page.getByRole('button', { name: 'Crear', exact: true }).click();

  await expect.poll(() => state.snippetsByWorkspace['ws-shared']?.length ?? 0).toBe(2);
  await page.getByPlaceholder('Buscar snippets...').fill('Resumen QA');
  await expect(page.getByText('Resumen QA', { exact: true })).toBeVisible();

  const createdSnippetCard = page.locator('div').filter({
    has: page.getByText('Resumen QA', { exact: true })
  }).first();
  await createdSnippetCard.getByTitle('Editar').click();
  await page.getByPlaceholder('Título del snippet').fill('Resumen QA final');
  await page.getByPlaceholder('Escribe el markdown del snippet...').fill('## Resumen final');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect.poll(() => (
    state.snippetsByWorkspace['ws-shared']?.some((snippet) => (
      snippet.title === 'Resumen QA final' && snippet.markdown.includes('Resumen final')
    )) ?? false
  )).toBe(true);

  await page.getByPlaceholder('Buscar snippets...').fill('Resumen QA final');
  const updatedSnippetCard = page.locator('div').filter({
    has: page.getByText('Resumen QA final', { exact: true })
  }).first();
  await updatedSnippetCard.getByTitle('Insertar').click();

  await page.getByTitle('Ver Markdown puro').click();
  const rawTextarea = page.locator('textarea.markdown-raw-textarea');
  await expect(rawTextarea).toBeVisible();
  await expect.poll(() => rawTextarea.inputValue()).toContain('## Resumen final');

  await page.getByTitle('Galería de snippets').click();
  await page.getByPlaceholder('Buscar snippets...').fill('Resumen QA final');
  const deletableSnippetCard = page.locator('div').filter({
    has: page.getByText('Resumen QA final', { exact: true })
  }).first();
  await deletableSnippetCard.getByTitle('Eliminar').click();
  await deletableSnippetCard.getByTitle('Confirmar eliminar').click();

  await expect.poll(() => state.snippetsByWorkspace['ws-shared']?.length ?? 0).toBe(1);
  await expect(page.getByText('Resumen QA final', { exact: true })).toHaveCount(0);
});

test('dashboard opens image, audio, video and pdf documents with the right viewer', async ({ page }) => {
  await installMockApi(page, {
    docsByWorkspace: {
      personal: [
        {
          id: 'doc-personal-1',
          name: 'Documento inicial.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Documento inicial\n\nContenido base del espacio personal.',
          ownerId: TEST_USER.uid,
          workspaceId: 'personal',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ],
      'ws-shared': [
        {
          id: 'doc-image-1',
          name: 'foto.png',
          type: 'file',
          folder: 'No estructurado',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'image/png',
          url: 'https://files.test/foto.png',
          storagePath: 'uploads/ws-shared/foto.png',
          updatedAt: ISO_DATE
        },
        {
          id: 'doc-audio-1',
          name: 'audio-clase.mp3',
          type: 'file',
          folder: 'No estructurado',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'audio/mpeg',
          url: 'https://files.test/audio-clase.mp3',
          storagePath: 'uploads/ws-shared/audio-clase.mp3',
          updatedAt: ISO_DATE
        },
        {
          id: 'doc-video-1',
          name: 'video-demo.mp4',
          type: 'file',
          folder: 'No estructurado',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'video/mp4',
          url: 'https://files.test/video-demo.mp4',
          storagePath: 'uploads/ws-shared/video-demo.mp4',
          updatedAt: ISO_DATE
        },
        {
          id: 'doc-pdf-1',
          name: 'manual.pdf',
          type: 'file',
          folder: 'No estructurado',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'application/pdf',
          url: 'https://files.test/manual.pdf',
          storagePath: 'uploads/ws-shared/manual.pdf',
          updatedAt: ISO_DATE
        }
      ]
    }
  });

  await gotoDashboard(page, 'ws-shared');
  await openFilesExplorer(page);

  await page.getByText('foto.png', { exact: true }).first().click();
  await expect(page.getByAltText('foto.png', { exact: true })).toBeVisible();

  await page.getByText('audio-clase.mp3', { exact: true }).first().click();
  await expect(page.locator('audio')).toBeVisible();

  await page.getByText('video-demo.mp4', { exact: true }).first().click();
  await expect(page.locator('video')).toBeVisible();

  await page.getByText('manual.pdf', { exact: true }).first().click();
  await expect(page.locator('iframe[title="manual.pdf"]')).toBeVisible();
});

test('dashboard reorders explorer items and supports deeper multiselect workflows', async ({ page }) => {
  const state = await installMockApi(page, {
    docsByWorkspace: {
      personal: [
        {
          id: 'doc-personal-1',
          name: 'Documento inicial.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Documento inicial\n\nContenido base del espacio personal.',
          ownerId: TEST_USER.uid,
          workspaceId: 'personal',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ],
      'ws-shared': [
        {
          id: 'folder-alpha',
          name: 'Alpha',
          type: 'folder',
          folder: '',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          order: 1000,
          updatedAt: ISO_DATE
        },
        {
          id: 'folder-beta',
          name: 'Beta',
          type: 'folder',
          folder: '',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          order: 2000,
          updatedAt: ISO_DATE
        },
        {
          id: 'doc-order-1',
          name: 'uno.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Uno',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/markdown',
          order: 1000,
          updatedAt: ISO_DATE
        },
        {
          id: 'doc-order-2',
          name: 'dos.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Dos',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/markdown',
          order: 2000,
          updatedAt: ISO_DATE
        }
      ]
    }
  });

  await gotoDashboard(page, 'ws-shared');
  await openFilesExplorer(page);

  await dragHandleToTarget(page, folderRow(page, 'Beta'), 'Reordenar carpeta', folderRow(page, 'Alpha'));
  await expect.poll(() => {
    const alpha = state.docsByWorkspace['ws-shared'].find((doc) => doc.id === 'folder-alpha');
    const beta = state.docsByWorkspace['ws-shared'].find((doc) => doc.id === 'folder-beta');
    return typeof alpha?.order === 'number' && typeof beta?.order === 'number' ? beta.order < alpha.order : false;
  }).toBe(true);

  await dragHandleToTarget(page, docRow(page, 'dos.md'), 'Reordenar archivo', docRow(page, 'uno.md'));
  await expect.poll(() => {
    const one = state.docsByWorkspace['ws-shared'].find((doc) => doc.id === 'doc-order-1');
    const two = state.docsByWorkspace['ws-shared'].find((doc) => doc.id === 'doc-order-2');
    return typeof one?.order === 'number' && typeof two?.order === 'number' ? two.order < one.order : false;
  }).toBe(true);

  await selectFolderCheckbox(page, 'Beta');
  await selectFileCheckbox(page, 'dos.md');
  await expect(page.getByText('2 seleccionados', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await expect(page.getByText('2 seleccionados', { exact: true })).toHaveCount(0);

  await page.getByTitle('Seleccionar todo / Ninguno').click();
  await expect(page.getByText('4 seleccionados', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar', exact: true }).click();

  const confirmDialog = page.locator('div').filter({
    has: page.getByText('Confirmar eliminación', { exact: true })
  }).first();
  await confirmDialog.locator('button').filter({ hasText: /^Eliminar$/ }).dispatchEvent('click');

  await expect.poll(() => state.docsByWorkspace['ws-shared'].length).toBe(0);
  await expect(fileExplorerContent(page).getByText('Esta carpeta está vacía.', { exact: true })).toBeVisible();
});

test('dashboard defines concepts and relates selections from the semantic menu', async ({ page }) => {
  await installMockApi(page, {
    docsByWorkspace: {
      personal: [
        {
          id: 'doc-personal-1',
          name: 'Documento inicial.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Documento inicial\n\nContenido base del espacio personal.',
          ownerId: TEST_USER.uid,
          workspaceId: 'personal',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ],
      'ws-shared': [
        {
          id: 'doc-semantic-1',
          name: 'Semantica.md',
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
  const rawTextarea = await openMarkdownDocumentInRawMode(page, 'Semantica.md');

  await openSemanticMenu(page, rawTextarea, 'Memoria colectiva y archivo cooperativo.');
  await page.getByRole('button', { name: 'Definir concepto', exact: true }).click();
  await expect(page.getByText('Concepto registrado desde la selección.', { exact: true })).toBeVisible();

  await expect.poll(async () => {
    const state = await readSemanticState(page);
    return state?.concepts?.length ?? 0;
  }).toBe(1);

  await openSemanticMenu(page, rawTextarea, 'Memoria colectiva y archivo cooperativo.');
  await page.getByRole('button', { name: 'Relacionar', exact: true }).click();
  await page.getByRole('button', { name: 'Memoria colectiva y archivo cooperativo.' }).click();
  await expect(page.getByText('Fragmento relacionado con el concepto elegido.', { exact: true })).toBeVisible();

  await expect.poll(async () => {
    const state = await readSemanticState(page);
    return state?.relations?.length ?? 0;
  }).toBe(1);
});

test('dashboard stores semantic evidence and pinned fragments from the editor selection menu', async ({ page }) => {
  await installMockApi(page, {
    docsByWorkspace: {
      personal: [
        {
          id: 'doc-personal-1',
          name: 'Documento inicial.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Documento inicial\n\nContenido base del espacio personal.',
          ownerId: TEST_USER.uid,
          workspaceId: 'personal',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ],
      'ws-shared': [
        {
          id: 'doc-semantic-2',
          name: 'Hallazgos.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Hallazgos\n\nFragmento base.',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ]
    }
  });

  await gotoDashboard(page, 'ws-shared');
  const rawTextarea = await openMarkdownDocumentInRawMode(page, 'Hallazgos.md');

  await openSemanticMenu(page, rawTextarea, 'La evidencia archivística confirma el proceso cooperativo.');
  await page.getByRole('button', { name: 'Marcar evidencia', exact: true }).click();
  await expect(page.getByText('Evidencia guardada en el panel semántico.', { exact: true })).toBeVisible();

  await openSemanticMenu(page, rawTextarea, 'La evidencia archivística confirma el proceso cooperativo.');
  await page.getByRole('button', { name: 'Fijar fragmento', exact: true }).click();
  await expect(page.getByText('Fragmento fijado para acceso rápido.', { exact: true })).toBeVisible();

  await expect.poll(async () => {
    const state = await readSemanticState(page);
    const evidence = state?.fragments?.filter((item: { kind: string }) => item.kind === 'evidence').length ?? 0;
    const pinned = state?.fragments?.filter((item: { kind: string }) => item.kind === 'pinned').length ?? 0;
    return { evidence, pinned };
  }).toEqual({ evidence: 1, pinned: 1 });
});

test('dashboard inserts semantic blocks and internal document links from editor selections', async ({ page }) => {
  await installMockApi(page, {
    docsByWorkspace: {
      personal: [
        {
          id: 'doc-personal-1',
          name: 'Documento inicial.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Documento inicial\n\nContenido base del espacio personal.',
          ownerId: TEST_USER.uid,
          workspaceId: 'personal',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ],
      'ws-shared': [
        {
          id: 'doc-semantic-3',
          name: 'Mapa semantico.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Mapa\n\nFragmento base.',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        },
        {
          id: 'doc-linked-1',
          name: 'Lecturas.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Lecturas\n\nDestino del enlace.',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ]
    }
  });

  await gotoDashboard(page, 'ws-shared');
  const rawTextarea = await openMarkdownDocumentInRawMode(page, 'Mapa semantico.md');

  await openSemanticMenu(page, rawTextarea, 'Lectura relacionada');
  await page.getByText('Enlazar a documento', { exact: true }).click();
  await page.getByRole('button', { name: 'Lecturas.md' }).click();
  await expect(page.getByText('Enlace interno creado hacia “Lecturas.md”.', { exact: true })).toBeVisible();
  await expect.poll(() => rawTextarea.inputValue()).toContain('(/editor/doc-linked-1)');

  await openSemanticMenu(page, rawTextarea, 'Bloque con contexto semántico');
  await page.getByRole('button', { name: 'Bloque semántico', exact: true }).click();
  await expect(page.getByText('Bloque semántico insertado en el documento.', { exact: true })).toBeVisible();
  await expect.poll(() => rawTextarea.inputValue()).toContain('[!semantic] Fragmento académico');

  await expect.poll(async () => {
    const state = await readSemanticState(page);
    const semanticBlocks = state?.fragments?.filter((item: { kind: string }) => item.kind === 'semantic-block').length ?? 0;
    const linked = state?.fragments?.some((item: { linkedDocId?: string }) => item.linkedDocId === 'doc-linked-1') ?? false;
    return { semanticBlocks, linked };
  }).toEqual({ semanticBlocks: 1, linked: true });
});
