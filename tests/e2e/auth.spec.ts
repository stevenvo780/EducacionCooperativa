import { expect, test } from '@playwright/test';

import {
  TEST_USER,
  gotoDashboard,
  installBrowserStubs,
  installMockApi
} from './support/mockApp';

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
});

test('login page shows API errors and allows switching to password reset view', async ({ page }) => {
  await installMockApi(page, { loginShouldFail: true });
  await page.goto('/login');

  await page.getByPlaceholder('usuario@ejemplo.com').fill(TEST_USER.email);
  await page.getByPlaceholder('••••••••').fill('incorrecta');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page.getByText('Credenciales invalidas')).toBeVisible();

  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();

  await page.getByRole('button', { name: /Volver al inicio de sesión/i }).click();
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
});

test('login with email reaches the mocked dashboard', async ({ page }) => {
  await installMockApi(page);
  await page.goto('/login');

  await page.getByPlaceholder('usuario@ejemplo.com').fill(TEST_USER.email);
  await page.getByPlaceholder('••••••••').fill('secreta');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('agora_user')))
    .not.toBeNull();
  await gotoDashboard(page);
  await expect(page.getByRole('button', { name: /Espacio Personal/i })).toBeVisible();
  await expect(page.getByText('Documento inicial.md')).toBeVisible();
});

test('register flow creates an insecure session and redirects to dashboard', async ({ page }) => {
  await installMockApi(page);
  await page.goto('/login');

  await page.getByRole('button', { name: 'Registrarse', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();

  await page.getByPlaceholder('usuario@ejemplo.com').fill('nuevo@cooperativa.test');
  await page.getByPlaceholder('••••••••').fill('secreta');
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('button', { name: /Espacio Personal/i })).toBeVisible();
});
