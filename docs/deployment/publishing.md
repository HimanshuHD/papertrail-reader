# Deployment, previews and releases

## Publication recovery — #44

The shared publisher uses `concurrency.queue: max` with `cancel-in-progress: false`. GitHub retains up to 100 pending publishers rather than replacing the single pending run. Queue capacity, manual cancellation and deployment failures still require reconciliation; queue order is not a source-freshness guarantee. See [GitHub concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

On main, a scheduled recovery runs at minutes 17 and 47 each hour. GitHub schedules are best effort and can be delayed or dropped; this is not a delivery-time SLA. Recovery examines up to 300 completed main push runs of `ci.yml`, requires a successful **Validate and build website** job and an unexpired `web-build`, and applies the existing same-repository/current-main or verified documentation-only-descendant checks. A cancelled or failed overall CI run can therefore recover a successful frontend artifact without accepting a failed frontend build. Downloaded SHA/run identity is still verified before copying static files.

Recovery also retires closed published previews while preserving production and open previews. An aggregate-only reconciliation needs no build artifact. Stale production requests cannot overwrite newer production, but their retirement work is retained. Documentation-only pushes still skip their dependent publisher; scheduled reconciliation may publish a newer validated artifact or cleanup independently.

`pages-state/.deployment-state.json` records desired aggregate content. `.publication-receipt.json` is written **only after** successful Pages deployment and records the acknowledged aggregate state. A committed site without a matching receipt is republished on recovery, even if its generated files have not changed. An acknowledged current site with no closed previews is a no-op. Artifacts cannot supply either state file; both are reserved paths. API errors fail visibly rather than being treated as successful publication.

For immediate recovery, rerun the cancelled publisher/CI or dispatch **Publish website** on main with a blank PR number after green CI. If artifacts have expired, run fresh main CI; recovery does not bypass trust checks. If newer website changes have no successful frontend artifact, fix their CI first. Check the deployment summary and live `build.json`/`deployment.json`; a saved branch alone does not prove a live deployment.

Local regression coverage includes cancelled publishers, deployment failure before receipt, closed/open preview coexistence, stale production plus retirement, failed frontend jobs, expired artifacts, foreign sources, source freshness and acknowledged no-ops. Live overlapping main/preview/retirement acceptance remains pending until the workflow is merged and run on main. #44 remains open for that evidence; #26 remains the parent delivery tracker. Staging and immutable versioned promotion remain #130 and #32.

## Current workflow refinement — #100

Implementation in the Preparation milestone (#78). Frontend CI remains unconditional on main pushes and PR updates, preserving required checks and current-head preview artifacts. After a successful website-affecting main build, CI calls pages.yml as a dependent reusable job using its own run ID and artifact. The separate workflow_run publisher subscription is removed. Docs/tracker-only main builds finish validation without a publishing workflow run; the dependent publication job is skipped. Manual Publish website remains available on main for numbered PR previews or production recovery.

Automatic Browser E2E runs only for a non-draft `release` or `release/*` PR targeting `main`, opened for review or transitioned to ready for review. Whole-PR docs-only path filters apply. Feature/staging PRs, updates, reopen events, main pushes and manual dispatch do not run browsers. To retest a changed release candidate, return its PR to draft and mark it ready again; local Playwright remains available for debugging. Keep Browser E2E optional in branch protection because filtered workflows cannot satisfy a required check.

Publication still checks source SHA/run identity, current-main eligibility, stale-build protection, aggregate preview preservation and retirement. Main CI does not cancel an active main publication when another push arrives; PR CI remains cancelable. #44 adds the queued publisher and scheduled recovery described above. Automatic deployment appears under Frontend CI → Publish validated production build / publish; standalone Publish website handles manual dispatch and scheduled recovery. Failed frontend validation cannot call publication. No duplicate production build is introduced.

Validation: nine pipeline tests pass locally, including real Git diffs for docs-only/application changes and source→docs renames, workflow dependency/permission boundaries, current-run binding, whole-PR mixed changes, manual dispatch and existing artifact/preview safeguards. Remote draft CI and review-ready Browser E2E must pass before review. Actual docs-only/main/preview behavior requires post-merge run evidence before #100 closes. #106 documentation reorganization follows; no files are moved in this implementation.

GitHub Pages is enabled with Source: GitHub Actions. Production is https://himanshuhd.github.io/papertrail-reader/. The repository is currently public, and the website is public; this audit verified the GitHub repository visibility. Do not infer site privacy from repository settings.

Detailed implementation and trust boundaries: [deployment-architecture.md](../architecture/deployment.md). Validation evidence: [deployment-verification.md](verification.md).

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

New PR commits run CI without changing an existing preview. Repeat the manual request after the current head passes CI to update it. If the seven-day artifact has expired, rerun CI first. Blank pr_number republishes the current main commit after its CI succeeds.

The footer links the PR, deployed source branch and commit. A PR build also includes preview-closed.html to review the closed-page design before merging. Closing or merging retires the preview during the next actual publication; do not expect manual publishing of a closed PR to work.

## Production and docs-only changes

Merge reviewed website changes with green CI into main. The automatic publisher replaces production while preserving previews. Documentation-only main changes still validate but record publish=false and skip automatic deployment. The final live check of this behavior is the documentation audit PR under #35.

A failed build is not deployed. After merging, verify CI, publisher conclusion, production build.json/deployment.json and preview retirement. Account for Pages propagation and use the deployed SHA, not appearance alone.

## Releases and recovery

#32 remains open for tag validation, immutable version URLs, artifacts/checksums and explicit promotion/rollback. Tags currently do not overwrite the main website. Until that implementation is accepted, rollback is a reviewed revert on main with successful CI and deployment.

The queue and scheduled reconciliation described above recover missed publication and retirement work. Check the live source SHA after overlapping events; use manual recovery if a schedule is delayed.

## Base paths and storage

CI supplies Vite base paths with trailing slash. A later custom-domain setup can use PAGES_BASE_PATH=/. Hash routing is implemented in PR #41 merged.

Production and previews share an origin. Theme preference is intentionally shared in PR #41. Future reading positions, bookmarks and document identity must be namespaced by base path so preview experiments cannot overwrite production reading metadata. Do not publish private document fixtures.

## Application version (#47)

package.json is the version source of truth. Vite embeds it at build time; production displays Production · v0.1.0, followed by existing branch/SHA identity. Preview identity retains the linked PR number. Version bumps use reviewed changes and keep package-lock.json synchronized; version labels do not create Git tags or immutable release URLs. Initial foundation changes are recorded in CHANGELOG.md. Tag/promotion automation remains #32.

## Trigger refinement (#67)

Publisher starts only manually or after main-branch Frontend CI completion. Automatic publication requires successful push CI and the current main SHA; feature-branch PR builds do not wake it. CI no longer subscribes to PR closure. A failed main build can produce a skipped publisher entry; docs-only main builds verify identity and summarize their skip without deploying.

Each actual publication and scheduled reconciliation checks active previews and retires closed PRs. A closed-without-merge preview remains live until the next successful publication or recovery; docs-only skipped publication does not itself retire previews. Every started publish job records a clear outcome; successful deployments include URLs, source SHA, PR and build run. Manual republish supports recovery even when generated state is unchanged. See [workflow-audit.md](../development/workflow-audit.md).

Main artifact freshness permits documentation-only descendants such as merge-tracker commits, so tracker updates cannot suppress a valid website merge deployment. Newer website changes, divergent history or a truncated comparison reject the older artifact.

---

[Documentation home](../README.md) · [Next](verification.md)
