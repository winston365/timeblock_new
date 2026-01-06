# dailyDataStore Consumer Map (Phase 2)

> Source of truth: `useDailyDataStore` usage sites in `src/**` as of 2026-01-05.
> 목적: Phase 2 store slice 분해 시, 공개 API 유지 + 소비자 수정 최소화.

## Summary
- **Primary read model**: `dailyData` (incl. `dailyData.tasks`, `dailyData.timeBlockDontDoStatus`)
- **Frequently used mutations**:
  - `addTask(task)`
  - `updateTask(taskId, updates)`
  - `deleteTask(taskId)`
  - `toggleTaskCompletion(taskId)`
  - `toggleDontDoItem(timeBlockId, itemId, xpReward)`
- **Data lifecycle**:
  - `loadData(date?)`, `refresh()`, `saveData(...)`

## Consumers (Static Imports)

### src/app/AppShell.tsx
- Access pattern: `useDailyDataStore.getState()`
- Used actions:
  - `addTask(task)` (template create)

### src/app/components/GlobalModals.tsx
- Access pattern: `useDailyDataStore.getState()`
- Used actions:
  - `addTask(task)` (template create)

### src/data/db/infra/useAppInitialization.ts
- Access pattern: `useDailyDataStore()`
- Used actions:
  - `loadData(date?)` (aliased as `loadDailyData`)

### src/features/schedule/components/DontDoChecklist.tsx
- Access pattern: `useDailyDataStore()`
- Used selectors/state:
  - `dailyData?.timeBlockDontDoStatus?.[timeBlockId]?.[itemId]`
- Used actions:
  - `toggleDontDoItem(timeBlockId, itemId, xpReward)`

### src/features/schedule/TimelineView/TimelineView.tsx
- Access pattern: `useDailyDataStore()`
- Used actions:
  - `updateTask(taskId, updates)`
  - `addTask(task)`
  - `deleteTask(taskId)`

### src/features/schedule/TimelineView/useTimelineData.ts
- Access pattern: `useDailyDataStore(state => state.dailyData)`
- Used selectors/state:
  - `dailyData?.tasks` (timeline calculations)

### src/features/tempSchedule/components/TempScheduleTimelineView.tsx
- Access pattern: `useDailyDataStore()`
- Used selectors/state:
  - `dailyData?.tasks` (overlay snapshot)
- Used actions:
  - `loadData(date)` (aliased as `loadDailyData`)

### src/shared/services/template/templateTaskService.ts
- Access pattern: `useDailyDataStore.getState()`
- Used actions:
  - `addTask(task)`

## Consumers (Dynamic Imports / getState)

### src/features/tempSchedule/stores/tempScheduleStore.ts
- Dynamic import to avoid circular dependency
- Used actions:
  - `useDailyDataStore.getState().addTask(task)`

### src/shared/services/task/unifiedTaskService.ts
- Dynamic import to avoid circular dependency
- Used actions:
  - `refresh()`
  - `updateTask(taskId, updates)`
  - `deleteTask(taskId)`
  - `toggleTaskCompletion(taskId)`

### src/shared/stores/inboxStore.ts
- Dynamic import to avoid circular dependency
- Used actions:
  - `updateTask(taskId, updates)` (when moving inbox task to a timeBlock)

## Consumer Wrapper Hook

### src/shared/hooks/useDailyData.ts
- Access pattern: `const store = useDailyDataStore()`
- Exposes facade for many store APIs:
  - `loadData(date)`, `refresh()`, `saveData(...)`
  - `addTask`, `updateTask`, `deleteTask`, `toggleTaskCompletion`
  - `updateBlockState`, `toggleBlockLock`, `setHourSlotTag`

## Notes / Risk Points
- Several call-sites use `useDailyDataStore.getState()`; store facade must preserve these methods.
- Multiple dynamic-import call-sites assume module path `@/shared/stores/dailyDataStore` stays valid.
- `useDailyData.ts` re-exports a wide surface area; refactor must keep these exports stable.
