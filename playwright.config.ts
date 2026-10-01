import { defineConfig } from '@playwright/test'

const base = process.env.E2E_BASE_PATH || '/'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:4174${base}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    ...[320, 375, 768, 1024, 1440].map((width) => ({
      name: `chromium-${width}`,
      use: { browserName: 'chromium' as const, viewport: { width, height: 900 } },
    })),
    ...[375, 1440].map((width) => ({
      name: `webkit-${width}`,
      use: { browserName: 'webkit' as const, viewport: { width, height: 900 } },
    })),
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port 4174 --base ${base}`,
    url: `http://127.0.0.1:4174${base}`,
    reuseExistingServer: !process.env.CI,
  },
})
