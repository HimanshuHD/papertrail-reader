# Browser validation (#37)

## Current policy (#52)

Automatic Frontend CI runs lint, formatting, pipeline/unit tests, strict types and production/preview build. It does not install browser binaries or OS dependencies and does not run Playwright. Browser installation added in PR #50 repeated on every fresh runner and delayed delivery; #52 removes those automatic steps. npm ci installs only the pinned test-runner package, not Chromium/WebKit binaries. Browser execution remains an explicit command, independent of publishing.

## Explicit browser checks

Run `npm run build`, install Chromium with `npx playwright install --with-deps chromium`, then run `npm run test:e2e` when browser coverage is needed. The repository also provides `.github/workflows/browser-e2e.yml`: it runs only on manual workflow dispatch or when a draft pull request is marked Ready for review. Automatic Frontend CI still does not install browsers. Set `E2E_BASE_PATH` only when validating a prefixed build. Optional WebKit projects use `E2E_WEBKIT=1` after installing WebKit.

The suite keeps the Chromium width matrix at 320/375/768/1024/1440px and expands as interactive product behavior arrives. It covers preserved home, Go to app/direct entry/history, keyboard/theme persistence, both themes, sidebar placement/collapse/selection, disabled actions, readable title width and overflow. It saves home/app screenshots, an HTML report and failure traces locally. Screenshot capture is not a pixel-baseline approval. Config/specs remain strictly type checked; generated reports are ignored.

## Recorded PR #50 evidence

CI 36912595432 passed 15 browser checks before the policy change. Artifact 11187462095 contains both-theme home/app screenshots; representative screenshots were inspected and the narrow toolbar title corrected. The artifact expires after seven days. These recorded results do not imply future commits are browser-tested automatically.

#43 focus/status code is merged in PR #53 and #8 source selection is merged in PR #54. #37 is completed: Browser E2E run 36924070741 on PR #55 passed the Chromium width matrix with keyboard/focus restoration, native directory selection, cancellation, individual-file fallback and discovery-count assertions. Supported-release browser coverage remains #28; optional WebKit is not certification of every Safari/device version. PDF/EPUB reader correctness remains owned by #10/#12.

---

[Previous](issue-policy.md) · [Documentation home](../README.md) · [Next](workflow-audit.md)
