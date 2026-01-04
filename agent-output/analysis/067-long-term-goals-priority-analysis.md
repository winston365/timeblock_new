---
ID: 67
Origin: 67
UUID: 4c3e2a1f
Status: Active
---

# Value Statement and Business Objective
- User wants long-term goals to support numeric priority so higher-priority items (lower number) surface first, reducing cognitive load for weekly planning and ADHD-friendly triage.

# Changelog
- 2026-01-04: Initial analysis of long-term goals data model, store, UI, and ordering.

# Objective
- Map all touchpoints for long-term goals (type, storage, UI) and current ordering logic to prepare for adding a priority field and priority-based sorting.

# Context
- Long-term goals correspond to the `WeeklyGoal` domain entity and are managed via Dexie, optional Firebase sync, a Zustand store, and React UI components (panel, card, modal).

# Methodology
- Read domain types, Zustand store, repository, and goals UI components.
- Searched for "WeeklyGoal", 장기목표 keywords across shared types, stores, repositories, and feature components.

# Findings (facts)
- Domain type: `WeeklyGoal` defines id/title/target/unit/currentProgress plus metadata `icon`, `color`, and ordering field `order`; no priority field exists. See [src/shared/types/domain.ts](src/shared/types/domain.ts#L544-L568).
- Store ordering: `useWeeklyGoalStore` loads, adds, and reorders goals by sorting on `order` ascending after each mutation. See [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts#L64-L125).
- Repository ordering: `loadWeeklyGoals` fetches Dexie `weeklyGoals` ordered by `order`; `addWeeklyGoal` assigns `order` = current length; `reorderWeeklyGoals` rewrites `order` sequentially. See [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts#L124-L352).
- UI rendering: Weekly goals are taken from the store, optionally filtered (today-only), then rendered in a grid via `WeeklyGoalCard` with no extra sorting; order from store controls display. See [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx#L232-L289).
- Creation/editing UI: `WeeklyGoalModal` collects title/target/unit/icon/color/theme and calls `addGoal`/`updateGoal`; no priority input. See [src/features/goals/WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx#L72-L144).

# Root Cause
- Current ordering relies solely on `order` (manual sequence); no domain or UI support for a numeric priority, so priority-based display is impossible without schema and sorting changes.

# Analysis Recommendations (further inquiry)
- Confirm Dexie schema expectations for adding a new numeric field (likely schemaless, but verify `db.weeklyGoals` usage and tests).
- Inspect Firebase `weeklyGoalStrategy` shape to ensure sync payloads include any new field and to detect backward-compat considerations.
- Review tests covering weekly goals (e.g., weekly-goals-utils/system-state) to see where ordering assumptions exist before altering sort logic.

# Open Questions / Gaps
- Does any external consumer (sync strategies, analytics) assume `order` semantics that would conflict with a priority sort?
- Are there UI expectations around manual drag reorder that must coexist with priority?
- Should priority default be derived from existing `order` values during migration?
