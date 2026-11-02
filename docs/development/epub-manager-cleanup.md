# EPUB manager lifecycle cleanup

The pinned epub.js 0.3.93 engine has two independent window-listener cleanup
defects. Its default manager registers an anonymous bound `unload` handler without
removing it. Its stage registers `orientationchange`, but attempts removal with
`orientationChange`. Either strong window reference can retain a closed manager.

`view-manager.ts` supplies a subclass through the existing rendition `manager`
option, using the default manager from the same loaded engine. It keeps removable
unload/scroll identities and remembers the original scroll target. Destruction
removes those listeners and the correctly cased stage orientation/resize
callbacks before entering engine teardown. A pending throttled resize is cancelled
when supported. Repeated destruction does not rerun engine disposal, including
after a cleanup exception. No window API or dependency source is patched.

This adapter is version-specific. Recheck the default-manager and stage lifecycle
when upgrading epub.js; real-engine tests cover their registration behavior.

The same isolated integration also coalesces trailing engine location reports.
Its engine and adapter timers are cancelled on listener removal. See
[EPUB scroll attribution](epub-scroll-attribution.md) for measured behavior,
notification-delay tradeoffs and remaining work. Live scroll delivery and the
application's accurate final-location flush remain independent.

## Verification and limits

- The initial five listener lifecycle regressions failed against unmodified
  default-manager behavior and pass with the adapter. Tests cover container/window
  scrolling, rebinding, original-target removal, unload and repeated teardown.
- An additional real-engine render/destroy test checks stage orientation cleanup
  across ten cycles. Failure-path coverage checks removal before downstream
  teardown errors and cancellation of pending resize work.
- Session tests cover abort during book opening, initial chapter display and later
  navigation, as well as failure and repeated disposal.
- The Chromium browser regression opens/closes a generated EPUB ten times without
  reloading. CDP inspection verifies unload/orientation listener counts rise for
  the live reader and return to their baseline after each explicit close. The
  baseline implementation fails the post-close check. This is listener evidence,
  not a total-memory assertion. CDP inspection is explicitly Chromium-only.
- Long-chapter browser cases retain navigation, saved highlights and mode changes.

A separate local GC/heap investigation used the generated fixture at baseline and
after five/ten closes. Removing unload alone left a strong orientation-listener
path; removing both stopped the observed accumulation of closed managers in that
workload. A last closed reader remained reachable through an inspection/cache and
workspace-observer path, so this result does **not** establish complete cleanup or
close the broader retention investigation. Separate application roots from
instrumentation roots before any further fix or leak verdict.

Raw snapshots stay private. No CPU speedup, physical GPU/RAM reduction, accepted
performance budget or universal absence of leaks is inferred. Five-minute warm-tab
retention is intentional and unchanged; these checks concern explicit closure.

## Workspace observer follow-up (#295)

The engine adapter is already integrated through #271. A separate application
ownership path remained: `DocumentSessionWorkspace` kept its disconnected resize
observer in component scope after the final tab closed. The callback captured the
removed workspace element. Disconnecting an observer stops observation; it does
not remove an application reference to the observer or its callback.

The observer now belongs to the root watcher's cleanup lifecycle, which runs when
the root changes or the component unmounts. Its callback reads the current root
ref instead of capturing the old element, and an invalidation flag rejects late
deliveries after cleanup. A regression failed on the prior implementation because
an explicitly delivered stale callback read closed-workspace geometry. It covers
final close, reopen, stale delivery after reopen and unmount. This confirms the
callback/ownership correction, not a browser-GC or process-memory improvement.
The five-minute inactive-reader policy and engine adapter are unchanged.

### Remaining browser acceptance

Fresh local browser/heap verification for #295 is pending: the Chromium download
returned an invalid archive in the implementation environment. Do not reuse the
earlier #271 heap observations as measurements of this follow-up.

Use generated fixtures and matching builds for the following manual investigation:

1. Start a fresh local browser/context for each baseline/fixed run, with matching
   viewport, fixture, cache state and build flags. Keep visual QA manual-only.
2. Record a settled empty-workspace baseline, then open/close the same generated
   EPUB ten times without reloading. Capture matching checkpoints after five and
   ten explicit closes. Allow opening/disposal promises, scheduled callbacks and
   a consistent settling interval to complete before each checkpoint.
3. Run a natural-GC/process observation separately from forced-GC heap inspection.
   Record the process sampling method, baseline/peak/settled values and attribution
   limitations privately. JS heap and canvas estimates are not process/GPU RAM.
4. For heap inspection, use comparable forced-GC conditions at all checkpoints.
   Trace any remaining closed workspace/reader/manager through strong roots.
   Classify weak/conditional edges separately. Check that the disconnected
   workspace observer is no longer an application root.
5. Avoid storing reader elements or engine instances in console variables,
   selected-node history or test globals. Release CDP remote-object groups and
   handles. Compare an inspection-light run with the instrumented run before
   attributing retained objects to the application. Inspector/cache roots need
   independent confirmation; do not assume every remaining root is tooling.
6. Check listener baselines, abort during opening/display, repeated disposal,
   close/reopen, position/highlight restoration, typography, resizing and mode
   transitions. Exercise warm tab switching separately from explicit closure.

Publish only sanitized fixture-based conclusions and limitations. Raw documents,
heap snapshots, CPU profiles, local paths, machine details and private measurement
reports must remain private. Keep #295 open until the remaining acceptance is
recorded; no universal memory budget or leak-free verdict follows from tests.
