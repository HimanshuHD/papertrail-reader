# External CPU, process memory and calibration

This manual tool supports #16 and the remaining #250 target calibration. It is
separate from `test:diagnostics:acceptance`, browser CI and manual Visual QA.
It does not add collectors, CPU/GPU claims or an upload path to the application.

## Run

Use Node 24 and a clean checkout of the source being reviewed:

```sh
npm ci
npx playwright install chromium
npm run profile:browser
```

The command builds production and explicitly opted-in diagnostic artifacts and
checks their diagnostic markers. It opens only generated PDF/EPUB fixtures on
local preview servers. It writes a private `summary.json` and readable `report.md`
under `browser-evidence/external-profiling/run-*`, with per-run traces in subfolders.
The folder is ignored by Git. A failed case leaves completed samples/cycles and a
failed status; it does not silently retry, skip the mode or accept a partial run.
Dirty source is recorded and must not be used as a clean published checkpoint.

Default: five repetitions, eight modes, ten mixed-reader cycles per mode. Mode
order rotates. Each mode/repetition launches a fresh Chromium process and context;
there is **no reload within ten cycles**. Every cycle creates PDF and EPUB readers,
waits for readable content, switches back to PDF, navigates to page 12 and closes
both. A fixed real 2.2-second foreground settling window precedes baseline, after
five and after ten observations. It does not simulate five-minute inactivity.
Reader recreation may restore a saved reading location; it is not an OS-cold open.

The modes match the overhead acceptance matrix: production, closed, sampling,
paused, expanded Overview, sampling with sensors, expanded with sensors, paused
with sensors. Sampling is minimized; paused sensor mode stops collection.

PowerShell options (remove environment variables afterwards to restore defaults):

```powershell
$env:PROFILE_REPEATS = '5' # 1..10; one repeat is a smoke test, not calibration
$env:PROFILE_HEADED = 'true' # requires a real desktop; keep foreground/viewport fixed
npm run profile:browser
Remove-Item Env:PROFILE_HEADED
```

The existing `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` override can select an installed
Chromium. Record that choice; it does not provide Firefox, WebKit or Safari evidence.
Missing browser executables fail explicitly.

## Read the report

| Measurement                   | Meaning                                                                                                              | Limits                                                                                                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Matched process CPU seconds   | CDP cumulative CPU differences for the same process ID/type over measured intervals                                  | Includes all threads of each matched process; process churn between polls is missed and reported. Not a CPU sample flame graph.                                                                                                |
| One-core CPU percent          | CPU seconds / actual elapsed seconds × 100                                                                           | 100% means one logical core; multiple threads/processes can exceed 100%. Not percent of the whole machine.                                                                                                                     |
| Process RSS bytes             | Linux `/proc/<pid>/status` resident set, only after checking the process executable matches the launched browser     | Shared resident pages can be counted more than once. Missing/namespace-hidden/exited processes are null. Complete-process peak is null if no complete sample exists. Windows/macOS RSS is explicitly unavailable in this tool. |
| Page JS heap                  | CDP page target used JS heap at baseline, five, ten and sampled peak                                                 | Excludes worker heaps/native buffers, other renderers and physical GPU allocations.                                                                                                                                            |
| Nodes / listeners / documents | CDP page target counters                                                                                             | Counts are diagnostic clues, not retaining-path or leak verdicts.                                                                                                                                                              |
| Trace event categories        | Inclusive count/duration/worst and >50 ms count for fixed scripting/layout/paint/raster/composite names when emitted | Events nest/overlap; do not sum categories into total CPU time. Full raw trace includes thread/worker lanes for inspection. Missing categories are not measured zero.                                                          |
| GPU                           | Unavailable utilization and physical allocation fields, with reason                                                  | GPU-process CPU/RSS remains CPU/host RAM; no VRAM estimate or renderer fingerprint is used.                                                                                                                                    |
| Poll cost                     | External time spent reading one sample                                                                               | A subset of profiler overhead; no claim that it measures total overhead.                                                                                                                                                       |

