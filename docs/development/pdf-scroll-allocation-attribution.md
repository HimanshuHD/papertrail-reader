# PDF scroll allocation attribution — 5 November 2026

Production follow-up: [placeholder reuse, paired measurements and validation](./pdf-placeholder-reuse.md).
The private controls below remain historical diagnostic evidence; the follow-up uses
complete placeholder invalidation and keeps mounted page props live.

## Finding

The previous increase in sampled scroll-time JS allocation reproduces. Source-map
attribution, document-size scaling and private interventions identify document-wide
page-slot rendering as a dominant cause in this generated workload. Keeping few
full `PdfPageView` components mounted does not bound the work of rendering all
lightweight slots whenever workspace state changes.

This is measurement evidence for #16/#304, not a production optimization. The
private controls are intentionally incomplete and must not be shipped as fixes.

## Sources and method

Before: `9c39063127a950c75d4157ee2e1d19885ead08cc`.
Current: staging `366680878b6778715b7cab4667449d30661570e2` (merged #314).
The current reader runtime matches the previous after build; #314 changed profiling,
tests and documentation. Both builds use the installed locked dependencies,
production mode and diagnostics excluded. Hidden source maps are generated for
external attribution; maps and raw profiles are private and not deployed.

Twenty trials rotate four conditions by repeat, five fresh browser/context trials
each. Five fixed-geometry control trials form a separate follow-up block. All use
headless Chromium, software graphics, a 1440 × 900 CSS-pixel viewport, reduced motion
and the same generated text-PDF page content. After first-page readiness and 300ms
settling, sample V8 allocations at a 16KiB mean interval, including objects collected
by minor/major GC. Send twelve 500px wheel inputs 35ms apart, then settle 750ms.
No explicit GC. Each trial moved 6,000px and ended on page 4, without page errors.
The 1,001-page scroll height remained 1,827,256px in all variants. Five repetitions
do not establish tail latency or universal performance budgets.

## Repeated observations

| Condition                                                  | Trials | Sampled allocation MiB, median (range) | Page task ms, median | Full components at end |
| ---------------------------------------------------------- | -----: | -------------------------------------: | -------------------: | ---------------------: |
| Before virtualization, 1,001 pages                         |      5 |                       2.12 (1.66–2.23) |                214.9 |                   1001 |
| Current staging, 1,001 pages                               |      5 |                    23.81 (23.03–24.57) |                236.0 |                      3 |
| Current staging, 31 pages                                  |      5 |                       1.64 (1.35–1.83) |               1007.4 |                      3 |
| Private slot reuse, geometry-version invalidation retained |      5 |                      9.31 (9.12–10.11) |                152.7 |                      3 |
| Private slot reuse, fixed-geometry control                 |      5 |                       4.24 (3.99–4.34) |                148.1 |                      3 |

These are estimated JS allocations during an instrumented window, not retained heap,
peak live memory, process RAM, native DOM allocation or GPU memory. Task deltas are
page-target observations with profiling overhead. The 31-page task-time result is
higher despite fewer sampled allocations; its cause is not established. Do not use
that condition to claim a latency benefit from document-size reduction. Background
work/readiness and timing attribution need separate investigation.

## Source-map attribution

Frame source maps are resolved privately. Leaf/exclusive attribution counts a node's
`selfSize` once, under the allocating frame's source group. Caller-context attribution
counts that byte once for each distinct source group along its stack. Repeated
ancestors in one stack are deduplicated. Context groups overlap and must not be summed
as if they were exclusive totals. Unmapped frames remain explicit.

For current 1,001-page trials, the median workspace slot-render/callback context is
16.06 MiB, about 67.3% of sampled bytes. Median exclusive attribution is 11.96 MiB
in Vue runtime-core and 9.05 MiB in workspace code. Source frames point to
`PdfReaderWorkspace.vue`'s page loop/ref callback and numeric `slotSize` calculations,
with Vue VNode/render processing beneath/around that work. This does not attribute
all unmapped/framework allocation to one application line.

The new external `allocation-profile-summary.mjs` helper aggregates exclusive bytes
and deduplicated caller-context bytes. Tests guard repeated-ancestor double counting,
exclusive-total conservation and invalid sizes. Classification/source-map resolution
is supplied by the analysis caller; its output is private until manually reviewed.

## Separate mechanism probes

Three additional counter probes (without allocation sampling) count workspace updates,
`slotSize` calls and new full-component mount/unmount hooks. They are single diagnostic
observations, not timing repetitions. Development counter calibration runs are excluded.

| Condition                           | Workspace updates | Numeric slot-size calls | Full mounts / unmounts during window |
| ----------------------------------- | ----------------: | ----------------------: | -----------------------------------: |
| Current, 1,001 pages                |                21 |                  41,940 |                                4 / 2 |
| Current, 31 pages                   |                21 |                   1,200 |                                4 / 2 |
| Fixed-geometry control, 1,001 pages |                18 |                       4 |                                4 / 2 |

The difference is exact for these probes: `(1,001 − 31) × 21 × 2 = 40,740` additional
size calls. Each unmounted placeholder calls `slotSize` separately for width and height;
that function computes numeric dimensions and returns a new object. These are not DOM
geometry reads. The loop also creates VNodes, style/attribute data and inline ref
callbacks for the slots. Mount counts are identical, so differing full-component
creation counts do not explain this probe's document-size difference.

`mountedPages`, `pageRenderStates` and `dimensionsVersion` are reactive workspace
state. Updates can rerender the complete page-slot loop. A newly measured page can
increment the shared dimensions revision even when its size matches the document
estimate. This is separate from the earlier shared scroll-listener/observer work.

## Private intervention and production boundaries

The first control adds per-article memoization keyed by mounted membership, render
state and the shared dimensions revision. The fixed-geometry control omits the
shared revision only for this uniform-size fixture. Both preserve final component
count, scroll position/height, page number and DOM element count in this workload.
Their allocation reductions support the slot-presentation mechanism. They do not
establish that the literal control expression is a correct production change.

Those controls omit required general invalidations, including fit/zoom/viewport/spread,
heterogeneous geometry corrections, source generation and mounted-reader annotation,
search, selection/focus and other prop updates. No such runtime change is committed.
A production fix must preserve all of those contracts and measure the additional
retained memo/cache metadata as well as temporary allocations.

## Next implementation and acceptance

Investigate a stable placeholder presentation boundary with correct per-slot geometry
invalidation, while keeping mounted reader components fully responsive to their props.
Evaluate stable ref callbacks and avoiding repeated width/height object calculations.
Do not return to mounting a full component for every page, freeze real reader props,
or introduce arbitrary paragraph/page virtualization to hide the allocation.

Repeat matched allocation/task and retained-memory observations after any fix. Cover
mixed page sizes, zoom/fit/rotation, spreads, distant navigation/restoration, search,
highlights/notes, keyboard/native selections, focus, split view and teardown. Owner
visual QA remains manual. No universal CPU/RAM or leak-freedom claim is made.

## Delivery reconciliation

#314 merged as `3666808`. [Staging integration 42042015713](https://github.com/HimanshuHD/papertrail-reader/actions/runs/42042015713)
passed both browser shards (295 + 297 = 592 passed, 17 skipped), publication, live
identity/critical-asset verification and acknowledgement. The six new EPUB edge
cases passed at all five Chromium widths; Firefox/WebKit coverage remains the
configured supported-reader smoke suite. #304 remains open for owner manual
acceptance and resolution/acceptance of this allocation finding. #16 retains its
broader workloads, retention, CPU/GPU capability and target-calibration requirements.

Raw profiles, maps, probes, machine context and local paths remain private.
