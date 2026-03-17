import { expect, Page, test } from '@playwright/test';

import {
  gotoDashboard,
  installBrowserStubs,
  installInsecureAuth,
  installMockApi
} from './support/mockApp';

const dismissInfoDialog = async (page: Page, title: string) => {
  const dialog = page.locator('div').filter({
    has: page.getByText(title, { exact: true })
  }).first();
  await expect(dialog).toBeVisible();
  await dialog.locator('button').filter({ hasText: /^Aceptar$/ }).dispatchEvent('click');
};

const fileExplorerContent = (page: Page) => (
  page.locator('section').filter({
    has: page.getByText('Contenido', { exact: true })
  }).last()
);

const workspaceMenu = (page: Page) => (
  page.locator('div.absolute').filter({
    has: page.getByText('Mis Espacios', { exact: true })
  }).last()
);

const openFilesExplorer = async (page: Page) => {
  const header = page.getByRole('banner');
  await header.getByRole('button', { name: 'Archivos', exact: true }).click();
  await expect(fileExplorerContent(page)).toBeVisible();
};

const openContextMenuForDoc = async (page: Page, name: string) => {
  const docLabel = fileExplorerContent(page).getByText(name, { exact: true }).first();
  await expect(docLabel).toBeVisible();
  await docLabel.click({ button: 'right' });
};

const clickContextMenuAction = async (page: Page, label: string) => {
  const menu = page.locator('div.fixed.z-50.bg-surface-800').filter({
    has: page.getByRole('button', { name: label, exact: true })
  }).last();
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: label, exact: true }).click();
};

const clickExplorerToolbarAction = async (page: Page, label: 'Subir archivo' | 'Subir carpeta') => {
  const directButton = page.getByTitle(label);
  if (await directButton.isVisible().catch(() => false)) {
    await directButton.click();
    return;
  }

  const actionsButton = page.getByTitle('Acciones').first();
  await actionsButton.click();
  await page.getByRole('button', { name: label, exact: true }).click();
};

const openExplorerFolder = async (page: Page, name: string) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.getByRole('button', { name: new RegExp(`^${escapedName}(?:\\s|$)`) }).first().click();
};

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
  await installInsecureAuth(page);
});

test('dashboard accepts an invite and deletes the accepted workspace', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page);

  const header = page.getByRole('banner');

  await header.getByRole('button', { name: 'Espacio Personal', exact: true }).click();
  await expect(page.getByText('Invitacion Pendiente')).toBeVisible();
  await page.getByRole('button', { name: 'Unirse' }).click();

  await expect(page.getByText('Invitación aceptada')).toBeVisible();
  await dismissInfoDialog(page, 'Invitación aceptada');

  await workspaceMenu(page).getByText('Invitacion Pendiente', { exact: true }).click();

  await expect(page).toHaveURL(/workspaceId=ws-invite/);
  await expect(header.getByRole('button', { name: 'Invitacion Pendiente', exact: true })).toBeVisible();

  await header.getByRole('button', { name: 'Invitacion Pendiente', exact: true }).click();
  await workspaceMenu(page).getByTitle('Eliminar workspace').last().click();

  await expect(page.getByText('Eliminar espacio de trabajo')).toBeVisible();
  await page.getByPlaceholder('Invitacion Pendiente').fill('Invitacion Pendiente');
  await page.locator('div').filter({
    has: page.getByText('Eliminar espacio de trabajo', { exact: true })
  }).first().locator('button').filter({ hasText: /^Eliminar$/ }).dispatchEvent('click');

  await expect(page.getByText('Espacio eliminado')).toBeVisible();
  await dismissInfoDialog(page, 'Espacio eliminado');

  await expect(header.getByRole('button', { name: 'Espacio Personal', exact: true })).toBeVisible();
  await header.getByRole('button', { name: 'Espacio Personal', exact: true }).click();
  await expect(page.getByText('Invitacion Pendiente')).toBeHidden();
});

