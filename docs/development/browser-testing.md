# Browser validation (#37)

## Current policy — #130

Draft PRs do not run application checks. Ready staging-targeted PRs run frontend candidate validation without installing browsers. Staging merges run the reusable Browser E2E workflow against the exact prebuilt staging artifact before deploying. Ready release/* and hotfix/* PRs targeting main run production-candidate Browser E2E on opening, readiness, new commits and reopened-ready events; both shards are required by Candidate validation. Docs-only candidates omit browser acceptance/deployment. Returning to draft cancels prior PR acceptance.

browser-e2e.yml is now reusable workflow_call, not an independently dispatched PR workflow. It downloads candidate-build, verifies the tested tree/channel/run/head/base-path/checksums, and serves those bytes without rebuilding. CI/main manual recovery includes production acceptance; staging manual recovery includes integration acceptance. See [delivery operations](../deployment/publishing.md) for dispatch, bootstrap and owner settings.

## Local browser checks

For a local root build, run npm run build, install engines with npx playwright install --with-deps chromium firefox webkit, then npm run test:e2e. CI also installs openbox and uses Xvfb for native window activation. Local browser binaries and OS dependencies are separate from npm ci. For a prefixed candidate, use its compiled base path as E2E_BASE_PATH and copy that channel artifact into dist; do not rebuild another candidate while claiming the same artifact acceptance. Staging database fixture hooks use the staging namespace; production retains legacy names.

The suite keeps the Chromium width matrix at 320/375/768/1024/1440px and expands as interactive product behavior arrives. It covers preserved home, Go to app/direct entry/history, keyboard/theme persistence, both themes, sidebar placement/collapse/selection, disabled actions, readable title width and overflow. It saves home/app screenshots, an HTML report and failure traces locally. Screenshot capture is not a pixel-baseline approval. Config/specs remain strictly type checked; generated reports are ignored.

## Release evidence identity — #134

The release workflow records the candidate source SHA, tested PR merge checkout, exact Chromium version, Node/platform and run ID in `browser-evidence/environment.json`. A JSON reporter records machine-readable outcomes in `browser-evidence/results.json`. Full `browser-review` and compact `browser-summary` artifacts retain reports/screenshots/failure traces for 30 days with distinct run-attempt names; candidate/promotion artifacts also retain 30 days. Curated accepted screenshots are saved with the evidence document. Capture awaits finite page animations; perpetual loading spinners remain visible.

The two costly PDF regressions (1,001 pages and native persisted handle recovery) run once at 1440px; their four duplicate viewport cases each are intentionally skipped. EPUB fixtures run at every width. Headless Linux Chromium and viewport emulation do not certify browser products or real devices; wider release support remains #28.

## Recorded PR #50 evidence

CI 36912595432 passed 15 browser checks before the policy change. Artifact 11187462095 contains both-theme home/app screenshots; representative screenshots were inspected and the narrow toolbar title corrected. The artifact expires after seven days. These recorded results do not imply future commits are browser-tested automatically.

#43 focus/status code is merged in PR #53 and #8 source selection is merged in PR #54. #37 is completed: Browser E2E run 36924070741 on PR #55 passed the Chromium width matrix with keyboard/focus restoration, native directory selection, cancellation, individual-file fallback and discovery-count assertions. Supported-release browser coverage remains #28; optional WebKit is not certification of every Safari/device version. PDF/EPUB reader correctness remains owned by #10/#12.

---

[Previous](issue-policy.md) · [Documentation home](../README.md) · [Next](workflow-audit.md)
