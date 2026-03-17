import { expect, test } from '@playwright/test';

import {
  TEST_USER,
  gotoDashboard,
  installBrowserStubs,
  installInsecureAuth,
  installMockApi
} from './support/mockApp';

const ISO_DATE = '2030-01-10T12:00:00.000Z';

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
  await installInsecureAuth(page);
});

test('dashboard pricing modal redirects paid plan checkout', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page, 'ws-shared');

  await page.locator(`button[title="${TEST_USER.email}"]`).click();
  await page.getByRole('button', { name: 'Planes y precios' }).click();
  await expect(page.getByRole('heading', { name: 'Planes y Precios' })).toBeVisible();

  await page.getByRole('button', { name: 'Renovar plan', exact: true }).click();
  await page.waitForURL('https://checkout.test/mercadopago');
  await expect(page.getByRole('heading', { name: 'Checkout Mock' })).toBeVisible();
});

test('dashboard opens csv documents in the spreadsheet viewer', async ({ page }) => {
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
          id: 'sheet-1',
          name: 'estadisticas.csv',
          type: 'file',
          folder: 'No estructurado',
          content: 'Nombre,Puntaje\nCarlos,20\nAna,15\nBea,30',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/csv',
          updatedAt: ISO_DATE
        }
      ]
    }
  });

  await gotoDashboard(page, 'ws-shared');

  await page.getByText('estadisticas.csv', { exact: true }).first().click();
  await expect(page.getByText('3 filas', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr').first().getByText('Carlos', { exact: true })).toBeVisible();

  const filterInput = page.getByPlaceholder('Filtrar...');
  await filterInput.fill('Ana');
  await expect(page.getByText('1 filas de 3', { exact: true })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr').first().getByText('Ana', { exact: true })).toBeVisible();

  await filterInput.clear();
  await page.getByRole('columnheader', { name: /Puntaje/i }).click();
  await expect(page.locator('tbody tr').first().getByText('Ana', { exact: true })).toBeVisible();
  await page.getByRole('columnheader', { name: /Puntaje/i }).click();
  await expect(page.locator('tbody tr').first().getByText('Bea', { exact: true })).toBeVisible();

  const previousDownloads = await page.evaluate(() => {
    const state = window as Window & {
      __downloads?: Array<{ href: string; download: string }>;
      __blobDownloads?: Array<{ url: string; size?: number }>;
    };
    return {
      downloads: state.__downloads?.length ?? 0,
      blobs: state.__blobDownloads?.length ?? 0
    };
  });

  await page.getByTitle('Descargar original').click();
  await expect.poll(async () => {
    const state = await page.evaluate(() => {
      const value = window as Window & {
        __downloads?: Array<{ href: string; download: string }>;
        __blobDownloads?: Array<{ url: string; size?: number }>;
      };
      return {
        lastDownload: value.__downloads?.at(-1)?.download ?? null,
        downloads: value.__downloads?.length ?? 0,
        blobs: value.__blobDownloads?.length ?? 0
      };
    });
    return (
      state.lastDownload === 'estadisticas.csv'
      || state.downloads > previousDownloads.downloads
      || state.blobs > previousDownloads.blobs
    );
  }).toBe(true);
});

test('dashboard inserts seeded snippets into markdown documents', async ({ page }) => {
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
          id: 'doc-editor-1',
          name: 'Apuntes de clase.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Apuntes\n\nTexto base para el editor.',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ]
    }
  });

  await gotoDashboard(page, 'ws-shared');

  await page.getByText('Apuntes de clase.md', { exact: true }).first().click();
  await expect(page.getByTitle('Galería de snippets')).toBeVisible();
  await page.getByTitle('Galería de snippets').click();
  await expect(page.getByText('LaTeX inline', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByText('LaTeX inline', { exact: true }).click();

  await page.getByTitle('Ver Markdown puro').click();
  const rawTextarea = page.locator('textarea.markdown-raw-textarea');
  await expect(rawTextarea).toBeVisible();
  await expect.poll(async () => rawTextarea.inputValue()).toContain('mc^2');
});

test('dashboard sends a semantic selection from the editor to the board', async ({ page }) => {
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
          id: 'doc-editor-2',
          name: 'Investigacion.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Investigación\n\nFragmento clave para tarea dentro del editor.',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/markdown',
          updatedAt: ISO_DATE
        }
      ]
    }
  });

  await gotoDashboard(page, 'ws-shared');

  await page.getByText('Investigacion.md', { exact: true }).first().click();
  await page.getByTitle('Ver Markdown puro').click();

  const rawTextarea = page.locator('textarea.markdown-raw-textarea');
  await expect(rawTextarea).toBeVisible();
  await rawTextarea.fill('Fragmento clave para tarea dentro del editor.');
  await rawTextarea.click();
  await page.keyboard.press('Control+A');
  await rawTextarea.click({ button: 'right' });

  await expect(page.getByText('Menú semántico', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar a tarea', exact: true }).click();
  await expect(page.getByText('Fragmento enviado a “Por hacer”.', { exact: true })).toBeVisible();

  await page.getByTitle('Tablero').click();
  await expect(page.getByRole('heading', { name: 'Tablero' })).toBeVisible();
  await expect(
    page.locator('div.text-xs.font-semibold.text-surface-100.break-words').filter({
      hasText: 'Fragmento clave para tarea dentro del editor.'
    }).first()
  ).toBeVisible();
});
