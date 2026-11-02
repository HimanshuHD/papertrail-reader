# PDF component window — issue #304

This increment implements the PDF component-virtualization workstream. Remaining
EPUB engine, annotation-marker and layout profiling is still tracked by #304.

## Cause and architecture

Shared viewport tracking already bounded per-scroll geometry work, but the reader
still mounted one `PdfPageView` per document page. Each retained Vue state,
watchers, an empty canvas, text-layer and overlay containers, and local handlers
even after its large bitmap had been released.

The workspace now keeps a stable lightweight article for every page and mounts
`PdfPageView` only for nearby or interaction-required pages. The article retains
its ID, page number, label and scroll geometry as its contents change. Navigation
and browser scroll targets therefore remain connected across mounting. Distant
articles have one estimated or measured page-shaped div and no canvas/text layer.

`src/features/pdf/page-layout.ts` owns visited-page dimensions independently of
mounted components. Unknown pages use the session's existing first-page estimate;
the layout service does not load PDF pages. Scale calculation still uses
`resolvePdfScale`. Single-page and spread layout continue to use the established
CSS geometry, including unequal row heights and an odd final page. Measurement
updates preserve a captured reading point unless navigation or scrolling has
superseded it. Browser scroll anchoring may already have adjusted the viewport.

`src/features/pdf/page-window.ts` owns nearby and retained page numbers. The mount
set combines the tracker's existing 700px proximity window, the navigation/current
page, the focused page, and selection-required pages. A drag retains encountered
pages; completed forward/backward selections retain their page interval until
cleared. These interaction exceptions deliberately override the ordinary window
size. There is no universal mounted-page cap that silently truncates selections.

`PdfReaderWorkspace.vue` registers stable articles with the existing shared
tracker, changes the mount set only when membership changes, and routes dimension
and render-state events. Setting a distant current page mounts its component
before the existing navigation's next Vue tick and scroll. Search, bookmark,
content-link and saved-highlight readiness/sequence checks continue to operate on
the stable article and its eventual text layer.

`PdfPageView.vue` retains bitmap/text/link ownership and teardown. In managed mode
it does not register a second tracked element. A remount receives cached dimensions
and starts its normal rendering path. Measurements that complete after disposal
are ignored. Unmounting uses the existing render cancellation, sequence guards,
canvas release and listener cleanup. Render state is forwarded to the stable
article; stale state is discarded when a component leaves the mount set.

The zoom field now retains an edit draft through unrelated window/render updates.
Custom zoom remains authoritative when an older page reports a rendered scale.
This prevents rapid edits from being overwritten before Enter/blur commits them.
The 400% limit and backing-density calculation are unchanged.

## Lazy loading and prefetching

Full page components now mount lazily. Page data, canvas and text preparation use
the existing proximity-driven path. Nearby preparation retains the existing
700px margin, two-slot render admission, cancellation and bounded preview cache.
There is no new background sweep, aggressive speculative prefetcher or quality
reduction. Prefetch distance is a heuristic, not a performance/memory budget.

## Generated-fixture measurements

Baseline: staging `9c39063127a950c75d4157ee2e1d19885ead08cc`. Candidate: this PR's
component-window implementation. Both use production Vite builds with diagnostics
disabled, the same generated 1,001-page text PDF, browser executable and viewport.
Three fresh-browser trials per revision follow page 1 → page 900 → page 1. Values
below are medians at the three readable states after animation-frame settling.

| State            | Mounted full pages before → after | Elements inside PDF pane before → after | Retained JS heap delta, KiB before → after |
| ---------------- | --------------------------------: | --------------------------------------: | -----------------------------------------: |
| Initial page 1   |                         1,001 → 1 |                           7,010 → 2,011 |                         14,861.9 → 3,140.3 |
| Distant page 900 |                         1,001 → 2 |                           7,012 → 2,019 |                         14,957.1 → 3,416.1 |
| Return to page 1 |                         1,001 → 1 |                           7,010 → 2,011 |                         14,984.2 → 3,443.5 |

Scroll height remained 1,827,256 CSS pixels in every sampled state/repetition.
Full-page count is observed through the one displayed canvas owned by each mounted
`PdfPageView`; offscreen bitmaps in the baseline were already zero-sized. The
candidate's distant slots have no canvas at all.

Heap deltas use CDP `JSHeapUsedSize` after forced GC relative to the ready empty
application before opening the file. The active reader is intentionally owned by
the application. These deltas include module/session/runtime/index state as well
as component objects; they are not a component-only allocation profile or a
measurement of native DOM, physical process or GPU RAM. No heap snapshots or DOM
handles were retained by the probe. No reader-close leak claim, peak allocation,
CPU reduction, wheel latency or universal percentage saving follows from this
comparison. Remaining runtime state after visiting pages is expected; return-to-
first-page heap need not equal first-open heap. Raw probes/reports stay private.

## Limits and remaining work

- Lightweight articles, parent VNodes and observer targets still scale with total
  page count. This is full-component virtualization, not constant-size spacer DOM.
- Exact dimensions are retained for visited pages. Unknown heterogeneous pages
  still begin with estimates; layout correction and authored document variety
  require manual verification beyond generated fixtures.
- Active selection/focus may retain many full pages and bitmaps. That is an
  intentional interaction exception, not a global memory budget.
- This increment does not optimize EPUB scroll work or alter five-minute inactive
  reader retention. #304 remains open for its remaining work and delivery checks.

