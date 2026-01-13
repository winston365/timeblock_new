
# TimeBlock Planner - AI Copilot Instructions

## 🗺️ High-Level Map
- **Core Stack**: Electron (Main/Preload), React 19 (Views), TypeScript 5.8, Zustand (State), Dexie.js (IndexedDB).
- **Architecture**: **Local-First** with **Repository Pattern**. Views interact with Stores → Stores call Repositories → Repositories manage Dexie (Local) & Firebase (Cloud Backup).
- **Entry Points**: 
  - UI: `src/main.tsx` → `src/app/AppShell.tsx` (Handles daily reset/init)
  - Electron: `electron/main/index.ts`
- **File Structure**:
  - `src/features/**`: Domain-specific logic (UI, Hooks, Stores).
  - `src/shared/**`: Shared infrastructure (EventBus, Services, Utils).
  - `src/data/**`: DB Schema, Repositories, Migrations.

## 🧱 Critical Architectural Patterns

### 1. Data Persistence (3-Tier)
**Strict Rule**: Never use `localStorage` (except for theme).
1.  **IndexedDB (Dexie)**: Primary local storage. Schema v17 defined in `src/data/db/dexieClient.ts`.
2.  **Firebase RTDB**: Async backup & sync. Controlled by `src/shared/services/sync/firebase/syncCore.ts`.
3.  **InMemory**: Zustand stores for UI reactivity.

### 2. Event-Driven Logic
-   **EventBus**: Use `src/shared/lib/eventBus` for cross-component communication.
-   **Pattern**: Emit events from Stores/Services. Subscribe in `src/shared/subscribers/**`.
-   **Naming**: `[Domain]:[Action]` (e.g., `Task:Completed`, `Game:LevelUp`).

### 3. Task Completion Pipeline (Handler Pattern)
Task completion flow is a chain of command (`src/shared/services/gameplay/taskCompletion/handlers/`):
1.  `GoalProgressHandler`: Update user goals.
2.  `XPRewardHandler`: Calculate game XP.
3.  `QuestProgressHandler`: Update daily quests.
4.  `WaifuAffectionHandler`: Trigger AI companion reaction.
5.  `BlockCompletionHandler`: Time-block logic.

### 4. AI & RAG (Retrieval-Augmented Generation)
-   **Gemini Integration**: Logic in `src/features/gemini/` and `src/shared/services/ai/gemini/`.
-   **RAG System**: `src/shared/services/rag/`.
    -   **Hybrid Search**: Combines **DirectQuery** (IndexedDB structured search) and **VectorStore** (Orama semantic search).
    -   **Context**: Construct prompts using filtered history + current task state.

## 🚧 Coding Standards & Conventions

-   **Data Access**: **ALWAYS** use Repositories (`src/data/repositories/**`). Never access `db` or `firebase` directly from UI components.
-   **Defaults**: **NEVER** hardcode values. Import from `src/shared/constants/defaults.ts`.
-   **Modals**: Use `useModalEscapeClose` hook. Backdrop click should NOT close modals.
-   **Imports**: Use `@/` alias for `src/`. Group imports: React -> 3rd Party -> Local.
-   **Safety**: Use Optional Chaining (`?.`) and Nullish Coalescing (`??`) extensively.
-   **Naming**:
    -   Components: `PascalCase.tsx`
    -   Hooks/Utils: `camelCase.ts`
    -   Constants: `UPPER_SNAKE_CASE`

## 🛠️ Developer Workflows

-   **Start Dev**: `npm run electron:dev` (Full App) or `npm run dev` (Web UI only).
-   **Run Tests**:
    -   `npm test` (Run all Vitest tests).
    -   `npm run test:coverage` (Check coverage).
    -   **Note**: Use `fake-indexeddb` for DB testing.
-   **Build**: `npm run dist` (Produces platform-specific installer in `release/`).
-   **Lint**: `npm run lint` (ESLint).

## ⚠️ Common Pitfalls (Watch Out!)
-   **Sync Loop**: Modifying data inside a subscription without a guard can cause infinite loops.
-   **Schema Drift**: detailed in `src/data/db/dexieClient.ts`. Always add migration when changing tables.
-   **Date Handling**: Use `src/shared/utils/dateUtils.ts`. Be careful with timezone offsets (KST focus).
-   **Waifu Assets**: Located in `public/assets/waifu`. References must exactly match filenames.
