# Remaining native acceptance — #161

## Release sign-off — 8 October 2026

Owner explicitly approved release preparation under #19. Target: **v2.0.0**. #28 acceptance is completed for the declared tested scope: Linux Chromium at five widths and Firefox/WebKit smoke subsets. This does not certify unreported installed browsers, physical devices, HTTPS permission behavior or real OS-window results. Additional #161 coverage and #16 performance measurements remain open and are disclosed release limitations.

#163 remains documentation reconciliation. After its owner merge, create one fresh `release/2.0.0` branch from updated main, update package/root-lock versions and CHANGELOG, validate the reviewed packaging PR, and verify the exact merged production build before publishing its tag/release. #26/#32/#44 are deferred post-release work, not completed tasks.

Work in PR #162. Reviewed release-to-main Browser E2E [37585840311](https://github.com/HimanshuHD/papertrail-reader/actions/runs/37585840311) passed on source `ea2e72b7c810f3c89ba7d3269a660d9dd966a6cd`, checkout `a2c84480ea13da0b4a0fbabd859433f8b427d28d`: **307 passed, zero failed, zero flaky, 12 intentional skips**. Frontend CI 37585690924 passed. The matrix distinguishes the executed scope from remaining release gates; earlier pending checkpoints below are historical.

| Scope                           | Candidate coverage                                                                                                                                                                                                                          | Evidence state                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Native PDF cross-page selection | Pointer drags forward/backward through page gaps, outside/re-entry; 0/90/180/270 degrees at 25%/50% zoom; cancellation followed by independent selection                                                                                    | Passed: 37585840311                                         |
| Highlight navigation            | Distant virtualized PDF and long EPUB highlight align 24px below the reading viewport; EPUB both modes; missing page/chapter anchor remains unresolved                                                                                      | Passed: 37585840311                                         |
| Statistics integrity            | PDF/EPUB unsupported schema retained through retry; injected quota checkpoint failure/retry with native IndexedDB preservation and single visit; cancelled note drafts, committed-write/refresh rejection, and unavailable/loading metadata | Passed: 37585840311                                         |
| Engine smoke                    | Firefox/WebKit at 375/1440px: file fallback, reload/reselection, PDF text/canvas, formatted EPUB/image/modes, resize, dark mode, insights, no remote requests                                                                               | Passed: 37585840311                                         |
| Existing Chromium regression    | Full suite at 320/375/768/1024/1440px, including annotation counts/filters/notes, reading timer lifecycle/idle/two-tab reset and visual captures                                                                                            | Passed: 37585840311; prior #160 evidence remains historical |

The quota failure is deliberately injected at the IndexedDB write boundary; the recovery write and persisted summary use the native database. Lifecycle events in the automated timer tests are synthetic. Pointer movement is delivered through Playwright's browser input, while pointer cancellation is deliberately injected. These distinctions must remain visible in acceptance claims.

## Additional candidate checks

The headed Chromium tab-focus case under Xvfb disables Playwright’s focus emulation and checks timer pause/resume using `bringToFront()` and real `document.hasFocus()` without synthetic focus events; it executes once at 1440px, with four deliberate duplicate-width skips. Time advances through Playwright virtual time. This is browser tab focus, not an OS multi-window test. PDF/EPUB annotation menus retain light/dark captures with viewport bounds, dismissal, and selected-row border checks.

## Final automated validation — 7 October 2026

Both shards passed without retries: 153 passed/seven skips and 154 passed/five skips. Chromium 153.0.8010.12, Firefox 155.0 and WebKit 26.6 ran on Linux with Node v24.21.0. Exact identity, artifact digests/expiry and all 319 outcomes are retained in `final-environment.json` and `final-outcomes.json`.

The 12 skips are deliberate duplicate-width cases for long-PDF, persisted native-handle and native focus checks; their primary cases executed. All ten PDF/EPUB unsupported-schema cases and the lifecycle/reset/retry, missing-anchor, native focus, rotation/zoom, distant-navigation, recovery and engine-smoke cases passed on first attempt.

Original current-source captures were inspected and retained: [PDF mobile light](pdf-actions-mobile-light.png), [EPUB mobile dark](epub-actions-mobile-dark.png), [PDF desktop light](pdf-actions-desktop-light.png), [EPUB desktop dark](epub-actions-desktop-dark.png). These verify the captured menu/selection states; they do not complete the broader hover, tooltip, reflow or target-environment matrix.

