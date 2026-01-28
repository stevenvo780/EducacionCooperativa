import { test, expect } from '@playwright/test';

test('Home page loads and has title', async ({ page }) => {
  await page.goto('/');
  // El titulo por defecto de Vite puede ser "Vite + React" o "web" si no se ha configurado
  await expect(page).toHaveTitle(/web|Vite \+ React/);
});

test('API Health Check', async ({ request }) => {
  const response = await request.get('http://localhost:3001/api/health');
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(data.status).toBe('ok');
});
