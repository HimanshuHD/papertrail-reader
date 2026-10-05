# PaperTrail progress

## Current checkpoint — PR #148 merged; #152 selection gaps active

Owner merged PR #148 as `a4d756b1c92d5122bb51221ac206287e5eaae202`. #141 and #149–#151 are closed with stale active labels removed. The remaining blank-line native selection defect stays #152/In progress on `fix/152-pdf-selection-gaps`, created from main `fc87455a51bc3c7fb9db8c7f19bed096a0205658`. Parent #15 remains in progress; #142–#145 remain new. Earlier pending-merge #141 checkpoints are superseded. The independent fix restores PDF.js native selection guards and a text cursor across the text-layer surface; browser visual acceptance stays #145/#28 at the reviewed release gate.

## Active PDF highlights — 5 October 2026

Owner merged PR #147 as `45c8c8cf8d5955edd896330bc5ad1097e03f2df8`; #140 is closed/completed and its stale active label is removed. #141 is in progress on `feat/141-pdf-highlights`, created from main `4ffdc1c`. Parent #15 remains in progress; #142–#145 remain new. This increment adds PDF text selection/highlights, colors, deletion, local restoration and current-layer overlay geometry. See [app verification](../testing/pdf-highlights-141.md). Local checks pass: 234 unit/component tests, 10 pipeline tests, lint, formatting, type checks and production build. Native Browser E2E acceptance remains the reviewed release gate, with two new cases added but not run on this feature branch. Implemented in [PR #148](https://github.com/HimanshuHD/papertrail-reader/pull/148), initial application/test source `be20b5845333c8f368eed6a6b7f741180dd6965c`. The final selection-focus regression is included; final revision/CI evidence is maintained in the PR. CI evidence is maintained on #141 and the PR. Earlier #140 pending-merge and #141-new checkpoints are superseded.

## Active annotation foundation — 5 October 2026

#140 is in progress on `feat/140-annotation-foundation`, created from main `0f1ba7f`. Parent #15 is in progress; #141–#145 remain new. EPUB milestone 3 is closed. This increment adds independent PDF/EPUB selectors, fingerprint-scoped local CRUD, known-schema migrations, explicit unresolved anchors, bounded metadata and stale-generation protection. Renderer/highlight UI integration follows in #141/#142. See [annotation architecture](../architecture/annotations.md). Local validation passed: 227 unit/component tests, 10 pipeline tests, lint, formatting, type checks and production build. The new storage tests use transaction/protocol seams; native browser acceptance remains #145/#28 through the release gate. Implemented in [PR #147](https://github.com/HimanshuHD/papertrail-reader/pull/147), initial passing source `1972c2b495ddd1c4636c2bfee527d99439ba04cb`. The final revision also clamps floating-point page-edge geometry and adds rotation-boundary coverage; final revision/CI evidence is maintained in that PR. [Frontend CI 37268751645](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37268751645) passed on that source; Browser E2E 37268751239 skipped per release-only policy. #140 stays in progress pending owner acceptance and merge. Earlier statements that #15 has not started are superseded.

## Current planning decision — 5 October 2026

EPUB milestone 3 is closed with zero open and ten completed issues. Roadmap 2 #78 continues with annotations parent #15 and new children #140 (storage/anchors), #141 (PDF highlights), #142 (EPUB highlights), #143 (notes/panel), #144 (local statistics) and #145 (acceptance), all assigned to milestone 4. Implement one branch at a time from updated main, in that order.

Finish annotations, triage #139 and satisfy #16/#28 release gates, then complete #19 and publish the major release through existing delivery. The v2.0.0 target is provisional. Advanced delivery #26/#32/#44 and staging/gate completion #129/#130 follow the major release under Roadmap 3 #107 Preparation; they are not blanket Roadmap 2 closure prerequisites. Reproduced release-blocking publishing defects still require triage. Future milestone reassignment is owner-managed.

Wiki adoption #146 defines the page structure and migration plan in [Wiki roadmap plan](../roadmaps/wiki-roadmap-plan.md). For the progress tracker, that plan is at [../roadmaps/wiki-roadmap-plan.md](../roadmaps/wiki-roadmap-plan.md). Wiki publication is pending; repository roadmap documentation remains in use until published Wiki pages are verified. Earlier contradictory scope or milestone checkpoints below are historical and superseded.

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

