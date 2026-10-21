import { defineConfig } from '@playwright/test'
import path from 'node:path'
const builds = process.env.DIAGNOSTIC_BUILD_ROOT
const report = process.env.DIAGNOSTIC_REPORT_DIR
if (!builds || !report) throw new Error('Use npm run test:diagnostics:acceptance')
const engines = (process.env.DIAGNOSTIC_ENGINES || 'chromium').split(',') as (
  'chromium' | 'firefox' | 'webkit'
)[]
const quote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`
export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  timeout: 180000,
  reporter: [['list'], ['json', { outputFile: path.join(report, 'playwright.json') }]],
  outputDir: path.join(report, 'artifacts'),
  use: {
    baseURL: 'http://127.0.0.1:4177',
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshot: 'off',
  },
  projects: engines.map((browserName) => ({
    name: browserName,
    testMatch: ['e2e/diagnostics.spec.ts', 'diagnostics/*.spec.ts'],
    use: {
      browserName,
      ...(browserName === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
        : {}),
    },
  })),
  webServer: [
    ['production', 4176],
    ['diagnostic', 4177],
  ].map(([mode, port]) => ({
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --outDir ${quote(path.join(builds, String(mode)))}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  })),
})
