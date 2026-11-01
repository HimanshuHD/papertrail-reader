# Highlight hover scheduling

## Cause and change

Both reader formats used `bindHighlightHover` to invoke a rectangle provider on
every pointer move. EPUB enumerated resolved ranges, called `getClientRects` and
allocated rectangle objects. PDF measured the page box and mapped its saved
normalized rectangles. Display refresh does not require every intermediate event.

The binding now stores the latest target and coordinates and owns at most one
pending animation frame. Each frame verifies that the reader is active and the
target still belongs to the root, requests current rectangles and keeps the
existing ordered first-match behavior. Hover cursor/title changes preserve authored
values and CSS priorities. The delay applies only to the pointer hint; PDF and EPUB
click handling still resolve fresh painted geometry synchronously.

`clear()` invalidates the frame epoch, cancels pending work, releases its target
and restores the hint. Pointer leave/cancellation, highlight repaint, reader
suspension and disposal use this path. Disposal is idempotent and removes all three
root listeners. An obsolete cancelled callback cannot clear a newer frame or
restore a hint. PDF pages receive the workspace active state; EPUB bindings check
the current session's activity/busy state. Frame/chapter replacement disposes the
old binding. EPUB diagnostics include the additional pointer-cancel listener.

## Cache decision

No rectangle cache survives a frame. Scroll, zoom, rotation, resize, typography,
mode changes and highlight edits therefore use fresh geometry on the next hover
pass. Repaint also clears a currently displayed hint. This avoids introducing
cross-frame invalidation dependencies on EPUB author styles, images/fonts or engine
layout. No new per-page scroll listeners or observers are introduced.

The generated comparison shows that coalescing alone removes repeated work within
a burst. It does not establish that caching is unnecessary for ordinary sustained
pointer motion. A future cache should require application profiling that shows
remaining hover work is material and a complete invalidation model. #304's broader
scroll work remains separate.

## Generated browser comparison

Compare staging `11a57a53`'s binding with this branch's binding, transpiled using the
same TypeScript settings into an isolated local headless Chromium page. Use fresh
pages for each repetition. The EPUB-shaped provider measures 1,000 actual DOM
ranges containing two lines each; this browser returned three rectangles per
range, including the line break. The PDF-shaped provider maps 1,000 normalized
rectangles against the current page box. These use the application providers'
geometry/mapping pattern, without loading a publication or PDF engine.

Dispatch 50 pointer moves in one task, then observe two animation-frame boundaries.
Three repetitions per version and provider agreed on all counts:

| Count per burst                      | EPUB before | EPUB after | PDF before | PDF after |
| ------------------------------------ | ----------: | ---------: | ---------: | --------: |
| Synchronous processing passes        |          50 |          0 |         50 |         0 |
| Total processing passes              |          50 |          1 |         50 |         1 |
| Range geometry requests              |      50,000 |      1,000 |          0 |         0 |
| Page-box geometry requests           |           0 |          0 |         50 |         1 |
| Mapped rectangle objects constructed |     150,000 |      3,000 |     50,000 |     1,000 |

These are instrumented provider calls and explicit mapped-object construction
counts, not a count of all JavaScript/browser allocations or bytes. Native Range
results, arrays and one pending-point object per move are not included in the
object column. The isolated page does not measure full application responsiveness,
real pointer-event rates, CPU time, process/GPU RAM or retained-memory changes.
Events spread across separate frames can still require one full pass per frame;
each pass scans all supplied rectangles. No universal performance budget or full
scroll-lag resolution is claimed. Raw measurements remain private.

## Validation

Unit regressions cover latest-event coalescing, ordered overlapping/multiline
hits, fresh changed geometry/identities, detached targets, authored attributes,
late cancelled callbacks, pointer leave/cancel, repeated disposal, suspension and
reactivation. PDF component regressions verify suspension/repaint clearing and
clicks before hover execution. Functional browser cases create saved highlights
in PDF, formatted EPUB and text-only EPUB, verify hit/miss bursts and click before
the pending hover frame. Existing annotation export, long chapter/highlight mode
transitions and final-position persistence coverage also run.

Visual QA remains manual-only. Owner preview review and merged-source staging
cross-browser acceptance are separate from local Chromium functional evidence.
