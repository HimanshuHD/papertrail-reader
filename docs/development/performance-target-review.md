# Roadmap 3 fixture target review

`roadmap-3-fixture-targets-v1` is proposed for owner acceptance under #16.
It applies to the generated workloads below in Linux Chromium 153.0.8010.0,
headless with SwiftShader, a 1440 × 900 viewport, reduced motion and minimized
diagnostics with optional sensors off. The evidence comes from the separate
20-observation calibration and 20-observation holdout batches in the
[representative diagnostics report](./performance-representative-diagnostics.md).

| Operation        | Generated fixture                                      | Larger observed maximum | Attention | Critical |
| ---------------- | ------------------------------------------------------ | ----------------------: | --------: | -------: |
| `library.scan`   | Directory input with 1,000 two-page PDFs               |                395.0 ms |    475 ms |   950 ms |
| `pdf.cold-open`  | 1,001-page text PDF                                    |                353.9 ms |    425 ms |   850 ms |
| `epub.cold-open` | Styled EPUB with 1,000 paragraphs in the first chapter |                325.3 ms |    400 ms |   800 ms |

The proposal adds 20% headroom to the larger observed maximum and rounds up to
a 25ms step for attention. Critical uses twice the attention value. The margin
and multiplier are review choices. The sample maxima and p95s are measurements
of the documented fixtures. The library target measures discovery service time;
the visible three-second busy hold has a separate boundary.

## Applicability and indicator validation

The opt-in fixture harness generates the inputs, matches the declared workload
and browser scope, validates source identity in the diagnostics export, and
uses the existing indicator monitor with only the selected operation target.
It attaches the target version, scope, configuration and measured operation
evidence to the local test result. The normal operation-keyed settings are
provisional. Unsupported fixtures and environments receive no fixture target
configuration.

The monitor requires three completed observations in its foreground 30-second
window, with three consecutive threshold breaches. Recovery uses three fresh
supported evaluations. The focused unit checks exercise attention, critical,
recovery, duplicate observations, background suppression and export history.
The browser cases verify the real scan and reader lifecycle export paths.
A single real operation sample is evidence for the boundary and scope; it
does not exercise a sustained breach.

Set `DIAGNOSTIC_FIXTURE_TARGETS=true` when running
`npm run test:diagnostics:acceptance` with Chromium selected and the calibrated
Chromium binary. Other configurations skip the fixture target cases and can
run the broader functional checks. The QA target evaluation is separate from
the ordinary diagnostics panel.

## Browser evidence

The tested browser suite used reader runtime from staging `ab8fa02` and the
fixture harness tree `ebf387f156999662b9edb9b3434719ed397ae194`. Six representative
and cleanup cases passed in each of Chromium, Firefox and WebKit. Chromium
also passed all three opt-in scoped export cases. The fixture targets exclude
the Firefox and WebKit cases. Cross-engine functional coverage includes the
100/1,000-file libraries, 1,001-page and image-heavy PDFs, long EPUB and mixed
reader cleanup. The first local WebKit attempts stopped before tests at host
library resolution. All six cases passed with the dependencies supplied in the
local browser runtime.

## Inspection-light lifecycle check

Two fresh Chromium production sessions each open a generated 12-page PDF and
formatted EPUB, switch to the retained PDF, and explicitly close both readers
ten times without reloading. Reader interactions use scalar DOM queries without
keeping reader element handles or capturing heap snapshots. At baseline and
after five and ten closes, sample the page after 2.2 seconds of settling. One
session uses natural GC. The other collects garbage before each checkpoint.

| Checkpoint        | Natural page heap MiB | Post-GC page heap MiB | Post-GC documents / nodes / listeners |
| ----------------- | --------------------: | --------------------: | ------------------------------------: |
| Baseline          |                  5.83 |                  4.39 |                          2 / 331 / 83 |
| After five closes |                 15.34 |                  8.94 |                         4 / 418 / 104 |
| After ten closes  |                 15.80 |                  9.72 |                         4 / 418 / 104 |

Every live PDF check observes one dedicated worker target. Each settled close
checkpoint has zero worker targets and zero mounted readers in both sessions.
Post-GC document/node/listener counts hold steady from five to ten closes.
Page heap still increases between those checkpoints. The earlier snapshot
analysis in the [representative baseline](./performance-representative-baseline.md)
records code growth, detached nodes and the inspector/conditional retaining
paths. The scalar probe independently checks the observed reader and worker
release boundary. Worker heap and native canvas memory are outside the page
heap counter.

## Scroll timing attribution

Six new traced production scroll windows alternate generated 31-page and
1,001-page PDFs, three per size. Each moves 6,000 CSS pixels with the same wheel
sequence and settling window as the earlier comparison. The 31-page task
deltas range from 73.5 to 112.8ms. The 1,001-page deltas range from 100.0 to
554.0ms. In the largest window the renderer-main trace contains 545.3ms of
task slices, with 431.0ms posted by frame scheduling and 81.2ms posted by worker
messaging. The longest renderer-main task in that window is 46.0ms. These
are traced task durations. The earlier one-second-scale untraced spikes did
not recur and still lack a matching trace.

The physical GPU measurement is unavailable with this software-graphics setup.
Earlier matched Linux process CPU and RSS evidence remains scoped to the
documented process boundaries. Raw traces, heap files and machine metadata stay
private.

## Closure review

Record owner acceptance of the fixture target values, browser applicability and
remaining measurement limits in #16. The final roadmap closure also needs the
matching staging integration and manual release review. The
[release preparation record](../releases/v2.3.0.md) tracks the production, tag,
package, immutable release and Wiki evidence.
