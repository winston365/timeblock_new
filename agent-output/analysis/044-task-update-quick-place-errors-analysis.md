Status: Active

# Value Statement and Business Objective
Restore reliable inbox ⇄ schedule flows so users can triage and place tasks without runtime errors or data loss, preventing stalled task updates during focus sessions.

# Objective
Document reproducible scenarios and top hypotheses for the recurring "Task not found" and quick-place/assign TypeErrors, with concrete code touchpoints for implementers.

# Context
- Console logs show repeated "Failed to update task: Task not found: task-*" with DailyDataStore rollback, followed by "Failed to move task ... to inbox".
- Separate errors: "Quick place failed: TypeError: O is not a function" and "Failed to assign to block: TypeError: O is not a function" from built index-*.js.
- Frontend-only scope; dual-storage model: dailyData.tasks vs globalInbox; unifiedTaskService recommended when location unknown.

# Changelog
- 2025-12-28: Initial analysis of task update failures and quick-place runtime errors.

# Methodology
- Code read of inbox quick-place handlers and store wiring in [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx) and [src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts).
- Store definitions reviewed in [src/shared/stores/inboxStore.ts](src/shared/stores/inboxStore.ts) and [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts).
- Repository behavior inspected in [src/data/repositories/dailyData/taskOperations.ts](src/data/repositories/dailyData/taskOperations.ts) and [src/data/repositories/inboxRepository.ts](src/data/repositories/inboxRepository.ts).
- Utility shape checked for task array updates in [src/shared/lib/storeUtils.ts](src/shared/lib/storeUtils.ts).

# Findings (fact vs hypothesis)
- [Fact] Quick-place/assign buttons and hotkeys call `placeTaskToSlot` and `setLastUsedSlot` from `useInboxStore`, but these functions are not defined in the store (store exposes only inbox CRUD). Any call dereferences `undefined` → TypeError. See destructuring in [src/features/tasks/InboxTab.tsx#L34-L80](src/features/tasks/InboxTab.tsx#L34-L80) and [src/features/tasks/hooks/useInboxHotkeys.ts#L34-L78](src/features/tasks/hooks/useInboxHotkeys.ts#L34-L78) versus store definition in [src/shared/stores/inboxStore.ts#L15-L133](src/shared/stores/inboxStore.ts#L15-L133).
- [Fact] The Dexie-backed update path throws "Task not found" when a task ID is absent from both the loaded dailyData and globalInbox. Repository logic confirms this terminal throw. See [src/data/repositories/dailyData/taskOperations.ts#L57-L135](src/data/repositories/dailyData/taskOperations.ts#L57-L135).
- [Hypothesis] Cross-store move with stale/incorrect date: dailyDataStore passes `currentDate` into the repository. If UI dispatches `updateTask` for a task from a different date (e.g., dragging a non-today block into inbox without reloading that date), the repository loads the wrong day and fails → "Task not found". CurrentDate is set at load; no guard revalidates when handling drag/drop from other days. See date handling in [src/shared/stores/dailyDataStore.ts#L31-L119](src/shared/stores/dailyDataStore.ts#L31-L119).
- [Hypothesis] Inbox-task updates routed through dailyDataStore with `updates.timeBlock` missing (undefined) are treated as inbox→block moves in the repository because the branch checks `updates.timeBlock !== null` (undefined passes). That can remove the task from globalInbox via `moveInboxTaskToBlock`, potentially leaving it absent from both stores and causing subsequent "Task not found". Branch in [src/data/repositories/dailyData/taskOperations.ts#L90-L118](src/data/repositories/dailyData/taskOperations.ts#L90-L118).
- [Hypothesis] Double-moving or retrying after optimistic removal: Inbox drop handler calls dailyDataStore.updateTask with `timeBlock: null` and then reloads inbox. If the first call succeeds and a second drop fires before the reload, the second call operates on an ID already removed from dailyData/globalInbox → repository throw. Handler in [src/features/tasks/InboxTab.tsx#L147-L191](src/features/tasks/InboxTab.tsx#L147-L191).

# Reproduction Scenarios (frontend-only)
1) Quick-place TypeError via buttons: Open Inbox tab → click Today/Tomorrow/Next quick-place button under any task (or the ⏰ block buttons). Expected: task placed; Actual: TypeError from undefined `placeTaskToSlot` (store lacks function) logged in console.
2) Quick-place TypeError via hotkeys: Enable triage (Inbox tab) → focus a task → press `t`/`o`/`n`. Expected placement; Actual: same TypeError in hotkey handler.
3) Task-not-found during inbox drop: With a scheduled task visible, drag it into Inbox. If the task was already moved/removed (e.g., rapid repeat drop or after a background refresh/date mismatch), the drop handler calls dailyDataStore.updateTask → repository cannot find ID → "Failed to update task: Task not found" followed by "Failed to move task to inbox" toast.

# Recommendations (for implementers)
- Implement and wire `placeTaskToSlot` + `setLastUsedSlot` in `useInboxStore` (likely delegating to unifiedTaskService/dailyDataStore) to eliminate runtime TypeError and enable quick placement.
- Tighten repository branch guard to `updates.timeBlock !== null && updates.timeBlock !== undefined` for inbox tasks; add logging of `{ taskId, date, updates.timeBlock }` before the branch to confirm path.
- Add diagnostic logging around dailyDataStore.updateTask start/end with `{ taskId, currentDate, foundInDailyData, foundInbox }` to confirm missing IDs and date skew.
- In Inbox drop handler, gate duplicate calls (disable drop while request inflight) or verify presence in Dexie before invoking update to avoid double-move retries.

# Open Questions
- Are inbox quick-place features intended to live in useInboxStore or a separate service? (Missing methods suggest incomplete integration.)
- Do users ever drag tasks from non-today views into Inbox? If yes, how is `currentDate` updated before the move?
- Is there any path that routes inbox-only updates through dailyDataStore.updateTask (bypassing useInboxStore), triggering the undefined timeBlock branch?
