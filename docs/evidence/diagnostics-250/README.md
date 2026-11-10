# Independent operation profiles — #250 / PR #259

Clean measured source `f3fdb38da2460353ec4ee83715858d44dc75ca2c`, tree
`a6d5219ce4557d8d0cb698320e3d564419dc7584`. Subsequent evidence/documentation
changes do not alter measured application, harness or workflow bytes.

The full manual runner passed official Chrome for Testing headless shell
153.0.8010.12 on Linux: **10 browser cases passed, zero failures/flakes, one expected
duplicate production-only skip; 12/12 workload trials completed**. The four modes
are production-excluded, diagnostic closed, minimized sampling and paused, with
three rotating real-clock trials per mode. Each production workload checks
query/keyboard exclusion. [Reviewed summary/manifests](summary.json) retain
source/environment, every artifact size/SHA256, trial stages, aggregates and
case coverage. This is a synthetic checkpoint, not accepted workload budgets.

The real profile case configured warm-duration and cold-pending targets
independently, switched profile/rule selections and verified saved/blank inputs,
opened PDF/EPUB, performed three warm activation cycles, read the lifecycle table
and exported version2 configuration, profile definitions and informational
ownership notes. [Derived audit](profile-audit.json) retains only safe source,
configuration, fixed numeric lifecycle timings/observations and suite stats.
Warm dispatch is not browser paint or first-readable latency. The existing
functional accelerated-expiry and repeated cleanup cases passed; they are not
part of the real-clock overhead measurement.

Local `npm run check` passed lint/format/types,105 pipeline and472 unit/component
tests on the identical implementation tree. Tests distinguish cold/restored/
expired/warm profiles, matching pending work, completed-only statistics and
per-profile20-sample p95; exclude cancelled/failed/old/background-boundary work;
verify selected-rule editing and informational notes never affect severity.
Foreground return explicitly starts a fresh epoch, including when operations
began after the last hidden refresh. No arbitrary memory threshold is added.

Full Chrome could not create its singleton socket in this local environment;
those launch failures occurred before application execution and are not an app
regression claim. The official headless-shell smoke and full runner executed
successfully. An earlier profile test also exposed selector label text including
option contents; explicit accessible names fix it, with the normal final case
passing. No blind waits, retries, forced clicks or timeouts were added. Raw
Playwright paths/attachments are not published. The case runs on default panel
and320px dark layouts through the retained suite; native/installed browser,
Firefox/WebKit and device permutations remain #253 acceptance.

Targets remain local/provisional and unconfigured by default. No accepted #16
budget, causal speedup, leak verdict, process/GPU memory or CPU score is claimed.
Resource/heap observations are informative only. #253 retains larger/native and
total diagnostic/UI/optional-sensor overhead evidence. Owner preview/merge and
subsequent staging browser/publication/live-receipt acceptance remain separate.
