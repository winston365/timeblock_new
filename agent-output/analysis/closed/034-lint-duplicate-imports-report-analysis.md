Status: Planned

## Changelog
- 2025-12-23: Collected current ESLint output, ESC/Ctrl+Enter modal handling review, and coverage hot spots for implementation handoff.
- 2025-12-23: 036 PR-split 구현 계획에 근거 자료로 사용 (P0 lint, P1 hotkeys, P2 tests 범위 확정).

## Value Statement and Business Objective
Ensuring lint cleanliness and consistent modal hotkeys removes CI blockers and reduces user-facing input bugs, accelerating the next UI iteration without backend risk.

## Objective
Provide an implementation-ready snapshot of lint blockers, partially resolved modal/hotkey patterns, and remaining risk areas (coverage and sync branches) for front-end scope.

## Context
- lint-errors.txt not present in repo; fresh `npm run lint -- --max-warnings=0` run used instead.
- ESLint currently halts on warnings (max-warnings=0) even without duplicate-import errors.
- Coverage reference from coverage/coverage-summary.json (latest run in repo).

## Root Cause Analysis
- Lint failures stem from unstable hook dependencies and unused values, not duplicate imports (prior duplicates appear already fixed or removed).
- Modal ESC/Ctrl+Enter handling mixes shared hook (useModalHotkeys) with ad-hoc window listeners, leaving stack safety uneven.
- Coverage gaps persist in orchestrator services (unifiedTaskService, conflictResolver, syncCore) due to untested branch paths.

## Methodology
- Ran ESLint locally with repo script (`npm run lint -- --max-warnings=0`).
- Searched workspace for lint log artifacts and ESC/Ctrl+Enter handlers; read relevant modal files.
- Inspected coverage summary JSON for hot spots.

## Findings (Fact vs Hypothesis)
- Fact: ESLint reports 4 warnings (treated as blocking): todayTasks dependency instability and unused incrementProcessedCount in src/features/tasks/InboxTab.tsx#L52,L78; todayTasks dependency instability in src/features/tasks/hooks/useInboxHotkeys.ts#L102; unused createTask helper in tests/slot-finder.test.ts#L15.
- Fact: No lint-errors.txt found via recursive search; reproduction relies on live lint run.
- Fact: Goals modal stack uses useModalHotkeys instead of useModalEscapeClose (src/features/goals/GoalsModal.tsx#L56), so ESC is handled but via broader hotkey hook.
- Fact: Boss album modal mirrors useModalHotkeys with custom close logic (src/features/battle/components/BossAlbumModal.tsx#L525-L538).
- Fact: Template modal also uses useModalHotkeys for ESC and primary action (src/features/template/TemplateModal.tsx#L52-L77) rather than useModalEscapeClose; WeeklyGoalModal similar (src/features/goals/WeeklyGoalModal.tsx#L41-L69).
- Fact: QuickAddTask registers global window keydown for ESC/Ctrl+Enter (src/features/quickadd/QuickAddTask.tsx#L137-L158), bypassing modal stack registry and risking double handlers.
- Fact: Coverage gaps remain: unifiedTaskService lines 58.88% branches 69.04%; conflictResolver branches 58.82% despite 93.65% lines; syncCore branches 62.74% (coverage/coverage-summary.json).
- Hypothesis: Repository boundary violations are currently mitigated; no direct dexieClient imports outside data/* or infra were observed, but periodic scans still advised.

## Recommendations
- Fix lint blockers: wrap todayTasks in useMemo and pass memoized reference into callbacks; remove or wire incrementProcessedCount in InboxTab; delete or use createTask helper in slot-finder.test.ts.
- Align modal ESC handling: migrate GoalsModal, BossAlbumModal, TemplateModal, WeeklyGoalModal to useModalEscapeClose (or ensure useModalHotkeys shares modalStackRegistry with explicit comments) to enforce ESC stack policy; replace QuickAddTask window listener with shared hook to avoid global leakage.
- Normalize Ctrl+Enter: route primary action triggers through useModalHotkeys primaryAction or shared keyboard hook instead of custom listeners (QuickAddTask, any remaining forms).
- Cover risk hotspots: add branch-focused tests for unifiedTaskService edge cases (dual storage, missing locations), conflictResolver conflict types, and syncCore retry/failure branches.
- Keep repository boundary watchlist: add lint/grep checks for direct dexieClient imports outside data/* in CI to prevent regressions.

## Open Questions
- Should useModalHotkeys be treated as compliant with ESC stack policy, or do we standardize on useModalEscapeClose for all modals?
- For QuickAddTask (Electron window), can we safely integrate modalStackRegistry or should we isolate via per-window listener with teardown tests?
- Do we want to relax max-warnings to allow CI to pass until fixes land, or keep strict zero-warning policy?
