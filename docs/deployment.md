# Deployment, previews and releases

GitHub Pages is enabled with Source: GitHub Actions. Production is https://himanshuhd.github.io/papertrail-reader/. The repository is currently public, and the website is public; this audit verified the GitHub repository visibility. Do not infer site privacy from repository settings.

Detailed implementation and trust boundaries: [deployment-architecture.md](deployment-architecture.md). Validation evidence: [deployment-verification.md](deployment-verification.md).

## One hostname, separate paths

| Channel           | Path                             | Updates                                      |
| ----------------- | -------------------------------- | -------------------------------------------- |
| Production        | /papertrail-reader/              | Successful website-affecting main builds     |
| PR preview        | /papertrail-reader/preview/pr-N/ | Manual current-green-PR deployment           |
| Closed preview    | Same PR path                     | Styled retirement page linking to production |
| Versioned release | Planned releases/vX.Y.Z/         | Future #32 implementation                    |

## Deploy a preview

1. Open Actions -> Publish website.
2. Choose Run workflow and select main.
3. Enter the open PR number in pr_number, then run.
4. Wait for success and inspect /preview/pr-N/ and its footer/build.json.

The workflow uses the PR number to select the PR's current successful source head. The main branch selection refers to the trusted publisher, not the source being previewed. Open same-repository PRs targeting main are eligible. A feature branch without a PR has no preview.

New PR commits run CI without changing an existing preview. Repeat the manual request after the current head passes CI to update it. If the seven-day artifact has expired, rerun CI first. Blank pr_number republishes main.

The footer links the PR, deployed source branch and commit. A PR build also includes preview-closed.html to review the closed-page design before merging. Closing or merging retires the preview; do not expect manual publishing of a closed PR to work.

## Production and docs-only changes

Merge reviewed website changes with green CI into main. The automatic publisher replaces production while preserving previews. Documentation-only main changes still validate but record publish=false and skip automatic deployment. The final live check of this behavior is the documentation audit PR under #35.

A failed build is not deployed. After merging, verify CI, publisher conclusion, production build.json/deployment.json and preview retirement. Account for Pages propagation and use the deployed SHA, not appearance alone.

## Releases and recovery

#32 remains open for tag validation, immutable version URLs, artifacts/checksums and explicit promotion/rollback. Tags currently do not overwrite the main website. Until that implementation is accepted, rollback is a reviewed revert on main with successful CI and deployment.

GitHub may cancel a pending publisher during overlapping cleanup/production events even with cancel-in-progress:false. #44 tracks durable reconciliation. Check the live source SHA after a burst; retry the relevant CI job if needed. See deployment-architecture.md for observed recovery evidence.

## Base paths and storage

CI supplies Vite base paths with trailing slash. A later custom-domain setup can use PAGES_BASE_PATH=/. Hash routing is implemented in PR #41 merged.

Production and previews share an origin. Theme preference is intentionally shared in PR #41. Future reading positions, bookmarks and document identity must be namespaced by base path so preview experiments cannot overwrite production reading metadata. Do not publish private document fixtures.

## Application version (#47)

package.json is the version source of truth. Vite embeds it at build time; production displays Production · v0.1.0, followed by existing branch/SHA identity. Preview identity retains the linked PR number. Version bumps use reviewed changes and keep package-lock.json synchronized; version labels do not create Git tags or immutable release URLs. Initial foundation changes are recorded in CHANGELOG.md. Tag/promotion automation remains #32.
