import { expect, test, type Page } from '@playwright/test';

import {
  TEST_USER,
  gotoDashboard,
  installBrowserStubs,
  installInsecureAuth,
  installMockApi
} from './support/mockApp';

const dispatchShortcut = async (
  page: Page,
  eventInit: {
    key: string;
    code: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  }
) => {
  await page.evaluate((payload) => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      ...payload,
      bubbles: true
    }));
  }, eventInit);
};

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
  await installInsecureAuth(page);
});

test('dashboard switches workspaces and creates a new workspace', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page);
  const header = page.getByRole('banner');

  await expect(page.getByRole('button', { name: /Espacio Personal/i })).toBeVisible();
  await expect(page.getByText('Documento inicial.md')).toBeVisible();

  await header.getByRole('button', { name: 'Espacio Personal', exact: true }).click();
  await page.getByText('Historia Cooperativa').click();

  await expect(page).toHaveURL(/workspaceId=ws-shared/);
  await expect(header.getByRole('button', { name: 'Historia Cooperativa', exact: true })).toBeVisible();
  await expect(page.getByText('Bibliografia.md')).toBeVisible();

  await header.getByRole('button', { name: 'Historia Cooperativa', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo Espacio' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo Espacio de Trabajo' })).toBeVisible();

  await page.getByPlaceholder('Nombre, ej: Grupo Física').fill('Equipo QA');
  await page.getByRole('button', { name: 'Crear' }).click();

  await expect(page).toHaveURL(/workspaceId=ws-created-1/);
  await expect(header.getByRole('button', { name: 'Equipo QA', exact: true })).toBeVisible();
  await expect(page.getByText('Espacio vacío')).toBeVisible();
});

test('dashboard opens pricing, changes password and manages workspace members', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page, 'ws-shared');

  const userMenuButton = page.locator(`button[title="${TEST_USER.email}"]`);
  await userMenuButton.click();
  await page.getByRole('button', { name: 'Planes y precios' }).click();

  await expect(page.getByRole('heading', { name: 'Planes y Precios' })).toBeVisible();
  await expect(page.getByText('128 MB de 1 GB')).toBeVisible();
  const pricingModal = page.locator('div.fixed.inset-0.z-50').filter({
    has: page.getByRole('heading', { name: 'Planes y Precios' })
  });
  await pricingModal.getByRole('button').first().click();

  await userMenuButton.click();
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(page.getByRole('heading', { name: 'Cambiar Contraseña' })).toBeVisible();
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill('actual');
  await passwordInputs.nth(1).fill('nueva-1');
  await passwordInputs.nth(2).fill('distinta');
  await page.getByRole('button', { name: 'Cambiar Contraseña' }).click();
  await expect(page.getByText('Las contraseñas nuevas no coinciden')).toBeVisible();

  await passwordInputs.nth(2).fill('nueva-1');
  await page.getByRole('button', { name: 'Cambiar Contraseña' }).click();
  await expect(page.getByText('¡Contraseña actualizada!')).toBeVisible();
  const passwordModal = page.locator('div.fixed.inset-0.z-50').filter({
    has: page.getByRole('heading', { name: 'Cambiar Contraseña' })
  });
  await passwordModal.getByRole('button', { name: 'Cerrar', exact: true }).click();

  await page.getByTitle('Miembros').click();
  await expect(page.getByRole('heading', { name: 'Miembros del Espacio' })).toBeVisible();
  await expect(page.getByText('Miembros (2)')).toBeVisible();

  await page.getByPlaceholder('usuario@ejemplo.com').fill('nuevo.miembro@cooperativa.test');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Invitación enviada')).toBeVisible();
  const inviteSentDialog = page.locator('div').filter({
    has: page.getByText('Invitación enviada')
  }).first();
  await inviteSentDialog.locator('button').filter({ hasText: /^Aceptar$/ }).dispatchEvent('click');

  await page.getByTitle('Miembros').click();
  await expect(page.getByRole('heading', { name: 'Miembros del Espacio' })).toBeVisible();
  await page.getByTitle('Eliminar miembro').click();
  await expect(page.getByText('Eliminar miembro')).toBeVisible();
  const removeMemberDialog = page.locator('div').filter({
    has: page.getByText('¿Estás seguro de que quieres eliminar a este miembro del espacio de trabajo?')
  }).first();
  await removeMemberDialog.locator('button').filter({ hasText: /^Eliminar$/ }).dispatchEvent('click');
  await expect(page.getByText('Miembro eliminado')).toBeVisible();
  const memberRemovedDialog = page.locator('div').filter({
    has: page.getByText('Miembro eliminado')
  }).first();
  await memberRemovedDialog.locator('button').filter({ hasText: /^Aceptar$/ }).dispatchEvent('click');
  await expect(page.getByText('Miembros (1)')).toBeVisible();
});

