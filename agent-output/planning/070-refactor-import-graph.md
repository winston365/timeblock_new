# Import Graph / Circular Dependency Check (Phase 1 start)

- Date: 2026-01-05
- Tool: `madge`
- Command:
  - `npx madge src --circular --extensions ts,tsx --ts-config tsconfig.json`

## Result

- ❌ Found **9 circular dependencies** (see below)
- Graph output:
  - JSON graph saved to `agent-output/planning/070-import-graph.json`
  - SVG/PNG output requires Graphviz; current environment lacks `gvpr` (Graphviz not found).

## Circular Dependencies (madge output)

1) data/db/dexieClient.ts > shared/services/calendar/googleTasksService.ts > data/repositories/calendarRepository.ts
2) data/db/dexieClient.ts > shared/services/calendar/googleTasksService.ts > data/repositories/calendarRepository.ts > data/repositories/systemRepository.ts
3) shared/stores/dailyDataStore.ts > data/repositories/index.ts > data/repositories/gameStateRepository.ts > data/repositories/gameState/index.ts > data/repositories/gameState/dayOperations.ts > shared/services/template/templateTaskService.ts
4) shared/stores/dailyDataStore.ts > data/repositories/index.ts > shared/services/task/unifiedTaskService.ts
5) shared/services/task/unifiedTaskService.ts > shared/stores/inboxStore.ts > shared/services/ai/emojiSuggester.ts > shared/services/task/index.ts
6) data/repositories/index.ts > shared/services/task/unifiedTaskService.ts > shared/stores/inboxStore.ts > shared/services/gameplay/taskCompletion/index.ts > shared/services/gameplay/taskCompletion/taskCompletionService.ts > shared/services/gameplay/taskCompletion/handlers/xpRewardHandler.ts > shared/stores/gameStateStore.ts
7) shared/stores/dailyDataStore.ts > data/repositories/index.ts > shared/services/task/unifiedTaskService.ts > shared/stores/inboxStore.ts
8) features/battle/components/BattleSidebar.tsx > features/battle/components/MissionModal.tsx > features/battle/components/modal/index.ts > features/battle/components/modal/BossPanel.tsx
9) shared/services/rag/vectorStore.ts > shared/services/rag/vectorPersistence.ts

## Notes

- Plan gate requests "circular dependency 0" before Phase start, but current scan shows existing cycles.
- Recommendation: proceed only if we agree to a pragmatic rule: **do not introduce new cycles**, and track any cycle changes per Phase.
