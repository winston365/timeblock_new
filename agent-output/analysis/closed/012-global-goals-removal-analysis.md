Value Statement and Business Objective
- Remove legacy daily-reset global goals to simplify goal surface to weekly goals only, reducing sync/storage complexity and avoiding user-facing confusion.

Changelog
- Initial scan of codebase for global goals references and dependencies.

Objective
- Enumerate all global goals code paths (repo/store/service/DB/sync/event/test/UI) that must be removed.
- Identify shared pieces with weekly goals and separation points.
- List call sites needing edits when global goals disappear.
- Propose Dexie schema deletion/migration plan (no data retention required).
- Flag tests assuming global goals.

Context
- Current UI shows weekly goals; daily GoalPanel is still present in code but commented out at modal level. Global goals infrastructure (Dexie table, Firebase sync, stores, event bus, task completion handler) remains active and recalculates progress daily based on scheduled tasks.

Root Cause
- Legacy global goals feature was never fully removed; back-end layers (Dexie, sync, subscribers, handlers) still run even though front UI de-emphasizes them. This leaves unused data structures and background work.

Methodology
- Grep-based search for globalGoal/globalGoals/globalGoalId across src/tests.
- Read repository, store, sync, DB, subscriber, handler, UI, and test files to map dependencies.

Findings (facts)
- Repository layer
  - Global goal CRUD + progress reset/recalc persists in [src/data/repositories/globalGoalRepository.ts](src/data/repositories/globalGoalRepository.ts): `loadGlobalGoals`, `addGlobalGoal`, `updateGlobalGoal`, `deleteGlobalGoal`, `reorderGlobalGoals`, `recalculateGlobalGoalProgress`, `resetDailyGoalProgress` plus Firebase sync via `globalGoalStrategy`.
  - Repository barrel re-exports it in [src/data/repositories/index.ts](src/data/repositories/index.ts#L9-L20).
  - Daily data loader triggers `resetDailyGoalProgress` on first load of today in [src/data/repositories/dailyData/coreOperations.ts](src/data/repositories/dailyData/coreOperations.ts#L129-L150).
  - GameState new-day init calls `resetDailyGoalProgress` in [src/data/repositories/gameState/index.ts](src/data/repositories/gameState/index.ts#L229-L248).

- Stores & subscribers
  - Zustand goal store wraps repo in [src/shared/stores/goalStore.ts](src/shared/stores/goalStore.ts) (load/add/update/delete/reorder/recalc).
  - Goal subscriber listens to `goal:progressChanged` and refreshes goal + daily data stores in [src/shared/subscribers/goalSubscriber.ts](src/shared/subscribers/goalSubscriber.ts).
  - Event emitters fire `goal:progressChanged` from inbox and dailyData stores ([src/shared/stores/inboxStore.ts](src/shared/stores/inboxStore.ts#L165-L210), [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts#L502-L538)); event type defined in [src/shared/lib/eventBus/types.ts](src/shared/lib/eventBus/types.ts#L140-L167).

- Gameplay handler
  - Task completion pipeline includes `GoalProgressHandler` invoking `recalculateGlobalGoalProgress` in [src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts](src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts).

- Sync/Firebase
  - Global goals fetched in initial load in [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts#L44-L170).
  - Sync strategy defined in [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts#L171-L190) (`globalGoalStrategy`, also deprecated `dailyGoalStrategy`).
  - `withFirebaseSync` calls from repo push global goals to Firebase.

- DB/Dexie
  - Dexie table `globalGoals` declared across versions v5–v17 in [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts#L28-L210) and type table property at [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts#L28-L120).
  - Firebase bootstrap writes `globalGoals` into Dexie in [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts#L210-L240).
  - DB docs list table and version history in [src/data/db/README.md](src/data/db/README.md#L17-L55).

- UI (global goal usage)
  - Task creation/edit modal loads global goals for selection (`goalId`) in [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx#L20-L140).
  - Timeline view loads global goals for goal color mapping in [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx#L20-L140).
  - Legacy GoalPanel (daily/global goal panel) still present though modal tabs removed in [src/features/goals/GoalPanel.tsx](src/features/goals/GoalPanel.tsx) and modal wrapper notes removal in [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx#L10-L110).

- Types
  - `DailyGoal` type used for global goals and embedded in `DailyData` in [src/shared/types/domain.ts](src/shared/types/domain.ts#L104-L160). Tasks carry `goalId` (same type) elsewhere.

- Tests
  - Task completion tests mock `recalculateGlobalGoalProgress` in [tests/task-completion.test.ts](tests/task-completion.test.ts#L40-L70) and [tests/task-completion-handlers.test.ts](tests/task-completion-handlers.test.ts#L33-L80, #L150-L190).

Findings (hypotheses/risks)
- Tasks still support `goalId`; removing global goals requires deciding whether to drop `goalId` entirely or re-point to weekly goals (schema/UI impact). Timeline goal color and TaskModal goal selector will break unless replaced/removed.
- DailyData.goals array may be unused in UI but still persisted; removing global goals could also allow removing this field if not used elsewhere.
- Event bus `goal:progressChanged` becomes unused; subscriber deletion requires ensuring no other listeners rely on it.

Recommendations (deletion checklist)
- Repositories
  - Remove exports and implementation of global goal repo functions in [src/data/repositories/globalGoalRepository.ts](src/data/repositories/globalGoalRepository.ts) and drop re-export from [src/data/repositories/index.ts](src/data/repositories/index.ts#L9-L20).
  - Update [src/data/repositories/dailyData/coreOperations.ts](src/data/repositories/dailyData/coreOperations.ts#L129-L150) and [src/data/repositories/gameState/index.ts](src/data/repositories/gameState/index.ts#L229-L248) to drop `resetDailyGoalProgress` calls.

- Stores/Subscribers
  - Delete Zustand goal store [src/shared/stores/goalStore.ts](src/shared/stores/goalStore.ts).
  - Remove goal subscriber [src/shared/subscribers/goalSubscriber.ts](src/shared/subscribers/goalSubscriber.ts) and event emissions in [src/shared/stores/inboxStore.ts](src/shared/stores/inboxStore.ts#L165-L210) and [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts#L502-L538); prune event type from [src/shared/lib/eventBus/types.ts](src/shared/lib/eventBus/types.ts#L140-L167).

- Sync/Firebase
  - Remove `globalGoalStrategy` (and deprecated `dailyGoalStrategy`) from [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts#L171-L190).
  - Drop globalGoals fetch/return fields from [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts#L44-L170) and any callers.
  - Remove Firebase sync calls in repo once repo is deleted.

- DB/Dexie
  - Add new schema version to delete `globalGoals` table in [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts) (set store to null) and adjust property typing.
  - Remove bootstrap import/write for `globalGoals` in [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts#L210-L240).
  - Update DB docs table/version history in [src/data/db/README.md](src/data/db/README.md#L17-L55).

- UI
  - Remove global goal usage in TaskModal [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx#L20-L140) and TimelineView [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx#L20-L140) (either drop goal selector/coloring or replace with weekly goal linkage).
  - Delete legacy GoalPanel component [src/features/goals/GoalPanel.tsx](src/features/goals/GoalPanel.tsx) and clean references in [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx#L10-L110).

- Types/Data model
  - Decide fate of `DailyGoal` and `DailyData.goals` in [src/shared/types/domain.ts](src/shared/types/domain.ts#L104-L160); prune `goalId` from `Task` if no replacement, or retarget to weekly goals with new relation.

- Tests
  - Update/remove mocks referencing `recalculateGlobalGoalProgress` in [tests/task-completion.test.ts](tests/task-completion.test.ts#L40-L70) and [tests/task-completion-handlers.test.ts](tests/task-completion-handlers.test.ts#L33-L80, #L150-L190) once handler is removed.

Separation from weekly goals
- Weekly goals live in separate store/UI (`WeeklyGoalPanel`, `weeklyGoalStore`) and Dexie `weeklyGoals` table; only shared surface is naming/type similarities (colors/icons). Removing `DailyGoal` artifacts should not affect weekly goal flow if TaskModal/TimelineView are adjusted to drop goal linkage rather than reuse weekly goals.

Open Questions
- Should tasks still carry any `goalId` once global goals are removed? If yes, should it map to weekly goals instead?
- Is `DailyData.goals` still needed for any reporting or legacy views? If not, can it be dropped alongside global goals?
- Do we need to keep goal-based color mapping on the timeline after removal?
