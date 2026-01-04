# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TimeBlock Planner is a gamified daily task management desktop application built with Electron, React, and TypeScript. It combines time-blocking methodology with gamification elements and an AI-powered virtual companion. The primary UI language is Korean.

## Development Commands

**Requirements**: Node.js 18+

```bash
# Development
npm run dev                    # Start Vite dev server (web only)
npm run electron:dev          # Run Electron app in development mode (preferred E2E loop)
npm run electron:prod         # Run production build locally

# Build
npm run build                 # Build web assets (Vite)
npm run electron:build        # Build Electron main process
npm run dist                  # Build distributable for current platform
npm run dist:win              # Build Windows installer
npm run dist:mac              # Build macOS app
npm run dist:linux            # Build Linux package

# Code Quality & Testing
npm run lint                  # Run ESLint on TypeScript files
npm test                      # Run Vitest test suite (494+ tests)
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Run tests with coverage report
npm run bump                  # Bump patch version and commit

# Preview
npm run preview               # Preview production build
```

**Note**: Run `npm test` to execute the full test suite (Vitest). For behavior that could diverge between web and desktop, also verify in both `npm run preview` and `npm run electron:prod`.

## Architecture Overview

### Entry Point

`src/main.tsx` → `AppShell` is the main entry. Daily reset and template auto-generation runs inside `src/app/AppShell.tsx` + `src/app/hooks/useAppInitialization.ts`.

### Data Persistence - Dexie-Only Local Storage

The app uses a 2-layer data persistence strategy:

1. **IndexedDB** (Primary Local) - Via Dexie ORM (ONLY local storage)
2. **Firebase Realtime Database** (Cloud) - Remote sync and backup

**⚠️ IMPORTANT: localStorage is DEPRECATED and should NOT be used!**
- Exception: `theme` key only (needed before Dexie initializes at app startup)
- All other data MUST use Dexie `systemState` table or domain-specific tables
- See `src/shared/lib/utils.ts` for deprecated localStorage helpers with dev warnings

**Critical Pattern**: All data operations go through the **Repository Pattern** (`src/data/repositories/`). Each repository extends `baseRepository.ts` and is the only layer that should touch storage APIs.

Large repositories are modularized (e.g., `dailyData/` folder with coreOperations, taskOperations, blockOperations, queryHelpers, types).

```typescript
// Example flow: Update dailyData
dailyDataStore.updateTask()
  → dailyDataRepository.update() // or dailyData/taskOperations.ts
    → Dexie (IndexedDB)
    → Firebase (async via syncToFirebase())

// System state storage (NOT localStorage!)
import { db } from '@/data/db/dexieClient';

// Save
await db.systemState.put({ key: 'myKey', value: myData });

// Load
const record = await db.systemState.get('myKey');
const data = record?.value;
```

### Firebase Synchronization Architecture

Located in `src/shared/services/sync/firebase/`:

- **Strategy Pattern**: Each data type has a `SyncStrategy<T>` implementation (`strategies.ts`)
- **Conflict Resolution**: Last-Write-Wins (LWW) via `conflictResolver.ts`
- **Retry Queue**: Failed syncs are queued and retried (`syncRetryQueue.ts`)
- **Deduplication**: Hash-based duplicate detection prevents redundant syncs
- **Core Sync**: `syncCore.ts` handles the actual sync pipeline
- **Server-First Templates**: Firebase Cloud Function (`functions/index.js`) generates tasks from templates daily at 00:00 KST. Client observes, doesn't generate.

**Important**: When modifying data structures, update all three layers:
1. Dexie schema in `src/data/db/dexieClient.ts`
2. Repository in `src/data/repositories/`
3. Sync strategy in `src/shared/services/sync/firebase/strategies.ts`

When altering sync behavior, keep Last-Write-Wins + retry queue semantics.

### Feature-Based Organization

The codebase uses feature modules (`src/features/`). Each feature is self-contained:

```
features/
  ├── schedule/      # Time-blocking UI (largest feature)
  ├── waifu/         # AI companion system
  ├── tasks/         # Task management
  ├── gemini/        # AI chat integration
  ├── gamification/  # XP, quests, achievements
  ├── goals/         # Global goals panel
  ├── template/      # Task templates
  ├── settings/      # Settings & sync log modals (tabs/ submodule)
  ├── stats/         # Statistics dashboard (tabs/ submodule)
  ├── shop/          # XP shop
  ├── insight/       # AI insight panel
  ├── weather/       # Weather integration (Google Search Grounding)
  ├── energy/        # Energy level tracking
  ├── focus/         # Focus timer
  ├── feedback/      # Reality check modals
  ├── inventory/     # Inventory system
  ├── pip/           # Picture-in-Picture mode
  ├── quickadd/      # Quick task addition
  └── ...
```

Each feature typically contains:
- `components/` - UI components
- `hooks/` - Feature-specific React hooks
- `utils/` - Helper functions
- `stores/` - Feature-specific Zustand stores (if needed)
- `types.ts` - TypeScript definitions (if needed)

### State Management - Zustand Stores

12 specialized stores in `src/shared/stores/`:

