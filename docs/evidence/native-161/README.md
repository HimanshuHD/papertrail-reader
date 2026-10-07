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

The headed Chromium tab-focus case under Xvfb disables Playwright’s focus emulation and checks timer pause/resume using `bringToFront()` and real `document.hasFocus()` without synthetic focus events; it executes once at 1440px, with four deliberate duplicate-width skips. Time advances through Playwright virtual time. This is browser tab focus, not an OS multi-window test. PDF/EPUB annotation menus retain light/dark captures with viewport bounds, dismissal, and selected-row border checks.

## Remaining gates

- Additional multiline/blank-margin permutations beyond the listed cases; the existing margin test and expanded cross-page/rotation tests are complementary.
- Inspect results for the newly added missing-anchor, committed-refresh, draft and metadata combinations before accepting them. Changed-source isolation remains covered by the existing PDF/EPUB annotation tests.
- Inspect current-source light/dark marker, tooltip/hover/border, viewport-edge popover and typography/reflow captures; existing functional assertions are not complete visual certification.
- Actual installed Chrome/Edge and macOS Safari, HTTPS, real OS multi-window focus delivery and device checks under #28. Linux Playwright WebKit is not Safari certification.

Keep #161/#28/#16 and roadmap #78 open until their acceptance is fulfilled. Record reproduced product defects in #139. Major release #19 follows acceptance; staging/deployment implementation follows the major release.

## First candidate — failed acceptance

Source `699f94c8044ead71f8c83db29203829c8cf53929`, checkout `be2b27fd0e12ebd82f7f84745017cf2f07388025`: Browser E2E [37572465053](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37572465053) reported **222 passed, 18 failed, one flaky, eight intentional skips**. Frontend CI 37572445878 passed. Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6 on Linux; exact identity/outcomes retained in `first-environment.json` and `first-outcomes.json`. Both non-Chromium smoke subsets and the existing regression suite passed; failures were in the added fixtures.

Corrections: install the virtual clock before the reading session; measure the selected PDF Range rather than the span box; reach actual 25% zoom from large fit-width baselines before native cross-page gestures; wait for EPUB restoration/font/layout readiness before capturing distant text. These are fixture corrections, not claimed product fixes. Expanded combinations and corrections require a fresh candidate run.

Artifacts browser-summary 11461827053 and browser-review 11461354267 expire 14 October 2026. No passing release acceptance is inferred from this run.

## Checks requiring the target environment

These are not requested from the owner until automated acceptance and evidence inspection are complete. The available environment cannot drive the owner's desktop windows or macOS Safari. Record the candidate build SHA, URL, OS and full installed browser version for each result.

1. On the candidate HTTPS deployment in installed Chrome and Edge, select a folder and individual files; reload, renew permissions and reselect. Open a PDF and formatted EPUB, switch documents and confirm saved positions/annotations remain isolated.
2. In macOS Safari, use its file-selection fallback; repeat PDF/EPUB read, reload/reselection, notes, insights and storage-clear recovery. A Linux WebKit result remains separate.
3. With the insights panel visible, read for several seconds, switch to another OS window for ten seconds, then return. The timer pauses while unfocused and resumes without needing a scroll. Repeat with both PDF and EPUB, and with a second browser window.
4. On any devices included in the declared release support, verify selection, note menus and resizing/orientation at their actual input/viewport settings. Emulated-width results are retained separately.

If release support is limited to the tested engines, document that explicit scope through #28 rather than checking untested products or devices as passed.

## Second candidate — failed acceptance

Source `719dfe030063e2f6ed646b2ece78b259dca68a81`, checkout `374fad21b17c1be51468f73895d63352129ef224`: [Browser E2E 37573574112](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37573574112) finished with **275 passed, 33 failed, three flaky, eight intentional skips** in 17.3 minutes. Frontend CI 37573552103 passed. Exact environment/outcomes are retained in `second-environment.json` and `second-outcomes.json`; compact artifact 11462121283 expires 14 October 2026.

The selected PDF Range offset, missing-anchor recovery and loading/unavailable metadata cases passed. Remaining fixture errors: headless Playwright focus emulation keeps pages focused; retry interactions added legitimate active time and updatedAt changes; complete-event listener ordering let refresh happen before rejection; iframe animation-frame callbacks did not resolve; rotated text fell outside the viewport. Three timing flakes also involved PDF library reopening/actions.

Next candidate uses headed native focus once under Xvfb with focus emulation disabled, pauses eligibility during quota retry and compares only activeMs/visits, blocks refresh in a capture-phase completion listener, waits for layout in the parent window, brings both rotated text lines into view, and settles library/trigger state before interaction. Acceptance is split into two jobs with independent artifacts; discovery verifies 160 + 159 cases with zero overlap (319 total). Trigger policy remains reviewed release-to-main opening/readiness. Both shards must pass; a failed shard does not cancel the other.

### Collection failure — run 37575721571

Candidate `2ed5cf782ee9c6e15756c230dec281a2f2237de2` passed Frontend CI 37575686220, but both browser shards failed collection before executing tests: the worker-scoped `headless` option was declared inside a describe group. No browser acceptance is claimed for this run. The headed focus case is moved to a dedicated file with top-level options; both shards must pass collection before the next candidate is published.
