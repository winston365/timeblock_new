# Coverage Baseline (Phase 1 start)

- Date: 2026-01-05
- Command: `npm run test:coverage` (captured to `vitest-coverage.log`)
- Notes:
  - Vitest coverage scope is constrained by `vitest.config.ts` `test.coverage.include`.
  - Files like `src/data/db/infra/syncEngine.ts`, `src/shared/stores/dailyDataStore.ts`, and most `*.tsx` UI files are currently **not included** in coverage (either not listed in `include` or excluded via `exclude`).

## Summary (from `vitest-coverage.log`)

| File (group) | % Stmts | % Branch | % Funcs | % Lines |
|---|---:|---:|---:|---:|
| All files | 95.59 | 86.59 | 96.66 | 95.59 |
| src/shared/lib/storeUtils.ts | 99.39 | 90.90 | 100 | 99.39 |
| src/shared/lib/eventBus/EventBus.ts | 83.59 | 100 | 81.81 | 83.59 |
| src/shared/services/gameplay/taskCompletion/taskCompletionService.ts | 98.71 | 83.33 | 100 | 98.71 |
| taskCompletion handlers (folder aggregate) | 97.72 | 94.73 | 100 | 97.72 |
| src/shared/services/sync/syncLogger.ts | 94.16 | 89.47 | 100 | 94.16 |
| src/shared/services/sync/firebase/conflictResolver.ts | 98.41 | 67.44 | 100 | 98.41 |
| src/shared/services/sync/firebase/syncCore.ts | 94.08 | 75.86 | 100 | 94.08 |
| src/shared/services/sync/firebase/syncRetryQueue.ts | 98.58 | 90.32 | 88.88 | 98.58 |
| src/shared/services/task/unifiedTaskService.ts | 95.03 | 88.28 | 100 | 95.03 |
| src/shared/utils/firebaseSanitizer.ts | 100 | 94.28 | 100 | 100 |

## Raw log

- Full output: `vitest-coverage.log`