1. **dailyDataStore** - Central task & time-block state
2. **gameStateStore** - XP, level, quests, streaks
3. **settingsStore** - API keys, Firebase config, preferences
4. **waifuCompanionStore** - Companion visibility, messages, affection
5. **focusStore** - Focus timer state
6. **uiStore** - UI state (modals, panels)
7. **toastStore** - Toast notifications
8. **realityCheckStore** - Reality check modals
9. **inboxStore** - Global inbox tasks
10. **goalStore** - Global goals
11. **templateStore** - Task templates
12. **completedTasksStore** - Completed inbox tasks

**Pattern**: Stores delegate all persistence to repositories. They implement optimistic updates with rollback on failure.

### Event Bus

Event-driven UI logic uses `src/shared/lib/eventBus` with `[domain]:[action]` names. Unsubscribe in `useEffect` cleanup and enable logger/performance middleware in dev for tracing.

### Handler Pattern - Task Completion Pipeline

Task completion triggers a chain of handlers (`src/shared/services/gameplay/taskCompletion/handlers/`):

```typescript
// Pipeline executed in taskCompletionService.ts
1. GoalProgressHandler      → Update goal progress
2. XPRewardHandler          → Calculate and award XP
3. QuestProgressHandler     → Update daily quests
4. WaifuAffectionHandler    → Increase companion affection
5. BlockCompletionHandler   → Check if time-block is perfect
```

When adding new task completion side effects, create a new handler implementing `TaskCompletionHandler` interface and register it in `taskCompletionService.ts`.

### Time-Blocking System

**6 Time Blocks**: 5-8, 8-11, 11-14, 14-17, 17-20, 20-23

**Resistance Levels** (affect adjusted duration):
- 🟢 Low (1.0x): Tasks you enjoy
- 🟡 Medium (1.3x): Neutral tasks
- 🔴 High (1.6x): Tasks you resist

**Block States**: `lock`, `perfect`, `failed`, `timer` (managed via `timeBlockStates` table)

## Key Domain Concepts

### Database Schema (Dexie)

11 schema versions with migrations in `src/data/db/dexieClient.ts`. Core tables:

- **dailyData** - Daily tasks and blocks (keyed by date YYYY-MM-DD)
- **gameState** - Player progression (singleton, key: 'current')
- **templates** - Reusable task templates with recurrence
- **globalInbox** - Date-independent tasks
- **completedInbox** - Completed inbox tasks (v7+)
- **globalGoals** - Long-term goals with time tracking
- **shopItems** - Purchasable items with XP
- **waifuState** - Companion affection and interactions
- **energyLevels** - Hourly energy tracking
- **chatHistory** - Gemini AI conversation history
- **dailyTokenUsage** - Daily Gemini token usage tracking
- **systemState** - System state key-value store (v6+)
- **settings** - App settings including dontDoChecklist (v8+)
- **images** - Image storage (v9+)
- **weather** - Weather cache with Google Search Grounding (v10+)
- **aiInsights** - AI insight cache (v11+)

When adding fields, increment version and add migration. Ensure migrations are idempotent and backfill both IndexedDB and Firebase.

### Gamification System

- **XP System**: Tasks award XP based on adjusted duration
- **Levels**: Exponential curve (100 * level² XP per level)
- **Daily Quests**: 6 quest types (complete tasks, earn XP, lock blocks, etc.)
- **Shop**: Purchase items with `availableXP` (separate from `totalXP`)
- **Streaks**: Daily login tracking with reset logic

Business logic in `src/shared/services/gameplay/`.

### Waifu Companion

AI companion with affection system (0-100) and dynamic poses:

- **Emotion Poses**: hostile, wary, indifferent, affectionate, loving (based on affection)
- **Special Poses**: Unlockable via interactions (crying, drunk, scared, shocked, surprised, suspicious, worried)
- **Interaction Modes**: Normal vs Characteristic (personality-driven)
- **Auto-Messages**: Configurable interval messages

Assets in `src/features/waifu/poses/` and `public/assets/waifu/poses/`, state managed in `waifuCompanionStore` and `waifuRepository`.

### AI Integration (Gemini)

- **API Key**: Stored in `settingsStore`, synced via Firebase
- **Features**: Full-screen chat, task breakdown, motivational messages, emoji suggestions
- **Token Tracking**: Daily usage limits via `dailyTokenUsage` table
- **Categories**: task-advice, motivation, qa, analysis
- **Persona Context**: Build persona context using `src/shared/lib/personaUtils` before invoking `geminiApi.ts`
- **Weather Integration**: `geminiWeather.ts` uses Google Search Grounding for real-time weather

Service layer modularized in `src/shared/services/ai/gemini/` (apiClient, personaPrompts, taskFeatures, types) and `src/features/gemini/`.

### RAG (Retrieval-Augmented Generation)

Hybrid RAG system in `src/shared/services/rag/` provides context-aware AI responses by analyzing past task history:

