# Diagnostics acceptance — first #253 checkpoint

Measured source `445543887c35223826495a277fe79e993e4d5a2f`, tree `4562b75e96adf3f98742bd7daed9e3e5d2669001`; clean checkout. This is a bounded local Chromium checkpoint, not completed #253/#16 acceptance.

Host: Node v24.19.0, Linux 6.18.55, x64; 9 exposed logical CPUs and 10451439616 reported RAM bytes. Virtualized/shared-host scheduling and OS caches are uncontrolled. Browser 153.0.8010.0. Viewport 1440×900; no artificial CPU/network throttling.

The manual runner built both production-channel variants, verified diagnostic exclusion/inclusion and hashed all generated files. Three rotated-order fresh-context trials per mode ran the identical generated 12-page text PDF and formatted CSS/image EPUB workload. Elapsed time includes automation and browser rendering. Each trial includes application-cold first opens and three retained warm PDF/EPUB switches, then both-reader closure. File injection/listing is not a native-folder scan. Sampling/paused exports verify their recording state and source identity after the timed interval.

| Mode       | Trials | Median elapsed (ms) | Worst elapsed (ms) |
| ---------- | -----: | ------------------: | -----------------: |
| production |      3 |             1212.15 |            1248.86 |
| closed     |      3 |             1300.40 |            1352.74 |
| sampling   |      3 |             1269.25 |            1399.07 |
| paused     |      3 |             1122.93 |            1374.21 |

Diagnostic minus default production complete-artifact bytes: **+91839 uncompressed bytes**. This is not startup transfer or resident memory. Full file sizes/checksums, stage timings, raw numeric trials, callback subsets and limitations are in [the reviewed summary](chromium-summary.json).

Five browser cases passed: missing-observer fallback, repeated four-mode workload, actual PDF/EPUB export/lifecycle, 320px dark keyboard/focus and opt-in sensors. One duplicate production-only diagnostic-suite case was intentionally skipped because the same suite targets the diagnostic artifact; every production workload trial separately asserted query/keyboard exclusion. Local `npm run check`: 99 pipeline and 442 unit/component tests, lint/format/types passed.

Firefox 155 download failed with an invalid/truncated archive; WebKit was not reached. Neither engine is claimed accepted. The configuration supports requesting both once their Playwright installations and dependencies are available. Missing requested engines fail the command; they are not counted as successful skips.

No calibrated budget, speedup, CPU/GPU/process-memory figure or causal diagnosis is inferred from these short runs. Three trials do not support p95; it remains null. Additional sensors and expanded-panel rendering were not part of the timed base-sampling modes. Larger/image-heavy/long-chapter/native-folder/restore/real expiry and repeated teardown workloads remain open, along with broad cross-engine acceptance and #16 external profiling.

Evidence is generated from public synthetic fixtures; no personal files, document paths/content, raw URLs or profiler traces are retained. This evidence-only archive changes no application, harness or workflow bytes from the measured source. See [the run guide](../../diagnostics/acceptance.md).
