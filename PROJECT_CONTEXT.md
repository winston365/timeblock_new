# PROJECT_CONTEXT.md

> **Single Source of Truth** for TimeBlock Planner development context
> Last Updated: 2025-11-30
> Version: 1.0.102

---

## 📋 Project Identity

**Name**: TimeBlock Planner
**Repository**: https://github.com/winston365/timeblock_new
**Type**: Gamified Daily Task Management Desktop Application
**Platform**: Electron + React + TypeScript
**Primary Language**: Korean (UI)

### Core Purpose
Time-blocking methodology combined with gamification and AI-powered virtual companion to help users manage daily tasks with motivation and engagement.

### Key Differentiators
- **6 Time Blocks System** (5-8, 8-11, 11-14, 14-17, 17-20, 20-23)
- **Resistance Level System** (Low 1.0x, Medium 1.3x, High 1.6x)
- **AI Waifu Companion** with affection system (0-100) and dynamic poses
- **Hybrid RAG System** for context-aware AI responses
- **Firebase + Dexie** dual-layer persistence with conflict resolution
- **Server-side Template Generation** via Firebase Cloud Functions

---

## 🔄 Active Context

### Current Branch
`claude/setup-context-management-01RC6xLyNj4qjSj4xPF1YFhm`

### Recent Changes (Last 5 Commits)
```
6566a06 - chore: bump version to 1.0.102
ac525be - Add 1-minute memo challenge with XP rewards
f41cbfa - chore: bump version to 1.0.101
d456941 - Merge branch 'main'
a3c6a61 - Improve bingo progress sync and add music volume control
```

### Pending Tasks
- [ ] Setup context management system (current session)
- [ ] Review and validate PROJECT_CONTEXT.md structure
- [ ] Ensure all future sessions adhere to context lifecycle protocol

### Current Focus
**Setting up Context Management Infrastructure**
- Creating PROJECT_CONTEXT.md as single source of truth
- Establishing Context Lifecycle Protocol for all future sessions
- Ensuring AI assistant maintains accurate project state across sessions

---

## ⚙️ Operational Rules

### 🚫 Critical Prohibitions

#### 1. **NO localStorage (except `theme` key)**
```typescript
// ❌ WRONG - Shows deprecation warning
localStorage.setItem('myKey', JSON.stringify(data));

// ✅ CORRECT - Use Dexie systemState
import { db } from '@/data/db/dexieClient';
await db.systemState.put({ key: 'myKey', value: data });
const record = await db.systemState.get('myKey');
```

**Why?** Larger capacity, structured data, async API, transaction support, single source of truth.

#### 2. **NO Hardcoded Fallback Values**
```typescript
// ❌ WRONG - Inconsistent defaults
const cooldown = settings?.ignitionCooldownMinutes ?? 5;

// ✅ CORRECT - Centralized defaults
import { SETTING_DEFAULTS } from '@/shared/constants/defaults';
const cooldown = settings?.ignitionCooldownMinutes ?? SETTING_DEFAULTS.ignitionCooldownMinutes;
```

**Location**: `src/shared/constants/defaults.ts`
**Available**: `SETTING_DEFAULTS`, `IGNITION_DEFAULTS`, `IDLE_FOCUS_DEFAULTS`, `GAME_STATE_DEFAULTS`

#### 3. **NO Direct Firebase/Storage Calls from UI or Stores**
All data operations **MUST** go through the **Repository Pattern** (`src/data/repositories/`).

```typescript
// ❌ WRONG - Direct storage access
firebase.database().ref('/tasks').set(data);

// ✅ CORRECT - Through repository
dailyDataRepository.update(data);
```

#### 4. **NO Client-Side Template Generation**
Templates are generated **server-side only** via Firebase Cloud Function at 00:00 KST. Client observes, never generates.

---

### ✅ Mandatory Patterns

#### Repository Pattern
All persistence goes through `src/data/repositories/`:
```typescript
dailyDataStore.updateTask()
  → dailyDataRepository.update()
    → Dexie (IndexedDB)
    → Firebase (async via syncToFirebase())
```

#### Optimistic Updates with Rollback
```typescript
const originalState = { ...state };
setState(newState); // Update UI immediately
try {
  await repository.update(newState);
} catch (error) {
  setState(originalState); // Rollback on failure
}
```

#### Feature-Based Organization
Each feature in `src/features/` is self-contained:
```
features/
  ├── schedule/      # Time-blocking UI
  ├── waifu/         # AI companion
  ├── gamification/  # XP, quests, achievements
  ├── gemini/        # AI chat integration
  ├── ignition/      # 3-minute ignition system
  └── ...
```

#### Handler Pipeline for Task Completion
Chain of responsibility in `src/shared/services/gameplay/taskCompletion/handlers/`:
1. GoalProgressHandler
2. XPRewardHandler
3. QuestProgressHandler
4. WaifuAffectionHandler
5. BlockCompletionHandler

Add new handlers by implementing `TaskCompletionHandler` interface.

---

### 📐 Code Conventions

- **Components**: PascalCase
- **Hooks/Services**: camelCase
- **Path Alias**: `@/` → `./src/` (configured in `vite.config.ts` and `tsconfig.json`)
- **Never modify code without reading it first**
- **Avoid over-engineering**: Only make changes that are directly requested
- **No backwards-compatibility hacks**: If unused, delete completely

---

## 🛠️ Tech Stack

### Core Framework
- **Runtime**: Node.js 18+
- **Desktop**: Electron 39.2.1
- **UI Framework**: React 18.3.1
- **Language**: TypeScript 5.4.5
- **Build Tool**: Vite 7.2.2
- **CSS**: Tailwind CSS 3.4.17

