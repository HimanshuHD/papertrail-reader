# Lifecycle and diagnostics baseline — 4 November 2026

## Scope and evidence identity

This is the first focused #16 lifecycle/diagnostics-overhead increment. It does not
complete #16 or establish accepted performance budgets. #304's final owner visual
review remains separate. The paired PDF allocation/scroll comparison is recorded
in [pdf-scroll-allocation-comparison.md](pdf-scroll-allocation-comparison.md),
including its increased temporary-allocation finding.

Measured source: `3aee460e973221150c49ff125d6cb49b2278c2e9`, based on staging
`d844270b`. This branch changes external profiling/test code only; the reader
runtime matches that staging source. The source/tree identity, clean-working-tree
state, build digests/flags, browser/OS and machine context are retained in private
reports. Only fixture-safe methodology and aggregate results are published here.

The existing manual `profile:browser` harness now accepts `PROFILE_MODES` for
focused increments and structured `PROFILE_CHROMIUM_ARGS` for an explicitly
selected browser. Unknown/duplicate modes and malformed flags fail before launch.
Defaults retain the complete eight-mode matrix. No application profiling code or
new CI workload is introduced.

## Method

Natural-memory/latency run: five fresh headless Chromium browser/context trials
per mode, rotating mode order by trial, with a 1440 × 900 CSS-pixel viewport, reduced motion requested and software
graphics. Modes: production instrumentation excluded; diagnostic build with panel
closed; minimized sampling; minimized paused; expanded sampling; and minimized,
expanded and paused variants with optional sensors requested.

Each trial registers the same generated twelve-page text PDF and two-chapter
formatted EPUB (CSS and local illustration), then performs ten PDF-open,
EPUB-open, switch-back, page-12 requests and explicit-close cycles without
reloading. Each cycle closes both readers; this is separate from intentionally
warm inactive-reader retention. Initial open and later reopen timings are recorded
separately. The first PDF open lands on page 1, then requests page 12; later opens restore page 12, so those requests are usually no-ops. First/reopen differences therefore combine cache/module state and destination. EPUB stays in its first chapter. This does not measure repeated distant navigation or chapter switching. Open-to-readable timing includes library/tab UI actions and readiness
assertions; it is not an engine-only timing or physical input latency.

The matched workload window includes fixture registration and 2.2-second settling
at five/ten closes; baseline settling occurs before the window. Browser/context
creation and build time are excluded. The natural run does not force GC or capture
traces/heaps. OS file cache is uncontrolled; later cycles share the browser,
modules and persisted reading state. The five fresh browsers are independent
trials; the ten cycles inside a trial are correlated observations.

CDP process CPU counters are sampled by process identity at roughly one-second
polls. In these runs the active renderer counters stayed zero while page
TaskDuration advanced, so process CPU attribution is unavailable. A reporting guard
now withholds such misleading zero totals. On platforms with valid counters,
matched CPU totals remain a lower bound because short-lived processes can be missed. Page-target TaskDuration/Script/Layout
metrics exclude other targets/workers. Linux process RSS is used only after PID
namespace and executable identity verification; sums include shared resident pages
and are not private memory or total device RAM. A sampled peak may miss a true
peak. GPU-process host RSS does not measure graphics-memory allocation.

Separate production-only trace and forced-GC heap runs retain their own report
identities and are excluded from natural timing/overhead aggregates. Raw files,
profiles, machine details, paths and process identifiers remain private.

## Natural observation results

Five independent trials per mode. Window values are median / worst; memory values are medians at baseline / five / ten closes. RSS is the sum of verified browser-process resident sets, including shared pages. Heap is page-target JS heap without forced GC.

| Mode             | Window seconds median / worst | Page task ms median |    RSS MiB 0 / 5 / 10 | JS heap MiB 0 / 5 / 10 |
| ---------------- | ----------------------------: | ------------------: | --------------------: | ---------------------: |
| production       |                 13.51 / 13.58 |              3570.3 | 394.1 / 607.9 / 628.2 |      6.0 / 19.6 / 21.5 |
| closed           |                 13.50 / 13.60 |              3653.9 | 397.2 / 611.2 / 629.8 |      6.1 / 15.8 / 22.9 |
| sampling         |                 13.50 / 14.55 |              3720.8 | 424.9 / 671.7 / 630.9 |      7.0 / 16.0 / 21.7 |
| paused           |                 12.52 / 13.52 |              3585.7 | 429.4 / 621.3 / 639.3 |      7.4 / 15.7 / 18.9 |
| expanded         |                 14.51 / 14.68 |              4513.9 | 423.2 / 637.0 / 644.4 |      6.9 / 20.9 / 25.9 |
| sampling-sensors |                 13.55 / 14.58 |              3891.5 | 429.2 / 612.0 / 650.9 |      8.2 / 17.7 / 22.7 |
| expanded-sensors |                 14.53 / 15.63 |              4650.7 | 430.3 / 638.3 / 657.4 |      8.2 / 18.4 / 23.8 |
| paused-sensors   |                 13.53 / 13.55 |              3767.6 | 431.5 / 626.1 / 636.7 |      8.6 / 17.4 / 22.2 |

The whole-window timer includes explicit settling and waiting for the one-second sampler loop to drain at checkpoints. Those drain waits can add up to about two seconds per trial and quantize comparisons. **Window differences must not be interpreted as pure diagnostics overhead or calibrated latency budgets.** A future timing harness should cancel idle sampler waits or time the operation region independently.

The page-target task metric excludes workers/other targets and covers a different interval boundary from the window timer. External polling itself took roughly 8–11ms at the per-mode median; that observer cost is part of this instrumented method.

