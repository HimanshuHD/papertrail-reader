# Representative reader workload baseline

Source `5170f59f961c2401c0fafdf13abe3158a68d1fb1` uses the reader runtime
from merged staging `1e1e8b0`. Production build with diagnostics excluded,
locked dependencies, Chromium 153.0.8010.0, headless software graphics,
1440 × 900 and reduced motion. Five repetitions per fixture. Each repetition
starts a fresh browser and rotates case order. Each case gets a fresh context.
The repeated folder selection shares its context. The filesystem cache is
uncontrolled. Workload timing includes browser automation for PDF and EPUB steps.
There were no page errors in the 35 ordinary case runs. Sparse p95 is withheld.

## Selected folder input

The directory input receives folders of identical two-page generated PDFs with
unique names. A capture-phase input change listener starts the browser clock.
A mutation observer records the first available document row and the point
where all rows exist with the library busy state cleared. A pilot reload
restored the old listing, so the measured repeat uses **Forget library**, waits
for an empty listing and reselects the same directory in the same context.
These steps exercise the directory-input path after selection. They exclude
native picker interaction and permission timing.

| Files | Fixture bytes | Cold first listing median / worst ms | Repeat first listing median / worst ms | Cold busy clear median / worst ms | Repeat busy clear median / worst ms |
| ----- | ------------: | -----------------------------------: | -------------------------------------: | --------------------------------: | ----------------------------------: |
| 100   |        87,300 |                          62.7 / 66.0 |                            54.8 / 82.9 |                   3002.6 / 3002.7 |                     3001.2 / 3001.4 |
| 1000  |       873,000 |                        368.5 / 440.9 |                          392.0 / 523.1 |                   3003.4 / 3004.0 |                     3001.9 / 3002.7 |

In `ReaderView.vue`, discovery commits the document list before the successful
foreground scan waits for the minimum loading period. The busy-clear timing
includes that deliberate three-second UI hold. First listing is a DOM observation;
it precedes browser paint and may precede interaction readiness. Neither column
alone gives the duration of the indexing service.

A separate diagnostic build run with sampling minimized exported the service
operation timings after each selection. Five cold and five repeat measurements
per file count. The exported `library.first-listing` metric ends at the first
supported discovery progress event. The DOM measurements above end at the first
rendered row and have a different boundary.

| Files | Selection | First discovery progress median / worst ms | Discovery complete median / worst ms |
| ----- | --------- | -----------------------------------------: | -----------------------------------: |
| 100   | Cold      |                                0.60 / 1.40 |                        55.30 / 64.60 |
| 100   | Repeat    |                                0.40 / 0.90 |                        43.50 / 49.90 |
| 1000  | Cold      |                                0.50 / 0.60 |                      319.30 / 376.00 |
| 1000  | Repeat    |                                0.90 / 1.80 |                      372.20 / 421.30 |

## PDF and EPUB operations

PDF open starts at the library entry click and waits for reader readiness and
page-one render state. The library then hides and the reader settles 300ms.
The scroll workload sends twelve 500px wheel inputs 35ms apart and settles 750ms.
Each case moved 6,000 CSS pixels. Task duration is the CDP page-target delta over
the input/settle window. Distant jump ends when the last page is ready. Zoom ends
when the last-page canvas backing width changes and the page returns to ready at
150% custom zoom. The mixed fixture alternates 500 × 1100 and 900 × 450 pages.
The image fixture has distinct embedded rasters on 12 pages.

| PDF fixture |     Bytes | Open median / worst ms | Distant jump median / worst ms | Zoom median / worst ms | Scroll task median / worst ms |
| ----------- | --------: | ---------------------: | -----------------------------: | ---------------------: | ----------------------------: |
| text-31     |     8,841 |          290.8 / 381.2 |                    46.4 / 53.3 |          148.9 / 177.9 |                467.0 / 1376.0 |
| text-1001   |   282,327 |          395.9 / 434.0 |                   78.1 / 115.7 |           99.9 / 113.2 |                104.3 / 1237.4 |
| image-12    | 9,440,689 |          387.0 / 542.5 |                   49.6 / 104.7 |          102.3 / 153.9 |                   57.2 / 64.3 |
| mixed-51    |    14,382 |          368.7 / 380.7 |                   50.6 / 111.5 |           81.5 / 156.1 |                 271.4 / 364.5 |

