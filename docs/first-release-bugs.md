# First-release bug tracking

Parent: [#79](https://github.com/HimanshuHD/papertrail-reader/issues/79). Roadmap: [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1). Release gate: [#80](https://github.com/HimanshuHD/papertrail-reader/issues/80).

## Intake and triage

Capture reproducible defects in the delivered browser PDF product. Agree the release-fix list before implementation. “Lock the bugs” means agree this list; GitHub discussions remain available. Scope changes after agreement require an explicit disposition.

## Current bug groups

| Issue   | Points / scope                                                                 | Status                      |
| ------- | ------------------------------------------------------------------------------ | --------------------------- |
| #84     | 1–4: library tooltip, title/fallback labels, truncation, list-only scrolling   | Completed in merged PR #96  |
| #85     | 5–6: centered library/PDF loading feedback                                     | Completed in merged PR #97  |
| #86     | 7–10: toolbar spacing, theme label, active tabs, motion                        | Completed in merged PR #98  |
| #87     | 11: compact footer and cohesive pane colors                                    | Completed in merged PR #98  |
| #88     | 12: PDF rendering/scroll stability                                             | Completed in merged PR #90  |
| #89     | 13–16: search excerpts and match highlighting                                  | Completed in merged PR #101 |
| #91–#95 | Zoom/fit anchors, fast scrolling, page tracking and large-document performance | Completed in merged PR #90  |

PR #90 merged as c191353b17391c8f1e5a3e9a820e5d863a06498b. Main CI 37033803318, issue reconciliation 37033803232 and publisher 37033885573 succeeded. Production metadata identifies the merge and CI; preview #90 is retired. Pre-merge browser validation passed 61 checks, including a 1,001-page document. This is workflow/deployment metadata evidence, not a new interactive production audit. #79/#1/#80 remain open; the version stays 0.1.0.

Execution order remaining: #89, final regression and release preparation #80. EPUB and broader features remain in Roadmap 2 #78. Previous toolbar/search/slider fixes #74/#75/#76 are merged.

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

#84 validation: PR #96 head 501ed6a4bfe8b46480838d4e9d0e5e4fd1a59654 passed Frontend CI [37035717706](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37035717706) (76 unit tests, 6 pipeline tests, lint, formatting, types and build) and Browser E2E [37035868237](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37035868237) (66 passed without retries; four intentional duplicate long-document skips). Embedded title/fallback labels, hover and real keyboard tooltip bounds passed at 320/375/768/1024/1440 widths; independent library scrolling/header geometry and existing PDF regressions passed. First browser run 37035363007 failed only the new tooltip test's programmatic-focus setup; corrected tests exercise real hover and Shift+Tab/Tab without weakening bounds assertions. PR #96 is ready for review. No automatic PR publisher ran. Owner preview acceptance remains: Publish website on main with pr_number 96, then review and merge. #84/#79/#1 remain open; #85 is next after this increment is accepted/merged.

PR #96 merged as a35e2c5af7dbd0b04dc8e29a5d13854af7a90274. #84 is completed. Main CI 37036588000, issue reconciliation 37036588403 and publisher 37036656072 passed; production metadata records the merge/CI and preview #96 is retired. This is pipeline/source metadata verification, not a fresh interactive production audit. #85 is active, followed by #86/#89/#87; #79/#1/#80 remain open.

## Current reconciliation — merged #97

PR #97 merged as f44d67517ba17053d15e4b420372526a5002a10c. Final Frontend CI 37040435175 passed 83 unit and 6 pipeline tests plus lint/format/types/build. Browser E2E 37040700001 passed 71 checks without retries (four intentional duplicate long-document skips). Main CI 37041483607, reconciliation 37041484160 and production publisher 37041555992 passed; production metadata records f44d675 and source CI 37041483607. Screenshot documentation is being preserved with the combined #86/#87 PR. #85 is completed; #79/#1/#80 remain open. #86 and #87 are the current combined increment; #89 and final regression remain before release.

## #86/#87 combined validation — PR #98

Application/test 14cd505 passed Frontend CI 37044894101 (83 unit and 6 pipeline tests, lint/format/types/build) and Browser E2E 37045007961 (76 passed without retries; four intentionally skipped duplicate long-document checks). New focus/active-mode/transition/reduced-motion/short-height footer checks passed at all five widths. Details and actual UI captures are preserved in [reader-polish.md](reader-polish.md). Keep #86/#87 open for manual preview acceptance and merge. Run Publish website on main with pr_number 98. No automatic PR publication ran. Next #89, then final regression/release #80. #79/#1 remain open.

## Current reconciliation — merged #98

PR #98 merged as 376323ce2171eb17f45ecded2f266cf431baa07e. #86/#87 are completed. Main CI 37045669575, issue reconciliation 37045671003 and publisher 37045732211 passed; pages-state metadata identifies production 376323c/source CI 37045669575 and preview #98 is retired. This verifies pipeline/source metadata, not a new interactive production audit. Final application/browser evidence is 14cd505 / Frontend CI 37044894101 / Browser E2E 37045007961 (83 unit, 6 pipeline, 76 browser checks without retries; four intentional duplicate long-document skips). Final screenshots and current documentation are preserved in a docs-only follow-up because #98 was merged during documentation recording. This supersedes historical pending preview/merge statements above. Next #89, then final regression/release #80. #79/#1 remain open; version remains 0.1.0.

## Active #89 — validated for preview

PR #101 application/test 48c4295 passed Frontend CI 37050069997 (87 unit, 6 pipeline tests, lint/format/types/build) and Browser E2E 37050221708 (81 passed without retries; four intentional duplicate long-document skips). All five search cases passed at 320/375/768/1024/1440 widths, including independent canvas-ink alignment. The final selected-occurrence screenshot was visually inspected and is preserved in [search-highlighting.md](search-highlighting.md). An earlier DOM-only alignment test missed displaced native text; the PDF.js CSS contract was corrected. A later test incorrectly required every fit change to keep a selected match visible; visibility is required on result clicks, while fit/zoom retains the existing reading point and preserves alignment. These initial results are superseded by the clean final run. No automatic PR publisher ran. Keep #89/#79 open for manual preview acceptance/merge and final first-release regression. Publish website on main with pr_number 101. #100 remains deferred under Roadmap 2 #78; workflows and version 0.1.0 are unchanged.

## Current reconciliation — merged #101

PR #101 merged as 77b8f311a638ba616a19dea0102833167a5453fa. #89 is completed. Main CI 37050685881, issue reconciliation 37050685625 and publisher 37050755788 passed; pages-state metadata identifies production 77b8f31/source CI 37050685881 and preview #101 is retired. This verifies deployment/source metadata, not an additional interactive production audit. Final application/test 48c4295 passed CI 37050069997 (87 unit, 6 pipeline tests) and Browser E2E 37050221708 (81 passed without retries, four intentional duplicate long-document skips). The selected-occurrence screenshot confirms alignment with painted PDF text. Final documentation evidence follows separately because #101 was merged during recording. #79/#1/#80 remain open for final first-release regression and v1.0.0 preparation; version remains 0.1.0. Chore #100 stays deferred under Roadmap 2 #78.
