---
ID: 70
Origin: 70
UUID: 9e4b2d71
Status: Planned
---

# Value Statement and Business Objective
Identifying monolithic and mixed-responsibility files is a prerequisite to safely refactoring TimeBlock Planner. Targeting the worst offenders first reduces defect risk during upcoming feature work (schedule, templates, goals) and improves testability for sync-heavy flows.

# Changelog
- 2026-01-05: Initial structural scan of src (LOC, long functions, external deps) and sampling of top offenders.
- 2026-01-05: Planned — Created 3-phase refactoring plan: agent-output/planning/070-refactor-3phase-refactoring-plan-v1.0.md

# Objective
Surface a prioritized list of refactor hotspots (god objects, mixed view/logic, long procedures, utility dumps, duplication) in src/ to guide Planner toward the highest-value structural splits.

# Context
- Stack: React 18 + TS, Electron client-only, Zustand stores, Dexie primary persistence with Firebase sync.
- Policies: No backend/Electron IPC changes in this phase; Dexie over localStorage (theme exception); ESC closes modals via useModalEscapeClose; repository pattern for data access.
- Scope: src/** only; tests and .d.ts excluded.

# Methodology
- Automated scan (Node + TypeScript AST) across 353 src TS/TSX files, excluding tests and .d.ts. Captured LOC, import counts, external import counts, and functions >50 lines. Results stored at agent-output/analysis/refactor-scan.json.
- Manual spot-reads of representative large files to verify mixed responsibilities (view + logic) and store god-object patterns: [features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx#L1-L141), [shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts#L1-L141), [data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts#L1-L141), [features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx#L1-L141).
- Duplication check via string search (e.g., parseInput appearing in multiple task modals).

# Findings (facts, ordered by priority)
## Priority 1 — Critical (UI+logic files >600 LOC with long procedures)
- [features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx#L1-L827) — 827 LOC; Scenario A/B (god object + 777-line component). Mixes rendering, store coordination, drag/drop handling, repo calls, and HUD logic. Imports: 16 (1 external).
- [features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx#L1-L711) — 711 LOC; Scenario A/B. Multi-step form UI entwined with validation, repository calls, and category management. Imports: 7 (2 external).
- [features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx#L1-L679) — 679 LOC; Scenario A/B. Template listing UI plus selection, pagination, and mutation logic. Imports: 10 (2 external).
- [features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx#L1-L693) — 693 LOC; Scenario A/B. Renders weekly goal card while mutating goal state and XP; 634-line render/logic block. Imports: 12 (1 external).
- [features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx#L1-L663) — 663 LOC; Scenario A/B. Large task editor modal handling validation, recurrence, and persistence in-component. Imports: 12 (1 external).
- [features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx#L1-L842) — 842 LOC; Scenario A/B. Renders weekly grid and also groups tasks, handles drag/drop and selection logic. Imports: 11 (2 external).
- [features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx#L1-L804) — 804 LOC; Scenario A/B. Timeline UI with embedded positioning math and state transitions. Imports: 12 (2 external).
- [features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx#L1-L678) — 678 LOC; Scenario A/B. List UI plus grouping, filtering, and selection logic. Imports: 5 (1 external).
- [features/insight/DailySummaryModal.tsx](src/features/insight/DailySummaryModal.tsx#L1-L781) — 781 LOC; Scenario A/B. Modal mixes AI request orchestration, downloads, and rendering. Imports: 11 (4 external).
- [features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx#L1-L689) — 689 LOC; Scenario A/B. UI plus stat aggregation, selection, and modal coordination. Imports: 7 (1 external).

## Priority 2 — High (god objects >400 LOC or heavy coupling)
- [features/battle/stores/battleStore.ts](src/features/battle/stores/battleStore.ts#L1-L1031) — 1031 LOC; Scenario A (god object) with 488-line anonymous slice and multiple 60–117 line helpers; centralizes combat, spawn, rewards, timers. Imports: 6 (1 external).
- [shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts#L1-L729) — 729 LOC; Scenario A (god object) and long procedures (629-line store initializer). Mixes CRUD, XP/quest pipelines, behavior tracking. Imports: 12 (1 external).
- [data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts#L1-L649) — 649 LOC; Scenario A/B. Sync engine with 227-line startListening and multiple queue helpers; tight coupling to Dexie, Firebase, toast store. Imports: 11 (1 external).
- [shared/types/domain.ts](src/shared/types/domain.ts#L1-L706) — 706 LOC; Scenario A (type monolith). Centralized domain shape; changes ripple widely.
- [features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx#L1-L568) — 568 LOC; Scenario A/B. Single component drives scheduling UI and interactions. Imports: 19 (1 external).
- [features/schedule/components/FocusView.tsx](src/features/schedule/components/FocusView.tsx#L1-L567) — 567 LOC; Scenario A/B with embedded timer/hero task logic. Imports: 15 (2 external).
- [features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx#L1-L551) — 551 LOC; Scenario B (459-line component) with parsing logic in-view. Imports: 7 (1 external).
- [features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx#L1-L508) — 508 LOC; Scenario B (434-line component) plus parsing logic. Imports: 4 (1 external).
- [features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts#L1-L540) — 540 LOC; Scenario A/B. Hotkey handler mixes view concerns (navigation) and data mutations. Imports: 8 (1 external).
- [features/weather/WeatherWidget.tsx](src/features/weather/WeatherWidget.tsx#L1-L582) — 582 LOC; Scenario A/B. UI plus fetch, parsing, and caching logic. Imports: 6 (2 external).
- [shared/services/calendar/googleCalendarService.ts](src/shared/services/calendar/googleCalendarService.ts#L1-L554) — 554 LOC; Scenario A/B. Service with long API helpers (71–59 lines) and transformation logic intertwined.
- [shared/services/task/unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts#L1-L563) — 563 LOC; Scenario A. Aggregates task orchestration; multiple responsibilities.

## Priority 3 — Medium (utility dumps, duplication, long helpers)
- Utility concentration: [shared/lib/logger.ts](src/shared/lib/logger.ts#L1-L260) and [shared/lib/notify.ts](src/shared/lib/notify.ts#L1-L239) bundle diverse concerns (formatting, transports, undo toasts) without separation; risk of silent coupling.
- Duplication: `parseInput` appears in both [features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx#L170-L228) and [features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx#L203-L267) with similar parsing responsibilities.
- Large single-function helpers: [shared/services/behavior/idleFocusModeService.ts](src/shared/services/behavior/idleFocusModeService.ts#L1-L526) and [shared/services/rag/autoTagService.ts](src/shared/services/rag/autoTagService.ts#L1-L491) carry multiple behaviors in flat files (risk of utility dump drift).
- Calendar/weather service pair ([shared/services/calendar/googleTasksService.ts](src/shared/services/calendar/googleTasksService.ts#L1-L227), [features/weather/services/weatherService.ts](src/features/weather/services/weatherService.ts#L1-L467)) mix API calls and parsing in the same files, suggesting split between transport and shaping utilities.

# Analysis Recommendations (next analysis steps)
1) Deep-dive call graphs for Priority 1 components to map view vs data boundaries and quantify hook/repo touchpoints before planning splits.
2) Trace state ownership for battleStore and dailyDataStore (Priority 2) to identify slices that can be decoupled or moved behind repositories/services.
3) Run structural similarity on duplicate helpers (e.g., parseInput variants) to confirm safe consolidation points.
4) Build dependency graph for shared/types/domain.ts consumers to gauge blast radius of moving types into feature-scoped modules.
5) Capture UI/logic coupling metrics (JSX vs non-JSX lines) for top .tsx files to validate mixed-responsibility classification quantitatively.

# Open Questions / Gaps
- Are any Priority 1 components slated for near-term feature changes that would affect refactor sequencing?
- Which of the identified files lack current test coverage (esp. battleStore, syncEngine, InboxTab), and what harnesses exist to exercise them?
- For weather/calendar services, is there an existing HTTP abstraction layer we should measure against to avoid re-implementing transport logic?
- How much of shared/types/domain.ts can be feature-scoped without breaking sync strategies or repositories?
