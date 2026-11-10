# Representative diagnostics comparison on Chromium

This comparison replays larger reader workloads across the eight diagnostics
states after PR #317. The [previous lifecycle comparison](./performance-profiler-window.md)
uses a smaller mixed-reader fixture. The [representative baseline](./performance-representative-baseline.md)
contains earlier production, trace, allocation and retaining-path measurements.

Source `39873cd4c45512ec159e98ac8a84b2c2f2e83ef6` is the merged staging revision.
Both builds use locked dependencies and production build settings. The production
condition excludes diagnostics. The other seven conditions use the same diagnostic
build with the panel closed, minimized and sampling, minimized and paused, expanded,
or the corresponding sensor-requested variants.

Chromium 153.0.8010.0 runs headless with software graphics at 1440 × 900 and
reduced motion. Fixtures use `createPdfFixture(2)`, `createPdfFixture(1001)` and
`createFormattedEpubFixture(1000)` from the repository fixture helpers. Five
repetitions rotate mode and fixture order. Each mode/repetition
starts a fresh browser and each fixture gets its own context. OS file cache is
uncontrolled. The browser stays visible to the page at each measurement endpoint.
No allocation sampling, trace or forced GC is used in the timed runs. All 120
fixture runs pass their functional assertions and page-error check.

The pilot showed that the expanded panel intercepts pointer input on the EPUB chapter
arrow at this viewport. Final EPUB chapter navigation uses Enter and the text-only
switch uses Space in every condition. The pilot was discarded and all repetitions
were restarted with the same keyboard sequence.

## Workload boundaries

- **Folder pair.** Select a directory of 1,000 generated two-page PDFs through the
  directory input. Record time from input change to the first document DOM row and
  to all rows with the busy state cleared. Use Forget library, wait for an empty
  listing and repeat the selection in the same context. The busy-clear boundary
  includes the deliberate three-second minimum loading period. The folder workflow
  includes both selections and the reset. Native picker permission and filesystem
  cache clearing are outside this fixture.
- **PDF workflow.** Load the generated 1,001-page text PDF, open page one, hide the
  library and settle for 300ms. Send twelve 500px wheel inputs 35ms apart and settle
  for 750ms. Each run moves 6,000px and ends on page four. Jump to page 1,001 and
  wait for readiness, then apply 150% zoom and wait for the canvas backing width
  and render state to update. Close the reader. The scroll task column is the
  page-target CDP TaskDuration delta over the wheel/settle window.
- **EPUB workflow.** Open the generated styled EPUB and wait for the first chapter
  and local image. Navigate to chapter two and back. Switch to text-only mode and
  restore formatted mode. Resize to 1024 × 900, observe the updated EPUB viewport
  width and confirm readability, then close. The first chapter has 1,000 paragraphs.

Fixture workflow clocks run from the start of the fixture actions through the final
assertion. They include Playwright input, readiness checks and the documented waits.
Mode setup, process collection and diagnostics export sit outside those clocks.
Five repetitions support observed medians and worst cases. p95 is withheld.

## Workflow wall time

All entries are median / worst milliseconds.

| Mode             | Folder pair     | PDF workflow    | EPUB workflow   |
| ---------------- | --------------- | --------------- | --------------- |
| production       | 6416.4 / 6599.4 | 3255.3 / 3695.7 | 1548.1 / 2082.3 |
| closed           | 6435.9 / 6507.9 | 2994.1 / 3779.2 | 1533.9 / 2112.5 |
| sampling         | 6425.1 / 6624.2 | 3079.2 / 3757.7 | 1836.2 / 2396.4 |
| paused           | 6405.0 / 6706.4 | 3135.4 / 3947.7 | 1630.6 / 2445.1 |
| expanded         | 6508.0 / 6601.5 | 3406.7 / 3846.7 | 1741.2 / 2325.4 |
| sampling-sensors | 6405.0 / 6559.5 | 2887.2 / 3862.5 | 1666.6 / 2283.1 |
| expanded-sensors | 6431.3 / 6610.6 | 3136.1 / 3901.2 | 1739.6 / 2443.7 |
| paused-sensors   | 6390.7 / 6619.8 | 3035.9 / 3655.8 | 1622.4 / 2610.8 |

