---
ID: 59
Origin: 59
UUID: 1a4d2f8b
Status: Active
---

## Changelog
- 2026-01-03: Ran `npm run lint` and `npx tsc --noEmit`; captured current lint/typecheck failures for PR1 scope.

## Value Statement and Business Objective
- Restore CI green by eliminating ESLint/TypeScript blockers, enabling PR1 (Lint fixes) to merge without regression risk.

## Objective
- Enumerate current lint and typecheck failures, grouped by category and file footprint, to scope PR1 remediation.

## Context
- Repo: timeblock_new (local-first Electron React app). CI currently blocks on lint/type errors.
- Past notes flagged duplicate imports and exhaustive-deps warnings; current run refreshes the status on 2026-01-03.

## Methodology
- Executed `npm run lint` at repo root (Windows) with `--max-warnings 0`; captured errors/warnings.
- Executed `npx tsc --noEmit` using default tsconfig; recorded all 96 reported errors across 43 files.
- No code edits performed during data collection.

## Findings
### Facts
- ESLint: 6 issues (2 errors, 4 warnings).
  - Errors: duplicate imports in [src/data/repositories/dailyData/coreOperations.ts](src/data/repositories/dailyData/coreOperations.ts), [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx).
  - Warnings: fast-refresh export rule in [src/features/goals/components/GoalsFilterBar.tsx](src/features/goals/components/GoalsFilterBar.tsx); exhaustive-deps (missing dep and complex dep array) in [src/features/goals/hooks/useProgressUndo.ts](src/features/goals/hooks/useProgressUndo.ts); unused state setter in [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx).
- TypeScript: 96 errors in 43 files (tsc --noEmit).
  - Unused parameters: hooks in [src/data/db/infra/ragSyncHandler.ts](src/data/db/infra/ragSyncHandler.ts) (primKey in Dexie hooks), [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx) (unused handlers).
  - Type mismatches between repository generics and Dexie tables: [src/data/repositories/baseRepository.ts](src/data/repositories/baseRepository.ts) plus downstream configs in gameState/settings/waifu repositories (table typing, sanitize signatures).
  - Domain shape drift: missing/generated fields (`generatedAt`, `reward`, `updatedAt`, `timeBlock`) across aiInsights, quest operations, conflict resolver, unifiedTaskService, templateStore, subscribers.
  - Invalid re-exports / duplicate exports: [src/data/repositories/index.ts](src/data/repositories/index.ts) colliding names (`generateTasksFromAutoTemplates`, `deleteTemplate`, `loadTemplates`).
  - Missing imports/paths: [src/features/settings/components/tabs/types.ts](src/features/settings/components/tabs/types.ts) cannot find `@/shared/types` and syncLogger types; tokenUsage repository type not exported.
  - Component prop/type mismatches: multiple schedule/battle/task components (nullability, prop missing, wrong handler types) and weather widgets; NeonCheckbox expecting zero-arg onChange.
  - Literal/enum constraints: time block labels shape mismatch in [src/shared/services/rag/autoTagService.ts](src/shared/services/rag/autoTagService.ts); eventBus key mismatch in [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx).
  - Tests: conflict-resolver, modal-hotkeys, temp-schedule date parsing, template-system include invalid/missing props and spread typing.

### Hypotheses
- Base repository generic constraints likely outdated relative to Dexie table typings, leading to cascading type errors in repository configs.
- Several domain models (Task, Quest, BattleSettings, WeatherStore) may have evolved without synchronized type updates in dependent modules and tests, producing property-not-found errors.

## Root Cause (current understanding)
- Misalignment between shared domain type definitions and module implementations/re-exports, plus lax generic constraints in repository helpers, is producing most TypeScript failures. ESLint failures are limited to duplicate imports and hook dependency hygiene.

## Analysis Recommendations (next analytical steps)
- Trace the authoritative definitions for Task, Quest, BattleSettings, WeatherStore, AIInsightRecord to confirm current contract vs. usages flagged above.
- Inspect repository helper generics (`loadCollection`, `saveCollection`) alongside Dexie table typings to determine correct constraints before re-checking dependent repositories.
- Verify module export surface for repositories index/templateRepository to resolve re-export collisions; compare with intended public API.
- Re-run lint/tsc after upstream type definitions are validated to confirm remaining delta.

## Open Questions
- Which type source of truth should govern Task/Quest/BattleSettings (shared domain vs. feature-local overrides)?
- Are Dexie table definitions intended to carry optional key typing, or should repositories enforce a stricter shape?
- Should fast-refresh warning suppression be acceptable, or do we split utilities into non-component files?
