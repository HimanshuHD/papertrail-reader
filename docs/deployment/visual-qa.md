# Design QA and visual regression

PaperTrail owns this workflow; the Product Design `design-qa` instruction document is a reference for manual review, not executable CI. Browser assertions and screenshot regression do not replace the first comparison with the owner's design.

## Test before main activation

The standalone manual workflow is not yet registered on main. During the temporary #177 bootstrap, the already registered **Frontend CI** workflow provides the entry point. This bridge targets **PR #176** explicitly and only handles manual dispatches on **staging**; PR validation and full Browser E2E triggers remain unchanged.

1. Owner reviews and merges the smoke-entry tooling PR into staging.
2. Update #176's branch from the resulting current staging, keep it ready, and wait for fresh successful Candidate validation. Do not merge #176 yet.
3. In GitHub Actions, open **Frontend CI** (not Visual QA) → **Run workflow** → select **staging** → **Run workflow**. No new form inputs, CLI, local installation or main promotion are needed. Selecting staging manually is the explicit request to run this temporary smoke mode.
4. Inspect the **Visual QA smoke (PR #176) / capture** job. It calls the same `visual-qa.yml` workflow through `workflow_call` at the dispatched staging SHA; there is no duplicate capture implementation.
5. Download `visual-qa-pr-176-RUN-ATTEMPT`, open `visual-evidence/comparison.html` with the image folders beside it, and inspect assertions, traces and separate statuses. Record the real run/source and findings in #177/#176. Browser assertions may pass while owner design review remains pending and regression stays not-run.

This staging dispatch intentionally skips **Validate and build website**, **Candidate validation**, and full **Browser E2E**. It consumes #176's previously accepted candidate instead of building a different revision. It produces no candidate-build or promotion artifact and does not request deployment. The delivery selector recognizes a successful QA-only run from its latest job/artifact inventory and skips promotion. Existing main manual recovery and normal PR acceptance remain unchanged.

**Temporary operational change:** manual Frontend CI on staging is QA smoke for #176 while this bridge is installed, not the usual staging rebuild/recovery operation. Do not use it expecting publication. If #176 is draft/closed/stale or lacks a current accepted artifact, the QA job blocks with the provenance reason.

After successful rendered verification and any corrections, remove the fixed #176 smoke caller and restore the original manual-staging conditions for frontend/gate in a reviewed staging PR before promoting the final tooling to main. Keep the reusable capture entry and the no-publication guard. Then activate standalone Visual QA through the reviewed tooling promotion and smoke-test its dispatch once. Do not promote the unverified capture workflow simply to register it.

## Run Visual QA

1. Update the feature branch from current staging. Open a ready same-repository PR targeting staging and wait for successful current **Candidate validation** with a retained `candidate-build` artifact. Draft, fork, closed, stale-base and failed candidates are rejected.
2. In Actions → **Visual QA** → Run workflow, select **staging**, enter the PR number, and select `startup` (or `shell` for tooling smoke on a candidate without startup). The workflow must already be merged into staging. GitHub exposes newly added manual workflows in Actions only after they exist on the default branch; main activation remains part of #130/#175. Before activation, the owner can dispatch the workflow on staging through the GitHub API/CLI if GitHub recognizes the workflow; a missing workflow/404 is an activation blocker, not permission to use a different build.
3. Example once dispatch is available: `gh workflow run visual-qa.yml --ref staging -f pr_number=176 -f profile=startup`. Never dispatch it from an unreviewed feature ref. Main is also supported after activation; its tooling must include this workflow.
4. Download the unique `visual-qa-pr-N-RUN-ATTEMPT` artifact. Open `visual-evidence/comparison.html` with all relative images beside it. Inspect `design-qa.md`, `status.json`, `candidate.json`, per-state JSON, `visual-report/assertions/index.html`, console attachments and failure traces.

This workflow does not deploy, merge, rebuild or modify PR #176. It downloads the accepted preview-channel bytes, verifies every static file and serves them locally. Repository-owned tooling comes from the dispatched main/staging SHA; no PR Node/build scripts execute. Checkout credentials are disabled. Only read permissions are granted; browser traffic is restricted to the local artifact server. Same-repository PR code still executes in a disposable browser, not in a privileged publishing job. Never add secrets, environment credentials or a `pull_request_target` browser runner.

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

A browser installation/capture or provenance failure blocks evidence. It does not establish that the design is wrong. Assertion or pixel-diff failures fail their respective automated check. A pending owner judgment is not a permanently required CI check. With no approved baselines, existing Browser E2E proceeds and reports visual comparison **not-run**, evidence **blocked**, initial review **pending**. Manual Visual QA still captures initial evidence when baselines are disabled.

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

The existing Browser E2E reusable workflow compares enabled approved baselines once (shard 1) against its already verified destination artifact. Staging integration and ready release/hotfix production acceptance keep their existing triggers and publication dependencies. Regression failures fail browser acceptance; there is no extra deployment path. Main promotion still reuses its accepted candidate. Before enabling baselines, validate preview-versus-staging/production stability; channel-dependent footer metadata is excluded intentionally. If no baselines exist, initial manual review remains a feature-owner acceptance item, not a fabricated regression pass.

Main/default-branch activation, branch protections and broader release/recovery checks stay in #130/#175/#44/#32. This tooling is tracked in #177 under milestone 10 and the Roadmap 3 Wiki. Owner merges all PRs and changes administrative controls.

[Deployment guide](deployment-guide.md) · [Publishing](publishing.md) · [Deployment architecture](../architecture/deployment.md)
