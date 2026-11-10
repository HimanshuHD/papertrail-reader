# Lifecycle profiler timing and sensor evidence

The prior lifecycle timer included the delay while the external poller waited
for its next one-second tick at the five- and ten-close checkpoints. It also
included settling, metric reads and optional GC/heap capture. The resulting
wall-time figures combine reader work and collection overhead.

`startProfilePolling` cancels the idle timer through `AbortController`. Its stop
function joins an active sample before the checkpoint starts. A failed sample
still rejects the join. `profile-browser.mjs` now measures two active segments:
file selection through close five, then the next open through close ten.
The checkpoint records include poll drain and settle/probe time separately.
`workloadTimingForRuns` aggregates passed, untraced, non-GC repetitions only.
Playwright actions and any metric polls that overlap those actions are part of
the active segments. The sample intervals and page task metrics still span the
observation period, including settling. The older whole-window values in
[the lifecycle baseline](./performance-lifecycle-baseline.md) remain historical.

Private report schema 2 retains the exported sampler capabilities and overhead,
responsiveness capabilities, active state, scope, bounded readings and overhead.
These are captured when exporting after the workload. Setup, checkpoint settling
and opening the export UI can contribute to the counters. A sensor can negotiate
successfully and record zero eligible observations. A paused sensor session may
retain setup observations from before it paused. Callback totals measure a subset
of diagnostics costs. The ordinary timing totals and export counters have
different boundaries and should not be subtracted to infer rendering cost.

## Repeated lifecycle comparison

Clean source `5170f59f961c2401c0fafdf13abe3158a68d1fb1` with tree `e77131b660258db3a2dd45bb7bf13f93cd89fa92`.
Reader runtime matches merged staging `1e1e8b0`. Production excludes diagnostics.
The diagnostic build enables them. Both use locked dependencies and production
build settings. Diagnostic build bundle evidence was 106054 bytes larger.

Chromium 153.0.8010.0, headless with software graphics, 1440 × 900 and reduced
motion. Forty ordinary trials use five fresh browsers per mode with rotated mode
order, ten open/switch/close cycles of a generated 12-page PDF and formatted EPUB,
and 2.2-second baseline, five-close and ten-close settles. No trace or explicit
GC in these trials. Native filesystem cache was uncontrolled. All 40 passed the
workload assertions. Five repetitions support medians and worst observations;
p95 is withheld.

| Mode             | Repeats | Active workload median / worst ms | Poll drain median / worst ms | All checkpoint settle/probe median ms |
| ---------------- | ------: | --------------------------------: | ---------------------------: | ------------------------------------: |
| production       |       5 |                   7122.6 / 7230.1 |                  0.43 / 0.56 |                                6633.1 |
| closed           |       5 |                   7115.2 / 7282.9 |                  0.31 / 0.31 |                                6629.6 |
| sampling         |       5 |                   7379.4 / 7658.2 |                  0.31 / 0.38 |                                6630.2 |
| paused           |       5 |                   7076.3 / 7684.0 |                  0.28 / 0.32 |                                6632.7 |
| expanded         |       5 |                   7851.6 / 7908.6 |                  0.33 / 0.40 |                                6631.7 |
| sampling-sensors |       5 |                   7357.0 / 7378.4 |                  0.23 / 0.34 |                                6625.9 |
| expanded-sensors |       5 |                   7970.4 / 8313.4 |                  0.29 / 3.19 |                                6628.3 |
| paused-sensors   |       5 |                   7263.9 / 7586.4 |                  0.31 / 0.33 |                                6630.5 |

The largest total drain across the two close checkpoints was 3.19ms.
Expanded modes had higher observed active medians than production in this
fixture. These intervals include browser automation and ordinary external metric
polling. Five repetitions on one browser establish a scoped comparison and leave
representative-workload overhead and independent target calibration open.

| Mode             | RSS baseline / after 5 / after 10 MiB, medians | Sampled RSS peak MiB, median | Page JS heap baseline / after 5 / after 10 MiB, medians |
| ---------------- | ---------------------------------------------: | ---------------------------: | ------------------------------------------------------: |
| production       |                          395.1 / 609.2 / 628.9 |                        648.5 |                                       6.0 / 15.6 / 21.5 |
| closed           |                          396.3 / 617.0 / 633.7 |                        649.5 |                                       6.1 / 15.6 / 21.7 |
| sampling         |                          423.8 / 617.2 / 631.2 |                        656.5 |                                       6.9 / 16.0 / 20.9 |
| paused           |                          426.5 / 621.5 / 645.3 |                        669.2 |                                       7.4 / 17.2 / 22.0 |
| expanded         |                          422.8 / 635.1 / 644.9 |                        645.7 |                                       6.9 / 19.6 / 25.4 |
| sampling-sensors |                          430.4 / 623.6 / 647.1 |                        668.6 |                                       8.1 / 17.6 / 22.6 |
| expanded-sensors |                          430.6 / 639.6 / 658.5 |                        658.5 |                                       8.2 / 25.0 / 25.9 |
| paused-sensors   |                          431.5 / 619.3 / 637.8 |                        642.2 |                                       8.6 / 15.9 / 20.7 |

