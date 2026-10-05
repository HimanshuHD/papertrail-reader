# Product Roadmap 2

## Current release acceptance — #134

Release PR [#138](https://github.com/HimanshuHD/papertrail-reader/pull/138) is ready for owner review/merge. Source `3e4fef13c7934aec32903bfe4a5dd9109f894a30` passed [Frontend CI 37229583694](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37229583694): 206 unit/component and 10 pipeline tests, lint/format/types/build. [Browser E2E 37229662269](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37229662269) passed 152 cases with zero failed/flaky cases and eight intentional duplicate long-PDF/native-handle skips. All 50 EPUB cases passed at five widths; final light/dark screenshots were inspected and curated originals retained. See [current evidence](../evidence/epub-release-acceptance.md).

#131/#132/#133 are merged and reconciled. #134 acceptance is complete, pending owner merge. Milestone 3 remains open with two open (#12/#134) and eight completed issues; merge #138 closes the two remaining issues and permits owner milestone closure. Roadmap #78 and broader browser/device gate #28 remain open. Earlier counts and pending checkpoints below are historical and superseded by this section.

## EPUB contents/typography merge reconciliation — #135

Owner verified the controls and seven review observations, then merged [PR #135](https://github.com/HimanshuHD/papertrail-reader/pull/135) as `e9d59f424c78e62a94be316dc68a860d0fe8c27f`. #131 is completed/closed; its stale active label is removed. Accepted source `4be9aa0` passed [Frontend CI 37217580155](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37217580155): 189 unit/component tests, 10 pipeline tests, lint/format/types/build. Merge automation reconciled main as `3d5b97a`; owner verification is recorded separately from deferred release browser evidence.

Delivered: validated nested EPUB 2/3 Contents with spine fallback, PDF-style utility buttons/right panel, measured default font and responsive typography, stable loading overlay/metadata, iframe dismissal/tooltips, Text-only switch and borderless side icons. Full Browser E2E remains #134/#28 on reviewed release-to-main readiness; no new browser run is claimed.

## Active EPUB enhancement — #134

#132 is completed in merged #136. #133 is completed in merged #137. #134 is active on test/134-epub-release-acceptance, with browser execution from release/epub-acceptance-134 → main. Milestone 3 remains open with two open and eight completed issues.

## Planned EPUB reader enhancements — 4 October 2026

Parent [#12](https://github.com/HimanshuHD/papertrail-reader/issues/12) now has four separately tracked increments, **type:enhancement** (#131 completed; #132 completed; #133 completed; #134 in progress) in EPUB milestone 3. Each has explicit acceptance, dependencies and a planned branch name. #134 is the active acceptance gate; full browser execution remains a release gate.

| Issue                                                              | Enhancement                                             | Branch                                      | Status                           |
| ------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------- | -------------------------------- |
| [#131](https://github.com/HimanshuHD/papertrail-reader/issues/131) | authored contents navigation and typography controls    | `feat/131-epub-contents-typography`         | Completed                        |
| [#132](https://github.com/HimanshuHD/papertrail-reader/issues/132) | stable reading location through typography and resize   | `feat/132-epub-stable-location`             | Completed                        |
| [#133](https://github.com/HimanshuHD/papertrail-reader/issues/133) | identity, saved positions, bookmarks and recent history | Planned: `feat/133-epub-reading-continuity` | Completed                        |
| [#134](https://github.com/HimanshuHD/papertrail-reader/issues/134) | final format, security and browser release acceptance   | Planned: `test/134-epub-release-acceptance` | In progress — release acceptance |

Deliver #131 → #132 → #133 → #134. Create each later branch from updated main after prerequisite merges/deployments. #134 owns EPUB-specific release evidence and coordinates broader supported-browser gate #28; full browser execution stays on reviewed release-to-main readiness. EPUB milestone 3 remains open with four open and six closed issues.

## EPUB renderer merge reconciliation — 4 October 2026

[PR #125](https://github.com/HimanshuHD/papertrail-reader/pull/125) merged as `f9c170329109f9c7ed7ffbff9df0a41e265135b8` at 14:42:21 Asia/Kolkata. Owner deleted `feat/12-epub-rendering`. #124/#126/#127/#128 are completed; stale active labels and pending-merge checklist entries are removed. Source `66ea167` passed [Frontend CI 37190427689](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37190427689): 172 unit/component tests, 10 pipeline tests, lint, formatting, strict types and production build.

Delivered: formatted local styles/images by default, an unchecked **Text-only view** option retaining chapter/reading point where available, fixed side chapter icons, visible **Chapters** label, and mounted-frame resize with a trailing **150 ms** debounce and one vertical scroll owner. No further feature implementation is started by this reconciliation.

| Issue | Delivery                                               | Status            |
| ----- | ------------------------------------------------------ | ----------------- |
| #124  | Verified local renderer and session lifecycle          | Completed in #125 |
| #126  | Resize/reflow and horizontal-scroll correction         | Completed in #125 |
| #127  | Fixed side icons and Chapters label                    | Completed in #125 |
| #128  | Formatted default and optional text-only mode          | Completed in #125 |
| #12   | Contents, typography, CFI/identity and EPUB continuity | In progress       |

Fresh browser evidence for these corrections is deferred to [release acceptance #28](https://github.com/HimanshuHD/papertrail-reader/issues/28) and parent #12. That checklist retains both-mode resize/overflow, fixed-control/focus layout, representative EPUB 2/3 styles/images, mode anchors, hostile resources and mobile/desktop light/dark captures. Historical text-only screenshots/run do not validate current formatted/resize behavior. Browser E2E executes only on reviewed `release` or `release/*` → `main` opening/readiness; feature work uses ordinary CI.

EPUB milestone 3 is verified **open**, with five open issues (#12 and #131–#134) and five closed issues. Preparation milestone 1 and Reading continuity milestone 2 are closed. Roadmap #78 remains open for subsequent EPUB, annotations, reliability/browser and delivery scope.

#129 was unintentionally closed by a negated closing-keyword reference in #125's description; it is reopened/status:new per owner instruction. The merged workflow prototype does not complete its formal release/staging event acceptance. #130 staging delivery remains new/unimplemented. Both remain Roadmap 3 #107 Preparation planning; actual milestone assignment is pending identification/creation. No staging deployment behavior has changed.

Earlier entries below preserve historical checkpoints and are superseded by this current reconciliation.

## Historical merge reconciliation — PR #121

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

## #131 UI refinement in PR #135

Replaces the duplicate Chapters dropdown with Contents alone. The PDF-style utility bar uses shared icon buttons; Contents toggles a right utility panel (docked on wide reader areas, overlay on narrow ones). Typography opens a compact popover with font −/+, segmented spacing/width choices and Reset. Escape/close focus restoration, outside-popover dismissal and reduced-motion/inert transitions are covered by component regressions; mode/source ownership and fixed side chapter controls remain. Later Bookmarks/features extend this utility area under #133. Release browser fixtures use the revised controls; execution remains deferred to #134/#28.

## #131 review observations: loading and controls

Chapter/mode loading is contained in a fixed reading-stage overlay with a 150ms delayed loader; Contents metadata remains visible and stable. Book default shows the measured chapter text size and its numerical duplicate is excluded from font stepping. Width choices use mobile/tablet/desktop-style measures: Narrow at 50% capped to 480px, Medium at 70% capped to 768px, Wide at 90% capped to 1100px. Mobile windows below 640px have no width choices; tablet windows below 1024px omit Wide. Full width remains distinct. Iframe pointer/Escape listeners dismiss Typography and are cleaned up; top utility tooltips stack above the popover. Text-only is an accessible switch, and fixed chapter controls are borderless icons with subtle hover/focus interaction. Unit regressions and deferred browser fixtures track these observations; full visual execution remains the release gate.

## #132 implementation checkpoint

Session location capture/restoration is implemented with validated generated-publication CFIs and character/text anchors, pixel offsets and end-of-chapter handling. Typography, 150ms resize and mode reopening preserve the reading point with generation/input cancellation. Local checks pass: 197 unit/component tests, 10 pipeline tests, lint/format/types/build. Delivery awaits review and owner merge; the milestone remains open with four open and six completed issues. The release suite lists 140 cases; current browser execution remains #134/#28. See [location semantics](../architecture/epub.md#stable-session-reading-location--132).

## #136 merge reconciliation and active #133

Owner merged #136 as `09610e6` after source `2f99f6b` passed Frontend CI 37223881477 (197 unit/component and 10 pipeline tests, lint/format/types/build). #132 is complete and its active label is removed. #133 now owns saved EPUB progress across reload, document switching and later reselection, plus identity/settings/bookmarks/recent history. Its fresh branch starts from updated main; #134 remains new for final release evidence. EPUB milestone 3 remains open: three open (#12/#133/#134), seven completed. Browser E2E remains deferred to reviewed release-to-main readiness.

## #133 implementation checkpoint

Saved EPUB progress across reload/document switching/reselection is implemented, with content identity, typography/mode, named bookmarks and format-aware recent/workspace recovery. The new EPUB database remains separate from PDF metadata and stores no file bytes. Local validation passes 206 unit/component and 10 pipeline tests, lint/format/types/build. Release fixtures list 145 cases; browser execution remains deferred to #134/#28. Review and owner merge remain pending. Milestone 3 remains open with three open and seven completed issues. See [continuity semantics](../architecture/epub.md#saved-epub-reading-continuity--133).

## #137 merged; final EPUB acceptance — #134

Owner merged #137 as `d7afbf58cf9448749bbd226018956035c5576076`. Accepted source `ec4f995` passed Frontend CI 37225710749: 206 unit/component and 10 pipeline tests, lint/format/types/build. #133 is completed and its stale active label is removed. #134 now owns final reviewed release-candidate checks and current evidence. EPUB milestone 3 remains open: two open (#12/#134), eight completed. #12 and the milestone remain open until the remaining acceptance is verified. Broader Chrome/Edge/Firefox/Safari capability declarations stay in #28. Earlier pending merge and active-increment checkpoints are historical.
