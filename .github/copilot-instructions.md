
# TimeBlock Planner – AI Agent Guide

## Architecture
- **Electron + React + TS**: Entry `src/main.tsx` → `src/App.tsx`. Features in `src/features/*`, shared code in `src/shared/**`.
- **State flow**: Zustand (`src/shared/stores/*`) → Repositories (`src/data/repositories/*`) → Dexie (`src/data/db/dexieClient.ts`) → Firebase sync.

## Critical Policies
- **⛔ No localStorage** – Use `db.systemState` via Dexie. Only exception: `theme` key.
- **⛔ No hardcoded defaults** – Import from `src/shared/constants/defaults.ts`.
- **⛔ Always use optional chaining** – Nested objects may be undefined even when parent exists.
- **⛔ Modal UX** – No background-click close; ESC must always close. See `useModalEscapeClose` hook.

## Key Patterns
- **Repository Pattern**: All CRUD via `src/data/repositories/*`. No direct Dexie/Firebase calls.
- **Task dual-storage**: Scheduled tasks in `dailyData.tasks`, inbox tasks in `globalInbox`. Use `src/shared/services/task/unifiedTaskService` when location unknown.
- **Task Completion Pipeline**: Handlers in `src/shared/services/gameplay/taskCompletion/handlers/` run on task complete (XP, goals, quests, etc.).
- **EventBus**: Emit from stores only, subscribe in `src/shared/subscribers/*`. See `src/shared/lib/eventBus/`.
- **Firebase Sync**: Strategies in `src/shared/services/sync/firebase/`. See README there for patterns.

## Development
- `npm run electron:dev` – Full Electron app (recommended)
- `npm run test` – Vitest. Tests in `tests/`
- `npm run test:coverage` – Coverage report

## Conventions
- Imports: `@/` alias (e.g., `@/shared/stores`)
- Naming: Components=PascalCase, hooks/services=camelCase
- Large modules: Split into subfolders (e.g., `dailyData/` → `coreOperations`, `taskOperations`)

## Documentation
See READMEs in: `src/shared/services/sync/firebase/`, `src/shared/lib/eventBus/`, `src/shared/services/task/`, `src/shared/services/gameplay/taskCompletion/`, `src/data/db/`.
