# Design QA and visual regression

PaperTrail owns this workflow; the Product Design `design-qa` instruction document is a reference for manual review, not executable CI. Browser assertions and screenshot regression do not replace the first comparison with the owner's design.

## Run Visual QA manually

Once the reviewed activation PR is merged to **main**, GitHub lists **Visual QA** in Actions with **Run workflow**. Select **main** for the activated tooling, enter an open ready same-repository PR number, and choose a profile:

| Profile | Capture behavior                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------- |
| auto    | Detects the actual startup surface in the verified artifact; otherwise captures ready shell/interactions |
| startup | Explicit startup/loading/error/retry/reduced-motion review; missing startup surface blocks evidence      |
| shell   | Ready reader shell, library controls and theme interaction review                                        |

Staging PRs and release/hotfix PRs targeting main are eligible. Update the PR from its current base and wait for successful complete **Frontend CI / Candidate validation** with a retained current `candidate-build`. Drafts, forks, closed/stale PRs, failed runs and expired/missing artifacts reject. Manual runs select only completed successful candidate runs; they do not bypass Candidate validation.

Example after activation: `gh workflow run visual-qa.yml --ref main -f pr_number=176 -f profile=startup`. The GitHub UI provides the same inputs without local setup. Selecting staging also works when that approved branch contains the workflow. Main registration alone is not evidence that browser capture or design acceptance passed.

Download the unique `visual-qa-pr-N-RUN-ATTEMPT` artifact from the run's **Summary → Artifacts** after capture/report/upload steps execute. Open `visual-evidence/comparison.html` with all image directories beside it; inspect `design-qa.md`, `status.json`, `candidate.json`, per-state JSON, `visual-report/assertions/index.html`, console attachments and traces. A skipped job produces no successful capture.

## Automatic QA after Candidate validation

Add **qa:visual** to any eligible ready same-repository PR. Frontend CI orders jobs as follows:

1. Frontend validation and channel candidate build.
2. Required production Browser E2E for release/hotfix PRs, according to the existing trigger policy.
3. **Candidate validation**.
4. Optional **Visual QA** when the PR carries qa:visual, using profile auto and the gate's exact candidate run ID.

The QA job depends on the successful gate; failed/skipped/pending Candidate validation cannot start it. It is no longer limited to #176 or to the labeled event. Keeping qa:visual on the PR runs QA after validation on subsequent commits/eligible CI events. Adding the label requests a fresh current validation followed by QA; unrelated label edits do not build or capture and cannot cancel candidate CI. Remove the label to opt out of future runs. No temporary smoke job or Frontend CI manual-QA route remains. The pre-existing manual Frontend CI build/recovery trigger keeps its delivery purpose; manual visual review uses Visual QA itself.

For the same-run queue, the enclosing Frontend CI cannot finish until QA finishes. Therefore QA accepts an explicitly supplied **in-progress** run only after verifying that its current **Candidate validation** and frontend build jobs succeeded and that the candidate artifact exists. It never searches for or rebuilds another revision. Evidence records `candidate-gate-passed`; this is not a completed-workflow or deployment acceptance claim. Manual dispatch still requires a completed successful workflow. A metadata-only CI edit reuses the exact earlier accepted artifact run output by the gate.

All PR captures check out tooling from the approved current PR base SHA (staging or main), not the PR head/merge. PR/run/head/base/merge-tree/source/channel/base-path/checksum checks stay mandatory before serving static bytes. Checkout credentials are disabled, browser jobs have only read permissions and no secrets, and browser traffic is restricted to the local artifact server. Candidate PR code executes in the disposable browser, never as privileged Node/build scripts. There is no deployment, automatic merge or baseline adoption in Visual QA.

**Activation order:** owner merges the general-queue cleanup into staging, then reviews/merges the hotfix tooling promotion to main. Main activation carries the already reviewed staging delivery contract needed for schema-2 candidates, not the unmerged #176 startup feature or a new app release/version. Synchronize main back into staging through the normal delivery process after activation. Existing default-branch delivery/recovery handlers activate as part of that promotion and still require their own #130/#175 acceptance; no administrative settings or completed acceptance are implied. All previous fixed-#176/manual/label-only bootstrap workarounds are superseded and removed. No #176 capture is required merely to register the actual workflow.

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

Main/default-branch activation is delivered through the reviewed tooling promotion; its live acceptance, branch protections and broader release/recovery checks stay in #130/#175/#44/#32. This tooling is tracked in #177 under milestone 10 and the Roadmap 3 Wiki. Owner merges all PRs and changes administrative controls.

[Deployment guide](deployment-guide.md) · [Publishing](publishing.md) · [Deployment architecture](../architecture/deployment.md)

## Reading the comparison report

Open `visual-evidence/comparison.html` with its screenshot folders intact. Every JSON section has **JSON** and **Details** choices; **Details** opens by default. Controls work offline without JavaScript and support keyboard navigation. JSON retains the full recorded payload. Existing artifacts retain their original layout.

Overall evidence Details shows browser assertions, evidence availability, owner design review, visual regression, reason, stale evidence, missing captures and approval. Screenshot Details shows state/project, viewport/density, theme/route, reduced motion, sprite frame, progress/mode/clock, browser/OS/Playwright, run/attempt, tooling SHA, candidate PR/channel/run/head/base/source/tree/base path and screenshot checksum. Missing values say “Not recorded”; zero and false remain visible.

Browser assertion and regression test cases use their Playwright JSON reports. Each case shows title/location/project, actual outcome, expected status and each attempt's status/duration/retry/errors/attachment paths. Run summaries show passed/failed/flaky/skipped counts, timing and setup errors. Attachment paths identify original evidence and are not rewritten as local links. Unavailable reports explicitly say unavailable/not run, never passed. Owner design approval remains separate.
