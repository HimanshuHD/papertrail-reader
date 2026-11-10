# #16 profiling and reliability evidence

This checkpoint covers implementation source `ad52f4ed1a8d28d97d62eec53288922fccc44496`,
tree `e60887ded65cde1516744d5464bddbca3cea5bcb`, in PR #270. Later documentation
archives do not change the measured application, fixture or profiler source.

Local lint, format, types, **126 pipeline tests and 474 unit/component tests** passed.
[Source CI 40368029688](https://github.com/HimanshuHD/papertrail-reader/actions/runs/40368029688)
passed. These are functional/source checks, not accepted performance budgets.

## Reproduced restoration defect

Before the fix, two independent eight-mode stress attempts failed while reopening
a PDF. A failure capture showed the selected page 12 still pending below the
viewport while pages 9/10 had rendered and the reader stayed restoring. The library
width transition had changed page heights after the first restore scroll.

The reader now keeps the pending restore target in view when its viewport changes,
without marking restoration complete before that target renders. The new focused
unit regression fails on the old behavior (no new target scroll) and passes after
the fix. All 19 PDF workspace unit cases pass. Earlier failed development reports
remain private; they are not converted into passing evidence.

## Existing reliability coverage audit

This maps the requested #16 cleanup/document-safety checks to current implementation
and executed unit coverage. It is not a fresh repository-wide security audit or a
claim that arbitrary documents/native environments have been certified.

| Requirement                                    | Implementation                                                                                                                                          | Executed coverage / practical limit                                                                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cancel unresolved PDF open and render          | `src/features/pdf/pdf-session.ts` loading-task abort and active render cancellation                                                                     | `tests/unit/pdf-session.test.ts`: unresolved load abort, obsolete canvas render, text-layer cancellation and pending canvas teardown. Mocked engine contracts; physical browser process termination is separate.               |
| Idempotent PDF teardown and late completion    | Same session close path and diagnostic owner release                                                                                                    | Same tests: concurrent close callers await one teardown, worker destroy even when cleanup fails, late dimensions cannot repopulate a closed session; bounded 128-entry preview cache released on close.                        |
| Malformed/password PDF                         | Classified recoverable errors and password callback task destruction                                                                                    | Same tests: malformed error mapping and password-required fast failure/task destruction. No password-entry feature is implied.                                                                                                 |
| Closed tabs cannot be revived                  | `src/features/reader/document-sessions.ts` runtime attachment/generation checks                                                                         | `tests/unit/document-sessions.test.ts`: rapid activate/close and stale runtime attachment disposal. Five-minute retention is intentional and distinct from closure.                                                            |
| EPUB pending work/observer/listener cleanup    | `src/features/epub/epub-session.ts` and `src/components/viewer/EpubReaderWorkspace.vue`                                                                 | `tests/unit/epub-session.test.ts` and `epub-workspace.test.ts`: pending navigation disposal, queued resize cancellation and no frame/host re-registration after disposal.                                                      |
| EPUB author scripts/remote content             | `src/features/epub/publication.ts`, `book-styles.ts`, `book-images.ts` rebuild an inert publication with local owned image URLs and restrictive CSP     | `tests/unit/epub-publication.test.ts`, `epub-formatting.test.ts`: scripts/active markup, remote chapter references, remote CSS/SVG and unsafe image forms excluded. Not a guarantee against future dependency vulnerabilities. |
| EPUB Blob URL ownership and failed preparation | Publication dispose and error/abort cleanup                                                                                                             | Formatting tests verify disposal is idempotent and later invalid chapter/cancel revokes resources already prepared.                                                                                                            |
| Bounded ZIP reads/expansion                    | `src/features/epub/archive-preflight.ts`: 128 MiB archive, 4 MiB directory, 4096 entries, 32 MiB entry, 256 MiB declared expansion and ratio 200 limits | `tests/unit/epub-archive.test.ts`: overlap, expansion, malformed/truncated/multidisk/size disagreement and cancellation before/through reads. Publication decompression also checks expanded entry bounds.                     |

Ownership counters and these contracts do not prove the absence of native memory
leaks. Heap retaining paths, process memory, representative workloads and accepted
target calibration retain their own evidence requirements.

## Profiling and calibration status

The manual [profiling methodology](../../diagnostics/external-profiling.md) defines
the eight modes, ten-cycle checkpoints, process CPU and RSS semantics, separate
page heap, trace/GC effects, private artifact policy and calibration handoff.
The clean-source natural checkpoint on `ad52f4e` passed **16 mode runs / 160
open-switch-close cycles**, two repetitions of all eight modes. Both production
and diagnostic bundle boundaries passed. Every baseline/five/ten checkpoint had
complete process RSS coverage. Source CI40368029688 passed.

The earlier five-repeat invocation on the same source was interrupted after
28 complete mode runs / 280 cycles. Its status remains incomplete. A separate
review selected its first three complete eight-mode repetitions together with
the passed two-repeat checkpoint: **40 reviewed mode runs / 400 cycles**. This is
a composite review, not a claim that the interrupted command passed. Sixteen
runs were traced; the remaining 24 ordinary metrics runs were reviewed separately
for latency/calibration. Sparse per-profile p95 stays unavailable.

A reporting-only correction in `cfdaf45a706ccdca4223c11e589f345d54454edb`
(tree `6bb338c4e4abb120697d2f79dfbda5259d89fc3c`) excludes traced, GC and failed
repetitions from calibration. Application, fixture and workload measurement code
is unchanged from `ad52f4e`; the CLI changes only the imported final aggregation.
The composite observations were independently reprocessed using this correction.
[Reporting-head CI40369975147](https://github.com/HimanshuHD/papertrail-reader/actions/runs/40369975147)
passed frontend/build and Candidate validation; staging-PR browser was intentionally skipped.

The separate clean-source GC pass on `cfdaf45` passed **eight modes / 80 cycles**
and captured **24 page-target heap snapshots** at baseline/five/ten cycles. No
trace instrumentation or latency calibration is pooled with this pass. Physical
GPU utilization/VRAM is unavailable on this runner. Raw profiles and machine data
remain private; the figures here are fixture-only reviewed outcomes.

## Unresolved retention finding — do not close #16

The GC snapshots show increasing native nodes marked detached, including ten
closed EPUB reader subtrees after ten cycles in the production pass. Production
native-node detachedness counts were **60 → 648 → 1050** at baseline/five/ten;
minimized sampling was **2 → 590 → 1021**. These are V8 native-node counts, not
physical memory bytes or an all-browser leak certification. Instrumented
ownership counters still returned zero viewers/worker owners/Blob URLs: those
counters alone did not expose this retaining path.

A strong-path investigation of an early closed EPUB pane (excluding weak and
conditional WeakMap ephemeron edges) reached a window registered event listener,
a bound engine manager, its request/book closure, an aborted signal/error stack
and the closed component vnode/DOM. Installed `epubjs@0.3.93`,
`src/managers/default/index.js`, registers an anonymous bound `unload` handler in
`addEventListeners`; `removeEventListeners` removes only its scroll handler.
This is a concrete cleanup defect and a candidate cause of the retained closed
reader graph. A remediation and a fresh before/after heap/retaining-path run are
still required; profiler/console roots and the last workspace observer also need
to be distinguished. No fix or absence-of-leak claim is made here.

V8 detachedness interpretation is documented in its
[EmbedderGraph Node API](https://v8.github.io/api/head/classv8_1_1EmbedderGraph_1_1Node.html).
Names alone were insufficient: these snapshots did not prefix detached native
names with “Detached”. The explicit detachedness field was inspected.

## Remaining calibration

The bounded recorder retained only a subset of cold-open rows at the end of a
ten-cycle run (nine PDF and twelve EPUB cold-open observations per active mode
in the composite review). Their p95 remains unavailable. The small mixed fixture
also does not establish 100/1000-file, large/image PDF, long EPUB, saved-workspace,
expiry or installed-device budgets. Those profiles remain unconfigured until
matching evidence and scoped targets are accepted. The new tool therefore does
not close #250 by manufacturing thresholds from limited observations.

No #16 or #250 accepted performance targets are established by this checkpoint.
The Windows WebKit rerun/native-folder checks are set aside per owner direction;
this does not mark #253/#167 accepted or completed.
