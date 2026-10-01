# Browser validation (#37)

## Current policy (#52)

Automatic Frontend CI runs lint, formatting, pipeline/unit tests, strict types and production/preview build. It does not install browser binaries or OS dependencies and does not run Playwright. Browser installation added in PR #50 repeated on every fresh runner and delayed delivery; #52 removes those automatic steps. npm ci installs only the pinned test-runner package, not Chromium/WebKit binaries. Browser execution remains an explicit command, independent of publishing.

## Explicit browser checks

Run npm run build, install Chromium with npx playwright install --with-deps --only-shell chromium, then npm run test:e2e when browser coverage is needed. Set E2E_BASE_PATH to match a build made with a production/preview prefix. On machines with an installed browser, repeat tests without reinstalling it. Optional WebKit projects use E2E_WEBKIT=1 after installing WebKit. A future manual GitHub workflow can be implemented if requested; none is currently configured.

The suite has 15 default Chromium cases at 320/375/768/1024/1440px. It covers preserved home, Go to app/direct entry/history, keyboard/theme persistence, both themes, sidebar placement/collapse/selection, disabled actions, readable title width and overflow. It saves home/app screenshots, an HTML report and failure traces locally. Screenshot capture is not a pixel-baseline approval. Config/specs remain strictly type checked; generated reports are ignored.

## Recorded PR #50 evidence

CI 36912595432 passed 15 browser checks before the policy change. Artifact 11187462095 contains both-theme home/app screenshots; representative screenshots were inspected and the narrow toolbar title corrected. The artifact expires after seven days. These recorded results do not imply future commits are browser-tested automatically.

#37 stays open for #43 full focus/status and #8 file/directory selection/fallback/error paths. Supported-release browser coverage remains #28; optional WebKit is not certification of every Safari/device version. File parsing and reader correctness are not claimed by the shell suite.
