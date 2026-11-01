# PDF canvas allocation investigation (#299)

## Scope and current code

This increment adds a two-slot render-admission queue per PDF reader, cancellation
guards and a manual profiling harness. Requested backing resolution, quality and
the 400% zoom limit remain unchanged. #299 stays open until owner review, merge
and matching staging acceptance. The original pre-queue baseline is retained
below as historical evidence; the final matched comparison follows it.

`PdfSession.renderPage` in `src/features/pdf/pdf-session.ts` resolves CSS scale,
then computes backing dimensions as `floor(viewportDimension * devicePixelRatio)`.
Both dimensions grow with zoom and density; pixel count therefore grows with the
square of either factor. The code keeps the full requested resolution.

`PdfPageView.renderPage` creates a detached pending canvas, awaits rendering,
resizes the displayed canvas and copies the pending pixels with `drawImage`.
Both canvases exist at the copy boundary. The pending canvas is zeroed in
`finally`; distant displayed bitmaps are released separately. Other nearby page
renders can coexist. The preview cache remains bounded to 128 entries, with a
maximum side of 192 pixels.

## Reproducing the manual probe

Run `npm run profile:pdf-canvases` with the project's Node version and a locally
installed Playwright Chromium. An alternate executable can be selected using
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; `CANVAS_PROFILE_REPEATS` accepts 1–5 and
defaults to 3. This command is not part of CI, Visual QA or the production app.

The script builds a production bundle with diagnostics disabled, serves it on
loopback and creates a fresh browser for each fixture/density/repetition. It
uses only generated 12-page text and image PDF fixtures. The fixed sequence is:

1. Empty workspace baseline and first-page fit opening.
2. Custom zoom at 100%, 200% and 400%.
3. Two-page view at 100%, followed by a jump to page 12.
4. Request 400% and inject an explicit close in a microtask after the next
   detached full-size canvas allocation starts. This is deliberate cancellation
   fault injection, not a real-user latency measurement.
5. Observe closure after at least 600ms and 2.8 seconds.

Each checkpoint allows settling and waits for active page-render states to clear.
The harness asserts page readiness, 400% input acceptance, the distant page's
readiness, release of the first-page displayed canvas and removal of the reader.

Raw JSON stays under ignored `browser-evidence/canvas-profiling`. Reports include
source SHA/tree/dirty state, browser version, scenario and measurement limits.
They are private by default; publish only reviewed generated-fixture aggregates.
The build directory and preview server are cleaned up on success or failure.

## What the recorder measures

- HTML 2D canvas dimension changes and current context-owning canvases. Estimated
  backing bytes are `width * height * 4`; these are not physical allocations.
- Canvas estimates at display-copy boundaries and the pending/displayed pair.
- Dimension-estimate high-water marks, with size/connected-state descriptions.
  No raw document text, DOM paths or canvas pixels are recorded.
- Page JS heap from CDP, without forced collection. This excludes worker heaps,
  native backing stores and GPU allocations.
- Summed process RSS only if every CDP process identity can be matched through
  the local process namespace. Partial matches are reported as unavailable.
  RSS includes shared resident pages; GPU-process RSS is host RAM, not VRAM.
- GPU allocation is explicitly unavailable.

The recorder owns only weak canvas references and plain numeric snapshots. It
never stores canvases or contexts strongly. It instruments prototypes in the
isolated local test page, without production changes. Dimension changes are
observed synchronously; process RSS, where supported, is sampled every 100ms and
can miss short peaks. Instrumentation itself changes workload timing.

Canvas estimates omit engine OffscreenCanvas/worker allocations, compositor
copies and native decoder buffers. They can count default/cleared HTML canvas
dimensions even when the browser has no equivalent committed physical backing.
Peaks reset before zoom, two-page and distant-navigation phases; close checkpoints
retain the distant-navigation/closing window's high-water mark. Settled values
and window peaks must not be conflated.

## Baseline evidence

Source: staging `32233d90cc1c751636b40dbd26d123de3d7d8712`, production diagnostics
excluded. Local packaged headless Chromium; viewport and fixture settings are
fixed by the script. Three repetitions per fixture/density, fresh browser each.
No forced GC, CPU profiling, screenshots or automated visual comparison.

A 612 × 792 point page at custom 400% has a 2448 × 3168 backing at density 1 and
4896 × 6336 at density 2. A single RGBA estimate is 29.58 MiB or 118.34 MiB;
the pending/displayed pair at copying is 59.17 MiB or 236.67 MiB.

The text fixture produced identical custom-zoom estimates in all three repetitions:

