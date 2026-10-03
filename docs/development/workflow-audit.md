# Workflow trigger audit

## Docs-only main verification and remaining preview gate — 3 October 2026

PR #110 merged as `445f58a2f10ceb3b04008b48fc184077c41aebb8`. Main Frontend CI [37118283175](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37118283175) passed; its dependent publication job skipped. Merge reconciliation [37118282733](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37118282733) passed. No automatic Browser E2E or standalone Publish website run was created by this docs-only merge. Draft/readiness checks on #110 had already produced only CI 37118142765.

Manual Publish website [37118358674](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37118358674) failed at trusted-build selection with `Choose an open same-repository PR targeting main`: the requested PR was already closed. This is expected source-selection protection, not a deployment regression. No Pages upload or deployment occurred. Owner confirmed merge/validation; the failed run does not prove a successful open-PR preview.

#106 is completed. Keep #100 and Roadmap 2 — Preparation open for one remaining live gate: publish an open docs-only PR manually, verify its preview PR/SHA/current successful CI identity and unchanged production, then merge it. Do not dispatch its preview after closing the PR. PR #111 provides the open preview head and also repairs #112: reconciliation aligns generated Markdown tables so status updates retain Prettier-compatible output. A mocked workflow regression checks canonical reads and generated output against Prettier. Because this repair changes a workflow/test, readiness Browser E2E and main publication are eligible; #110 already supplies the pure-docs filter evidence. No application/package/version changes are included.

## Pure-docs Preparation acceptance — 3 October 2026

#108/#109 workflow changes are merged. Browser E2E remains manual or ready_for_review only; docs-only PR path filters exclude automatic runs. Main CI stays required, while docs-only builds set publish=false and skip the dependent publisher. Ready-PR updates do not automatically run Browser E2E. A workflow change is eligible; the earlier #109 PR was not a pure-docs test.

The current reconciliation PR edits Markdown only. Record draft/readiness/update/main run evidence, deliberately publish its PR preview and verify source/PR identity, then close #100 and milestone 1 if all gates pass. Until then Preparation remains open. Historical entries below retain earlier policy/run evidence and are superseded by this current gate.

## Current workflow refinement — #100

Implementation in the Preparation milestone (#78). Frontend CI remains unconditional on main pushes and PR updates, preserving required checks and current-head preview artifacts. After a successful website-affecting main build, CI calls pages.yml as a dependent reusable job using its own run ID and artifact. The separate workflow_run publisher subscription is removed. Docs/tracker-only main builds finish validation without a publishing workflow run; the dependent publication job is skipped. Manual Publish website remains available on main for numbered PR previews or production recovery.

Browser E2E uses whole-PR changed-path filters. Automatic Browser E2E runs only when an eligible PR transitions from draft to ready for review (`ready_for_review`). Docs/tracker-only PRs are excluded. Opening, updating or reopening a PR does not trigger Browser E2E, even when it is already ready for review; use manual dispatch to validate later commits. Application/test/dependency/workflow changes remain eligible at the readiness transition. No automatic main Browser E2E trigger is added. Manual dispatch bypasses path/draft filtering. GitHub path filters consider only the first 300 changed files; unusually large PRs require deliberate manual Browser E2E. Browser E2E must remain optional, not a branch-protection-required check, because a filtered-out workflow cannot satisfy a required check.

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
