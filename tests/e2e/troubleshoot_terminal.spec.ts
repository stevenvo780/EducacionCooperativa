import { test, expect } from '@playwright/test';

test('Diagnose Terminal Socket Connection', async ({ page }) => {
  // Capture all console logs - especially the TerminalController logs
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`BROWSER: ${text}`);
  });
  
  // Capture all network failures
  page.on('requestfailed', request =>
    console.log(`REQ FAILED: ${request.url()} - ${request.failure()?.errorText}`)
  );

  const baseURL = process.env.BASE_URL || 'http://localhost:3011';
  
  // In mock mode, go directly to dashboard - auto-login will happen
  console.log('Navigating directly to dashboard (mock auth will auto-login)...');
  await page.goto(`${baseURL}/dashboard`);
  await page.waitForLoadState('domcontentloaded');
  
  console.log('At dashboard, waiting for socket connection and worker-status event...');
  
  // Wait longer for socket to connect and receive events
  await page.waitForTimeout(5000);
  
  // Print all captured console logs
  console.log('\n=== ALL BROWSER CONSOLE LOGS ===');
  consoleLogs.forEach(log => console.log(log));
  console.log('=== END BROWSER LOGS ===\n');
  
  // Check UI state
  const conectando = await page.getByText('Conectando...').count();
  const sinSesiones = await page.getByText('Sin sesiones activas').count();
  const miAsistente = await page.getByText('MI ASISTENTE').count();
  
  console.log(`UI State - Conectando: ${conectando > 0}, Sin sesiones activas: ${sinSesiones > 0}, Mi Asistente: ${miAsistente > 0}`);
  
  // Look for TerminalController log specifically
  const socketConnectedLog = consoleLogs.find(log => log.includes('Socket connected to hub'));
  const workerStatusLog = consoleLogs.find(log => log.includes('worker-status event received'));
  const statusChangeLog = consoleLogs.find(log => log.includes('Status change:'));
  
  console.log(`Socket logs found - Connected: ${!!socketConnectedLog}, Worker status: ${!!workerStatusLog}, Status change: ${!!statusChangeLog}`);
  
  // Check if worker-status 'online' was received
  if (workerStatusLog) {
    console.log('SUCCESS: worker-status event was received by client!');
  } else if (socketConnectedLog) {
    console.log('PARTIAL: Socket connected but worker-status not received');
  } else {
    console.log('FAIL: Socket did not connect');
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'terminal-socket-debug.png' });
  
  // Verify the terminal connection is online (shows "Sin sesiones activas" instead of "Conectando...")
  // This means status === 'online'
  expect(sinSesiones).toBeGreaterThan(0);
});
