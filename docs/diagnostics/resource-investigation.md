# Resource investigation — #252 first increment

Open Developer diagnostics → Resources in development, preview or staging. Production/release bundles exclude diagnostic controls and instrumentation. No permissions are requested, no hosting headers changed and no data uploaded.

## Baseline workflow

1. Open diagnostics before the workload. Select Resources and **Mark baseline**.
2. Minimize diagnostics, open PDF/EPUB fixtures, scroll/navigate, switch tabs, then close them.
3. Reopen Resources and wait for asynchronous cleanup to settle. Compare owned counts/estimates and JS heap against the marked baseline. Export JSON to preserve the evidence.
4. Select **Clear** in Cleanup to remove the comparison only. Reset clears baseline, request history, cache counters and storage estimates; current live ownership remains tracked. Pause/resume preserves completed evidence and the baseline but interrupts pending diagnostic work.

A retained inactive reader can remain for five minutes by design. Positive deltas are prompts to investigate, not automatic leak findings. The health indicator is unchanged.

## Resources views

Resources is organized into four keyboard-accessible categories. Selection survives minimizing and reopening the panel; the main diagnostic views, health evaluation, collection and export stay unchanged.

- **Cleanup:** mark/clear a baseline, compare readers, PDF task owners, canvas buffers and Blob URLs in Before/Now/Change columns, then expand byte estimates and remaining owned counts. Matching selected owner counts is not a memory-leak verdict. The three summary values show readers, canvas RGBA estimate and JS heap; unavailable values remain explicit.
- **Caches:** preview hits, misses and capacity evictions, plus separate preview/dimension lookup rows and current occupancy in captured evidence. A first-visit miss is expected; capacity eviction is not a request failure.
- **Requests:** pending count, retained history and the 120-record limit, latest PDF render application-stage bars, and the latest 12 requests with readable operation names, stage timings, outcomes and fixed failure categories. Missing stages remain unavailable. Captured evidence retains raw operation names and recording-limit explanations.
- **Storage:** manual **Refresh estimate**, usage/quota/source summary, actual sampling status and origin-scope guidance. Zero is valid; unavailable is not zero. This is disk usage, not RAM or per-document memory.

Each category includes **How to read this / captured evidence**. Category controls wrap to two columns on narrow screens. Arrow keys and Home/End move between categories. No new qualitative thresholds or collection sources are introduced.

## Measurement contract

| Measurement                                 | Source and meaning                                                                                                                 | Limits                                                                                                                                                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Owned counts                                | Explicit existing reader/canvas/PDF loading-task/EPUB URL/download registrations                                                   | Instrumented ownership only. No registered owner is distinguished from a registered owner with zero; zero tracked ownership is not browser-wide zero. PDF task owners are not worker-thread counts.                                              |
| Canvas RGBA                                 | width × height ×4 for preview buffers, displayed PDF canvases and in-flight pixel buffers                                          | Pixel estimate, not GPU/process allocation. Preview bytes are a subset of canvas bytes; do not sum them. Temporary render ownership is released on success/failure/cancellation.                                                                 |
| Blob bytes                                  | Logical payload size of owned EPUB image/download Blobs                                                                            | Not physical RAM or compressed backing-store allocation; other engine/internal Blobs are untracked.                                                                                                                                              |
| JS heap                                     | Nonstandard performance.memory.usedJSHeapSize, where supported                                                                     | Baseline/current/delta only; unavailable stays null. Not total process/DOM/GPU memory.                                                                                                                                                           |
| PDF caches                                  | Instrumented preview/dimension lookups; session hits/misses and capacity evictions                                                 | Preview LRU128 entries; dimensions separate. No cache keys, file names or document IDs retained. Closing a cache is not counted as capacity eviction.                                                                                            |
| pdf.render-request                          | Entry → completion; wait until prior-render cancellation/preparation finishes, then processing through PDF.js render/text response | Application request stages, not worker CPU, internal queue wait or actual IPC response attribution.                                                                                                                                              |
| pdf.release                                 | Close → asynchronous document/loading-task teardown                                                                                | Completes only after teardown; repeated close uses the same promise. A late dimensions response cannot repopulate a closed session.                                                                                                              |
| reading.transaction / workspace.transaction | Connection-open wait, then transaction through commit/failure                                                                      | Generic persistence transactions; read/write/restore are not separately attributed yet. Result staging is not transaction completion. Fixed quota/security/cancelled/blocked/other failure categories; no original errors/content/keys exported. |
| Origin storage                              | Manual navigator.storage.estimate() refresh                                                                                        | Origin-wide disk usage/quota estimate, not RAM, channel-only or per-document allocation. Unsupported/security/failure reasons are explicit. No persist()/permission prompt.                                                                      |

Baseline and request timestamps use page-relative performance.now milliseconds. Every pending request uses an internal ticket; at most120 pending and120 completed rows retained. UI shows the latest12 completed rows; JSON includes the retained120 maximum and pending count/phase/age. Pause/reset generations prevent late completions or stale storage estimates from entering a new recording. Unknown optional fields remain null. Cache counters accrue only while recording and reset with the session.

## Remaining #252 scope

This increment deliberately leaves #252 open for engine-internal queue stages where APIs expose them, read/write/restore and cold/warm reader attribution, broader application listener/observer/timer ownership tracking, settled/expiry workload evidence and optional page-memory sampling. Optional measureUserAgentSpecificMemory is capability-reported only; no call is made and isolation headers are not changed. External CPU/GPU/process-memory profiling and accepted budgets remain #16; representative overhead and browser-engine acceptance remain #253.

## Validation

Local unit/component tests cover bounds, baseline copy isolation, pause/reset generations, stale storage completions, unsupported/security failures, quota failure classification, commit-versus-staged-result timing, PDF LRU capacity release, closed-session late dimensions, and accessible UI controls. Mixed real PDF/EPUB browser fixtures mark a baseline, exercise navigation/cache/persistence work, close both readers, poll released owners and inspect safe JSON/storage refresh. Default build exclusion is asserted for resource-investigation strings across the five-channel build matrix.

References: [Storage Standard](https://storage.spec.whatwg.org/), [optional Measure Memory API](https://wicg.github.io/performance-measure-memory/).
