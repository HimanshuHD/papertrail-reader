# Remaining native acceptance — #161

Work in PR #162. No added case is certified until the reviewed release-to-main run executes it successfully against the recorded candidate.

| Scope                           | Candidate coverage                                                                                                                                                                                                                          | Evidence state                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Native PDF cross-page selection | Pointer drags forward/backward through page gaps, outside/re-entry; 0/90/180/270 degrees at 25%/50% zoom; cancellation followed by independent selection                                                                                    | Pending browser execution                                               |
| Highlight navigation            | Distant virtualized PDF and long EPUB highlight align 24px below the reading viewport; EPUB both modes; missing page/chapter anchor remains unresolved                                                                                      | Pending browser execution                                               |
| Statistics integrity            | PDF/EPUB unsupported schema retained through retry; injected quota checkpoint failure/retry with native IndexedDB preservation and single visit; cancelled note drafts, committed-write/refresh rejection, and unavailable/loading metadata | Pending browser execution                                               |
| Engine smoke                    | Firefox/WebKit at 375/1440px: file fallback, reload/reselection, PDF text/canvas, formatted EPUB/image/modes, resize, dark mode, insights, no remote requests                                                                               | Pending browser execution                                               |
| Existing Chromium regression    | Full suite at 320/375/768/1024/1440px, including annotation counts/filters/notes, reading timer lifecycle/idle/two-tab reset and visual captures                                                                                            | New candidate execution pending; prior #160 evidence remains historical |

The quota failure is deliberately injected at the IndexedDB write boundary; the recovery write and persisted summary use the native database. Lifecycle events in the automated timer tests are synthetic. Pointer movement is delivered through Playwright's browser input, while pointer cancellation is deliberately injected. These distinctions must remain visible in acceptance claims.

## Additional candidate checks

Native browser tab switching verifies timer pause/resume using `bringToFront()` and real `document.hasFocus()` without synthetic focus events. Time advances through Playwright virtual time. This is browser tab focus, not an OS multi-window test. PDF/EPUB annotation menus retain light/dark captures with viewport bounds, dismissal, and selected-row border checks.

## Remaining gates

- Additional multiline/blank-margin permutations beyond the listed cases; the existing margin test and expanded cross-page/rotation tests are complementary.
- Inspect results for the newly added missing-anchor, committed-refresh, draft and metadata combinations before accepting them. Changed-source isolation remains covered by the existing PDF/EPUB annotation tests.
- Inspect current-source light/dark marker, tooltip/hover/border, viewport-edge popover and typography/reflow captures; existing functional assertions are not complete visual certification.
- Actual installed Chrome/Edge and macOS Safari, HTTPS, real OS multi-window focus delivery and device checks under #28. Linux Playwright WebKit is not Safari certification.

Keep #161/#28/#16 and roadmap #78 open until their acceptance is fulfilled. Record reproduced product defects in #139. Major release #19 follows acceptance; staging/deployment implementation follows the major release.
