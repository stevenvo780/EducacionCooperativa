import { test, expect } from '@playwright/test';

test('Terminal connection flow', async ({ page }) => {
  // 1. Navigate to Dashboard
  // Uses mock auth so should auto-login or have dev bypass
  await page.goto('http://localhost:3011/dashboard');
  
  // 2. Wait for loading to finish
  await expect(page.locator('text=Espacio Personal')).toBeVisible({ timeout: 10000 });
  
  // 3. Open Terminal
  await page.getByText('Mi Asistente +').click();
  
  // 4. Check for Terminal Window in Mosaic
  // The terminal window title
  await expect(page.locator('.mosaic-window-title', { hasText: 'Terminal' }).first()).toBeVisible();

  // 5. Verify Online Status
  // "Asistente Conectado" appears when status === 'online'
  // Or if it's already active, it shows the terminal (xterm)
  // Let's check for the success state or the error state
  
  const connected = page.getByText('Asistente Conectado');
  const terminalCanvas = page.locator('.xterm-screen'); // Xterm canvas
  const disconnected = page.getByText('Asistente Desconectado');
  
  // Wait for one of these states
  await Promise.race([
      connected.waitFor({ state: 'visible' }),
      terminalCanvas.waitFor({ state: 'visible' }),
      disconnected.waitFor({ state: 'visible' })
  ]);
  
  if (await disconnected.isVisible()) {
      throw new Error('Test Failed: Assistant is Disconnected');
  }

  // If connected button exists, click it to enter terminal
  if (await connected.isVisible()) {
      await page.getByRole('button', { name: 'Abrir Terminal' }).click();
  }
  
  // Final verification: Xterm is visible
  await expect(page.locator('.xterm-screen')).toBeVisible();
  
  console.log('✅ Terminal connected successfully');

  // 6. Test Interactive Command
  // Type 'echo "Hello World"'
  const terminal = page.locator('.xterm-rows');
  await page.keyboard.type('echo "Hello World"');
  await page.keyboard.press('Enter');

  // Expect output
  await expect(page.locator('.xterm-rows')).toContainText('Hello World', { timeout: 5000 });
});
