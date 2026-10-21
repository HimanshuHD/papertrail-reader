# Persistence and reader attribution — #252 / PR #258

Clean measured source `cea424f6ee4b2e64127ec9c3b902dcda859c5aa6`, tree
`a79c7b5b988cf2b6dcd2d511d2be841298110c76`. The evidence/documentation archive
changes no application, test harness or workflow bytes.

The full manual acceptance runner passed Linux Chromium 153.0.8010.0 and
Playwright WebKit 26.6: **16 browser cases passed, zero failures/flakes, two
expected duplicate production-only skips; 24/24 workload trials completed**.
Three real-clock trials per engine/mode rotate production-excluded, diagnostic
closed, sampling/minimized and paused. Every production workload checks query
and keyboard exclusion. [Reviewed report](attribution-summary.json) retains
source, environment, checksummed artifact manifests, stages, aggregates, coverage
and case outcomes. Added full-artifact bytes: 94,218 uncompressed; this is not
startup transfer, retained RAM or incremental cost compared with #257.

The separate real-reader attribution case opens PDF/EPUB, switches retained
ready instances, checks retention before the deadline and recreation after five
minutes using an accelerated browser clock. Both engines exported completed
cold/warm/expiry and reading-restore categories. [Derived attribution audit](reader-attribution-audit.json)
retains only source/engine and fixed numeric/outcome evidence from those exports,
plus suite stats. This functional clock acceleration is not included in workload
measurements or claimed as real-time/settled overhead. Exact boundary, saved
workspace reconnect, committed reads/writes/restore, failures/cancellations,
stale callbacks and pause/reset are covered by unit tests.

Local `npm run check`: lint, format, types, 105 pipeline and 452 unit/component
tests passed on the identical implementation tree. Actual production/release
build checks exclude the new vocabulary; preview/staging/explicit builds include
it. A first development test attempted a 299,999ms browser-clock boundary after
clicks had already elapsed; it failed its retention assertion. The final test
uses four minutes then another 61 seconds, while the deterministic unit test
continues to test 299,999ms/300,000ms exactly. No application expiry delay,
readability assertion, timeout or retry was relaxed.

Chromium uses the isolated locally supplied executable. WebKit's local extracted
shared-library setup uses skipped host-package validation, with actual engine
execution verified. No repository dependencies, hosting headers or workflows
changed. This is not installed Chrome/Edge, Windows, macOS Safari or native
Tauri/device acceptance. Raw Playwright reports, paths, traces and attachments
are not published. Reviewed summaries contain no fixture names/contents, paths,
document/session identifiers or raw attribution URLs.

Warm timing means synchronous selection dispatch, not paint or first-readable
latency. Restore/resolve may create/migrate metadata. Other metadata services
retain the generic transaction label. Broader owned registrations, optional
page memory, representative large/native workloads and accepted #16 profiling
budgets remain open; no causal slowdown, leak, speedup or CPU/GPU/process-memory
claim is made. Owner preview/merge and subsequent staging acceptance remain
separate from this local evidence.
