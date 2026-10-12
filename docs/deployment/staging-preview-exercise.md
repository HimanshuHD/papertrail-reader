# Staging preview validation exercise

This temporary documentation-only PR exercises the staging PR workflow without changing app behavior or user data.

## Prerequisite

Merge corrective PR #172 into staging and verify its integration Browser E2E and staging publication. Update this test branch from that accepted staging revision before marking ready. The initial branch is based on `08b1cb7`; it does not contain #172 yet.

## Exercise

1. Keep this PR draft until the prerequisite is complete. Draft application CI should skip.
2. Synchronize this branch with current staging, then mark ready. Frontend CI/Candidate validation must pass; PR Browser E2E should skip.
3. Actions → Publish website → Run workflow. During bootstrap select **staging as workflow source** (the new publisher is not activated on main yet). Select target branch staging, operation preview, and this PR number.
4. Open `/papertrail-reader/preview/pr-N/`. Verify footer shows Preview, this PR number and current head SHA. Compare with `/papertrail-reader/staging/`; stable staging must not change when publishing this preview. This documentation-only change has no app UI difference beyond preview identity.
5. Edit the PR checklist/title while open: candidate reuse must succeed without repeating application tests.
6. Optional: return to draft and verify new preview requests are rejected; after main activation confirm automatic draft notice and reopened handling.
7. Close without merging after the exercise. After main activation, verify preview retirement/closed page and stable channel preservation. During bootstrap automatic cleanup on main is not yet active; do not use the legacy main publisher.
8. Record actual run IDs, source identity and URLs before checking evidence. Delete the temporary branch only after cleanup.

## Acceptance evidence

- [ ] Corrected stable staging published and verified.
- [ ] Draft/ready candidate behavior verified.
- [ ] Manual numbered preview published from accepted current candidate.
- [ ] Preview identity and staging/production preservation verified.
- [ ] Metadata-only edit accepted.
- [ ] Closed preview retired after activation.

No implementation, deployment, permission or release acceptance is implied by creating this document. Related #130 and #44.
