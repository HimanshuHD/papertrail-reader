# Product Roadmap 2

## EPUB review feedback — #126 / #127 / #128 — 4 October 2026

[PR #125](https://github.com/HimanshuHD/papertrail-reader/pull/125) implements the remaining #124 feedback: trailing **150 ms** container resize debounce with mounted-frame reflow, one vertical scroll owner and horizontal-scroll suppression; fixed side chapter icons in reserved gutters; a visible **Chapters** label; and **Text-only view**, unchecked by default. The checkbox switches between sanitized local author formatting/images and simplified text, retaining chapter and a generated text-node reading anchor where available. New sources reset to formatted view.

Implementation and unit/component coverage are present. Browser regressions cover live resize without scrolling, iframe identity, authored colors/spacing/images, mode anchors and stationary side controls. Current-source browser/owner acceptance is pending; the historical text-only screenshots/run do not validate these changes. #124/#126/#127/#128 remain in progress until acceptance and merge. Parent #12 and EPUB milestone 3 remain open for authored contents, typography controls, persisted CFI/identity, bookmarks and recent EPUB history.

Browser E2E runs only when a reviewed `release` or `release/*` PR targeting `main` is opened or becomes ready. Feature work proceeds with ordinary CI; final release validation records browser evidence. #129/#130 remain status:new in next-roadmap Preparation planning; staging deployment behavior has not changed.

## Milestone closure verified — 4 October 2026

Reading continuity milestone 2 is closed (`closed_at: 2026-10-04T03:10:34Z`), with zero open and six closed issues. Preparation milestone 1 is also closed. Earlier pending-closure statements below are historical and superseded. EPUB milestone 3 and parent #12 remain open for their remaining format acceptance.

## EPUB renderer review handoff — 4 October 2026

#124 is ready for owner review in [PR #125](https://github.com/HimanshuHD/papertrail-reader/pull/125), branch `feat/12-epub-rendering`. Application/test source `f1f76da` passed [Frontend CI 37175969681](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37175969681) (164 unit/component and 10 pipeline tests, lint, formatting, types and production build) and [Browser E2E 37176268989](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37176268989) (107 passed, eight intentional skips, no failures/retries). Mobile/desktop light/dark captures were inspected; opener/title spacing, navigation, invalid-book recovery and source disposal passed. [Evidence](../evidence/epub-text-reader.md). Foundation #122 is completed in merged #123 (`d5fdbdf`). Parent #12 and milestone 3 remain open for authored contents, typography/reflow controls, CFI persistence, bookmarks and recent EPUB history.

## Active EPUB work — 4 October 2026

#12 is in progress on `feat/12-epub-reading`. First increment [#122](https://github.com/HimanshuHD/papertrail-reader/issues/122) adds bounded local archive preflight; rendering/reflow/CFI acceptance remains in the parent. See [EPUB architecture](../architecture/epub.md). No EPUB reader completion is claimed.

## Merge reconciliation — 4 October 2026

PR #121 merged as `1218f27b907f0fdb0d909314f3c2ad1b33f843ca`; [main Frontend CI 37172696181](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37172696181) passed. Owner feedback source `ead6e5e` passed 122 unit/component, 10 pipeline and 102 Chromium browser cases (eight intentional skips, no retries). #14 is completed; all six Reading continuity issues (#13/#14/#114/#115/#117/#118) are closed. Milestone 2 has zero open issues and six closed issues: delivery is complete, GitHub milestone remains open for owner closure. EPUB/CFI stays in milestone 3 under #12. Earlier pending review/format statements are historical and superseded. Roadmap #78 remains open; next active task is #12.

## Reading continuity delivery sequence

Merged PR #116 completed #114 smooth direct landing and #117 zoom/fit-mode persistence. Merged PR #119 completed #118 permission-aware single-workspace/library restoration with normalized reading anchors. #115 PDF bookmarks is completed in merged #120; #14 recent documents/library search is next. Broader multi-document workspace remains Roadmap 3.

1. [#114](https://github.com/HimanshuHD/papertrail-reader/issues/114), under #13: PDF content identity and saved-page restoration, with independent storage/identity services and lifecycle composable.
2. [#118](https://github.com/HimanshuHD/papertrail-reader/issues/118), under #13: restore the single library, panels and active PDF with permission/content revalidation; completed in PR #119.
3. [#115](https://github.com/HimanshuHD/papertrail-reader/issues/115), under #13: PDF bookmarks using the validated persistence foundation; completed in [PR #120](https://github.com/HimanshuHD/papertrail-reader/pull/120); CI and 97 browser cases passed; owner validated and merged `0b2b5c1`.
4. #14: recent documents and library search, in review in [PR #121](https://github.com/HimanshuHD/papertrail-reader/pull/121). EPUB location persistence follows #12 independently.

#13 is completed; EPUB/CFI acceptance is owned by #12 in milestone 3.

Owner: [#78](https://github.com/HimanshuHD/papertrail-reader/issues/78). Delivery status: [progress tracker](../trackers/progress.md); [status audit](../trackers/status-audit.md); [branch maintenance](../trackers/branch-maintenance.md). v1.0.0 is released; this roadmap builds on the browser PDF reader.

| Milestone                                                                                         | Scope                                                                         | Planned issues     |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------ |
| [Preparation](https://github.com/HimanshuHD/papertrail-reader/milestone/1)                        | Selective workflows, categorized Markdown, issue conventions                  | #100, #106         |
| [Reading continuity](https://github.com/HimanshuHD/papertrail-reader/milestone/2)                 | Document identity, saved positions/bookmarks, recent documents/library search | #13, #14           |
| [EPUB reading](https://github.com/HimanshuHD/papertrail-reader/milestone/3)                       | Reflowable EPUB reading and format-specific persistence                       | #12                |
| [Annotations and reading insights](https://github.com/HimanshuHD/papertrail-reader/milestone/4)   | Highlights, annotations and reading statistics                                | #15                |
| [Reliability and browser acceptance](https://github.com/HimanshuHD/papertrail-reader/milestone/6) | Performance, document safety and supported-browser evidence                   | #16, #28           |
| [Release delivery and closure](https://github.com/HimanshuHD/papertrail-reader/milestone/5)       | Delivery readiness, versioned release/promotion and publisher recovery        | #19, #26, #32, #44 |

Milestone numbers reflect creation order. Complete reliability/browser acceptance before release closure. Each issue retains its own acceptance and dependencies; placing it in a milestone does not mean implementation is complete.

Preparation #100/#106/#112 is concluded by the owner's recorded acceptance. Earlier live-preview gates are historical; no unrecorded preview is claimed. GitHub milestone 1 is verified closed through #100’s milestone metadata. Reading continuity milestone 2 stays open: #114/#117/#118 are completed, #115 bookmarks is completed, followed by #14 recent documents/library search. #13 and #78 remain open.

Multiple-document tabs, session restoration/resource limits, comparison and portable annotation export are assigned to [Roadmap 3](roadmap-3.md), issues #17/#18. Desktop #4/#23/#27 remain deferred outside Roadmap 2 and Roadmap 3. VitePress and a separately hosted docs portal are excluded.

---

[Previous](product-roadmaps.md) · [Documentation home](../README.md) · [Next](roadmap-3.md)

## Bookmark merge and next increment — 4 October 2026

#120 merged as `0b2b5c1`; owner confirmed validation. #115 is completed and its active status label is removed. PDF increments #114/#117/#118/#115 are completed; #13 stays open only for separate format acceptance after #12. Preparation milestone 1 is confirmed closed through #100’s embedded milestone metadata. Reading continuity milestone 2 stays open for #14 and unfinished format scope. Next branch: `feat/14-recent-library-search`, from reconciled main. Prior pending-review/milestone-closure statements are historical and superseded.

## Owner scope and sidebar reconciliation — 4 October 2026

#13 is closed completed: PDF identity, positions, view/anchor restoration and bookmarks are accepted in merged #116/#119/#120. EPUB/CFI and format-specific persistence remain owned by #12 in EPUB milestone 3; they do not block #13. Earlier notes retaining #13 for EPUB are historical and superseded. Reading continuity milestone 2 stays open for #14 only.

#14 owner feedback remains in PR #121: Recent is a collapsible component with a leading clock icon and trailing count; search sits immediately below the Library header with exact `Search documents...` placeholder and a search icon. Visible search label/help and empty recent-history copy are removed; accessible naming/live result count and recovery actions remain. Owner-feedback source `ead6e5e` passed Frontend CI 37149532676 (122 unit/component, 10 pipeline) and Browser E2E 37149606676 (102 passed, eight intentional skips, no retries). Reference comparison and light/dark captures were inspected. #121 is ready for owner review/merge; do not start the next item before owner acceptance.