| Custom zoom | Density | Settled canvas estimate (MiB) | Transition high-water estimate (MiB) | Largest copy pair (MiB) |
| ----------- | ------: | ----------------------------: | -----------------------------------: | ----------------------: |
| 100%        |       1 |                          3.91 |                                13.37 |                    3.70 |
| 200%        |       1 |                         15.01 |                                29.91 |                   14.79 |
| 400%        |       1 |                         29.80 |                                88.97 |                   59.17 |
| 100%        |       2 |                         15.01 |                                53.15 |                   14.79 |
| 200%        |       2 |                         59.38 |                               118.66 |                   59.17 |
| 400%        |       2 |                        118.55 |                               355.22 |                  236.67 |

The 400% transition high-water snapshot contains one connected and two detached
full-size canvases, plus small previews. This confirms concurrent full-size
backings in this workload; it does not prove every detached canvas is actively
rendering at that instant.

The image fixture's 400% aggregate estimate was 29.97–30.14 MiB settled and
89.14–89.31 MiB at the transition high-water mark for density 1; density 2 was
118.90 MiB settled and 355.57 MiB at the high-water mark. Copy-pair estimates
matched the text fixture. Small engine-created HTML canvases account for the
additional estimated dimensions; these figures still exclude native decoders.

All 12 fault-injected close runs removed the reader and released the full-size
tracked backings by the first settled checkpoint. The text fixture's tracked
canvas estimate was zero at both closure checkpoints. Image runs still exposed
one or two detached default 300 × 150 canvases through weak references, an estimate
of 0.17–0.34 MiB. Their physical backing/retaining ownership was not established;
without independent heap roots this is not a confirmed leak or proof of one.

The injected close window reached a higher estimate than the ordinary zoom
transition: 122.90 MiB at density 1 and 489.00 MiB at density 2 for text. Its
high-water snapshot included four detached full-size canvases and two smaller
connected display canvases. This motivates comparing bounded render starts, but
the injected timing is not a measured real-user peak or a process-RAM result.

Process RSS matching is unavailable in this execution environment. GPU allocation
is unavailable. JS heap is recorded privately as a separate metric and cannot
explain native canvas costs. No physical memory reduction is claimed.

## Strategy alternatives

Prefer comparing quality-preserving scheduling before imposing a pixel ceiling:

- **Bound concurrent pending renders:** evaluate per-session concurrency of one
  and two against this baseline, including distant jumps, two-page latency and
  multiple readers. A session-local cap is not a global tab memory budget and
  does not remove the displayed/pending copy pair.
- **Change canvas commit ownership:** evaluate swapping the completed backing
  into the display instead of copying into a second full-size canvas. This needs
  careful Vue DOM/ref ownership, cancellation and selection/overlay alignment.
- **Backing-pixel limits or tiling:** require explicit quality/product review or
  a larger architecture change. Do not silently lower density, change the 400%
  UI limit or infer a universal budget from this machine/browser/fixture.

The final comparison selects two concurrent pending page pipelines per session.
This reduces pending overlap while retaining better two-page/distant readiness
than the one-slot candidate in these samples. It is an admission policy, not a
byte ceiling or global tab budget. The selected strategy and limits are detailed
below; canvas swapping and tiling remain future alternatives.

Visual QA remains manual-only. These fixtures do not establish general leak
freedom or accepted CPU/RAM budgets. Broader component virtualization is #304.

## Render admission implementation

The follow-up implementation keeps the requested backing dimensions and adds
`PdfRenderSlots`, a session-local FIFO admission queue. `PdfPageView` reserves
before calling the renderer and releases only after its pending canvas dimensions
are zeroed in `finally`. This covers rendering, text-layer preparation and display
commit, including the existing link lookup before pending cleanup.

A waiting page owns a small canvas element but has not requested its 2D context
or assigned full-resolution backing dimensions. Cancellation removes queued
entries immediately. Active cancellation marks the entry obsolete but retains its
slot until cleanup actually finishes; releasing capacity early could exceed the
intended bound while cancelled pixel storage still exists. Releases are idempotent.
Closing rejects queued/new reservations and prevents late releases from restarting
admission. Every session has an independent queue, so multiple warm readers are
not governed by a global memory budget.

The page lifecycle follows this ownership order:

```ts
releaseSlot = await session.reserveRender(pendingCanvas)
// Recheck sequence, disposal and proximity before starting the renderer.
await session.render(request)
// Existing display copy, text layer and link commit.
// finally:
pendingCanvas.width = 0
pendingCanvas.height = 0
releaseSlot()
```

Zoom/layout changes cancel the obsolete reservation as well as an active engine
task. `PdfSession` separates internal engine replacement from public cancellation:
starting the admitted render must not cancel its own reservation. Checks after
asynchronous page/text retrieval reject a cancelled/closed request before it can
allocate backing pixels or start a stale text layer.

