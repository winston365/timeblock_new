---
ID: 56
Origin: 56
UUID: 9f3d7a1c
Status: Planned
---

# Value Statement and Business Objective
- Understand the current "temporary schedule" (임시 스케줄) behavior, flows, and instrumentation to inform ROI proposals and identify friction points without altering code.

## Objective
- Map data model, persistence, and UI flows for temp schedule (creation, viewing, applying/templating, conversion to real tasks).
- Surface UX constraints, hotkeys, and sync/logging hooks relevant to cost/benefit estimation.
- Record gaps needing follow-up validation.

## Context
- Temp schedule is a parallel scheduling surface separated from main tasks. It lives in Dexie (primary) with Firebase sync fallback and Google Calendar publishing via event bus.
- UI is modal-based with day/week/month views, task list, creation/edit modals, templates, and drag interactions.

## Methodology
- Reviewed source: src/shared/types/tempSchedule.ts; src/data/repositories/tempScheduleRepository.ts; src/features/tempSchedule/TempScheduleModal.tsx; components (AddTempScheduleTaskModal, TempScheduleTimelineView, WeeklyScheduleView, MonthlyScheduleView, TempScheduleTaskList, TempScheduleContextMenu, TemplateModal); store: src/features/tempSchedule/stores/tempScheduleStore.ts; subscriber: src/shared/subscribers/googleSyncSubscriber.ts.
- Reviewed tests: tests/temp-schedule-date-parsing.test.ts; tests/temp-schedule-date-utils.test.ts; tests/temp-schedule-should-show-on-date.test.ts.

## Findings (facts)
- Data model: TempScheduleTask with recurrence (none/daily/weekly/monthly/custom), optional scheduledDate (one-off) and favorite flag; GridSnapInterval defaults to 15 minutes; default color palette defined.
- Persistence: Dexie table tempScheduleTasks is primary; loadTempScheduleTasks normalizes start/end time, logs via addSyncLog, falls back to Firebase fetch when local empty; saves/add/update/delete trigger withFirebaseSync(syncTempScheduleToFirebase). Templates stored in db.systemState under key tempScheduleTemplates.
- Sync/logging: Event bus emits tempSchedule:created/updated/deleted from repository; googleSyncSubscriber listens and mirrors tasks to Google Calendar (tempScheduleCalendarMappings) with summary prefix "[임시]". addSyncLog used for Dexie/Firebase actions.
- Visibility logic: shouldShowOnDate normalizes ISO or YMD, applies recurrence rules with local date parsing; loadTempScheduleTasksForDate/Range filter via shouldShowOnDate. Tests guard against Date('YYYY-MM-DD') UTC parsing and invalid dates.
- UI shell: TempScheduleModal opens with useModalEscapeClose; keyboard shortcuts (N add, D/W/M view switch, T today, Arrow prev/next) disabled when sub-modals open. Header controls view mode, date navigation, day-view grid snap select, template button; ESC/backdrop close via hook.
- Day view: TempScheduleTimelineView shows main schedule snapshot on left 12% (read-only) and temp blocks on right; supports drag-create (creates block with default name then opens edit modal), drag move/resize with snap, context menu (duplicate, promote to real task/inbox, color change, delete), current-time shading. Uses store drag state.
- Week view: WeeklyScheduleView calculates week dates (Monday start), lists blocks per day with hover preview, drag-and-drop to move tasks between days (recurrence set to none on move), clicking day opens day view and add modal.
- Month view: MonthlyScheduleView builds month grid, shows per-day summaries and popover on hover; stats panel (total, today, upcoming, activity days, upcoming list) derived client-side.
- Task list: TempScheduleTaskList groups one-off tasks by recency buckets (today/tomorrow/this week/later/past) and recurring separately; shows in-progress/imminent chips, D-day labels, memo snippet; buttons for edit/delete; “+ 추가” opens add modal.
- Creation/edit modal: AddTempScheduleTaskModal uses useModalHotkeys (Enter primary, ESC close); supports recurrence config, date only for non-repeating, color palette, favorite toggle, memo, delete when editing. Validates name non-empty and end > start.
- Templates: TemplateModal saves current selectedDate tasks as template (requires tasks); applyTemplate clones tasks to selected date with recurrence none; remove supported. Hotkeys via useModalHotkeys and ESC close.
- Conversion: Context menu supports promoteToRealTask → creates inbox task via dailyDataStore with emoji 📅, duration defaults (30), memo from temp task; temp task not auto-removed.

## Findings (hypotheses/risks)
- No explicit persistence or surface for linking promoted tasks back to temp schedule; potential orphan/stale temp entries after promotion.
- Drag-create uses default name "새 스케줄" and immediate modal; if modal closed without save logic, task already exists (created before edit) — could lead to clutter.
- Recurrence move in week view forces recurrence to none, possibly unexpected for users wanting to shift a single occurrence.
- Grid snap setting stored in settingsRepository; unclear default load latency or UX when missing setting (falls back to 15).
- Month stats derived client-side per render; performance risk with large datasets but likely minor.

## Analysis Recommendations (next-depth checks)
- Verify end-to-end persistence paths: Dexie schema versions and firebase strategy for tempScheduleTasks, including template storage size and migrations.
- Trace promoteToRealTask flow for id collisions and event bus notifications (none emitted); confirm whether analytics/logging captures promotions.
- Observe drag-create/edit cancellation behavior in day view to quantify accidental clutter rate; instrument if not present.
- Validate recurrence rules against edge cases (e.g., intervalDays with endDate, timezone shifts) beyond current unit tests.
- Confirm modal accessibility (focus traps) and whether useModalHotkeys respects disabled inputs during data entry.

## Open Questions
- Are temp schedule tasks expected to auto-archive/delete after promotion or completion? Current code leaves them.
- Should week view drag maintain recurrence (single-occur override) vs. resetting to none? Product decision needed.
- Is Google Calendar sync mandatory for temp schedule or optional per user setting? Current subscriber checks isGoogleCalendarEnabled only.
- Any constraints on max templates count or cleanup strategy? Not enforced in repository.

## Changelog
- 2026-01-02: Initial analysis drafted from code/tests for temp schedule feature.
- 2026-01-02: Planned — ROI 제안서 문서 생성: agent-output/planning/056-temp-schedule-20-proposals-roi.md
