# GitHub-first development

## Working model

All source changes are committed to this repository through branches and PRs. No setup is required on the owner's computer. This setup change establishes documentation only; frontend/native bootstrap and executable pipelines are separate tracked issues.

## Daily tracking protocol

1. Read roadmap issue #1, the selected issue and docs/progress.md.
2. Check issue state and current main; do not rely on historical conversation status.
3. Record In progress, branch and dependencies.
4. Reference the issue in every implementation commit.
5. Open a PR with scope, issue links, validation and limitations.
6. Mark In review and link the PR from the issue.
7. Merge after review/checks. Close only completed scope; keep blocked/backlog work open.
8. Record completion evidence and update the parent checklist.

This is a persistent project process, not a scheduled background automation.

## Planned CI/CD

Issue #5 implements frontend lint, formatting, type checking, unit tests and build checks, plus native checks when the Rust shell is present. It should use committed lockfiles, immutable action pins, least-privilege permissions and concurrency cancellation. Avoid duplicate push/PR runs for the same feature work.

Issue #19 covers platform installer/release workflows, checksums and signing when credentials exist. Tags must point to reviewed commits. Signing status must be explicit. Desktop testing is still required for dialogs, filesystem boundaries and installers.

## Definition of done

Acceptance criteria met; implementation PR linked; appropriate validation recorded; documentation updated; remaining scope tracked explicitly. A passing build alone does not prove the reader's behavior.