RSS sums verified browser-process resident samples and includes shared pages.
Peaks use complete coverage samples; between-poll peaks can be missed. The page
heap observations use natural GC. The increase between checkpoints warrants
separate forced-GC and root analysis. GPU-process RSS measures host memory.
CDP renderer CPU counters were unavailable in 39 of 40 trials. One production
trial showed an advancing renderer counter. Coverage is insufficient for a mode
comparison. Physical GPU utilization and allocation are unavailable in this run.

All sensor-requested runs negotiated Event Timing, Long Animation Frames and
Resource Timing in this browser. Scope is the current frame. Paused sensors
export the negotiated capabilities and any retained setup observations.

| Mode             | Export state | Retained inputs / frames / resources, medians | Observer callbacks, median | Observer callback total ms, median |
| ---------------- | ------------ | --------------------------------------------: | -------------------------: | ---------------------------------: |
| sampling-sensors | Active       |                                    99 / 3 / 7 |                        117 |                               3.70 |
| expanded-sensors | Active       |                                    97 / 2 / 9 |                        116 |                               4.00 |
| paused-sensors   | Paused       |                                     1 / 0 / 0 |                          3 |                               0.50 |

The non-sensor export modes retained zero sensor readings. Exported median
sampler callback totals were sampling 10.70ms, paused 0.00ms, expanded 9.50ms, sampling-sensors 10.00ms, expanded-sensors 10.70ms, paused-sensors 0.00ms. Both callback categories cover
a subset of diagnostics work. Whole-window overhead also includes frame and
observer work, snapshot construction, reactive updates and expanded panel
rendering.

## Reliability and document-safety coverage

The scoped audit below maps #16 requirements to existing assertions. It includes
fresh unit coverage and cites browser cases at their existing scope.

| Requirement                     | Evidence and boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cancel pending file/reader work | `tests/reader-acceptance/cancellation.spec.ts` closes a reader during pending local-file work and opens another. `tests/e2e/workspace-acceptance.spec.ts` checks a cancelled/denied selection preserves warm readers and a final close rejects late identity results. PDF session and EPUB preparation/packer tests cover abort while an engine or pack is pending.                                                                                                                                                                                                                                                        |
| PDF corrupt/password recovery   | `tests/unit/pdf-session.test.ts` checks invalid classification and the PDF.js password callback destroying its loading task. `tests/e2e/workspace-acceptance.spec.ts` exercises a corrupt tab alongside usable readers. The password case is at the engine callback boundary.                                                                                                                                                                                                                                                                                                                                              |
| PDF and EPUB resource release   | `tests/unit/pdf-session.test.ts` checks pending canvas/text work cancellation and worker destruction on cleanup failure. `tests/unit/epub-session.test.ts` and `epub-formatting.test.ts` check image Blob URL revocation on close, failure and cancellation. `tests/unit/epub-publication-packer.test.ts` checks worker termination and late-result rejection. `tests/diagnostics/cleanup.spec.ts` checks viewer, worker-owner, Blob URL, listener, observer and timer counters return to baseline over three browser cycles. Ownership counters are separate from independent retaining paths and browser process memory. |
| EPUB active and remote content  | `tests/unit/epub-publication.test.ts` checks sanitized XHTML and rejects remote/missing spine resources. `tests/unit/epub-formatting.test.ts` covers active/remote CSS and SVG scripts, handlers and remote resources. `tests/e2e/shell.spec.ts` exercises unsupported-book/storage-failure recovery without remote access.                                                                                                                                                                                                                                                                                                |
| Bounded archive work            | `tests/unit/epub-archive.test.ts` covers overlapping entries, declared expansion, excessive directory metadata and abort before/during reads. `tests/unit/epub-publication.test.ts` checks actual deflate output and CRC separately from declarations. `tests/e2e/epub-preparation.spec.ts` exercises packer release and cancellation of a blocked worker.                                                                                                                                                                                                                                                                 |

Existing assertions cover the listed runtime contracts. Explicit root analysis
across a mixed-reader lifecycle and native OS permission/reconnect evidence have
separate acceptance boundaries. No owner visual review is inferred from tests.

## Validation

Run `npm run check` for lint, format, pipeline, unit and type checks. Focused
pipeline cases cover cancellation during an idle delay, an in-flight sample,
sample failure and isolation of checkpoint time from ordinary workload timing.
For real Chromium evidence, use `npm run profile:browser` with `PROFILE_REPEATS=5`
and `PROFILE_TRACES=false` and an installed supported browser. For separate
investigation set `PROFILE_HEAPS=true` or enable traces. Keep their timings out
of the ordinary comparison. Raw reports stay in the ignored evidence directory.
