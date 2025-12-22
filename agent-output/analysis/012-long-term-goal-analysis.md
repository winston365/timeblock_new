Value Statement and Business Objective
- Clarify how the current long-term goal UX and data flow operate so we can target usability, correctness, and reliability improvements without guessing.

Changelog
- Initial analysis of long-term goal (weekly/global) UX and data flows.

Objective
- Map where long-term/goal functionality lives (UI, store, repository/DB) and summarize UX/data flow.
- Identify risk areas grouped by: usability (ADHD-friendly), performance/rendering, data integrity/storage, maintainability, bug likelihood. For each, propose observable signals and how to verify.

Context (code pointers)
- Long-term (weekly) goal UI: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx), [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx), [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx), [src/features/goals/WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx), [src/features/goals/WeeklyGoalHistoryModal.tsx](src/features/goals/WeeklyGoalHistoryModal.tsx).
- Daily/global goal UI (still present, though GoalsModal hides it): [src/features/goals/GoalPanel.tsx](src/features/goals/GoalPanel.tsx).
- State stores: weekly goal store [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts); global goal store [src/shared/stores/goalStore.ts](src/shared/stores/goalStore.ts).
- Repositories: weekly goals [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts); global goals [src/data/repositories/globalGoalRepository.ts](src/data/repositories/globalGoalRepository.ts).
- Event/reactivity: goal progress handler [src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts](src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts); event subscriber [src/shared/subscribers/goalSubscriber.ts](src/shared/subscribers/goalSubscriber.ts).
- Types: WeeklyGoal in [src/shared/types/domain.ts](src/shared/types/domain.ts#L500-L553).

Current UX Flow (long-term / weekly goals)
- Goals entry point: Goals modal shows only weekly goals (daily goal tab removed) via [GoalsModal.tsx](src/features/goals/GoalsModal.tsx). ESC closes and cascades to child modal.
- Listing and control: [WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) loads store on mount, shows grid of cards, supports add/edit/delete/history, and opens modal for CRUD.
- Card interactions: [WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) shows progress with 7-slice bar, quick +/- buttons, direct input, daily target and catch-up severity; clicking header opens history; hover actions for edit/delete.
- Create/edit modal: [WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx) captures title/target/unit/icon/color; saves via weeklyGoalStore; ESC closes; no link to tasks.
- History: [WeeklyGoalHistoryModal.tsx](src/features/goals/WeeklyGoalHistoryModal.tsx) visualizes last 5 weeks kept in history (kept when week resets).
- Daily/global goal UX still exists via side panel [GoalPanel.tsx](src/features/goals/GoalPanel.tsx) showing today’s goals with task drill-down, but GoalsModal no longer exposes this tab.

Data Flow (stores → repositories → DB/Firebase)
- Weekly goals (long-term):
  - Zustand store [weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) wraps repository CRUD/progress setters and exposes helper calculators (today target, remaining days). Sorting by `order` happens client-side on every load/mutation.
  - Repository [weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts):
    - Loads from Dexie `weeklyGoals`; if empty, fetches Firebase, restores to Dexie.
    - Normalizes fields and auto-resets on week boundary: if `weekStartDate` != current Monday, moves prior week into `history` (keeps last 5), zeroes `currentProgress`, updates Dexie, then syncs to Firebase.
    - CRUD writes to Dexie then syncs all goals to Firebase (bulk push on add/update/delete/reorder).
    - Progress update is local-only math (`currentProgress += delta` or set) then syncs.
- Global goals (daily alignment to tasks):
  - Zustand store [goalStore.ts](src/shared/stores/goalStore.ts) wraps repository CRUD/recalc; optimistic updates for UI.
  - Repository [globalGoalRepository.ts](src/data/repositories/globalGoalRepository.ts):
    - On load, recalculates `plannedMinutes` and `completedMinutes` for today by reading Dexie `dailyData.tasks` where `goalId` matches and `timeBlock !== null`; writes back any changed goals.
    - CRUD writes to Dexie + syncs Firebase; delete also nulls `goalId` in all `dailyData` and `globalInbox` tasks.
    - `recalculateGlobalGoalProgress` recomputes today’s metrics for a goal; no-op for non-today dates.
- Reactivity pipeline:
  - Task completion handler [goalProgressHandler.ts](src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts) runs on completion/uncompletion; if task has `goalId`, is scheduled (`timeBlock !== null`), and date is today, calls `recalculateGlobalGoalProgress`.
  - EventBus subscriber [goalSubscriber.ts](src/shared/subscribers/goalSubscriber.ts) listens to `goal:progressChanged` (emitted e.g., from inbox store when tasks updated) and triggers `recalculateGlobalGoalProgress`, then refreshes both goal store and dailyData store.

Risk Buckets with Indicators & How to Verify
1) Usability / ADHD-friendliness
- Indicators: Overloaded card controls (many buttons + input) causing choice paralysis; accidental deletes (confirm only `confirm()` dialog); direct input affordance unclear; modal stacking (Goals → WeeklyGoalModal → History) may trap focus; ESC handling only at modal level.
- Checks:
  - Heuristic walk-through with keyboard-only: add goal, adjust progress via quick buttons and direct input, open/close history; note focus/ESC behavior and hover-dependent controls.
  - Observe abandonment/undo steps via user test or screen recording; track hover-to-click ratio on action buttons.
  - Add lightweight analytics/logs around quick-update clicks vs direct input usage to see preference and error rate.

