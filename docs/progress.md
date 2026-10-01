# Project progress

Updated: 1 October 2026. Parent tracker: [#1](https://github.com/HimanshuHD/papertrail-reader/issues/1).

## Current increment

#2 is completed by merged PR #20; merge commit `abe39ff95435861258d7f37fb2a0249066ee733f`. #3 is In review on `chore/3-vue-vite-bootstrap`. The frontend foundation passed clean npm ci, type checking and production build in [GitHub run 36884610560](https://github.com/HimanshuHD/papertrail-reader/actions/runs/36884610560). Post-merge workflow #21 passed representative reconciliation checks; real-merge verification is pending. Native runtime and document reading are pending.

## Backlog and dependencies

| Issue | Milestone | Work | Status | Depends on |
| --- | --- | --- | --- | --- |
| [#2](https://github.com/HimanshuHD/papertrail-reader/issues/2) | M0 | Repository documentation and issue tracking | Completed | None |
| [#3](https://github.com/HimanshuHD/papertrail-reader/issues/3) | M0 | Bootstrap Vue 3, Vite and TypeScript | In review | #2 |
| [#4](https://github.com/HimanshuHD/papertrail-reader/issues/4) | M0 | Integrate Tauri 2 desktop shell | Backlog | #3 |
| [#5](https://github.com/HimanshuHD/papertrail-reader/issues/5) | M0 | Configure code quality, tests and GitHub Actions | Backlog | #3; native checks after #4 |
| [#6](https://github.com/HimanshuHD/papertrail-reader/issues/6) | M1 | Design tokens, themes and application state | Backlog | #3 |
| [#7](https://github.com/HimanshuHD/papertrail-reader/issues/7) | M1 | Split reader layout and accessible app shell | Backlog | #6 |
| [#8](https://github.com/HimanshuHD/papertrail-reader/issues/8) | M2 | Native folder selection and scoped file access | Backlog | #4 |
| [#9](https://github.com/HimanshuHD/papertrail-reader/issues/9) | M2 | Recursive document scanner and directory tree | Backlog | #8; #7 |
| [#10](https://github.com/HimanshuHD/papertrail-reader/issues/10) | M3 | PDF.js reader, navigation and zoom | Backlog | #3; #7; #9 |
| [#11](https://github.com/HimanshuHD/papertrail-reader/issues/11) | M3 | PDF search, contents and reader shortcuts | Backlog | #10 |
| [#12](https://github.com/HimanshuHD/papertrail-reader/issues/12) | M4 | EPUB reader and reflow controls | Backlog | #7; #9 |
| [#13](https://github.com/HimanshuHD/papertrail-reader/issues/13) | M5 | Stable document identity, reading positions and bookmarks | Backlog | #9; #10; #12 |
| [#14](https://github.com/HimanshuHD/papertrail-reader/issues/14) | M5 | Recent documents and library search | Backlog | #9; #13 |
| [#15](https://github.com/HimanshuHD/papertrail-reader/issues/15) | M5 | Annotations, highlights and reading statistics | Backlog | #11; #12; #13 |
| [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) | M6 | Performance, reliability and document security verification | Backlog | #9-#15 as implemented |
| [#17](https://github.com/HimanshuHD/papertrail-reader/issues/17) | M7 | Document tabs and session restoration | Backlog | #13; #16 |
| [#18](https://github.com/HimanshuHD/papertrail-reader/issues/18) | M7 | Optional split view and annotation export | Backlog | #15; #17 |
| [#19](https://github.com/HimanshuHD/papertrail-reader/issues/19) | M7 | Desktop packaging and first release | Backlog | #5; first-release scope (#3-#13); later #16-#18 |

## Evidence and completion

- #2: Initial README and setup commits above; PR #20 contains the requested files and tracking templates. All relative Markdown links resolved; PDF parsed as eight pages and uploaded blob matched source bytes. App CI does not exist yet.
- #2 completed by merged PR #20. Frontend issue #3 remains open until validation and merge.
- Next: finish #3 frontend validation, then #4 native shell and remaining #5 children.

## Maintenance

Update this file when work starts, becomes blocked, enters review or completes. Record PR/commit links and validation results. Reconcile this snapshot with live issue state before beginning another increment. Do not mark planned features complete.

## Child issue breakdown

| Issue | Milestone | Work | Status | Depends on |
| --- | --- | --- | --- | --- |
| [#21](https://github.com/HimanshuHD/papertrail-reader/issues/21) | See parent | [M0] Automate post-merge issue and progress reconciliation | In progress | Parent #5 |
| [#22](https://github.com/HimanshuHD/papertrail-reader/issues/22) | See parent | [M0] Frontend quality checks and test coverage | Backlog | Parent #5 |
| [#23](https://github.com/HimanshuHD/papertrail-reader/issues/23) | See parent | [M0] Rust formatting, lint and native test pipeline | Backlog | Parent #5 |
| [#24](https://github.com/HimanshuHD/papertrail-reader/issues/24) | See parent | [M2] Incremental cancellable native scanner | Backlog | Parent #9 |
| [#25](https://github.com/HimanshuHD/papertrail-reader/issues/25) | See parent | [M2] Directory tree and library refresh UI | Backlog | Parent #9 |
| [#26](https://github.com/HimanshuHD/papertrail-reader/issues/26) | See parent | [M7] Release 0.1 installer builds and release artifacts | Backlog | Parent #19 |
| [#27](https://github.com/HimanshuHD/papertrail-reader/issues/27) | See parent | [M7] Desktop signing and notarization | Backlog | Parent #19 |
| [#28](https://github.com/HimanshuHD/papertrail-reader/issues/28) | See parent | [M7] Supported-platform installer smoke testing | Backlog | Parent #19 |

## Post-merge reconciliation

After a merged PR, merge-tracking.yml records live closed-issue state, parent checklists and completion evidence, and updates this file and roadmap.md on main. It does not close partially completed issues or automatically declare parent issues complete. Direct documentation updates use the repository token; if branch rules later block that write, change the workflow to open a tracking PR. Native sub-issue mutation is not available through the current connector, so children use reciprocal parent links and task lists.
