# Deployment, previews and releases

## Hosting decision and prerequisites

GitHub Pages was selected. The repository stays private; the built website is normally public. Pages for a private repository requires an eligible GitHub plan. Enable Settings -> Pages -> Build and deployment -> Source: GitHub Actions. Keep the github-pages environment restricted to main: publishing runs from main even for PR artifacts. The connected tools do not expose Pages settings, so enablement/live URL verification remains pending in #31.

Expected default URL after successful deployment: https://himanshuhd.github.io/papertrail-reader/

## One hostname, separate paths

| Channel            | Path                                        | Updates                                            |
| ------------------ | ------------------------------------------- | -------------------------------------------------- |
| Main website       | /papertrail-reader/                         | Every successful website-affecting main build      |
| PR preview         | /papertrail-reader/preview/pr-N/            | On-demand successful build of an open same-repo PR |
| Closed preview     | Same PR path                                | Retired page linking to main, avoiding a 404       |
| Versioned releases | Planned /papertrail-reader/releases/vX.Y.Z/ | Separate release implementation #32                |

PR updates run CI without changing the preview. No shared develop branch is required. Open a draft PR early; its URL stays stable; manually redeploy when a review checkpoint is ready. A feature branch with no PR gets no preview. PRs into an integration feature branch are not published by default: use a PR to main for this workflow.

## Workflow design

Frontend CI installs from the lockfile, runs strict type/build validation and pipeline tests, builds with the correct production/preview base path, and uploads web-build with source/run identity. It has read-only repository permissions.

Publish website runs from main on successful Frontend CI workflow completion. It downloads the artifact, verifies identity, rejects fork/unrelated builds and stale PR heads, then combines it with pages-state. Main builds preserve previews; preview builds preserve main and other previews. A serialized publisher prevents cross-channel updates from racing. Older production runs cannot replace newer production state. The state branch is generated output, not source for development.

Closed PRs trigger a lightweight CI retirement marker; its successful workflow completion retires the preview from the trusted main publisher. Manual Publish website accepts pr_number for an open same-repo PR with current green CI; blank uses the latest successful main CI build, useful after Pages is first enabled. Do not run artifacts as scripts in the publisher; it executes only the assembly script from main.

Actions-generated pages-state commits do not recursively start CI. Custom workflow deployment uses official upload-pages-artifact/deploy-pages actions; it does not rely on Pages rebuilding bot branch commits.

The first live preview becomes available after these publisher workflows land on main and Pages is enabled. The pipeline PR itself can validate builds and aggregation before that, but cannot claim a live preview yet.

## Release policy

While the app is being built, main is the continuously deployed website. Merge only reviewed changes with green CI. A failed CI build is never published; a publishing failure leaves the previous live site available.

For a release: finish acceptance criteria, update package version and release notes in a PR, merge, then tag the reviewed commit (v0.1.0, v0.1.1, etc.). #32 will implement tag checks, artifacts/checksums, immutable version URLs and explicit stable-release promotion/rollback. Tags currently do not overwrite the main website; do not claim release automation is implemented yet.

Until version promotion exists, rollback is a reviewed revert on main followed by green CI and automatic deployment. Do not force-push main to roll back.

## Base paths, router and storage

Default Vite base is supplied at build time. If a custom root domain is configured later, set repository variable PAGES_BASE_PATH to /. Include trailing slash. SPA routes should use hash history on Pages unless a tested routing fallback is implemented.

Production and previews share an origin. Namespace future IndexedDB/localStorage by import.meta.env.BASE_URL so previews cannot overwrite production reading metadata (#6/#13). Do not publish private sample documents into builds.

## Validation and status

Tests cover coexistence, preserved previews after main updates, stale-production protection, retirement pages and invalid PR paths. Actual Pages activation, production URL, two preview URLs and retirement must be checked after enablement; #31 remains open until that evidence is recorded.

## On-demand preview instructions (#35)

Actions -> Publish website -> Run workflow -> select main -> enter pr_number -> Run workflow. Blank PR number republishes main. Deploy only the PR's current successful CI SHA; no fallback to older green commits. Failed/stale/closed/fork requests do not publish. If the 7-day build artifact has expired, rerun CI on the current commit, then deploy.

Read /preview/pr-N/build.json to verify the exact deployed SHA. Subsequent PR pushes keep the preview unchanged until another manual request. Documentation-only main commits still run validation but mark their build publish=false; automatic publishing skips them. Explicit manual main republish remains available. Paths outside the documentation allowlist are treated as website-affecting.

Closed-unmerged PR correction: commit association can omit these PRs, so the publisher falls back to all PRs for the exact same-repo source branch and SHA. Issue #35 includes live retirement revalidation.
