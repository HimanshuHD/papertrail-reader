# Contributing

## Start with an issue

Use Roadmap 2 #78 (or Roadmap 3 #107 for later workspace scope) and [the progress tracker](../trackers/progress.md) to choose work. Check for existing issues before creating another. Describe scope, acceptance criteria, dependencies and the agreed GitHub milestone.

## Status lifecycle

Backlog → In progress → In review → Completed. Use Blocked with the blocking issue and reason when applicable. GitHub issue open/closed state is authoritative; docs/trackers/progress.md is the readable cross-issue index.

- At start: update the issue body and progress.md; record the branch and blockers.
- At review: link the PR, implementation commits and validation evidence.
- At merge: close completed issues through PR closing keywords and record merged PR/commit evidence. Update progress.md in a follow-up when necessary.
- Never close an issue solely because files were added. Meet acceptance criteria; split unfinished scope into linked follow-ups.

## Git conventions

Branch from current main: feature/<issue>-<name>, fix/<issue>-<name> or chore/<issue>-<name>.

Commit example: docs: add roadmap and issue tracker (refs #2).

PRs use Closes #N only for complete scope and Refs #N for partial work. Cross-links persist even when squash merging. Prefer squash merge after review and required checks; delete merged branches.

## Validation

Record what was checked and the result. For documentation, verify links and file integrity. Once application tooling exists, use the actual lint/type/test/build scripts and browser checks when needed. Real desktop features require supported-platform evidence. Do not claim CI passed before it exists or before a run succeeds.

## Documentation

Update [the documentation index](../README.md) when adding documents. Follow [documentation conventions](../development/documentation-conventions.md) and [issue policy](../development/issue-policy.md). Update docs/trackers/progress.md when work status changes. The roadmap PDF is a planning snapshot; record changed decisions in Markdown and a linked issue.

## Web-first scope and deferral

First-release work targets browsers. Defer Tauri/Rust/installer tasks to the desktop phase. Deferred issues stay open with explicit status and are never represented as completed. Test browser selection fallbacks and document-access reselection. Current scope decision: #30.

---

[Previous](local-setup.md) · [Documentation home](../README.md)