Paired differences below subtract the comparison mode within the same repetition.
Values are median differences with observed min–max bounds, in milliseconds.
Closed versus production includes the bundle boundary. Panel and sensor comparisons
use the same diagnostic build. A paired wall-time delta includes all work in the
fixture interval and may also reflect browser scheduling or measurement variability.

| Mode vs baseline             | Folder pair              | PDF workflow              | EPUB workflow            |
| ---------------------------- | ------------------------ | ------------------------- | ------------------------ |
| closed vs production         | -13.8 (-118.5 to +62.5)  | +70.3 (-261.2 to +187.8)  | +30.2 (-46.9 to +275.4)  |
| sampling vs closed           | +30.2 (-118.1 to +116.3) | -8.4 (-143.4 to +85.0)    | +104.8 (-12.3 to +408.1) |
| paused vs closed             | +10.1 (-39.5 to +225.5)  | +23.4 (-231.8 to +178.6)  | +25.1 (-129.8 to +332.6) |
| expanded vs closed           | +59.8 (-51.3 to +159.8)  | +67.5 (+33.6 to +595.0)   | +212.8 (-55.4 to +278.0) |
| sampling-sensors vs sampling | +22.6 (-86.3 to +69.5)   | -162.0 (-192.0 to +159.6) | -113.3 (-379.3 to +96.7) |
| expanded-sensors vs expanded | -6.7 (-111.8 to +48.8)   | -106.2 (-502.1 to +101.6) | +11.2 (-98.8 to +118.3)  |
| paused-sensors vs paused     | -32.1 (-175.3 to +119.9) | -109.6 (-493.2 to +121.5) | +40.2 (-97.2 to +213.3)  |

## Operation boundaries

All entries are median / worst milliseconds. Folder busy-clear time includes the
minimum loading period. PDF scroll task duration uses the browser counter and has a
different boundary from the other operation timings.

### Folder selection

| Mode             | Cold first listing | Repeat first listing | Cold busy clear | Repeat busy clear |
| ---------------- | ------------------ | -------------------- | --------------- | ----------------- |
| production       | 405.3 / 506.8      | 412.7 / 452.9        | 3003.6 / 3007.0 | 3002.1 / 3004.4   |
| closed           | 391.1 / 433.3      | 356.3 / 421.9        | 3003.4 / 3003.8 | 3002.2 / 3003.0   |
| sampling         | 363.9 / 1104.5     | 395.3 / 459.7        | 3002.8 / 3003.5 | 3002.0 / 3002.3   |
| paused           | 336.3 / 432.4      | 381.6 / 590.9        | 3003.3 / 3004.4 | 3002.0 / 3002.3   |
| expanded         | 367.2 / 434.6      | 414.8 / 428.0        | 3003.2 / 3003.6 | 3002.0 / 3002.3   |
| sampling-sensors | 362.9 / 450.5      | 414.1 / 476.8        | 3002.5 / 3002.8 | 3002.0 / 3007.3   |
| expanded-sensors | 369.7 / 969.9      | 410.6 / 460.7        | 3003.6 / 3004.0 | 3001.4 / 3003.0   |
| paused-sensors   | 362.5 / 1072.7     | 377.2 / 417.5        | 3003.6 / 3003.8 | 3002.0 / 3002.8   |

### PDF

| Mode             | Open           | Distant jump | Zoom          | Scroll task delta |
| ---------------- | -------------- | ------------ | ------------- | ----------------- |
| production       | 388.1 / 1042.1 | 74.1 / 126.6 | 110.1 / 207.0 | 102.6 / 146.3     |
| closed           | 413.6 / 434.8  | 78.9 / 105.6 | 123.3 / 197.8 | 104.7 / 145.3     |
| sampling         | 413.7 / 1703.9 | 72.1 / 78.6  | 115.5 / 215.1 | 137.0 / 175.3     |
| paused           | 396.1 / 424.5  | 67.6 / 93.3  | 137.0 / 211.1 | 125.6 / 130.0     |
| expanded         | 463.5 / 491.2  | 88.9 / 100.3 | 150.0 / 163.7 | 144.1 / 171.3     |
| sampling-sensors | 807.5 / 1824.1 | 66.4 / 87.6  | 101.6 / 207.1 | 128.5 / 129.6     |
| expanded-sensors | 415.4 / 1804.4 | 84.6 / 101.7 | 125.8 / 142.3 | 132.5 / 173.6     |
| paused-sensors   | 428.2 / 1430.4 | 74.9 / 82.3  | 151.4 / 251.3 | 113.5 / 142.3     |

