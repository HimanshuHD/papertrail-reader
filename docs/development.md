# GitHub-first web development

GitHub-first development continues: issue -> branch from main -> issue-linked commits -> PR -> CI -> review -> merge. No setup required on the owner's computer.

Frontend CI: clean npm ci from the committed lockfile, strict Vue/config type checks and production build. #22 adds lint, formatting and meaningful unit/component tests. Browser E2E covers selection fixtures, navigation, persistence and fallbacks. Rust CI waits for the desktop phase.

Post-merge #21: reconcile completed issue evidence, parent checklists and docs/progress.md/roadmap.md. Real merge verification is pending; do not declare this automation complete until it writes successfully. Keep partial and deferred issues open.

Status lifecycle: Backlog -> In progress -> In review -> Completed. Also use Blocked or Deferred with explicit reasons. PRs use Closes only for completed scope and Refs for partial work. Completed history is retained.

Issue parent mapping: #5 -> #21/#22; #9 -> #24/#25; #19 -> #26/#28; deferred #4 -> #23/#27. Current connector uses reciprocal links/task lists rather than native sub-issue relations.

Commit lockfiles, pin action SHAs and restrict token permissions. Release publication must respect agreed audience. Private GitHub source is not proof of private hosting.

Next after PR #29: finish frontend quality #22 and UI/state #6, then browser selection #8. Tauri is no longer the next implementation step.

## Commands

Node.js 24.12+ (24.x): npm ci; npm run dev; npm run type-check; npm run build; npm run preview. GitHub Actions performs installation and validation; no local setup is required on the owner's computer.

## Post-merge writes

merge-tracking.yml reconciles live closed issues, parent checklists and progress/roadmap documents. It serializes tracking runs and retries SHA conflicts. If main protection later blocks direct documentation writes, move tracking changes into a PR. #21 stays open until a real merge verifies the workflow.
