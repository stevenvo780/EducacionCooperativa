import { expect, test } from '@playwright/test';

import { installBrowserStubs } from './support/mockApp';

test.beforeEach(async ({ page }) => {
  await installBrowserStubs(page);
});

test('landing page renders core navigation and goes to login', async ({ page }) => {
  await page.goto('/');
  const banner = page.getByRole('banner');

  await expect(page.getByRole('heading', { name: /Tu entorno de trabajo/i })).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Características', exact: true })).toBeVisible();
  await expect(banner.getByRole('link', { name: 'Planes', exact: true })).toBeVisible();

  const loginLink = banner.getByRole('link', { name: 'Iniciar Sesión', exact: true });
  await expect(loginLink).toHaveAttribute('href', '/login');
  await Promise.all([
    page.waitForURL(/\/login$/),
    loginLink.click()
  ]);
  await expect(page.getByRole('heading', { name: 'Bienvenido de nuevo' })).toBeVisible();
});

test('docs page expands sections and copies installation commands', async ({ page }) => {
  await page.goto('/docs');

  await expect(page.getByRole('heading', { name: /Documentación/i })).toBeVisible();

  await page.getByRole('button', { name: /Instalación/i }).click();
  await expect(page.getByText('Instalación rápida (una línea)')).toBeVisible();

  const firstCopyButton = page.getByRole('button', { name: 'Copiar' }).first();
  await firstCopyButton.click();
  await expect(page.getByRole('button', { name: 'Copiado' }).first()).toBeVisible();

  const copiedText = await page.evaluate(() => (window as Window & { __copiedText?: string }).__copiedText);
  expect(copiedText).toContain('edu-worker_1.0.10_amd64.deb');
});
