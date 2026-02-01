import { test, expect } from '@playwright/test';

test('Sidebar Session Creation', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:3011/dashboard');
  
  console.log('Current URL:', page.url());
  
  await page.waitForTimeout(2000);
  
  if (page.url().includes('/login')) {
      console.log('Redirected to login. Attempting to click login if debug button exists?');
      const emailInput = page.getByPlaceholder('usuario@ejemplo.com');
      if (await emailInput.isVisible()) {
        await emailInput.fill('dev@test.com');
        await page.getByPlaceholder('••••••••').fill('password');
        await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
      }
  }
  
  const content = await page.content();
  if (content.includes('MI ASISTENTE')) {
      console.log('Found MI ASISTENTE in content');
  } else {
      console.log('MI ASISTENTE not found in content');
  }

  await expect(page.getByText('MI ASISTENTE')).toBeVisible({ timeout: 15000 });
  
  const addButton = page.locator('button[title="Nueva Sesión"]');
  await expect(addButton).toBeVisible();
  
  page.on('console', msg => console.log(`BROWSER POS: ${msg.text()}`));
  
  console.log('Clicking add session button...');
  await addButton.click();
  
  await expect(page.getByText('Terminal 1')).toBeVisible({ timeout: 5000 });
  
  console.log('Terminal 1 created successfully');
});