- **HybridRAGService** (`hybridRAGService.ts`) - Main entry point combining structured queries + vector search
- **QueryParser** (`queryParser.ts`) - Converts natural language to structured queries (dates, status, time blocks)
- **DirectQueryService** (`directQueryService.ts`) - Fast IndexedDB queries for structured data (date-specific, status queries)
- **VectorStore** (`vectorStore.ts`) - Orama-based semantic search (in-memory, rebuilt on restart)
- **AutoTagService** (`autoTagService.ts`) - Suggests tags based on task title history + optional AI enhancement

**Query Flow**: User query → QueryParser → Route to DirectQuery (structured) OR Vector Search (semantic) → AI Context

**Patterns**:
- date_specific queries ("11월 24일 완료 작업") → DirectQuery (100% accurate, no API cost)
- semantic queries ("프로그래밍 관련 작업") → Hybrid (DirectQuery + Vector)
- stats queries ("이번 주 몇 개 완료?") → Aggregation + summary

**Debugging**: `window.hybridRag.generateContext()` and `window.rag.debugGetAllDocs()` in dev console

## Electron App Structure

- **Main Process**: `electron/main/index.ts` - Window management, IPC, auto-update
- **Preload**: `electron/preload/index.ts` - Secure IPC bridge
- **Global Shortcut**: Ctrl+Shift+Space (Cmd+Shift+Space on macOS) opens QuickAdd window
- **QuickAdd Mode**: `?mode=quickadd` query param loads standalone quick task entry via `inboxRepository` → sync pipeline

Security: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`

## Important Patterns

### Optimistic Updates

Stores update UI immediately, then persist. On failure, rollback:

```typescript
const originalState = { ...state };
// Update UI
setState(newState);
try {
  await repository.update(newState);
} catch (error) {
  // Rollback
  setState(originalState);
}
```

### Behavior Tracking

`behaviorTrackingService.ts` monitors user patterns (procrastination, deletions, etc.) and integrates with task operations.

### Template Auto-Generation

**Server-side only**: Firebase Function runs daily at 00:00 KST, generates tasks from templates with `autoGenerate: true`. Client reads from Firebase, never generates locally. Uses `lastTemplateGeneration` timestamp to prevent duplicate generation.

## Debugging

- **SyncLogModal**: Use `src/features/settings/SyncLogModal.tsx` to debug Firebase sync issues
- **Performance Monitor**: Enable `window.__performanceMonitor` in dev for event bus tracing
- Firebase credentials are user-provided through Settings modal; `src/data/firebase/config.ts` is gitignored

## Configuration

- **Vite**: `vite.config.ts` - Path alias `@/` → `./src/`
- **TypeScript**: Strict mode, ES2020 target
- **Tailwind**: Custom design system in `tailwind.config.ts` with CSS variables
- **Firebase**: `.firebaserc` - Project ID `test1234-edcb6`
- **Electron Builder**: `electron-builder.json` - Packaging config (artifacts in `release/`)

## Path Aliases

```typescript
import { db } from '@/data/db';
import { dailyDataStore } from '@/shared/stores';
import { someUtil } from '@/shared/utils';
```

`@/` resolves to `./src/` (configured in `vite.config.ts` and `tsconfig.json`).

## Coding Conventions

- Components: PascalCase
- Hooks/services: camelCase
- Feature-first layout
- Never call Firebase APIs directly from UI or stores - always go through repositories

### Storage Policy (CRITICAL)

**❌ DO NOT USE localStorage** (except for `theme` key):
```typescript
// ❌ WRONG - Will show deprecation warning in dev
localStorage.setItem('myKey', JSON.stringify(data));
getFromStorage('myKey', defaultValue);  // deprecated utils.ts helper

// ✅ CORRECT - Use Dexie systemState
import { db } from '@/data/db/dexieClient';
await db.systemState.put({ key: 'myKey', value: data });
const record = await db.systemState.get('myKey');
```

**Why Dexie over localStorage?**
1. Larger storage capacity (no 5MB limit)
2. Structured data with indexes
3. Async API prevents UI blocking
4. Transaction support for data integrity
5. Single source of truth for all local data

**Allowed localStorage Usage:**
- `theme` key ONLY (required before Dexie initializes)

### Default Values Policy (CRITICAL)

**❌ DO NOT USE hardcoded fallback values**:
```typescript
// ❌ WRONG - Hardcoded fallback leads to inconsistency
const focusInterval = settings?.focusTimerMinutes ?? 25;

// ✅ CORRECT - Use centralized SETTING_DEFAULTS
import { SETTING_DEFAULTS, IDLE_FOCUS_DEFAULTS, GAME_STATE_DEFAULTS } from '@/shared/constants/defaults';

const focusInterval = settings?.focusTimerMinutes ?? SETTING_DEFAULTS.focusTimerMinutes;
```

**Why centralized defaults?**
1. Single source of truth - changing one location updates everywhere
2. Prevents bugs from inconsistent fallback values across files
3. Easy to review and maintain all default values
4. Prevents "works in one place, fails in another" scenarios

**Default Constants Location**: `src/shared/constants/defaults.ts`
- `SETTING_DEFAULTS` - User settings fallbacks
- `IDLE_FOCUS_DEFAULTS` - Idle focus mode defaults
- `GAME_STATE_DEFAULTS` - Game state initialization defaults
