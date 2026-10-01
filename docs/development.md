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

## Initial frontend workflow

Node.js 24 is used by CI. `npm run build` first checks Vue SFCs and Vite configuration, then builds static assets. npm ci uses the committed lockfile. Lint and unit tests remain in #22; native checks remain in #23.

The temporary bootstrap-lockfile workflow generates and verifies the lockfile on GitHub, then is removed from the feature branch before review. The permanent frontend CI runs on PRs and main pushes.

## Automatic merge tracking

merge-tracking.yml runs when a PR to main closes as merged. It reconciles live issue state, updates parent task lists and writes docs/progress.md and docs/roadmap.md with merge evidence. It only marks referenced closed issues completed. It uses a serialized job and SHA-conflict retries for documentation writes. Tracker commits made with GITHUB_TOKEN do not recursively trigger workflows. Initial behavior must be verified on a real merge (#21).

Child issues are linked using parent references and reciprocal checklists; native GitHub sub-issue relations can be added when a supported write operation is available.
