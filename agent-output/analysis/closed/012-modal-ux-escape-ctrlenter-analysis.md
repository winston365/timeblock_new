# 012-modal-ux-escape-ctrlenter-analysis
Status: Planned

## Changelog
- 2025-12-22: Initial inventory of modal ESC and Ctrl+Enter behaviors across frontend.
- 2025-12-23: Incorporated into PR-sized breakdown plan (top10 improvements).

## Value Statement and Business Objective
Consistent keyboard affordances (ESC close, Ctrl+Enter primary action) reduce friction for power users and prevent modal stacking/escape bugs that block flows. Fixing gaps improves reliability metrics for modal interactions and aligns with the project-wide UX policy.

## Objective
Map all modal implementations, categorize ESC/Ctrl+Enter support, and outline verification methods (manual + vitest) to close gaps without touching backend/Electron IPC.

## Context
- Policy: no backdrop-close; ESC must close (pref. via useModalEscapeClose) and primary action should support Ctrl+Enter. Guideline reiterated in .github/copilot-instructions.md.
- Modal stack hook: useModalEscapeClose enforces top-most ESC handling with preventDefault/stopPropagation and stack cleanup when closing [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts#L1-L60).

## Methodology
- Searched for Modal files (**/*Modal*.tsx) and ESC/Ctrl+Enter key handlers via repo grep.
- Read representative implementations to confirm patterns (stack hook vs manual listeners, primary action bindings).
- Counted coverage by presence of useModalEscapeClose vs custom handlers; cataloged Ctrl+Enter bindings by ctrlKey usage in modals.

## Findings (facts)
- ESC coverage: 23 modals use the stack-aware hook (e.g., [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx#L25-L74), [src/features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx#L21-L90)); 2 modals use custom window keydown without the stack hook: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx#L42-L83) and [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx#L508-L531).
- Stack behavior: useModalEscapeClose guards top-most modal via a Set-based stack and stops propagation, but manual implementations bypass the stack and may compete with other open modals if multiple are mounted (e.g., GoalsModal coexists with WeeklyGoalModal, though the child uses the hook).
- Ctrl+Enter coverage (modal-scoped): implemented only in [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx#L152-L188), [src/features/schedule/MemoModal.tsx](src/features/schedule/MemoModal.tsx#L27-L47), [src/features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx#L205-L236), [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx#L270-L305), and [src/features/shop/ShopModal.tsx](src/features/shop/ShopModal.tsx#L41-L79). QuickAddTask (non-modal window) also binds Ctrl+Enter/ESC [src/features/quickadd/QuickAddTask.tsx](src/features/quickadd/QuickAddTask.tsx#L104-L145).
- Primary-action gaps: Most modals with clear primary buttons lack Ctrl+Enter (e.g., SettingsModal, TemplatesModal, SyncLogModal, StatsModal, DailySummaryModal, WeeklyGoalModal, MissionModal). No shared hotkey utility found; bindings are ad-hoc window listeners.
- GlobalModals container only mounts modals and adds F1 shortcut; it does not mediate ESC/stack [src/app/components/GlobalModals.tsx](src/app/components/GlobalModals.tsx#L33-L80).

## Findings (hypotheses)
- Manual ESC listeners (GoalsModal, BossAlbumModal) may ignore stack order when another modal is open, risking double-close or parent-close when child should intercept. However, current child modals using the hook call stopPropagation, which likely mitigates but is not guaranteed if new modals are added.
- Ctrl+Enter gaps likely stem from lack of a shared hook (e.g., usePrimaryActionHotkey) and may lead to inconsistent muscle-memory failures, especially in data-entry heavy modals (Templates, Settings, Goals).

## Problem Type Classification (metrics-oriented)
1) ESC handler pattern drift: 2/25 modals bypass stack hook (Goals, BossAlbum) — risk of stack conflicts. Verification: vitest react-testing-library (RTL) with jsdom, mount parent/child modal pair and fire Escape to ensure only top closes.
2) ESC present but potential focus edge cases: hook relies on window keydown; should confirm inputs with keydown preventDefault (e.g., textarea) still trigger close. Verification: RTL render + fireEvent.keyDown(document, { key: 'Escape' }) while focused input is active.
3) Ctrl+Enter unsupported: ~80% of modals with primary action missing binding (Settings, Templates, SyncLog, Stats, DailySummary, WeeklyGoal, Mission, MemoMission, TempSchedule modals, etc.). Verification: RTL mount modal, set isOpen, fire Ctrl+Enter, assert primary handler spy called.
4) Multiple window listeners per modal: several modals add their own keydown listeners without shared cleanup patterns; risk of leakage if open flag mis-tracked. Verification: RTL ensure listener removed on unmount/open toggle via spy on addEventListener/removeEventListener counts.
5) Stack integrity: useModalEscapeClose uses Set, relies on add/remove order; missing deterministic ordering tests. Verification: unit-test hook with two instances mounted/unmounted to ensure only last responds.

## Recommendations (frontend-only)
- Standardize on useModalEscapeClose for all modals (migrate GoalsModal, BossAlbumModal) to enforce stack safety and consistent preventDefault/stopPropagation.
- Introduce a shared usePrimaryActionHotkey(isOpen, onPrimary, options) hook that listens for Ctrl+Enter (metaKey on macOS) and optionally disables while child modals are open; replace scattered window listeners.
- Create a lightweight modal contract checklist (props: isOpen, onClose, primaryAction?) and lintable test cases per modal.
- Add vitest + RTL tests:
  - Hook: mount two dummy modals using useModalEscapeClose, assert only top closes on Escape.
  - Modal samples: TaskModal, SettingsModal (after hook adoption), BossAlbumModal to confirm ESC and Ctrl+Enter behaviors.
  - Snapshot or DOM queries to ensure backdrop click does not close when clicked (no onClick on overlay that triggers close).

## Verification/Testing Plan
- Unit: useModalEscapeClose stack behavior with simulated mounts/unmounts (jsdom window keydown).
- Component: RTL render each modal with isOpen=true; trigger Escape and Ctrl+Enter; assert onClose/onPrimary spies. For modals without primary actions, assert no effect on Ctrl+Enter.
- Regression guard: add test to GlobalModals mounting a hook-based modal plus a manual modal (current regression) to detect stack violations once migrated.

## Open Questions
- Should Ctrl+Enter be enabled for all modals or only those with a clear affirmative action (some informational modals like CompletionCelebrationModal may not need it)?
- Do we need metaKey (macOS) parity everywhere (some modals use ctrlKey only)?
- Any modals intentionally omit ESC (e.g., blocking flows) or should policy be absolute?