The styled EPUB has 1,000 paragraphs in the first chapter, local CSS and an image
(67,320 bytes). Open waits for the heading
and local image. Chapter navigation waits for the next heading. Text-only switch
waits for the mode state and the removal of the author letter spacing. Reflow
measures resize from 1440 to 1024px with the chapter still readable and the EPUB
viewport width variable updated.

| EPUB operation         | Median / worst ms |
| ---------------------- | ----------------: |
| Open formatted chapter |     379.5 / 429.7 |
| Next chapter           |      81.5 / 104.8 |
| Switch to text only    |     316.0 / 332.2 |
| Resize and reflow      |     391.5 / 416.0 |

## Matched scroll allocations and task variation

Before uses pre-#316 staging `55bceb52143b011c32c3a4f3f26af0f5d424cb13`.
After uses the runtime in `5170f59`. Both exclude diagnostics. Five repetitions
per fixture/build alternate variant order with fresh contexts and identical
wheel inputs. Allocation sampling uses a 16KiB interval and includes samples
collected by major/minor GC. The sum of sampled node self sizes estimates total
page-target temporary allocation in this window. It excludes PDF workers and
native/GPU allocations. Explicit GC and tracing are absent from these runs.
All 40 runs move 6,000px. Each text/image case ends on page four and the mixed
fixture ends on page three in both builds.

| Fixture   | Before allocated MiB, median / worst | After allocated MiB, median / worst | Before task ms, median / worst | After task ms, median / worst |
| --------- | -----------------------------------: | ----------------------------------: | -----------------------------: | ----------------------------: |
| text-31   |                          1.61 / 1.83 |                         1.10 / 1.18 |                 277.6 / 1469.0 |                 272.1 / 297.6 |
| text-1001 |                        21.50 / 22.79 |                         3.06 / 3.18 |                  180.3 / 364.3 |                296.9 / 1176.0 |
| image-12  |                          1.14 / 1.24 |                         1.04 / 1.32 |                    64.4 / 78.8 |                   56.0 / 62.6 |
| mixed-51  |                          1.53 / 1.75 |                         0.88 / 0.99 |                  265.8 / 309.0 |                257.9 / 1480.4 |

Allocation medians fell across the four fixtures. The 1,001-page estimate falls
from 21.50 to 3.06MiB in this comparison. Page task timing varies substantially
and the 1,001-page task median is higher in this round. The 31-page workload
can still have a high task delta in ordinary production repetitions, with
spikes also seen for 1,001 pages and mixed dimensions. For example, the worst
31-page ordinary task interval is 1,376.0ms with 11.2ms script and 3.9ms layout.
Page-target scripting and layout counters therefore leave most of that measured
task duration unexplained. These results support allocation reduction on the
chosen workloads and leave latency causality open.

## Separate traces, process checks and forced-GC investigation

### Traces and process CPU

Four separate instrumented cases cover folder selection, PDF open/scroll/zoom and
EPUB open/mode/reflow. These traces include all threads covered by the browser
trace. Counts use one task event name. Inclusive layout and paint durations can
overlap tasks and each other. They remain separate from ordinary latency rows.

| Fixture      | Task events over 50ms | Longest task ms | Inclusive layout ms | Inclusive paint ms |
| ------------ | --------------------: | --------------: | ------------------: | -----------------: |
| library-1000 |                     9 |           191.4 |                40.7 |               22.0 |
| text-1001    |                     4 |           406.7 |                57.4 |               21.8 |
| image-12     |                     6 |           818.8 |                25.5 |               10.4 |
| epub-long    |                     1 |            56.3 |               121.2 |               12.1 |

Six additional scroll traces put browser timing marks around the same wheel
window for the 31- and 1,001-page cases, three per size. Two elevated samples had
313.4ms and 299.6ms page task deltas. The longest renderer-main events in those
windows were 241.5ms and 186.1ms, both posted by Chromium's `WidgetBase::Shutdown`.
These events explain most of the elevated task time in those traced windows.
The untraced intervals over one second have no matching task attribution yet.
The comparison leaves scroll latency sensitive to browser lifecycle work and
measurement conditions.

