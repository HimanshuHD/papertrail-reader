# Wiki roadmap adoption plan

Decision: finish Roadmap 2 annotations, reliability and major release before advanced deployment and staging work. EPUB milestone 3 is closed (0 open, 10 completed).

## Ownership

Use Wiki for roadmap goals, scope, sequence, decisions and archived release summaries. Issues own requirements/checklists/status; milestones own delivery grouping. Keep architecture and testing documentation beside code. Publish the Wiki first, verify links, then replace repository roadmap pages with archive/pointer notices; do not maintain two competing canonical roadmaps.

## Pages

| Page                                           | Purpose                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Home                                           | Product overview and navigation                                                             |
| Roadmaps                                       | Current, next and archived roadmap index                                                    |
| Roadmap 2 — Annotations and major release      | #78, #15 and release gates                                                                  |
| Roadmap 3 — Delivery preparation and workspace | #107; post-release #129/#130, advanced #26/#32/#44, later #17/#18                           |
| Release checklist                              | #19; implementation, bug triage, browser evidence, version/tag, artifacts and release notes |
| Decisions                                      | Dated scope changes and their rationale                                                     |
| Archives                                       | Accepted roadmap/release snapshots and evidence links                                       |

Every roadmap page should contain goal, proposed version, in/out scope, increment/dependency table, linked issues and milestones, release gates, decisions and last-updated date. Avoid manually duplicating individual issue checklists or status labels. Add a custom sidebar for navigation. Keep editing restricted to collaborators.

## Annotations delivery

#15 remains within Roadmap 2 #78. Implement #140 foundation → #141 PDF highlights → #142 EPUB highlights → #143 notes/panel → #144 local statistics → #145 acceptance. All are new in milestone 4. Create only the current increment branch from updated main; merge and validate before starting the next branch.

## Release boundary

After annotations: triage #139; finish required #16 reliability and #28 supported-browser acceptance; close #19 with existing reviewed release delivery, version/tag, artifacts and release notes. Full browser E2E follows the existing reviewed release-branch-to-main gate. A v2.0.0 target is provisional, not an issued tag. Advanced deployment automation/promotion (#26/#32), queued-publication recovery (#44), staging (#130) and formal staging/release event acceptance (#129) follow the major release. A reproduced #44 release blocker must still be triaged before release.

## Migration acceptance

- Create/verify Wiki Home and pages, links and sidebar.
- Publish approved roadmap text; retain issue links and historical release evidence.
- Add repository README/docs links to the published Wiki.
- Archive superseded repository roadmap descriptions only after publication verification.
- Keep issue/milestone status authoritative and reconcile roadmap scope after each merge.

Wiki is enabled for the public repository. Publication is not completed by this plan: the current GitHub connector cannot edit the separate Wiki repository. Roadmap 3 Preparation milestone creation/reassignment remains owner-managed.
