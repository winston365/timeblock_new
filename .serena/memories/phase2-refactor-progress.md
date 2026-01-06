# Phase 2 Refactor Progress (checkpoint)

- Goal: Phase 2 (Store Refactor & UI Component Splitting) with stable public APIs via facades/re-exports, strict TS, avoid new circular deps.

## Completed
- dailyDataStore modularization implemented under `src/shared/stores/dailyDataStore/*` and stabilized public entrypoint via `src/shared/stores/dailyDataStore.ts` facade.
- InboxTab split: `src/features/tasks/InboxTab.tsx` reduced to orchestrator; extracted hooks `useInboxController`, `useInboxDragDrop` and components under `src/features/tasks/components/inbox/*`.
- battleStore heavy logic extracted to pure utilities: `src/features/battle/utils/combatCalculations.ts`, `missionLogic.ts`, `rewardCalculations.ts`.

## Verification
- `npm run build`: success (non-blocking warnings about dynamic vs static imports and chunk size).
- `npm test` (Vitest): 494/494 passing.

## Pending (next)
- Split `src/features/tasks/hooks/useInboxHotkeys.ts` into navigation vs mutation modules + keep external API via facade.
- Split `src/features/battle/components/BossAlbumModal.tsx` (UI section + hook/utils).
- Split `src/features/goals/WeeklyGoalCard.tsx` (render vs mutations/usecase).

## Notes / Risks
- Existing circular dependencies reported by madge; maintain rule: do not introduce new cycles.
- Flowbaby memory store failed twice with 429 backlog; use Serena memory as fallback.