### EPUB

| Mode             | Open           | Next chapter | Text-only switch | Resize/reflow |
| ---------------- | -------------- | ------------ | ---------------- | ------------- |
| production       | 360.3 / 409.9  | 61.2 / 72.1  | 226.1 / 787.8    | 387.9 / 397.1 |
| closed           | 360.1 / 449.0  | 66.0 / 70.5  | 250.0 / 362.4    | 390.4 / 393.4 |
| sampling         | 398.6 / 467.2  | 80.0 / 114.2 | 247.3 / 260.2    | 393.3 / 415.9 |
| paused           | 372.7 / 436.7  | 56.9 / 74.9  | 250.5 / 351.2    | 394.8 / 396.9 |
| expanded         | 383.5 / 482.0  | 80.0 / 85.1  | 364.1 / 1008.1   | 397.9 / 406.7 |
| sampling-sensors | 356.3 / 425.3  | 68.3 / 77.0  | 215.9 / 290.2    | 398.4 / 407.8 |
| expanded-sensors | 380.8 / 446.0  | 75.2 / 185.9 | 257.3 / 310.6    | 402.0 / 423.6 |
| paused-sensors   | 389.4 / 1404.3 | 54.6 / 62.3  | 240.0 / 333.5    | 401.6 / 419.1 |

## Matched Linux process CPU

CPU samples bracket the whole fixture workflow. Browser-reported process IDs are
verified against the PID namespace and Chromium executable inode. The comparison
matches PID, process type and start time, then converts Linux user/system tick deltas
using the OS tick frequency. 120 of 120 windows match all reported processes
at both endpoints and contain a renderer reading. Each cell uses only those windows.

Renderer CPU seconds, medians with observation counts.

| Mode             | Folder pair | PDF workflow | EPUB workflow |
| ---------------- | ----------- | ------------ | ------------- |
| production       | 1.10 (n=5)  | 0.96 (n=5)   | 0.92 (n=5)    |
| closed           | 1.09 (n=5)  | 0.92 (n=5)   | 0.94 (n=5)    |
| sampling         | 1.17 (n=5)  | 1.10 (n=5)   | 1.05 (n=5)    |
| paused           | 1.19 (n=5)  | 1.07 (n=5)   | 0.98 (n=5)    |
| expanded         | 1.21 (n=5)  | 1.16 (n=5)   | 1.15 (n=5)    |
| sampling-sensors | 1.10 (n=5)  | 1.02 (n=5)   | 1.05 (n=5)    |
| expanded-sensors | 1.21 (n=5)  | 1.16 (n=5)   | 1.12 (n=5)    |
| paused-sensors   | 1.11 (n=5)  | 0.96 (n=5)   | 0.97 (n=5)    |

These are process-level totals. Worker threads are included in their host process.
Processes that start and exit within a window can be missed. The renderer result
excludes CPU in the software graphics process. Physical GPU utilization and memory
remain unavailable for this configuration.

## Sensor evidence

Exports after each workload check source identity, running state and whether sensor
collection is active. Exported counts can include setup and fixed settling windows.
Paused-sensor modes can retain observations from before pausing. Observer callback
time captures a subset of diagnostics overhead. Retained readings and callback time
below are medians across five exports per cell.