| Issue                                                              | Enhancement                                             | Branch                                      | Status    |
| ------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------- | --------- |
| [#131](https://github.com/HimanshuHD/papertrail-reader/issues/131) | authored contents navigation and typography controls    | `feat/131-epub-contents-typography`         | Completed |
| [#132](https://github.com/HimanshuHD/papertrail-reader/issues/132) | stable reading location through typography and resize   | `feat/132-epub-stable-location`             | Completed |
| [#133](https://github.com/HimanshuHD/papertrail-reader/issues/133) | identity, saved positions, bookmarks and recent history | Planned: `feat/133-epub-reading-continuity` | Completed |
| [#134](https://github.com/HimanshuHD/papertrail-reader/issues/134) | final format, security and browser release acceptance   | Planned: `test/134-epub-release-acceptance` | Completed |

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

## Reading continuity implementation (#114 / #117 / #118)

PR #116 is merged. Its accepted application source `3dd5b3e93ca2122dc292f14d4ffba0cfcb124010` passed [Frontend CI 37124839688](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37124839688) and [Browser E2E 37124902731](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37124902731). #114 and #117 are completed; #13 remains open for its remaining acceptance.

PR #119 completed #118 and merged as `7dc8bca1bcf9f3eb9f78c75150e2dc7b25241c48`. The accepted head `deed40b317099d0878fdd0dd8110fa3c4ef879aa` passed [Frontend CI 37138095654](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37138095654) and [Browser E2E 37138156717](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37138156717): 108 unit/component tests, 10 pipeline tests and 92 browser cases, with eight intentional viewport-specific skips. Native persisted-handle reopening, normalized anchor/zoom/utility restoration and changed-content rejection passed in an isolated normal Chromium profile. Main CI [37138731032](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37138731032) passed after merge. This records automated evidence, not a new owner preview or production interaction audit.

| Issue                                                              | Target                         | Scope                                                               | Status    |
| ------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------------------- | --------- |
| [#114](https://github.com/HimanshuHD/papertrail-reader/issues/114) | Roadmap 2 — Reading continuity | PDF identity, direct landing and saved-page restoration; parent #13 | Completed |
| [#117](https://github.com/HimanshuHD/papertrail-reader/issues/117) | Roadmap 2 — Reading continuity | Retain PDF zoom/fit mode; parent #13                                | Completed |
| [#118](https://github.com/HimanshuHD/papertrail-reader/issues/118) | Roadmap 2 — Reading continuity | Single workspace/library and active PDF restoration; parent #13     | Completed |
| [#115](https://github.com/HimanshuHD/papertrail-reader/issues/115) | Roadmap 2 — Reading continuity | Named PDF bookmarks using persisted document identity; parent #13   | Completed |

Reading continuity remains open for #14 review feedback. EPUB/CFI is owned by #12 in milestone 3. Current branch: `feat/14-recent-library-search`. [PR #120](https://github.com/HimanshuHD/papertrail-reader/pull/120) implements named PDF anchors with separate service/composable/UI boundaries. Source `793adcdc` passed Frontend CI 37140924880 (115 unit/component and 10 pipeline tests) and Browser E2E 37140988461 (97 passed, eight intentional skips, no retries). [Bookmark screenshots and acceptance](../evidence/pdf-bookmarks.md) are recorded. Owner confirmed validation and merged #120 as `0b2b5c1` on 4 October 2026 (Asia/Kolkata). Storage, file permissions, PDF identity/rendering and lifecycle coordination remain separate. No document bytes are cached by the application. Forget library removes workspace access while preserving reading metadata.

## Current milestone status — 3 October 2026

Preparation work (#100/#106/#112) is concluded under the owner's recorded acceptance. Historical pending Preparation gates below are superseded. GitHub milestone 1 is verified closed through the milestone metadata on #100 (closed_at 2026-10-03T11:28:55Z). Reading continuity milestone 2 remains open: #114/#117/#118/#115 are completed, and #13/#14 are unfinished. No later milestone or parent #78 is completed.

## Current Preparation reconciliation — 3 October 2026

#109 merged as `2cfe48827989392ea7dcf753fb0be1dafb9bb5d7`. Main CI [37117659748](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37117659748) and its dependent production publisher passed. Reconciliation [37117659837](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37117659837) produced `d28d56395b985c494a84896d99803864a6186cdb`, updating the canonical tracker. #106 is completed and closed; its guide/index/navigation and asset acceptance passed before merge.

Fifteen remaining issue records now identify their actual milestone and owning roadmap; twelve obsolete M0/M4/M5/M6/M7 title prefixes are removed. Roadmap 2 issues retain the actual milestones in [Roadmap 2](../roadmaps/roadmap-2.md). #17/#18 belong to [Roadmap 3](../roadmaps/roadmap-3.md), with no milestone assigned yet. Desktop #4/#23/#27 remains separately deferred outside both roadmap scopes.

| Issue                                                              | Target    | Scope                                | Status                           |
| ------------------------------------------------------------------ | --------- | ------------------------------------ | -------------------------------- |
| [#100](https://github.com/HimanshuHD/papertrail-reader/issues/100) | Web       | Selective publisher/browser triggers | Completed                        |
| [#106](https://github.com/HimanshuHD/papertrail-reader/issues/106) | Docs      | Categorized Markdown and navigation  | Completed                        |
| [#107](https://github.com/HimanshuHD/papertrail-reader/issues/107) | Web later | Roadmap 3 workspace scope            | New — implementation not started |

## Historical milestone 1 closure gate

Keep Roadmap 2 — Preparation open until #100 passes a pure-docs PR draft/readiness/update test, an explicit numbered manual preview, and a docs-only main merge with skipped publisher/no automatic Browser E2E. This reconciliation PR changes Markdown only and is the controlled test. Verify its successful current-head artifact, published preview identity and unchanged production identity before closure. Then start #13 in Reading continuity. No new reader feature is implemented by this reconciliation.

## Current workflow refinement — #100

Implementation in the Preparation milestone (#78). Frontend CI remains unconditional on main pushes and PR updates, preserving required checks and current-head preview artifacts. After a successful website-affecting main build, CI calls pages.yml as a dependent reusable job using its own run ID and artifact. The separate workflow_run publisher subscription is removed. Docs/tracker-only main builds finish validation without a publishing workflow run; the dependent publication job is skipped. Manual Publish website remains available on main for numbered PR previews or production recovery.

Browser E2E uses whole-PR changed-path filters. Automatic Browser E2E runs only when an eligible PR transitions from draft to ready for review (`ready_for_review`). Docs/tracker-only PRs are excluded. Opening, updating or reopening a PR does not trigger Browser E2E, even when it is already ready for review; use manual dispatch to validate later commits. Application/test/dependency/workflow changes remain eligible at the readiness transition. No automatic main Browser E2E trigger is added. Manual dispatch bypasses path/draft filtering. GitHub path filters consider only the first 300 changed files; unusually large PRs require deliberate manual Browser E2E. Browser E2E must remain optional, not a branch-protection-required check, because a filtered-out workflow cannot satisfy a required check.

Publication still checks source SHA/run identity, current-main eligibility, stale-build protection, aggregate preview preservation and retirement. Main CI does not cancel an active main publication when another push arrives; PR CI remains cancelable. GitHub's one-pending-run concurrency limitation remains #44, not solved here. Automatic deployment appears under Frontend CI → Publish validated production build / publish; standalone Publish website now denotes manual dispatch. Failed frontend validation cannot call publication. No duplicate production build is introduced.

Validation: nine pipeline tests pass locally, including real Git diffs for docs-only/application changes and source→docs renames, workflow dependency/permission boundaries, current-run binding, whole-PR mixed changes, manual dispatch and existing artifact/preview safeguards. Remote draft CI and review-ready Browser E2E must pass before review. Actual docs-only/main/preview behavior requires post-merge run evidence before #100 closes. #106 documentation reorganization follows; no files are moved in this implementation.

## Current plan — v1.0.0 released; Roadmap 2 ready

Published stable [v1.0.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v1.0.0) at 2026-10-02T19:55:40Z (3 October 2026, 01:25:40 Asia/Kolkata). GitHub API verifies the lightweight tag directly targets reviewed/deployed merge b2eb9328be5147346926e9bbce0960fa777b9e00. Main CI 37054802868 and publisher 37054875000 passed; owner confirmed production v1.0.0/SHA b2eb932. #79, #80 and first-release roadmap #1 are completed. Roadmap 2 #78 is open and ready; PDF saved positions/bookmarks #13 is the next feature, with #100 publishing maintenance retained as unfinished scope. Historical pending-tag and deferred-handoff entries are superseded by this verification.

Updated: 3 October 2026 (Asia/Kolkata). Latest merged documentation: #104 / 6422785bb2a7204480d46ab4a7a6a7472fb2d765. Production remains release #103 / b2eb932. [Release records](../releases/README.md) preserve regression, deployment and publication evidence. Earlier status entries below are historical and superseded by this current plan.

## Issue tracker

| Issue                                                            | Phase         | Work                                                                  | Status                                                                                    |
| ---------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1)   | Web           | Product roadmap: web-first PaperTrail and later desktop expansion     | Completed                                                                                 |
| [#2](https://github.com/HimanshuHD/papertrail-reader/issues/2)   | Web           | Repository documentation and issue tracking                           | Completed                                                                                 |
| [#3](https://github.com/HimanshuHD/papertrail-reader/issues/3)   | Web           | Bootstrap Vue 3, Vite and TypeScript                                  | Completed                                                                                 |
| [#4](https://github.com/HimanshuHD/papertrail-reader/issues/4)   | Desktop later | Integrate Tauri 2 desktop shell                                       | Deferred — desktop backlog; implementation not started                                    |
| [#5](https://github.com/HimanshuHD/papertrail-reader/issues/5)   | Web           | Configure web code quality, tests and GitHub Actions                  | Completed                                                                                 |
| [#6](https://github.com/HimanshuHD/papertrail-reader/issues/6)   | Web           | Design tokens, themes and application state                           | Completed                                                                                 |
| [#7](https://github.com/HimanshuHD/papertrail-reader/issues/7)   | Web           | Split reader layout and accessible app shell                          | Completed                                                                                 |
| [#8](https://github.com/HimanshuHD/papertrail-reader/issues/8)   | Web           | Browser folder/file selection and permission handling                 | Completed                                                                                 |
| [#9](https://github.com/HimanshuHD/papertrail-reader/issues/9)   | Web           | Browser document discovery and directory tree                         | Completed                                                                                 |
| [#10](https://github.com/HimanshuHD/papertrail-reader/issues/10) | Web           | PDF.js reader, navigation and zoom                                    | Completed                                                                                 |
| [#11](https://github.com/HimanshuHD/papertrail-reader/issues/11) | Web           | PDF search, contents and reader shortcuts                             | Completed                                                                                 |
| [#12](https://github.com/HimanshuHD/papertrail-reader/issues/12) | Web           | EPUB reader and reflow controls                                       | Completed                                                                                 |
| [#13](https://github.com/HimanshuHD/papertrail-reader/issues/13) | Web           | Browser document identity, saved positions and bookmarks              | Completed                                                                                 |
| [#14](https://github.com/HimanshuHD/papertrail-reader/issues/14) | Web           | Recent documents and library search                                   | Completed                                                                                 |
| [#15](https://github.com/HimanshuHD/papertrail-reader/issues/15) | Web           | Annotations, highlights and reading statistics                        | In progress — PDF highlights #141 is active; #140 is complete and #142–#145 remain new.   |
| [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) | Web           | Browser performance, reliability and document safety                  | New — planned; implementation not started                                                 |
| [#17](https://github.com/HimanshuHD/papertrail-reader/issues/17) | Web           | Document tabs and session restoration                                 | New — planned; implementation not started                                                 |
| [#18](https://github.com/HimanshuHD/papertrail-reader/issues/18) | Web           | Optional split view and annotation export                             | New — planned; implementation not started                                                 |
| [#19](https://github.com/HimanshuHD/papertrail-reader/issues/19) | Web           | Web release readiness and delivery                                    | New — planned; implementation not started                                                 |
| [#21](https://github.com/HimanshuHD/papertrail-reader/issues/21) | Web           | Automate post-merge issue and progress reconciliation                 | Completed                                                                                 |
| [#22](https://github.com/HimanshuHD/papertrail-reader/issues/22) | Web           | Frontend quality checks and test coverage                             | Completed                                                                                 |
| [#23](https://github.com/HimanshuHD/papertrail-reader/issues/23) | Desktop later | Rust formatting, lint and native test pipeline                        | Deferred — desktop backlog; implementation not started                                    |
| [#24](https://github.com/HimanshuHD/papertrail-reader/issues/24) | Web           | Incremental browser indexing and cancellation                         | Completed                                                                                 |
| [#25](https://github.com/HimanshuHD/papertrail-reader/issues/25) | Web           | Directory tree and browser library refresh UI                         | Completed                                                                                 |
| [#26](https://github.com/HimanshuHD/papertrail-reader/issues/26) | Web           | Web build, HTTPS deployment and release artifacts                     | In progress — base delivery completed; Roadmap 2 promotion/reliability acceptance remains |
| [#27](https://github.com/HimanshuHD/papertrail-reader/issues/27) | Desktop later | Desktop signing and notarization                                      | Deferred — desktop backlog; implementation not started                                    |
| [#28](https://github.com/HimanshuHD/papertrail-reader/issues/28) | Web           | Supported-browser release validation                                  | New — planned; implementation not started                                                 |
| [#30](https://github.com/HimanshuHD/papertrail-reader/issues/30) | Web           | Adopt web-first scope and defer desktop integration                   | Completed                                                                                 |
| [#31](https://github.com/HimanshuHD/papertrail-reader/issues/31) | Web           | GitHub Pages production and PR preview pipeline                       | Completed                                                                                 |
| [#32](https://github.com/HimanshuHD/papertrail-reader/issues/32) | Web           | Versioned web releases and promotion policy                           | New — planned; implementation not started                                                 |
| [#35](https://github.com/HimanshuHD/papertrail-reader/issues/35) | Web           | Deploy PR previews on demand and filter documentation-only publishing | Completed                                                                                 |
| [#37](https://github.com/HimanshuHD/papertrail-reader/issues/37) | Web           | Browser E2E foundation and selection smoke tests                      | Completed                                                                                 |
| [#39](https://github.com/HimanshuHD/papertrail-reader/issues/39) | Web           | Improve closed-preview page and link deployed branch in footer        | Completed                                                                                 |
| [#42](https://github.com/HimanshuHD/papertrail-reader/issues/42) | Web           | Reader shell components and responsive layout                         | Completed                                                                                 |
| [#43](https://github.com/HimanshuHD/papertrail-reader/issues/43) | Web           | Shell keyboard navigation and status-state presentation               | Completed                                                                                 |
| [#44](https://github.com/HimanshuHD/papertrail-reader/issues/44) | Web           | Reconcile publishing when GitHub cancels a queued deployment          | New — planned; implementation not started                                                 |
| [#46](https://github.com/HimanshuHD/papertrail-reader/issues/46) | Web           | Replace appearance dropdown with light/dark icon toggle               | Completed                                                                                 |
| [#47](https://github.com/HimanshuHD/papertrail-reader/issues/47) | Web           | Display initial application version in production footer              | Completed                                                                                 |
| [#49](https://github.com/HimanshuHD/papertrail-reader/issues/49) | Web           | Preserve responsive home page and add Go to app navigation            | Completed                                                                                 |
| [#52](https://github.com/HimanshuHD/papertrail-reader/issues/52) | Web           | Restore fast automatic CI; browser tests explicit only                | Completed                                                                                 |
| [#82](https://github.com/HimanshuHD/papertrail-reader/issues/82) | Web           | Reader empty-state and library UI polish                              | Completed                                                                                 |

## Historical application snapshot — foundation

Version 0.1.0 is the initial foundation. Home retains its card and includes Go to app; /app provides a responsive local library, production empty state and PDF reader workspace. Light/Dark sun/moon preferences persist; System mode is removed. Production footer shows version and source SHA; previews show linked PR/branch/SHA. Browser library scope and PDF core reading/navigation/zoom are implemented. #11 PDF search, outlines/contents, fullscreen and keyboard help are merged in PR #60. Browser acceptance is tracked in #61; PDF UI #62–#64 and PDF persistence #13 follow. EPUB #12 is next-version scope.

## Validation and delivery

PR #50 final CI 36912595432 passed: 4 pipeline, 18 component and 15 Chromium browser checks at 320/375/768/1024/1440px. Home/app screenshots in both themes were inspected; 320px toolbar title compression was corrected. WebKit projects are optional and are not represented as passed. Browser report artifact: 11187462095 (seven-day retention).

#35 docs-only main filtering is completed: CI 36904894358 and publisher 36904971730 skipped deployment after #45. Closure publisher 36904916430 republished the aggregate site to retire preview #45 while preserving production b54d41d. A Pages deployment event does not necessarily mean a new production app source build.

Post-merge #50 main CI/deployment evidence is recorded in deployment-verification.md. Generated pages-state preserves production and preview channels; it must not be deleted as a stale feature branch.

## Parent and child mappings

#5 → #21/#22/#35/#37/#52 (completed). #7 → #42/#43/#49 (completed). #9 → #24/#25 (completed). #26 → #31/#47 (completed), #32/#44 (backlog). #19 → #26/#28. #4 → #23/#27 (desktop later). #46 is the completed follow-up to #6. Relationships use reciprocal issue links/checklists.

## Next work and completion rules

Current sequence: completed #61 browser acceptance → active #62 viewport/scrolling → #63 compact library controls → #64 right utility panel/icon toolbar/popovers → PDF persistence #13. Unknown PDF bugs will be logged after reproducible reports; none are invented by this audit.

Web 0.1 acceptance requires M0–M3 plus PDF scope of #13 and release-relevant reliability/browser delivery checks. Foundation version 0.1.0 does not claim completed reader release acceptance. Deferred desktop scope remains open and does not block web delivery. Close only accepted scope after review/merge and preserve validation evidence.

[Roadmap](../roadmaps/product-roadmaps.md) · [Architecture](../architecture/overview.md) · [Browser checks](../development/browser-testing.md) · [Shell layout](../architecture/reader-shell.md) · [Branch maintenance](branch-maintenance.md)

## CI policy refinement (#52)

Automatic browser installation/execution is removed in PR #51. Frontend CI retains lint/format/unit/pipeline/type/build validation; Playwright remains explicit. The repository provides a separate Browser E2E workflow triggered only manually or when a draft PR is marked Ready for review. Run 36924070741 passed focus/selection/discovery acceptance; browser execution remains explicit rather than part of automatic CI.

## PDF follow-up tracker

| Issue | Parent | Scope                                                            | Status    |
| ----- | ------ | ---------------------------------------------------------------- | --------- |
| #61   | #11    | Browser acceptance, workflow audit and release reconciliation    | Completed |
| #62   | #10    | Viewport sizing and independent pane scrolling                   | In review |
| #63   | #10    | Floating library toggle, compact header and source dropdown      | In review |
| #64   | #11    | Right utility panel, icon toolbar, filename tooltip and popovers | Backlog   |

Relationships use reciprocal links/checklists; native GitHub sub-issue mutations are not exposed by the connector. PRs stay draft until fast CI is green; marking Ready for review triggers explicit Browser E2E. See [workflow audit](../development/workflow-audit.md) and [deployment evidence](../deployment/verification.md).

## Active viewport increment (#62)

PR #65 is merged (`3a893344`) and #61 is completed with 30 Chromium acceptance checks. Main CI 36967881575 and publishers 36967891071/36967920050 passed after merge. The #65 fix branch was deleted by the owner.

#62 bounds /app to 100dvh, keeps footer/header inside the frame, and gives library and PDF their own scroll roots. Mobile library overlays the workspace; desktop retains the split pane. PDF prefetch and actual page visibility use separate observers rooted in the PDF pane. ResizeObserver updates fit dimensions when panels or utilities change size. Home retains document scrolling. #63/#64 remain backlog; no compact icon/popover completion is claimed.

## Viewport acceptance (#62 / PR #66)

Implementation `cb0bc224058f3be2e2b52cf0a36a803fe23dc3fd` passed [Frontend CI 36969595887](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36969595887): 4 pipeline and 55 unit/component tests, lint, formatting, type checks and production build. [Explicit Browser E2E 36969656657](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36969656657) passed 35 Chromium cases at 320/375/768/1024/1440px, including 500px-height viewport bounds, independent pane keyboard scrolling, Escape focus restoration and PDF navigation. [Browser artifact 11211620375](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36969656657/artifacts/11211620375) has seven-day retention.

PR #66 is ready for review; #62 remains open until merge. #63 compact library controls follows, then #64 utility panel and toolbar. This is browser acceptance of the built PR, not evidence of a new production deployment. No workflow files changed.

## Publisher trigger refinement (#67)

#67 is in review in PR #68 before #63: main-only CI subscription, manual previews, no PR-close CI, closed-preview reconciliation during publication and explicit outcomes. Parent #26; related #35/#44/#52. PR #66 is merged; #62 and #61 are completed. Next product work remains #63, then #64. Live trigger/deployment evidence must be recorded after refinement merge.

Refinement acceptance: Frontend CI [36974909774](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36974909774) passed lint/format/tests/types/build; 6 pipeline tests cover coexistence, closed-preview reconciliation, manual preview policy and main build freshness. Local YAML, embedded JavaScript and shell syntax checks passed. Actual trigger suppression and deployment remain post-merge verification in #67.

## SVG identity and live trigger validation (#69)

PR #68 is merged. #69 adds an SVG book/trail mark to home and app, with a second favicon/sizing polish commit. Validate draft open/update CI without publisher or browser runs, then Ready-for-review Browser E2E. The owner will manually publish and merge; those checkpoints remain pending. #63 follows this small UI validation.

Draft PR #70 checkpoint 1: Frontend CI [36975882279](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36975882279) passed at `e98e6c22`. Repository-wide run inspection after CI found no newer publisher or Browser E2E run; latest publisher remained 36975404618 from merged #68. Checkpoint 2 adds a browser-theme-aware SVG favicon and prevents the inline mark from shrinking on narrow layouts. Manual publication/merge remain owner checkpoints.

## Compact library controls (#63)

PR #70 is merged and the owner accepted manual preview and production validation. Main CI 36995614326 and publisher 36995672425 passed; manual preview publisher 36995317258 passed. #69 is completed. #63 is now active: floating closed-panel opener, in-panel refresh/add/close icons and keyboard-accessible source menu. Directory tree space takes priority; scan/selection feedback remains accessible. #64 right utility panel and toolbar is the next separate increment.

## Compact library acceptance (#63 and #72 / PR #71)

PR #71 merged at 2026-10-02T11:02:59Z as 9e5db87a38673651214989053c495270ed9b73df. Its 45 Chromium Browser E2E checks passed in run 36998109332; fast Frontend CI 36998040249 and final docs CI 36998328721 passed before merge. Main Frontend CI 36998853805 passed and production publisher 36998900442 succeeded. Pages metadata identifies the merge source; preview #71 is retired. Issues #63 and #72 are closed as completed.

## Current work: PDF utilities (#64)

Issue #64 and feedback #74/#75/#76 are implemented in PR #73 and ready for review. Frontend CI 37003984005 and all 45 Chromium checks in Browser E2E 37004063603 passed on 7dc80c5. See the feedback section below for scope and acceptance evidence. #13 follows this increment; EPUB #12 remains next-version scope.

## PR #73 preview feedback follow-ups

The search-overlap fix passed all 45 Chromium checks in Browser E2E 37001588269, following clean Frontend CI 37001493878. PR #73 addresses linked feedback: #74 toolbar tooltips/icons/cursors/page input, #75 search result timing and animated popovers (children of #64), and #76 removal of the PDF progress slider (child of #10, related #11/#64). Search opens only the popover; the results panel opens after successful completion, with a busy submit control during execution. Viewer scrolling and numeric/previous/next navigation replace the slider. Zoom SVGs use Lucide's Feather-derived designs with licenses in docs/licenses/lucide.txt; no runtime icon dependency is added. Popovers respect reduced motion. Validation on 7dc80c5: Frontend CI 37003984005 passed install, lint, formatting, tests, type checks and build; Browser E2E 37004063603 passed all 45 Chromium checks across 320/375/768/1024/1440 widths. The focused suite passed 23 checks including pending/failed searches, toolbar order and tooltip accessibility. PR #73 is ready for review; #64/#74/#75/#76 remain open until merge. No automatic PR publishing ran. Manual preview uses Publish website on main with pr_number 73.

## Reopened PDF lifecycle acceptance (#10)

PR #73 merged as 058195008dca9fc6797f035c272801fdd5f0d0f9. Main Frontend CI 37005211269 and tracker reconciliation 37005211500 passed. #64/#74/#75/#76 are delivered in that merge. #10 remains reopened for direct lifecycle regression evidence: replacing an active canvas render, cancelling a text layer, cancelling work before document cleanup/loading-task destruction, rejecting renders after close, and idempotent repeated close. Branch test/10-pdf-lifecycle adds focused service tests; draft CI is the validation gate. Saved PDF positions/bookmarks #13 follows this acceptance increment; EPUB remains deferred.

## Post-merge and lifecycle acceptance — PR #73 / #77

PR #73 merged at 2026-10-02T12:11:18Z as 058195008dca9fc6797f035c272801fdd5f0d0f9. Main CI 37005211269, tracker reconciliation 37005211500 and production publisher 37005270079 passed. Deployment metadata identifies that source and CI run; preview #73 is retired. #64/#74/#75/#76 are completed. This is workflow/metadata evidence, not a new live interactive browser audit.

PR #77 adds the remaining direct lifecycle tests for reopened #10 on test/10-pdf-lifecycle. Frontend CI 37005502235 passed on 13647f6, including new canvas replacement, text-layer cancellation, teardown order and repeated-close tests, plus existing document-switching/viewport disposal coverage. No application behavior changed. #10 remains open until this acceptance PR merges. Next product work is PDF saved positions/bookmarks #13; EPUB #12 stays next-version scope.

## Reader empty-state polish (#82 / PR #83)

PR #83 replaces the remaining seeded demonstration library and sample workspace with the production empty-reader experience requested before v1.0.0. The Library now shows a clear no-documents state that points to the existing + source action; the reader uses the “A quiet space for your next chapter” welcome copy on a document-style canvas. PDF behavior stays unchanged, while selected EPUB files show an explicit Roadmap 2 availability message instead of sample content.

Validation on app commit `542f1339759765e1ad12bd1cbec449fd51991276`: Frontend CI [37009895998](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37009895998) passed lint, formatting, tests, type checks and the production build. Explicit Browser E2E [37010029393](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37010029393) passed all 45 Chromium checks across 320/375/768/1024/1440 widths, including the empty-state flow and collapsed-library opener spacing. Browser evidence artifact: [11227437552](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37010029393/artifacts/11227437552) (seven-day retention). PR #83 is ready for review.

## First-release rendering bug #88

#88 (parent #79) is active on fix/88-pdf-scroll-rendering. Intersection changes previously restarted already-rendered canvases; offscreen viewport changes skipped invalidation, and placeholder geometry differed from final page size. The fix measures intrinsic page geometry without drawing, reserves scaled page bounds, invalidates offscreen pages, and draws only dirty pages. Per-page rendering is serialized; obsolete completions cannot publish state, and canvas/text are hidden until coherent drawing completes. Explicit white canvas background avoids transparent backing. Regression coverage exercises repeat intersections, offscreen resize, invalidation during rendering, and an eight-page real-PDF large-scroll-jump/resize workflow. Automated scrollTop jumps model scrollbar position changes; actual Windows scrollbar drag and the owner's affected document remain manual acceptance checkpoints. No specific PDF or OS/browser was supplied with the initial report.

#88 final review evidence: PR #90 head 14ef8e1 passed Frontend CI 37014694500 and Browser E2E 37014775675 (50 Chromium checks at five widths). The first browser run exposed a hidden last page after utility-panel resize at 1024px; preserving visible-page/end-scroll anchors fixed it without changing the regression. Original affected PDF, actual Windows scrollbar drag, both-theme/zoom preview review and merge remain owner acceptance checkpoints. #88/#79 remain open. Manual preview uses Publish website on main with pr_number 90.

## Additional PDF rendering acceptance (#91/#92)

PR #90 remains on fix/88-pdf-scroll-rendering for the owner's additional report. #91 (parent #79, related #88) preserves the displayed bitmap while a detached canvas/text layer prepares a replacement; it presents a first-render placeholder and adds scroll-event visibility checks as an observer fallback. #92 anchors zoom/fit to the normalized reading point and calculates zoom increments from the actual fit dimensions/current custom zoom, avoiding stale rendered-scale baselines. Native scroll anchoring is disabled inside the PDF pane so explicit anchors own the update. Old text selection is hidden during replacement until the coherent text layer is swapped in. Frontend CI 37017085639 passed on 30a2a8d; fresh browser zoom/fit and scroll regressions plus owner affected-PDF/Windows scrollbar validation are pending. Earlier acceptance evidence predates these changes.

Final #91/#92 review evidence: application head 5d84098 passed Frontend CI 37018694939 and Browser E2E 37018805847 with all 55 Chromium checks passing without retries. A queued resize-anchor race found by browser testing is resolved: newer navigation/zoom/fit or scrollbar movement invalidates older position restoration. Anchors use the actual page under the viewport center and its dimensions. The browser baseline now asserts completed page rendering before measuring reading-point stability. Earlier intermediate passing/failing runs are historical; this evidence supersedes their pending-validation statements. PR #90 is ready for owner affected-PDF/Windows scrollbar preview; #88/#91/#92/#79 remain open until acceptance and merge.

## Scroll tracking and local preview cache (#93/#94)

Additional owner reports are recorded under #79/#88 and implemented in the same draft PR #90. #93 measures visible page overlap on viewer scroll rather than relying solely on observer thresholds; Next/Previous synchronously refresh that state. #94 preloads every page's intrinsic geometry and low-resolution preview before opening the reader. PDF bytes were already read locally. Preview canvas backing pixels have a shared 32 MiB budget and maximum 192px long edge; full-resolution canvases/text remain lazy. This budget covers preview pixels, not total PDF.js/document/high-resolution memory. Cached previews provide immediate page content during scrollbar jumps and are cleared on session close. Preparation is sequential, yields between pages, reports progress and is aborted on document switch/unmount. Opening is slower for long/image-heavy files; the deliberate tradeoff is complete preview coverage before the reader appears. High-resolution drawing retains buffered replacement. Tests cover cache coverage/budget/disposal, preview display and scroll-driven header/navigation; fresh CI/browser and owner affected-PDF/Windows scrollbar checks are required.

Final #93/#94 evidence: PR #90 application head 74012c3 passed Frontend CI 37020773253 and Browser E2E 37020996456 with all 60 Chromium checks passing without retries. Scroll-to-page-six header synchronization, Next/Previous stepping and final-page disabled state are verified at five widths. Cache tests verify per-page coverage, progress, pixel budget and disposal; component coverage verifies immediate cached pixels while full-resolution rendering is pending. Owner affected-PDF/Windows scrollbar, large-document opening and switching checks remain preview acceptance before merge. Previous pending-validation statements are superseded by this result. #79/#88/#93/#94 remain open.

## Large-document performance follow-up (#95)

Current approach in PR #90 supersedes #94's blocking all-page preview preparation. The reader opens after PDF.js loads the document and measures page one; it does not rasterize or measure all 1,000+ pages before opening. Page-one dimensions reserve untouched page slots. Actual dimensions and full-resolution rendering are requested only near the viewport (700px margin). This avoids an eager getPage call for every mounted page. Mixed-size pages are measured when approached; distant slot geometry is initially estimated from page one.

Completed page pixels are downsampled into a 128-entry LRU cache, with a 192px maximum edge (less than 18 MiB of RGBA backing pixels). Cache creation reuses completed drawing rather than rendering every page a second time. Distant displayed canvases/text are released and obsolete in-flight drawing is cancelled. Revisiting a cached page shows its preview while sharp pixels are prepared. The previous bitmap remains visible during zoom replacement. File bytes remain local; this cache budget excludes PDF.js internal/document resources and active full-resolution canvases. An unvisited page shows a rendering placeholder until its first drawing completes; native Chrome performance parity is not claimed.

#95 is a child tracked by reciprocal links/checklists in #79/#88, related to #94. Tests cover 1,001-page opening without rasterization/all-page geometry requests, lazy viewport geometry, bitmap disposal, preview LRU eviction, and a 1,001-page first/last/revisit browser regression. Existing page-field/navigation and zoom/fit regressions remain. Fresh CI/browser evidence and manual affected-PDF acceptance are pending; previous 60-check evidence covers the superseded preload implementation. PR #90 remains draft until fast checks pass. No workflow trigger changes or automatic PR publication are included.

#95 validation: application commit 51bec7edb41436b5b1bf98c85af722f795085140 passed Frontend CI [37032576530](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37032576530): 69 unit tests, 6 pipeline tests, lint, formatting, type checks and production build. Browser E2E [37032676748](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37032676748) passed 61 checks without retries; four duplicates of the long-document test were deliberately skipped at other widths. Existing regressions ran at five widths. The 1,001-page desktop test verifies first-page readiness with fewer than ten allocated displayed canvases, jumping to page 1,001 with synchronized header and selectable text, and revisiting page one. Its complete test duration was 1.9s; this is not a benchmark of the owner's original document. No Publish website run was triggered for this application commit. PR #90 is ready for review. Republish manually using Publish website on main with pr_number 90; original large-PDF/Windows scrollbar, mixed-page-size and document-switch acceptance remain pending. #79/#88/#91/#92/#93/#94/#95 remain open until owner acceptance and merge.

## #84 library usability implementation

The opener uses a left-aligned tooltip below its button, preserving its accessible name and focus behavior. The library is a bounded flex column: header controls sit outside the keyboard-focusable Library documents scroll region. File rows show one truncated label with a complete native hover title and full accessible button name; duplicate relative-path rows are removed. Folder hierarchy/file identity remain intact.

PDF titles are read locally from XMP dc:title with document-info Title fallback, normalized for whitespace/control characters; empty/Untitled/Unknown values use the filename. Metadata enrichment runs sequentially after the discovered file list is published, never measures/renders pages and releases PDF.js loading tasks. Source changes/unmount abort background work and discard late results. EPUB titles are not parsed. New checks cover metadata fallback/cleanup, cancellation ownership, real titled PDFs, viewport-safe opener tooltips and fixed library header at short heights. Draft/fast/browser evidence is pending; preview review and merge remain before closure.

#84 validation: PR #96 head 501ed6a4bfe8b46480838d4e9d0e5e4fd1a59654 passed Frontend CI [37035717706](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37035717706) (76 unit tests, 6 pipeline tests, lint, formatting, types and build) and Browser E2E [37035868237](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37035868237) (66 passed without retries; four intentional duplicate long-document skips). Embedded title/fallback labels, hover and real keyboard tooltip bounds passed at 320/375/768/1024/1440 widths; independent library scrolling/header geometry and existing PDF regressions passed. First browser run 37035363007 failed only the new tooltip test's programmatic-focus setup; corrected tests exercise real hover and Shift+Tab/Tab without weakening bounds assertions. PR #96 is ready for review. No automatic PR publisher ran. Owner preview acceptance remains: Publish website on main with pr_number 96, then review and merge. #84/#79/#1 remain open; #85 is next after this increment is accepted/merged.

## #85 centered loading feedback

A shared LoadingState card fills the available library/PDF region and centers its document icon, soft halo, orbit indicator and concise text. Library messages rotate every 2.5 seconds (“Loading your documents…”, “Thanks for your patience”, “Almost there”). They are decorative/aria-hidden; discovery's live status remains outside the busy list region. Library header controls stay usable and Cancel scan remains in the loading card.

Successful fast discovery keeps library feedback visible for a minimum of three seconds from scan start. Slow scans get no extra three-second delay. Cancellation immediately leaves the busy state and clears the pending delay; new sources/unmount abort old waits. Errors are shown immediately. Partial/completed discovery results can remain available after cancellation. Metadata enrichment begins once successful discovery feedback finishes. PDF opening uses the same centered design with a static document filename and no artificial minimum duration. Reduced-motion preferences disable loader animations; message intervals are cleared on unmount.

Focused timing/lifecycle tests passed locally. Fresh CI/browser/screenshot evidence is pending; #85 stays open for preview acceptance/merge. Workflow triggers remain unchanged and preview deployment stays manual.

## Current reconciliation — merged #97

PR #97 merged as f44d67517ba17053d15e4b420372526a5002a10c. Final Frontend CI 37040435175 passed 83 unit and 6 pipeline tests plus lint/format/types/build. Browser E2E 37040700001 passed 71 checks without retries (four intentional duplicate long-document skips). Main CI 37041483607, reconciliation 37041484160 and production publisher 37041555992 passed; production metadata records f44d675 and source CI 37041483607. Screenshot documentation is being preserved with the combined #86/#87 PR. #85 is completed; #79/#1/#80 remain open. #86 and #87 are the current combined increment; #89 and final regression remain before release.

## #86/#87 combined validation — PR #98

Application/test 14cd505 passed Frontend CI 37044894101 (83 unit and 6 pipeline tests, lint/format/types/build) and Browser E2E 37045007961 (76 passed without retries; four intentionally skipped duplicate long-document checks). New focus/active-mode/transition/reduced-motion/short-height footer checks passed at all five widths. Details and actual UI captures are preserved in [reader-polish.md](../evidence/reader-polish.md). Keep #86/#87 open for manual preview acceptance and merge. Run Publish website on main with pr_number 98. No automatic PR publication ran. Next #89, then final regression/release #80. #79/#1 remain open.

## Current reconciliation — merged #98

PR #98 merged as 376323ce2171eb17f45ecded2f266cf431baa07e. #86/#87 are completed. Main CI 37045669575, issue reconciliation 37045671003 and publisher 37045732211 passed; pages-state metadata identifies production 376323c/source CI 37045669575 and preview #98 is retired. This verifies pipeline/source metadata, not a new interactive production audit. Final application/browser evidence is 14cd505 / Frontend CI 37044894101 / Browser E2E 37045007961 (83 unit, 6 pipeline, 76 browser checks without retries; four intentional duplicate long-document skips). Final screenshots and current documentation are preserved in a docs-only follow-up because #98 was merged during documentation recording. This supersedes historical pending preview/merge statements above. Next #89, then final regression/release #80. #79/#1 remain open; version remains 0.1.0.

## #89 search implementation

Baseline: excerpts use 55/75 characters without highlights and results jump only to the page. Implement shared Unicode/literal/whitespace matching, at most 50 Unicode characters per context side with omitted-context ellipses, safe Vue mark text, wrapped result text and occurrence-based PDF text-layer overlays. Native DOM ranges retain glyph placement; overlays rebuild after rendering and clear on query/source changes. Selecting an occurrence scrolls only the PDF pane once; subsequent zoom/fit follows existing reading-point behavior. Fresh full CI and Browser E2E pending; keep #89/#79 open until acceptance/merge. Workflow refinement chore #100 is deferred to #78.

## #89 validation — PR #101

PR #101 application/test 48c4295 passed Frontend CI 37050069997 (87 unit, 6 pipeline tests, lint/format/types/build) and Browser E2E 37050221708 (81 passed without retries; four intentional duplicate long-document skips). All five search cases passed at 320/375/768/1024/1440 widths, including independent canvas-ink alignment. The final selected-occurrence screenshot was visually inspected and is preserved in [search-highlighting.md](../evidence/search-highlighting.md). An earlier DOM-only alignment test missed displaced native text; the PDF.js CSS contract was corrected. A later test incorrectly required every fit change to keep a selected match visible; visibility is required on result clicks, while fit/zoom retains the existing reading point and preserves alignment. These initial results are superseded by the clean final run. No automatic PR publisher ran. Keep #89/#79 open for manual preview acceptance/merge and final first-release regression. Publish website on main with pr_number 101. #100 remains deferred under Roadmap 2 #78; workflows and version 0.1.0 are unchanged.

## Current reconciliation — merged #101

PR #101 merged as 77b8f311a638ba616a19dea0102833167a5453fa. #89 is completed. Main CI 37050685881, issue reconciliation 37050685625 and publisher 37050755788 passed; pages-state metadata identifies production 77b8f31/source CI 37050685881 and preview #101 is retired. This verifies deployment/source metadata, not an additional interactive production audit. Final application/test 48c4295 passed CI 37050069997 (87 unit, 6 pipeline tests) and Browser E2E 37050221708 (81 passed without retries, four intentional duplicate long-document skips). The selected-occurrence screenshot confirms alignment with painted PDF text. Final documentation evidence follows separately because #101 was merged during recording. #79/#1/#80 remain open for final first-release regression and v1.0.0 preparation; version remains 0.1.0. Chore #100 stays deferred under Roadmap 2 #78.

## v1.0.0 release candidate — #79/#80

All agreed first-release bug groups are merged. The owner confirmed affected-PDF Windows Chrome scrollbar/page/navigation/zoom-fit acceptance on 3 October 2026. The closed-issue audit covered all 46 closed issues and reconciled 59 stale unchecked entries across 13 issues, preserving superseded preload/theme/demo/CI scope accurately. Release preparation is on release/1.0.0: package/lockfile/footer source 1.0.0, changelog and [release records](../releases/README.md). Fresh candidate CI 37053609695 and Browser E2E 37053754669 passed on 31ef715 (87 unit, six pipeline and 81 browser checks without retries; four intentional skips). #79 acceptance is complete and handed off to #80; #80/#1 remain open through reviewed merge, main publication, exact v1.0.0 tag/GitHub release and production verification. Current production remains 0.1.0 / 77b8f31. Roadmap 2 #78/#100 is unchanged.

## Current v1.0.0 deployment reconciliation — merged #103

PR #103 merged as b2eb9328be5147346926e9bbce0960fa777b9e00. Main Frontend CI 37054802868 passed 87 unit/six pipeline tests, lint/format/types and the v1.0.0 production build. Reconciliation 37054803201 and publisher 37054875000 succeeded; Pages upload/deployment ran successfully. Deployment state identifies production b2eb932/source CI 37054802868. The owner confirmed the main deployment footer shows v1.0.0 and SHA b2eb932 on 3 October 2026 (Asia/Kolkata). This is owner UI verification plus source/workflow metadata, not a new exhaustive production browser audit. Final explicit candidate Browser E2E 37053754669 passed 81 checks without retries (four deliberate duplicate long-document skips). Branch inventory contains only main and pages-state; the merged release/1.0.0 branch is already removed. No v1.0.0 tag or GitHub release exists yet; #80/#1 remain open only for tagging/release and final ledger reconciliation. #79 is complete; Roadmap 2 #78/#100 remains deferred until that handoff.

## Final release reconciliation — 3 October 2026

Published stable [v1.0.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v1.0.0) at 2026-10-02T19:55:40Z (3 October 2026, 01:25:40 Asia/Kolkata). GitHub API verifies the lightweight tag directly targets reviewed/deployed merge b2eb9328be5147346926e9bbce0960fa777b9e00. Main CI 37054802868 and publisher 37054875000 passed; owner confirmed production v1.0.0/SHA b2eb932. #79, #80 and first-release roadmap #1 are completed. Roadmap 2 #78 is open and ready; PDF saved positions/bookmarks #13 is the next feature, with #100 publishing maintenance retained as unfinished scope. Historical pending-tag and deferred-handoff entries are superseded by this verification.

Merged documentation PR #104 passed main CI 37056086312 and reconciliation 37056086941. Publisher 37056172706 succeeded with upload/deploy/URL steps skipped for docs-only input. Production remains b2eb932/source CI 37054802868. Tag/release publication created no additional Actions run in the reviewed latest-run listing. #100 retains event-level docs-only publisher filtering for Roadmap 2.

---

[Documentation home](../README.md) · [Next](status-audit.md)

## Bookmark merge and next increment — 4 October 2026

#120 merged as `0b2b5c1`; owner confirmed validation. #115 is completed and its active status label is removed. PDF increments #114/#117/#118/#115 are completed; #13 stays open only for separate format acceptance after #12. Preparation milestone 1 is confirmed closed through #100’s embedded milestone metadata. Reading continuity milestone 2 stays open for #14 and unfinished format scope. Next branch: `feat/14-recent-library-search`, from reconciled main. Prior pending-review/milestone-closure statements are historical and superseded.

## #14 implementation validation

Recent PDF metadata and library filtering are implemented on `feat/14-recent-library-search`. Local lint/format/types, 121 unit/component tests and 10 pipeline tests pass. Frontend CI 37145713723 and Browser E2E 37145782531 passed on `f6d6349`: 102 browser cases, eight intentional skips, no retries. All five recent-library lifecycles and existing PDF regressions passed. [Inspected mobile/desktop captures](../evidence/recent-library.md) are preserved. #121 is ready for owner review. Keep #14 open through review, owner validation and merge. #120 main Frontend CI 37144758631 passed.

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

PR #148 also joins nearby text fragments per line while preserving column gutters, composites each annotation once at a constant opacity, and uses pastel Yellow/Green/Blue/Pink. Active outlines do not darken the fill. Native selection uses translucent blue so canvas text remains visible. Regression checks cover overlapping fragments, line boundaries and column separation. Owner visual acceptance remains pending; verify wrapped paragraphs, selection legibility, active/inactive color consistency, zoom and rotated pages after deployment. Release Browser E2E remains tracked in #145/#28.

### Highlight text contrast and selection follow-up — #151 / #152

PR #148 now uses multiply blending within an isolated PDF page so pastel highlights and native selection preserve dark canvas glyphs. Line-break selection blocks are transparent. Pointer drags defer annotation geometry capture until release (including release outside the reader); keyboard selection remains available. Pointer cancellation, blur and document changes clear drag state. Component regression coverage checks that Save stays disabled during a drag and enables after release. Owner visual verification of contrast and drag smoothness remains pending under #145/#28.
