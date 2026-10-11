import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:4321' },
  webServer: process.env.BASE_URL ? undefined : {
    // Keep the server in the foreground so Playwright owns its teardown.
    command: 'npm run preview -- --ignore-lock',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 15'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
});
