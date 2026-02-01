import { test, expect } from '@playwright/test';

test('Terminal connection flow', async ({ page }) => {
  page.on('console', msg => {
    if (msg.text().includes('TerminalContext') || msg.text().includes('Status')) {
      console.log('Browser:', msg.text());
    }
  });
  page.on('pageerror', err => console.error('Browser Error:', err.message));
  
  await page.goto('http://localhost:3011/dashboard');
  await page.waitForLoadState('domcontentloaded');
  
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'test-results/debug-dashboard.png' });
  
  await expect(page.getByText('MI ASISTENTE')).toBeVisible({ timeout: 30000 });
  
  await expect(page.getByText('MI ASISTENTE')).toBeVisible({ timeout: 10000 });
  
  const conectando = await page.getByText('Conectando...').isVisible().catch(() => false);
  const sinSesiones = await page.getByText('Sin sesiones activas').isVisible().catch(() => false);
  console.log('UI State - Conectando:', conectando, 'Sin sesiones:', sinSesiones);
  
  await expect(page.getByText('Sin sesiones activas')).toBeVisible({ timeout: 20000 });
  
  console.log('Looking for new session button...');
  const plusButtons = await page.locator('button').filter({ has: page.locator('svg.lucide-plus') }).all();
  console.log(`Found ${plusButtons.length} buttons with plus icon`);
  
  const newSessionButton = page.locator('button[title="Nueva Sesión"]').first();
  const buttonVisible = await newSessionButton.isVisible().catch(() => false);
  console.log(`New Session button visible: ${buttonVisible}`);
  
  if (!buttonVisible) {
    const asistentSection = page.locator('text=MI ASISTENTE').locator('..').locator('..');
    await asistentSection.screenshot({ path: 'test-results/asistente-section.png' });
  }
  
  await newSessionButton.click();
  console.log('Clicked new session button');
  
  await expect(page.getByText('Terminal 1')).toBeVisible({ timeout: 15000 });
  
  await page.getByText('Terminal 1').click();
  
  await expect(page.locator('.xterm')).toBeVisible({ timeout: 10000 });
  
  console.log('✅ Terminal connected successfully');
});
