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

[Browser validation](browser-testing.md) covers the Playwright matrix, explicit browser checks and historical screenshot/report evidence (#37).

[Branch maintenance](branch-maintenance.md) records verified stale work branches and the retained main/pages-state infrastructure.

## Current release planning

[Roadmap](roadmap.md) separates first release (#1, bug gate #79, release gate #80) from post-release Roadmap 2 (#78). [First-release bug tracking](first-release-bugs.md) defines intake and linked child evidence. The existing roadmap PDF is historical; Markdown and live issues carry the revised plan.

[Loading feedback](loading-feedback.md) preserves the merged #85 screenshots and validation. [Reader polish](reader-polish.md) records combined #86/#87 control, motion and footer changes.
