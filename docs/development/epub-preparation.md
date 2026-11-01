# EPUB preparation scheduling and packing (#300)

## Confirmed work and implementation

Opening still validates and prepares the complete supported spine before giving
an archive to epub.js. The input/archive/content/image/style/font limits and
sanitization rules remain unchanged. This change improves the work within that
boundary; it does not introduce lazy validation or intra-chapter virtualization.

Previously, `sanitizeChapter` built a fresh DOM and serialized it. Preparation
then parsed that serialization into another DOM solely to collect fragment IDs.
`rebuildChapter` now returns the already-sanitized document. Preparation collects
unique IDs from that tree, excluding duplicates as before, then serializes once.
The public synchronous `sanitizeChapter` API wraps the same builder/serializer.
Root/body IDs, allowed image-wrapper IDs, legacy named anchors and discarded or
unwrapped elements retain the previous fragment semantics.

`EpubPreparationWork` checks cancellation before and after yielding. It yields
between stages after approximately 16ms since the last yield, with forced yields
around final packing. This is a scheduling heuristic, not an accepted frame-time
budget: one XML parse, DOM rebuild or serialization is still synchronous. The
formatting walk checks periodically, and CSS sanitation also reaches checkpoints.
The formatted chapter cache uses these boundaries on later chapter builds too.

Conceptually the initial chapter path is now:

```ts
const source = await resource(path, existingLimit)
await preparation.checkpoint()
const sanitized = rebuildChapter(source, formatting)
await preparation.checkpoint()
// Collect unique IDs directly from sanitized.
const markup = new XMLSerializer().serializeToString(sanitized)
await preparation.checkpoint()
const bytes = encode(markup)
```

Forced boundaries before/after packing let queued cancellation run before final
archive delivery. Existing catch/dispose paths release owned URLs and cache work
when a stage aborts. A checkpoint does not make the stage itself preemptible.

## Worker boundary and buffer ownership

The dense baseline exposed synchronous stored-ZIP packing of roughly 60ms. Large
already-sanitized archives now use `publication-packer.worker.ts`. The worker only
packs the rebuilt resource map with the existing `zipSync(..., { level: 0 })`;
it does not parse, fetch, validate or execute publication content.

`packPublication` transfers each unique input ArrayBuffer to the worker, receives
the packed result by transfer, and terminates the worker on success, abort,
message failure or execution failure. Listeners are removed on every settlement;
late messages cannot return stale bytes. The main thread no longer reads the
transferred resource buffers. Later chapter rendering reads the original local
Blob through the existing resource/cache path.

The 4 MiB routing threshold is an initial startup-cost heuristic, not a publication
limit or a universally calibrated crossover. The measured small fixtures were
about 13/79 KiB and did not justify worker startup; the dense output was about
19.65 MiB. More intermediate-size/device evidence may justify tuning this choice.

Small inputs, unavailable Worker support or synchronous constructor failure retain
the bounded synchronous path. A failure after posting does not repack potentially
detached inputs: preparation rejects cleanly and the reader can retry. Abort
terminates even a worker whose script has not finished loading. No extra Blob URL
is introduced for the worker; Vite emits its static application asset.

A whole exclusively owned packed ArrayBuffer is now returned directly to the
publication. The previous unconditional `buffer.slice` made another archive-sized
copy. A subarray still copies its intended byte window so unrelated prefix/suffix
bytes cannot escape. Unit coverage checks both ownership cases.

Transferring buffers avoids a structured-clone copy, but the worker has startup,
code and runtime memory costs. DOMs, strings, original input and packed output
still consume memory. No physical RAM/process/GPU improvement is measured here.

## Isolated production-module comparison

Source before: staging `3d5c6adb`; after: this implementation. Both use production
module bundles with diagnostics disabled in local packaged Chromium. A private
probe instruments native parse/serialize calls and synchronous stage spans, plus
worker packing round-trip time. It measures preparation and the first formatted
chapter together for native call counts and observed main-thread long tasks.

Three fresh-browser repetitions per revision/fixture, 18 final scenarios total:

- Many chapters: 120 short spine sections with navigation.
- Dense chapters: eight sections with 12,000 generated paragraphs each; output
  about 19.65 MiB, within unchanged chapter/node/publication limits.
