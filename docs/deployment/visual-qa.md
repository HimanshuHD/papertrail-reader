# Design QA and visual regression

PaperTrail owns this workflow; the Product Design `design-qa` instruction document is a reference for manual review, not executable CI. Browser assertions and screenshot regression do not replace the first comparison with the owner's design.

## Run Visual QA manually

Visual QA runs only through **Actions → Visual QA → Run workflow**. It is independent of Frontend CI, Candidate validation, Browser E2E, integration and publication. PR events, labels (including `qa:visual`), source/baseline changes, merges and schedules never request visual capture or comparison. A skipped, missing or failed visual run is not a delivery gate. Functional acceptance remains required by its existing workflows.

Select the reviewed tooling branch **staging** or **main**, enter an open ready same-repository PR number, and choose a profile and channel:

| Profile | Capture behavior                                                                        |
| ------- | --------------------------------------------------------------------------------------- |
| auto    | Detect startup in the verified artifact; otherwise capture the ready shell/interactions |
| startup | Capture startup/loading/error/retry/reduced-motion states                               |
| shell   | Capture the ready reader shell, library controls and theme interactions                 |

| Channel    | Available candidate                                                     |
| ---------- | ----------------------------------------------------------------------- |
| preview    | Any eligible staging or release/hotfix PR                               |
| staging    | Staging-target PR's separately compiled staging artifact                |
| production | Main-target release/hotfix PR's separately compiled production artifact |

Wait for completed frontend and **Candidate validation** jobs with a retained current `candidate-build`. A previous visual failure in the same historical CI run does not invalidate successful functional acceptance. Drafts, forks, closed/stale PRs, pending or failed required checks and expired/missing artifacts reject. Update the PR from its current base before capturing. This is artifact review, not a test of the currently deployed website; selecting a channel does not publish it. A production-path review requires a release/hotfix candidate; preview screenshots are never borrowed for another channel.

Set **repeat_stability** to true for two captures and repeat comparison using the existing full startup baseline matrix. Use profile startup (or auto when the artifact contains startup). Leave it false for a single capture/report. Repeat review consumes the same verified artifact, never rebuilds another source, and requires an existing approved channel matrix. The former automatic Approved baseline adoption review workflow is removed.

Example after activation: `gh workflow run visual-qa.yml --ref staging -f pr_number=227 -f profile=startup -f channel=preview -F repeat_stability=false`. The GitHub UI exposes the same inputs. Main registration/tooling changes require reviewed main promotion; after staging merge select staging to use the new implementation. Nothing in this command changes merge protection, baselines or deployment state.

Download `visual-qa-pr-N-CHANNEL-RUN-ATTEMPT` from **Summary → Artifacts**. Open `visual-evidence/comparison.html` with adjacent screenshot directories; inspect `status.json`, candidate identity, per-state JSON and `visual-report/regression/index.html` for actual/expected/diff. Reports and artifacts are retained even on assertion or pixel failures. Repeat runs also retain `baseline-review-evidence/CHANNEL-{1,2}/`, `CHANNEL-summary.json` and repeat-stability reports. Visual failures remain visible in this manual run only.

## Isolation and source identity

The workflow has only `workflow_dispatch`; no workflow-call entry point, automatic caller or label-driven build request remains. Removing visual steps does not remove functional Browser E2E, native-focus checks, ordinary test-failure screenshots or traces. No other workflow invokes the visual capture/comparison/report scripts. If repository rules explicitly require a removed visual check, the owner must remove that obsolete requirement; do not replace it with a fabricated pass or change unrelated required checks.

Tooling is checked out from the selected reviewed staging/main dispatch SHA, never candidate PR code. PR/run/head/base/merge-tree/channel/base-path/checksum verification is mandatory before serving static bytes. Credentials are disabled, capture has read-only permissions and no secrets, and browser traffic is restricted to the local artifact server. Candidate code executes only in the disposable browser. Capture neither deploys, merges nor adopts baselines. A post-capture source change marks evidence stale.

## Captured states and identity

Chromium/Playwright 1.63.0 runs on Ubuntu 24.04, at density 1, locale en-US, UTC; viewports are 375×900, 1440×900 and source-sized 1586×992, in both light and dark appearance. Contexts start with empty library/storage and an explicit theme. These are viewport simulations, not certification of physical devices or all browsers. Installed browser version, viewport, theme, reduced motion, route, candidate hashes, source/tree/head/base, candidate run, tooling SHA and evidence run/attempt are recorded.

