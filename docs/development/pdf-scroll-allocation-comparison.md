# PDF scroll allocation comparison — 4 November 2026

## Sources and method

Before virtualization: `9c39063127a950c75d4157ee2e1d19885ead08cc`.
After: `3aee460e973221150c49ff125d6cb49b2278c2e9`, whose reader runtime matches
accepted staging `d844270b`. Source trees, build settings, environment context,
private probe hash and raw allocation profiles are recorded privately. Both
production builds exclude diagnostics and use the same installed dependencies.

Five fresh headless Chromium browser/context trials per revision, alternating
revision order by trial. Same 1440 × 900 CSS-pixel viewport, reduced motion,
software graphics and generated 1,001-page text PDF. After first-page readiness
and 300ms settling, start a page-target V8 allocation sampler (16KiB average
interval, including objects collected by major/minor GC). Send twelve wheel
inputs of 500 CSS pixels, 35ms apart, then settle for 750ms. All ten trials moved
exactly 6,000 CSS pixels. Scroll height remained 1,827,256 pixels before/after.

Read page TaskDuration/ScriptDuration/LayoutDuration around that interval and
stop sampling. No explicit GC or heap snapshot. Allocation sampling adds overhead
on both sides; task times are instrumented observations, not ordinary wheel
latency. Estimated allocations include temporary objects; they are not retained
heap, peak live memory, process RSS, native DOM allocation or GPU memory. OS file
cache is uncontrolled. The source range contains other fixes, so this is a paired
runtime comparison rather than proof that every difference belongs to one line.

## Results

Five-trial medians:

| Metric                                | Before | After |
| ------------------------------------- | -----: | ----: |
| Full components initially             |   1001 |     1 |
| Full components after scrolling       |   1001 |     3 |
| PDF-pane DOM elements initially       |   7010 |  2011 |
| PDF-pane DOM elements after scrolling |   7014 |  2027 |
| Page task ms                          |  215.1 | 203.8 |
| Page script ms                        |   16.2 |  16.2 |
| Page layout ms                        |   10.2 |  11.1 |
| Sampled JS allocations, estimated MiB |   2.17 | 23.94 |

Sampled allocation range: 2.10–2.37 MiB before; 23.61–24.94 MiB after. Worst observed page task delta: 233.5ms before and 227.2ms after. Five trials do not establish tail latency or statistical equivalence.

Component/DOM ownership is substantially smaller, consistent with the earlier
retained-JS-heap comparison in `pdf-component-window.md`. Scroll-window task
medians are similar in this sample. However, sampled temporary JS allocation is
much larger after virtualization. It must not be described as a reduction in
allocation pressure or universal scrolling speedup.

## Acceptance and next investigation

This completes the previously missing _comparison_ dimensions for #304's generated
text-PDF workload. It exposes an acceptance decision and a concrete #16 follow-up:
attribute allocation stacks to component creation, full-list VNode reconciliation,
window updates and rendering/text-layer work; use source maps or isolated probes
before choosing a fix. None of those causes has been confirmed by this sample.
Repeat with representative image/mixed-size PDFs and sustained forward/backward
scrolling, then evaluate retained-memory/temporary-allocation tradeoffs against
accepted targets. Do not silently waive this finding to close #304/#16.

Raw profiles and private probe remain private. No new runtime implementation or
memory-reduction claim is made by this measurement increment. Owner manual UI
review and matching integration of the new EPUB edge tests remain separate.
