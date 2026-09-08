import { defineConfig, devices } from '@playwright/test';

// Serial + one worker: the suite shares a single seeded SQLite database.
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /responsive\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'npm run dev --prefix backend',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // Production build, not `next dev`: the dev server's incremental cache
      // corrupts itself under a full suite run and starts serving 500s.
      command: 'npm run build --prefix frontend && npm run start --prefix frontend',
      url: 'http://localhost:3000/login',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
