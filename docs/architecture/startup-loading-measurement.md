# Startup loading measurement and closure

Feature acceptance: #171. Broader diagnostics/budgets: #167/#16. These instructions describe the remaining measurement; they are not measured results.

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
