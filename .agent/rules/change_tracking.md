---
alwaysApply: true
---

# Change Tracking & Release Integrity Rules

This rule ensures that no feature requests, bug fixes, or enhancements are forgotten during development, that task priorities are respected, and that unfinished tasks are preserved across release cycles.

## 1. Prioritization & Task Management
- Every task listed under `## Next Release (vX.Y.Z / Upcoming)` in [TODO.md](file:///c:/Users/alex/.gemini/antigravity/playground/axial-magnetosphere/TODO.md) **MUST** have an explicit priority tag: `[Priority: High]`, `[Priority: Medium]`, or `[Priority: Low]`.
- Do not start working on lower-priority tasks if higher-priority tasks for the current release cycle are unfinished, unless there is a block or dependency explicitly documented.

## 2. Release Integrity & Preventing Stale Tasks
- **Never discard unfinished tasks**: When preparing a release (bumping the version and updating CHANGELOG.md), any task in the `Next Release` section of [TODO.md](file:///c:/Users/alex/.gemini/antigravity/playground/axial-magnetosphere/TODO.md) that is **not** fully completed (`[ ]`) **MUST NOT** be deleted or silently forgotten.
- Unfinished tasks must be handled in one of two ways:
  1. **Carried Forward**: Moved to the next upcoming release section (e.g., created `## Next Release (v1.7.0 / Upcoming)` if bumping to `v1.6.0`).
  2. **Moved to Backlog**: If a feature is deferred indefinitely, move it back to the `## Backlog / Ideas` section with an explanatory note.
- **Verification on Release**: Before finalizing a release, compare the [TODO.md](file:///c:/Users/alex/.gemini/antigravity/playground/axial-magnetosphere/TODO.md) completed items (`[x]`) for the release with the `### Added/Fixed/Changed` sections of [CHANGELOG.md](file:///c:/Users/alex/.gemini/antigravity/playground/axial-magnetosphere/CHANGELOG.md). They must match exactly.

## 3. Workflow for New Feature Requests / Scope Creep
- When the user requests a new feature mid-development:
  1. Add it to [TODO.md](file:///c:/Users/alex/.gemini/antigravity/playground/axial-magnetosphere/TODO.md) immediately in the appropriate section (`Next Release` or `Backlog`).
  2. Assign a priority.
  3. Clearly document if it is planned for the *current* active release cycle or a *future* one.
