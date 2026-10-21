# Developer diagnostics

Issue #167 adds local diagnostic tooling for #16 investigations. It does not certify
performance budgets, total browser-process memory, or leak freedom.

## Build and open

- `npm run dev` exposes **Developer diagnostics**. Open the button or press
  **Ctrl+Alt+D**. Escape/Close stops sampling and restores focus to the toggle.
- Explicit diagnostic build: `VITE_READER_DIAGNOSTICS=true npm run build`, then
  `npm run preview`. Never use this opt-in flag for a normal published release.
- `npm run build` excludes the panel, recorder and sampler. Query parameters and
  keyboard shortcuts cannot load them. The pipeline build test checks both forms.
- Source SHA is provided build metadata or the checkout HEAD; modified working
  trees are labelled. Environment, package version and random session identity
  are included. A checkout SHA does not certify uncommitted bytes.

The panel is a nonmodal developer region and does not replace reader controls.
Sampling starts on opening, not on application startup. Minimize hides the panel while keeping sampling active so reader controls remain accessible; the Developer diagnostics button expands it again. Pause retains history;
Reset creates a new measurement session and drops late completions. Resource
ownership remains current when paused. Unmount stops observers/timers/listeners.

## Measurements and limitations

| Metric                | Explicit boundary                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| library.scan          | Discovery request through completed/cancelled traversal, including yields                                                              |
| library.first-listing | Request through first supported-document progress notification; not a DOM paint measurement                                            |
| pdf.open-readable     | Workspace open request through first target bitmap/position restoration ready                                                          |
| pdf.render            | Requested page preparation, bitmap and text-layer rendering; cancellation recorded                                                     |
| pdf.navigation        | Page navigation request through target ready bitmap; warm cached pages finish immediately                                              |
| epub.open-readable    | Publication/engine open through initial chapter display and restoration request; not full image/font paint                             |
| epub.chapter          | Chapter request through display and scroll-target application                                                                          |
| epub.reflow           | Typography/viewport layout request through two animation frames; replaced/disposed work is cancelled; not proof of font/image settling |

Tracked resources include viewer sessions, PDF loading-task worker owners, page,
pending-render and preview canvases, preview count/pixel-byte estimate, cached
page dimensions and application-created Blob URLs. `pdfWorkerOwners` is **not** a
real worker-thread count: PDF.js may share/use a fake worker. EPUB engine-internal
resources are not patched or claimed as owned totals. Counters absent from a
snapshot have no registered owner, not a measurement of browser-wide zero.
Preview bytes estimate RGBA backing pixels, not actual GPU/process allocation.

Frame intervals use requestAnimationFrame while foregrounded, not universal FPS.
Long-task durations require PerformanceObserver support and successful setup.
`performance.memory.usedJSHeapSize` is nonstandard JS heap bytes only. Unsupported
readings are null with availability reasons; no fabricated memory/FPS zeros.

For process memory use the browser's Task Manager/process tools; capture DevTools
heap snapshots before/after repeated open/close cycles and compare retained
objects. JS heap is not process, GPU or canvas memory. Record browser/platform,
workload, warm/cold state, repetition and profiling method separately under #16.

## Bounds, privacy and evidence

At most 120 completed timings, 120 samples and 120 pending timings are retained.
Sampling and panel snapshot updates happen once per second. Closed/disposed
owners are released, observers disconnected and scheduled diagnostic reflow
frames cancelled. Hidden mounted readers remain counted until disposal.

**Export local JSON** requests a browser download; it does not confirm that a user
saved it. Schema 1 contains source identity, session, capability labels, numeric
resource/pending/cancellation counters, fixed lifecycle metric names, durations,
outcomes and samples. It excludes document titles, paths, IDs, content, annotation
text, binary data, URLs and arbitrary error messages. There is no telemetry upload.
The generated export Blob URL is released after the browser consumes it.

`samplerOverhead` records measured synchronous sampling/snapshot callback cost
(samples, totalMs, maxMs). It excludes Vue's later DOM flush, animation-frame and
observer callbacks, resource hooks and renderer work; it is not total overhead.
A local Node v24.19.0 recorder-only microbenchmark (21 trials, 1,000 API operations per trial) measured median sampling times of 0.613ms scan-like, 0.436ms PDF/cache-like and 0.234ms EPUB/reflow-like; paused medians were 0.033ms, 0.037ms and 0.016ms. These numbers describe synthetic recorder calls on this host, not file indexing or document rendering.

