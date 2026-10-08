# Product Roadmap 2

## Merged release packaging — 8 October 2026

#164 merged as `d995c806d93725f990636ce0899388c613cb2bbb`. Packaging source `e973a6ec1f9579288eead6c8a7506143943fc6d9` passed Frontend CI 37738585921 and Browser E2E 37738585747: 307 passed, zero failures/flakes, 12 intentional skips (153+154 passed; 7+5 skips). Main validation 37739329262 passed; production deployment step succeeded. Owner checked deployed PDF/EPUB, saved positions, annotations and footer validation in #164. Package/root-lock/footer version: 2.0.0.

Tag/GitHub release publication remains pending: the available connector has no create-tag/create-release operation. Intended immutable tag target: `d995c806d93725f990636ce0899388c613cb2bbb`; do not target a later documentation commit. #19 stays open until publication. #161/#28 are closed; #16 performance measurements remain incomplete. Milestone 5 has only #19; #26/#32/#44 are moved to the next roadmap. Historical sources, failed runs and manual-result provenance remain retained.

## Release packaging — 8 October 2026

Owner completed all #161 validation and merged #163 (`872ec94c7b32c474e47cbf3ce904edfe9723b9d2`). #161/#28 are completed. #26/#32/#44 are moved out of milestone 5 for the next roadmap; #19 is its only open issue. Release sign-off is recorded for v2.0.0. One `release/2.0.0` branch starts from main `d70851fcb6cf52360110676e4deaf2232397487d`; package/root-lock versions are 2.0.0. Final packaging CI/browser acceptance, production verification and tag/publication remain pending. #16 performance-budget measurements remain open as a disclosed limitation; #139 remains ongoing bug intake. Prior pending validation/merge checkpoints are historical.

## Release sign-off — 8 October 2026

Owner explicitly approved release preparation under #19. Target: **v2.0.0**. #28 acceptance is completed for the declared tested scope: Linux Chromium at five widths and Firefox/WebKit smoke subsets. This does not certify unreported installed browsers, physical devices, HTTPS permission behavior or real OS-window results. Additional #161 coverage and #16 performance measurements remain open and are disclosed release limitations.

#163 remains documentation reconciliation. After its owner merge, create one fresh `release/2.0.0` branch from updated main, update package/root-lock versions and CHANGELOG, validate the reviewed packaging PR, and verify the exact merged production build before publishing its tag/release. #26/#32/#44 are deferred post-release work, not completed tasks.

## Current checkpoint — #162 merged; release preparation active

#162 merged as `15519092f7521d7ec9b6c0d7942be53043a55840`; main Frontend CI 37718788012 passed. Reviewed application/test source `ea2e72b7c810f3c89ba7d3269a660d9dd966a6cd` passed Browser E2E 37585840311: 307 passed, zero failures/flakes and 12 intentional duplicate-width skips. Exact identity/outcomes and original reviewed captures remain in [native acceptance evidence](../evidence/native-161/README.md).

#161 now checks the exercised native drag/navigation/storage/menu/engine cases and retained evidence while explicitly leaving additional combinations and target checks open. #16 retains indexing/rendering/memory-budget acceptance; #28 retains actual supported-browser/HTTPS/OS-window/device checks. #139's oversized-PDF defect is merged; its status:new represents future bug intake, not a known unresolved blocker. #19 is in progress for proposed v2.0.0 preparation; no version/tag/release publication is claimed.

Owner release sign-off is recorded on 8 October for v2.0.0. #28 is completed for declared tested support; #148 owner contrast/selection/zoom verification is checked. There is no Rotate page UI: rotation cases use intrinsic PDF metadata fixtures. Additional #161 permutations and #16 performance measurements remain open; unreported actual browser/device results are not certified. Release packaging and delivery remain #19; staging follows release.

Earlier checkpoints and runs below remain historical.

## Historical checkpoint — #160 merged; milestone 4 closed; #161 active

