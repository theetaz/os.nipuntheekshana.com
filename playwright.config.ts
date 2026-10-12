import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:4357' },
  webServer: process.env.BASE_URL ? undefined : [{
    command: 'npm run dev:worker',
    url: 'http://localhost:8788/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  }, {
    // Keep the server in the foreground so Playwright owns its teardown.
    command: 'npm run preview -- --ignore-lock',
    url: 'http://localhost:4357',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  }],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
