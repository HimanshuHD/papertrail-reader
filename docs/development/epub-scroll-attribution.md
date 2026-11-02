# EPUB scroll attribution — issue #304

## Baseline investigation

Baseline source is PR #312's PDF increment, `e9f0c4c`. Existing application
location capture is already coalesced by #297. Twelve native wheel inputs in a
generated fragmented chapter still triggered 11–12 engine location calculations.
The installed epub.js 0.3.93 default manager emits `scrolled` after a 20ms timer;
Rendition responds by queuing `manager.currentLocation()` through another frame.
Its scrolled-location mapping enumerates text geometry across the chapter.

An isolated build-time probe attributed the manager callback, manager location
calculation, application `captureLocation`, note positioning and persistence
scheduling separately. Geometry/text traversal counters were collected across
the same workload. CDP layout and main-thread TaskDuration metrics were sampled
independently. Probe modifications are not production code.

Thirty-six baseline trials cover twelve cases with three fresh contexts each:
short chapters; 1,200 paragraphs containing eight inline spans apiece; twelve
long paragraphs; formatted/text-only modes; native caret/forced geometry fallback;
and zero/eighty generated notes. Each trial scrolls to 25%, settles, then sends
twelve 80px wheel inputs about 35ms apart and waits 350ms. Pointer movement is
settled before counters reset. Production diagnostics are disabled in both
revisions; both use identical attribution wrappers and browser/build settings.
The eighty notes occupy earlier paragraphs and are offscreen during this run.

Baseline medians for the eighty-note fragmented chapter:

| Mode / caret path    | Engine location work, ms | Engine Range bound reads | Application capture, ms | Note positioning, ms | Main-thread task delta, ms |
| -------------------- | -----------------------: | -----------------------: | ----------------------: | -------------------: | -------------------------: |
| Formatted / native   |                    533.6 |                   66,858 |                    16.7 |                 29.7 |                      684.6 |
| Formatted / fallback |                    598.4 |                   66,858 |                    20.2 |                 31.6 |                      754.9 |
| Text / native        |                    545.9 |                   61,291 |                    22.3 |                 33.4 |                      734.2 |
| Text / fallback      |                    477.7 |                   66,840 |                    21.9 |                 29.6 |                      628.4 |

Each eighty-note trial also read note Range rectangles 960 times (80 × 12).
Engine work is the dominant confirmed source in these workloads; note geometry
remains a separate repeated cost. The synchronous `onScroll` callback itself is
not the whole engine cost: its delayed location calculation must be included.

These are instrumented stage timings, work counts and browser main-thread task
deltas, not physical CPU utilization, process/GPU RAM or end-to-end input latency.
Stage wall times overlap browser/native work and must not be added to TaskDuration
as independent totals. Scheduling/instrumentation and run-to-run variability
remain. No universal budget follows from three repetitions.

The owner's specific lagging document is not available in this investigation.
The generated workload reproduces substantial engine scroll work but does not
establish that this is the only cause of the reported lag. No automatic visual
QA, arbitrary EPUB block virtualization or new saved-location format is proposed.
Raw documents, probes, timing reports and machine details remain private.

## Isolated engine change

The existing manager subclass now coalesces only the engine's trailing `scrolled`
notification. Live `scroll` events still pass through the installed manager, so
the application retains its independent frame capture and explicit final flush.
Other engine events and initial display/current-location calls are unchanged.

Every scroll cancels the adapter's previous pending report. The engine retains
its own 20ms timer, then the adapter waits another 120ms of quiet before emitting
the latest trailing payload. This is approximately 140ms after the last scroll,
not a universal optimal interval. Engine `relocated` notifications and its own
location object therefore update later during continuous scrolling. Application
reading positions are not delayed by this timer and still flush on lifecycle
boundaries.

Listener removal cancels both timers; stale bound callbacks and reports after
removal/disposal are ignored. The integration is a per-session manager subclass,
with no global event interception or epub.js package modification. Unit tests
execute the installed registration/scroll methods under fake timers and verify
twelve live scroll deliveries, one latest settled report and complete timer
cancellation through removal/rebinding.

This increment deliberately does not introduce a note-geometry cache or remove
EPUB blocks. Notes remain frame-coalesced with fresh rectangles. Any future cache
needs its own layout/font/image/nested-scroll invalidation and ownership tests.