- Styled chapter: local CSS/SVG and 120 paragraphs, plus a second chapter.

| Fixture      | Parse calls before → after | Preparation median / worst before (ms) | Preparation median / worst after (ms) | Largest observed main-thread long task before → after (ms) |
| ------------ | -------------------------: | -------------------------------------: | ------------------------------------: | ---------------------------------------------------------: |
| 120 sections |                  244 → 124 |                              153 / 172 |                             150 / 159 |                              none recorded → none recorded |
| Dense        |                    20 → 12 |                            1430 / 1546 |                           1311 / 1333 |                                                   149 → 74 |
| Styled       |                      8 → 6 |                                14 / 14 |                               13 / 15 |                              none recorded → none recorded |

The removed parse count equals the spine count. Output archive lengths and
fragment counts agreed between revisions. This is not an assertion that ZIP
headers/timestamps are bitwise identical or that all author documents are covered.

For dense preparation plus the first formatted chapter, aggregate native parse
span median was 384.0ms before and 172.7ms after. Aggregate serialization was
110.9ms and 113.4ms. The old sanitizer span includes serialization; its 484.0ms
cannot be directly compared to the new rebuild-only 377.6ms as independent CPU
savings. Read spans include asynchronous file waits and are not additive CPU time.

Dense packing was synchronous on the main thread before (median 59.6ms). The new
worker round trip was 68.1ms, including startup, packing, transfer and response;
that is elapsed waiting, not 68.1ms of main-thread blocking. Exactly one packing
worker was observed per dense opening and zero for the small fixtures. Dense
long-task counts were 10/10/10 before and 0/1/1 after. Long tasks use the browser's
50ms reporting threshold; none recorded does not mean no blocking occurred.

The first formatted dense chapter took median 172.4ms before and 180.5ms after.
Yielding can increase elapsed stage completion while improving opportunities for
input/cancellation. Individual native DOM operations and fallback synchronous
packing can still block; this change does not resolve all opening/scroll lag.

These are instrumented isolated-module observations, not full-reader first-paint,
real interaction latency, total CPU, process RAM or GPU measurements. Only three
repetitions were collected; before ran first, OS caches/background work were
uncontrolled, and instrumentation adds overhead. No universal budget is inferred.
Memory tradeoffs above describe ownership/copies, not measured total memory.
The private runner/raw reports are not published; only fixture-safe aggregates
are retained here. Browser engines/devices beyond local Chromium remain subject
to merged-source acceptance and owner review.

## Functional validation and manual UI checks

Regression tests cover fragment equivalence/parse count, duplicates and removed
IDs, abort after final serialization, checkpoint cancellation, packing round-trip,
worker success/error/message failure/abort, startup fallback, late messages and
whole-buffer/subarray ownership. Existing archive, XML, CSS, image/font and
navigation safety tests remain applicable.

Generated browser cases verify a real worker is created and terminated, chapter
and text-only transitions remain readable, and closing during blocked worker
startup allows a clean reopen. Existing large-spine, image/font, link, highlight,
position and lifecycle coverage exercises the normal reader integration.

Visual QA remains manual-only. In the PR preview:

| Action                                                                            | Expected behavior                                                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Open a large text EPUB; move the pointer/use other app controls while it prepares | Loading remains usable; no promise of perfectly smooth input during individual native operations. |
| Close immediately during opening, then reopen                                     | No resurrected tab or stuck loader; reopening succeeds.                                           |
| Switch to another document during opening                                         | Document state stays isolated; the selected reader remains usable.                                |
| Navigate contents/internal fragment links, including later chapters               | Correct chapter and anchor; no missing/ambiguous ID guessed.                                      |
| Change formatted/text-only mode and font/width settings                           | Passage continuity, authored styling and text remain correct.                                     |
| Open illustrated/font-heavy books and revisit chapters                            | Images/fonts finish loading, chapter navigation works, and fallback notices remain correct.       |
| Reopen a previously highlighted/bookmarked EPUB                                   | Saved annotations and reading positions retain their targets.                                     |

Manual UI testing verifies behavior and appearance, not CPU/RAM reduction.
Owner review/merge and matching staging cross-browser/publication acceptance are
separate from local evidence. #300 remains open until delivery acceptance.
