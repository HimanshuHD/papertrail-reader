# First-release bug tracking

Parent: [#79](https://github.com/HimanshuHD/papertrail-reader/issues/79). Roadmap: [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1). Release gate: [#80](https://github.com/HimanshuHD/papertrail-reader/issues/80).

## Intake and triage

Capture reproducible defects in the delivered browser PDF product. Agree the release-fix list before implementation. “Lock the bugs” means agree this list; GitHub discussions remain available. Scope changes after agreement require an explicit disposition.

## Current bug groups

| Issue   | Points / scope                                                                 | Status                                          |
| ------- | ------------------------------------------------------------------------------ | ----------------------------------------------- |
| #84     | 1–4: library tooltip, title/fallback labels, truncation, list-only scrolling   | In progress on fix/84-library-labels-and-scroll |
| #85     | 5–6: centered library/PDF loading feedback                                     | Queued next                                     |
| #86     | 7–10: toolbar spacing, theme label, active tabs, motion                        | Queued                                          |
| #87     | 11: compact footer and cohesive pane colors                                    | Queued after interaction fixes                  |
| #88     | 12: PDF rendering/scroll stability                                             | Completed in merged PR #90                      |
| #89     | 13–16: search excerpts and match highlighting                                  | Queued                                          |
| #91–#95 | Zoom/fit anchors, fast scrolling, page tracking and large-document performance | Completed in merged PR #90                      |

PR #90 merged as c191353b17391c8f1e5a3e9a820e5d863a06498b. Main CI 37033803318, issue reconciliation 37033803232 and publisher 37033885573 succeeded. Production metadata identifies the merge and CI; preview #90 is retired. Pre-merge browser validation passed 61 checks, including a 1,001-page document. This is workflow/deployment metadata evidence, not a new interactive production audit. #79/#1/#80 remain open; the version stays 0.1.0.

Execution order remaining: #84, #85, #86, #89, #87, then final regression and release preparation #80. EPUB and broader features remain in Roadmap 2 #78. Previous toolbar/search/slider fixes #74/#75/#76 are merged.

## Child issue template

- Parent: #79; Roadmap: #1; Related: affected implementation issue.
- Reproduction: smallest reliable steps and safe file characteristics.
- Expected / actual behavior.
- Environment: browser/version, OS, viewport and relevant file-selection capability.
- Severity / first-release blocker decision, with reason.
- Fix branch, issue-referencing commits and PR.
- Verification: focused regression, applicable browser checks, preview review and post-merge deployment evidence.
- Disposition: fixed, duplicate, unable to reproduce or explicitly deferred to #78.

Never include private document content in evidence. Track one defect per independent fix; group related symptoms sharing the same root cause. Use reciprocal issue references and parent checklists for child relationships.

## Completion

#79 closes after all agreed release-blocking children are fixed, validated and merged, and final PDF smoke/regression results plus known limitations are recorded. Non-blocking deferrals must link #78 with a reason. Then #80 prepares v1.0.0. #1 closes only after that release is verified.