Only the first repetition per mode captures a trace. `wallTime` excludes those
traced repetitions and reports even-count median, worst and p95 only with at least
20 observations. Every repetition still has process/page metrics polling. Compare
matched instrumentation settings; use `PROFILE_TRACES=false` for a separate
metrics-only pass, not a claim of uninstrumented performance.

Open a local `trace.json` in Chromium DevTools Performance (load profile) or a
compatible trace viewer. Inspect main thread, dedicated workers, long tasks,
layout/paint/raster/compositor work and their ordering. Category totals alone do
not attribute a particular delay to diagnostics. A headless software-rendered
runner cannot establish real-device GPU performance. On a supported desktop use
its GPU/OS profiler and browser task manager alongside the same generated workload;
record tool version, process attribution and sampling interval in private evidence.

## Separate heap investigation

Run separately from natural memory/latency measurement:

```powershell
$env:PROFILE_REPEATS = '1'
$env:PROFILE_HEAPS = 'true'
$env:PROFILE_TRACES = 'false'
npm run profile:browser
Remove-Item Env:PROFILE_REPEATS, Env:PROFILE_HEAPS, Env:PROFILE_TRACES
```

This pass explicitly requests GC and takes page-target heap snapshots at baseline,
after five and after ten cycles, using the same conditions at all checkpoints.
The forced GC and capture affect subsequent work; **do not pool these results with
natural-memory trials**. Load snapshots into DevTools Memory and use Comparison,
Detached nodes, retained size and Retainers to inspect surviving reader objects,
listeners, buffers and detached DOM. Worker heaps require their own target capture.
Existing Blob URL / worker-owner assertions are functional ownership evidence,
not a measurement of physical native/GPU memory. Module caches, selected library
files, bounded previews and deliberate reader retention can explain growth; a
heap increase alone neither proves a leak nor exonerates the application.

## Calibrate #250

`calibration` is a versioned review worksheet grouped by mode and fixed operation
profile. Only completed application observations from passed, untraced, non-GC repetitions are included; automation timings
for listing/open/readiness remain separate. Paused/closed/production modes do not
invent missing application timings. Cold reader creation, restoration after a
saved workspace/expiry and warm selection dispatch must not share thresholds.
The tool keeps unmeasured profiles unconfigured and both proposed threshold
fields null: a baseline percentile is not automatically an acceptable experience.

For each accepted rule record: source/tree and build boundary, browser/environment,
fixture metadata and cache/foreground condition, operation boundary, repetition
count, median/worst/tail, profiler settings/overhead, attention and critical
milliseconds, window/minimum/sustained/recovery settings, rationale and owner
review. Validate chosen rules on an independent run, including recovery and
unsupported/insufficient-data cases. #250's current version-2 local rules remain
labelled provisional until that evidence is accepted; this tool does not rewrite
them or hardcode one machine's observations as universal defaults.

The current generated mixed workload is preparation for calibration. It does not
cover all #16 large-library, image/long-document, scroll/zoom/reflow, native folder,
real five-minute expiry or target-device requirements. Setting those aside does
not complete their acceptance or close #253/#167.

## Privacy and publication

Keep raw reports, traces, heaps, screenshots, process IDs and environment data
private. Even synthetic-document traces can contain paths, local URLs, source and
hardware details. Review/scrub before sharing; publish only safe fixture aggregates
and source identity. No command in this tool uploads results. Do not use real
private documents in a trace intended for publication.

Protocol references: [SystemInfo process CPU](https://chromedevtools.github.io/devtools-protocol/tot/SystemInfo/#method-getProcessInfo),
[page Performance metrics](https://chromedevtools.github.io/devtools-protocol/tot/Performance/),
[Tracing](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/),
[HeapProfiler snapshots](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/#method-takeHeapSnapshot).