Run `node scripts/diagnostics-benchmark.mjs` for a reproducible recorder-only
microbenchmark. Its synthetic scan/render/reflow-like API calls are not actual
PDF/EPUB workloads. Full representative-reader overhead validation remains
explicitly pending until browser evidence is captured.

For full evidence compare identical synthetic PDF/EPUB and folder workloads with
panel closed, sampling, and paused; use repeated warm/cold runs, record reader
latency and sampler cost, then close documents and confirm owned counters release.
Preserve exported summaries without adding source file names/content to reports.

## Validation

- `npm run check` covers build exclusion, bounded recorder privacy, real scan
  milestones, PDF cancellation/resource disposal, EPUB open/navigation, capability
  fallback and sampler timer cleanup.
- Browser fixture: `npx playwright test tests/e2e/diagnostics.spec.ts --project=chromium-1440`
  against a default production build verifies the unavailable toggle.
- After an opted-in build, repeat with `E2E_DIAGNOSTICS=true` to exercise mixed
  reader recording, private download, pause/reset and focus restoration.
- Functional browser tests are distinct from manual-only Visual QA. No approved
  image baselines are changed by this feature.

## Initial browser evidence — 21 October 2026

Local isolated headless Chromium 153.0.8010.0 passed the matching production
exclusion case and diagnostic mixed-reader case. The latter exercised a synthetic
three-page PDF, page navigation, EPUB chapter navigation/typography reflow, warm
tab switches, private JSON export, both tab closures and released viewer/worker/
Blob counters, followed by pause/reset/close focus restoration. Minimize keeps
sampling active while leaving reader controls accessible. The normal Playwright
browser download failed; the isolated npm-distributed Chromium harness was used
without changing repository dependencies or workflow configuration.

During that mixed-reader run, two sampling/snapshot callbacks cost 1.70ms total,
1.20ms maximum. This is an observed synchronous callback subset, not total
instrumentation overhead or a process-memory measurement. Repeated representative
warm/cold A/B workloads and other supported engines remain acceptance work;
this initial fixture run does not complete #16 or certify a performance budget.

## Readable dashboard (planned delivery #249)

The default view now groups real readings into Overview, Operations, Resources and Timeline. Build/session/capabilities and raw resource/sample JSON remain under **Technical details**. Keyboard tabs support arrows/Home/End; pause/reset/export/minimize and Ctrl+Alt+D/Escape retain their existing lifecycle semantics.

Operations report last, median, nearest-rank p95 (minimum 20 completed observations), worst and completed count over retained history. Cancelled/failed/unavailable work is excluded from duration statistics and shown separately. This is not a fixed time window. Frame and heap charts contain actual retained samples and preserve unavailable gaps. JS heap is not process RAM; preview pixel bytes are estimates; PDF task owners are not thread counts. A missing resource owner is not a measured browser-wide zero.

Health targets are unconfigured in this increment; no green/red performance verdict is inferred from arbitrary totals. Additional metrics, indicators, baseline comparison and external profiling are sequenced in [the design plan](../design/diagnostics/README.md), linked issues #250–#253 and #16. Prototype values are simulated and never seeded into the application.

### Panel chrome and minimized indicator

Header actions are icon-only Pause/Resume, Minimize and Close; footer actions are Reset and Export. Each uses the shared single-owner accessible custom tooltip, without a native `title`. Technical details is the final keyboard-accessible tab. The header/footer remain visible while panel content scrolls.

The minimized launcher docks flush to the window bottom with rounded top corners only. Its 24px pulse adapts the supplied four staggered 2.4s rings, limiting expansion to the available space. Paused/closed sampling is gray and static; reduced-motion preferences disable the rings too. Green means recording with no sustained detected signal (including initial collection), not a calibrated performance pass. Three consecutive foreground samples at frame interval ≥50ms or long-task sum ≥200ms produce yellow; ≥150ms or ≥1000ms produce red. These are provisional UI signal thresholds, exported with rule version 1, not #16 accepted budgets. A fresh sampling window starts on resume/reset; #250 retains broader operation-specific calibration, hysteresis, pending-age and findings scope.