2) Performance / Rendering
- Indicators: Every progress click triggers Dexie write + Firebase sync (bulk sync in repo) per [weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts); optimistic UI but no debounce. Card re-renders entire grid on each store mutation.
- Checks:
  - Profile quick +/- spam with React Profiler; measure render counts of `WeeklyGoalCard` grid.
  - Instrument timing around `updateWeeklyGoalProgress`/`setWeeklyGoalProgress` to log duration and Firebase round-trip counts; confirm whether sync is throttled.
  - Simulate many goals (e.g., 50) and measure frame drops when updating.

3) Data Integrity / Storage
- Indicators: Week-reset logic runs on load; if Firebase restore lags or client clock skew, history may duplicate/skip weeks; bulk sync on every mutation risks race overwrites. `updateWeeklyGoalProgress` clamps at 0 but no upper bound vs target. Global goals recalc only for today; editing past tasks won’t update history. Deleting goal nulls `goalId` across tasks but weekly goals have no task linkage at all (pure counter), so mismatch with actual work possible.
- Checks:
  - Unit test week rollover: mock `weekStartDate` in Dexie, load, assert history appended and progress zeroed; verify Firebase sync payload.
  - Clock skew test: load with system date set ±1 day to see unintended resets; add logging around `getWeekStartDate` results.
  - Data audit: compare `currentProgress` against sum of emitted deltas or expected targets; alert if > target by threshold.
  - For global goals, edit a completed task from yesterday → ensure recalc is skipped (known limitation); consider backlog job to recompute across dates.

4) Maintainability
- Indicators: Dual goal systems (weekly counters vs global time-tracked goals) with different semantics; GoalsModal hides daily goals but code remains, increasing drift. Firebase sync scatter: every repo manually wraps `withFirebaseSync`, no shared throttle. UI logic (catch-up severity, quick buttons) is in card, not shared. History limited to last 5 weeks inline; no selector.
- Checks:
  - Map feature ownership: decide whether daily goals are deprecated; search for remaining entry points (GoalPanel usage) and document planned removal or bridging.
  - Static analysis for duplicate Firebase sync patterns; consider centralizing.
  - Component tests around WeeklyGoalCard calculations (today target, catch-up) to prevent regressions when refactoring.

5) Bug Likelihood
- Indicators: `loadGoals` in stores called in `useEffect` without dependency safety; repeated mounts may re-sort/state flicker. Progress updates rely on optimistic state; failure during Firebase sync not surfaced. Delete confirmation uses blocking `confirm` (not consistent with app modal policy). `recalculateGlobalGoalProgress` ignores non-today updates, so late completions for past days won’t reflect. Weekly goal progress not linked to tasks at all—manual counters can drift from real work.
- Checks:
  - Simulate offline mode: perform progress updates, then reconnect; validate Dexie/Firebase convergence and ordering after bulkPut+sync.
  - Force errors in repository (throw) to ensure store error handling surfaces to UI and state rolls back.
  - Regression test: complete task for yesterday with goalId; assert goal progress unchanged (documented behavior) and decide if acceptable.
  - UI test for delete/edit: ensure click on card body does not trigger delete (hover buttons stop propagation) and ESC closes child modals without closing parent unexpectedly.

Recommendations (concise)
- Decide single source for “long-term goals”: either connect weekly goals to tasks (and use same progress pipeline) or retire daily/global goals fully to avoid dual semantics.
- Add debounced/throttled sync or batch progress updates to reduce Firebase writes during rapid +/- clicks.
- Add integrity guardrails: upper bound progress to target by default; log week reset events with before/after snapshot; add clock-skew warning.
- Instrument UX: track quick-button vs direct-input usage and error prompts to guide simplification; provide custom confirm modal aligned with global UX rules.

Open Questions
- Are daily/global goals still used elsewhere (besides GoalPanel)? If deprecated, should recalc handler/subscriber be removed to cut complexity?
- Should weekly goals tie to tasks/time, or remain manual counters? If tie-in is desired, what mapping rules apply across days?
- What is the acceptable behavior for editing past tasks with goal links—should history be recomputed retroactively?
