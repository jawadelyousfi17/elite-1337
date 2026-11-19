import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 45_000, workers: 1,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3399', viewport: { width: 375, height: 812 }, trace: 'retain-on-failure', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: process.env.CI ? 'npm run start -- --hostname 127.0.0.1 --port 3399' : 'npm run dev -- --hostname 127.0.0.1 --port 3399',
    url: 'http://127.0.0.1:3399', timeout: 120_000, reuseExistingServer: false,
    env: { IS_DEMO: '1', AUTH_TRUST_HOST: 'true', AUTH_SECRET: 'browser-fixture-only', DATABASE_URL: '', FORTYTWO_CLIENT_ID: '', FORTYTWO_CLIENT_SECRET: '' },
  },
});
