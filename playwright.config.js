import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/dev-server.mjs --demo --port 4173',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
