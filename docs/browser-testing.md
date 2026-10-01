# Browser validation (#37)

Frontend CI installs pinned @playwright/test and runs npx playwright install --with-deps chromium webkit on Ubuntu. The browser checks run after the production/preview build and before web-build upload, so failed browser acceptance blocks publication. Playwright's web server serves dist with the same E2E_BASE_PATH chosen by the build step. No separate test-only website build is used.

## Current shell coverage

Three browser tests run in seven projects (21 cases): Chromium at 320, 375, 768, 1024 and 1440px; WebKit at 375 and 1440px. Coverage includes preserved home content, Go to app, direct app entry, browser history, keyboard entry/theme activation, persisted appearance, both themes, responsive sidebar placement, collapse/restore with selected sample retained, disabled unavailable actions and horizontal overflow.

Each project saves home/app screenshots in Light and Dark. Download the browser-review artifact from the Frontend CI run (seven-day retention); open playwright-report/index.html to inspect screenshots and test results. test-results contains attachments plus screenshots/traces for failures. Screenshots support human design review; they are not pixel-baseline approvals.

Local commands: npm run build, npx playwright install --with-deps chromium webkit, npm run test:e2e. Set E2E_BASE_PATH when the build uses a production/preview prefix. npm run check covers unit/type/lint checks; test:e2e requires installed browsers and the built site. Browser config/specs are included in strict TypeScript checks. Generated reports/results are ignored.

## Remaining scope

#37 remains open for full #43 focus/status acceptance and #8 file/directory selection, fallback and error paths. Firefox and real Safari/device validation remain release-browser scope #28. These synthetic WebKit tests do not certify every Safari version. Sample documents are layout metadata only; no file parsing or reader correctness is claimed.
