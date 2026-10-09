# Workflow trigger audit

## Publication recovery — #44

The shared publisher uses `concurrency.queue: max` with `cancel-in-progress: false`. GitHub retains up to 100 pending publishers rather than replacing the single pending run. Queue capacity, manual cancellation and deployment failures still require reconciliation; queue order is not a source-freshness guarantee. See [GitHub concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

On main, a scheduled recovery runs at minutes 17 and 47 each hour. GitHub schedules are best effort and can be delayed or dropped; this is not a delivery-time SLA. Recovery examines up to 300 completed main push runs of `ci.yml`, requires a successful **Validate and build website** job and an unexpired `web-build`, and applies the existing same-repository/current-main or verified documentation-only-descendant checks. A cancelled or failed overall CI run can therefore recover a successful frontend artifact without accepting a failed frontend build. Downloaded SHA/run identity is still verified before copying static files.

Recovery also retires closed published previews while preserving production and open previews. An aggregate-only reconciliation needs no build artifact. Stale production requests cannot overwrite newer production, but their retirement work is retained. Documentation-only pushes still skip their dependent publisher; scheduled reconciliation may publish a newer validated artifact or cleanup independently.

`pages-state/.deployment-state.json` records desired aggregate content. `.publication-receipt.json` is written **only after** successful Pages deployment and records the acknowledged aggregate state. A committed site without a matching receipt is republished on recovery, even if its generated files have not changed. An acknowledged current site with no closed previews is a no-op. Artifacts cannot supply either state file; both are reserved paths. API errors fail visibly rather than being treated as successful publication.

For immediate recovery, rerun the cancelled publisher/CI or dispatch **Publish website** on main with a blank PR number after green CI. If artifacts have expired, run fresh main CI; recovery does not bypass trust checks. If newer website changes have no successful frontend artifact, fix their CI first. Check the deployment summary and live `build.json`/`deployment.json`; a saved branch alone does not prove a live deployment.

Local regression coverage includes cancelled publishers, deployment failure before receipt, closed/open preview coexistence, stale production plus retirement, failed frontend jobs, expired artifacts, foreign sources, source freshness and acknowledged no-ops. Live overlapping main/preview/retirement acceptance remains pending until the workflow is merged and run on main. #44 remains open for that evidence; #26 remains the parent delivery tracker. Staging and immutable versioned promotion remain #130 and #32.

## Preparation work concluded at owner direction — 3 October 2026

The owner explicitly requested closure of #100 and Preparation. #100/#106/#112 are closed, with merged implementation, docs-only filtering, production publication, recovery/source guards and post-merge table-formatting evidence preserved. Numbered open-PR preview evidence remains unrecorded and is not claimed as passed; it no longer blocks this owner-directed handoff. Perform deliberate preview validation on the next feature PR.

GitHub milestone 1 has no remaining open issues. Its state still requires Close in the owner's authenticated GitHub UI: the connector exposes no milestone-update action and the agent browser is signed out. This is a UI state limitation, not additional product work.

Next milestone is Roadmap 2 — Reading continuity: implement #13 PDF identity, IndexedDB reading metadata, saved positions and bookmarks first, then #14 recent documents and library search. EPUB-specific persistence follows #12. Earlier preview closure-gate instructions below are historical and superseded by this owner acceptance; no new evidence-only PR is needed.

## #111 merged; final open-preview gate — 3 October 2026

PR #111 merged as `ced390ac3f38b872df1f158f548fa85275f7049f`. Main CI 37119131725, dependent production publication and reconciliation 37119131448 passed. The generated tracker at 4078d6f exactly matches Prettier output, completing #112. #106 is also completed. Earlier #110 docs-only draft/readiness/main acceptance passed without automatic Browser E2E or publication.

The only successful recent manual run, 37118395268, selected `KIND: production` with an empty PR number and deployed source 445f58a. It verifies manual production recovery, not numbered PR preview. No successful #111 preview run is recorded. Owner-confirmed validation is retained, but the Actions ledger cannot substitute production recovery for the open-preview acceptance gate.

Use this open documentation PR for the final preview check: Actions → Publish website → Run workflow → branch main → enter this PR number in the PR-number field → Run workflow. Leave the PR open until source/PR/current successful CI identity and unchanged production are verified. Then #100/Preparation can close and the owner can merge this evidence-only update. No workflow/application/test/package changes are made by this update.

## Docs-only main verification and remaining preview gate — 3 October 2026

PR #110 merged as `445f58a2f10ceb3b04008b48fc184077c41aebb8`. Main Frontend CI [37118283175](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37118283175) passed; its dependent publication job skipped. Merge reconciliation [37118282733](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37118282733) passed. No automatic Browser E2E or standalone Publish website run was created by this docs-only merge. Draft/readiness checks on #110 had already produced only CI 37118142765.

Manual Publish website [37118358674](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37118358674) failed at trusted-build selection with `Choose an open same-repository PR targeting main`: the requested PR was already closed. This is expected source-selection protection, not a deployment regression. No Pages upload or deployment occurred. Owner confirmed merge/validation; the failed run does not prove a successful open-PR preview.

#106 is completed. Keep #100 and Roadmap 2 — Preparation open for one remaining live gate: publish an open docs-only PR manually, verify its preview PR/SHA/current successful CI identity and unchanged production, then merge it. Do not dispatch its preview after closing the PR. PR #111 provides the open preview head and also repairs #112: reconciliation aligns generated Markdown tables so status updates retain Prettier-compatible output. A mocked workflow regression checks canonical reads and generated output against Prettier. Because this repair changes a workflow/test, readiness Browser E2E and main publication are eligible; #110 already supplies the pure-docs filter evidence. No application/package/version changes are included.

## Pure-docs Preparation acceptance — 3 October 2026

#108/#109 workflow changes are merged. Browser E2E remains manual or ready_for_review only; docs-only PR path filters exclude automatic runs. Main CI stays required, while docs-only builds set publish=false and skip the dependent publisher. Ready-PR updates do not automatically run Browser E2E. A workflow change is eligible; the earlier #109 PR was not a pure-docs test.

The current reconciliation PR edits Markdown only. Record draft/readiness/update/main run evidence, deliberately publish its PR preview and verify source/PR identity, then close #100 and milestone 1 if all gates pass. Until then Preparation remains open. Historical entries below retain earlier policy/run evidence and are superseded by this current gate.

## Current workflow refinement — #100

Implementation in the Preparation milestone (#78). Frontend CI remains unconditional on main pushes and PR updates, preserving required checks and current-head preview artifacts. After a successful website-affecting main build, CI calls pages.yml as a dependent reusable job using its own run ID and artifact. The separate workflow_run publisher subscription is removed. Docs/tracker-only main builds finish validation without a publishing workflow run; the dependent publication job is skipped. Manual Publish website remains available on main for numbered PR previews or production recovery.

Automatic Browser E2E executes only for a non-draft PR from `release` or `release/*` targeting `main`, when opened directly for review or transitioned from draft to Ready for review. Feature/staging PRs cannot execute the browser job. Pushes, synchronize/reopened events and manual dispatch are not triggers. To retest a changed release candidate, return its PR to draft and then mark it ready again. Whole-PR docs-only path filtering remains; local Playwright commands remain available for deliberate debugging. Ordinary Frontend CI continues unit/pipeline/lint/type/build validation. GitHub's PR branch filter matches the base branch, so the head-branch restriction is enforced by a job guard; a feature-to-main readiness event can show a skipped workflow, but does not execute browsers.

Publication still checks source SHA/run identity, current-main eligibility, stale-build protection, aggregate preview preservation and retirement. Main CI does not cancel an active main publication when another push arrives; PR CI remains cancelable. GitHub's one-pending-run concurrency limitation remains #44, not solved here. Automatic deployment appears under Frontend CI → Publish validated production build / publish; standalone Publish website now denotes manual dispatch. Failed frontend validation cannot call publication. No duplicate production build is introduced.

Validation: nine pipeline tests pass locally, including real Git diffs for docs-only/application changes and source→docs renames, workflow dependency/permission boundaries, current-run binding, whole-PR mixed changes, manual dispatch and existing artifact/preview safeguards. Remote draft CI and review-ready Browser E2E must pass before review. Actual docs-only/main/preview behavior requires post-merge run evidence before #100 closes. #106 documentation reorganization follows; no files are moved in this implementation.

Refinement #67 (2 October 2026), superseding the wrapper/closure policy in #35/#61. Implementation is pending merge and live verification.

| Event                      | Expected work                               | Publication                                                               |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| PR opened/updated/reopened | Fast Frontend CI; no browser installation   | No publisher run after feature-branch CI                                  |
| PR ready for review        | Explicit Browser E2E                        | No publication                                                            |
| Manual Browser E2E         | Explicit acceptance                         | No publication                                                            |
| Main push after merge      | Fast Frontend CI                            | Publisher after successful current-main push build; docs-only builds skip |
| PR closed                  | Merge tracker if merged; no closure-only CI | Retirement during next publication                                        |
| Manual Publish website     | Select current successful CI artifact       | PR number previews; blank republishes current main                        |

The last-12-run audit found four publisher wrappers (36969852135, 36969639441, 36969356193, 36969026251) that only checked out/selected and skipped deployment. Manual 36969766862 deployed. Browser E2E did not trigger publishing.

`workflow_run.branches: [main]` filters the triggering CI branch. The publisher job additionally requires successful `push` CI on main. Failed main CI can still create a skipped workflow entry; feature-branch CI no longer wakes it. Docs-only successful main CI creates a short publisher run that verifies identity and explains why deployment was skipped.

Published active previews are checked against live PR state at each actual publication. Closed previews retire while production and open previews are preserved. Closed-without-merge previews, or closures followed only by docs-only merges, stay active until the next actual publication. There is no immediate closure deployment.

Manual artifact selection preserves same-repository/open-PR/current-head checks, artifact SHA/run identity and pinned actions. Automatic stale main builds skip. Every started publisher job summarizes deployed/skipped/failed status; deployed summaries include URLs, source SHA, PR and selected CI. Explicit republishing still uploads/deploys unchanged assembled state so it can recover a previous Pages failure after pages-state was committed. Durable queue recovery remains #44.

Post-merge verification: PR fix CI creates no publisher; merge creates main CI then production publisher; manual PR preview publishes latest green head; closed previews retire on publication; docs-only main changes explain the skip. PRs remain draft until fast CI passes. Browser acceptance stays manual or ready-for-review.

Main artifact freshness permits documentation-only descendants such as merge-tracker commits, so tracker updates cannot suppress a valid website merge deployment. Newer website changes, divergent history or a truncated comparison reject the older artifact.

---

[Previous](browser-testing.md) · [Documentation home](../README.md) · [Next](documentation-conventions.md)