## Matched results and remaining cost

The candidate repeated all 36 baseline trials (72 wheel trials total). Median
results for the eighty-note fragmented chapter:

| Mode / caret         | Engine calculations before → after | Engine Range reads before → after | Engine location ms before → after | Main-thread task ms before → after |
| -------------------- | ---------------------------------: | --------------------------------: | --------------------------------: | ---------------------------------: |
| Formatted / native   |                             12 → 1 |                    66,858 → 5,657 |                      533.6 → 34.7 |                      684.6 → 130.0 |
| Formatted / fallback |                             12 → 1 |                    66,858 → 5,657 |                      598.4 → 30.0 |                      754.9 → 118.6 |
| Text / native        |                             11 → 1 |                    61,291 → 5,657 |                      545.9 → 35.9 |                      734.2 → 119.1 |
| Text / fallback      |                             12 → 1 |                    66,840 → 5,657 |                      477.7 → 36.6 |                      628.4 → 130.9 |

Application location capture remained twelve calls in each of these cases.
Note rectangle reads remained 960; note positioning medians remained roughly
27–30ms. Coalescing engine reports does not eliminate annotation geometry work.

Twelve supplemental trials used the eighty-note formatted/native fixture, three
repetitions per input type/revision. Twelve native PageDown presses or twelve
scroll-offset jumps replaced wheel input. Offset jumps exercise scrollbar-like
position changes, not a physical thumb-drag latency measurement. Actual forward
movement was asserted in both input modes.

| Input               | Engine calculations before → after | Engine location ms before → after | Main-thread task ms before → after |
| ------------------- | ---------------------------------: | --------------------------------: | ---------------------------------: |
| PageDown            |                              3 → 1 |                      165.2 → 97.7 |                      526.5 → 572.8 |
| Scroll-offset jumps |                             12 → 1 |                      642.6 → 64.1 |                      889.1 → 211.4 |

PageDown did **not** improve in the task-time sample. Its native smooth-scroll
animation produced median 41 → 43 note-update frames and 142.7 → 157.2ms of note
work. Frame counts and timing vary, and three repetitions do not establish a
universal keyboard regression or improvement. They do confirm that keyboard
scroll work remains, and that reduced engine callback counts alone are inadequate
evidence of responsiveness. Note-marker geometry was the next measured target; its subsequent implementation
and separate paired results are documented in [epub-note-geometry.md](epub-note-geometry.md).

Layout-duration deltas in the primary eighty-note wheel cases were around
0–0.1ms; this does not establish a layout bottleneck or justify intra-chapter DOM
virtualization. Neither zero-ish layout counters nor passing functionality prove
that other authored books cannot have expensive layout/paint behavior. No RAM,
GPU, frame-latency percentile or complete leak-freedom claim is made.

## Validation and manual checks

Local tracked-source validation passed: 611 unit tests across 103 files, 128
pipeline tests, lint/format/types, and a production build. This increment passed
seven focused PDF functional cases and 26 EPUB functional cases with zero retries.
Coverage includes keyboard-extended PDF selections, replaced inner-page anchors,
EPUB immediate-close persistence through native/alternate/forced-fallback caret
paths, RTL, typography/reflow, modes, bookmarks, links, highlights and warm reload.
The 84 instrumented comparison trials are separate from functional acceptance.

On a local production preview or later ready-for-review preview, manually check:

1. Scroll long formatted/text-only EPUB chapters using wheel, PageDown and the
   scrollbar. Compare books with no notes and many notes, including offscreen notes.
2. Scroll and immediately close/switch tabs, change chapter, typography or mode;
   reopen/reveal the saved passage and verify exact reading continuity.
3. Resize during/after scrolling; check RTL, images, end-of-chapter positions and
   note-marker placement/click targets.
4. Keyboard-extend a cross-page PDF selection, scroll away/back, then clear it;
   use a heterogeneous PDF and check anchors when nearby dimensions resolve.

These counts and results describe the engine-report increment. The subsequent
note-marker increment is documented in [epub-note-geometry.md](epub-note-geometry.md).
Visual QA is manual-only and was not performed by these automated tests. #304
remains open for owner UI review, source CI and matching merged-source staging
delivery. No merge/release/tag is performed here.
