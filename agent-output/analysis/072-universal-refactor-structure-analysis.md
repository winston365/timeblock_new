---
ID: 72
Origin: 72
UUID: c134fd8b
Status: Active
---

# Value Statement and Business Objective
- Expose structural refactoring hotspots (size, mixed responsibilities, coupling, duplication) to reduce cognitive load and speed up future feature work while keeping data integrity intact.

# Objective
- Audit src/shared/services, src/shared/stores, src/data/repositories, src/features, src/shared/utils for oversized files, god objects, long procedures, utility dumps, and duplicated logic. No code changes; report only.

# Context
- No target file exceeds 600 LOC (highest 567). Several files in the 500–560 LOC range carry mixed concerns and deep coupling.
- Prior memos flagged repository typing drift and sync coupling; this scan adds size/mix evidence.

# Methodology
- Counted LOC for all TS/TSX files in target dirs (PowerShell Get-Content).
- Grabbed symbol overviews for largest files; read representative slices of ScheduleView, unifiedTaskService, googleCalendarService, TaskBreakdownModal, BulkAddModal, idleFocusModeService, battleRepository.
- Classified responsibility (View/Logic/Mixed), coupling, and mapped to scenarios A (god object), B (long procedure), C (utility dump), D (duplicated logic).

# Findings
## File inventory (high-risk subset)
| File | LOC | Responsibility | Coupling | Priority | Scenario |
| --- | --- | --- | --- | --- | --- |
| src/features/schedule/ScheduleView.tsx | 567 | Mixed (UI + repo fetch + sync + auto warmup insertion) | High | Critical | A/B |
| src/features/schedule/components/FocusView.tsx | 566 | Mixed (UI + media timers + task mutations) | High | High | A/B |
| src/shared/services/task/unifiedTaskService.ts | 562 | Logic (repo + store bridging, optimistic + non-optimistic flows) | High (dynamic imports hint cycle) | Critical | A/B |
| src/features/settings/components/tabs/battle/BattleMissionsSection.tsx | 557 | Mixed (UI + slot editing, mission CRUD orchestration) | High | High | A/B |
| src/shared/services/calendar/googleCalendarService.ts | 553 | Logic (OAuth, token refresh, IPC, mapping) | High | High | B |
| src/features/tasks/TaskBreakdownModal.tsx | 550 | Mixed (UI + AI parse/confirm logic) | High | High | A/D |
| src/features/tasks/hooks/useInboxHotkeys.ts | 539 | Logic (keyboard routing, DOM focus mgmt) | Med-High | High | B |
| src/features/waifu/WaifuPanel.tsx | 534 | Mixed (UI + random feedback logic) | Medium | Medium | A |
| src/shared/services/behavior/idleFocusModeService.ts | 525 | Mixed (pure calc + timers + toasts + store writes) | High | High | A/B |
| src/features/tempSchedule/components/TempScheduleTimelineView.tsx | 517 | Mixed (UI + drag/drop math + popup state) | High | High | A/B |
| src/data/repositories/battleRepository.ts | 514 | Logic (Dexie + Firebase sync + defaults + migration) | High | High | B/C |
| src/features/tasks/BulkAddModal.tsx | 507 | Mixed (UI + parser) | High | High | D |
| src/shared/services/rag/autoTagService.ts | 490 | Logic (similarity calc, suggestions) | Medium | Medium | B |
| src/features/weather/services/weatherApi.ts | 469 | Logic (fetch + parsing) | Medium | Medium | B |
| src/features/weather/services/weatherService.ts | 466 | Logic (LLM prompt/parse on weather) | High (Gemini + API) | Medium | B |

## God-object / mixed-responsibility hotspots
- ScheduleView bundles rendering with data refresh, Firebase sync, Dexie systemState reads, auto warmup insertion timers → candidate for splitting view vs scheduling/sync orchestration.
- FocusView mixes UI with music player control, task promotion, inline editing.
- TaskBreakdownModal and BulkAddModal combine modal UI, parsing, validation, and task creation side effects.
- IdleFocusModeService combines pure calc, store access, timers, and toast UI in one file.
- BattleMissionsSection contains both mission list UI and heavy slot-edit/save logic inline.

## Long procedures (examples observed)
- ScheduleView auto warmup insertion interval and past-block migration flow span multiple branches in one effect.
- unifiedTaskService find/update/move flows stack repo calls + store refresh + optimistic branches.
- googleCalendarService login/refresh/access-token flow handles IPC, token persistence, and retry logic in one procedure.
- TaskBreakdownModal/BulkAddModal handleSubmit pipelines perform parsing → task shaping → persistence within single callbacks.

## Utility dump / duplication signals
- TaskBreakdownModal vs BulkAddModal share constants (modal classes, resistance labels, duration options) and parsing-to-task pipelines with slight variance → scenario D.
- battleRepository layers Dexie persistence, Firebase sync, migration defaults, and logging in one module (borderline utility dump for battle domain).
- weatherApi vs weatherService split API parsing vs insight/LLM prompting but both contain parsing/mapping logic; overlap suggests need for shared formatter layer.

## Dependency and coupling observations
- unifiedTaskService uses dynamic imports for stores to avoid cycles; depends on both daily/inbox repositories and stores for refresh → circular-risk hotspot.
- ScheduleView imports multiple stores/services (settings, focus, waifu, Firebase sync) and repositories directly; UI tightly coupled to data layer.
- battleRepository and googleCalendarService depend on Firebase sync utilities; both act as orchestrators rather than thin repos.
- weatherService pulls in Gemini/AI inference over weatherApi output → tight coupling between network and LLM parsing in one file.

## Criteria status
- Files >600 LOC: none in targeted dirs. Closest: ScheduleView (567), FocusView (566), unifiedTaskService (562), BattleMissionsSection (557).

# Analysis Recommendations (next investigative steps)
- Measure function-level lengths for top files to pinpoint >50-line procedures and quantify nesting depth (e.g., effects in ScheduleView, optimistic/non-optimistic branches in unifiedTaskService).
- Diff TaskBreakdownModal vs BulkAddModal to inventory shared parsing/UI pieces and confirm extractable shared module vs divergence points.
- Trace import graph around unifiedTaskService/dailyDataStore/inboxStore to confirm actual cycles and propose boundaries (service vs store responsibilities).
- Sample runtime call paths for ScheduleView timers/warmup insertion to assess side-effect ordering and identify candidates for dedicated scheduler module.
- Review battleRepository mission/setting/state flows for possible split into persistence vs sync vs migration helpers.

# Open Questions
- Do ScheduleView/FocusView have existing store subscribers that could own auto-move/warmup logic instead of the component? (needs call graph review.)
- How much of googleCalendarService token logic is reused by other integrations (Google Tasks, etc.)? Would an auth client wrapper reduce duplication? (requires cross-file scan.)
- Are weatherApi and weatherService duplicating parsing/formatting rules? Need structured diff to confirm.
- Are store modules (waifuCompanionStore, gameStateStore, settingsStore) hiding additional long procedures or coupling hotspots? Only LOC sampled; no deep read yet.

# Changelog
- 2026-01-05: Initial structural scan, LOC inventory, high-risk classification, and scenario mapping recorded.
