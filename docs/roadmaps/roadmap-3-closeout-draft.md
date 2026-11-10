# Roadmap 3 Wiki update draft

These edits target the current Wiki revision `40fd04764bcb4e92d0dc21e5d25a34a1cdbbd1a3`.
The Roadmap-3 opening and Phase 4 already have review text; replace the
existing blocks instead of adding duplicates. The Roadmaps index still has
the older diagnostics-pending wording. The Decisions page begins with the
9 October measurement carry-forward entry. Apply the closure substitutions
after the release is published, the owner accepts #16, and milestone 9 and
Roadmap 3 are reconciled. Fill in the recorded date, exact source and delivery
links before publishing the closure update.

## Roadmap-3 page

On [Roadmap-3](https://github.com/HimanshuHD/papertrail-reader/wiki/Roadmap-3),
replace the three opening blocks above **Baseline** with the following. Keep
the title and all dated history.

```markdown
**Status** — Final release review. Milestones 7, 10 and 8 are closed.
Milestone 9 remains open for [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16).

**Released increments** — [v2.1.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.1.0)
startup loading, [v2.1.1](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.1.1) versioned delivery,
and [v2.2.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.2.0) multiple-document workspace.

**Proposed final release** — v2.3.0. [#319](https://github.com/HimanshuHD/papertrail-reader/pull/319)
merged as `d54bc70`. The owner accepted the fixture scope on 10 November 2026. [Matching staging delivery](https://github.com/HimanshuHD/papertrail-reader/actions/runs/42862739552)
passed 592 browser cases (17 skips), publication and live verification. The owner reported manual preview passed. Release delivery remains tracked in [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16)
and [#107](https://github.com/HimanshuHD/papertrail-reader/issues/107).
```

Replace the table under **Milestones** with this table. Keep historical
release and recovery checkpoints.

| Milestone                                                                                                              | Delivered scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Release or gate                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Milestone 7](https://github.com/HimanshuHD/papertrail-reader/milestone/7) — Preparation                               | Web deployment, versioned artifacts, immutable archives, promotion and rollback ([#26](https://github.com/HimanshuHD/papertrail-reader/issues/26), [#32](https://github.com/HimanshuHD/papertrail-reader/issues/32))                                                                                                                                                                                                                                                                                                                                                                                  | [v2.1.1](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.1.1) · closed                                                                                 |
| [Milestone 10](https://github.com/HimanshuHD/papertrail-reader/milestone/10) — Startup loading and delivery validation | Startup screen, staging/preview workflow, recovery and reviewed visual baselines ([#171](https://github.com/HimanshuHD/papertrail-reader/issues/171), [#130](https://github.com/HimanshuHD/papertrail-reader/issues/130), [#44](https://github.com/HimanshuHD/papertrail-reader/issues/44), [#175](https://github.com/HimanshuHD/papertrail-reader/issues/175), [#177](https://github.com/HimanshuHD/papertrail-reader/issues/177), [#193](https://github.com/HimanshuHD/papertrail-reader/issues/193))                                                                                               | [v2.1.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.1.0) / [v2.1.1](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.1.1) · closed |
| [Milestone 8](https://github.com/HimanshuHD/papertrail-reader/milestone/8) — Multiple-document workspace               | Isolated tabs, restored sessions, compact workspace, split view, annotation export and manual-only Visual QA ([#17](https://github.com/HimanshuHD/papertrail-reader/issues/17), [#18](https://github.com/HimanshuHD/papertrail-reader/issues/18), [#224](https://github.com/HimanshuHD/papertrail-reader/issues/224), [#230](https://github.com/HimanshuHD/papertrail-reader/issues/230), [#239](https://github.com/HimanshuHD/papertrail-reader/issues/239), [#240](https://github.com/HimanshuHD/papertrail-reader/issues/240), [#244](https://github.com/HimanshuHD/papertrail-reader/issues/244)) | [v2.2.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.2.0) · closed                                                                                 |
| [Milestone 9](https://github.com/HimanshuHD/papertrail-reader/milestone/9) — Performance and reliability               | Opt-in diagnostics, reader performance and final workload acceptance ([#167](https://github.com/HimanshuHD/papertrail-reader/issues/167), [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16), [#289](https://github.com/HimanshuHD/papertrail-reader/issues/289), [#304](https://github.com/HimanshuHD/papertrail-reader/issues/304))                                                                                                                                                                                                                                                   | Proposed v2.3.0 · [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) scope and staging review accepted; release pending                                  |

Remove the stale sentence immediately before **Phase 4 — Developer diagnostics
and reliability** that says both #167 and #16 remain. Replace the existing
**Final increment.** block at the end of Phase 4 (above **Delivery model**)
with this text:

```markdown
**Final increment.** [#167](https://github.com/HimanshuHD/papertrail-reader/issues/167) completed opt-in diagnostics.
[#304](https://github.com/HimanshuHD/papertrail-reader/issues/304) closed after owner manual acceptance and staging
verification. Staging includes the PDF component window, EPUB cleanup and
scroll work, EPUB compatibility and fonts, compact notices and document
links. [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) records acceptance of the generated workload targets and their limits.
Candidate review passed; release delivery remains pending.
The earlier reader regression report passed 123/123 across Chromium, Firefox
and WebKit. This is functional evidence, separate from #16 and the final
release delivery. Visual QA remains manual-only.
[Release coordination](https://github.com/HimanshuHD/papertrail-reader/issues/107)
```

After closure, set **Status** to **Completed — [date]**, add the published
[v2.3.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.3.0) link to **Released increments**, and replace **Proposed final release**
with **Final release — [published release]**. Change the milestone 9 table
entry to **v2.3.0 · closed** with the release link. Replace the Phase 4 review
paragraph with this final entry under **Roadmap completion**.

```markdown
### Final acceptance — [date]

All four milestones are closed. [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) records owner
acceptance of the versioned fixture targets and their evidence scope.
[#107](https://github.com/HimanshuHD/papertrail-reader/issues/107) records Roadmap 3 closure. v2.3.0 includes reader
compatibility and navigation fixes, opt-in diagnostics, and the PDF/EPUB
performance and reliability increment.

[Published release] · [Exact-source release record] · [Live delivery receipt] ·
[Immutable release URL]

Native-folder permission validation, screen-reader validation and EPUB
full-book search remain tracked separately in [#274](https://github.com/HimanshuHD/papertrail-reader/issues/274),
[#275](https://github.com/HimanshuHD/papertrail-reader/issues/275) and [#278](https://github.com/HimanshuHD/papertrail-reader/issues/278).
```

## Roadmaps index

On [Roadmaps](https://github.com/HimanshuHD/papertrail-reader/wiki/Roadmaps),
replace the `[[Roadmap-3]]` table row and the two paragraphs in **Next
increments** beginning with “v2.2.0 release acceptance” and “Next: developer
diagnostics”. Keep the manual Visual QA paragraph and existing delivery history.

```markdown
| [[Roadmap-3]] | Final release review | Startup loading, versioned delivery and the workspace shipped in v2.1.0–v2.2.0. #16 fixture scope accepted; manual candidate review passed; v2.3.0 delivery remains pending. |
```

```markdown
Milestones 7, 10 and 8 are closed. Diagnostics #167 and virtualization #304
are complete. [#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) is the final open milestone 9 issue.
[PR #319](https://github.com/HimanshuHD/papertrail-reader/pull/319) carries the proposed release notes, change
inventory and acceptance checklist. The implementation is merged; the
[release coordination record](https://github.com/HimanshuHD/papertrail-reader/issues/107)
tracks the remaining review and delivery gates.
```

After closure, use this final row and replace that **Next increments** paragraph
with the closure text. Add the published version at the top of **Release history**.
In **Current closure**, replace the present-tense v2.2.0 production/latest
statement with a historical v2.2.0 acceptance statement. Keep the old run links.

```markdown
| [[Roadmap-3]] | Completed | Startup loading, versioned delivery, multiple-document workspace and reader performance/reliability — [v2.3.0](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.3.0) |
```

```markdown
Roadmap 3 and its four milestones closed after final #16 acceptance and
verified v2.3.0 delivery. [Roadmap closure] · [Release record]

- [v2.3.0 — Reader improvements, diagnostics and reliability](https://github.com/HimanshuHD/papertrail-reader/releases/tag/v2.3.0)
```

## Decisions page

On [Decisions](https://github.com/HimanshuHD/papertrail-reader/wiki/Decisions),
after acceptance insert the following immediately after `# Decisions`, before
`## 9 October 2026 — Carry remaining measurements forward`. Preserve the
earlier entries. Replace bracketed placeholders only with verified results.

```markdown
### 10 November 2026 — Scope of Roadmap 3 performance acceptance

[#16](https://github.com/HimanshuHD/papertrail-reader/issues/16) records the accepted target version, generated
workloads, browser configuration and indicator rules. The fixture harness
validates scan 475/950 ms, PDF cold-open 425/850 ms and EPUB cold-open
400/800 ms (attention/critical) only within the accepted configuration.
Ordinary diagnostics do not inherit this fixture configuration. The acceptance
record distinguishes temporary page allocation, retained page heap and
process observations. This accepts the fixture scope; manual candidate review passed and release delivery remains separate. Visual QA stays manual.
[Target review](https://github.com/HimanshuHD/papertrail-reader/blob/d54bc700a5e81b109838fce92bcb3ed48fbbcfa2/docs/development/performance-target-review.md) ·
[Release coordination](https://github.com/HimanshuHD/papertrail-reader/issues/107)
```
