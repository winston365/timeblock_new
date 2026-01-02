---
ID: 56
Origin: 56
UUID: 7c2e9b1f
Status: Planned
---

# Value Statement and Business Objective
- Enable mapping for temp schedule improvements (A1, A3, A6, A7, B2, C1, C4) so frontend-only delivery can proceed without backend/IPC changes while preserving ADHD-friendly UX and modal/shortcut constraints.

# Changelog
- 2026-01-02: Created initial mapping after code inspection of temp schedule views, store, repository, and template handling.
- 2026-01-02: Planned — Implementer plan created in agent-output/planning/056-temp-schedule-selected7-implementation-plan.md.

# Objective
- Identify exact components, call chains, and insertion points for the selected improvements; highlight conflicts and open questions to unblock planning/implementation.

# Context
- Temp schedule UI is hosted in the main modal with day/week/month views plus list and template modals. State flows through `useTempScheduleStore`; persistence via `tempScheduleRepository` (Dexie + optional Firebase sync); templates stored in `db.systemState` under `tempScheduleTemplates`. Command palette/inline edit patterns are not present elsewhere in the codebase.

# Methodology
- Code read: src/features/tempSchedule/TempScheduleModal.tsx; components (TempScheduleTimelineView, WeeklyScheduleView, MonthlyScheduleView, TempScheduleTaskList, TempScheduleContextMenu, AddTempScheduleTaskModal, TemplateModal); store tempScheduleStore; repository tempScheduleRepository; shared/types/tempSchedule; shared/stores/dailyDataStore. Project search for palette/inline-edit patterns and contentEditable usage.

# Findings (facts)
1) View/render surfaces
   - Day view timeline + context menu: src/features/tempSchedule/components/TempScheduleTimelineView.tsx renders blocks and attaches context menu open and drag handlers; left-side main snapshot overlay is read-only.
   - Week view grid: src/features/tempSchedule/components/WeeklyScheduleView.tsx renders TaskBlock per day; click opens edit modal; drag/drop moves tasks between dates.
   - Month view grid + hover popover: src/features/tempSchedule/components/MonthlyScheduleView.tsx handles summaries and “일간 보기” jump.
   - List panel: src/features/tempSchedule/components/TempScheduleTaskList.tsx renders grouped TaskItem cards with hover edit/delete buttons; no inline editing.
   - Template management: src/features/tempSchedule/components/TemplateModal.tsx renders list and save/apply/delete actions; launched from main modal header button.
   - Main modal shell + hotkeys: src/features/tempSchedule/TempScheduleModal.tsx; keyboard shortcuts N/D/W/M/T/←/→; ESC via useModalEscapeClose; opens Add/Template modals.

2) Promote call chain (A1 injection point)
   - Trigger: context menu action in src/features/tempSchedule/components/TempScheduleContextMenu.tsx calls store.promoteToRealTask then closes.
   - Store implementation: src/features/tempSchedule/stores/tempScheduleStore.ts (promoteToRealTask around L234-L269) dynamically imports dailyDataStore and utils.generateId, creates inbox-style Task (emoji 📅, durations preset), adds via useDailyDataStore.addTask; does **not** delete or mark source temp task after promotion.
   - Downstream: useDailyDataStore.addTask persists via repositories and emits events (no temp-schedule-specific cleanup). A1 handling (delete/move/archive) must hook near promoteToRealTask and/or caller before returning to avoid dangling temp task.

3) Inline edit patterns (A3)
   - No shared inline-edit component or contentEditable usage tied to temp schedule; repository search shows only keyboard guards around contentEditable elsewhere.
   - Current edit affordances: timeline block double-click → openTaskModal; week TaskBlock click → openTaskModal; list TaskItem click → openTaskModal; no in-place editors. Potential insertion points: TimelineBlock body, Week TaskBlock, TaskItem header to swap to small inline form for name/time/color while preserving modal escape behavior.

4) Recurrence handling and week-move regression (A6)
   - Type shape: RecurrenceRule (type, weeklyDays, intervalDays, endDate) in src/shared/types/tempSchedule.ts; editing occurs in AddTempScheduleTaskModal.
   - Week drag/drop: WeeklyScheduleView.handleDrop (around L441-L466) calls updateTask with scheduledDate target and **recurrence forcibly set to { type: 'none', weeklyDays: [], intervalDays: 1, endDate: null }**, which clears patterns on move.
   - Add/update pipeline otherwise preserves recurrence (updateTempScheduleTask merges updates). Safe FE-only mitigation could wrap handleDrop with user choice/toast/undo to avoid silent reset; recurrence edits are isolated to client state/Dexie (no backend coupling).

5) Templates storage/render (A7)
   - Storage: tempScheduleRepository loadTemplates/saveTemplate/deleteTemplate/applyTemplate (around L461-L534) read/write `tempScheduleTemplates` in db.systemState; tasks saved with recurrence forced to none and favorite preserved.
   - UI: TemplateModal lists templates and applies via store.applyTemplateToDate (adds tasks into state) then reloads; no favorites/pin concept yet.
   - Pinned IDs could live in systemState (same record or parallel key) without schema migration; UI hooks: TemplateItem render and header “템플릿” button in TempScheduleModal.

6) Quick actions / command palette (B2, C1)
   - Existing quick actions: context menu offers promote/duplicate/color/delete; list TaskItem hover shows edit/delete; no hover quickbuttons on timeline/week blocks; no command palette/quick-action overlay found (palette search empty).
   - Hotkeys in scope: TempScheduleModal intercepts N/D/W/M/T/←/→ when task/template modals closed; ESC closes modals via hooks. Palette trigger must avoid these keys and remain renderer-only (per constraint).

7) Color semantics (C4)
   - Color usage: timeline blocks have solid background; week blocks use tinted background + colored text/border; month view shows color dots + tinted chips; list view uses colored stripe and tinted badges; recurrence indicated by Repeat icon (day) and text (list); favorites use ★.
   - Current state heavily color-dependent; icons/text already exist for recurrence/favorite but not for status/duration. Augmenting with icon/text labels or patterned borders can piggyback on existing block components without layout overhaul.

# Analysis Recommendations (next analysis steps)
- Confirm desired default for A1 (delete vs archive/keep) and whether “archive” maps to hiding in temp list; map UX for undo vs immediate delete before coding.
- Decide inline-edit scope (fields + which surfaces) to size A3 and choose interaction pattern (inline form vs popover) while honoring modal hotkey rules.
- Define A6 UX (prompt vs toast/undo) and whether moving recurring tasks should optionally keep recurrence when target date matches rule.
- Specify data shape for template pinning (new systemState key vs augment existing template objects) and any pin sort order expectations.
- Choose command palette trigger/hotkeys that avoid existing N/D/W/M/T and modal ESC, and define action set limited to temp-schedule context.
- Identify icon/text vocabulary for C4 (e.g., duration badges, recurrence chips) to verify minimal visual additions suffice.

# Open Questions / Gaps
- What is the exact “임시함/아카이브” behavior for A1 (hidden flag vs hard delete)?
- Should inline edit also support recurrence/memo or strictly name/time/color?
- For A6, is “this occurrence vs all” required now, or is a softer “move this occurrence only” plus info acceptable?
- Pinning scope: per-device only (Dexie) vs future sync; does pin affect template ordering only or also default selection on open?
- Command palette scope: temp-schedule modal only or global? Which actions/highlights are mandatory in MVP?