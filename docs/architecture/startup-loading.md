# Startup loading

Issue #171, v2.1.0 increment; delivery acceptance remains #130/#175.

## Lifecycle

index.html contains the semantic startup screen and loads its small stylesheet before the application module. The separate app root starts inert. main.ts imports bootstrap dynamically so a bootstrap failure can display retry feedback without depending on Vue mounting.

bootstrap.ts initializes Pinia, theme and the existing hash router. Home reveals after mount; direct reader visits reveal after saved workspace metadata is checked and rendered. Cached listing readiness is separate from permission checks, source rescanning and PDF/EPUB reopening: those continue through existing local loading/Resume library behavior.

Normal builds show completed-startup-step progress: resources, route, saved-library check and first workspace render (0/25/50/75/100%). This is a count of completed milestones, not download-byte progress. It never advances merely because time passed. Preview builds alone use a labelled seven-second animation-review timeline (0–99%) and dismiss at 100% only after both real readiness and the minimum review window. A slow preview that takes longer than seven seconds dismisses immediately when ready; it does not add another seven seconds. Errors interrupt the hold immediately. Ready releases app interaction immediately and removes the visual layer after a 160 ms exit transition, or immediately with reduced motion. Later routes/document switches do not reopen it.

An early independent 20-second watchdog and script-load error handler provide Try again even if the module fails to initialize. A timeout is an actionable failure, not an assertion of successful readiness. Reload preserves the hash route. Missing/unavailable saved metadata remains the existing recoverable workspace notice rather than making startup fatal.

## Assets and accessibility

The owner supplied a 4×4 realistic book sprite and the screen mock. The sheet is normalized to an exact 1280×1280 grid and encoded as local WebP (87,398 bytes); the supplied brand crop is 1,380 bytes. CSS selects all sixteen frames; no document data is included or uploaded. Asset bytes are part of the existing deployment candidate checksums. No new external font/animation dependency is introduced.

The screen retains the reference's navy/mint appearance in both app themes. Text is semantic live HTML, images are decorative, status changes are polite, stage states are accessible and reduced motion disables both book and progress animation. The preview review hold is an explicit owner request; staging/production remain immediate on readiness. The startup watchdog is cancelled at actual initialization, so a preview review delay cannot create a false startup timeout.

## Validation

Service tests cover stage ownership, immediate interaction release, one-time disposal, retry failure retention, reduced motion and absent markup. Native fixtures hold the actual bootstrap asset to inspect/screenshot the genuine loading state, release it to test dismissal, inject load failure/retry, and check reduced motion.

Owner visual acceptance and new staging browser execution remain pending while the PR is draft. Local cloud preview was attempted; browser access was blocked. Do not count static/build checks as visual QA.
