# Local reading statistics (#144)

The shared Reading insights utility panel is available in PDF and EPUB. It displays active foreground time, saved reading visits, current position and furthest position. It has no completed/read inference. PDF position is page/total pages; EPUB position is chapter/total chapters, explicitly labelled **Chapter position**, not a pagination or word-percentage estimate.

## Measurement contract

Time accrues only for a ready reader in a visible, focused document. Opening/restoring a file and EPUB chapter loading do not count. Activity inside the reader (pointer, keyboard, wheel or touch) extends a 60-second deadline. EPUB iframe activity is bridged to the owning reader. After the deadline, the accumulator stops until another reader interaction or a foreground eligibility transition. Background, blurred, page-hidden and idle gaps are excluded even if timer delivery is delayed. `performance.now()` measures elapsed time; wall-clock timestamps are metadata only. Focus/ready restoration begins a new eligible interval. A reading visit becomes saved only after positive active time is checkpointed.

One accumulator owns each file visit. Checkpoints contain cumulative active milliseconds, not increments. A serialized service transaction compares the saved session value and adds only its positive difference to the document total; repeated/older checkpoints cannot double-count time. Different sessions (including reloads) have distinct identifiers. Each checkpoint also records current and furthest position. A last-page jump records a position, never reading completion.

Checkpoints run every 15 seconds and at visibility, focus, ready and page-lifecycle changes, document switches and disposal. Hiding pauses before flushing. Pagehide flushes are best effort: abrupt browser termination or blocked storage can lose time since the last committed checkpoint. This is not background telemetry or a reliable measure of comprehension. Eligible focused browser contexts independently track their visits; no cross-device aggregation or cloud sync is provided.

## Local storage and failures

`ReadingStatisticsStorage` owns a separate `papertrail-statistics` IndexedDB database with version-1 summary and cumulative-session metadata in its `documents` store. This is an additive database, with no upgrade to the existing positions/annotations databases. Document identity is format plus content fingerprint: renames reuse insights, changed contents and different formats remain isolated. No bytes, quotes or notes are copied into statistics.

Reading insight summaries have schema version 1. Unknown/damaged versions are rejected and preserved rather than replaced. Atomic read/write transactions roll back on failures. A generation token prevents a late checkpoint from recreating a reset document's statistics. Reset installs a fresh zero summary, deletes only that document's old session records and starts a fresh visit; bookmarks, notes, reading positions and source files remain intact. The panel asks for a local reset confirmation.

The composable guards asynchronous open/save/reset callbacks by document ownership. Storage errors show an actionable notice and retain current-session time for Retry; no failed save/reset is announced as successful. Checkpoint retries are idempotent. A reset from another tab invalidates the old visit and exposes Retry to open a fresh generation; it never replays the discarded cumulative time. Unavailable persistence does not block reading.

## Annotation overview

The panel derives highlight and note counts from the current format/fingerprint-scoped annotation coordinator. Each saved highlight counts once, regardless of rendered fragments or its page/chapter; notes count only non-empty trimmed note text. Unsaved selections and note drafts do not count. Successful add/edit/delete operations refresh the counts reactively. Loading and unavailable annotation metadata have explicit states instead of a false zero. **See annotations** switches directly to the current document’s Annotations panel, including its recovery controls. No counts or notes are duplicated into statistics storage; resetting insights preserves annotations and their counts.

## Verification

Tests cover monotonic/idempotent time, idle cutoff, delayed timers, visibility/blur/loading transitions, reader activity, document switching, duplicate/older saves, reload session identity, per-format/content isolation, reset generation guards, session cleanup, atomic rollback and unknown schemas. Native IndexedDB lifecycle, iframe activity, visual themes and page-close durability remain in release acceptance #145/#28. Feature branch checks do not replace that browser gate.
