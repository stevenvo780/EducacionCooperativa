import { test, expect } from '@playwright/test';

test('Diagnose Terminal 500 Error', async ({ page }) => {
  // Capture all console logs
  page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
  // Capture all network failures
  page.on('requestfailed', request =>
    console.log(`REQ FAILED: ${request.url()} - ${request.failure()?.errorText}`)
  );
  page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`REQ ERROR STATUS: ${response.url()} returned ${response.status()}`);
      }
  });

  const baseURL = process.env.BASE_URL || 'https://visormarkdown-virid.vercel.app';
  
  await page.goto(`${baseURL}/login`);
  await page.waitForLoadState('networkidle');

  // Register a new random user
  const randomSuffix = Math.floor(Math.random() * 100000);
  const email = `testuser${randomSuffix}@example.com`;
  const password = 'TestPassword123!';

  console.log(`Attempting to register with ${email}`);

  // Switch to register tab
  await page.getByRole('button', { name: 'Registrarse' }).click();
  
  await page.getByPlaceholder('usuario@ejemplo.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  
  // Submit
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();
  
  // Wait for navigation to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('Successfully reached /dashboard');

  // Navigate to terminal
  console.log('Navigating to /dashboard/terminal...');
  await page.goto(`${baseURL}/dashboard/terminal`);
  
  // Allow some time for errors to appear
  await page.waitForTimeout(5000);
  
  // Check for 500 text or typical error indicators
  const content = await page.content();
  if (content.includes('500') || content.includes('Internal Server Error')) {
      console.log('Detected 500 Error on page!');
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'terminal-error.png' });
});