Eight traced PDF scroll windows also sample Linux process CPU ticks. Process
IDs reported by Chromium are verified against the PID namespace and browser
executable. Matching includes the OS process start time to reject reused IDs.
User/system tick deltas are converted with the platform tick frequency. All
five reported processes matched at both endpoints in all eight windows. Renderer
CPU ranged from 0.12 to 0.24 CPU seconds across these windows. The software graphics
process consumed CPU across threads. The OS totals are process-level readings
and aggregate workers in their host process. Short-lived processes between
samples are outside the matched set. Physical GPU activity/allocation remains
unavailable. These trace runs establish a usable OS measurement for this
configuration, with independent ordinary-mode CPU comparisons still pending.

### Matched retained page heap

Three separate trials per fixture/build collect garbage before measuring page
heap after opening, after the scroll window, and one second after explicit close.
The closing sequence also exercises the distant jump and zoom from the operation
workload. These repetitions exclude allocation sampling and trace capture.

| Fixture  | Before opened / scrolled / closed MiB, medians | After opened / scrolled / closed MiB, medians |
| -------- | ---------------------------------------------: | --------------------------------------------: |
| text-31  |                          6.580 / 6.786 / 6.769 |                         6.602 / 6.802 / 6.753 |
| image-12 |                          6.527 / 6.754 / 6.735 |                         6.551 / 6.752 / 6.726 |
| mixed-51 |                          6.501 / 6.721 / 6.559 |                         6.498 / 6.714 / 6.554 |

Post-GC page heap stays close between builds for these fixtures. The matched
1,001-page retained-heap comparison is in [the placeholder report](./pdf-placeholder-reuse.md).
The measurements cover V8 page-target heap and exclude separate worker and
native memory. The lifecycle report records natural process RSS separately.

### Mixed lifecycle retaining paths

Two separate production runs collect page snapshots after forced GC at the
empty baseline and after five and ten explicit mixed-reader closes without
reload. One run clears console entries and releases the console object group
before each snapshot. Both use the small lifecycle fixture and the same 2.2-second
checkpoint settling interval.

| Observation                                                      | Baseline | After five | After ten |
| ---------------------------------------------------------------- | -------: | ---------: | --------: |
| Page JS heap MiB, ordinary capture                               |    4.388 |      9.775 |    10.582 |
| Page JS heap MiB, console clearing control                       |    4.388 |      9.796 |    10.576 |
| Detached native nodes, both captures                             |       60 |        225 |       225 |
| Detached nodes reachable in filtered direct graph, both captures |       60 |         76 |        76 |
| Detached reader-shell, iframe or canvas matches, both captures   |        0 |          0 |         0 |
| ArrayBuffer objects, both captures                               |       25 |         29 |        29 |

Reader candidates use DOM names/attributes for PDF and EPUB shells, iframes and
canvases. Compiled engine constructor names may be minified. The captured detached
library filter belongs to an earlier sidebar subtree. The shortest path uses a
DevTools-console global handle in both runs, even after the console control.
Removing that handle from graph traversal reveals a conditional Vue WeakMap
key/value path. A traversal excluding inspector-labelled roots, weak/shortcut
edges and conditional WeakMap edges finds no direct path to that library filter.
The remaining 76 reachable detached nodes are a separate set. This targeted
analysis leaves conditional ownership and other browser roots open. The two
captures show stable detached counts between the five and ten closes.

Snapshot self sizes classified as code rise from 2.028MiB to 7.033MiB by close
ten in the ordinary capture. Recognized ArrayBuffer backing-data sizes total
0.317MiB at baseline and 0.318MiB after ten. This locates a substantial code-size
increase and little growth among those backing-data nodes. JS heap usage, snapshot
self sizes and process RSS have different accounting boundaries. Worker heaps,
native canvas buffers and independent inspection-light teardown remain additional
scope.

Target acceptance still needs independent representative-workload validation,
review of scoped operation targets and checks of the configured breach/recovery
behavior. Raw traces, allocations,
heap snapshots and local environment metadata stay private.