test('dashboard creates documents and folders and uses sidebar and quick search', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page, 'ws-shared');

  await page.getByRole('button', { name: 'Nuevo archivo' }).first().click();
  await expect(page.getByRole('button', { name: /Documento Markdown/i })).toBeVisible();
  await page.getByRole('button', { name: /Documento Markdown/i }).click();
  await expect(page.getByText('Sin título').first()).toBeVisible();

  await page.getByRole('button', { name: 'Nueva carpeta' }).first().click();
  await page.getByPlaceholder('Nombre de carpeta').fill('Apuntes');
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByRole('button', { name: 'Apuntes', exact: true })).toBeVisible();

  const sidebarSearch = page.getByPlaceholder('Buscar...').first();
  await sidebarSearch.fill('memoria');
  await expect(page.getByText(/^1 de \d+$/)).toBeVisible();
  await expect(page.getByText('Memoria cooperativa.md')).toBeVisible();
  await sidebarSearch.clear();

  const quickSearchTrigger = page.getByRole('button', { name: 'Buscar en este espacio', exact: true });
  await expect(quickSearchTrigger).toBeVisible();
  await quickSearchTrigger.click();
  const quickSearchInput = page.getByPlaceholder('Buscar documentos, conceptos, fragmentos, autores u obras...');
  await expect(quickSearchInput).toBeVisible();
  await quickSearchInput.fill('memoria');

  await expect(page.getByRole('button', { name: /Todos \(2\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Documento \(1\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Concepto \(1\)/ })).toBeVisible();

  await page.getByRole('button', { name: /Documento \(1\)/ }).click();
  await expect(page.getByText('Memoria cooperativa.md')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(quickSearchInput).toBeHidden();

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, bubbles: true }));
  });
  await expect(quickSearchInput).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Tablero', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tablero' })).toBeVisible();
});

test('dashboard supports VS Code style keyboard shortcuts', async ({ page }) => {
  await installMockApi(page, {
    subscription: {
      planId: 'pro',
      status: 'active'
    },
    storageUsage: {
      planId: 'pro'
    }
  });
  await gotoDashboard(page, 'ws-shared');

  await dispatchShortcut(page, { key: 'n', code: 'KeyN', ctrlKey: true });
  await expect(page.getByRole('button', { name: /Documento Markdown/i })).toBeVisible();
  await page.getByRole('button', { name: /Documento Markdown/i }).click();
  await expect(page.getByText('Sin título').first()).toBeVisible();

  await dispatchShortcut(page, { key: 'b', code: 'KeyB', ctrlKey: true });
  await expect(page.getByLabel('Mostrar panel de archivos')).toBeVisible();

  await dispatchShortcut(page, { key: 'b', code: 'KeyB', ctrlKey: true });
  await expect(page.getByLabel('Mostrar panel de archivos')).toHaveCount(0);

  await page.keyboard.press('Control+`');
  await expect(page.getByText('Mi Asistente').first()).toBeVisible();

  await dispatchShortcut(page, { key: 'k', code: 'KeyK', ctrlKey: true });
  await dispatchShortcut(page, { key: 'z', code: 'KeyZ' });
  await expect(page.getByLabel('Salir de modo Zen')).toBeVisible();
});

test('dashboard preserves PDF scroll position when reopening a file', async ({ page }) => {
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
          updatedAt: '2030-01-10T12:00:00.000Z'
        }
      ],
      'ws-shared': [
        {
          id: 'doc-pdf-1',
          name: 'Informe.pdf',
          type: 'file',
          folder: 'No estructurado',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'application/pdf',
          url: 'https://files.test/informe.pdf',
          updatedAt: '2030-01-10T12:00:00.000Z'
        },
        {
          id: 'doc-note-1',
          name: 'Notas sobre PDF.md',
          type: 'text',
          folder: 'No estructurado',
          content: '# Notas sobre PDF\n\nReferencia temporal.',
          ownerId: TEST_USER.uid,
          workspaceId: 'ws-shared',
          mimeType: 'text/markdown',
          updatedAt: '2030-01-10T12:00:00.000Z'
        }
      ]
    }
  });
  await gotoDashboard(page, 'ws-shared');

  await page.getByText('Informe.pdf', { exact: true }).first().click();
  const pdfViewer = page.getByTestId('pdf-viewer-scroll-container');
  await expect(pdfViewer).toBeVisible();
  await expect(page.getByPlaceholder('Buscar en PDF...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajustar PDF al ancho' })).toContainText('100%');
  await page.getByRole('button', { name: 'Acercar PDF' }).click();
  await expect(page.getByRole('button', { name: 'Ajustar PDF al ancho' })).not.toContainText('100%');
  await expect(page.getByTestId('pdf-page-canvas')).toHaveCount(1);
  await expect.poll(async () => (
    pdfViewer.evaluate((element) => element.scrollHeight > element.clientHeight)
  )).toBe(true);

  await pdfViewer.evaluate((element) => {
    element.scrollTop = 900;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect.poll(async () => (
    pdfViewer.evaluate((element) => element.scrollTop)
  )).toBeGreaterThan(400);

  await page.getByText('Notas sobre PDF.md', { exact: true }).first().click();
  await expect(pdfViewer).toHaveCount(0);

  await page.getByText('Informe.pdf', { exact: true }).first().click();
  const restoredViewer = page.getByTestId('pdf-viewer-scroll-container');
  await expect(restoredViewer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajustar PDF al ancho' })).not.toContainText('100%');
  await expect.poll(async () => (
    restoredViewer.evaluate((element) => element.scrollTop)
  )).toBeGreaterThan(400);
});
