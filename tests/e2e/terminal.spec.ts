import { test, expect } from '@playwright/test';

test('Terminal connection flow', async ({ page }) => {
  // Enable console logging for debugging
  page.on('console', msg => {
    if (msg.text().includes('TerminalContext') || msg.text().includes('Status')) {
      console.log('Browser:', msg.text());
    }
  });
  page.on('pageerror', err => console.error('Browser Error:', err.message));
  
  // 1. Navigate to Dashboard
  await page.goto('http://localhost:3011/dashboard');
  await page.waitForLoadState('domcontentloaded');
  
  // 2. Wait for the dashboard to render
  await page.waitForTimeout(3000);
  
  // 3. Take screenshot for debugging
  await page.screenshot({ path: 'test-results/debug-dashboard.png' });
  
  // 4. Wait for Espacio Personal
  await expect(page.getByText('MI ASISTENTE')).toBeVisible({ timeout: 30000 });
  
  // 5. Wait for MI ASISTENTE section
  await expect(page.getByText('MI ASISTENTE')).toBeVisible({ timeout: 10000 });
  
  // 6. Check what we see in the terminal section
  const conectando = await page.getByText('Conectando...').isVisible().catch(() => false);
  const sinSesiones = await page.getByText('Sin sesiones activas').isVisible().catch(() => false);
  console.log('UI State - Conectando:', conectando, 'Sin sesiones:', sinSesiones);
  
  // 7. Wait for connection to complete
  await expect(page.getByText('Sin sesiones activas')).toBeVisible({ timeout: 20000 });
  
  // 8. Create a new session
  console.log('Looking for new session button...');
  const plusButtons = await page.locator('button').filter({ has: page.locator('svg.lucide-plus') }).all();
  console.log(`Found ${plusButtons.length} buttons with plus icon`);
  
  // Try to find the specific button near "MI ASISTENTE"
  const newSessionButton = page.locator('button[title="Nueva Sesión"]').first();
  const buttonVisible = await newSessionButton.isVisible().catch(() => false);
  console.log(`New Session button visible: ${buttonVisible}`);
  
  if (!buttonVisible) {
    // Fallback: find button in MI ASISTENTE section
    const asistentSection = page.locator('text=MI ASISTENTE').locator('..').locator('..');
    await asistentSection.screenshot({ path: 'test-results/asistente-section.png' });
  }
  
  await newSessionButton.click();
  console.log('Clicked new session button');
  
  // 9. Wait for session to be created
  await expect(page.getByText('Terminal 1')).toBeVisible({ timeout: 15000 });
  
  // 10. Click on the session to open terminal
  await page.getByText('Terminal 1').click();
  
  // 11. Verify terminal is mounted
  await expect(page.locator('.xterm')).toBeVisible({ timeout: 10000 });
  
  console.log('✅ Terminal connected successfully');
});