| Mode             | Workload     | Active exports | Retained inputs / frames / resources | Observer callback total ms |
| ---------------- | ------------ | -------------- | ------------------------------------ | -------------------------- |
| sampling-sensors | library-1000 | 5/5            | 4 / 5 / 6                            | 1.30                       |
| sampling-sensors | text-1001    | 5/5            | 9 / 3 / 3                            | 1.40                       |
| sampling-sensors | epub-long    | 5/5            | 9 / 4 / 1                            | 1.00                       |
| expanded-sensors | library-1000 | 5/5            | 2 / 5 / 4                            | 1.20                       |
| expanded-sensors | text-1001    | 5/5            | 7 / 2 / 3                            | 1.20                       |
| expanded-sensors | epub-long    | 5/5            | 8 / 4 / 1                            | 0.90                       |
| paused-sensors   | library-1000 | 0/5            | 1 / 0 / 0                            | 0.40                       |
| paused-sensors   | text-1001    | 0/5            | 1 / 0 / 0                            | 0.40                       |
| paused-sensors   | epub-long    | 0/5            | 1 / 0 / 0                            | 0.50                       |

All sensor-requested trials negotiated Event Timing, Long Animation Frames and
Resource Timing in this Chromium build. The active variants reported active
collection at export and the paused variant reported inactive collection.

Expanded versus closed is the clearest paired workflow difference in this sample.
For PDF, all five pairs are slower with the expanded panel. The median difference
is +67.5ms and the observed range is +33.6 to +595.0ms. Renderer CPU medians are
0.92 and 1.16 seconds respectively. For the folder and EPUB workflows, some pairs
are faster and some slower. The sensor-on comparisons also have both signs for
each fixture. This sample leaves the size of any incremental sensor effect uncertain.

The largest PDF scroll task delta is 175.3ms in sampling mode, with 15.0ms script
and 23.5ms layout recorded. Earlier one-second-scale task spikes did not recur in
this matrix. The larger historical spikes still lack a matching trace attribution.

## Direct operation metric references

Two separate batches collect 20 observations per profile on the same source,
browser and generated fixtures. Each repetition starts a fresh browser with a
fresh context per profile. The scenario order rotates. Diagnostics run minimized
with optional sensors off. The file and reader actions wait for the normal app
readiness signals before exporting diagnostics. The export must contain exactly
one completed duration for the requested profile. All 120 runs pass the
functional checks and export assertions.

`library.scan` measures the discovery service. The two cold-open profiles
measure new reader instance creation through readiness. The operations come
from the exported metrics consumed by the indicators. The profile boundary
differs from the Playwright click-to-ready and full-workflow intervals above.
p95 uses the nearest-rank observation, which is rank 19 at this sample size.

| Operation        | Fixture                        | Calibration median / p95 / worst ms | Holdout median / p95 / worst ms | Holdout above calibration p95 | Holdout above calibration worst |
| ---------------- | ------------------------------ | ----------------------------------: | ------------------------------: | ----------------------------: | ------------------------------: |
| `library.scan`   | 1,000-file directory input     |               293.6 / 376.7 / 392.7 |           307.5 / 364.7 / 395.0 |                          1/20 |                            1/20 |
| `pdf.cold-open`  | 1,001-page text PDF            |               250.4 / 296.3 / 306.7 |           273.1 / 311.8 / 353.9 |                          2/20 |                            2/20 |
| `epub.cold-open` | 1,000-paragraph formatted EPUB |               259.7 / 289.6 / 325.3 |           262.0 / 298.1 / 306.4 |                          2/20 |                            0/20 |

The holdout exceeds the calibration maximum for one folder scan and two PDF
opens. The EPUB holdout p95 also exceeds the calibration p95. These comparisons
show why one batch's observed tail should remain a review reference. The
exceedance counts use a strict greater-than comparison and describe independent
runs. Sustained severity and recovery require separate sequence tests within the
indicator's foreground window.

## Target acceptance boundary

These observations extend the matched comparison to the larger fixtures and ordinary
Linux CPU windows. The direct metric reference batches cover three operation profiles. The current
indicator configuration stores one provisional target per operation. Accepting
fixture-bound values for general use needs an applicability rule. Candidate
profiles should carry fixture/browser scope, units, version, minimum observations
and breach/recovery rules. Review target values and validate applicability and
severity/recovery before applying them. Cross-engine representative measurements, larger timing
spike attribution and independent inspection-light retention work remain in #16.

Raw reports, process IDs, traces, document bytes and environment details stay private.
