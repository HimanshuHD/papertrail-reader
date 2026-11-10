# Reader ownership and optional memory — #252 / PR #258

Clean measured source `cf9a839da1e11a800f09cb0394d232a96a25999f`, tree
`8864f0e66549a123935bba5827b653ff30b9f66f`. Subsequent archive changes only
documentation/evidence, not measured application, harness or workflows.

Full manual acceptance on Linux Chromium 153.0.8010.0 and Playwright WebKit26.6:
**18 cases passed, zero failures/flakes, two expected duplicate production-only
skips; 24/24 real-clock workload trials complete**. The new cleanup case completed
three PDF/EPUB open/close cycles per engine. After each cycle, owned viewers,
PDF task owners, Blob URLs, tracked listeners/observers/timers matched their
starting counts; both reader-release categories completed. The separate
accelerated five-minute expiry test passed in each engine. Accelerated expiry
is functional evidence, not an overhead measurement.

[Reviewed full summary](ownership-summary.json) retains exact source, environment,
checksummed manifests, trial/stage aggregates and case outcomes.
[Derived cleanup audit](cleanup-cycles.json) retains suite stats and baseline/settled
counts plus fixed release timings, with no raw Playwright paths or attachments.
Only explicitly instrumented registrations are covered; engine/framework/helper
internals and actual OS worker/thread totals are not inferred. Counts matching
baseline do not establish garbage collection or absence of all leaks.

Local clean-source lint/format/types,105 pipeline and464 unit/component tests
passed. These cover EPUB disposal not re-observing the host or scheduling late
frames; registration ownership through pause/reset; exact timer expiry;
delayed/failed disposal; manual memory unsupported/restricted/malformed results,
private-attribution omission, overlapping-request prevention and stale results.
The supported optional-memory path uses a controlled unit API result: no actual
supported-browser page-memory total is claimed. Real browser cases confirm the
manual button reports missing cross-origin isolation on the unchanged acceptance
servers. No hosting headers/dependencies/workflows changed. The API result's
breakdown is not read; total bytes alone are retained. Native memory measurement
cannot be aborted; pending calls block another request until settling.

The [API specification](https://wicg.github.io/performance-measure-memory/)
describes browser-specific page estimates. They are not process/GPU totals and
must not be summed with heap/owned estimates. Manual page-memory measurement
and expanded-panel overhead are outside the minimized base-sampling workload.
Broader large/native/device workload acceptance and accepted budgets remain
#253/#16; no universal overhead, speedup, leak or CPU/GPU/process-memory claim.

Chromium uses an isolated supplied executable. WebKit uses locally extracted
shared libraries with skipped host-package validation; the actual engine
executed the checks. This is Linux Playwright evidence, not Windows/installed
Chrome/Edge/macOS Safari/Tauri-device acceptance. Owner preview/merge and new
merged-source staging acceptance/publication remain separate. The earlier
[attribution checkpoint](README.md) is historical for its own source.
