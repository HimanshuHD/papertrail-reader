# Long EPUB chapter navigation

PR #270 fixes a reproduced chapter-navigation stall. A local CPU investigation
identified canonical text indexing for highlights as the hot path. The adapter
previously indexed the chapter even without applicable saved highlights, and
repeated checks on a growing concatenated string became expensive on long text.

The adapter now builds text with an array and one final join. UTF-16 offsets,
whitespace normalization, annotation limits and saved selector behavior remain
unchanged. It skips indexing when no saved highlight belongs to the current
chapter; highlights remain supported.

## Validation

- The no-highlight indexing regression fails before the fix and passes after.
- Generated long-chapter navigation fails before the fix and passes after.
- The generated browser cases passed at all five existing Chromium viewport
  widths: **10 passed**, no retries. Coverage includes no annotations, saving
  and repainting a highlight after repeated navigation, formatted/text-only
  round trips and reader closure. Existing timeouts/readiness checks remain.
- Unit cases verify skipped work for empty/other-chapter annotation sets and
  canonical text/range correctness with whitespace, inline nodes and surrogate
  pairs in a generated long chapter.
- The supplied EPUB was tested locally through chapter navigation, saving a
  highlight and returning to that chapter. No browser errors were observed in
  that check. It is not installed-device or all-engine certification.

Only generated test text is committed. The uploaded EPUB, identifying metadata,
raw CPU traces, timing measurements and machine information are not published.
This fix does not complete the separate EPUB retention investigation or accepted
performance-target work in #16/#250. Historical profiler checkpoints remain tied
to their recorded source; no new profiling/budget acceptance is inferred here.