Admission covers the workspace page pipeline. Direct low-level `session.render`
callers retain their existing replacement semantics; they must reserve explicitly
to participate in the composite render/commit bound. The production workspace does
so. Unit fixtures without the optional reservation hook retain their existing
mock rendering path.

The private comparison runner derived from the baseline profiler recorded the
selected capacity, working-diff hash and action-to-ready observations before its
settling interval. It sent zoom requests atomically to isolate renderer capacity
from a separate fill/Enter automation race observed in a preliminary run.
Functional UI tests exercise normal typed zoom interaction separately. Preliminary
interrupted or untimed comparisons are excluded from the final policy comparison.
The extended runner source and raw reports remain private after automatic
publication review rejected its process-path/reporting code. The committed manual
command retains the original baseline recorder; it does not include the private
capacity/hash/timing extensions or atomic-request adjustment. The timing table
therefore has a reproduction limitation in addition to the measurement limits.

## Final matched policy comparison

The final comparison ran 48 fresh-browser scenarios: original staging and the
updated pipeline with effectively unbounded (1,000), one and two slots, each with
three repetitions per text/image fixture and density. At most 12 pages exist in
these fixtures, so the 1,000-slot build is a control, not a proposed policy.
All final builds used the same atomic-zoom profiler and production flags. The
updated controls differ only in capacity. Source SHA, capacity and working-diff
hash are recorded privately. Preliminary untimed/interrupted runs are excluded.

The table shows maximum observed window estimates across three repetitions at
density 2, in MiB. They are calculated from observed HTML canvas dimensions.

| Pipeline                                | Text 400% transition | Image 400% transition | Text two-page transition | Image two-page transition | Text injected close | Image injected close |
| --------------------------------------- | -------------------: | --------------------: | -----------------------: | ------------------------: | ------------------: | -------------------: |
| Original staging                        |               355.22 |                355.68 |                    59.49 |                     59.66 |              489.00 |               489.35 |
| Updated cancellation, unbounded control |               237.00 |                237.34 |                    59.49 |                     59.84 |              252.33 |               252.67 |
| One slot                                |               237.00 |                237.34 |                    37.41 |                     37.76 |              134.00 |               134.34 |
| Two slots (selected)                    |               237.00 |                237.34 |                    44.70 |                     45.04 |              252.33 |               252.67 |

Both bounded candidates retain the full-density 400% copy pair (236.67 MiB).
The unbounded updated control also reduces the ordinary zoom peak, so the
cancellation/admission-flow changes account for much of this result; do not
attribute the entire reduction to the capacity limit alone. Two slots further bound pending admission and reduce two-page
transition estimates while allowing both spread pages to progress. Settled
display backings and the copy-pair floor remain.

Action-to-ready observations below are median / worst milliseconds across three
runs at density 2. Settling waits are excluded. They include automation, polling
and instrumentation overhead and are not CPU or real-user latency measurements.

| Fixture / action        | Original staging | Updated unbounded |    One slot |   Two slots |
| ----------------------- | ---------------: | ----------------: | ----------: | ----------: |
| text / open-fit         |      1183 / 1234 |       1367 / 1387 | 1194 / 1211 | 1208 / 1221 |
| text / zoom-400         |          47 / 51 |           39 / 54 |     53 / 56 |     56 / 58 |
| text / two-page-100     |        117 / 124 |           83 / 85 |   170 / 177 |   111 / 116 |
| text / distant-page-12  |         67 / 100 |           81 / 88 |   206 / 212 |    95 / 119 |
| image / open-fit        |      3312 / 3323 |       3257 / 3303 | 3278 / 3292 | 3197 / 3237 |
| image / zoom-400        |          51 / 72 |           46 / 51 |     50 / 51 |     45 / 45 |
| image / two-page-100    |         97 / 130 |           79 / 83 |   128 / 151 |    94 / 110 |
| image / distant-page-12 |        102 / 112 |         110 / 117 |   108 / 209 |   102 / 109 |

Two slots are selected as the memory/readiness compromise for this increment.
One slot reduced some estimates further but delayed two-page/distant readiness
in these samples. This is not an accepted latency budget: only three repetitions
were collected, variants ran in a fixed order (updated control, one, two, then
original), OS caches/background work were uncontrolled, and polling is coarse.
Manual review and staging cross-browser acceptance remain required.

All 48 final scenarios reached 400%, completed distant navigation, released the
first displayed bitmap and closed after allocation began. Full-size tracked
backings cleared at closure checkpoints. Small default-size image canvases remain
weakly observable; no independent retaining-root or physical-memory conclusion is
made. Process RSS and GPU allocation remain unavailable. No pixel ceiling, density
reduction, physical RAM improvement or complete leak freedom is claimed.
