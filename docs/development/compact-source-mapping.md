# Compact highlight source mapping

Issue #301 replaces per-character source-position objects in PDF DOM search and
PDF/EPUB highlight mapping. Search-only PDF indexing already avoids this map and
is unchanged.

## Code and behavior

`src/features/annotations/text-source-map.ts` stores each contiguous run as three
typed-array entries: canonical start, source part and source offset. Each run uses
12 bytes of numeric metadata. A run ends when the source node changes or collapsed
whitespace skips source offsets. The builder grows geometrically and trims its
final snapshot; it does not allocate a source-position object for each character.

`at()` binary-searches run starts and adds the canonical displacement to the
source offset. It creates an object only for a requested endpoint. `bounds()`
intersects selected source intervals with runs once to find their canonical
envelope. Construction remains linear, endpoint lookup becomes O(log spans),
and selection-envelope work becomes O(spans), with O(1) map lookups per span.

`pdf/search-text.ts` and `epub/highlights.ts` retain their existing normalization
loops. UTF-16 code units, including both halves of surrogate pairs, remain the
offset unit. PDF's inserted inter-part spaces retain an unmapped sentinel.
EPUB's inserted block space still maps to offset zero of the next node, including
the duplicate mapping when its first character also has offset zero. Leading,
trailing and repeated whitespace behavior remains unchanged.

`pdf/highlights.ts` and EPUB selection capture use span intersections instead of
scanning per-character objects. Range construction maps numeric part IDs back to
the existing local node table. Stored selectors, quote/context resolution,
fingerprints, CFI handling and persistence schemas are unchanged; no migration is
needed.

The map has no DOM references, listeners, cache or global registry. Node tables
and indexes remain local to capture/search/repaint calls. Existing resolved
Ranges still intentionally refer to the active chapter; existing reader repaint
and disposal paths release those references. This change does not establish
complete reader leak freedom.

## Generated-fixture measurements

An isolated production-module comparison against staging `a77726b` ran 36 cases:
PDF and EPUB, three fixtures, before and after, three fresh Chromium instances per
case. Inputs and DOM were prepared before the baseline. A completed index was
intentionally held while forced-GC JavaScript heap size was sampled; it was then
released and GC sampled again. The table reports medians, including the canonical
text and index wrapper, rather than just typed-array storage.

| Format / fixture | Normalized UTF-16 units | Retained JS heap delta, KiB before → after | Construction, ms before → after | 10,000 endpoint lookups, ms before → after | 20 selection-envelope queries, ms before → after |
| ---------------- | ----------------------: | -----------------------------------------: | ------------------------------: | -----------------------------------------: | -----------------------------------------------: |
| PDF dense        |               1,099,999 |                             28,757 → 2,182 |                    136.8 → 55.7 |                                  2.0 → 0.9 |                                      304.9 → 0.2 |
| PDF fragmented   |                 188,889 |                                4,904 → 310 |                     26.3 → 13.1 |                                  0.9 → 3.4 |                                       45.0 → 3.2 |
| PDF whitespace   |                 349,999 |                             10,036 → 1,695 |                     53.6 → 30.6 |                                  1.5 → 4.8 |                                     105.9 → 36.7 |
| EPUB dense       |               1,099,999 |                             27,692 → 1,118 |                    149.4 → 69.2 |                                  1.7 → 0.9 |                                      312.4 → 0.1 |
| EPUB fragmented  |                 188,889 |                                5,208 → 518 |                     40.4 → 23.2 |                                  1.1 → 3.7 |                                       51.6 → 6.3 |
| EPUB whitespace  |                 349,999 |                                9,069 → 728 |                     67.1 → 43.6 |                                  1.1 → 4.8 |                                     102.9 → 35.6 |

The dense fixture repeats `Alpha beta ` 100,000 times in one source node. The
fragmented fixture has 5,000 nodes containing a numbered prefix, a surrogate-pair
character, repeated words and a suffix. The whitespace fixture repeats
`a  b\t\t🌿\n\n` 50,000 times in one node. Their compact maps contain 1, 9,999 and
150,000 spans respectively: 12, 119,988 and 1,800,000 metadata bytes. The same
fixture text was used for both revisions. Canonical-text and sampled-lookup checksums and selected-source envelopes
matched across revisions and repetitions.

These are retained JavaScript heap deltas and isolated operation timings. They
are not allocation-rate or peak-memory profiles, whole-reader speedups, physical
RAM or GPU measurements. GC/runtime effects remain: released-index medians range
from approximately -62 to 1,112 KiB relative to baseline, and changed by about
7–10 KiB between revisions. Returning near a baseline does not prove the absence
of other ownership roots.

Fragmented and whitespace-heavy endpoint lookups are slower because they now
binary-search spans. Dense span compression is much stronger than compression
of heavily collapsed whitespace. The transient character array remains, and
growth plus final buffer trimming can temporarily overlap allocations. Full
reader latency and transient peak allocations were not measured. No universal
memory budget or percentage reduction for arbitrary documents is claimed.

## Automated validation

Focused tests verify literal legacy UTF-16 mappings, unmapped PDF separators,
EPUB's duplicate block-boundary source points, dense and empty input, builder
growth and snapshot ownership, and selection bounds against explicit source
positions. Existing tests exercise native cross-node/cross-page selection,
repeated quotes, old saved selectors, range restoration and highlight disposal.
Functional browser checks cover real PDF selection/search/rotation and EPUB
creation, mode changes, restoration and reveal. Visual QA remains manual-only.

Local validation passed: 601 unit tests across 102 files, 128 pipeline tests,
lint/format/types/build, and 23 Chromium functional cases with zero retries.
The functional set includes native cross-page PDF selection at four rotations
and two zoom levels. Cross-browser staging acceptance remains a delivery check.

## Manual UI validation

Use the same local documents and saved library for before/after checks. No visual
change is intended.

| Action                                                                                              | Expected behavior                                                                                          |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Reopen PDF/EPUB files with highlights saved before this change                                      | Quotes, colors and notes restore without migration; annotation reveal reaches the same passage.            |
| Select across wrapped lines, inline emphasis and repeated words; include emoji and irregular spaces | The saved quote covers the intended passage with no shifted endpoints or neighboring duplicate occurrence. |
| Select across two rendered PDF pages, save, rotate through all four orientations and change zoom    | Both segments remain associated with the correct text after repaint.                                       |
| Search PDF words crossing text-node boundaries; zoom and reveal different occurrences               | Matches resolve to the correct source text and remain selectable.                                          |
| Switch EPUB formatted/text-only modes, chapters and typography; return to a saved highlight         | The existing selector resolves consistently and the reading position remains usable.                       |
| Scroll PDF pages out of rendering range, return, switch tabs, close and reopen                      | Highlights repaint correctly; closed readers do not reappear. Warm tabs retain their intentional behavior. |

UI correctness cannot establish a heap reduction. Reproduce the module comparison
with generated fixtures, unchanged inputs and fresh browser contexts; measure
construction separately from input setup and report lookup tradeoffs. Keep raw
documents, private probes, heap data and machine details out of public issues.
