# Repeatable diagnostics acceptance — #253

Run `npm run test:diagnostics:acceptance` manually after installing the desired Playwright browsers (`npx playwright install chromium firefox webkit`, plus platform dependencies where required). It does not run from deployment, preview or Visual QA workflows. Standard CI runs only the report helper's unit checks; this workload command is deliberately separate.

The command builds two temporary artifacts from the current checkout: default production and the same production channel with diagnostics explicitly enabled. It checks diagnostic marker exclusion/inclusion across split bundles and records every output file's byte count and SHA-256. Temporary build directories are removed afterward. Reports stay under `browser-evidence/diagnostics-acceptance/run-*/`; nothing is uploaded.

Preview servers receive the temporary build root through an environment variable and pass it directly to Vite’s JavaScript API. Filesystem paths are never shell-quoted, so Windows drive paths and paths containing spaces/apostrophes remain literal. No custom temporary-folder location is required.

## Workload and modes

For each requested engine, three fresh-context trials per mode run sequentially, with mode order rotated between trials:

| Mode             | Build                          | State during timed reader work                                                   |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| production       | Default production             | No diagnostic entry point, including after query/keyboard attempts               |
| closed           | Explicit diagnostic production | Panel never opened; base recording remains inactive                              |
| sampling         | Explicit diagnostic production | Base diagnostics recording, panel minimized, additional sensors off              |
| paused           | Explicit diagnostic production | Opened, paused, then minimized                                                   |
| expanded         | Explicit diagnostic production | Base recording; Overview visible throughout reader work                          |
| sampling-sensors | Explicit diagnostic production | Additional sensors enabled; panel minimized                                      |
| expanded-sensors | Explicit diagnostic production | Additional sensors enabled; Overview visible                                     |
| paused-sensors   | Explicit diagnostic production | Sensors enabled, then recording paused and panel minimized; collection must stop |

The schema-2 runner requires all eight modes (24 trials per engine at the default repeat count). Legacy four-mode report helpers remain readable, but cannot satisfy the new runner’s explicit eight-mode coverage.

Each trial injects the same generated 12-page text PDF and CSS/image EPUB, waits for the library listing, opens PDF, navigates to its last page, opens readable EPUB content, switches the retained readers three times and closes both. After closing both readers, every mode observes the foreground for a fixed 2,200ms real-clock interval, exercising periodic sampling and expanded-panel updates. This is a deliberate equal-duration measurement window, not a readiness sleep. `readerWorkMs` stops before this window; `elapsedMs` includes it. `readerWorkSummary`, whole-workload `summary` and `stageSummary` keep these distributions separate. Per-stage and whole-workload elapsed times include automation and browser rendering. File injection is not a native-folder scan benchmark. Library selection and the selected document tab must commit before the test hides the library. PDF readiness and retained reader content are asserted; elapsed timing stops before exporting evidence or closing the browser context. Recording/paused exports verify recording state, sensor collection state, bounded retention and nonempty base samples in running modes and the compiled source SHA outside the timed interval, and audit fixture names/content exclusions.

The dedicated browser suite also runs existing mixed-reader export/lifecycle checks, mobile dark keyboard/focus checks, real supported sensor observations and a controlled missing-PerformanceObserver fallback. Unsupported sensor inputs/long frames must remain empty with an explicit unavailable reason, rather than a fabricated zero measurement. This fallback fixture is simulated capability loss, not evidence of a native browser's support matrix.

## Generated scale and long-document cases

Five additional functional cases per requested engine run with sampling enabled and diagnostics minimized:

| Case                            | Assertions                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 100 / 1000 file-input libraries | Exact listed document count; search selects only the final entry; that PDF renders and closes.                                            |
| 12-page raster PDF              | Distinct painted images on first/last pages, zoom, return and private export; twelve independent 512×512 RGB rasters, over9MB compressed. |
| 1001-page text PDF              | First/last-page render readiness, maximum page count, zoom and return to page1.                                                           |
| 1000-paragraph EPUB             | Embedded CSS and image remain readable, final paragraph can be reached, typography reflow and next/previous chapter work.                 |

Every case audits a current-source diagnostic export for fixture-name/content exclusions. Successful cases attach only fixed scenario/engine identifiers, numeric fixture sizes/counts and real elapsed time. `representative` retains a projected safe schema and `representativeCoverage` requires all five unique cases for every requested engine. Missing, duplicate or invalid evidence cannot pass the runner even if the small benchmark completed. Completed functional evidence survives a later case failure. These one-pass functional durations include assertions, export and automation; they have no median/p95 or overhead interpretation and stay outside the repeated eight-mode benchmark.

These are generated scale fixtures. File-input injection does not measure native-folder discovery; the text PDF is not image-heavy; the EPUB uses one local vector illustration and does not represent arbitrary publisher content. No additional automated workflow is added.

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

#253 stays open for native-folder discovery and real/image-heavy document acceptance beyond the generated scale cases; restore/cancellation/real five-minute expiry and repeated teardown; broader sampling/optional-sensor/panel-render comparisons; native Firefox/WebKit and installed device/browser evidence; and exact merged-source staging acceptance/publication. Existing focused tests are not substituted for these measurements. #252 ownership/attribution is complete after #258. Provisional #250 profiles were implemented in #259; accepted target calibration remains open. Accepted budgets and external CPU/GPU/process-memory profiling belong to #16.

