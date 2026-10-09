# GitHub-first web development

GitHub-first development continues: issue -> branch from main -> issue-linked commits -> PR -> CI -> review -> merge. No setup required on the owner's computer.

Frontend CI: clean npm ci from the committed lockfile, strict Vue/config type checks and production build. #22 adds ESLint, Prettier and Vitest/Vue Test Utils component checks to this same workflow. Browser E2E setup is tracked in #37. Browser E2E covers selection fixtures, navigation, persistence and fallbacks. Rust CI waits for the desktop phase.

Post-merge #21: reconcile completed issue evidence, parent acceptance checklists and milestone/Wiki references. Real merge verification passed in run 36887472079; PR #36 was also reconciled successfully in run 36894959027. Keep partial and deferred issues open.

Status lifecycle: Backlog -> In progress -> In review -> Completed. Also use Blocked or Deferred with explicit reasons. PRs use Closes only for completed scope and Refs for partial work. Completed history is retained.

Issue parent mapping: #5 -> #21/#22/#35/#37; #9 -> #24/#25; #19 -> #26/#28; deferred #4 -> #23/#27. Current connector uses reciprocal links/task lists rather than native sub-issue relations.

Commit lockfiles, pin action SHAs and restrict token permissions. Release publication must respect agreed audience. Private GitHub source is not proof of private hosting.

Next after PR #29: finish frontend quality #22 and UI/state #6, then browser selection #8. Tauri is no longer the next implementation step.

## Commands

Node.js 24.12+ (24.x): npm ci; npm run dev; npm run type-check; npm run build; npm run preview. GitHub Actions performs installation and validation; no local setup is required on the owner's computer.

## Post-merge writes

merge-tracking.yml reconciles completed issue evidence and parent acceptance checklists only. It has read-only repository contents permission and does not write roadmap/progress documents or Wiki pages. Milestones and Wiki planning are maintained through the approved issue/milestone process and owner Wiki editing. #21 is completed; incomplete product and deployment checks remain open.

## Quality checks (#22)

Run `npm run check` for ESLint (zero warnings), Prettier, Node deployment-policy/assembly tests, Vitest component tests and strict Vue/TypeScript checks. Run `npm run build` for the production bundle. `npm run format` fixes formatting; `npm run test:watch` watches component tests.

CI runs these checks before building and uploading an artifact. Test configuration uses jsdom and Vue Test Utils; tests are type-checked with vue-tsc. The foundation tests verify labeled landmarks and honest file-access messaging. These are component checks, not browser accessibility certification. Add behavior tests with each reader/library increment; real browser selection/focus checks follow in #37.

Dependencies are pinned exactly with a committed npm lockfile. Prettier excludes generated output, lockfile and PDF artifacts. Node.js 24.x remains required. CI needs no local setup on the owner's computer.

## Deployment identifier footer (#35, PR #38)

CI embeds the source head SHA and PR number at build time. The footer shows Preview / PR number with a short SHA linked to the full commit, or Production / main with its SHA. Local builds without CI metadata show Development / SHA unavailable. Rerun Publish website with PR number 38 after the new head passes CI to inspect this footer; the existing preview stays on its previously published build until manual deployment.

---

[Documentation home](../README.md) · [Next](issue-policy.md)