### State & Data
- **State Management**: Zustand 5.0.8 (12 specialized stores)
- **Local Database**: Dexie 4.0.0 (IndexedDB ORM)
- **Cloud Sync**: Firebase 10.7.1 (Realtime Database)
- **Sync Strategy**: Last-Write-Wins (LWW) with retry queue

### AI & Intelligence
- **AI Provider**: Google Generative AI 0.24.1 (Gemini)
- **Vector Search**: Orama 3.1.16 (in-memory semantic search)
- **RAG System**: Hybrid (Structured Query + Vector Search)
- **Context**: Persona-based prompts via `src/shared/lib/personaUtils`

### UI Components
- **Icons**: Lucide React 0.554.0
- **Animation**: Framer Motion 12.23.24
- **Charts**: Recharts 2.13.2
- **Toast**: React Hot Toast 2.6.0
- **Markdown**: React Markdown 10.1.0 + Remark GFM 4.0.1
- **Effects**: Canvas Confetti 1.9.4

### Development Tools
- **Linter**: ESLint 8.57.0 + TypeScript ESLint 7.0.0
- **Auto-Update**: Electron Updater 6.6.2
- **Process Management**: Concurrently 9.2.1

---

## 📊 Database Schema (Dexie)

**Current Version**: 11 (see migrations in `src/data/db/dexieClient.ts`)

### Core Tables
| Table | Purpose | Key |
|-------|---------|-----|
| `dailyData` | Daily tasks and blocks | `YYYY-MM-DD` |
| `gameState` | Player progression | `'current'` (singleton) |
| `templates` | Reusable task templates | Auto-increment |
| `globalInbox` | Date-independent tasks | Auto-increment |
| `completedInbox` | Completed inbox tasks | Auto-increment |
| `globalGoals` | Long-term goals | Auto-increment |
| `shopItems` | Purchasable items | Auto-increment |
| `waifuState` | Companion affection | `'current'` (singleton) |
| `energyLevels` | Hourly energy tracking | `date-hour` |
| `chatHistory` | Gemini conversation | Auto-increment |
| `dailyTokenUsage` | Daily Gemini usage | `YYYY-MM-DD` |
| `systemState` | System key-value store | `key` (string) |
| `settings` | App settings | `'current'` (singleton) |
| `images` | Image storage | Auto-increment |
| `weather` | Weather cache | `location` |
| `aiInsights` | AI insight cache | `date` |

**When adding fields**: Increment version, add migration in `dexieClient.ts`, update repository, update Firebase sync strategy.

---

## 🎮 12 Zustand Stores

Located in `src/shared/stores/`:

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

**Pattern**: Stores delegate ALL persistence to repositories. Optimistic updates with rollback on failure.

---

## 🧠 RAG (Retrieval-Augmented Generation)

**Location**: `src/shared/services/rag/`

### Components
- **HybridRAGService** - Main entry point (structured + vector search)
- **QueryParser** - Natural language → structured queries
- **DirectQueryService** - Fast IndexedDB queries (date-specific, status)
- **VectorStore** - Orama-based semantic search (in-memory, rebuilt on restart)
- **AutoTagService** - Tag suggestions from history + optional AI

### Query Flow
```
User query
  → QueryParser
  → Route to:
    - DirectQuery (structured: "11월 24일 완료 작업")
    - Vector Search (semantic: "프로그래밍 관련 작업")
    - Aggregation (stats: "이번 주 몇 개 완료?")
  → AI Context
```

**Debugging**: `window.hybridRag.generateContext()` and `window.rag.debugGetAllDocs()` in dev console

---

## 🔧 Development Commands

```bash
# Development
npm run electron:dev          # Preferred E2E loop (Electron + Vite dev server)
npm run dev                   # Vite dev server (web only)

# Production Testing
npm run electron:prod         # Run production build locally
npm run preview               # Preview web build

# Build
npm run build                 # Build web assets (Vite)
npm run electron:build        # Build Electron main process
npm run dist                  # Build distributable for current platform

# Code Quality
npm run lint                  # ESLint (ONLY automated check - no test suite)
npm run bump                  # Bump patch version and commit
```

**Manual Verification Required**: Test in both `npm run preview` and `npm run electron:prod` when behavior could diverge.

---

## 🔍 Debugging Tools

### Firebase Sync
- **SyncLogModal**: `src/features/settings/SyncLogModal.tsx`
- Debug sync issues, view sync history, retry queue

### Performance
- **Event Bus Logger**: `window.__performanceMonitor` in dev mode
- Traces all event bus activity

### RAG System
- **Context Generator**: `window.hybridRag.generateContext()`
- **Document Inspector**: `window.rag.debugGetAllDocs()`

---

## 📝 Decision Log

### 2025-11-30: Context Management Setup
- **Decision**: Create PROJECT_CONTEXT.md as single source of truth
- **Rationale**: Ensure AI assistant maintains accurate project state across sessions
- **Impact**: All future sessions must follow Context Lifecycle Protocol

---

## 🎯 Entry Points

- **Web**: `src/main.tsx` → `AppShell`
- **Electron Main**: `electron/main/index.ts`
- **Electron Preload**: `electron/preload/index.ts`
- **Daily Reset**: `src/app/AppShell.tsx` + `src/app/hooks/useAppInitialization.ts`

---

## 📚 Reference Documents

- **CLAUDE.md**: Comprehensive project documentation (15KB)
- **DEVELOPMENT.md**: Development guidelines (23KB)
- **README.md**: User-facing documentation (14KB)

---

*This document is the living memory of TimeBlock Planner. Keep it updated after every significant change.*