#145 candidate `2ed4f36688686273f216cf70ec7198de5d6d7267` passed Frontend CI 37568950850 and Browser E2E 37568965714: 192 passed, zero failures/flakes, eight intentional duplicate long-PDF/native-handle skips. PDF/EPUB light/dark captures were inspected; exact identity, outcomes and curated original screenshots are retained in [acceptance evidence](../evidence/annotations-145/README.md). #160 merged as `c8434c3745db3ae9e5209ad12750b9f8779cb479`; #145/#15 are completed and stale active labels removed. Residual native coverage is split into #161 under #28/#16 in reliability milestone 6. Owner closed annotation milestone 4. #161 is active on `release/161-native-acceptance`; Roadmap 2 remains open for reliability/browser gates and #19 major release. Earlier pending-run/coverage checkpoints below are historical and superseded.

## Merged automated acceptance — #161 / PR #162

Merged #162 expands native selection, saved-highlight navigation and statistics recovery coverage, plus Firefox/WebKit smoke subsets alongside the full Chromium suite. Browser E2E 37585840311 passed on `ea2e72b7c810f3c89ba7d3269a660d9dd966a6cd` (307 passed, zero failures/flakes, 12 intentional skips), with Frontend CI 37585690924 passing. Exact source/engine/results and reviewed captures are retained; use the [acceptance matrix](../evidence/native-161/README.md) for executed scope and remaining visual/selection/target-environment gates. Installed browser/device/OS checks are not inferred from emulated widths or headless engines. #16/#28/#78 remain open until their own acceptance is met; #19 is the next major release gate, followed by staging/deployment planning.

## Current checkpoint — #159 merged; #145 preparation active

Owner confirmed PR #159 works on 7 October 2026. Accepted application source `b997a247f15adb057261a487ab0cfa54bbc77ea6` passed Frontend CI 37562511277 with 300 unit/component tests, 10 pipeline tests and required checks. PR #159 is owner-merged; #144 is completed and its stale active label is removed. #145 release acceptance preparation has started. Parent #15 and milestone 4 remain open for that evidence; earlier active/pending-preview checkpoints below are superseded. See [release acceptance plan](../testing/annotations-insights-145.md).

## Current checkpoint — #158 reconciled; #144 active

#158 merged as `298d98ffa14b5eec0d539896975a54575ac132a3`; source `a048cf4` passed Frontend CI 37499613529 and owner PR verification is checked. #157 is completed and stale active labels cleared. Accepted checks: 286 unit/component tests, 10 pipeline tests and required validation. #144 local reading insights is implemented for review from main `bb56d474640b543af3023dd751b555fa4b481d69` on `feat/144-reading-insights`; #145 native release acceptance remains new. Parent #15 and milestone 4 remain open. Earlier active/pending-preview checkpoints below are historical and superseded.

