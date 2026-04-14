import { defineConfig, devices } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  // Sequential execution to avoid DB state conflicts between tests
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Pin to a known-valid IANA timezone so the Timezone Select always has a
    // recognisable initial value regardless of the CI runner's system locale.
    // (On Ubuntu CI, Intl.DateTimeFormat returns 'UTC' which can render empty
    // in Mantine's searchable Select.)
    timezoneId: 'Europe/London',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the frontend dev server; reuse an already-running instance locally
  webServer: {
    command: 'pnpm --filter @booking/frontend dev',
    url: FRONTEND_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  // Seed the e2e-demo calendar before all tests
  globalSetup: './global-setup.ts',
});
