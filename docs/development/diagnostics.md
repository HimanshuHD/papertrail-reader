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
Sampling starts on opening, not on application startup. Pause retains history;
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
