# Current status audit

Updated: 2 October 2026 (Asia/Kolkata).

#84 is completed in merged #96; #85 is completed in merged #97. Rendering children #88/#91–#95 are completed in #90. #86 and #87 are completed together in merged PR #98. #89 remains queued, followed by final regression and release gate #80. #79/#1 remain open; version remains 0.1.0. EPUB and broader deferred scope remain Roadmap 2 #78.

Main CI 37041483607, reconciliation 37041484160 and publisher 37041555992 passed for #97. Production metadata identifies f44d675/source CI 37041483607 and preview #97 is retired. See [progress](progress.md), [bug tracker](first-release-bugs.md), [loading screenshots](loading-feedback.md) and [reader polish](reader-polish.md) for current evidence.

The audit below is retained as historical evidence; its partial/next-task statements are superseded.

## Historical audit after PR #50

Updated: 2 October 2026 (Asia/Kolkata).

Completed: #2/#3/#6/#21/#22/#30/#31/#35/#39/#42/#46/#47/#49. #42/#49 were merged in PR #50 at 3a1a82d5ceb6e518cefcbafe43dedacef3723808. Final PR CI 36912595432 passed with 15 Chromium browser checks and reviewed screenshots.

Partial: #5 (remaining #37), #7 (remaining #43), #37 (focus/status/selection acceptance), #26/#19 (versioned releases, reliability, reader delivery and product-release acceptance). #32/#44 remain backlog. #4/#23/#27 stay deferred and open.

Next: #43, then #8/#9. No file-selection or PDF/EPUB-engine completion is claimed. 0.1.0 is the initial foundation version, not a complete document-reader release.

The live tracker and docs/progress.md are reconciled after each merge. Completed acceptance boxes are corrected alongside issue state; branch cleanup candidates and retained infrastructure are listed in branch-maintenance.md. The PDF remains a planning snapshot; roadmap.md records current milestones.

## #86/#87 combined validation — PR #98

Application/test 14cd505 passed Frontend CI 37044894101 (83 unit and 6 pipeline tests, lint/format/types/build) and Browser E2E 37045007961 (76 passed without retries; four intentionally skipped duplicate long-document checks). New focus/active-mode/transition/reduced-motion/short-height footer checks passed at all five widths. Details and actual UI captures are preserved in [reader-polish.md](reader-polish.md). Keep #86/#87 open for manual preview acceptance and merge. Run Publish website on main with pr_number 98. No automatic PR publication ran. Next #89, then final regression/release #80. #79/#1 remain open.

## Current reconciliation — merged #98

PR #98 merged as 376323ce2171eb17f45ecded2f266cf431baa07e. #86/#87 are completed. Main CI 37045669575, issue reconciliation 37045671003 and publisher 37045732211 passed; pages-state metadata identifies production 376323c/source CI 37045669575 and preview #98 is retired. This verifies pipeline/source metadata, not a new interactive production audit. Final application/browser evidence is 14cd505 / Frontend CI 37044894101 / Browser E2E 37045007961 (83 unit, 6 pipeline, 76 browser checks without retries; four intentional duplicate long-document skips). Final screenshots and current documentation are preserved in a docs-only follow-up because #98 was merged during documentation recording. This supersedes historical pending preview/merge statements above. Next #89, then final regression/release #80. #79/#1 remain open; version remains 0.1.0.