Run 37583116123 (`7cf07f9`) failed with 296 passed, ten failed, one flaky and 12 skips; `twelfth-outcomes.json` retains every case. A pressed cached row was mistaken for live file access, and reader controls were queried before dismissing the library. Run 37584669945 (`a028005`) had 303 passed, two failed, two flaky and 12 skips; `thirteenth-outcomes.json` retains every case. Its added readiness assertion incorrectly required a saved visit before the first checkpoint, and a missing-anchor reselection raced sidebar restoration. The final fixtures explicitly reopen the live entry, wait for restored reader placeholders, and await statistics storage readiness before advancing virtual time.

The final evidence/tracker update changes documentation and retained captures only. Application, test and workflow files remain identical to the browser-tested source above.

## Merge handoff and remaining ownership — 8 October 2026

#162 merged as `15519092f7521d7ec9b6c0d7942be53043a55840`; main CI 37718788012 passed. The final source/results below remain the exact reviewed browser evidence. Later tracker-only changes do not create a new browser run.

| Remaining check                                                          | Owner                           | Evidence needed                                                                                            |
| ------------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Additional multiline/blank-margin and changed-anchor combinations        | Agent, #161                     | Focused implementation/tests and the gated release browser run                                             |
| Detailed marker/tooltip/hover/reflow visual matrix                       | Agent, #161                     | Exact-source captures and inspection                                                                       |
| Indexing/rendering/memory budgets and remaining resource/safety criteria | Agent, #16                      | Measured representative workloads and recorded cleanup/cancellation behavior                               |
| Installed browser, HTTPS, permission renewal, actual device targets      | Himanshu, #28                   | Deployed build/URL, OS, full browser version, cases and outcomes; or an explicit narrower support decision |
| Real OS multi-window reading-timer pause/resume                          | Himanshu, #28                   | PDF and EPUB on the declared target environment                                                            |
| #148 deployed PDF contrast, native drag/wrapped paragraphs and zoom      | Completed owner review, PR #148 | Owner checkbox checked; intrinsic rotation fixtures do not imply a Rotate page UI                          |
| Proposed v2.0.0 support/version, publication and milestone closure       | Himanshu, #19                   | Release review and acceptance of complete milestone scope                                                  |

Owner general app sign-off is recorded from 7 October. It does not assign unreported physical-device/installed-browser results. PR #148's later release-browser checkbox is now completed using #160/#162 evidence; its specific owner check is also checked. There is no user-facing Rotate page control; intrinsic rotation fixtures are separate automated coverage. The other audited recent merged PRs (#160/#159/#158/#155) have no unchecked validation items.

## Remaining gates

- Additional multiline/blank-margin permutations beyond the listed cases; the existing margin test and expanded cross-page/rotation tests are complementary.
- The executed missing-anchor, committed-refresh, draft and metadata combinations passed in the final run. Additional combinations beyond the listed cases still require explicit coverage. Changed-source isolation remains covered by the existing PDF/EPUB annotation tests.
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

## Fourth pre-execution failure and fifth executed candidate

Run 37576159892 on `26673d146263ec43cc0c2c137341ccdf1f5f4488` failed build because a publication truncation marker corrupted the uploaded fixture. No browser tests executed. The file was republished in bounded chunks and all 17 remote changed files verified against validated local Git blob hashes.

Source `692348f0c2f535c5cdb159875236a3ee70cb1ab5`, checkout `86df7efbcbb7cb2f8bac95166d3b898a1eee8394`: Frontend CI 37576252014 passed. Browser E2E 37576264184 completed with 294 passed, 12 failed, one flaky and 12 intentional skips. Shard 1: 147 passed, seven failed, six skipped. Shard 2: 147 passed, five failed, one flaky, six skipped. Linux Node v24.21.0; Chromium 153.0.8010.12, Firefox 155.0, WebKit 26.6. Compact artifacts 11463225933 and 11462544743 retain exact per-shard results/captures and expire 14 October 2026. This candidate is not accepted.

Remaining failures: ten injected committed-refresh scenarios did not reject refresh opens; one 270-degree/50% PDF drag at 320px exposed the page's unreachable left overflow; native focus did not change under Xvfb without a window manager. The unsupported-schema desktop PDF case retried successfully after an already-restored entry was clicked. Distant PDF/EPUB navigation and quota cases passed.

Corrections: block subsequent database opens immediately after issuing the existing native write; use safe centering for oversized PDF pages; install Openbox under Xvfb for native activation; recognize restored active schema documents. Local runtime disconnected during validation, so fresh GitHub CI must validate these changes before browser readiness. Installed-browser/OS/device gates remain open under #28.