The later reviewed owner Windows checkpoint on source `e33a265` passed Chromium/Firefox/WebKit (21 browser cases and36 workload trials). That historical checkpoint predates these generated scale cases and does not certify them. Fresh source-specific evidence must identify the candidate and engines actually executed.

## Manual native-folder validation

Generate disposable local fixture folders from the repository root (Node24, dependencies installed):

```sh
node scripts/create-diagnostics-library.mjs 100
node scripts/create-diagnostics-library.mjs 1000
```

Each command prints a fresh `documents` folder under ignored `browser-evidence/manual-libraries/library-*/`. It never overwrites an existing run, reads personal files, opens a browser or uploads data. A manifest sits beside the documents folder and records file/group counts and bytes. The library contains nested groups of50, mixed PDF/EPUB files, a12-page image PDF (`fixture-0000.pdf`), a1001-page text PDF (`fixture-0001.pdf`) and a1000-paragraph styled EPUB (`fixture-0002.epub`). Exactly100 or1000 supported files are inside the selected folder. Generation can take several seconds; it is not scan timing.

Use a fresh PR preview and record its source from Technical details. Repeat the following on installed browsers/OS you intend to support. Native handle support and the fallback vary by browser; record the actual path used.

1. Open diagnostics before selection, leave additional sensors off and minimize it. From Library → + → Choose folder, select the printed **documents** folder. Record browser/version,OS,count,native handle versus fallback and any observed issue. Do not use Choose files for native-folder acceptance.
2. Confirm the library shows exactly100/1000 local documents and2/20 nested groups. Expand a group; search `fixture-0999` for the1000-file case (or0099 for100). Only the final document should match and open successfully. Clear search; groups/list remain usable.
3. Open fixture0000 and navigate to its last page; actual colored raster content should render through zoom and return. Open0001 and navigate to1001. Open0002, scroll to the end of its long chapter, change typography and navigate chapters. Switch retained tabs and confirm state remains.
4. Close all tabs, allow disposal to settle and inspect Resources cleanup against a pre-open baseline. Tracked ownership should settle; a high JS heap alone is not a leak verdict. Repeat open/close three times if investigating retention.
5. For a true native handle, refresh/reconnect and verify its permission/restore path. For fallback selection, record that reconnect/reselection is required rather than treating fallback as persisted permission. Exercise picker cancellation: the existing library remains usable. Native permission denial/revocation requires a manual OS/browser check; no automation here claims it.
6. Pause/export if needed. Review local exports before sharing; do not publish personal document names,paths,contents or raw browser artifacts. Report the fixture count/source/platform/path and pass/fail of each step. Generated functional timings do not certify a workload budget.

These manual steps remain unaccepted until an actual user/native-browser run is supplied. The headless raster case exercises decoding and painted output; it does not prove native picker/permission behavior or arbitrary scanned-book performance. External CPU/GPU/process-memory and accepted budgets remain #16.

## Interpretation of overhead comparisons

Compare the same engine, fixture, viewport and per-stage/reader-work distribution across modes. Expanded mode keeps Overview visible; its panel overlays part of the reader without changing the viewport. It exercises live dashboard updates, not every Resources/Sensors/Timeline subview. Sensor-enabled modes collect optional observations while Overview is selected; unsupported APIs retain their explicit reasons and are not treated as observed zeros. The sampler and sensor callback fields are subsets only: they exclude some observer/frame work, Vue rendering, layout and paint. Do not sum them into total overhead.

Wall-time differences can include OS caching, scheduling, browser processes, warm-up and automation noise. The equal observation interval dominates short total times, so inspect reader-work and stage summaries separately. No automatic pass/fail performance budget, causal CPU/GPU attribution or speedup claim is produced. Default three-trial groups withhold p95; use 20 trials per mode to populate it. Repeat and inspect traces separately under #16 before accepting versioned #250 targets.

## Controlled library-access recovery checkpoint

The manual runner also requires three `libraryAccess` cases per requested engine (3 Chromium-only,9 across all three). `libraryAccessCoverage.required` and `.complete` must be true. These cases are separate from the72 repeated eight-mode workload trials and15 representative cases in a default three-engine run. The full suite now expects54 passed cases and3 intentional production-only skips across three engines (18 passed/one skip for Chromium).

The cases deliberately replace `showDirectoryPicker` with fixed `AbortError`, `NotAllowedError` and `SecurityError` rejections. With a PDF already open on page3 they verify the existing library entry, selected tab, page and actual reader DOM instance remain, tracked viewer/task-owner/Blob counts do not grow, and page4 remains readable. For unavailable native access, a real directory-input change populated with a disposable generated folder must recover and render its new PDF. No force clicks or synthetic permission-grant claims are used. Diagnostic exports must match the current source and exclude fixture names.

Attachments retain only engine, fixed scenario/mechanism/recovery names, a preservation flag and three numeric zero ownership deltas. The report rejects missing/duplicate/foreign/invalid cases even if all repeated workloads pass, and does not retain arbitrary attachment fields.

This proves application handling of controlled capability failures, not an actual OS picker dismissal, permission denial/revocation or remembered-handle reconnect. Those native checks still require the manual native-folder procedure above on the actual installed browser. Record separately: initial grant; cancellation with an existing library; reload without an unsolicited prompt; explicit reconnect after a denied/revoked grant; recovery after reselection; and unsupported-browser fallback. Use generated fixtures, and keep any raw profiles/reports private until reviewed. #253 remains open until that evidence and its other remaining acceptance are supplied.
