# PDF canvas allocation investigation (#299)

## Scope and current code

This increment adds a manual profiling harness and baseline evidence. It changes
no production rendering behavior, backing resolution, quality or zoom limit.
#299 stays open for strategy comparison, implementation and matched acceptance.

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

## Strategy comparison and next implementation

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

A concurrency cap is the first comparison candidate, not a selected production
policy. Complete matched before/after runs, review latency/quality tradeoffs,
then implement the supported strategy in a focused follow-up PR for #299.

Visual QA remains manual-only. These fixtures do not establish general leak
freedom or accepted CPU/RAM budgets. Broader component virtualization is #304.
