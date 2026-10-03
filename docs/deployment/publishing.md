# Deployment, previews and releases

## Current workflow refinement — #100

Implementation in the Preparation milestone (#78). Frontend CI remains unconditional on main pushes and PR updates, preserving required checks and current-head preview artifacts. After a successful website-affecting main build, CI calls pages.yml as a dependent reusable job using its own run ID and artifact. The separate workflow_run publisher subscription is removed. Docs/tracker-only main builds finish validation without a publishing workflow run; the dependent publication job is skipped. Manual Publish website remains available on main for numbered PR previews or production recovery.

Browser E2E uses whole-PR changed-path filters. Automatic Browser E2E runs only when an eligible PR transitions from draft to ready for review (`ready_for_review`). Docs/tracker-only PRs are excluded. Opening, updating or reopening a PR does not trigger Browser E2E, even when it is already ready for review; use manual dispatch to validate later commits. Application/test/dependency/workflow changes remain eligible at the readiness transition. No automatic main Browser E2E trigger is added. Manual dispatch bypasses path/draft filtering. GitHub path filters consider only the first 300 changed files; unusually large PRs require deliberate manual Browser E2E. Browser E2E must remain optional, not a branch-protection-required check, because a filtered-out workflow cannot satisfy a required check.

Publication still checks source SHA/run identity, current-main eligibility, stale-build protection, aggregate preview preservation and retirement. Main CI does not cancel an active main publication when another push arrives; PR CI remains cancelable. GitHub's one-pending-run concurrency limitation remains #44, not solved here. Automatic deployment appears under Frontend CI → Publish validated production build / publish; standalone Publish website now denotes manual dispatch. Failed frontend validation cannot call publication. No duplicate production build is introduced.

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

GitHub may cancel a pending publisher during overlapping manual/production events even with cancel-in-progress:false. #44 tracks durable reconciliation. Check the live source SHA after a burst; retry the relevant CI job if needed. See deployment-architecture.md for observed recovery evidence.

## Base paths and storage

CI supplies Vite base paths with trailing slash. A later custom-domain setup can use PAGES_BASE_PATH=/. Hash routing is implemented in PR #41 merged.

Production and previews share an origin. Theme preference is intentionally shared in PR #41. Future reading positions, bookmarks and document identity must be namespaced by base path so preview experiments cannot overwrite production reading metadata. Do not publish private document fixtures.

## Application version (#47)

package.json is the version source of truth. Vite embeds it at build time; production displays Production · v0.1.0, followed by existing branch/SHA identity. Preview identity retains the linked PR number. Version bumps use reviewed changes and keep package-lock.json synchronized; version labels do not create Git tags or immutable release URLs. Initial foundation changes are recorded in CHANGELOG.md. Tag/promotion automation remains #32.

## Trigger refinement (#67)

Publisher starts only manually or after main-branch Frontend CI completion. Automatic publication requires successful push CI and the current main SHA; feature-branch PR builds do not wake it. CI no longer subscribes to PR closure. A failed main build can produce a skipped publisher entry; docs-only main builds verify identity and summarize their skip without deploying.

Each actual publication checks active previews and retires closed PRs. A closed-without-merge preview can remain live until the next publication; docs-only skipped publication does not retire previews. Every started publish job records a clear outcome; successful deployments include URLs, source SHA, PR and build run. Manual republish supports recovery even when generated state is unchanged. See [workflow-audit.md](../development/workflow-audit.md).

Main artifact freshness permits documentation-only descendants such as merge-tracker commits, so tracker updates cannot suppress a valid website merge deployment. Newer website changes, divergent history or a truncated comparison reject the older artifact.

---

[Documentation home](../README.md) · [Next](verification.md)
