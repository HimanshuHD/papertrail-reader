# Reader CPU and memory work review

Scoped code review and regression fixes in PR #270. This is not an exhaustive
browser/process profile or a claim that every expensive document is now cheap.
Raw profiles, documents and machine/timing data stay private. #16 owns remaining
profiling/cleanup; #250 owns accepted workload targets.

## Removed unnecessary work

| Path                      | Finding                                                                                                               | Change                                                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF canonical text        | The per-character growing-string/check pattern also existed in PDF search/highlight normalization.                    | Build canonical text with an array and one join; preserve whitespace, synthetic span boundaries and UTF-16 offsets.                               |
| PDF saved highlights      | Ready text layers were indexed even with no saved annotations for that page.                                          | Filter applicable page annotations before reading/indexing text.                                                                                  |
| PDF multiple ranges       | Painting rebuilt the same page index for each resolved segment. Capture and reveal also rebuilt it to create a range. | Share one fresh index inside each synchronous operation. Do not retain DOM maps across renders; text-layer replacement must produce fresh ranges. |
| PDF whole-document search | Search built per-character source-position objects and immediately discarded them, keeping only canonical text.       | Use equivalent text-only normalization without per-character arrays or position objects; allocate source positions only for DOM mapping.          |
| EPUB selection capture    | Selection intersection was tested against the DOM for every character position.                                       | Check each text node once, then use numeric bounds for character positions.                                                                       |

The preceding long-EPUB fix also skips painting-time indexing for empty/unrelated
annotation sets and makes its canonical text construction linear. Existing saved
selectors require no migration. PDF extraction/rendering, file permission flows,
zoom limits and reading-position semantics are unchanged by this increment.

## Existing controls checked

- PDF text search is requested by the search flow, stops at its match limit and
  checks cancellation while progressing through pages. It is not an automatic
  full-document scan on every page paint.
- PDF rendering is proximity-driven. Leaving the render range releases full
  bitmap/text-layer state; previews have an existing bounded cache. Source maps
  introduced for highlight painting are transient rather than another cache.
- Reader instance retention for inactive tabs is intentional and bounded by the
  existing inactivity policy. It enables warm tab switches; it is not itself
  evidence of a leak.
- EPUB resize/restoration callbacks have existing scheduling and teardown
  controls. This review does not replace their real-clock/native acceptance.
- Reading-time heartbeats track activity/metadata rather than reindexing document
  text. Their existence alone is not a CPU hotspot or a measured overhead budget.

## Remaining investigations and tradeoffs

| Area                               | Evidence / risk                                                                                                                                                                                     | Follow-up                                                                                                                                                                                                     |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Closed EPUB readers                | The prior heap investigation found retained closed reader DOM. Navigation/indexing fixes do not establish cleanup.                                                                                  | Resolve the engine/reader retention path and repeat independent heap/process observations under #16.                                                                                                          |
| PDF high zoom and display density  | The renderer allocates canvas backing pixels at the selected scale and device density; committing a render temporarily uses pending and displayed bitmaps. Pixel memory grows with both dimensions. | Measure representative image/text PDFs before choosing a backing-pixel budget or quality tradeoff. RGBA size estimates are not physical GPU/process RAM measurements. No arbitrary quality cap is added here. |
| Dense highlight pointer movement   | Hover hit-testing can measure/check many saved rectangles for pointer events.                                                                                                                       | Profile annotation-heavy documents before adding frame coalescing or geometry caching; stale geometry must not select the wrong annotation.                                                                   |
| EPUB location fallback             | Browsers without a useful caret result fall back to bounded text/geometry scans while locating the reading point.                                                                                   | Profile long-chapter scrolling on affected engines; preserve accurate saved positions if scheduling or indexing changes.                                                                                      |
| Very large selected text/documents | Required DOM mapping, extraction, publication preparation and layout still consume CPU/memory even after redundant work is removed.                                                                 | Use representative workloads and accepted targets; consider chunking/worker boundaries where the relevant APIs permit it. DOM Range/layout work cannot simply run in a worker.                                |

These follow-ups are not silently marked fixed. Existing annotation/text/archive
limits remain. No universal heap ceiling, CPU percentage, speedup or accepted
performance budget is inferred from code inspection or passing functional tests.

## Regression verification

- Component tests fail before the PDF lazy/single-index changes and pass after.
  They assert zero page-text traversal for empty/unrelated annotations, one
  traversal for a multi-highlight repaint and fresh indexing after layer replacement.
- Dense canonical-text tests verify PDF search-only/indexed text parity,
  surrogate-pair offsets, whitespace normalization and synthetic span separators.
- PDF selection/range tests verify one source traversal per selected page.
- EPUB selection tests verify one intersection check per text node while
  preserving selection and canonical-range behavior.
- Browser coverage exercises real PDF search, highlights/notes, rotation,
  virtualization/reveal and the long-EPUB saved-highlight cases. Recorded results
  belong in the PR checklist, not in invented runtime budgets.

The existing rotated-highlight browser check also failed on the unchanged PR
baseline: it compared the span layout box instead of the selected glyph Range.
The overlay matched native Range geometry. The check now reads Range/overlay
geometry in one frame and asserts position **and size**, retaining its existing
pixel tolerance. No renderer geometry, timeouts, retry policy or tolerance is
relaxed to accept the optimization.
