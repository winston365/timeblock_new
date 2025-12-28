Status: Active

Changelog:
- 2025-12-28: Initial audit pass focused on duplication, ADHD UX, architecture efficiency, and code style.

Value Statement and Business Objective:
- Reduce cognitive load and maintenance friction so ADHD-focused users get clearer feedback and faster UI without regressions. Cleaner structure also lowers delivery risk for upcoming iterations.

Objective:
- Identify duplicated logic/tests, ADHD-friendly UX gaps, architectural inefficiencies in the Electron + React + Dexie + Firebase stack, and style/complexity hotspots that merit refactor.

Context:
- Frontend-only scope; local-first Electron + React client with Dexie primary persistence and Firebase sync. No localStorage except theme. Observed code points: AppShell orchestration and time block visibility utilities/tests.

Root Cause (hypotheses):
- Legacy accretion left parallel test files with inconsistent casing and coverage.
- AppShell remains an orchestration hub for layout, modals, services, and settings toggles, keeping many cross-cutting concerns in one component.
- UI affordances (e.g., slim always-on-top toggle) optimized for screen real estate over accessibility/focus ergonomics.

Methodology:
- Quick source review of AppShell layout/orchestration and time block visibility utility/tests.
- Memory check for prior decisions about architecture hardening and ADHD UX guardrails.

Findings (facts):
- High: Two nearly identical time block visibility test suites coexist, split only by file name casing and coverage focus. One uses relative imports and covers `hide-past` and `current-only` display logic [tests/timeblock-visibility.test.ts#L18-L156](tests/timeblock-visibility.test.ts#L18-L156). The other uses alias imports and focuses on `hide-future` plus a narrower set of cases [tests/time-block-visibility.test.ts#L1-L49](tests/time-block-visibility.test.ts#L1-L49). This duplication risks drift and double maintenance while leaving behavior split across files.
- Medium: AppShell still coordinates initialization, keyboard shortcuts, panel layout, modal state, Dexie-backed settings, and toast-driven side effects in one ~200+ line component. Cross-cutting hooks and imperative store access (e.g., daily task creation, quest progress, sync error toasts) live together, making the shell hard to reason about and to unit test [src/app/AppShell.tsx#L73-L309](src/app/AppShell.tsx#L73-L309).
- Medium: The always-on-top toggle is a 10px-wide, full-height strip at the viewport edge, relying on hover tooltip for meaning and lacking an explicit label/icon in the main toolbar. Small hit target and edge placement increase miss-click risk and cognitive friction for ADHD users [src/app/AppShell.tsx#L216-L223](src/app/AppShell.tsx#L216-L223).
- Medium: Mixed import styles in visibility tests (relative vs alias) increase path inconsistency and complicate tooling/IDE navigation [tests/timeblock-visibility.test.ts#L8-L16](tests/timeblock-visibility.test.ts#L8-L16), [tests/time-block-visibility.test.ts#L3-L4](tests/time-block-visibility.test.ts#L3-L4).
- Low: The visibility utility itself is clean but relies on `TIME_BLOCKS` without guarding against malformed data or non-integer hours; if future modes add dynamic ranges, lack of validation could surface edge bugs [src/features/schedule/utils/timeBlockVisibility.ts#L31-L101](src/features/schedule/utils/timeBlockVisibility.ts#L31-L101).

Findings (hypotheses):
- High: Consolidating visibility behaviors into one canonical test suite and story/docs would clarify expected UX for `hide-past` vs `hide-future` vs `current-only` and avoid accidental regressions when TIME_BLOCKS changes.
- Medium: Further decomposing AppShell into a small orchestrator + feature-scope layout containers could improve render performance (fewer prop chains) and observability (per-surface error boundaries), aligning with prior boundary-hardening plans.
- Medium: ADHD-friendly affordances could benefit from clearer micro-step prompts and status text in the schedule/timeline surfaces; not directly visible in AppShell but implied by sparse inline guidance.

Recommendations (prioritized):
1) Merge the two visibility test suites into a single canonical file (choose kebab-case or camel-case consistently) and cover all modes (`hide-past`, `hide-future`, `current-only`, `all`) together. Remove the duplicate to prevent drift and align import style (prefer `@/` aliases).
2) Split AppShell into orchestration + presentational layers: move service/init and modal wiring into a thin controller; extract UI sections (toolbar, always-on-top affordance, waifu aside, overlays) into focused containers with their own hooks. Add lightweight tests for orchestration contracts.
3) Redesign the always-on-top toggle as an explicit button in the top toolbar with text/icon and 44px+ hit area, plus keyboard shortcut hint; keep the edge strip only if telemetry shows strong need.
4) Tighten validation in `timeBlockVisibility` (guard non-integer hours, invalid block ranges) and document expected modes; add storybook/visuals for ADHD-friendly timeline modes (focus-only, hide-past).
5) Standardize import paths in tests to aliases to improve navigation and reduce relative path churn.

Open Questions:
- Which visibility mode should be the primary UX default (hide-past vs hide-future) for schedule surfaces?
- Are there metrics/telemetry on always-on-top usage to justify retaining the edge strip versus moving to a toolbar control?
- Should visibility logic support user-configurable block ranges, and if so, where should validation live (store vs utility)?
