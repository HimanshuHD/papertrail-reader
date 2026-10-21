# Owner Windows cross-browser acceptance — PR #257

The owner supplied `summary(2).json` and `playwright(2).json` from the clean PR source `e33a265d43be35af3b378c1c9e322767fd5e37a7`, tree `5aff8d645a671d232f7d6856dd21377e80291b80`. Run started **21 October 2026, 22:37:09 IST** and took approximately 235 seconds. The evidence archive changes no measured application, tests, runner, dependency or workflow bytes.

Environment: Windows 10 build19045 x64, Node24.21.0, Playwright1.63.0, eight reported logical CPUs and16999284736 reported RAM bytes. Main workload viewport1440×900; the keyboard/dark test explicitly exercises320px. These are reported host resources, not process-memory measurements.

| Engine   | Version       | Passed cases | Expected skips | Workload trials |
| -------- | ------------- | -----------: | -------------: | --------------: |
| Chromium | 153.0.8010.12 |            7 |              1 |              12 |
| Firefox  | 155.0         |            7 |              1 |              12 |
| WebKit   | 26.6          |            7 |              1 |              12 |

**Total:21 passed, zero failed, zero flaky, three expected skips;36/36 workload trials complete.** All attempts used retry0. The skipped standalone production-only case duplicates query/keyboard exclusion independently checked in each production workload trial. The earlier Windows WebKit formatted-EPUB selection failure did not recur. The selected-tab barrier and readable-content assertions passed in the fresh rerun.

## Retained files and review

- [Summary](summary.json): owner-supplied build manifests/checksums, numeric workload/stage values, summaries, environment and source identity. The36 attached trial records match this file exactly. All12 engine/mode groups contain trials1/2/3 with independently recalculated median/worst values and null p95. Bundle size totals and diagnostic-marker presence/absence are internally consistent; raw binaries were not supplied for independent file-hash recomputation.
- [Sanitized Playwright outcomes](playwright-outcomes.json):24 case outcomes and attempt statuses, three expected skip explanations, Playwright version and reviewed diagnostic-export audit. Local report/configuration paths, raw attachments, screenshots and source-location fields were omitted. The complete raw Playwright upload is not committed.

All three inspected diagnostic exports identify the same clean source. Fixture filenames/content and prohibited raw attribution fields were absent, and retained recordings stayed within their bounds. Export snapshots are taken during reading; their pending counts are not post-teardown measurements. The separate close/release assertions passed in the browser cases.

## Timing interpretation and limits

These are three short, synthetic mixed-reader trials per mode and engine. First opens and retained warm switches are included; OS/process cache and scheduling are uncontrolled. Timing includes automation/browser rendering. The diagnostic build adds91839 uncompressed complete-artifact bytes; that is not startup transfer or RAM. p95 remains null below20 trials. No CPU/GPU/process-memory metric, accepted budget, causal explanation or speedup is established.

This accepts the **current #257 Windows Playwright engine checkpoint**, together with the [earlier clean Linux Chromium/WebKit checkpoint](../selection-fix.md). Playwright WebKit on Windows is not installed macOS Safari; Playwright Chromium is not separate installed Chrome/Edge acceptance. Broader native/device checks,100/1000-file folder scans, image-heavy/1001-page PDF, long EPUB, restoration/real five-minute expiry, repeated teardown, expanded-panel/optional-sensor overhead and #16 profiling/budgets remain open. #252 deeper attribution/ownership remains separate. Owner merge and exact merged-source staging browser/publication acceptance are still required after this pre-merge checkpoint.
