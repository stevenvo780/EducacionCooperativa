import { test, expect } from '@playwright/test';
import fs from 'fs';

test('Manual Check', async ({ page }) => {
  await page.goto('http://localhost:3020/');
  await page.evaluate(() => {
    localStorage.setItem('agora_user', JSON.stringify({
      uid: 'test-user-123',
      email: 'test@example.com',
      displayName: 'Test User'
    }));
    localStorage.setItem('agora_user_email', 'test@example.com');
  });
  await page.goto('http://localhost:3020/dashboard');
  
  // Wait for our mock document
  await page.getByText('Documento de Prueba.md').click();
  
  // Wait for editor
  await page.waitForTimeout(2000);

  // Ensure we are in Split View (Editor + Preview) so highlighting works
  // The 'Reset Layout' button sets the layout to split 50/50
  const resetLayoutBtn = page.getByRole('button', { name: 'Reset Layout' });
  if (await resetLayoutBtn.isVisible()) {
    await resetLayoutBtn.click();
    await page.waitForTimeout(1000); // Wait for re-layout
  } else {
     console.log('Reset Layout button not visible, possibly already in correct mode or toolbar hidden');
  }
  
  // Find Search Input in Toolbar
  const searchInput = page.locator('input[placeholder="Buscar en documento..."]');
  await expect(searchInput).toBeVisible();
  
  // Type search term
  await searchInput.fill('prueba');
  await page.waitForTimeout(2000); // Wait for highlight debounce and render
  
  const html = await page.content();
  fs.writeFileSync('dashboard_final_dump.html', html);
  await page.screenshot({ path: 'dashboard_final.png' });
  
  // Check highlight count
  const count = await page.locator('mark.search-highlight').count();
  console.log('Highlight count:', count);
  
  // Verify navigation buttons are enabled/working
  const nextBtn = page.locator('button[title="Siguiente"]');
  await expect(nextBtn).toBeVisible();
  await nextBtn.click();
  
  if (count === 0) throw new Error('No highlights found');
});
