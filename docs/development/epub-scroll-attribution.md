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
