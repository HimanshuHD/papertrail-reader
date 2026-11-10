# PDF placeholder reuse — 8 November 2026

## Cause and implementation

Issue #304's component window released distant `PdfPageView` instances, but each
workspace update still rebuilt every placeholder's VNodes, attributes, style object
and ref closure. Each placeholder also calculated its dimensions twice. The
[allocation attribution](./pdf-scroll-allocation-attribution.md) identified this as
a dominant source of temporary JS allocation in the generated scrolling workload.

`PdfReaderWorkspace.vue` now applies `v-memo` to the stable page articles. This
reuses render output for distant placeholders without adding a component per page.
`slotStyle` calculates width and height together, once on a cache miss.

| Dependency                                          | Reason to update                                                                                         |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Mounted membership                                  | Replace placeholder with page content, or release content back to a placeholder.                         |
| Non-reactive render epoch for mounted slots         | Every workspace update keeps mounted page props, handlers and render state live, including future props. |
| Layout instance and page's measured-size identity   | New document estimates and corrected dimensions invalidate the appropriate presentation.                 |
| Fit mode, zoom, available width/height              | Preserve custom zoom, fit modes, resize and spread geometry.                                             |
| ID prefix and existing document-generation/page key | Preserve split-view identity and reject reuse across document openings.                                  |

`onBeforeUpdate` increments the plain render epoch before rendering. The epoch is
zero in the memo dependencies of unmounted slots, so unrelated workspace changes
do not rebuild their presentation. It is deliberately not a reactive ref, which
would schedule extra updates. `dimensionsVersion` still subscribes the workspace
to asynchronous measurements; each slot compares its own measured-size object,
instead of invalidating all placeholders on every measurement.

The mounted window, proximity tracking, page loading/prefetch policy, selection and
focus retention, page resources and persistence formats are unchanged. Cached
placeholder output stores Vue render metadata; it does not add a document-wide DOM
geometry cache or another full component per page. The page loop still performs
O(total pages) memo checks and retains stable articles/placeholders. This is not
complete spacer-based virtualization or a universal allocation budget.

## Validation

Two new unit regressions fail on unchanged staging: an unrelated workspace update
still performs placeholder size calculations, and a one-page measurement rebuilds
unrelated placeholders. With the fix, unrelated updates skip those calculations,
only the measured placeholder invalidates, and mounted active/search props and
render state remain live. Geometry and ID-prefix changes also invalidate correctly.

The mixed-size browser case now checks a distant, already-measured placeholder at
150% custom zoom, fit page, fit width, a spread and viewport resize before
remounting; its dimensions must match the remounted page. Existing cases cover
1,001-page jumps, odd final spreads, native/keyboard selection retention and
oversized rotated-page horizontal reachability.

Local checks: 617 unit tests in 104 files, 135 pipeline tests, lint, formatting,
types, production build and diff checks pass. **55 browser functional executions
pass with zero retries**: 20 component-window executions across five Chromium
widths; 22 PDF/annotation/hover/retained-tab/restoration/layout cases at 1440px;
eight native cross-page drag cases at 320px; five split-view cases at 1440px.
These use local headless Chromium/software graphics. No automated visual QA.
Firefox/WebKit and the full deployed-source matrix remain staging gates.

One earlier run could not reach a preview in a different command network namespace.
Another overlapped asset rebuilding and failed fetching a removed dynamic-import
asset. Final browser groups ran with an owned preview and stable build; these
setup failures are not reader regressions or successful test evidence.

## Matched measurements

Before: staging `55bceb52143b011c32c3a4f3f26af0f5d424cb13`.
After: `574bd916064ed71ec1c26df9e60602e8cabf71cf` (implementation plus tests;
runtime implementation commit `b0c4faa8e19382c51952a88beb1f2f311bab657c`). Both
use locked dependencies, production builds and diagnostics excluded, with build
identity set to the respective source SHA. No attribution probes modify runtime.

