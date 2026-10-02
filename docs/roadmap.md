# PaperTrail release roadmaps

## First release — v1.0.0

[Roadmap #1](https://github.com/HimanshuHD/papertrail-reader/issues/1) now covers the first major release of the delivered browser PDF reader. It stays open until bug acceptance and release verification complete.

Delivered scope includes local folder/file selection, directory tree, responsive independently scrolling panes, selectable PDF text, page navigation, zoom/fit, contents, search, fullscreen, keyboard shortcuts, themes and compact accessible controls. PDF documents remain on the device. Password-protected files show an unsupported message; password entry is not implemented.

The deployed version is still 0.1.0. Planning v1.0.0 does not change package/footer metadata or create a release.

| Gate                                     | Issue           | Completion evidence                                                     |
| ---------------------------------------- | --------------- | ----------------------------------------------------------------------- |
| Collect and agree bugs                   | #79             | Reproduction, environment, severity and agreed first-release fix list   |
| Fix release blockers                     | Children of #79 | Linked fixes/PRs, passing checks and post-merge verification            |
| Final regression and support declaration | #79 / #80       | Tested browser/capability list, PDF smoke results and known limitations |
| Prepare first major release              | #80             | Reviewed commit, version 1.0.0, release notes and tag/release           |
| Verify and finish Roadmap 1              | #80 / #1        | Production version/source evidence and reconciled tracker               |

See [first-release bug tracking](first-release-bugs.md). Record independently actionable defects as linked children, grouping symptoms only when they share a cause. Existing completed fixes do not become new blockers. No new reproducible defect is assumed by this planning change.

A reported defect may be promoted from deferred scope if it breaks the agreed first-release product. Existing #44 is a deferred infrastructure recovery issue; assess current reproduction and release impact during triage rather than duplicating it.

## Product Roadmap 2

[Roadmap #78](https://github.com/HimanshuHD/papertrail-reader/issues/78) starts after v1.0.0. Moving unfinished scope does not complete or cancel it.

| Scope                                                             | Open issues   |
| ----------------------------------------------------------------- | ------------- |
| PDF identity, saved positions and bookmarks                       | #13           |
| Recent documents and library search                               | #14           |
| Annotations, highlights and statistics                            | #15           |
| Tabs and session restoration                                      | #17           |
| Split view and annotation export                                  | #18           |
| EPUB reader, reflow and later EPUB persistence                    | #12           |
| Broader performance, reliability and document safety              | #16           |
| Expanded release readiness and delivery                           | #19           |
| Advanced web delivery, versioned promotion and publisher recovery | #26, #32, #44 |
| Broader supported-browser validation                              | #28           |
| Later Tauri desktop integration, native CI and signing            | #4, #23, #27  |

#13 is the proposed first feature increment after the release. Other priorities are agreed when Roadmap 2 starts; desktop work has no promised release date. Parent relationships remain #19 → #26/#28, #26 → #32/#44, and #4 → #23/#27. Completed delivery children remain historical evidence.

## Reconciled delivery

- #2/#3/#5/#6/#7/#8/#9/#10/#11: original foundation and PDF scope delivered.
- #61/#62/#63/#72: browser acceptance, bounded panes and library refinements delivered.
- #64/#74/#75/#76: utility panel, toolbar/popover feedback and slider removal delivered in PR #73.
- PR #77 completes #10's direct render-cancellation and session-teardown acceptance evidence.
- Completed tooling/delivery issues remain checked in #1; unfinished issues above belong to #78.

PR #73 merged as 058195008dca9fc6797f035c272801fdd5f0d0f9. PR #77 merged as b41d3799bd41f278b50e1a39435dc41e7e9b41bc. Main CI 37006040941 and production publisher 37006094713 passed after #77; metadata identifies that source. Browser E2E 37005756245 passed all 45 Chromium checks before merge.

## Working policy

Reference issues in commits and PRs. Keep implementation PRs draft until lint/format/unit/type/build checks pass; Ready for review runs explicit Browser E2E. Ordinary CI stays browser-free. Previews are manual; successful main builds publish automatically. Reconcile live issues and docs after merges. Release publication follows #80 after the agreed bugs are finished.

The [earlier roadmap PDF](PaperTrail-Web-First-Roadmap.pdf) is a historical planning snapshot. This document and issues #1/#78 are authoritative for current scope.

Large-document performance: #95 follows #94 under #79/#88 in PR #90. Replace blocking all-page preview warm-up with viewport-driven rendering and a bounded reusable cache before first-release acceptance. The affected 1,000+ page PDF needs owner preview validation; first release remains blocked by #79.

Post-merge #90 reconciliation: #88/#91–#95 are completed; production metadata identifies c191353 and CI 37033803318 after successful publisher 37033885573. #84 is active, followed by #85/#86/#89/#87. #79 and the first-release gate remain open; version 1.0.0 is not yet prepared.

Post-merge #96: #84 completed; main CI 37036588000 and publisher 37036656072 passed with production metadata identifying a35e2c5. #85 centered loading feedback is active, then #86/#89/#87. First release gates remain open; EPUB remains Roadmap 2 scope.

## Current reconciliation — merged #97

PR #97 merged as f44d67517ba17053d15e4b420372526a5002a10c. Final Frontend CI 37040435175 passed 83 unit and 6 pipeline tests plus lint/format/types/build. Browser E2E 37040700001 passed 71 checks without retries (four intentional duplicate long-document skips). Main CI 37041483607, reconciliation 37041484160 and production publisher 37041555992 passed; production metadata records f44d675 and source CI 37041483607. Screenshot documentation is being preserved with the combined #86/#87 PR. #85 is completed; #79/#1/#80 remain open. #86 and #87 are the current combined increment; #89 and final regression remain before release.

## #86/#87 combined validation — PR #98

Application/test 14cd505 passed Frontend CI 37044894101 (83 unit and 6 pipeline tests, lint/format/types/build) and Browser E2E 37045007961 (76 passed without retries; four intentionally skipped duplicate long-document checks). New focus/active-mode/transition/reduced-motion/short-height footer checks passed at all five widths. Details and actual UI captures are preserved in [reader-polish.md](reader-polish.md). Keep #86/#87 open for manual preview acceptance and merge. Run Publish website on main with pr_number 98. No automatic PR publication ran. Next #89, then final regression/release #80. #79/#1 remain open.

## Current reconciliation — merged #98

PR #98 merged as 376323ce2171eb17f45ecded2f266cf431baa07e. #86/#87 are completed. Main CI 37045669575, issue reconciliation 37045671003 and publisher 37045732211 passed; pages-state metadata identifies production 376323c/source CI 37045669575 and preview #98 is retired. This verifies pipeline/source metadata, not a new interactive production audit. Final application/browser evidence is 14cd505 / Frontend CI 37044894101 / Browser E2E 37045007961 (83 unit, 6 pipeline, 76 browser checks without retries; four intentional duplicate long-document skips). Final screenshots and current documentation are preserved in a docs-only follow-up because #98 was merged during documentation recording. This supersedes historical pending preview/merge statements above. Next #89, then final regression/release #80. #79/#1 remain open; version remains 0.1.0.

## Deferred publishing chore — #100

Roadmap 2 #78 owns #100: prevent documentation-only merges from creating Publish website runs. The current workflow starts after successful main CI, then skips deployment for docs-only inputs. Owner explicitly deferred event-level filtering/orchestration until the next roadmap; #100 is not a v1.0.0 blocker. Current workflow triggers remain unchanged during #89.

## #89 validation — PR #101

PR #101 application/test 48c4295 passed Frontend CI 37050069997 (87 unit, 6 pipeline tests, lint/format/types/build) and Browser E2E 37050221708 (81 passed without retries; four intentional duplicate long-document skips). All five search cases passed at 320/375/768/1024/1440 widths, including independent canvas-ink alignment. The final selected-occurrence screenshot was visually inspected and is preserved in [search-highlighting.md](search-highlighting.md). An earlier DOM-only alignment test missed displaced native text; the PDF.js CSS contract was corrected. A later test incorrectly required every fit change to keep a selected match visible; visibility is required on result clicks, while fit/zoom retains the existing reading point and preserves alignment. These initial results are superseded by the clean final run. No automatic PR publisher ran. Keep #89/#79 open for manual preview acceptance/merge and final first-release regression. Publish website on main with pr_number 101. #100 remains deferred under Roadmap 2 #78; workflows and version 0.1.0 are unchanged.

## Current reconciliation — merged #101

PR #101 merged as 77b8f311a638ba616a19dea0102833167a5453fa. #89 is completed. Main CI 37050685881, issue reconciliation 37050685625 and publisher 37050755788 passed; pages-state metadata identifies production 77b8f31/source CI 37050685881 and preview #101 is retired. This verifies deployment/source metadata, not an additional interactive production audit. Final application/test 48c4295 passed CI 37050069997 (87 unit, 6 pipeline tests) and Browser E2E 37050221708 (81 passed without retries, four intentional duplicate long-document skips). The selected-occurrence screenshot confirms alignment with painted PDF text. Final documentation evidence follows separately because #101 was merged during recording. #79/#1/#80 remain open for final first-release regression and v1.0.0 preparation; version remains 0.1.0. Chore #100 stays deferred under Roadmap 2 #78.
