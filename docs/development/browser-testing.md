# Browser validation (#37)

## Current policy — #130

Draft PRs do not run application checks. Ready staging-targeted PRs run frontend candidate validation without installing browsers. Staging merges run the reusable Browser E2E workflow against the exact prebuilt staging artifact before deploying. Ready release/* and hotfix/* PRs targeting main run production-candidate Browser E2E on opening, readiness, new commits and reopened-ready events; both shards are required by Candidate validation. Docs-only candidates omit browser acceptance/deployment. Returning to draft cancels prior PR acceptance.

browser-e2e.yml is now reusable workflow_call, not an independently dispatched PR workflow. It downloads candidate-build, verifies the tested tree/channel/run/head/base-path/checksums, and serves those bytes without rebuilding. CI/main manual recovery includes production acceptance; staging manual recovery includes integration acceptance. See [delivery operations](../deployment/publishing.md) for dispatch, bootstrap and owner settings.

## Bounded CI browser environment

Browser E2E uses the official Playwright 1.63.0 Noble container, pinned by image digest and matching the exact `@playwright/test` dependency. Chromium, Firefox, WebKit, their Linux dependencies and Xvfb are preinstalled. The workflow no longer runs `playwright install --with-deps`. Update the image version, digest and `PLAYWRIGHT_IMAGE_VERSION` together when upgrading Playwright. Pipeline checks compare the package and lockfile versions, and a runtime check rejects an installed-package mismatch.

The root container uses `HOME=/root`. Browser launch and Git verification commands also set it explicitly so GitHub's injected `/github/home` cannot give Firefox a home owned by another user. Git trust configuration and subsequent Git/browser processes use the same home. A changed browser environment now receives a five-minute preflight in ready staging PR CI: it runs the pinned image, checks HOME ownership and scoped Git access, installs Openbox through the same bounded helper as Browser E2E, executes the existing three-engine identity script and verifies real Chromium activation/deactivation/return under Xvfb/Openbox using blank pages. Only changes to the browser/CI workflow or probe/evidence/window-manager helpers trigger the probe; unrelated PRs skip it. This is environment validation, not document E2E or Visual QA. Full staging acceptance remains required.

After checkout, a shell step registers only `GITHUB_WORKSPACE` in Git's global `safe.directory` list. Checkout can configure Git using a temporary HOME that differs from subsequent container shell steps. Explicitly registering the workspace in the shell's HOME prevents ownership rejection during `git rev-parse` artifact verification and browser evidence capture. This is a single-path exception; unrelated repositories remain protected, and candidate tree/checksum checks are unchanged.

The container runs setup as root. `scripts/install-browser-window-manager.sh` installs Openbox and required dependencies, excluding recommended packages. It uses temporary, isolated source/index configuration for official Ubuntu HTTPS archive/security repositories (Noble main/universe and updates), retaining Ubuntu archive-keyring signature verification. It does not edit the image’s global sources or include NodeSource. This avoids the image-inherited Azure mirror, whose slow package downloads exhausted both shards in run40286705716 despite fast index downloads. Temporary source/index files are removed on success/failure. HTTPS inactivity waits are limited to30 seconds with one retry; a240-second total process bound sits inside the five-minute step limit. An outage can still fail setup; there is no bypass or unsigned-package fallback. Slow setup therefore fails within its own allowance. The job's 45-minute ceiling leaves room for bounded setup, the full 20-minute browser-test step and two three-minute evidence uploads. Npm installation has its own five-minute limit. GitHub manages container pulls and runner provisioning; a registry outage can still block setup.

Both shards, exact-artifact verification, headed native-focus checks under Xvfb/Openbox, existing Playwright assertions/retries and evidence upload on failure are retained. Visual QA remains independently manual. Switching the CI image requires a real hosted acceptance run; static/local checks do not prove container startup, native focus or all browser engines on GitHub.

Run 39792454994 exposed the setup bottleneck: shard 1 first spent over 18 minutes installing dependencies and the window manager; its second attempt exhausted the 20-minute job while apt was still downloading. Shard 2 passed. Publication correctly stayed blocked. Rerunning that historical workflow uses its original definition and cannot pick up this fix. After merging this PR, verify the new staging delivery. Use the documented manual recovery from current staging if needed, rather than repeatedly rerunning the old attempt.

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
