---
ID: 54
Origin: 54
UUID: de4f2a9b
Status: Active
---

## Changelog
- 2026-01-02: Created code-surface analysis for weekly goals proposals F3–F10 + U1–U5.

## Value Statement and Business Objective
Weekly goals are the core long-horizon structure for the app; improving resilience (catch-up, reset clarity), clarity (filters, guardrails), and context (theme/project linkage) should reduce user drop-off after mid-week slips and increase completion reliability for ADHD users.

## Objective
Map where to implement the ten requested UI-only improvements (F3, F5, F8, F9, F10, U1–U5), identify reusable patterns, note any data-model changes, and surface sequencing plus risks before coding.

## Context
- Weekly goal UX lives in [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) → [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) → [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) with progress bar [src/features/goals/WeeklyProgressBar.tsx](src/features/goals/WeeklyProgressBar.tsx) and history modal [src/features/goals/WeeklyGoalHistoryModal.tsx](src/features/goals/WeeklyGoalHistoryModal.tsx).
- Catch-up system: severity calc [src/features/goals/utils/catchUpUtils.ts](src/features/goals/utils/catchUpUtils.ts), banner hook [src/features/goals/hooks/useCatchUpAlertBanner.ts](src/features/goals/hooks/useCatchUpAlertBanner.ts), banner UI [src/features/goals/components/CatchUpAlertBanner.tsx](src/features/goals/components/CatchUpAlertBanner.tsx); snooze/dismiss persisted via systemState (CATCH_UP_SNOOZE_STATE) in systemRepository (not yet modified here).
- Store/repo: Zustand store [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) wraps repository [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts); weekly reset archives last week into history and zeroes progress; goal history retained for 5 weeks via GOAL_HISTORY.MAX_WEEKS; quota toast hook [src/features/goals/hooks/useQuotaAchievement.ts](src/features/goals/hooks/useQuotaAchievement.ts) persists daily quota achievements in systemState.
- Data types: WeeklyGoal/WeeklyGoalHistory in [src/shared/types/domain.ts](src/shared/types/domain.ts#L500-L560); Dexie schema v17 with weeklyGoals table (id, weekStartDate, order) in [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts#L160-L210). Defaults file has catch-up snooze values only; no weekly-goal filter defaults.

## Root Cause
Requested features have no mapped entry points yet (e.g., theme/project, undo, filter state). Existing UI is dense, with multiple progress inputs but limited guardrails, and catch-up messaging skews urgent. Need structured file/symbol plan before implementation.

## Methodology
Reviewed UI components, hooks, store, repository, constants, and domain types for weekly goals: GoalsModal, WeeklyGoalPanel/Card/ProgressBar/HistoryModal/Modal, catchUp utils + hook + banner, quota hook, weeklyGoalStore, weeklyGoalRepository, defaults, dexieClient, domain types.

## Findings
### Current behavior (facts)
- Progress controls: +/- buttons, direct input, quick log; no undo; setProgress accepts arbitrary number without guard beyond non-negative; animations but no toast except quick log.
- Catch-up: banner uses severity bins (safe/warning/danger), snooze (systemState), dismiss for day; reopen button shows when hidden but behind goals exist.
- Weekly reset: loadWeeklyGoals checks weekStartDate and calls resetWeeklyGoals to archive history and zero progress; history modal shows last 5 weeks with average/completed counts and current-week radial.
- Filters/state: no goal-level filter or “today only” filter; compact mode is a per-card toggle (isExpanded) only inside card, not a global mode.
- Data model: WeeklyGoal lacks theme/project linkage, dailyProgress is unused, no dedicated fields for guard/undo state. SystemState keys include catch-up and quota-achievement only.

### Feature-level touchpoints (facts + needed targets)
- F3 “실패 내성” 0.5x catch-up: catch-up severity/info sits in calculateCatchUpInfo; banner CTA opens CatchUpAlertModal from WeeklyGoalPanel. Reopen button exists. Will need a new CTA on banner/modal and goal-level restart action wired through weeklyGoalStore/updateProgress/setProgress.
- F5 weekly reset summary card: resetWeeklyGoals archives history; HistoryModal shows stats per goal. No surface in WeeklyGoalPanel/GoalsModal for new-week summary or cross-goal history CTA.
- F8 “오늘만 보기” filter: no store state for filter; WeeklyGoalPanel renders all goals; getTodayTarget/getDailyTargetForToday available for “today quota > 0” predicate.
- F9 progress guard + undo: WeeklyGoalCard direct input and quick update call updateProgress/setProgress immediately; no confirmation or undo; toastStore available; no undo queue/state.
- F10 theme/project linkage: WeeklyGoal type lacks theme/project fields; Dexie schema has no indexes for them; UI lacks label/filter controls.
- U1 compact info: WeeklyGoalCard already has compact prop from panel; isExpanded toggles quick controls; progress/status chips still dense. No global “mini mode.”
- U2 reset visibility: day labels in WeeklyGoalPanel and WeeklyProgressBar show current day; no explicit “week start” chip; history modal explains but not in main list.
- U3 catch-up banner tone: banner uses urgent gradients and message “집중이 필요한 목표”/“조금만 더 힘내봐요”; buttons are 보기/나중에/닫기; no copy for supportive tone.
- U4 history insight 3 lines: HistoryModal already shows completed count, average %, max progress, but not “best week” label or “consistent theme” aggregation.
- U5 Add/Edit modal 2-step: WeeklyGoalModal is single-step with inputs for title/target/unit/icon/color; no stepper or validation gating beyond simple alerts.

### Reusable patterns/hooks (facts)
- Modal hotkeys + escape stack: useModalHotkeys, modalStackRegistry already used in banner popover and modals.
- Toast infra: useToastStore in card; react-hot-toast via useQuotaAchievement.
- SystemState persistence: catch-up snooze and quota achievements via systemRepository + SYSTEM_KEYS; pattern can persist filters/undo.
- Severity/text badge pattern: goalConstants + GoalStatusTooltip for consistent messaging.

### Data model considerations (analysis)
- Theme/project fields would require extending WeeklyGoal and repository normalization; Dexie schema does not need index change unless filtering by indexed fields, but version bump may be safer for migrations; Firebase strategy not covered here.
- Undo would need transient store state (not persisted) plus history snapshot; no existing structure.
- “Today-only” filter likely stored in systemState for persistence similar to catch-up; defaults file lacks keys.

## Analysis Recommendations (next investigative steps)
- Confirm whether theme/project needs indexed filtering; if yes, plan Dexie version bump and migration; otherwise note optional fields and UI-only filter.
- Decide undo scope (single-step per goal vs global) and TTL to align with store/repo capabilities; prototype state holder in store before UI wiring.
- Define persistent keys for filters/reset cards (systemState defaults) to avoid localStorage.
- Validate whether catch-up “0.5x restart” adjusts target or progress; repository currently only updates progress/target directly.
- Audit Firebase weeklyGoalStrategy expectations if schema changes (outside current scope but impacts compatibility).

## Open Questions
- What semantics for F3 restart: halve remaining target, or halve full target and reset progress? Should history record the restart?
- F10 “theme/project” source of truth: free text, limited presets, or linked to existing task projects? Does filtering combine with “오늘만 보기”?
- Undo window for F9: 5 seconds per action (single revert) or stack? Does undo reverse both updateProgress and setProgress?
- Weekly reset card (F5/U2): should it show aggregate across goals or per-goal summary, and when does it disappear?
- Compact mode scope (U1): global toggle or per-card default? Should it persist in systemState?