The generated fixture has 1,001 uniform text pages. Both conditions use the same
headless Chromium binary/software graphics, 1440 × 900 viewport and reduced motion.
Each fresh browser/context opens page 1, hides the library, waits for first-page
readiness plus 300ms, then receives twelve native 500px wheel inputs 35ms apart,
followed by 750ms settling. Conditions alternate order by repeat; no tests/builds
run concurrently with measurements. Five allocation trials per condition use
page-target `HeapProfiler.startSampling`, a 16KiB mean interval and inclusion of
objects collected by minor/major GC. Sum all sampled node `selfSize` values. There
is no explicit GC in allocation trials. Task deltas use page-target Performance
metrics over the same input/settling interval.

| Observation                                                       |      Staging before |   Placeholder reuse |
| ----------------------------------------------------------------- | ------------------: | ------------------: |
| Sampled temporary JS allocation, median (range), MiB              | 25.00 (24.79–25.54) |    4.09 (3.52–4.55) |
| Page task delta, median (range), ms                               | 236.7 (218.5–246.4) | 141.3 (116.9–144.4) |
| Full components, initially → after scroll                         |               1 → 3 |               1 → 3 |
| Descendant DOM elements in reading pane, initially → after scroll |       2,011 → 2,027 |       2,011 → 2,027 |
| Scroll movement / final page                                      |         6,000px / 4 |         6,000px / 4 |
| Scroll height                                                     |         1,827,256px |         1,827,256px |

The sampled allocation median is about **84% lower** in this paired workload.
Task deltas are also lower in these trials, with profiler overhead included; this
is not a general input-latency, process-CPU or tail-latency guarantee. Fresh results
are paired here rather than compared numerically with earlier runs on other dates.
The pre-virtualization 2.12MiB historical sample is not a matched third condition
in this run, so this does not claim parity with pre-virtualization allocation.

Three additional fresh-browser trials per condition repeat the workload without
allocation sampling. Explicit GC precedes each retained-heap checkpoint: after
opening/settling, after scrolling/settling, and one second after explicit tab close.
This is V8 page-target used heap, excluding separate PDF-worker/native/GPU memory.

| Post-GC used JS heap, median (range), MiB |      Staging before |   Placeholder reuse |
| ----------------------------------------- | ------------------: | ------------------: |
| Opened                                    | 6.489 (6.487–6.494) | 6.527 (6.524–6.531) |
| After scroll                              | 7.341 (7.340–7.344) | 7.361 (7.359–7.364) |
| After explicit close                      | 6.121 (6.118–6.123) | 6.082 (6.078–6.083) |

Retained heap after scrolling is approximately 0.020MiB higher in this small
sample, consistent with a modest metadata cost, although the aggregate does not
attribute those bytes to memoization alone. There is no demonstrated retained-heap
reduction from this follow-up. Both conditions have zero page slots after close
and identical post-close CDP DOM counters: three documents, 429 nodes and 86 JS
listeners. These are whole-target counters, not ownership/strong-root evidence;
nonzero counters do not themselves identify reader retention. Six closure trials
are not proof of leak freedom or long-session behavior. No page errors occurred
in any of the sixteen measurement trials.

Allocation estimates include collected temporary objects. They do not measure
resident/process RAM, native canvas/DOM allocation, GPU memory or separate PDF
worker allocations. Raw allocation profiles, fixtures and private reports are not
published. The unresolved 31-page timing anomaly, broader representative workloads,
CPU/GPU capability and calibrated targets remain in #16.

## Manual UI review for this follow-up

1. Open a large PDF, scroll normally, jump near the end and return. Check that
   placeholders do not collapse, flash at the wrong size or move the reading point.
2. Use a mixed-size/rotated PDF. Try 150% and 400%, fit width/page, resizing and
   single/two-page mode. Revisit distant pages and the odd final spread; check
   dimensions and horizontal access to oversized pages.
3. Search while the current page remains mounted; move between occurrences.
   Add/select a highlight and edit a note without reopening. Check immediate
   highlight hover/click targets and distant saved-highlight reveal.
4. Drag a selection across page gaps, reverse direction and extend it with the
   keyboard. Scroll away and back before clearing it; verify selected text survives.
5. Switch warm tabs and split panes, resize/swap panes, then close and reopen.
   Verify independent controls, saved zoom, highlights and reading positions.

Owner approval of pre-#315 staging remains recorded in #304. This runtime follow-up
still requires review/merge and matching staging acceptance; the earlier approval
is not represented as approval of these new changes. Broader #16 measurements and
accepted targets remain separate. No merge, release or tag is performed here.