## Validation and manual UI checks

Local checks pass: 607 unit tests across 103 files, 128 pipeline tests, lint,
formatting, types and the production build.

Final local Chromium suites passed 44 functional executions (43 distinct cases;
the annotation-tab ownership case appears in two suites), with zero retries. One
legacy long-document case is reserved for the named `chromium-1440` project and
was skipped in the local custom runner; the new 1,001-page component-window case
passed. Expiry and reading-time lifecycle cases use Playwright's accelerated
clock, not a fresh real-time five-minute measurement. Cross-browser staging
acceptance remains pending. No visual inspection is included in these results.

Unit coverage includes window ownership, backwards selection retention, dimension
reuse, managed tracking, late measurement disposal, stale navigation, and zoom
draft preservation. Generated browser coverage exercises 1,001 pages, mixed sizes,
odd spreads, selection retention, high-density 400% rendering, distant jumps,
reopening, search, annotations, links, rotation, tab restoration and split view.

Automated functional checks do not constitute visual QA. On the PR preview:

| Manual action                                                                                  | Expected result                                                                                          |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Scroll a long PDF slowly, quickly and with the scrollbar thumb; jump to distant pages          | Page numbers track reading; nearby pages become readable; no persistent blank region or unintended jump. |
| Reopen a saved position, bookmark, outline link, search result and old highlight               | Correct target mounts and reveals without landing on page 1 first.                                       |
| Use a mixed portrait/landscape PDF; toggle spread mode and resize, including its last odd page | Page aspect ratios, row spacing and reading anchors remain usable.                                       |
| Change zoom rapidly through 25%, 100%, 400%, fit width and fit page                            | Typed zoom survives rendering updates, images retain density and the reading anchor remains stable.      |
| Drag or keyboard-select across pages, scroll away/back, save a note, clear selection           | Selected pages remain mounted; quote/note stays correct; normal windowing resumes after clearing.        |
| Switch warm tabs, use split view, close/reopen and reactivate after five inactive minutes      | Reader state remains document-owned; closing cancels stale work; expiry restores the saved location.     |

Source CI, matching merged-source staging browser acceptance/publication and owner
manual UI review remain delivery requirements. No merge/release/tag is performed
by this implementation workflow.

## Follow-up anchor and keyboard coverage

A queued anchor correction now records page identity and reader generation. If
Vue replaces a placeholder's inner `.pdf-page` before correction, restoration
resolves its replacement through the stable article. A superseding navigation or
reader generation still rejects the old correction. Regression cases replace
that inner element and verify both correction and navigation cancellation.

The selection browser case now uses native Shift+ArrowLeft to extend an existing
cross-page selection, then verifies its exact text survives scrolling away and
releases its pages when cleared. Seven focused PDF functional cases and the
22-case workspace unit file passed for this follow-up; the earlier results above
describe the original increment and are not new timing measurements.

## Oversized-page alignment follow-up

The first staging acceptance of PR #312 failed a 320px Chromium drag precondition
at 270 degrees and 50% zoom. The proposed text endpoint was outside the left edge
before the drag began; retrying produced the same result. Local reproduction
confirmed an application layout defect rather than grounds to relax that assertion.

The old standalone `.pdf-page-shell` had component-scoped
`justify-content: safe center`. Virtualization introduced a `.pdf-page-content`
wrapper and moved the stable `.pdf-page-shell` article into the workspace. Neither
owner received that old scoped rule. Ordinary flex centering allowed oversized
content to overflow into an unreachable negative horizontal scroll region.

The page component now applies safe centering to both its standalone shell and
managed content wrapper. The workspace applies the same rule to its own stable
slot, including the placeholder. Pages that fit remain centered; oversized pages
align to the start so the full page stays reachable through horizontal scrolling.
Page dimensions, zoom, bitmap density and selection logic are unchanged.

The regression test uses a 320px viewport, 270-degree pages and 50% zoom. It checks
that both horizontal edges are reachable when mounted, after replacement with a
placeholder, and after remounting. It also checks complete visibility of the
formerly clipped text and centering after zooming down to 25%. Existing native
cross-page forward/backward drag, gap/re-entry and cancellation assertions remain
intact; the failure was not addressed by widening the test or clamping endpoints.

Validation for this follow-up:

- The original failing native-drag case reproduced locally before the fix and
  passed afterward. A private pre-fix control build also fails the new edge test
  because the mounted page starts outside the reachable left boundary.
- All 60 focused Chromium functional executions passed with zero retries: eight
  rotation/zoom drag combinations plus four component-window cases at each of
  320, 375, 768, 1024 and 1440px. The new edge test explicitly uses 320px in every
  project. These are functional assertions, not automated visual review.
- `npm run check` passed: 615 unit tests / 104 files, 128 pipeline tests,
  lint/format/types. The staging-configured production build and diff check passed.
- The original failed staging run is retained as evidence; local passing tests
  do not retroactively mark that run or deployment successful.

For manual review, use a narrow reader or split pane, rotate to 270 degrees and
set 50% zoom. Pan to both horizontal extremes, select text near each edge, drag
across pages in both directions and return after a distant page jump. Repeat at
higher zoom and then fit/25%; smaller pages should center normally. Review the
same behavior with an oversized mixed-orientation PDF. Visual QA remains manual.

This correctness follow-up makes no additional performance or memory claim. #304
still requires owner review and matching merged-source staging acceptance,
publication and live identity/asset verification before delivery is complete.
