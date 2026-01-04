Value Statement and Business Objective
- Determine whether the daily-reset “global goals” system is still live, to avoid wasted maintenance and duplication against weekly goals, and to outline a safe retirement path that preserves task UX and data integrity.

Changelog
- Read-only investigation; no code changes.

Objective
- Map code paths for global goals (stores, repositories, UI, pipelines, event bus) and assess whether they are still invoked in the running app. Compare with weekly goals usage and propose a safe disable/delete strategy if deemed legacy.

Context
- Global goals (a.k.a. daily reset goals) live in `globalGoals` Dexie table and `globalGoalRepository`; progress resets daily based on scheduled tasks. Weekly goals are the active long-term goal feature with their own store/repo/UI. Recent phases removed the daily goal UI from the Goals modal but left code artifacts.

Root Cause (why legacy ambiguity exists)
- UI removal happened without removing backend/pipeline hooks: the Goals modal shows only weekly goals, but task creation, schedule coloring, event-bus subscribers, and completion pipeline still load/update global goals. This partial teardown leaves the feature headless but operational.

Methodology
- Searched for goal-related symbols (GoalPanel, goalStore, goal progress handler, weekly goals).
- Traced entrypoints (AppShell → TopToolbar → GoalsModal), task flows (TaskModal, TimelineView), and event/pipeline hooks (task completion, event bus subscriber).
- Reviewed repositories and stores for reset semantics and sync behavior.

Findings
- Fact: Global goal state/store is intact and wired to the globalGoalRepository (load/add/update/delete/recalculate) with daily progress reset logic baked into `loadGlobalGoals` and `resetDailyGoalProgress` [src/shared/stores/goalStore.ts#L59-L137](src/shared/stores/goalStore.ts#L59-L137), [src/data/repositories/globalGoalRepository.ts#L38-L207](src/data/repositories/globalGoalRepository.ts#L38-L207).
- Fact: GoalSubscriber remains initialized via `initAllSubscribers` in AppShell; it listens to `goal:progressChanged` and forces goal/dailyData refresh [src/shared/subscribers/goalSubscriber.ts#L23-L56](src/shared/subscribers/goalSubscriber.ts#L23-L56), [src/app/hooks/useEventBusInit.ts#L24-L40](src/app/hooks/useEventBusInit.ts#L24-L40).
- Fact: Task completion pipeline still runs `GoalProgressHandler` (first handler) to recalc global goal progress on scheduled task completion [src/shared/services/gameplay/taskCompletion/taskCompletionService.ts#L10-L66](src/shared/services/gameplay/taskCompletion/taskCompletionService.ts#L10-L66), [src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts#L21-L53](src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts#L21-L53).
- Fact: DailyDataStore emits `goal:progressChanged` on task add/update/delete when goal-linked scheduled tasks change, keeping global goal progress hot [src/shared/stores/dailyDataStore.ts#L206-L216](src/shared/stores/dailyDataStore.ts#L206-L216), [src/shared/stores/dailyDataStore.ts#L324-L334](src/shared/stores/dailyDataStore.ts#L324-L334), [src/shared/stores/dailyDataStore.ts#L384-L392](src/shared/stores/dailyDataStore.ts#L384-L392), and inboxStore also emits for inbox tasks with timeBlocks [src/shared/stores/inboxStore.ts#L164-L207](src/shared/stores/inboxStore.ts#L164-L207).
- Fact: UX entrypoint (TopToolbar → GoalsModal) only renders weekly goals; daily GoalPanel/GoalModal imports are commented out (Phase 5) so users cannot view/manage global goals there [src/app/components/TopToolbar.tsx#L270-L302](src/app/components/TopToolbar.tsx#L270-L302), [src/features/goals/GoalsModal.tsx#L7-L108](src/features/goals/GoalsModal.tsx#L7-L108).
- Fact: Despite missing UI, global goals are still surfaced in task flows: TaskModal fetches and lists them for task association [src/features/schedule/TaskModal.tsx#L88-L112](src/features/schedule/TaskModal.tsx#L88-L112), and TimelineView loads global goals to color tasks by goal [src/features/schedule/TimelineView/TimelineView.tsx#L28-L154](src/features/schedule/TimelineView/TimelineView.tsx#L28-L154).
- Fact: Weekly goals are fully active with dedicated store/repo/panel/modal and are the only goals visible in the Goals modal [src/shared/stores/weeklyGoalStore.ts#L20-L170](src/shared/stores/weeklyGoalStore.ts#L20-L170), [src/features/goals/WeeklyGoalPanel.tsx#L14-L120](src/features/goals/WeeklyGoalPanel.tsx#L14-L120), [src/features/goals/GoalsModal.tsx#L7-L108](src/features/goals/GoalsModal.tsx#L7-L108).
- Hypothesis: Because global goals still influence task coloring and task modal linkage but lack a management surface, users may be stuck with stale/hidden goal records and accidental associations; this creates duplication/conflict with weekly goals and complicates data integrity.

Recommendations (if declaring global goals legacy)
- Short-term flag/kill-switch: gate global goal load/update/use behind a runtime flag (e.g., in settings/constants) and default it off; bypass `GoalProgressHandler`, `goal:progressChanged` emissions, and global goal fetches in TaskModal/TimelineView when disabled.
- UI alignment: if disabled, hide/remove goal selection in TaskModal and any goal color mapping; otherwise users can still bind tasks to unseen goals.
- Data handling: decide whether to migrate existing `goalId` on tasks to null or map to weekly goals; if retiring, add a one-shot Dexie migration to clear `globalGoals` table and strip `goalId` from tasks (after user consent/export).
- Event bus & pipeline cleanup: remove GoalSubscriber init and remove GoalProgressHandler from the completion handler chain once flag proves safe; also stop emitting `goal:progressChanged` from stores when disabled to avoid wasted work.
- Sync layer: retire `globalGoals` sync strategy and Firebase payload writes/reads after data migration to reduce payload size and avoid ghost data.

Open Questions
- Do we still need per-task goal-based coloring/filters in TimelineView? If yes, should that be driven by weekly goals instead?
- Should existing global goals be migrated into weekly goals (with weekly targets) or simply dropped? Any user-facing export required?
- Are analytics/stats screens consuming global goal progress today (outside current UI)? If so, what replaces them?
- Is there any automation (e.g., templates or AI suggestions) that expects `goalId` to exist on tasks?
