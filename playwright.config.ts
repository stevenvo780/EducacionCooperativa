import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  workers: 1,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  use: {
    baseURL: 'http://127.0.0.1:3011',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'bash -lc "rm -rf .next && npm run dev -- --port 3011"',
    url: 'http://127.0.0.1:3011',
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_ALLOW_INSECURE_AUTH: 'true',
      NEXT_PUBLIC_NEXUS_URL: 'http://127.0.0.1:9'
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
