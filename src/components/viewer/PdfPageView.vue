<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PdfDocumentSession, PdfFitMode } from '../../features/pdf/pdf-session'

const props = defineProps<{
  session: PdfDocumentSession
  pageNumber: number
  fitMode: PdfFitMode
  zoom: number
  availableWidth: number
  availableHeight: number
  scrollRoot: HTMLElement | null
}>()

const emit = defineEmits<{
  visibility: [page…8233 tokens truncated…                         |
| [#43](https://github.com/HimanshuHD/papertrail-reader/issues/43) | Web           | Shell keyboard navigation and status-state presentation               | Completed                                                                  |
| [#44](https://github.com/HimanshuHD/papertrail-reader/issues/44) | Web           | Reconcile publishing when GitHub cancels a queued deployment          | Backlog                                                                    |
| [#46](https://github.com/HimanshuHD/papertrail-reader/issues/46) | Web           | Replace appearance dropdown with light/dark icon toggle               | Completed                                                                  |
| [#47](https://github.com/HimanshuHD/papertrail-reader/issues/47) | Web           | Display initial application version in production footer              | Completed                                                                  |
| [#49](https://github.com/HimanshuHD/papertrail-reader/issues/49) | Web           | Preserve responsive home page and add Go to app navigation            | Completed                                                                  |
| [#52](https://github.com/HimanshuHD/papertrail-reader/issues/52) | Web           | Restore fast automatic CI; browser tests explicit only                | Completed                                                                  |

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

| Issue | Parent | Scope                                                            | Status      |
| ----- | ------ | ---------------------------------------------------------------- | ----------- |
| #61   | #11    | Browser acceptance, workflow audit and release reconciliation    | Completed   |
| #62   | #10    | Viewport sizing and independent pane scrolling                   | In progress |
| #63   | #10    | Floating library toggle, compact header and source dropdown      | Backlog     |
| #64   | #11    | Right utility panel, icon toolbar, filename tooltip and popovers | Backlog     |

Relationships use reciprocal links/checklists; native GitHub sub-issue mutations are not exposed by the connector. PRs stay draft until fast CI is green; marking Ready for review triggers explicit Browser E2E. See [workflow audit](workflow-audit.md) and [deployment evidence](deployment-verification.md).

## Active viewport increment (#62)

PR #65 is merged (`3a893344`) and #61 is completed with 30 Chromium acceptance checks. Main CI 36967881575 and publishers 36967891071/36967920050 passed after merge. The #65 fix branch was deleted by the owner.

#62 bounds /app to 100dvh, keeps footer/header inside the frame, and gives library and PDF their own scroll roots. Mobile library overlays the workspace; desktop retains the split pane. PDF prefetch and actual page visibility use separate observers rooted in the PDF pane. ResizeObserver updates fit dimensions when panels or utilities change size. Home retains document scrolling. #63/#64 remain backlog; no compact icon/popover completion is claimed.
