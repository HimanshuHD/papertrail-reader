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
