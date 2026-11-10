# EPUB scroll-time location capture

## Confirmed cause and implementation

The session previously called `captureLocation` synchronously for every scroll.
The UI also requested persistence on every event. Its 300ms storage debounce did
not postpone session-level text/geometry work.

`EpubLocationCapture` owns one pending animation frame per session. Scroll events
mark capture pending; the frame reads the latest position. An explicit
`session.location()` read flushes pending capture synchronously before returning
the cached location. Frame epochs reject cancelled callbacks even if an old
delivery still arrives after cancellation. Navigation, restoration, highlight
jumps and teardown invalidate superseded work.

The UI's scroll-save request is coalesced separately. Without that change,
persistence would call `session.location()` and flush the pending capture again
on every scroll event. Explicit state capture, close/reopen, mode changes and
visibility persistence still obtain the final location. Switching an active tab
away requests immediate persistence; reader disposal captures before removing
the rendition. The existing storage debounce, serialized writes, identity and
saved location schema remain unchanged.

## Lookup changes

- Preserve the existing `caretRangeFromPoint` path and validate its returned text,
  document ownership, UTF-16 offset and viewport intersection.
- Try `caretPositionFromPoint` when the first API is missing or unhelpful.
- If both fail, hit-test a few near-top points in the reading column. A point may
  land in paragraph margins, so probes at 8/24/48px can find a nearby source-text
  scope. Verify visible text inside the scope before accepting it.
- With unavailable/unhelpful hit testing, stream the bounded chapter text walk
  rather than allocating all its text nodes before finding the visible one.
- Preserve image-alt exclusion, image-only element anchors, RTL caret coordinates,
  text quotes, CFI validation and end-of-chapter handling.

The fallback still has a bounded linear worst case for complex author layouts or
unhelpful point APIs. It is not replaced by an unsafe assumption that all EPUB
text geometry is vertically ordered. No persistent geometry cache is introduced;
reflow and DOM replacement use current geometry. Typography only requests the
legacy element-position fallback when a validated modern location is unavailable.

## Generated-fixture comparison

Matched production builds compared staging `4ac845d` with this implementation in
local packaged headless Chromium. Each build/mode ran three times with a fresh
browser. A generated formatted chapter contained 1,200 paragraphs and no saved
annotations. After reaching the middle and allowing settling, the harness
dispatched 50 scroll events in one task and observed the following 200ms.

| Work per 50-event burst                  | Native before | Native after | Forced fallback before | Forced fallback after |
| ---------------------------------------- | ------------: | -----------: | ---------------------: | --------------------: |
| Synchronous text walkers before yielding |            50 |            0 |                    100 |                     0 |
| Text walkers over observation window     |            50 |            1 |                    100 |                     2 |
| Text nodes visited                       |            50 |            1 |                 60,150 |                     2 |
| Range geometry reads in observed frame   |         1,303 |        1,205 |                 31,153 |                 1,211 |

The final three repetitions agreed on these counts. Forced fallback disabled both
caret APIs while retaining point hit testing. Frame Range counts include engine
and other work; they are not attributed exclusively to application capture.
Substantial remaining geometry work in the frame is outside this scoped result.

These are instrumented work counts, not real-wheel latency, CPU, RAM, FPS or a
reproduction of the owner's particular book. A burst in one task demonstrates
coalescing; ordinary scrolling spread across frames still needs a capture when
its position changes. Complex long chapters, engine location mapping and
annotation-heavy geometry remain relevant to #304/#298. No universal performance
budget or complete scroll-lag resolution is claimed. Raw profiles/documents and
private measurement output are not published.

## Functional coverage and remaining acceptance

Regression coverage exercises burst coalescing, immediate flush before a frame,
stale callbacks after cancellation, chapter replacement, close and restoration,
UTF-16 offsets, RTL, image-only locations, native/alternate caret APIs, point hits,
paragraph margins and streaming fallback. Immediate-close browser cases force
native, alternate-caret and geometry paths and verify persisted final ratio and
reopening at the saved passage.

Existing browser coverage includes long paragraphs through typography/panel/reflow
changes, formatted/text-only transitions, reader-sized chapter spacing, chapter
images, highlights, bookmarks, warm tabs, expiry/reactivation and split view.

Owner manual preview review and matching merged-source staging browser acceptance
remain separate from local Chromium evidence. Visual QA stays manual-only. No
PDF virtualization or shared hover-cache changes are part of #297.
