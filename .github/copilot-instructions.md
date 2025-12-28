
# TimeBlock Planner – AI Agent Guide

## 🏗 Architecture & Data Flow
- **Electron + React + TS**: Entry `src/main.tsx` → `src/app/AppShell.tsx`. Features in `src/features/*`, shared code in `src/shared/**`.
- **3-Tier Persistence**: Dexie (IndexedDB) is **Primary**. Firebase Realtime DB is for **Sync/Backup**.
- **State Flow**: Zustand Store (`src/shared/stores/*`) → Repository (`src/data/repositories/*`) → Dexie → Firebase Sync.

## ⛔ Critical Policies (MUST FOLLOW)
- **No localStorage**: Use `db.systemState` via Dexie. Exception: `theme` key only.
- **No Hardcoded Defaults**: Import from `src/shared/constants/defaults.ts` (e.g., `SETTING_DEFAULTS.focusTimerMinutes`).
- **Optional Chaining**: Always use `?.` for nested objects (e.g., `dailyData?.tasks`).
- **Modal UX**: ESC must close; no background-click close. Use `useModalEscapeClose` hook.
- **No Direct Firebase**: Never call Firebase APIs from UI/Stores. Use Repositories.

## 🧩 Core Patterns
- **Repository Pattern**: All CRUD via `src/data/repositories/`. Large repos are modularized (e.g., `dailyData/taskOperations.ts`).
- **Handler Pattern**: Task completion triggers a pipeline in `src/shared/services/gameplay/taskCompletion/handlers/` (XP, Goals, Quests, Waifu).
- **Event Bus**: Emit from stores (`eventBus.emit('task:completed', ...)`), subscribe in `src/shared/subscribers/*`.
- **Firebase Sync**: Strategy-based sync in `src/shared/services/sync/firebase/`. Update `strategies.ts` when schema changes.
- **Hybrid RAG**: Context-aware AI via `src/shared/services/rag/`. Uses DirectQuery (Dexie) for accuracy and VectorStore (Orama) for semantics.

## 🧠 ADHD-Friendly UX Guidelines
- **Visual Cues**: Use clear status indicators (colors, icons) for task states.
- **Micro-steps**: Support breaking tasks down (e.g., "Ignition" 3-min micro-steps).
- **Focus**: Minimize distractions; use `focusStore` for timer-related UI.
- **Triage**: Support "Inbox Triage" to prevent overwhelm (see `SYSTEM_STATE_DEFAULTS.inboxTriageDailyGoalCount`).

## 🛠 Development & Testing
- **Commands**: `npm run electron:dev` (Dev), `npm run test` (Vitest), `npm run test:coverage`.
- **Testing**: Logic tests in `tests/`. Use `fake-indexeddb` for DB tests.
- **Coverage**: Maintain >80% coverage for services/utils. See `vitest.config.ts` for included paths.

## 🎨 Conventions
- **Imports**: Use `@/` alias (e.g., `@/shared/stores`).
- **Naming**: Components=PascalCase, Hooks/Services=camelCase, Files=kebab-case.
- **Feature-First**: Group by feature in `src/features/` (components, hooks, stores, types).
- **Zustand**: Use `persist` middleware with `createJSONStorage(() => ({ ... }))` for local persistence via Dexie.

## 🔗 Key Files
- **DB Schema**: `src/data/db/dexieClient.ts` (v11)
- **Defaults**: `src/shared/constants/defaults.ts`
- **Event Types**: `src/shared/lib/eventBus/types.ts`
- **Sync Strategies**: `src/shared/services/sync/firebase/strategies.ts`