[PR #159](https://github.com/HimanshuHD/papertrail-reader/pull/159) implements #144 with foreground/ready time with a 60-second idle cutoff, cumulative idempotent checkpoints, format/fingerprint identity and a statistics-only reset. Reading insights also shows live saved highlight and non-empty note counts for the current document, with a **See annotations** action opening its Annotations panel. PDF page/EPUB chapter positions do not prove completion. See [measurement contract](../architecture/reading-statistics.md) and [verification](../testing/reading-insights-144.md). Native release acceptance remains deferred to #145/#28.

## Current checkpoint — #155 reconciled; #157 active

Owner merged #155 as `d0c3e10e63bfa27d5046320b4619f7c3ac9dc376`. #143/#156 are completed and stale active labels removed. Accepted source `cbd85f566ab246ff2cb6c5a2b80cb29768fe1b34` passed CI 37469382018 with 273 unit/component tests and 10 pipeline tests plus required checks. Follow-up #157, linked to #156, addresses explicit saves, contextual actions, direct utility panels, selection activation and UI spacing on `fix/157-annotation-interactions` from current main `f8e2ca0b236e60e6e432276c74f827300322e7b2`. Implementation passes 280 unit/component tests, 10 pipeline tests, lint/format/application/node/test types and production build. Earlier #143-active sections below are historical and superseded. #144 statistics follows after this increment; #145 release acceptance remains new. Parent #15 and milestone 4 remain open.

## Active annotation panel and notes — #143

#154/#142 are merged and reconciled, including owner-checked highlight navigation/top offset. #143 is in progress on `feat/143-annotation-notes-panel` from reconciled main `080063f1243b8169109ec32d80054adfc7dff8fc`. Both readers now use the same Annotations utility-panel mode for saved-highlight navigation, excerpt/note/color filters, bounded plain-text notes, recoloring and deletion. Drafts remain on failed saves; explicit retry and document generations preserve truthful, isolated state. Panel close restores opener focus; PDF workspace restores its Annotations mode. Implemented in [PR #155](https://github.com/HimanshuHD/papertrail-reader/pull/155), initial source `4128f84f251f666a5ba34f2613afd670bbead81d`; final revision/CI evidence is maintained in the PR. Local validation passes: 264 unit/component tests, 10 pipeline tests, lint/format/types and production build. See [panel verification](../testing/annotation-panel-143.md). Browser note lifecycle cases are added but execution remains deferred to #145/#28. #144/#145 remain new; parent #15 and milestone 4 remain open. Earlier active #142 checkpoints are superseded.

## Merge reconciliation — #154 completed; #143 next

Owner merged PR #154 as `89292276a59d2ff0c1e1c1fe594df5ff6c14e6bb`; owner verification of EPUB creation and saved-highlight navigation/top offset is checked on that PR. #142 is completed and its stale active label removed. Accepted source `f028f0ee6dd5226b7032443447b1813cf94c85cd` passed Frontend CI 37426388106: 255 unit/component tests, 10 pipeline tests, lint/format/types/build. Automated native Browser E2E remains deferred to #145/#28. Next is #143 shared annotation panel/plain-text notes, followed by #144 statistics and #145 acceptance. Parent #15 and milestone 4 remain open; earlier active #142 checkpoints are historical and superseded.

## Active EPUB highlights — #142

#153/#152 reconciliation is complete; owner native verification is recorded separately from deferred release Browser E2E. #142 is in progress on `feat/142-epub-highlights`, from reconciled main `6cc13b3`. It adds fingerprint-scoped selection, pastel colors, deletion, chapter navigation and validated restoration across formatted/text-only views. The adapter paints native text ranges without rewriting chapter markup. Missing or ambiguous anchors remain Unresolved; browsers lacking the CSS Highlight API retain metadata and show a capability notice. See [EPUB highlight verification](../testing/epub-highlights-142.md). Implemented in [PR #154](https://github.com/HimanshuHD/papertrail-reader/pull/154), initial source `fd1c4c8d6ead177bf639ba281c7b0e8acceb4476`; issue remains in progress pending owner verification/merge. Owner verified EPUB creation; PR review corrections now scroll saved EPUB quotes and ready PDF text ranges 24px below the reading pane top, with edge clamping and stale-navigation protection. Fresh navigation verification remains pending; final revision and CI evidence are maintained in PR #154. Local validation passes: 255 unit/component tests, 10 pipeline tests, lint, formatting, type checks and production build. Native browser acceptance remains #145/#28 at the reviewed release gate. #15/milestone 4 remain open; #143–#145 remain new. Earlier active #152 checkpoints below are superseded.

## Current checkpoint — #153 merged; EPUB highlights next

Owner merged PR #153 as `56e9aba3bc626f28ddc2b74c1667e7d83f68011b`; owner native verification is checked on that PR. #152 is completed and its stale active label removed. Source `c9446ca93d6d4a9b69c3e8eefac397fa065fbfdf` passed Frontend CI 37407335570: 243 unit/component tests, 10 pipeline tests, lint, formatting, types and build. The PR's remaining Browser E2E item is reconciled as a deferred release responsibility under #145/#28, not an executed test. Earlier active #152 and pending-owner checkpoints are superseded. Next increment: #142 EPUB highlights, one fresh branch from current main. #15/milestone 4 remain open for #142–#145.

## Current checkpoint — PR #148 merged; #152 selection gaps active

Owner merged PR #148 as `a4d756b1c92d5122bb51221ac206287e5eaae202`. #141 and #149–#151 are closed with stale active labels removed. The remaining blank-line native selection defect stays #152/In progress on `fix/152-pdf-selection-gaps`, created from main `fc87455a51bc3c7fb9db8c7f19bed096a0205658`. Parent #15 remains in progress; #142–#145 remain new. Earlier pending-merge #141 checkpoints are superseded. The independent fix restores PDF.js native selection guards and a text cursor across the text-layer surface; browser visual acceptance stays #145/#28 at the reviewed release gate.

## Active PDF highlights — 5 October 2026

Owner merged PR #147 as `45c8c8cf8d5955edd896330bc5ad1097e03f2df8`; #140 is closed/completed and its stale active label is removed. #141 is in progress on `feat/141-pdf-highlights`, created from main `4ffdc1c`. Parent #15 remains in progress; #142–#145 remain new. This increment adds PDF text selection/highlights, colors, deletion, local restoration and current-layer overlay geometry. See [app verification](../testing/pdf-highlights-141.md). Local checks pass: 234 unit/component tests, 10 pipeline tests, lint, formatting, type checks and production build. Native Browser E2E acceptance remains the reviewed release gate, with two new cases added but not run on this feature branch. Implemented in [PR #148](https://github.com/HimanshuHD/papertrail-reader/pull/148), initial application/test source `be20b5845333c8f368eed6a6b7f741180dd6965c`. The final selection-focus regression is included; final revision/CI evidence is maintained in the PR. CI evidence is maintained on #141 and the PR. Earlier #140 pending-merge and #141-new checkpoints are superseded.

## Active annotation foundation — 5 October 2026

#140 is in progress on `feat/140-annotation-foundation`, created from main `0f1ba7f`. Parent #15 is in progress; #141–#145 remain new. EPUB milestone 3 is closed. This increment adds independent PDF/EPUB selectors, fingerprint-scoped local CRUD, known-schema migrations, explicit unresolved anchors, bounded metadata and stale-generation protection. Renderer/highlight UI integration follows in #141/#142. See [annotation architecture](../architecture/annotations.md). Local validation passed: 227 unit/component tests, 10 pipeline tests, lint, formatting, type checks and production build. The new storage tests use transaction/protocol seams; native browser acceptance remains #145/#28 through the release gate. Implemented in [PR #147](https://github.com/HimanshuHD/papertrail-reader/pull/147), initial passing source `1972c2b495ddd1c4636c2bfee527d99439ba04cb`. The final revision also clamps floating-point page-edge geometry and adds rotation-boundary coverage; final revision/CI evidence is maintained in that PR. [Frontend CI 37268751645](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37268751645) passed on that source; Browser E2E 37268751239 skipped per release-only policy. #140 stays in progress pending owner acceptance and merge. Earlier statements that #15 has not started are superseded.

## Current planning decision — 5 October 2026

EPUB milestone 3 is closed with zero open and ten completed issues. Roadmap 2 #78 continues with annotations parent #15 and new children #140 (storage/anchors), #141 (PDF highlights), #142 (EPUB highlights), #143 (notes/panel), #144 (local statistics) and #145 (acceptance), all assigned to milestone 4. Implement one branch at a time from updated main, in that order.

Finish annotations, triage #139 and satisfy #16/#28 release gates, then complete #19 and publish the major release through existing delivery. The v2.0.0 target is provisional. Advanced delivery #26/#32/#44 and staging/gate completion #129/#130 follow the major release under Roadmap 3 #107 Preparation; they are not blanket Roadmap 2 closure prerequisites. Reproduced release-blocking publishing defects still require triage. Future milestone reassignment is owner-managed.

Wiki adoption #146 defines the page structure and migration plan in [Wiki roadmap plan](wiki-roadmap-plan.md). Wiki publication is pending; repository roadmap documentation remains in use until published Wiki pages are verified. Earlier contradictory scope or milestone checkpoints below are historical and superseded.

## Current post-EPUB roadmap plan — 5 October 2026

Owner merged PR #138 as `fa709356eee6a08bdac41e76986aa0cc46d1c610`. Accepted source `3e4fef1` passed Frontend CI 37229583694 and Browser E2E 37229662269 (152 passed, zero failed/flaky, eight intentional duplicate skips). #12/#134 are closed/completed and stale active labels are removed. EPUB milestone 3 is verified open with zero open and ten completed issues; owner closure is now appropriate.

[Bug intake #139](https://github.com/HimanshuHD/papertrail-reader/issues/139) is **new**, linked to roadmap #78 and reliability #16 in milestone 6. The owner will add observations later; no defects, severities or fixes are assumed. Triage reproducible observations into independent fixes and resolve release blockers before promotion. This intake stays separate from completed EPUB implementation.

Roadmap 2 itself remains open for #15 annotations/insights, #139/#16/#28 reliability/browser acceptance and #19/#26/#32/#44 release delivery. Preparation and Reading continuity milestones are closed. Next product work is to refine #15 into progressive increments: persistent PDF text highlights/notes, EPUB selectors/restoration, then local statistics. Create one fresh implementation branch from updated main per increment, merging/deploying before starting the next. Full browser acceptance stays on reviewed release-to-main readiness.

Roadmap 3 #107 and #129/#130 remain new. Owner milestone action: close EPUB milestone 3; create/identify Roadmap 3 Preparation and move #129 from the obsolete milestone 6 assignment, then assign #130. No milestone mutation is performed. Earlier next-task/pending-merge checkpoints below are historical and superseded.

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

### PDF highlight visual corrections — #149, #150, #151

PR #148 also joins nearby text fragments per line while preserving column gutters, composites each annotation once at a constant opacity, and uses pastel Yellow/Green/Blue/Pink. Active outlines do not darken the fill. Native selection uses translucent blue so canvas text remains visible. Regression checks cover overlapping fragments, line boundaries and column separation. Owner verification is checked in PR #148 for wrapped paragraphs, selection legibility, active/inactive color consistency and zoom. Intrinsic PDF rotation is automated fixture coverage, not a Rotate page feature. Release Browser E2E remains tracked in #145/#28.

### Highlight text contrast and selection follow-up — #151 / #152

PR #148 now uses multiply blending within an isolated PDF page so pastel highlights and native selection preserve dark canvas glyphs. Line-break selection blocks are transparent. Pointer drags defer annotation geometry capture until release (including release outside the reader); keyboard selection remains available. Pointer cancellation, blur and document changes clear drag state. Component regression coverage checks that Save stays disabled during a drag and enables after release. Owner visual verification of contrast and drag smoothness remains pending under #145/#28.

### #152 margin and outside-page drag revision

PR #153 now keeps an explicit mouse-drag text anchor. Margin starts resolve to a real text boundary on the nearest line; moving endpoints resolve against mounted pages in the same reader, including outside-page positions and re-entry. Backward/cross-page drags retain the original anchor. Pointer updates are coalesced per animation frame; release resolves the final coordinates before saving the selection. Cancel, blur and disposed text layers release drag state. Touch, modifier-assisted selection and native double/triple clicks keep their native behavior. Glyph geometry is measured from current ranges, including page rotation and Unicode boundaries. New coordinate regressions exercise margins, outside/re-entry, cross-page, pointer ownership, cancellation, native double-click handling and 90-degree rotation. Native visual verification remains pending in #152/#145/#28; prior workspace-unavailable notes are superseded by this implemented revision.

## Annotation visual refinement — #156

Child of #143, included in PR #155. Selected option 1 replaces the persistent PDF/EPUB highlights row with a selection-anchored toolbar (four pastel color saves, highlight action and Add note). Native iframe coordinates are mapped into the outer viewport and clamped for narrow screens. Scroll/resize dismisses stale selection controls. Add note saves the owned highlight before opening its editor. The existing Annotations utility icon toggles a matching drawer: slim colored markers, serif excerpts, inline plain-text notes, per-entry menus and compact filters. Existing storage limits/retry and verified-range navigation remain unchanged. Owner visual verification and reviewed release acceptance #145/#28 remain pending.

## #156 option 2 composer and reader note indicators

PR #155 now expands Add note inside the selection toolbar, without a storage write or opening the drawer. Save highlight with note supplies the note to `AnnotationStorage.create`, committing one schema-v2 annotation in one transaction; transaction failures leave neither partial highlight nor orphan note. Add highlight remains independent. Saving it while editing retains the composer and switches to Save note. Cancel/back discard only the note draft and reverse the expansion; failed writes preserve drafts with an in-composer retry. Completion guards preserve newer selections.

The drawer replaces the associated entry's action-menu contents with its note editor. PDF indicators derive from freshly verified highlight rectangles and follow page rendering/zoom/virtualization; EPUB indicators derive from resolved ranges and iframe coordinates, refreshing on scroll and observed reader/frame/body resizing. Plain-text hover/focus previews lead to the selected drawer entry. No marker is painted for unresolved text or an annotation without a note. Native layout/visual verification remains pending under #145/#28.
