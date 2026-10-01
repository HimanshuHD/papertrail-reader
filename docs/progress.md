# Project progress

Updated: 1 October 2026. Web-first decision: #30. Parent: #1.

Latest verified merge: [#33](https://github.com/HimanshuHD/papertrail-reader/pull/33) at 2026-10-01T16:13:20Z; commit `16e854621c419341b730bfa81d97ff222c93a2df`.

## Current increment

PR #29 completed #3/#30. Merge tracking #21 was verified by successful run 36887472079 and is completed. GitHub Pages pipeline #31 is in progress; live activation is pending repository Pages settings. Release tags/promotion remain #32.

## Issue tracker

| Issue | Phase | Work | Status | Depends on |
| --- | --- | --- | --- | --- |
| [#2](https://github.com/HimanshuHD/papertrail-reader/issues/2) | Web | Repository documentation and issue tracking | Completed | See issue |
| [#3](https://github.com/HimanshuHD/papertrail-reader/issues/3) | Web | Bootstrap Vue 3, Vite and TypeScript | Completed | #2 |
| [#4](https://github.com/HimanshuHD/papertrail-reader/issues/4) | Desktop later | Integrate Tauri 2 desktop shell | Deferred - desktop phase | After web release |
| [#5](https://github.com/HimanshuHD/papertrail-reader/issues/5) | Web | Configure web code quality, tests and GitHub Actions | In progress | #3 |
| [#6](https://github.com/HimanshuHD/papertrail-reader/issues/6) | Web | Design tokens, themes and application state | Backlog | #3 |
| [#7](https://github.com/HimanshuHD/papertrail-reader/issues/7) | Web | Split reader layout and accessible app shell | Backlog | #6 |
| [#8](https://github.com/HimanshuHD/papertrail-reader/issues/8) | Web | Browser folder/file selection and permission handling | Backlog | #3; #6 |
| [#9](https://github.com/HimanshuHD/papertrail-reader/issues/9) | Web | Browser document discovery and directory tree | Backlog | #8; #7 |
| [#10](https://github.com/HimanshuHD/papertrail-reader/issues/10) | Web | PDF.js reader, navigation and zoom | Backlog | #7; #9 |
| [#11](https://github.com/HimanshuHD/papertrail-reader/issues/11) | Web | PDF search, contents and reader shortcuts | Backlog | #10 |
| [#12](https://github.com/HimanshuHD/papertrail-reader/issues/12) | Web | EPUB reader and reflow controls | Backlog | #7; #9 |
| [#13](https://github.com/HimanshuHD/papertrail-reader/issues/13) | Web | Browser document identity, saved positions and bookmarks | Backlog | #9; #10; #12 |
| [#14](https://github.com/HimanshuHD/papertrail-reader/issues/14) | Web | Recent documents and library search | Backlog | #9; #13 |
| [#15](https://github.com/HimanshuHD/papertrail-reader/issues/15) | Web | Annotations, highlights and reading statistics | Backlog | #11; #12; #13 |
| [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) | Web | Browser performance, reliability and document safety | Backlog | Released reader/library scope |
| [#17](https://github.com/HimanshuHD/papertrail-reader/issues/17) | Web | Document tabs and session restoration | Backlog | #13; release reliability checks |
| [#18](https://github.com/HimanshuHD/papertrail-reader/issues/18) | Web | Optional split view and annotation export | Backlog | #15; #17 |
| [#19](https://github.com/HimanshuHD/papertrail-reader/issues/19) | Web | Web release readiness and delivery | Backlog | Web M0-M4; #13; #26; #28 |
| [#21](https://github.com/HimanshuHD/papertrail-reader/issues/21) | Web | Automate post-merge issue and progress reconciliation | Completed | #3; real merge |
| [#22](https://github.com/HimanshuHD/papertrail-reader/issues/22) | Web | Frontend quality checks and test coverage | Backlog | #3 |
| [#23](https://github.com/HimanshuHD/papertrail-reader/issues/23) | Desktop later | Rust formatting, lint and native test pipeline | Deferred - desktop phase | After web release |
| [#24](https://github.com/HimanshuHD/papertrail-reader/issues/24) | Web | Incremental browser indexing and cancellation | Backlog | #8 |
| [#25](https://github.com/HimanshuHD/papertrail-reader/issues/25) | Web | Directory tree and browser library refresh UI | Backlog | #24; #7 |
| [#26](https://github.com/HimanshuHD/papertrail-reader/issues/26) | Web | Web build, HTTPS deployment and release artifacts | In progress | #3; hosting/audience decision |
| [#27](https://github.com/HimanshuHD/papertrail-reader/issues/27) | Desktop later | Desktop signing and notarization | Deferred - desktop phase | After web release |
| [#28](https://github.com/HimanshuHD/papertrail-reader/issues/28) | Web | Supported-browser release validation | Backlog | Web reader scope |
| [#30](https://github.com/HimanshuHD/papertrail-reader/issues/30) | Web | Adopt web-first scope | Completed | #29 merge |

## Scope and completion rules

Web 0.1 is M0-M4 plus #13 and release-relevant reliability checks, with web delivery #26 and browser validation #28. #4/#23/#27 stay open and deferred; they do not block web delivery. Parent/child mappings: #5 -> #21/#22; #9 -> #24/#25; #19 -> #26/#28; desktop #4 -> #23/#27.

Post-merge automation reconciles closed completed issues and docs on main. It does not mark deferred or partial scope completed. Keep live issue state authoritative, and update evidence after each merge. Child relationships use reciprocal references/checklists.

## Deployment work

| Issue | Phase | Work | Status | Depends on |
| --- | --- | --- | --- | --- |
| [#31](https://github.com/HimanshuHD/papertrail-reader/issues/31) | Web | Main deployment and PR previews | In review | #26; Pages enablement; eligible plan |
| [#32](https://github.com/HimanshuHD/papertrail-reader/issues/32) | Web | Versioned releases and promotion | Backlog | #31; release acceptance |

Deployment design: [deployment.md](deployment.md). Main root plus preview/pr-N paths use one hostname. Live URLs are not verified yet.

Pipeline review: PR #33. Live Pages verification remains pending; no deployment issue is completed by build-only validation.
