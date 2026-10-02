# Workflow trigger audit

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
