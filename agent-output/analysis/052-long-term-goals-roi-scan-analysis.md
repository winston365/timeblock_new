---
ID: 52
Origin: 52
UUID: b8d3c4e1
Status: Active
---

# Changelog
- 2026-01-01: Initial code scan of long-term/weekly goal flows, persistence, and UX hooks.

# Value Statement and Business Objective
Establish a fact-based picture of TimeBlock Planner’s long-term (weekly) goal system so we can target high-ROI, ADHD-friendly improvements that strengthen motivation, reduce friction, and keep the local-first promise while staying compatible with existing patterns.

# Objective
Provide the Planner with a concise snapshot of current capability, constraints/risks, opportunity areas, and prioritization axes to shape 20 high-ROI proposals (feature/UI/accessibility) without solutioning yet.

# Context (what was inspected)
- UI: Goals modal + weekly goal panel/cards/modals, catch-up banner, quota toast hooks ([src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx), [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx), [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx), [src/features/goals/WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx), [src/features/goals/WeeklyGoalHistoryModal.tsx](src/features/goals/WeeklyGoalHistoryModal.tsx), [src/features/goals/components/CatchUpAlertBanner.tsx](src/features/goals/components/CatchUpAlertBanner.tsx), hooks in [src/features/goals/hooks](src/features/goals/hooks)).
- Logic/persistence: Zustand store, repository, domain types, Dexie schema, Firebase strategy ([src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts), [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts), [src/shared/types/domain.ts](src/shared/types/domain.ts), [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts), [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts)).
- System state & tests: goal-related system keys, legacy global-goal guardrail ([tests/weekly-goals-system-state.test.ts](tests/weekly-goals-system-state.test.ts), [tests/global-goals-removal-release-a.test.ts](tests/global-goals-removal-release-a.test.ts)).

# Root Cause / Why analysis is needed
We need grounded evidence on the current weekly goal UX/data flow to propose new ROI-heavy features without breaking local-first constraints, modal/hotkey patterns, or legacy goal clean-up plans.

# Methodology
Static code review of UI components, store/repository layers, Dexie schema versions, sync strategies, and supporting tests; no runtime testing performed.

# Findings (Fact vs Hypothesis)
- Fact: Only weekly goals surface in UI; GoalsModal is single-tab and hosts WeeklyGoalPanel plus add/edit modal. Global goals are hidden; guardrail tests ensure Firebase/subscriber endpoints are absent ([src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx); [tests/global-goals-removal-release-a.test.ts](tests/global-goals-removal-release-a.test.ts)).
- Fact: Weekly goals persist in Dexie v14 `weeklyGoals` and sync via `weeklyGoalStrategy`; repository auto-resets on week change, archiving prior week into history (max ~5 weeks) and Firebase-syncing after CRUD/reorder/reset ([src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts); [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts); [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts)).
- Fact: Store exposes CRUD, progress delta/set, reorder, and date/target helpers; no persistence in store itself; errors captured via `withAsyncAction` but surfaced only in console ([src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts)).
- Fact: Cards show dense controls (quick +/- buttons, direct input, quick log popover, history preview chip, severity badges, today target, quota badge) with keyboard focus support; deletion uses blocking `confirm`, validation uses `alert` in modal ([src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx); [src/features/goals/WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx)).
- Fact: Catch-up flow moved from modal to banner with snooze/dismiss stored in Dexie system state; reopen button provided; catch-up severity uses text badges to avoid color-only cues ([src/features/goals/components/CatchUpAlertBanner.tsx](src/features/goals/components/CatchUpAlertBanner.tsx); [src/features/goals/hooks/useCatchUpAlertBanner.ts](src/features/goals/hooks/useCatchUpAlertBanner.ts); [src/features/goals/constants/goalConstants.ts](src/features/goals/constants/goalConstants.ts)).
- Fact: Quota-achievement hook tracks per-day per-goal completion via system state and shows toast once per day; history modal visualizes up to recent weeks but dailyProgress is not populated (always empty) ([src/features/goals/hooks/useQuotaAchievement.ts](src/features/goals/hooks/useQuotaAchievement.ts); [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts)).
- Fact: Legacy `globalGoals` table still exists in Dexie schema for migration compatibility, though unused in UI ([src/data/db/dexieClient.ts](src/data/db/dexieClient.ts)).
- Hypothesis: Weekly auto-reset may surprise users (silent reset on load) and could feel like data loss if not announced; history depth (5 weeks) may limit long-term insights.
- Hypothesis: High control density and modal stacking (card popovers, quick log, history previews) could overload ADHD users; lack of inline validation and reliance on `alert/confirm` likely adds friction.
- Hypothesis: Absence of global hotkey/quick entry for goals may reduce accessibility; session-focus banner is session-only and not persisted, so value may decay across sessions.

# Analysis Recommendations (next steps to deepen inquiry)
- Observe actual weekly reset flow in-app (with sample data) to confirm UX messaging and history retention; verify whether dailyProgress is ever populated downstream.
- Trace goal access points (toolbar, command palette, hotkeys) in app shell to gauge discoverability and path length to update progress.
- Collect event/telemetry or user feedback (if available) on catch-up banner interactions vs modal to validate ADHD-friendliness and snooze behavior.
- Map current validation/error surfaces across modals/cards and identify where inline, non-blocking cues are missing.
- Verify sync behavior offline/online toggles for weeklyGoalStrategy to ensure local-first resilience under intermittent connectivity.

# Open Questions
- Where is the primary entry point to open Goals (TopToolbar or other)? Is there a global shortcut already reserved elsewhere?
- Do users rely on legacy globalGoals data in migrations, or can history depth be expanded without schema changes?
- Are there analytics or logs on catch-up banner dismiss/snooze usage to prioritize interventions?
- Should daily progress capture exist (currently history dailyProgress stays empty)?
- Any security/perf constraints around Firebase sync frequency for weekly goals?
