import { defineConfig } from '@playwright/test'
const base = process.env.E2E_BASE_PATH || '/'
export default defineConfig({
  testDir: './tests/visual',
  testMatch: '**/*.spec.ts',
  outputDir: `visual-results/${process.env.VISUAL_RESULT_NAME || 'assertions'}`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/baselines/{projectName}/{arg}{ext}',
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      threshold: 0.15,
      maxDiffPixels: 20,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: `visual-report/${process.env.VISUAL_RESULT_NAME || 'assertions'}`,
        open: 'never',
      },
    ],
    [
      'json',
      { outputFile: `visual-evidence/${process.env.VISUAL_RESULT_NAME || 'assertions'}.json` },
    ],
  ],
  use: {
    baseURL: `http://127.0.0.1:4175${base}`,
    browserName: 'chromium',
    channel: 'chromium',
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    ...[375, 1440, 1586].flatMap((width) =>
      (['light', 'dark'] as const).map((colorScheme) => ({
        name: `chromium-${width}-${colorScheme}`,
        use: { viewport: { width, height: width === 1586 ? 992 : 900 }, colorScheme },
      })),
    ),
  ],
  webServer: {
    command: 'node scripts/visual-qa-server.mjs',
    url: `http://127.0.0.1:4175${base}`,
    reuseExistingServer: false,
  },
})