Startup capture holds the actual `assets/bootstrap-*.js` request. It requires genuine loading/inert app state and releases the request to assert readiness. A separate abort verifies real error feedback, keyboard focus and Enter retry. Animation advances before capture; reduced motion disables it. Screenshot-only CSS freezes sprite frame zero and the progress indicator. The browser clock pauses before navigation, keeping loading/error screenshots at actual 0% without replacing app progress values. After capture, QA drives the real timers: preview reaches 50% at 3.5 seconds and dismisses only at seven seconds after genuine initialization; staging/production remain at 0% while bootstrap is held and dismiss on actual readiness. A slow-bootstrap check verifies the 99% preview cap and no second seven-second hold; failure checks verify the ticker stops and retry resets the timeline. No product startup delay or test-only app mode is introduced.

Ready-state interactions hide/show the library and switch theme. Unexpected console/page errors fail assertions; the deliberately injected failed resource request is recorded and narrowly classified. Fonts and image decode complete before capture. Deployment footer metadata is omitted by capture-only CSS because channel/branch/SHA content changes every build; provenance remains checked separately. All other visible UI stays unmasked. Footer design is outside this baseline suite.

The source mock is `tests/visual/references/startup-owner.webp`, supplied by the owner in #171 (1586×992), losslessly encoded as WebP with original/source checksums and pixel dimensions in the reference JSON. Full-view comparison and four source/implementation region pairs cover branding, book, typography/copy and progress/stages. Source crops retain original scale and are labeled; different element sizes are visible, not stretched to match. The reference's Reader stage and illustrative 62% differ from bootstrap-held Library/0% progress. Record that intentional behavior distinction before judging fidelity. No supplied mobile/light/error mock exists; review those states for responsive quality without claiming an exact source match. Source density 1 is an explicit assumption to confirm with the owner.

## Separate statuses

| Status                                                    | Meaning                                                                                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automated browser/assertion checks: pass/fail/not-run     | Executed assertions, setup or execution failure; not a design verdict                                                                              |
| Evidence availability: captured/blocked                   | Every expected full/focused screenshot and capture identity exists; stale source blocks current acceptance                                         |
| Initial design review: pending/approved/changes requested | Owner decision in the feature PR/design record; capture alone leaves pending. Automation reports approved only from the reviewed baseline manifest |
| Visual regression: pass/fail/not-run                      | Comparison with approved browser snapshots; disabled until explicit approval                                                                       |

A browser installation/capture or provenance failure blocks evidence. It does not establish that the design is wrong. Assertion or pixel-diff failures fail their respective automated check. A pending owner judgment is not a permanently required CI check. With no approved channel baselines, manual Visual QA still captures initial evidence and reports visual comparison **not-run** and owner review **pending**. Browser E2E does not run visual comparisons.

## Initial design acceptance

Open both source and implementation in the combined comparison. Match route, content, viewport, appearance, interaction/loading state and density; explicitly classify unmatched source states. Check overall composition and focused details, with specific judgments for fonts/typography, spacing/layout rhythm, colors/tokens, image fidelity and copy.

Record findings in the feature PR and a reviewed design record:

| Severity    | Location           | Source and implementation evidence | Difference and impact | Fix               | Recapture and disposition    |
| ----------- | ------------------ | ---------------------------------- | --------------------- | ----------------- | ---------------------------- |
| P0/P1/P2/P3 | Component/selector | Run/artifact and region paths      | Concrete mismatch     | Actionable change | Same-state post-fix evidence |

P0 blocks core use; P1 is major mismatch/usability regression; P2 is moderate drift/responsive/polish issue; P3 is optional refinement. Fix P0/P1/P2 in the feature branch, rerun current candidate CI, recapture and compare again before approval. Do not alter the startup feature in the tooling branch. Preserve earlier run links, findings, fixes and post-fix captures. Actions artifacts expire after 30 days: retain accepted comparison reports/source/captures and review history in the reviewed design/baseline PR before expiry. Missing rendered source or implementation evidence remains blocked. The owner must explicitly approve the design and the exact browser captures proposed as baselines.

## Prepare or update approved baselines

No screenshots are initially approved. `tests/visual/baselines/approval.json` is disabled and records that fact. A generated mock is never a strict pixel baseline.

After owner approval, download complete current evidence and create a local review JSON using the actual review URL and identities (values below are placeholders):

