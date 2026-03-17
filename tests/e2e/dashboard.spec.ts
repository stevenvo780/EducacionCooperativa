import { expect, test } from '@playwright/test';

import {
  TEST_USER,
  gotoDashboard,
  installBrowserStubs,
  installInsecureAuth,
  installMockApi
} from './support/mockApp';

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
  await installInsecureAuth(page);
});

test('dashboard switches workspaces and creates a new workspace', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page);

  await expect(page.getByRole('button', { name: /Espacio Personal/i })).toBeVisible();
  await expect(page.getByText('Documento inicial.md')).toBeVisible();

  await page.getByRole('button', { name: /Espacio Personal/i }).click();
  await page.getByText('Historia Cooperativa').click();

  await expect(page).toHaveURL(/workspaceId=ws-shared/);
  await expect(page.getByRole('button', { name: /Historia Cooperativa/i })).toBeVisible();
  await expect(page.getByText('Bibliografia.md')).toBeVisible();

  await page.getByRole('button', { name: /Historia Cooperativa/i }).click();
  await page.getByRole('button', { name: 'Nuevo Espacio' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo Espacio de Trabajo' })).toBeVisible();

  await page.getByPlaceholder('Nombre, ej: Grupo Física').fill('Equipo QA');
  await page.getByRole('button', { name: 'Crear' }).click();

  await expect(page).toHaveURL(/workspaceId=ws-created-1/);
  await expect(page.getByRole('button', { name: /Equipo QA/i })).toBeVisible();
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
  await page.getByRole('button', { name: 'Aceptar' }).click();

  await page.getByTitle('Miembros').click();
  await expect(page.getByRole('heading', { name: 'Miembros del Espacio' })).toBeVisible();
  await page.getByTitle('Eliminar miembro').click();
  await expect(page.getByText('Eliminar miembro')).toBeVisible();
  const removeMemberDialog = page.locator('div').filter({
    has: page.getByText('¿Estás seguro de que quieres eliminar a este miembro del espacio de trabajo?')
  }).first();
  await removeMemberDialog.locator('button').filter({ hasText: /^Eliminar$/ }).click();
  await expect(page.getByText('Miembro eliminado')).toBeVisible();
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByText('Miembros (1)')).toBeVisible();
});

test('dashboard creates documents and folders and uses sidebar and quick search', async ({ page }) => {
  await installMockApi(page);
  await gotoDashboard(page, 'ws-shared');
  const header = page.getByRole('banner');

  await header.getByRole('button', { name: 'Nuevo archivo' }).click();
  await expect(page.getByText('Sin título')).toBeVisible();

  await header.getByRole('button', { name: 'Nueva carpeta' }).click();
  await page.getByPlaceholder('Nombre de carpeta').fill('Apuntes');
  await page.getByRole('button', { name: 'Aceptar' }).click();
  await expect(page.getByRole('button', { name: 'Apuntes', exact: true })).toBeVisible();

  const sidebarSearch = page.getByPlaceholder('Buscar...').first();
  await sidebarSearch.fill('memoria');
  await expect(page.getByText(/^1 de \d+$/)).toBeVisible();
  await expect(page.getByText('Memoria cooperativa.md')).toBeVisible();
  await sidebarSearch.clear();

  await page.keyboard.press('Control+P');
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

  await page.getByTitle('Tablero').click();
  await expect(page.getByRole('heading', { name: 'Tablero' })).toBeVisible();
});
