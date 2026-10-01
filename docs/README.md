# Documentation

| Document                                              | Purpose                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| [Roadmap PDF](PaperTrail-Web-First-Roadmap.pdf)       | Web-first planning snapshot, revision 2                                |
| [Roadmap](roadmap.md)                                 | Browser milestones and deferred desktop scope                          |
| [Progress](progress.md)                               | Cross-issue status and merge evidence                                  |
| [Status audit](status-audit.md)                       | Reconciled states, children and pending acceptance                     |
| [Architecture overview](architecture.md)              | Browser provider and reader boundaries                                 |
| [Vue architecture](vue-architecture.md)               | Current/pending module ownership, theme/state/routing and UI children  |
| [Deployment guide](deployment.md)                     | How to publish previews and validate production                        |
| [Deployment architecture](deployment-architecture.md) | Artifact trust, pages-state, trigger policy, recovery and release gaps |
| [Deployment verification](deployment-verification.md) | Recorded live evidence and final docs-only check                       |
| [Development](development.md)                         | GitHub-first quality and contribution workflow                         |

Add new documentation here and update this index. Live issues and docs/progress.md track delivery; plans and the roadmap PDF do not imply implemented features. Keep architecture changes and issue references together in the implementation PR.

[Initial version history](../CHANGELOG.md) records the 0.1.0 foundation scope and its limitations.

[Reader shell layout](shell-layout.md) documents home/app navigation, responsive layout and component boundaries (#42/#49).

[Browser validation](browser-testing.md) covers the Playwright matrix, built-site CI and screenshot/report artifacts (#37).