test('dashboard manages documents from the file explorer', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page, 'ws-shared');

  await openFilesExplorer(page);

  await openExplorerFolder(page, 'No estructurado');

  await openContextMenuForDoc(page, 'Bibliografia.md');
  await clickContextMenuAction(page, 'Fijar en favoritos');

  await openContextMenuForDoc(page, 'Bibliografia.md');
  await expect(page.locator('div.fixed.z-50.bg-surface-800').last().getByRole('button', { name: 'Quitar de favoritos', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await openContextMenuForDoc(page, 'Bibliografia.md');
  await clickContextMenuAction(page, 'Duplicar');
  await expect(fileExplorerContent(page).getByText('Bibliografia.md (copia)', { exact: true })).toBeVisible();

  await openContextMenuForDoc(page, 'Bibliografia.md (copia)');
  await clickContextMenuAction(page, 'Renombrar');
  await expect(page.getByText('Renombrar archivo')).toBeVisible();
  await page.getByPlaceholder('Nuevo nombre').fill('Bibliografia final.md');
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(fileExplorerContent(page).getByText('Bibliografia final.md', { exact: true })).toBeVisible();

  await page.evaluate(() => {
    (window as Window & { __nextPromptResponse?: string }).__nextPromptResponse = 'Clase';
  });
  await openContextMenuForDoc(page, 'Bibliografia final.md');
  await clickContextMenuAction(page, 'Mover a...');

  await openExplorerFolder(page, 'Clase');
  await expect(fileExplorerContent(page).getByText('Bibliografia final.md', { exact: true })).toBeVisible();

  await openContextMenuForDoc(page, 'Bibliografia final.md');
  await clickContextMenuAction(page, 'Descargar');
  const lastDownload = await page.evaluate(() => {
    const state = window as Window & {
      __downloads?: Array<{ href: string; download: string }>;
    };
    return state.__downloads?.at(-1)?.download ?? null;
  });
  expect(lastDownload).toBe('Bibliografia final.md');

  await openContextMenuForDoc(page, 'Bibliografia final.md');
  await clickContextMenuAction(page, 'Eliminar');
  const deleteDialog = page.locator('div').filter({
    has: page.getByText('Eliminar elemento', { exact: true })
  }).first();
  await deleteDialog.locator('button').filter({ hasText: /^Eliminar$/ }).dispatchEvent('click');
  await expect(page.getByText('Eliminado')).toBeVisible();
});

test('dashboard uploads files and folders from the file explorer', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page, 'ws-shared');

  await openFilesExplorer(page);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await clickExplorerToolbarAction(page, 'Subir archivo');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'grafico.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-image-data')
  });

  await expect(page.getByText('Subida completa')).toBeVisible();
  await expect(fileExplorerContent(page).getByText('grafico.png', { exact: true })).toBeVisible();

  await page.evaluate(() => {
    const folderInput = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))
      .find((input) => input.hasAttribute('webkitdirectory') || input.getAttribute('directory') === 'true');
    if (!folderInput) {
      throw new Error('No se encontró el input de carpetas');
    }

    const dataTransfer = new DataTransfer();
    const file = new File(['# Leccion\n\nContenido de prueba.'], 'leccion.md', {
      type: 'text/markdown'
    });
    Object.defineProperty(file, 'webkitRelativePath', {
      configurable: true,
      value: 'materiales/leccion.md'
    });
    dataTransfer.items.add(file);
    Object.defineProperty(folderInput, 'files', {
      configurable: true,
      value: dataTransfer.files
    });
    folderInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.getByText('Subida completa')).toBeVisible({ timeout: 10000 });
  await expect(fileExplorerContent(page).getByText('leccion.md', { exact: true })).toBeVisible();
  await expect(fileExplorerContent(page).getByText('No estructurado/materiales', { exact: true })).toBeVisible();
});
