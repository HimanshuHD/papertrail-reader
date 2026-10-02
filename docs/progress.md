# Project progress

Updated: 2 October 2026 (Asia/Kolkata). Parent: #1. Browser-first scope: #30.

Latest merged increment: PR #65, merge commit `3a893344c7e166a7e7f647414412f3032946581d`. PDF feature implementation is from PR #60; #65 verifies browser acceptance and reconciles the PDF-only scope. M0–M3 implementation is merged. #61 browser acceptance is completed in merged PR #65; #62 is active for viewport scrolling, followed by #63–#64 PDF UI refinement. Current release is PDF-only; EPUB #12 is deferred to the next version.

## Issue tracker

| Issue                                                            | Phase         | Work                                                                  | Status                                                                     |
| ---------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1)   | Web           | Product roadmap: web-first PaperTrail and later desktop expansion     | Backlog |
| [#2](https://github.com/HimanshuHD/papertrail-reader/issues/2)   | Web           | Repository documentation and issue tracking                           | Completed |
| [#3](https://github.com/HimanshuHD/papertrail-reader/issues/3)   | Web           | Bootstrap Vue 3, Vite and TypeScript                                  | Completed |
| [#4](https://github.com/HimanshuHD/papertrail-reader/issues/4)   | Desktop later | Integrate Tauri 2 desktop shell                                       | Deferred - desktop phase |
| [#5](https://github.com/HimanshuHD/papertrail-reader/issues/5)   | Web           | Configure web code quality, tests and GitHub Actions                  | Completed |
| [#6](https://github.com/HimanshuHD/papertrail-reader/issues/6)   | Web           | Design tokens, themes and application state                           | Completed |
| [#7](https://github.com/HimanshuHD/papertrail-reader/issues/7)   | Web           | Split reader layout and accessible app shell                          | Completed |
| [#8](https://github.com/HimanshuHD/papertrail-reader/issues/8)   | Web           | Browser folder/file selection and permission handling                 | Completed |
| [#9](https://github.com/HimanshuHD/papertrail-reader/issues/9)   | Web           | Browser document discovery and directory tree                         | Completed |
| [#10](https://github.com/HimanshuHD/papertrail-reader/issues/10) | Web           | PDF.js reader, navigation and zoom                                    | Completed |
| [#11](https://github.com/HimanshuHD/papertrail-reader/issues/11) | Web           | PDF search, contents and reader shortcuts                             | Completed |
| [#12](https://github.com/HimanshuHD/papertrail-reader/issues/12) | Web           | EPUB reader and reflow controls                                       | Deferred — next version (EPUB) |
| [#13](https://github.com/HimanshuHD/papertrail-reader/issues/13) | Web           | Browser document identity, saved positions and bookmarks              | Backlog |
| [#14](https://github.com/HimanshuHD/papertrail-reader/issues/14) | Web           | Recent documents and library search                                   | Backlog |
| [#15](https://github.com/HimanshuHD/papertrail-reader/issues/15) | Web           | Annotations, highlights and reading statistics                        | Backlog |
| [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) | Web           | Browser performance, reliability and document safety                  | Backlog |
| [#17](https://github.com/HimanshuHD/papertrail-reader/issues/17) | Web           | Document tabs and session restoration                                 | Backlog |
| [#18](https://github.com/HimanshuHD/papertrail-reader/issues/18) | Web           | Optional split view and annotation export                             | Backlog |
| [#19](https://github.com/HimanshuHD/papertrail-reader/issues/19) | Web           | Web release readiness and delivery                                    | In progress — delivery foundation only; product release acceptance remains |
| [#21](https://github.com/HimanshuHD/papertrail-reader/issues/21) | Web           | Automate post-merge issue and progress reconciliation                 | Completed |
| [#22](https://github.com/HimanshuHD/papertrail-reader/issues/22) | Web           | Frontend quality checks and test coverage                             | Completed |
| [#23](https://github.com/HimanshuHD/papertrail-reader/issues/23) | Desktop later | Rust formatting, lint and native test pipeline                        | Deferred - desktop phase |
| [#24](https://github.com/HimanshuHD/papertrail-reader/issues/24) | Web           | Incremental browser indexing and cancellation                         | Completed |
| [#25](https://github.com/HimanshuHD/papertrail-reader/issues/25) | Web           | Directory tree and browser library refresh UI                         | Completed |
| [#26](https://github.com/HimanshuHD/papertrail-reader/issues/26) | Web           | Web build, HTTPS deployment and release artifacts                     | In progress |
| [#27](https://github.com/HimanshuHD/papertrail-reader/issues/27) | Desktop later | Desktop signing and notarization                                      | Deferred - desktop phase |
| [#28](https://github.com/HimanshuHD/papertrail-reader/issues/28) | Web           | Supported-browser release validation                                  | Backlog |
| [#30](https://github.com/HimanshuHD/papertrail-reader/issues/30) | Web           | Adopt web-first scope and defer desktop integration                   | Completed |
| [#31](https://github.com/HimanshuHD/papertrail-reader/issues/31) | Web           | GitHub Pages production and PR preview pipeline                       | Completed |
| [#32](https://github.com/HimanshuHD/papertrail-reader/issues/32) | Web           | Versioned web releases and promotion policy                           | Backlog |
| [#35](https://github.com/HimanshuHD/papertrail-reader/issues/35) | Web           | Deploy PR previews on demand and filter documentation-only publishing | Completed |
| [#37](https://github.com/HimanshuHD/papertrail-reader/issues/37) | Web           | Browser E2E foundation and selection smoke tests                      | Completed |
| [#39](https://github.com/HimanshuHD/papertrail-reader/issues/39) | Web           | Improve closed-preview page and link deployed branch in footer        | Completed |
| [#42](https://github.com/HimanshuHD/papertrail-reader/issues/42) | Web           | Reader shell components and responsive layout                         | Completed |
| [#43](https://github.com/HimanshuHD/papertrail-reader/issues/43) | Web           | Shell keyboard navigation and status-state presentation               | Completed |
| [#44](https://github.com/HimanshuHD/papertrail-reader/issues/44) | Web           | Reconcile publishing when GitHub cancels a queued deployment          | Backlog |
| [#46](https://github.com/HimanshuHD/papertrail-reader/issues/46) | Web           | Replace appearance dropdown with light/dark icon toggle               | Completed |
| [#47](https://github.com/HimanshuHD/papertrail-reader/issues/47) | Web           | Display initial application version in production footer              | Completed |
| [#49](https://github.com/HimanshuHD/papertrail-reader/issues/49) | Web           | Preserve responsive home page and add Go to app navigation            | Completed |
| [#52](https://github.com/HimanshuHD/papertrail-reader/issues/52) | Web           | Restore fast automatic CI; browser tests explicit only                | Completed |

## Current application

Version 0.1.0 is the initial foundation. Home retains its card and includes Go to app; /app provides a responsive sample library/workspace/toolbar. Light/Dark sun/moon preferences persist; System mode is removed. Production footer shows version and source SHA; previews show linked PR/branch/SHA. Browser library scope and PDF core reading/navigation/zoom are implemented. #11 PDF search, outlines/contents, fullscreen and keyboard help are merged in PR #60. Browser acceptance is tracked in #61; PDF UI #62–#64 and PDF persistence #13 follow. EPUB #12 is next-version scope.

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
| #63   | #10    | Floating library toggle, compact header and source dropdown      | Backlog   |
| #64   | #11    | Right utility panel, icon toolbar, filename tooltip and popovers | Backlog   |

Relationships use reciprocal links/checklists; native GitHub sub-issue mutations are not exposed by the connector. PRs stay draft until fast CI is green; marking Ready for review triggers explicit Browser E2E. See [workflow audit](workflow-audit.md) and [deployment evidence](deployment-verification.md).

## Active viewport increment (#62)

PR #65 is merged (`3a893344`) and #61 is completed with 30 Chromium acceptance checks. Main CI 36967881575 and publishers 36967891071/36967920050 passed after merge. The #65 fix branch was deleted by the owner.

#62 bounds /app to 100dvh, keeps footer/header inside the frame, and gives library and PDF their own scroll roots. Mobile library overlays the workspace; desktop retains the split pane. PDF prefetch and actual page visibility use separate observers rooted in the PDF pane. ResizeObserver updates fit dimensions when panels or utilities change size. Home retains document scrolling. #63/#64 remain backlog; no compact icon/popover completion is claimed.

## Viewport acceptance (#62 / PR #66)

Implementation `cb0bc224058f3be2e2b52cf0a36a803fe23dc3fd` passed [Frontend CI 36969595887](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36969595887): 4 pipeline and 55 unit/component tests, lint, formatting, type checks and production build. [Explicit Browser E2E 36969656657](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36969656657) passed 35 Chromium cases at 320/375/768/1024/1440px, including 500px-height viewport bounds, independent pane keyboard scrolling, Escape focus restoration and PDF navigation. [Browser artifact 11211620375](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36969656657/artifacts/11211620375) has seven-day retention.

PR #66 is ready for review; #62 remains open until merge. #63 compact library controls follows, then #64 utility panel and toolbar. This is browser acceptance of the built PR, not evidence of a new production deployment. No workflow files changed.

## Publisher trigger refinement (#67)

#67 is in progress in PR #68 before #63: main-only CI subscription, manual previews, no PR-close CI, closed-preview reconciliation during publication and explicit outcomes. Parent #26; related #35/#44/#52. PR #66 is merged; #62 and #61 are completed. Next product work remains #63, then #64. Live trigger/deployment evidence must be recorded after refinement merge.
