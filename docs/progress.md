# PaperTrail progress

## Current plan — first release and Roadmap 2

PR #98 merged as 376323ce2171eb17f45ecded2f266cf431baa07e. #86/#87 are completed, alongside #85 from #97, #84 from #96 and #88/#91–#95 from #90. Main CI 37045669575, reconciliation 37045671003 and publisher 37045732211 passed. Production metadata records 376323c/source CI 37045669575; preview #98 is retired. This is workflow/source metadata verification, not a new interactive live-site audit.

Current task: v1.0.0 release PR #103 under #80; #79 final regression/acceptance is complete. All agreed bug children are merged; owner Windows Chrome acceptance is confirmed. The complete closed-issue audit, release notes and tagging/deployment runbook are in [docs/releases](releases/README.md). Candidate package/lockfile version is 1.0.0; production remains 0.1.0 until reviewed merge/main publication. #79 is completed; #80/#1 remain open until release/tag/production verification passes; Roadmap 2 #78/#100 stays deferred. Earlier next-task statements below are historical.

Roadmap #1 is now first-release v1.0.0 only. #79 collects reproducible bug children and finishes agreed release blockers; #80 prepares and verifies the release. All other open feature/infrastructure scope moves to Roadmap 2 #78 without being marked complete. #13 follows the first release, not this planning update. Package/footer version remains unchanged. See roadmap.md and first-release-bugs.md.

All earlier sequence/status entries below are historical; this current-plan section supersedes their next-task statements.

Updated: 2 October 2026 (Asia/Kolkata). Parent: #1. Browser-first scope: #30.

Latest merged increment: PR #65, merge commit `3a893344c7e166a7e7f647414412f3032946581d`. PDF feature implementation is from PR #60; #65 verifies browser acceptance and reconciles the PDF-only scope. M0–M3 implementation is merged. #61 browser acceptance is completed in merged PR #65; #62 is active for viewport scrolling, followed by #63–#64 PDF UI refinement. Current release is PDF-only; EPUB #12 is deferred to the next version.

## Issue tracker

