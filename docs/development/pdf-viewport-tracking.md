# Shared PDF viewport tracking

## Confirmed cause

Every mounted PDF page previously owned a scroll listener, animation-frame
proximity check and two IntersectionObservers. The workspace also scanned every
shell to choose the current page and every page when capturing reading position.
Lazy bitmap rendering did not bound this geometry bookkeeping.

## Ownership and code flow

`PdfReaderWorkspace.vue` creates one `PdfViewportTracker` for its lifetime and
passes its narrow `PdfPageTracking` interface to every `PdfPageView`. The existing
workspace scroll handler schedules tracking; pages no longer listen for scroll or
construct observers. Each page registers its shell and proximity callback on mount
and unregisters on teardown. It still owns rendering, previews, cancellation,
text layers, links and highlights.

`viewport-tracker.ts` owns two shared observers with the previous viewport roots,
700px vertical prefetch margin and visibility thresholds. Observer deliveries and
scroll/layout notifications coalesce into one pending animation frame. The frame
measures a nearby range, updates page proximity and passes the same shell sample
to current-page selection and reading-position capture.

### Find the nearby range

The shell list is ordered by page number. In single-page mode each page is one
row; in two-page mode each adjacent pair forms a row. Rows have ordered,
non-overlapping vertical extents. Binary search finds the first row whose bottom
reaches the expanded viewport, then walks until row tops pass its bottom.

A spread row's bottom is the maximum of its two page bottoms. Individual page
bottoms are not necessarily ordered when adjacent pages have different sizes;
searching them independently could skip a tall page next to a short one.

Each measured rectangle is cached only within that synchronous measurement pass.
There is no persistent geometry cache to become stale after zoom or layout change.
Only nearby pages and pages leaving the nearby set receive proximity callbacks;
binary-search probes read a logarithmic number of distant row rectangles.

Current-page selection keeps the existing vertical-pixel comparison and tie
behavior. Reading-position capture examines actual page content boxes within the
nearby shells, preserving the existing center/nearest-page anchor semantics.
Direct captures outside the scheduled frame take a fresh bounded sample.

### Layout and lifecycle

- Newly measured page dimensions schedule tracking because they can move later
  pages without a scroll event.
- Fit/zoom, container resize, spread changes and tab reactivation schedule another
  measurement after Vue updates the layout. A page jump schedules explicitly even
  if scrolling to its position does not generate an event.
- Observer callbacks carry a root epoch so deliveries from an old root are ignored.
- Page removal unobserves its shell and removes its callback from tracker ownership.
- Reader disposal captures the final reading position first, then cancels the
  tracker frame, disconnects observers and clears entries/root references.
- Workspace diagnostics include the shared observers in owned-observer counts.

## Generated-fixture observations

One matched instrumented local Chromium run per build and fixture compared staging
`ba58165` with this implementation. Both used production builds, the same desktop
viewport and generated text PDFs. After initial rendering/settling, the harness
performed ten 20px scroll increments, 100ms apart, followed by a 200ms observation
interval. A separate distant navigation targeted page 80 or 800 and waited for
rendering and settling.

The same temporary instrumentation counted scroll callback delivery, scheduled
animation frames and rectangle calls. This changes execution cost, so the table
reports work counts, not timing, CPU, FPS or memory improvements. Raw harness
output and local runtime details are not published.

| Observation                                    | 100 pages before | 100 pages after | 1,001 pages before | 1,001 pages after |
| ---------------------------------------------- | ---------------: | --------------: | -----------------: | ----------------: |
| Mounted page components                        |              100 |             100 |              1,001 |             1,001 |
| IntersectionObservers created                  |              200 |               2 |              2,002 |                 2 |
| Scroll callbacks across ten steps              |            1,010 |              10 |             10,020 |                10 |
| Animation frames scheduled across ten steps    |            1,010 |              10 |             10,020 |                10 |
| Page-shell rectangle reads across ten steps    |            2,000 |             147 |             20,020 |               210 |
| Scroll callbacks during distant jump           |              101 |               1 |              1,002 |                 1 |
| Page-shell rectangle reads during distant jump |              301 |              55 |              3,004 |                76 |

Both builds reached the distant target and released the first page's full canvas;
no page errors were observed in these four completed generated-fixture runs.
Counts are workload observations, not universal budgets. Full components remain
mounted, and the browser still tracks registered elements internally. Component
virtualization, canvas backing limits, hover processing and compact text mappings
are separate work.

## Validation and review

Unit coverage checks coalescing and bounded reads on 1,001 generated page shells,
distant jumps, unequal-height spreads, missing IntersectionObserver, root
replacement, stale callbacks and repeated disposal. Component coverage verifies
registration ownership and distant bitmap release without moving rendering into
the tracker. Browser regressions cover rotated page geometry, jumps, zoom, spreads,
resize and distant-position reopening; existing selection/highlight, warm-tab and
reload cases remain part of functional validation.

Manual preview review: open a large PDF; drag its scrollbar to a distant page;
use page input and next/previous; change fit/zoom, toggle spread and resize; reveal
search results and saved highlights; switch tabs and close/reopen. Confirm saved
position/zoom and selection behavior. Visual QA remains manual-only. Other-browser
and merged-source staging acceptance are separate from local Chromium results.