Open-to-readable medians below: first-open values use five observations; reopen values are the median of five within-trial medians (nine correlated reopens each). These include UI automation and restored destinations, so they are not input-latency or engine-only measurements.

| Mode             | First PDF open ms | PDF reopen ms | First EPUB open ms | EPUB reopen ms |
| ---------------- | ----------------: | ------------: | -----------------: | -------------: |
| production       |             410.7 |         257.7 |              374.6 |          281.7 |
| closed           |             390.0 |         257.3 |              376.2 |          281.9 |
| sampling         |             394.5 |         266.1 |              351.6 |          303.0 |
| paused           |             373.1 |         259.4 |              346.6 |          297.7 |
| expanded         |             400.0 |         290.1 |              382.2 |          321.4 |
| sampling-sensors |             397.7 |         268.2 |              381.5 |          307.3 |
| expanded-sensors |             409.9 |         287.4 |              489.7 |          317.8 |
| paused-sensors   |             386.6 |         265.2 |              372.5 |          291.1 |

This current-source comparison is not a before/after memory-reduction experiment. Natural heap growth includes uncollected allocations; process RSS also includes module, allocator, graphics and cache warm-up. Neither establishes a leak.

## Separate attribution and heap observations

One production-only trace trial and one separate production-only forced-GC heap trial passed. Both use the same clean measured source and fixture workload as the natural run; neither is included in its tables.

| Observed trace category       | Count | Inclusive ms | Worst span ms |
| ----------------------------- | ----: | -----------: | ------------: |
| ThreadControllerImpl::RunTask | 57606 |       7899.2 |         168.4 |
| FunctionCall                  |  6642 |        448.2 |          10.5 |
| UpdateLayoutTree              |  1461 |        381.2 |          10.8 |
| Layout                        |   994 |        256.8 |           7.9 |
| Paint                         |  1184 |        153.8 |           2.0 |

No renderer-main RunTask spans over 50ms were observed in this trace.
Recorded task spans also include worker activity. Categories are inclusive and overlap; do not sum them into CPU time. Raster/compositing-specific spans were not present in the selected summary categories, which does not prove absent work. Physical GPU utilization/allocation remains unavailable.

| Forced-GC checkpoint | Page JS heap MiB | Page nodes | Page event listeners |
| -------------------- | ---------------: | ---------: | -------------------: |
| Before readers       |             4.39 |        331 |                   83 |
| After five closes    |             9.85 |        474 |                  100 |
| After ten closes     |            10.66 |        474 |                  100 |

Three heap snapshots were captured privately. These counters document the observation; they are not a retaining-path analysis. No assertion about detached-node strong roots or complete leak freedom is made. Heap-capture/process-RSS peaks are excluded from natural-memory conclusions.

Process CPU counters were rejected as unavailable in all 42 recorded profiling trials: renderer cpuTime remained zero despite advancing page TaskDuration. Post-collection assessment now marks the existing private reports unavailable, and the reporting guard applies to future runs. The trace provides stage attribution, not a substitute process CPU percentage.

## Acceptance ledger and limitations

| Requirement                    | Evidence from this increment                                                                          | Still needed                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Exact-source repeated baseline | Private source/build/environment manifest and safe aggregate report                                   | Additional representative workloads and other engines                                |
| CPU/process memory             | Process CPU unavailable after counter validation; verified sampled RSS and page heap at 0/5/10 closes | Validated OS/process CPU profiling, wider workloads and platform-specific validation |
| GPU                            | Physical GPU utilization/allocation unavailable in this environment                                   | Platform profiler where supported; never substitute canvas estimates                 |
| Diagnostics overhead           | Eight matched lifecycle states, sensors requested separately                                          | Scroll/reflow/library workloads, sensor capability limits, broader devices           |
| Retention                      | Natural checkpoints plus separate forced-GC heap captures                                             | Independent retaining-path/allocation analysis; no leak-freedom conclusion           |
| Accepted budgets               | Observations only                                                                                     | Owner-approved per-operation targets, recovery rules and independent validation      |
| #304 position edge cases       | Six new Chromium functional cases passed locally                                                      | PR merge/matching staging and owner manual review                                    |

The sensor modes record that optional capture was requested. The current summary does not retain per-sensor negotiated capability/results, so it cannot calibrate the cost of each supported sensor.

The workload is small and synthetic. Timing differences can reflect GC, polling,
automation, process churn and native scheduling. A lower median in one mode is
not evidence that diagnostics improve reader performance. Do not derive p95 or
p99 acceptance from five independent trials. A growing natural heap/node counter
can include collectable garbage; snapshots and strong ownership paths must be
analyzed separately. No complete retention diagnosis or universal memory ceiling
is claimed.

Next increments should cover 100/1,000-file library scans; text/image/1,001-page
PDF opening, scrolling, navigation and zoom; long EPUB chapter/mode/reflow work;
then independent retention/allocation analysis and target calibration. Existing
#295–#301 and #304 scoped results remain linked evidence, not substitutes for
those workloads.

## Reproduction and recording

Use Node 24 and installed Playwright Chromium, close unrelated test/build jobs,
and run `npm run profile:browser` manually. For a smaller increment in PowerShell:

```powershell
$env:PROFILE_MODES = 'production,closed'
$env:PROFILE_REPEATS = '5'
$env:PROFILE_TRACES = 'false'
npm run profile:browser
Remove-Item Env:PROFILE_MODES, Env:PROFILE_REPEATS, Env:PROFILE_TRACES
```

Raw reports are written to ignored local browser-evidence storage. Keep them
private; only manually reviewed safe aggregates belong in issues/PRs. Traces and
forced-GC heaps require their own separate runs. Do not combine their samples
with the ordinary run when comparing latency, memory or overhead.
