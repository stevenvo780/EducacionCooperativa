import { test, expect } from '@playwright/test';

test('Sidebar Session Creation', async ({ page }) => {
  // Capture console logs
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  // Navigate to Dashboard
  await page.goto('http://localhost:3011/dashboard');
  
  console.log('Current URL:', page.url());
  
  // Wait a bit to let things settle
  await page.waitForTimeout(2000);
  
  if (page.url().includes('/login')) {
      console.log('Redirected to login. Attempting to click login if debug button exists?');
      // Try filling a mock login if inputs exist
      const emailInput = page.getByPlaceholder('usuario@ejemplo.com');
      if (await emailInput.isVisible()) {
        await emailInput.fill('dev@test.com');
        await page.getByPlaceholder('••••••••').fill('password');
        await page.getByRole('button', { name: 'Iniciar Sesión' }).click();
      }
      // If mock auth is used, user might be null initially?
      // AuthContext sets it inside useEffect.
  }
  
  // Dump validation
  const content = await page.content();
  if (content.includes('MI ASISTENTE')) {
      console.log('Found MI ASISTENTE in content');
  } else {
      console.log('MI ASISTENTE not found in content');
      // console.log(content); // Too verbose
  }

  // Wait for "MI ASISTENTE" to verify we are logged in and dashboard loaded
  await expect(page.getByText('MI ASISTENTE')).toBeVisible({ timeout: 15000 });
  
  // Find the Plus button in the "MI ASISTENTE" section
  // It is a button with title "Nueva Sesión"
  const addButton = page.locator('button[title="Nueva Sesión"]');
  await expect(addButton).toBeVisible();
  
  // Check console for logs
  page.on('console', msg => console.log(`BROWSER POS: ${msg.text()}`));
  
  // Click it
  console.log('Clicking add session button...');
  await addButton.click();
  
  // Wait for a session to appear
  // Session name logic: `Sesión ${sessions.length + 1}`
  // But context renames it to `Terminal 1`
  await expect(page.getByText('Terminal 1')).toBeVisible({ timeout: 5000 });
  
  console.log('Terminal 1 created successfully');
});
