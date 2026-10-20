# Document workspace acceptance (#223)

Implementation base: #237 staging merge `266163cebeb057b305fdb6932c700ecfc06592fe`, tree `83841b16177a0bb9057b8513ef32fdc1c188d8f1`. The owner confirmed preview approval. Staging integration [39370718283](https://github.com/HimanshuHD/papertrail-reader/actions/runs/39370718283) must pass before #222 is closed; merge alone is insufficient.

## Coverage and repairs

| Area                         | Evidence                                                                                                                                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recovery UI contract         | Legacy annotation/insights tests now wait for the accessible Reconnect local document action, rather than the removed single-document placeholder. Unresolved-anchor/no-navigation checks are retained.                     |
| Cancellation and denial      | The combined test preserves exact warm PDF/EPUB nodes and their independent page/chapter state across picker cancellation and denial. `NotAllowedError` now follows the existing dismissed/denied path, with unit coverage. |
| Corrupt document isolation   | A corrupt PDF reports its local error without disrupting a warm EPUB or another PDF; closing it preserves the remaining readers.                                                                                            |
| Pending open/last close      | An explicitly delayed identity check is released after final-tab closure; no reader/tab is resurrected, and a subsequent document opens normally.                                                                           |
| Supported engines            | The existing Firefox/WebKit scenario now checks reload shells, explicit source reconnection, PDF page state and mixed-format tab switching/settings. No new pipeline is introduced.                                         |
| Existing integrated coverage | Document tabs, session isolation, five-minute reader retention, tab restoration, future schemas, annotations, bookmarks, insights and native folder restoration retain their existing suites.                               |

## Acceptance boundary

Use this issue/PR's recorded exact-source test results, not a blanket acceptance claim from this document. Both staging shards failed (358 passed, 42 failed, 2 flaky, 12 intentional skips in total), and publication was skipped. Its failures include legacy recovery text, a changed-content refresh selection expectation, and EPUB annotation-panel recovery; recent-file rename was flaky. The repair retains changed-content disconnection, waits for committed panel state before reload and targets the current verified recent filename.

The first local preflight reproduced the removed-placeholder assertion in PDF and EPUB at 375/1440px. The EPUB annotation recovery failure also reproduced in supported CI. Its test now waits for the closed utility-panel checkpoint before reload and asserts the restored collapsed state before opening annotations; annotation count, note edit/delete and highlight persistence assertions remain intact. Renamed recents target their current verified name after automatic reconnection. No timeout or assertion tolerance is increased.

Combined keyboard/focus, sidebar/contents/overflow, light/dark and reduced-motion review and the final supported-browser/staging publication/live identity/receipt remain required. Screenshots are evidence; visual comparison and baseline adoption remain manual under #230. Do not close #17/#224 or claim the Wiki handoff is published until those requirements are met. Production activation and broad memory/performance budgets remain separate.