```json
{
  "owner": "HimanshuHD",
  "reviewUrl": "https://github.com/HimanshuHD/papertrail-reader/pull/176#issuecomment-ACTUAL_ID",
  "sourceSha": "ACTUAL_40_CHARACTER_PR_HEAD_SHA",
  "candidateRun": "ACTUAL_CANDIDATE_RUN",
  "evidenceRun": "ACTUAL_VISUAL_QA_RUN",
  "reviewedAt": "ACTUAL_APPROVAL_DATE"
}
```

Run locally: `node scripts/prepare-visual-baselines.mjs path/to/visual-evidence path/to/owner-review.json`. It rejects CI execution, incomplete/failed/stale evidence, mismatched source/run/density or mixed browser versions. It prepares the 36 full-state browser PNGs and a checksum manifest as a concrete Git diff. Preserve the source comparison and findings/history alongside this change. Open an explicit baseline-update PR from current staging; owner reviews the captures, approval reference and manifest before merge. This script prepares a proposed update; it cannot grant owner approval. The manifest validates approval fields but does not authenticate a comment's meaning—owner review of the baseline PR is the authorization mechanism.

Never use `--update-snapshots` or automatically copy new images during normal CI. Missing approved files, incomplete matrices, altered bytes or changed browser environment fail rather than silently create baselines. Future design changes require the same reviewed baseline-update process. Baseline updates are implementation data, not an archived roadmap/progress tracker.

Tolerance is deliberately tight: per-pixel color threshold 0.15 and at most 20 differing pixels per full screenshot, density 1, disabled screenshot animations and hidden caret. No percentage-wide allowance is used. Confirm stability in the pinned Linux/browser/font environment before activating; justify tolerance changes in the baseline PR. Bundled/current system fonts must remain consistent; fonts/browser/Playwright changes require a reviewed recapture, not a silently enlarged tolerance.

## Staging and release acceptance

Browser E2E performs functional acceptance only. Visual comparisons and repeat stability run only when the user dispatches Visual QA, and their outcomes are not inputs to staging integration, release acceptance or publication. Functional frontend/browser checks, exact artifact promotion, freshness and live receipt checks remain unchanged. Main promotion still reuses its functionally accepted candidate. Owner review and explicit baseline adoption remain separate from automated delivery eligibility.

Main/default-branch activation is delivered through the reviewed tooling promotion; its live acceptance, branch protections and broader release/recovery checks stay in #130/#175/#44/#32. This tooling is tracked in #177 under milestone 10 and the Roadmap 3 Wiki. Owner merges all PRs and changes administrative controls.

[Deployment guide](deployment-guide.md) · [Publishing](publishing.md) · [Deployment architecture](../architecture/deployment.md)

## Reading the comparison report

Open `visual-evidence/comparison.html` with its screenshot folders intact. Every JSON section has **JSON** and **Details** choices; **Details** opens by default. Controls work offline without JavaScript and support keyboard navigation. JSON retains the full recorded payload. Existing artifacts retain their original layout.

Overall evidence Details shows browser assertions, evidence availability, owner design review, visual regression, reason, stale evidence, missing captures and approval. Screenshot Details shows state/project, viewport/density, theme/route, reduced motion, sprite frame, progress/mode/clock, browser/OS/Playwright, run/attempt, tooling SHA, candidate PR/channel/run/head/base/source/tree/base path and screenshot checksum. Missing values say “Not recorded”; zero and false remain visible.

Browser assertion and regression test cases use their Playwright JSON reports. Each case shows title/location/project, actual outcome, expected status and each attempt's status/duration/retry/errors/attachment paths. Run summaries show passed/failed/flaky/skipped counts, timing and setup errors. Attachment paths identify original evidence and are not rewritten as local links. Unavailable reports explicitly say unavailable/not run, never passed. Owner design approval remains separate.

## Current-base blockers and verified capture

Visual QA compares the PR's recorded base with the current target branch, then verifies ancestry and merge parents. `PR base is stale` means capture was blocked before browser execution; it is not a loading-screen or visual-test failure. Update the feature branch from current staging and wait for its fresh candidate gate. Rerunning an old job does not refresh its event or artifact identity. Avoid advancing staging during capture; a post-capture identity change makes that evidence historical.

On 13 October 2026, #176's queued capture in [CI 38426759198](https://github.com/HimanshuHD/papertrail-reader/actions/runs/38426759198) and [manual QA 38429799379](https://github.com/HimanshuHD/papertrail-reader/actions/runs/38429799379) each passed all 24 browser cases. This establishes automated capture, not owner design approval or approved baselines. Earlier blocked and failing runs remain in comparison history. The Dark mode toggle has a stable accessible name; tests use aria-pressed and actual HTML theme to verify switching in both themes.
