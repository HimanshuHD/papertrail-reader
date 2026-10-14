# Startup loading measurement and closure

Feature acceptance: #171. Broader diagnostics/budgets: #167/#16. The protocol below is reusable; measured v2.0.0/v2.1.0 results are recorded at the end.

## Already recorded

- Owner accepted the loading preview, stable staging and the release-preview comparison.
- Native cold-start, retry/failure and reduced-motion scenarios passed through accepted staging and production-candidate Browser E2E.
- Optimized book sprite: 87,398 bytes; brand image: 1,380 bytes; total startup art: 88,778 bytes.
- Staging/production introduce no deliberate minimum startup hold. Numbered previews deliberately hold for seven seconds and are unsuitable for a normal startup-time comparison.

## Browser timing comparison

Compare v2.0.0 and the v2.1.0 production candidate in the same browser/device and local environment. Serve separately built immutable revisions; use production-channel builds with no preview hold. Use an empty library and the same route (`/#/app`), then repeat with the same saved-metadata fixture if required. Keep document permission renewal and document reopening separate from workspace readiness.

For each revision, collect at least five cold-cache reload recordings with browser extensions disabled and consistent CPU/network settings. Record navigation start, first painted app/loading UI, workspace-ready time, transferred startup bytes and main-thread work/long tasks until readiness. In v2.1.0 readiness means `#app.inert` becomes false and the startup overlay is dismissed, rather than every document finishing its asynchronous opening. Apply the equivalent usable-workspace boundary to v2.0.0.

Use browser DevTools Performance and Network recording, or an instrumented Playwright measurement fixture that records those boundaries before navigation. Report individual runs, median/range and revision/build/channel/browser identity; preserve the trace/HAR evidence. Include fast and throttled conditions, distinguishing transfer cost from initialization work. Do not report the total duration of a functional E2E test as a startup timing.

## Evidence template

| Setting                        | v2.0.0  | v2.1.0  | Difference |
| ------------------------------ | ------- | ------- | ---------- |
| Exact revision/build identity  | pending | pending | —          |
| Browser/device/CPU/network     | pending | same    | —          |
| Cold-cache repetitions         | pending | pending | —          |
| First UI paint, median/range   | pending | pending | pending    |
| Usable workspace, median/range | pending | pending | pending    |
| Main-thread work/long tasks    | pending | pending | pending    |
| Transferred startup bytes      | pending | pending | pending    |

Attach results to #171 before checking initialization impact. If the owner explicitly defers measurement to #16/#167, retain the exact requirement there and record that decision in #171; an absent measurement is not a passing result.


## Recorded release comparison — 14 October 2026

Read-only Startup measurement run [38521501369](https://github.com/HimanshuHD/papertrail-reader/actions/runs/38521501369) succeeded; artifact startup-measurement-38521501369 (11873294234) contains raw samples/resource data and 20 traces. Chromium 153.0.8010.12 on Linux; five cold contexts per revision/condition, density/default viewport 1440×900, reduced motion, production builds, no preview hold. Exact baseline d995c806d93725f990636ce0899388c613cb2bbb / v2.0.0; exact release db6029d70de1166d3535a7a53d24711ddb49c9b0 / v2.1.0. Frontend CI 38521501381 passed after YAML formatting correction; earlier CI formatting failure 38521293800 remains historical.

Fast condition: median DOM readiness 96.9 ms (87.0–123.0) for v2.0.0 versus 157.9 ms (151.2–164.5) for v2.1.0, an increase of 61.0 ms. Throttled condition: 3542.8 ms (3520.4–3545.7) versus 4582.6 ms (4562.7–4631.0), an increase of 1039.8 ms, about 29.4%. Throttling is 100 ms latency, 200,000 B/s download, 100,000 B/s upload and 4× CPU slowdown.

Median startup transfer: 613,239 versus 715,084 bytes, a difference of 101,845 bytes (about 16.6%) using the uncompressed local static server. Startup art independently totals 88,778 bytes. Median long tasks starting before readiness: 0 versus 52 ms under fast conditions, 219 versus 206 ms under throttling. Resource/navigation records also contain first-contentful-paint data.

The boundary is a renderable empty-library Add local documents control with no inert ancestor. This measures DOM/control readiness, not the exact presented frame. The comparison covers the entire released increment, not an isolated attribution of every millisecond to the animation. It excludes restored populated libraries/document reopening, visitor devices, CDN compression/cache and sustained memory. It establishes measured impact, not compliance with an invented performance budget. The extra transfer/startup latency informs broader optimization/budgets in #16/#167.

Independent earlier run 38521293907 also succeeded: fast median 63.3 versus 111.6 ms; throttled 3453.0 versus 4463.8 ms; same transfer counts. Runner variation reinforces using the pinned-condition median/range rather than a universal latency claim.
