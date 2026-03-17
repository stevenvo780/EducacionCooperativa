import { expect, Page, test } from '@playwright/test';

import {
  gotoDashboard,
  installBrowserStubs,
  installInsecureAuth,
  installMockApi
} from './support/mockApp';

const openBoard = async (page: Page) => {
  await page.getByTitle('Tablero').click();
  await expect(page.getByRole('heading', { name: 'Tablero' })).toBeVisible();
};

const columnNameInput = (page: Page, name: string) => (
  page.locator(`xpath=//input[@value=${JSON.stringify(name)}]`)
);

const boardColumn = (page: Page, name: string) => (
  page.locator(
    `xpath=//input[@value=${JSON.stringify(name)}]/ancestor::div[count(.//button[@title="Eliminar columna"])=1 and .//button[@title="Agregar tarjeta"] and .//input[@placeholder="Nueva tarjeta"]][1]`
  )
);

const boardCard = (page: Page, title: string) => (
  page.getByText(title, { exact: true }).locator(
    'xpath=ancestor::div[.//select and .//button[@title="Eliminar tarjeta"]][1]'
  )
);

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
  await installInsecureAuth(page);
});

test('dashboard manages kanban columns and cards', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page, 'ws-shared');
  await openBoard(page);

  await expect(columnNameInput(page, 'Por hacer')).toBeVisible();
  await expect(columnNameInput(page, 'En progreso')).toBeVisible();
  await expect(columnNameInput(page, 'Hecho')).toBeVisible();

  await page.getByPlaceholder('Ej: Revisar').fill('Revisar');
  await page.getByRole('button', { name: 'Agregar columna' }).click();
  await expect(columnNameInput(page, 'Revisar')).toBeVisible();

  const reviewColumn = boardColumn(page, 'Revisar');
  await reviewColumn.getByPlaceholder('Nueva tarjeta').fill('Preparar clase');
  await reviewColumn.getByTitle('Agregar tarjeta').click();
  await expect(reviewColumn.getByText('Preparar clase', { exact: true })).toBeVisible();

  await reviewColumn.getByText('Preparar clase', { exact: true }).click({ button: 'right' });
  const cardMenu = page.locator('div.fixed.z-50.bg-surface-800').filter({
    has: page.getByRole('button', { name: 'Editar título', exact: true })
  }).last();
  await expect(cardMenu).toBeVisible();
  await cardMenu.getByRole('button', { name: 'Editar título', exact: true }).click();

  const cardTitleInput = page.locator('input[value="Preparar clase"]').last();
  await expect(cardTitleInput).toBeVisible();
  await cardTitleInput.fill('Preparar clase final');
  await page.keyboard.press('Enter');
  await expect(reviewColumn.getByText('Preparar clase final', { exact: true })).toBeVisible();

  const movedCard = boardCard(page, 'Preparar clase final');
  await movedCard.getByRole('combobox').selectOption({ label: 'Hecho' });
  await expect(boardColumn(page, 'Hecho').getByText('Preparar clase final', { exact: true })).toBeVisible();
  await expect(reviewColumn.getByText('Preparar clase final', { exact: true })).toHaveCount(0);

  await boardColumn(page, 'Hecho').getByText('Preparar clase final', { exact: true }).locator(
    'xpath=ancestor::div[.//select and .//button[@title="Eliminar tarjeta"]][1]'
  ).getByTitle('Eliminar tarjeta').click();
  await expect(page.getByText('Preparar clase final', { exact: true })).toHaveCount(0);

  await reviewColumn.getByTitle('Eliminar columna').click();
  await expect(columnNameInput(page, 'Revisar')).toHaveCount(0);
});
