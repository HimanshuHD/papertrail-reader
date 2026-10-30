import { defineConfig } from '@playwright/test'
import path from 'node:path'

const build = process.env.DIAGNOSTIC_BUILD_ROOT
const report = process.env.READER_ACCEPTANCE_REPORT
if (!build || !report) throw new Error('Use npm run test:reader:acceptance')
const engines = (process.env.READER_ACCEPTANCE_ENGINES || 'chromium').split(',')
if (
  new Set(engines).size !== engines.length ||
  engines.some((name) => !['chromium', 'firefox', 'webkit'].includes(name))
)
  throw new Error('READER_ACCEPTANCE_ENGINES must contain unique chromium,firefox,webkit names')

const phase = process.env.READER_ACCEPTANCE_PHASE || 'all'
if (!['all', 'lifecycle', 'functional'].includes(phase))
  throw new Error('READER_ACCEPTANCE_PHASE must be all, lifecycle or functional')

export default defineConfig({
  testDir: './tests',
  testMatch:
    phase === 'lifecycle'
      ? ['reader-acceptance/lifecycle.spec.ts']
      : [
          'reader-acceptance/*.spec.ts',
          'e2e/tab-restoration.spec.ts',
          'e2e/document-sessions.spec.ts',
          'diagnostics/library-access.spec.ts',
          'diagnostics/cleanup.spec.ts',
        ],
  testIgnore: phase === 'functional' ? ['**/reader-acceptance/lifecycle.spec.ts'] : [],
  // Only independent real-time expiry waits overlap. Other acceptance stays serial.
  workers: phase === 'lifecycle' ? engines.length : 1,
  retries: 0,
  timeout: 30000,
  reporter: [['list'], ['json', { outputFile: path.join(report, 'playwright.json') }]],
  outputDir: path.join(report, 'artifacts'),
  use: {
    baseURL: 'http://127.0.0.1:4177',
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    screenshot: 'off',
  },
  projects: engines.map((name) => ({
    name,
    use: {
      browserName: name as 'chromium' | 'firefox' | 'webkit',
      ...(name === 'chromium' && process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } }
        : {}),
    },
  })),
  webServer: {
    command: 'node scripts/serve-diagnostics-preview.mjs diagnostic',
    env: { DIAGNOSTIC_BUILD_ROOT: build },
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
  },
})
