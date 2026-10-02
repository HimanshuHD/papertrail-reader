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