| Issue                                                            | Phase         | Work                                                                  | Status                                                               |
| ---------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1)   | Web           | Product roadmap: web-first PaperTrail and later desktop expansion     | In progress — agreed bugs fixed; final regression and release remain |
| [#2](https://github.com/HimanshuHD/papertrail-reader/issues/2)   | Web           | Repository documentation and issue tracking                           | Completed                                                            |
| [#3](https://github.com/HimanshuHD/papertrail-reader/issues/3)   | Web           | Bootstrap Vue 3, Vite and TypeScript                                  | Completed                                                            |
| [#4](https://github.com/HimanshuHD/papertrail-reader/issues/4)   | Desktop later | Integrate Tauri 2 desktop shell                                       | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#5](https://github.com/HimanshuHD/papertrail-reader/issues/5)   | Web           | Configure web code quality, tests and GitHub Actions                  | Completed                                                            |
| [#6](https://github.com/HimanshuHD/papertrail-reader/issues/6)   | Web           | Design tokens, themes and application state                           | Completed                                                            |
| [#7](https://github.com/HimanshuHD/papertrail-reader/issues/7)   | Web           | Split reader layout and accessible app shell                          | Completed                                                            |
| [#8](https://github.com/HimanshuHD/papertrail-reader/issues/8)   | Web           | Browser folder/file selection and permission handling                 | Completed                                                            |
| [#9](https://github.com/HimanshuHD/papertrail-reader/issues/9)   | Web           | Browser document discovery and directory tree                         | Completed                                                            |
| [#10](https://github.com/HimanshuHD/papertrail-reader/issues/10) | Web           | PDF.js reader, navigation and zoom                                    | Completed                                                            |
| [#11](https://github.com/HimanshuHD/papertrail-reader/issues/11) | Web           | PDF search, contents and reader shortcuts                             | Completed                                                            |
| [#12](https://github.com/HimanshuHD/papertrail-reader/issues/12) | Web           | EPUB reader and reflow controls                                       | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#13](https://github.com/HimanshuHD/papertrail-reader/issues/13) | Web           | Browser document identity, saved positions and bookmarks              | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#14](https://github.com/HimanshuHD/papertrail-reader/issues/14) | Web           | Recent documents and library search                                   | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#15](https://github.com/HimanshuHD/papertrail-reader/issues/15) | Web           | Annotations, highlights and reading statistics                        | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) | Web           | Browser performance, reliability and document safety                  | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#17](https://github.com/HimanshuHD/papertrail-reader/issues/17) | Web           | Document tabs and session restoration                                 | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#18](https://github.com/HimanshuHD/papertrail-reader/issues/18) | Web           | Optional split view and annotation export                             | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#19](https://github.com/HimanshuHD/papertrail-reader/issues/19) | Web           | Web release readiness and delivery                                    | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#21](https://github.com/HimanshuHD/papertrail-reader/issues/21) | Web           | Automate post-merge issue and progress reconciliation                 | Completed                                                            |
| [#22](https://github.com/HimanshuHD/papertrail-reader/issues/22) | Web           | Frontend quality checks and test coverage                             | Completed                                                            |
| [#23](https://github.com/HimanshuHD/papertrail-reader/issues/23) | Desktop later | Rust formatting, lint and native test pipeline                        | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#24](https://github.com/HimanshuHD/papertrail-reader/issues/24) | Web           | Incremental browser indexing and cancellation                         | Completed                                                            |
| [#25](https://github.com/HimanshuHD/papertrail-reader/issues/25) | Web           | Directory tree and browser library refresh UI                         | Completed                                                            |
| [#26](https://github.com/HimanshuHD/papertrail-reader/issues/26) | Web           | Web build, HTTPS deployment and release artifacts                     | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#27](https://github.com/HimanshuHD/papertrail-reader/issues/27) | Desktop later | Desktop signing and notarization                                      | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#28](https://github.com/HimanshuHD/papertrail-reader/issues/28) | Web           | Supported-browser release validation                                  | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#30](https://github.com/HimanshuHD/papertrail-reader/issues/30) | Web           | Adopt web-first scope and defer desktop integration                   | Completed                                                            |
| [#31](https://github.com/HimanshuHD/papertrail-reader/issues/31) | Web           | GitHub Pages production and PR preview pipeline                       | Completed                                                            |
| [#32](https://github.com/HimanshuHD/papertrail-reader/issues/32) | Web           | Versioned web releases and promotion policy                           | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#35](https://github.com/HimanshuHD/papertrail-reader/issues/35) | Web           | Deploy PR previews on demand and filter documentation-only publishing | Completed                                                            |
| [#37](https://github.com/HimanshuHD/papertrail-reader/issues/37) | Web           | Browser E2E foundation and selection smoke tests                      | Completed                                                            |
| [#39](https://github.com/HimanshuHD/papertrail-reader/issues/39) | Web           | Improve closed-preview page and link deployed branch in footer        | Completed                                                            |
| [#42](https://github.com/HimanshuHD/papertrail-reader/issues/42) | Web           | Reader shell components and responsive layout                         | Completed                                                            |
| [#43](https://github.com/HimanshuHD/papertrail-reader/issues/43) | Web           | Shell keyboard navigation and status-state presentation               | Completed                                                            |
| [#44](https://github.com/HimanshuHD/papertrail-reader/issues/44) | Web           | Reconcile publishing when GitHub cancels a queued deployment          | Deferred — Roadmap 2 (after v1.0.0)                                  |
| [#46](https://github.com/HimanshuHD/papertrail-reader/issues/46) | Web           | Replace appearance dropdown with light/dark icon toggle               | Completed                                                            |
| [#47](https://github.com/HimanshuHD/papertrail-reader/issues/47) | Web           | Display initial application version in production footer              | Completed                                                            |
| [#49](https://github.com/HimanshuHD/papertrail-reader/issues/49) | Web           | Preserve responsive home page and add Go to app navigation            | Completed                                                            |
| [#52](https://github.com/HimanshuHD/papertrail-reader/issues/52) | Web           | Restore fast automatic CI; browser tests explicit only                | Completed                                                            |
| [#82](https://github.com/HimanshuHD/papertrail-reader/issues/82) | Web           | Reader empty-state and library UI polish                              | Completed                                                            |

## Current application

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

[Roadmap](roadmap.md) · [Architecture](architecture.md) · [Browser checks](browser-testing.md) · [Shell layout](shell-layout.md) · [Branch maintenance](branch-maintenance.md)

## CI policy refinement (#52)

Automatic browser installation/execution is removed in PR #51. Frontend CI retains lint/format/unit/pipeline/type/build validation; Playwright remains explicit. The repository provides a separate Browser E2E workflow triggered only manually or when a draft PR is marked Ready for review. Run 36924070741 passed focus/selection/discovery acceptance; browser execution remains explicit rather than part of automatic CI.

## PDF follow-up tracker

| Issue | Parent | Scope                                                            | Status    |
| ----- | ------ | ---------------------------------------------------------------- | --------- |
| #61   | #11    | Browser acceptance, workflow audit and release reconciliation    | Completed |
| #62   | #10    | Viewport sizing and independent pane scrolling                   | In review |
| #63   | #10    | Floating library toggle, compact header and source dropdown      | In review |
| #64   | #11    | Right utility panel, icon toolbar, filename tooltip and popovers | Backlog   |

Relationships use reciprocal links/checklists; native GitHub sub-issue mutations are not exposed by the connector. PRs stay draft until fast CI is green; marking Ready for review triggers explicit Browser E2E. See [workflow audit](workflow-audit.md) and [deployment evidence](deployment-verification.md).

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

Application/test 14cd505 passed Frontend CI 37044894101 (83 unit and 6 pipeline tests, lint/format/types/build) and Browser E2E 37045007961 (76 passed without retries; four intentionally skipped duplicate long-document checks). New focus/active-mode/transition/reduced-motion/short-height footer checks passed at all five widths. Details and actual UI captures are preserved in [reader-polish.md](reader-polish.md). Keep #86/#87 open for manual preview acceptance and merge. Run Publish website on main with pr_number 98. No automatic PR publication ran. Next #89, then final regression/release #80. #79/#1 remain open.

## Current reconciliation — merged #98

PR #98 merged as 376323ce2171eb17f45ecded2f266cf431baa07e. #86/#87 are completed. Main CI 37045669575, issue reconciliation 37045671003 and publisher 37045732211 passed; pages-state metadata identifies production 376323c/source CI 37045669575 and preview #98 is retired. This verifies pipeline/source metadata, not a new interactive production audit. Final application/browser evidence is 14cd505 / Frontend CI 37044894101 / Browser E2E 37045007961 (83 unit, 6 pipeline, 76 browser checks without retries; four intentional duplicate long-document skips). Final screenshots and current documentation are preserved in a docs-only follow-up because #98 was merged during documentation recording. This supersedes historical pending preview/merge statements above. Next #89, then final regression/release #80. #79/#1 remain open; version remains 0.1.0.

## #89 search implementation

Baseline: excerpts use 55/75 characters without highlights and results jump only to the page. Implement shared Unicode/literal/whitespace matching, at most 50 Unicode characters per context side with omitted-context ellipses, safe Vue mark text, wrapped result text and occurrence-based PDF text-layer overlays. Native DOM ranges retain glyph placement; overlays rebuild after rendering and clear on query/source changes. Selecting an occurrence scrolls only the PDF pane once; subsequent zoom/fit follows existing reading-point behavior. Fresh full CI and Browser E2E pending; keep #89/#79 open until acceptance/merge. Workflow refinement chore #100 is deferred to #78.

## #89 validation — PR #101

PR #101 application/test 48c4295 passed Frontend CI 37050069997 (87 unit, 6 pipeline tests, lint/format/types/build) and Browser E2E 37050221708 (81 passed without retries; four intentional duplicate long-document skips). All five search cases passed at 320/375/768/1024/1440 widths, including independent canvas-ink alignment. The final selected-occurrence screenshot was visually inspected and is preserved in [search-highlighting.md](search-highlighting.md). An earlier DOM-only alignment test missed displaced native text; the PDF.js CSS contract was corrected. A later test incorrectly required every fit change to keep a selected match visible; visibility is required on result clicks, while fit/zoom retains the existing reading point and preserves alignment. These initial results are superseded by the clean final run. No automatic PR publisher ran. Keep #89/#79 open for manual preview acceptance/merge and final first-release regression. Publish website on main with pr_number 101. #100 remains deferred under Roadmap 2 #78; workflows and version 0.1.0 are unchanged.

## Current reconciliation — merged #101

PR #101 merged as 77b8f311a638ba616a19dea0102833167a5453fa. #89 is completed. Main CI 37050685881, issue reconciliation 37050685625 and publisher 37050755788 passed; pages-state metadata identifies production 77b8f31/source CI 37050685881 and preview #101 is retired. This verifies deployment/source metadata, not an additional interactive production audit. Final application/test 48c4295 passed CI 37050069997 (87 unit, 6 pipeline tests) and Browser E2E 37050221708 (81 passed without retries, four intentional duplicate long-document skips). The selected-occurrence screenshot confirms alignment with painted PDF text. Final documentation evidence follows separately because #101 was merged during recording. #79/#1/#80 remain open for final first-release regression and v1.0.0 preparation; version remains 0.1.0. Chore #100 stays deferred under Roadmap 2 #78.

## v1.0.0 release candidate — #79/#80

All agreed first-release bug groups are merged. The owner confirmed affected-PDF Windows Chrome scrollbar/page/navigation/zoom-fit acceptance on 3 October 2026. The closed-issue audit covered all 46 closed issues and reconciled 59 stale unchecked entries across 13 issues, preserving superseded preload/theme/demo/CI scope accurately. Release preparation is on release/1.0.0: package/lockfile/footer source 1.0.0, changelog and [release records](releases/README.md). Fresh candidate CI 37053609695 and Browser E2E 37053754669 passed on 31ef715 (87 unit, six pipeline and 81 browser checks without retries; four intentional skips). #79 acceptance is complete and handed off to #80; #80/#1 remain open through reviewed merge, main publication, exact v1.0.0 tag/GitHub release and production verification. Current production remains 0.1.0 / 77b8f31. Roadmap 2 #78/#100 is unchanged.
