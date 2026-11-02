# EPUB note-marker geometry

## Confirmed cause and implementation

After the engine-report change, every note-indicator update still called
`getClientRects()` for every resolved note, including offscreen notes. Native
keyboard scrolling can schedule substantially more updates than wheel scrolling.
This is distinct from highlight hover, engine location calculation and persistence.

`src/features/epub/note-geometry.ts` now stores chapter-local document-coordinate
rectangles and note IDs/text. It retains no DOM nodes, Ranges or source callbacks.
Rectangles are sorted by top with prefix maximum bottoms, permitting a binary
search followed by a visible-interval scan. Long overlapping rectangles may still
require extra scanning. The original first-visible Range rectangle and annotation
ordering are preserved, including non-monotonic rectangle order in RTL/columns.

`EpubReaderWorkspace.vue` supplies current resolved note ranges only when rebuilding.
Ordinary scrolling reuses numeric geometry, reads the current frame/stage bounds
and converts document coordinates back to marker positions. One pending animation
frame consumes the latest state instead of canceling/replacing that frame on every
event. Blank-note and inactive readers avoid geometry work.

Invalidation covers highlight repaint, typography, frame replacement, resize,
author DOM/text/style mutations, font completion/failure, image load/failure,
nested scrolling and pointer/focus/key states that can change authored CSS.
Reader-owned highlight stylesheet changes are ignored to avoid repaint loops.
The existing ResizeObserver covers host/frame/body sizing. Documents with any
reported Web Animation, including filled finished animations, use the original
fresh lookup; missing animation enumeration also conservatively bypasses caching.
The first update after animation removal is fresh before caching resumes.

Frame replacement and reader disposal clear all numeric metadata, disconnect the
new observer, remove its listeners and cancel pending note work. Hover/click hit
testing, saved selectors, reading capture, zoom and engine reports are unchanged.

## Paired measurement

Both revisions already include engine-report coalescing. The baseline is PR #312
commit `cf5b9a4`; the candidate adds only this note optimization. This is a new
note-only attribution round, not a direct comparison with the earlier engine
report's timings. A private build-time wrapper times note updates and counts
Range rectangle reads only inside them; no probe is shipped in production.

Generated chapter: 1,200 paragraphs, eight inline spans each, eighty notes in early
paragraphs. Each fresh browser context starts at 25%, warms the cache, then sends
twelve wheel inputs or PageDown presses 35ms apart and settles for 350ms. The
outer scroll container has keyboard focus on both sides. Formatted/text modes
have three trials per input/revision: 24 trials total. The final candidate trials
run without concurrent regression suites. Values below are medians; task time is
the CDP main-thread TaskDuration delta over the entire sampling interval.

| Mode/input         | Update calls before → after | Range reads before → after | Note work ms before → after | Main-thread task ms before → after |
| ------------------ | --------------------------: | -------------------------: | --------------------------: | ---------------------------------: |
| Formatted/wheel    |                     12 → 12 |                  960 → 240 |                  17.3 → 5.6 |                        81.9 → 67.9 |
| Formatted/PageDown |                     37 → 36 |                2,960 → 880 |                 60.8 → 21.9 |                      189.5 → 141.1 |
| Text/wheel         |                     12 → 12 |                  960 → 240 |                  17.5 → 6.2 |                        80.3 → 72.3 |
| Text/PageDown      |                     36 → 36 |                2,880 → 960 |                 54.4 → 20.8 |                      176.0 → 148.7 |

The strongest repeatable attribution is fewer note Range reads and less measured
note work. Total task deltas also fell in this final isolated sample, but three
trials and different native animation frame counts do not establish universal
scroll smoothness or input latency. Conservative pointer/focus/layout invalidation
still rebuilds the cache during these workloads. Trials overlapped with functional
suites during preparation were discarded before this final isolated comparison.

The cache trades retained numeric rectangle metadata for fewer repeated DOM reads.
This round does not measure RAM reduction. Metadata scales with resolved note
rectangles and is cleared on invalidation/disposal. No universal responsiveness,
frame-latency, process/GPU RAM or leak-freedom claim follows from these samples.
Owner-specific books may have different CSS, animation and layout costs.

## Validation and manual review

- 615 unit tests across 104 files, 128 pipeline tests, lint/format/type checks and
  production build pass.
- Two new local Chromium functional cases compare marker positions to independent
  fresh Range measurements in formatted/text modes after transforms, font-size
  reflow, nested scrolling and filled animations; note clicks and closure pass.
- 29 existing Chromium functional cases pass with zero retries: long chapters,
  saved highlights, three caret paths with immediate-close persistence, hover,
  typography, RTL, modes, bookmarks, links, warm switching and reload.
- Unit coverage compares indexed results to the original visible-rectangle rule,
  checks ordering, cache reuse, animation fallback, layout invalidation and
  repeated teardown. Functional assertions are not visual QA.

Manually review the following in the PR preview:

1. Open a long EPUB with many notes, including offscreen notes. Scroll slowly and
   rapidly with wheel, PageDown and the scrollbar in formatted and text modes.
   Check that markers stay beside their intended passages and click the right note.
2. Change font size/spacing, resize, toggle side panels and switch modes. Check
   markers after images/fonts finish loading and after chapter changes.
3. Add/edit/delete notes; revisit saved highlights/bookmarks and search targets.
   Check RTL/multi-column and authored animated content when available.
4. Scroll then immediately switch tabs or close/reopen. Verify exact passage,
   highlights and note markers; repeat in split view and warm tabs.
5. Repeat the PDF virtualization checks in `pdf-component-window.md` for combined
   #304 acceptance. Record any book-specific lag separately from these fixtures.

Visual QA remains manual-only. Issue #304 stays open for owner review, source CI,
merge and matching staging acceptance. No merge, release or tag is performed here.
