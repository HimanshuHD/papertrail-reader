# Repeatable diagnostics acceptance — #253

Run `npm run test:diagnostics:acceptance` manually after installing the desired Playwright browsers (`npx playwright install chromium firefox webkit`, plus platform dependencies where required). It does not run from deployment, preview or Visual QA workflows. Standard CI runs only the report helper's unit checks; this workload command is deliberately separate.

The command builds two temporary artifacts from the current checkout: default production and the same production channel with diagnostics explicitly enabled. It checks diagnostic marker exclusion/inclusion across split bundles and records every output file's byte count and SHA-256. Temporary build directories are removed afterward. Reports stay under `browser-evidence/diagnostics-acceptance/run-*/`; nothing is uploaded.

Preview servers receive the temporary build root through an environment variable and pass it directly to Vite’s JavaScript API. Filesystem paths are never shell-quoted, so Windows drive paths and paths containing spaces/apostrophes remain literal. No custom temporary-folder location is required.

## Workload and modes

For each requested engine, three fresh-context trials per mode run sequentially, with mode order rotated between trials:

| Mode       | Build                          | State during timed reader work                                      |
| ---------- | ------------------------------ | ------------------------------------------------------------------- |
| production | Default production             | No diagnostic entry point, including after query/keyboard attempts  |
| closed     | Explicit diagnostic production | Panel never opened; base recording remains inactive                 |
| sampling   | Explicit diagnostic production | Base diagnostics recording, panel minimized, additional sensors off |
| paused     | Explicit diagnostic production | Opened, paused, then minimized                                      |

Each trial injects the same generated 12-page text PDF and CSS/image EPUB, waits for the library listing, opens PDF, navigates to its last page, opens readable EPUB content, switches the retained readers three times and closes both. Per-stage and whole-workload elapsed times include automation and browser rendering. File injection is not a native-folder scan benchmark. Library selection and the selected document tab must commit before the test hides the library. PDF readiness and retained reader content are asserted; elapsed timing stops before exporting evidence or closing the browser context. Sampling/paused exports verify recording state and the compiled source SHA outside the timed interval, and audit fixture names/content exclusions.

The dedicated browser suite also runs existing mixed-reader export/lifecycle checks, mobile dark keyboard/focus checks, real supported sensor observations and a controlled missing-PerformanceObserver fallback. Unsupported sensor inputs/long frames must remain empty with an explicit unavailable reason, rather than a fabricated zero measurement. This fallback fixture is simulated capability loss, not evidence of a native browser's support matrix.

## Configuration

- `DIAGNOSTIC_ENGINES`: comma-separated `chromium,firefox,webkit`; default `chromium`. Unknown/duplicate engines fail. Requested engines must be installed; unavailable engines do not silently skip acceptance.
- `DIAGNOSTIC_TRIALS`: integer 3–20; default 3. The report shows median and worst per engine/mode; p95 is withheld below 20 trials.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`: optional isolated Chromium binary. Other engines use their normal Playwright installations.

For example, on a POSIX shell: `DIAGNOSTIC_ENGINES=chromium,firefox,webkit DIAGNOSTIC_TRIALS=5 npm run test:diagnostics:acceptance`. On PowerShell, set `$env:DIAGNOSTIC_ENGINES='chromium,firefox,webkit'` and `$env:DIAGNOSTIC_TRIALS='5'` before running the npm command.

## Reading and preserving evidence

`summary.json` records source commit/tree, dirty-checkout status, exposed host metadata, exact build file hashes/bytes, all workload trials, per-mode summary and limitations. Build byte differences are uncompressed complete-artifact differences, not startup transfer or resident RAM. A dirty checkout is explicitly labelled; repeat on the clean candidate before claiming immutable-source evidence. `playwright.json` preserves functional outcomes and attachments. A failure yields a failed summary and nonzero exit while retaining completed workload trials and their per-mode summaries. `coverage` distinguishes expected versus completed trials; `caseOutcomes` retains browser-case statuses, and `workloadFailures` records browser/mode/trial/stage, completed-stage durations, bounded error-name categories and a numeric/fixed-vocabulary UI snapshot. Uncapturable UI is null. Failed-stage durations are separate from completed trials and are never included in their median/p95. Partial coverage or any failed/flaky case cannot pass overall acceptance. Raw error messages, filenames and URLs are not copied into this failure snapshot; detailed Playwright artifacts remain local.

Elapsed times include instrumentation, browser behavior and automation within these particular paths. Sampler callback subset values from diagnostic exports remain separately labelled; they are not total overhead. Additional sensors and expanded-panel rendering are not calibrated by the minimized workload. Contexts are fresh, but OS/browser-process caches, thermal effects and host scheduling are uncontrolled. No CPU/GPU/process-memory profiler, forced GC or artificial elapsed clock is used. This is not a performance budget, causal attribution or proof of a speedup.

Before publishing evidence, retain only reviewed fixture-only aggregates and build identities. Browser reports/traces from other scenarios may contain private information. The command itself uses generated fixtures, does not accept personal documents, and performs no telemetry/publication or screenshot-baseline comparison.

## Remaining acceptance

#253 stays open for representative 100/1000 native-folder scans; image-heavy and 1001-page PDF; long-chapter EPUB; restore/cancellation/real five-minute expiry and repeated teardown; broader sampling/optional-sensor/panel-render comparisons; native Firefox/WebKit and installed device/browser evidence; and exact merged-source staging acceptance/publication. Existing focused tests are not substituted for these measurements. #252 deeper ownership/attribution and #250 workload profiles remain open. Accepted budgets and external CPU/GPU/process-memory profiling belong to #16.

The Windows owner run on source `dc152e8` passed Chromium and Firefox checkpoints but failed one WebKit formatted-EPUB workload before an EPUB tab appeared. The revised selection barrier and failure/partial-reporting checks address the harness gaps; a successful fresh Windows WebKit rerun is still required before accepting that engine. No EPUB rendering fix or browser acceptance is inferred from a readiness assertion alone.
