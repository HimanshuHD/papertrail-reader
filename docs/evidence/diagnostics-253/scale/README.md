# Generated scale acceptance checkpoint — #253 / PR #260

Clean measured source `b68909b021c0f1280bb489dcdba52141ea1e6bac`, tree `b0e442d4b3f17311c966fe709cba534488b20c7a`.

Official Chrome for Testing headless shell153.0.8010.12 on Linux: **14 passed, zero failed/flaky, one expected duplicate production-only skip**. All12 repeated small-fixture workload trials and all4 separate generated-scale functional cases completed. Production exclusion is asserted inside every production workload trial. Local lint/format/types,106 pipeline and472 unit/component tests passed. Raw reports/paths/attachments are omitted; the reviewed numeric/fixed-vocabulary summary is retained here.

| Functional scenario              | Checked behavior                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------- |
| 100 /1000 file-input libraries   | Exact count, last-entry search and readable open/close.                           |
| 1001-page text PDF               | First/last readiness, maximum page count, zoom and return.                        |
| 1000-paragraph styled/image EPUB | Embedded styling/image, last paragraph, typography reflow, next/previous chapter. |

Every scenario validates current-source private export. The report requires four unique fixed scenarios per requested engine and rejects missing/duplicate/foreign/invalid evidence. Unknown attachment fields are not retained. A development harness error used the utility-panel close label for the typography popover; corrected to the existing Close typography control before this clean published-source run. No app rendering change was needed. That earlier failed run correctly retained12 completed benchmark trials and3 functional cases with incomplete representative coverage and a failed overall status; it is not this checkpoint.

These are one-pass functional cases. Their elapsed values include assertions/export/automation and are not benchmark distributions or total-overhead estimates. The repeated four-mode benchmark retains its separate12-page PDF/small styled EPUB workload, rotating fresh contexts, real clocks and sparse p95 withholding. No accepted budget or speedup claim follows from these numbers.

Generated input libraries do not measure native-folder discovery. The PDF is text-only and the EPUB has one local vector illustration. Image-heavy and arbitrary publisher content, real/native folder and device acceptance, expanded-panel/optional-sensor overhead and external CPU/GPU/process-memory profiling remain open in #253/#16. Firefox/WebKit were not rerun for this increment. The later archive changes documentation only; measured application/harness/workflow bytes remain unchanged. No automatic Visual QA or workflow was added.
