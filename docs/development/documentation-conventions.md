# Documentation conventions

Start at root README → [Documentation home](../README.md). Every maintained guide belongs to a category, appears in its category index and is reachable from the central index. Read category guides in their listed order using **Previous · Documentation home · Next**. First/last guides omit unavailable directions.

Wiki roadmaps describe scope/sequencing; milestones group delivery and issues retain acceptance/evidence. Repository roadmap/tracker files are historical archives; do not maintain parallel live status tables. Architecture describes current boundaries and records historical changes explicitly. Release records preserve version, exact source/tag and validation evidence.

For a new guide: choose the category, add descriptive relative links to both indexes, insert it into the category reading sequence, and update the previous/next neighbors. Avoid adding navigation inside code fences. Assets go in docs/assets for new shared artwork or docs/screenshots for acceptance captures; licenses stay in docs/licenses. Preserve established release and screenshot paths.

When moving a guide, update repository references and relative links, retain an old-path migration pointer, and update [the migration map](documentation-migration.md). Update automation paths in the same PR if a workflow writes to the moved guide. Immutable links to historical commits are evidence, not current-path references.

The roadmap PDF is a historical planning snapshot. Wiki roadmaps and milestone issues carry current scope; do not present the PDF as a current feature or release commitment. No separate documentation website is part of this milestone.

Validate all local Markdown targets/fragments and image/PDF paths, index coverage and previous/next reciprocity. Run formatting checks and required CI. Docs-only PRs do not need reader Chromium; workflow changes remain eligible for deliberate browser acceptance. Browse the rendered GitHub index for final navigation acceptance after review.

---

[Previous](workflow-audit.md) · [Documentation home](../README.md) · [Next](documentation-migration.md)
