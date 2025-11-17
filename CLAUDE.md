# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TimeBlock Planner is a **cross-platform desktop application** built with Electron that combines time-blocking, gamification, and AI coaching to help users with ADHD/ASD manage their tasks effectively. The app features a visual novel-style AI companion (혜은) powered by Google Gemini AI.

## Build & Development Commands

### Web Development
```bash
npm install              # Install dependencies
npm run dev              # Start Vite dev server (http://localhost:5173)
npm run build            # Build for production (Vite bundle)
npm run preview          # Preview production build
npm run lint             # Run ESLint
```

### Electron Development
```bash
npm run electron:build   # Compile TypeScript for Electron (main/preload)
npm run electron:dev     # Start Electron in development mode
npm run electron:prod    # Build and run Electron in production mode
```

### Distribution
```bash
npm run dist             # Build and package for current platform
npm run dist:win         # Package for Windows (.exe installer)
npm run dist:mac         # Package for macOS (.dmg)
npm run dist:linux       # Package for Linux (AppImage)
npm run bump             # Bump version (patch) and create git tag
```

### Development Setup

**Prerequisites**:
- Node.js 20+ (ES2020+ support required)
- npm or compatible package manager
- Git (for version control and GitHub releases)

**Environment Variables**:
- **No `.env` file required** - Application works without environment variables
- Firebase configuration is gitignored (`src/data/firebase/config.ts`)
- Gemini API keys configured via Settings modal (stored in IndexedDB)

**First-Time Setup**:
1. `npm install` - Install all dependencies
2. `npm run dev` - Start Vite dev server (web mode)
3. OR `npm run electron:dev` - Start Electron app (desktop mode)
4. Configure API keys via Settings modal (Gemini/Firebase)

**Build Output**:
- **Web**: `dist/` (Vite bundled output)
- **Electron**: `dist-electron/` (TypeScript compiled to CommonJS)
- **Distributables**: `release/` (electron-builder packages)
- Entry point: `index.html` → `src/main.tsx`
- Electron entry: `dist-electron/main/index.cjs`

## Architecture Overview

### Tech Stack
- **Desktop Framework**: Electron 39.2.1
  - Main process: Node.js (IPC, auto-updates, window management)
  - Preload script: Secure context bridge (sandboxed)
  - Renderer: React 18.3.1 (web content)
- **Frontend**: React 18.3.1 + TypeScript 5.4.5
- **Build Tools**:
  - Vite 7.2.2 (web bundler, `@` alias for `/src`)
  - TypeScript Compiler (Electron processes)
- **State Management**: Zustand 5.0.8 (stores in `src/shared/stores/`)
- **Local Database**: Dexie 4.0.0 (IndexedDB) + dexie-react-hooks 1.1.7
- **Cloud Sync**: Firebase Realtime Database 10.7.1 (dual-write, conflict resolution)
- **AI Integration**: Google Gemini 2.5 Flash API (visual novel chat, insights, task breakdown)
- **Auto-Updates**: electron-updater 6.6.2 (GitHub releases)

### Build Configuration

**Vite** (`vite.config.ts`):
- Plugin: `@vitejs/plugin-react` 4.3.0
- Path alias: `@` → `./src` (absolute imports)
- Base path: `./` (relative paths for Electron)
- Entry: `src/main.tsx`

**TypeScript** (`tsconfig.json`):
- Target: ES2020, Module: ESNext
- Module resolution: `bundler` (Vite-optimized)
- Strict mode: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- JSX: `react-jsx` (automatic runtime)
- Path mapping: `@/*` → `./src/*`

**Electron TypeScript** (`tsconfig.electron.json`):
- Target: ES2020, Module: CommonJS
- Output: `dist-electron/` directory
- Includes: `electron/**/*` (main + preload)

**Electron Builder** (`electron-builder.json`):
- App ID: `com.timeblock.planner`
- Product Name: `TimeBlock Planner`
- Output: `release/` directory
- Build resources: `electron/resources/` (icons)
- Publish: GitHub releases (`winston365/timeblock_new`)
- Platforms: Windows (NSIS), macOS (DMG), Linux (AppImage)

**Linting**:
- ESLint 8.57.0 + TypeScript plugin 7.0.0
- React Hooks + React Refresh plugins
- Run via: `npm run lint`

### Directory Structure

```
/
├── index.html                     # HTML entry point (Vite SPA)
├── package.json                   # Dependencies and npm scripts
├── vite.config.ts                 # Vite build configuration
├── tsconfig.json                  # TypeScript config (Vite/React)
├── tsconfig.electron.json         # TypeScript config (Electron)
├── tsconfig.node.json             # TypeScript config (build tools)
├── electron-builder.json          # Electron packaging configuration
├── .gitignore                     # Git ignore (includes Firebase config, .env, dist)
│
├── .github/workflows/             # GitHub Actions CI/CD
│   └── release.yml                # Automated release workflow (Windows build)
│
├── scripts/                       # Build scripts
│   └── build-electron.cjs         # Electron TypeScript compilation script
│
├── electron/                      # Electron desktop app code
│   ├── main/
│   │   └── index.ts               # Main process (window, lifecycle, auto-updater)
│   ├── preload/
│   │   └── index.ts               # Preload script (context isolation)
│   └── resources/                 # App icons
│       ├── icon.ico               # Windows icon
│       ├── icon.icns              # macOS icon
│       ├── icon.png               # Linux icon
│       └── README.md
│
├── public/                        # Static assets (copied to dist as-is)
│   └── assets/waifu/poses/        # Waifu character images (production)
│       ├── hostile/               # Affection tier 1 (0-20)
│       ├── wary/                  # Affection tier 2 (21-40)
│       ├── indifferent/           # Affection tier 3 (41-60)
│       ├── affectionate/          # Affection tier 4 (61-80)
│       └── loving/                # Affection tier 5 (81-100)
│
└── src/                           # Source code
    ├── main.tsx                   # React app entry point + theme initialization
    ├── App.tsx                    # Root component (renders AppShell)
    ├── vite-env.d.ts              # Vite environment + image asset type declarations
    │
    ├── styles/                    # Global CSS architecture
    │   ├── design-system.css      # Typography & spacing system (CSS variables)
    │   ├── globals.css            # Color tokens, resets, utility classes
    │   └── layout.css             # Layout-specific styles
    │
    ├── app/                       # Application shell and layout
    │   ├── AppShell.tsx           # Main app container (daily reset logic)
    │   └── components/            # Layout components
    │       ├── TopToolbar.tsx     # Top navigation bar
    │       ├── LeftSidebar.tsx    # Left navigation sidebar
    │       ├── RightPanel.tsx     # Right panel (quests, shop, waifu, goals)
    │       └── CenterContent.tsx  # Main content area (schedule, inbox, stats)
    │
    ├── features/                  # Feature modules (domain-driven organization)
    │   ├── gemini/                # Gemini AI chat integration
    │   │   ├── GeminiFullscreenChat.tsx  # Visual novel-style chat UI
    │   │   └── gemini-fullscreen.css
    │   ├── waifu/                 # Waifu companion system
    │   │   ├── WaifuPanel.tsx     # Waifu display panel
    │   │   ├── waifuImageUtils.ts # Image selection & fallback logic
    │   │   └── waifu.css
    │   ├── insight/               # AI-generated insights
    │   │   └── InsightPanel.tsx   # Auto-refreshing insight display
    │   ├── schedule/              # Time block scheduling
    │   │   ├── ScheduleView.tsx   # Drag-and-drop schedule interface
    │   │   ├── TimeBlock.tsx      # Individual time block component
    │   │   ├── TaskCard.tsx       # Task card with resistance indicators
    │   │   ├── TaskModal.tsx      # Task creation/edit modal
    │   │   ├── MemoModal.tsx      # Task memo viewer/editor
    │   │   ├── HourBar.tsx        # Hour label sidebar
    │   │   ├── CurrentTimeIndicator.tsx  # Real-time clock indicator
    │   │   ├── TimerConfirmModal.tsx     # Focus timer confirmation
    │   │   ├── CompletionCelebrationModal.tsx  # Block completion celebration
    │   │   ├── hooks/             # Schedule-specific hooks
    │   │   │   ├── useDragDrop.ts        # Legacy drag-drop logic
    │   │   │   └── useDragDropManager.ts # Current drag-drop manager
    │   │   └── schedule.css
    │   ├── tasks/                 # Task management
    │   │   ├── InboxTab.tsx       # Global inbox view (date-independent)
    │   │   ├── CompletedTab.tsx   # Completed tasks history
    │   │   ├── BulkAddModal.tsx   # Bulk task addition
    │   │   ├── tasks.css
    │   │   └── bulkAdd.css
    │   ├── goals/                 # Daily goals tracking
    │   │   ├── GoalPanel.tsx      # Goal progress display
    │   │   ├── GoalModal.tsx      # Goal creation/edit modal
    │   │   └── goals.css
    │   ├── gamification/          # XP, leveling, quests
    │   │   ├── QuestsPanel.tsx    # Daily quests display
    │   │   ├── LevelUpNotification.tsx  # Level-up celebration
    │   │   └── gamification.css
    │   ├── energy/                # Energy tracking system
    │   │   ├── EnergyTab.tsx      # Energy level visualization
    │   │   └── energy.css
    │   ├── settings/              # User settings
    │   │   ├── SettingsModal.tsx  # Settings configuration UI
    │   │   ├── SyncLogModal.tsx   # Firebase sync log viewer
    │   │   ├── settings.css
    │   │   └── syncLog.css
    │   ├── shop/                  # XP shop for rewards
    │   │   ├── ShopPanel.tsx      # Shop display
    │   │   ├── ShopModal.tsx      # Shop purchase interface
    │   │   └── shop.css
    │   ├── stats/                 # Statistics and analytics
    │   │   ├── StatsTab.tsx       # Statistics dashboard
    │   │   └── stats.css
    │   ├── template/              # Recurring task templates
    │   │   ├── TemplatePanel.tsx  # Template quick actions
    │   │   ├── TemplatesModal.tsx # Template management UI
    │   │   ├── TemplateModal.tsx  # Template creation/edit
    │   │   ├── template.css
    │   │   └── templatesModal.css
    │   └── quickadd/              # Global hotkey quick task addition
    │       ├── QuickAddTask.tsx   # Quick task addition popup (global shortcut)
    │       └── quickadd.css
    │
    ├── data/                      # Data layer
    │   ├── db/
    │   │   └── dexieClient.ts     # IndexedDB schema (10 tables, version 4)
    │   └── repositories/          # Repository pattern for data access
    │       ├── baseRepository.ts         # Common repository patterns & utilities
    │       ├── dailyDataRepository.ts    # Tasks & time block states
    │       ├── dailyGoalRepository.ts    # Daily goals
    │       ├── inboxRepository.ts        # Global inbox (date-independent tasks)
    │       ├── gameStateRepository.ts    # XP, level, quests
    │       ├── waifuRepository.ts        # Waifu affection state
    │       ├── chatHistoryRepository.ts  # Gemini chat messages
    │       ├── templateRepository.ts     # Task templates
    │       ├── shopRepository.ts         # Shop items
    │       ├── energyRepository.ts       # Energy tracking data
    │       ├── settingsRepository.ts     # User settings
    │       └── index.ts                  # Repository exports
    │
    └── shared/                    # Shared resources
        ├── services/              # External service integrations
        │   ├── aiService.ts       # Unified AI service (context + persona + API)
        │   ├── geminiApi.ts       # Gemini API client (fetch-based)
        │   ├── firebaseService.ts # Legacy Firebase service
        │   ├── syncLogger.ts      # Sync operation logger
        │   ├── firebase/          # Firebase sync infrastructure
        │   │   ├── firebaseClient.ts      # Firebase initialization
        │   │   ├── syncCore.ts            # Core sync engine
        │   │   ├── strategies.ts          # Merge strategies
        │   │   ├── conflictResolver.ts    # Conflict resolution logic
        │   │   ├── syncUtils.ts           # Sync utilities
        │   │   ├── syncRetryQueue.ts      # Retry queue for failed syncs
        │   │   ├── firebaseDebug.ts       # Debug logging
        │   │   └── README.md
        │   ├── taskCompletion/    # Task completion event handling
        │   │   ├── taskCompletionService.ts  # Main service orchestrator
        │   │   ├── types.ts                  # Task completion types
        │   │   ├── index.ts
        │   │   └── handlers/              # Event handlers
        │   │       ├── xpRewardHandler.ts        # XP calculation & rewards
        │   │       ├── questProgressHandler.ts   # Quest progress updates
        │   │       ├── waifuAffectionHandler.ts  # Waifu affection changes
        │   │       ├── blockCompletionHandler.ts # Block completion logic
        │   │       └── goalProgressHandler.ts    # Goal progress tracking
        │   └── gameState/         # Game state event handling
        │       ├── gameStateEventHandler.ts  # XP gain, quest updates
        │       ├── types.ts
        │       └── index.ts
        ├── stores/                # Zustand state stores
        │   ├── dailyDataStore.ts  # Daily tasks & blocks state
        │   ├── gameStateStore.ts  # Gamification state
        │   ├── waifuCompanionStore.ts  # Waifu companion state
        │   └── settingsStore.ts   # App settings state
        ├── hooks/                 # Custom React hooks
        │   ├── useDailyData.ts    # Daily data state hook
        │   ├── useGameState.ts    # Game state hook
        │   ├── useWaifuState.ts   # Waifu state hook
        │   ├── useEnergyState.ts  # Energy tracking hook
        │   ├── useXPToast.ts      # XP notification hook
        │   ├── useKeyboardNavigation.ts  # Keyboard shortcuts
        │   └── index.ts           # Hook exports
        ├── components/            # Reusable UI components
        │   ├── XPBar.tsx          # XP progress bar
        │   ├── XPBar.css
        │   ├── XPToast.tsx        # XP gain toast notification
        │   ├── XPToast.css
        │   ├── SyncErrorToast.tsx # Sync error notification
        │   └── SyncErrorToast.css
        ├── types/
        │   └── domain.ts          # Core domain type definitions (341 lines)
        ├── lib/                   # Utility libraries
        │   ├── constants.ts       # App constants (time blocks, etc.)
        │   ├── utils.ts           # General utilities (linkifyText, storage, etc.)
        │   └── personaUtils.ts    # Persona context builder (buildPersonaContext)
        └── utils/
            └── gamification.ts    # XP calculation utilities
```

## Key Architectural Patterns

### 1. Electron Desktop App Architecture

**Process Model**:
- **Main Process** (`electron/main/index.ts`):
  - Creates and manages BrowserWindow
  - Handles app lifecycle (ready, activate, quit)
  - Auto-updater integration (electron-updater)
  - Native OS integration (menus, dialogs, notifications)
  - IPC communication with renderer
- **Preload Script** (`electron/preload/index.ts`):
  - Context-isolated bridge between main and renderer
  - Exposes safe APIs to renderer
- **Renderer Process** (`src/**`):
  - React application (sandboxed)
  - No direct Node.js access (security)
  - Communicates via IPC

**Auto-Update System**:
- Powered by `electron-updater`
- Checks for updates 5 seconds after launch, then every 12 hours
- Downloads updates in background with user confirmation
- Installs on app quit or immediate restart
- Update manifest: `latest.yml` in GitHub releases
- Update server: GitHub releases (`winston365/timeblock_new`)

**Build Process**:
1. **Web**: `npm run build` → Vite bundles to `dist/`
2. **Electron**: `npm run electron:build` → TypeScript compiles to `dist-electron/`
3. **Package**: `npm run dist` → electron-builder packages to `release/`

**CI/CD** (`.github/workflows/release.yml`):
- Triggers on push to `main` branch
- Auto-bumps version (patch)
- Deletes existing git tag (if duplicate)
- Builds Windows installer
- Creates GitHub release with artifacts
- Uploads: `.exe`, `.exe.blockmap`, `latest.yml`

### 2. Repository Pattern

All data access goes through repositories in `src/data/repositories/`. Each repository:
- Extends patterns from `baseRepository.ts`
- Manages IndexedDB operations via Dexie
- Handles Firebase sync (dual-write pattern with fallback on read)
- Provides typed data access functions

**Data Loading Strategy** (3-tier fallback):
```
1. IndexedDB (fast, local-first) → Return if found
2. localStorage (backup)         → Return if found, save to IndexedDB
3. Firebase (cloud sync)         → Return if found, save to IndexedDB
4. Empty/default data            → Create initial data, save to all layers
```

**Data Writing Strategy** (dual-write):
```
1. Write to IndexedDB (local source of truth)
2. Write to localStorage (backup)
3. Sync to Firebase asynchronously (background)
   - Retry queue if sync fails
   - Conflict resolution with merge strategies
```

**Key Repositories**:
- `dailyDataRepository.ts` - Tasks and time block states per date
- `inboxRepository.ts` - Global inbox (date-independent tasks)
- `dailyGoalRepository.ts` - Daily goals
- `gameStateRepository.ts` - XP, level, quests (single record)
- `templateRepository.ts` - Task templates
- `waifuRepository.ts` - Waifu state
- `chatHistoryRepository.ts` - Gemini chat history
- `energyRepository.ts` - Energy tracking data
- `settingsRepository.ts` - User settings
- `shopRepository.ts` - Shop items

### 3. State Management Strategy

- **Zustand stores** (`src/shared/stores/`): Global reactive state
  - `gameStateStore.ts` - Game state (XP, level, quests)
  - `waifuCompanionStore.ts` - Waifu state (affection, pose)
  - `settingsStore.ts` - App settings (API keys, Firebase)
  - `dailyDataStore.ts` - Daily data (tasks, blocks, goals)
- **Custom hooks** (`src/shared/hooks/`): Encapsulate state logic
  - `useGameState.ts`, `useWaifuState.ts`, `useDailyData.ts`
  - Hooks subscribe to stores and repositories
- **IndexedDB as source of truth**: All state persisted via Dexie
- **Store initialization**: Stores load from repositories on mount

### 4. Data Flow

**Write Flow**:
```
User Action → Repository (IndexedDB + localStorage + Firebase sync) → Store update → UI re-render
```

**Read Flow** (with fallback):
```
Hook → Repository → IndexedDB → localStorage → Firebase → Default
                      ↓             ↓             ↓
                   Return        Return        Return & Save
```

**Task Completion Flow**:
```
Task Completed → taskCompletionService.ts
  ├─ xpRewardHandler → Calculate XP, update gameState
  ├─ questProgressHandler → Update quest progress
  ├─ waifuAffectionHandler → Update waifu affection
  ├─ blockCompletionHandler → Check block completion (perfect/partial)
  └─ goalProgressHandler → Update goal progress
```

**Key Principles**:
- **Local-first**: IndexedDB is source of truth
- **Optimistic updates**: UI updates immediately from IndexedDB
- **Background sync**: Firebase sync happens asynchronously
- **Cross-device availability**: Firebase fallback ensures data accessible anywhere
- **Conflict resolution**: Merge strategies handle concurrent updates
- **Event-driven architecture**: Task completion triggers multiple handlers

### 5. Module Organization

**Feature-First Structure**:
- Each feature module is self-contained with UI components + CSS
- Shared business logic in `src/shared/` (hooks, stores, services)
- Data access abstracted through repositories (no direct Dexie calls from UI)

**Import Path Convention**:
- Use `@/` alias for absolute imports: `import { X } from '@/shared/hooks'`
- Relative imports discouraged (harder to refactor)
- All repository/store imports should use absolute paths

**Component Organization**:
- Top-level feature components in `src/features/{feature}/`
- Layout components in `src/app/components/`
- Reusable shared components in `src/shared/components/`
- CSS files colocated with feature components

### 6. Firebase Sync Architecture

Located in `src/shared/services/firebase/`

**Core Modules**:
- `syncCore.ts`: Core sync engine
  - `syncToFirebase<T>(strategy, data, key)`: Write data to Firebase
  - `fetchFromFirebase<T>(strategy, key)`: Read data from Firebase (fallback)
  - `listenToFirebase<T>(strategy, onUpdate, key)`: Real-time listener
- `strategies.ts`: Merge strategies (client-wins, server-wins, last-write-wins)
- `conflictResolver.ts`: Conflict resolution logic
- `syncRetryQueue.ts`: Retry queue for failed syncs (exponential backoff)
- `firebaseClient.ts`: Firebase initialization
- `firebaseDebug.ts`: Debug logging

**Dual-Write Pattern**:
1. Write to IndexedDB (immediate, local)
2. Write to localStorage (backup)
3. Sync to Firebase (async, background)
   - If sync fails → Add to retry queue
   - Retry with exponential backoff

**Synced Collections**:
- `dailyData`: Tasks, time block states, goals (per date)
- `globalInbox`: Date-independent inbox tasks (all tasks)
- `gameState`: XP, level, quests (single record)
- `waifuState`: Waifu affection, pose (single record)
- `chatHistory`: Gemini chat messages (per date)
- `dailyTokenUsage`: Daily API token usage (per date)
- `energyLevels`: Energy tracking data (per date)
- `templates`: Task templates (all templates as array, key: 'all')

## Code Conventions & Standards

### File Naming
- **Components**: PascalCase with `.tsx` extension (e.g., `TaskCard.tsx`, `AppShell.tsx`)
- **Utilities/Services**: camelCase with `.ts` extension (e.g., `geminiApi.ts`, `waifuImageUtils.ts`)
- **Stores**: camelCase with `Store` suffix (e.g., `gameStateStore.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useGameState.ts`)
- **Repositories**: camelCase with `Repository` suffix (e.g., `dailyDataRepository.ts`)
- **Types**: `domain.ts` for core domain types
- **CSS**: Lowercase with dashes, colocated with components (e.g., `gemini-fullscreen.css`)

### Code Documentation
- **JSDoc comments** used extensively for functions and components
- Standard format:
  ```typescript
  /**
   * Brief description
   *
   * @role Purpose in the system
   * @input Parameter description
   * @output Return value description
   * @dependencies External dependencies
   */
  ```
- All files include header comment with `@role` annotation
- Korean comments common in codebase

### TypeScript Conventions
- Strict mode enabled - all type errors must be resolved
- Prefer `interface` over `type` for object shapes (domain types)
- Use `type` for unions, intersections, and utility types
- Avoid `any` - use `unknown` and type guards instead
- All React components typed with explicit return types
- Use `@/` path alias for imports

### React Patterns
- Functional components only (no class components)
- Hooks for all stateful logic
- Custom hooks for reusable logic (prefixed with `use`)
- `React.StrictMode` enabled in production
- Zustand for global state, local `useState` for component-specific state

## Domain Model

### Core Entities (see `src/shared/types/domain.ts`)

**Task**: Individual work items with:
- `id`: Unique identifier (timestamp-based)
- `text`: Task title
- `memo`: Detailed notes (supports URL linkification)
- `baseDuration`: Estimated time (minutes)
- `adjustedDuration`: Time with resistance multiplier
- `resistance`: Psychological difficulty (low/medium/high)
  - Low: 1x multiplier
  - Medium: 1.5x multiplier
  - High: 2x multiplier
- `timeBlock`: 5-hour block assignment (5-8, 8-11, 11-14, 14-17, 17-19, 19-24) or `null` (inbox)
- `hourSlot`: Specific hour within block (optional)
- `completed`: Boolean completion status
- `actualDuration`: Actual time spent (minutes)
- `preparation1-3`: Pre-task preparation notes
- `timerUsed`: Focus timer usage (bonus XP)
- `fromAutoTemplate`: Auto-generated from template
- `goalId`: Linked daily goal ID
- `createdAt`, `completedAt`: ISO 8601 timestamps

**TimeBlock**: 6 fixed daily blocks (5-8, 8-11, 11-14, 14-17, 17-19, 19-24) with:
- `isLocked`: Lock mechanism (prevents changes)
- `isPerfect`: Perfect completion (all tasks done)
- `isFailed`: Failed block
- `lockTimerStartedAt`: Lock timer start time
- `lockTimerDuration`: Lock duration (default 5 minutes)

**DailyGoal**: Time-based daily goals
- `id`: Unique identifier
- `title`: Goal name (e.g., "영어", "운동")
- `targetMinutes`: Target time (minutes)
- `plannedMinutes`: Sum of linked task estimated times
- `completedMinutes`: Sum of linked task actual times
- `color`: Progress bar color
- `icon`: Emoji icon
- `order`: Display order

**GameState**: Gamification layer
- `level`: Player level
- `totalXP`, `dailyXP`, `availableXP`: XP tracking
- `streak`: Consecutive login days
- `lastLogin`: Last login date (YYYY-MM-DD)
- `questBonusClaimed`: Daily quest bonus claimed
- `xpHistory`: Last 7 days XP (for charts)
- `dailyQuests`: 6 quest types (complete_tasks, earn_xp, lock_blocks, perfect_blocks, prepare_tasks, use_timer)
- `timeBlockXP`: XP per block (for block-specific tracking)
- `timeBlockXPHistory`: Historical block XP data
- `completedTasksHistory`: Completed task archive
- `dailyTimerCount`: Timer usage count today

**WaifuState**: AI companion
- `affection`: 0-100 (5 tiers: hostile 0-20, wary 21-40, indifferent 41-60, affectionate 61-80, loving 81-100)
- `currentPose`: Current emotion/pose filename
- `lastInteraction`: Last interaction timestamp
- `tasksCompletedToday`: Daily task completion count
- `totalInteractions`: Total interaction count
- `lastIdleWarning`: Last idle warning timestamp
- `unlockedPoses`: Special unlocked poses
- `lastAffectionTier`: Previous affection tier
- `clickCount`: Click counter (for click-based interactions)
- `poseLockedUntil`: Pose lock expiration timestamp

**Template**: Recurring tasks with:
- `id`, `name`, `text`, `memo`: Basic info
- `baseDuration`, `resistance`: Task properties
- `timeBlock`: Default block assignment
- `autoGenerate`: Auto-generation enabled
- `recurrenceType`: none/daily/weekly/interval
- `weeklyDays`: Days for weekly recurrence (0=Sunday, 6=Saturday)
- `intervalDays`: Interval for interval recurrence
- `lastGeneratedDate`: Last generation date (YYYY-MM-DD)
- `preparation1-3`: Preparation notes
- `category`: User-defined category
- `isFavorite`: Favorite status

**Settings**: App configuration
- `geminiApiKey`: Gemini API key
- `firebaseConfig`: Firebase configuration object
- `autoMessageInterval`: Auto-message interval (minutes)
- `autoMessageEnabled`: Auto-message enabled
- `waifuMode`: 'normal' | 'characteristic' (waifu display mode)
- `templateCategories`: Template category list

**EnergyLevel**: Energy tracking
- `timestamp`: Record time (milliseconds)
- `hour`: Hour (0-23)
- `energy`: Energy level (0-100)
- `context`: Situation/context
- `activity`: Activity type

**GeminiChatMessage**: Chat messages
- `id`: Unique identifier
- `role`: 'user' | 'model'
- `text`: Message content
- `timestamp`: Message time
- `category`: 'task-advice' | 'motivation' | 'qa' | 'analysis'
- `tokenUsage`: Token usage stats (promptTokens, candidatesTokens, totalTokens)

## IndexedDB Schema (Dexie)

Database name: `timeblock_db`

**Current Version**: 4

**Tables**:
1. `dailyData` - Tasks, block states, goals per date (primary key: date)
   - Indexes: `date`, `updatedAt`
2. `globalInbox` - Date-independent inbox tasks (primary key: id)
   - Indexes: `id`, `createdAt`, `completed`
   - **Added in v3**: Migrates all inbox tasks from dailyData
3. `gameState` - Single record (key: 'current')
4. `templates` - Task templates (primary key: id)
5. `shopItems` - XP shop items (primary key: id)
6. `waifuState` - Single record (key: 'current')
7. `energyLevels` - Energy tracking (composite id: date + timestamp)
8. `settings` - App settings (key: 'current')
9. `chatHistory` - Gemini chat messages per date (primary key: date)
10. `dailyTokenUsage` - Daily Gemini token usage (primary key: date)

**Schema Migrations**:
- **Version 1**: Initial schema
- **Version 2**: Added chatHistory, dailyTokenUsage
- **Version 3**: Added globalInbox (migrated inbox tasks from dailyData)
- **Version 4**: Added goals field to dailyData

**Migration Logic**:
- Auto-migrates localStorage data to IndexedDB on first run
- Handles dailyPlans → dailyData migration
- Version 3 upgrade: Moves all inbox tasks (timeBlock === null) to globalInbox
- Version 4 upgrade: Adds empty goals array to all dailyData records

## AI Integration

### Unified AI Service (`aiService.ts`)

**Architecture**:
1. Collects current state context (`PersonaContext`)
2. Generates AI persona prompt (base personality)
3. Combines with request-specific instructions
4. Calls Gemini API
5. Returns response + token usage

**Usage**:
```typescript
import { callAI } from '@/shared/services/aiService';

const result = await callAI({
  dailyData, gameState, waifuState, currentEnergy,
  apiKey,
  type: 'chat', // 'chat' | 'insight' | 'task-breakdown' | 'custom'
  userPrompt: 'User message',
  history: chatHistory,
  additionalInstructions: 'Output format...'
});
```

### Gemini API (`geminiApi.ts`)

**Configuration**:
- Model: `gemini-2.5-flash-preview-05-20`
- Endpoint: `generativelanguage.googleapis.com/v1beta/models/`
- Context window: Max 20 messages history
- Generation config: temp=0.9, topK=40, topP=0.95, maxOutputTokens=8192

**Persona System** (`buildPersonaContext` in `personaUtils.ts`):
- Builds context object with:
  - Waifu affection level, game state (level, XP)
  - Task completion data (inbox, completed, resistance)
  - Time block status (locked, perfect, failed)
  - Energy levels and patterns
  - 7-day XP trends and completion patterns
- `generateWaifuPersona(PersonaContext)` creates system prompt

**Persona Characteristics**:
- 19-year-old counselor AI named "혜은" (Hyeeun)
- ADHD/ASD specialized support
- Panoptic empathy + intimate omniscience
- Tone varies by affection level:
  - Hostile (0-20): Cold, distant
  - Wary (21-40): Cautious, reserved
  - Indifferent (41-60): Neutral, professional
  - Affectionate (61-80): Warm, encouraging
  - Loving (81-100): Intimate, caring

### Waifu Image System

**Affection Tiers** (5 tiers):
1. `hostile` (0-20 affection)
2. `wary` (21-40 affection)
3. `indifferent` (41-60 affection)
4. `affectionate` (61-80 affection)
5. `loving` (81-100 affection)

**Image Storage**:
- Production: `public/assets/waifu/poses/{tier}/hyeeun_{emotion}.png`
- Tier directories: `hostile/`, `wary/`, `indifferent/`, `affectionate/`, `loving/`

**Filename Format**: `hyeeun_{emotion}.png`
- Examples: `hyeeun_happy.png`, `hyeeun_blushing shyly.png`, `hyeeun_neutral.png`
- Spaces in emotion names are allowed

**Image Utility** (`waifuImageUtils.ts`):
- `getWaifuImage(tier, emotion)`: Get specific image path
- `getRandomWaifuImage(tier)`: Random selection within tier
- Automatic fallback chain: tier-specific → placeholder

**Asset Handling**:
- Vite type declarations in `vite-env.d.ts` (PNG, JPG, JPEG, GIF, SVG, WEBP)
- Images imported as strings (bundled URLs)
- Public assets served at `/assets/` path

## Important Implementation Details

### Time Block System
- Blocks defined as string literals: `'5-8' | '8-11' | '11-14' | '14-17' | '17-19' | '19-24' | null`
- `null` = inbox (unscheduled tasks, now in globalInbox)
- Lock prevents task edits after block starts
- Perfect = all tasks completed in block
- Lock timer: 5-minute countdown before lock activates

### Global Inbox System
- **Added in v3**: Date-independent inbox tasks
- Previously: Inbox tasks stored in dailyData (per date)
- Now: Inbox tasks in `globalInbox` table (persistent across dates)
- Migration: v3 upgrade moves all inbox tasks to globalInbox
- Benefits:
  - No data loss from date changes
  - Persistent inbox across app sessions
  - Faster inbox queries (no date filtering)

### Daily Goals System
- **Added in v4**: Time-based goal tracking
- Stored in `dailyData.goals` array (per date)
- Tasks link to goals via `goalId` field
- Progress calculation:
  - `plannedMinutes`: Sum of linked task `baseDuration`
  - `completedMinutes`: Sum of linked completed task `actualDuration`
- Visual progress bars with custom colors/icons

### XP Calculation (`gamification.ts`)
- Base XP per task: 10
- Resistance multipliers: low (1x), medium (1.5x), high (2x)
- Timer bonus: +5 XP for using focus timer
- Preparation bonus: +1 XP per filled preparation field
- Block completion bonuses (perfect/partial)
- XP tracked per block in `gameState.timeBlockXP`

### Task Completion Event System
- Orchestrated by `taskCompletionService.ts`
- Triggers 5 handlers on task completion:
  1. **xpRewardHandler**: Calculate XP, update gameState
  2. **questProgressHandler**: Update quest progress
  3. **waifuAffectionHandler**: Update waifu affection (+1-5 based on resistance)
  4. **blockCompletionHandler**: Check block completion (perfect/partial)
  5. **goalProgressHandler**: Update linked goal progress
- All handlers run in parallel
- Results logged to sync logger

### Daily Reset Logic
- Runs on date change (checked in AppShell)
- Auto-generates recurring templates
  - Daily templates: Generate every day
  - Weekly templates: Generate on specified weekdays
  - Interval templates: Generate every N days
- Resets daily quests
- Archives completed tasks to history
- Clears time block locks
- Resets daily timer count

### CSS Architecture & Theming

**Three-Layer CSS System** (no Tailwind/PostCSS):

1. **`design-system.css`** - Design tokens and scales
   - Typography system: 1.25 ratio scale (12px → 48px)
   - Font families: Apple system fonts + Noto Sans KR
   - Font weights: 300 (light) → 800 (extrabold)
   - Line heights: tight (1.25) → loose (2.0)
   - Letter spacing: tighter (-0.05em) → widest (0.1em)
   - Spacing system: 8px base grid (0.25rem → 20rem)
   - Border radius: sm (4px) → 2xl (24px)

2. **`globals.css`** - Theme colors, resets, utilities
   - Dark mode color palette (CSS custom properties):
     - Primary: `#6366f1` (indigo)
     - Backgrounds: `--color-bg-base` (#0a0e1a), `--color-bg-surface` (#1a2030), `--color-bg-elevated` (#2d3950)
     - Text: `--color-text-primary` → `--color-text-tertiary`
     - Semantic: success, warning, danger, reward (gold)
   - Global resets: box-sizing, margins, padding
   - Utility classes: `.memo-link` (URL linkification styling)
   - Modal z-index hierarchy (1000 → 9999)

3. **`layout.css`** - Layout-specific styles
   - Grid/flexbox layouts for app shell
   - Component-specific positioning

**Theme Initialization**:
- Theme loaded from `localStorage.getItem('theme')` in `main.tsx`
- Applied via `document.documentElement.setAttribute('data-theme', savedTheme)`
- Allows for future light/dark mode switching

### URL Linkification in Memos
- **Utility**: `linkifyText()` in `src/shared/lib/utils.ts`
- Automatically converts URLs in task/template memos to clickable links
- Supports patterns: `http://`, `https://`, `www.` (auto-prepends http://)
- Security: Opens in new tab with `rel="noopener noreferrer"`
- Styling: `.memo-link` class in `globals.css`
  - Dotted underline (default) → Solid underline (hover)
  - Uses theme primary color
  - Visited links use secondary color

### Modal z-index Hierarchy
- Standard modals: `z-index: 1000` (`.modal-overlay`)
- Settings modal: `z-index: 1000` with width enforcement (`600px !important`)
- Templates modal: `z-index: 2000` (`.templates-modal-overlay`)
- Celebration modal: `z-index: 9999 !important` (`.celebration-overlay`)
  - Highest priority to ensure visibility over all UI elements

## Feature-Specific Notes

### FullscreenChat (Gemini)
- Visual novel style: 50/50 split (waifu image | chat interface)
- Image changes randomly within affection tier on each Gemini response
- Max 20 messages sent to API for context (memory limit)
- Supports waifuMode: 'normal' vs 'characteristic' (affection-based)
- Token usage tracking per message
- Daily token usage aggregation

### Schedule View
- Drag-and-drop task assignment to blocks
- Uses `useDragDropManager` hook
- Time block locking mechanism (5-minute countdown)
- Resistance-based duration adjustments visualized
- Current time indicator (real-time clock)
- Hour bar with labels (5-24)
- Keyboard navigation support

### Template System
- Recurrence types: daily, weekly (with day selection), interval (every N days)
- Auto-generation controlled by `autoGenerate` boolean
- Last generated date tracking prevents duplicates
- Templates can be favorited and categorized
- **Next Occurrence Display**: Template cards show next occurrence date
  - Calculated from `lastGeneratedDate` and `recurrenceType`
  - Korean relative dates: 오늘, 내일, 모레, N일 후, M/D
  - Logic in `TemplatesModal.tsx`: `getNextOccurrence()` and `formatRelativeDate()`
- **Firebase Sync**: All template CRUD operations sync to Firebase
  - Collection: 'templates', Key: 'all' (entire array)
  - Strategy: Last-Write-Wins (templateStrategy)

### InsightPanel (AI-generated insights)
- **Auto-refresh interval**: Configurable in settings (default: 15 minutes)
- **Smart regeneration**: Respects time intervals using localStorage
  - `lastInsightGenerationTime`: Tracks last generation timestamp
  - `lastInsightText`: Stores last insight for display on reload
  - Skips regeneration if interval hasn't passed (prevents unnecessary API calls)
- **Retry logic**: 3 automatic retries with 10-second intervals on API errors
- **Progress indicator**: Visual timer shows time until next refresh

### InboxTab (Global Inbox)
- **Global inbox view**: Shows all uncompleted inbox tasks (date-independent)
- Powered by `globalInbox` table (introduced in v3)
- **Task filtering**: `completed === false`
- **Sort order**: By `createdAt` timestamp (newest first)
- **Benefits**:
  - No data loss from date changes
  - Persistent inbox across app sessions
  - Unified view of all pending tasks
  - Works seamlessly with Firebase sync
- **Repository**: `inboxRepository.ts` for CRUD operations

### GoalsPanel (Daily Goals)
- **Time-based goal tracking**: Set daily time targets for categories
- Visual progress bars with completion percentages
- Color-coded goals with emoji icons
- Links to tasks via `goalId` field
- Progress calculation:
  - Planned: Sum of linked task estimated times
  - Completed: Sum of linked completed task actual times
- Goal CRUD via `GoalModal`

### Gamification System
- **6 Quest Types**:
  1. `complete_tasks`: Complete N tasks today
  2. `earn_xp`: Earn N XP today
  3. `lock_blocks`: Lock N time blocks
  4. `perfect_blocks`: Complete N blocks perfectly
  5. `prepare_tasks`: Fill preparation notes for N tasks
  6. `use_timer`: Use focus timer N times
- **Quest Rewards**: Bonus XP on completion
- **Quest Bonus**: Extra reward for completing all quests
- **Level System**: Level up based on total XP
- **XP History**: 7-day chart for tracking progress

### Energy Tracking
- **Hourly energy logging**: Record energy levels (0-100) by hour
- Context and activity tracking
- Energy patterns visualization
- Historical data storage per date
- Integration with AI insights (energy-aware task recommendations)

### Global Hotkey (Quick Add Task)
- **OS-level global shortcut**: `Cmd+Shift+Space` (macOS) / `Ctrl+Shift+Space` (Windows/Linux)
- **Always accessible**: Works even when app is in background or minimized
- **Instant task capture**: Popup window opens immediately from any application
- **Core features**:
  - Task title, memo, duration, resistance selection
  - Auto-tag parsing (T30, D2, etc.) same as main TaskModal
  - Preparation notes for task planning
  - Direct inbox addition (no time block assignment)
  - Desktop notification on successful save
  - Auto-close after save
  - ESC to cancel, Ctrl+Enter to save
- **Implementation**:
  - **Main process** (`electron/main/index.ts`): Global shortcut registration, quick-add window manager
  - **Preload** (`electron/preload/index.ts`): IPC channels for window close and notifications
  - **Component** (`src/features/quickadd/QuickAddTask.tsx`): Simplified task creation form
  - **Entry point** (`src/main.tsx`): URL query parameter routing (`?mode=quickadd`)
  - **Window properties**: 600x700px, always-on-top, non-resizable, frameless experience
- **Data flow**: QuickAddTask → inboxRepository.addInboxTask → IndexedDB + Firebase sync
- **Quest integration**: Tracks preparation task quest progress on save

## Deployment & Distribution

### GitHub Actions Workflow

**Trigger**: Push to `main` branch

**Steps**:
1. Checkout repository
2. Setup Node.js 20
3. Detect package manager (npm/yarn/pnpm)
4. Cache node_modules and Electron
5. Install dependencies
6. Configure Git (for version bump commit)
7. Delete existing git tag (if duplicate)
8. Bump version (patch) via `npm run bump`
9. Push version commit + new tag
10. Build Electron app for Windows (`npm run dist:win`)
11. Verify build artifacts (.exe, .exe.blockmap, latest.yml)
12. Create GitHub release with tag
13. Upload artifacts to release
14. Upload CI artifacts (30-day retention)

**Build Artifacts**:
- `TimeBlock Planner-{version}-Setup.exe` (NSIS installer)
- `TimeBlock Planner-{version}-Setup.exe.blockmap` (delta updates)
- `latest.yml` (update manifest for electron-updater)

**Auto-Update Flow**:
1. App checks GitHub releases for `latest.yml`
2. Compares current version with latest
3. Downloads `.exe` if update available
4. Installs on app restart

### Manual Distribution

**Windows**:
```bash
npm run dist:win  # Creates .exe installer in release/
```

**macOS**:
```bash
npm run dist:mac  # Creates .dmg in release/
```

**Linux**:
```bash
npm run dist:linux  # Creates .AppImage in release/
```

## Security Considerations

### Electron Security
- **Context Isolation**: Enabled (renderer cannot access Node.js directly)
- **Node Integration**: Disabled (renderer is sandboxed)
- **Sandbox**: Enabled (Chromium sandboxing)
- **Preload Script**: Whitelisted safe APIs only
- **CSP**: None (consider adding Content-Security-Policy)

### API Keys
- Stored in IndexedDB (encrypted by OS)
- Not exposed to web context (Electron only)
- Firebase config gitignored (`src/data/firebase/config.ts`)
- No hardcoded credentials in codebase

### Data Privacy
- All user data stored locally (IndexedDB)
- Optional Firebase sync (user-controlled)
- No telemetry or analytics
- No external API calls except Gemini (user-provided API key)

## Troubleshooting

### Common Issues

**IndexedDB Corruption**:
- Error: "Failed to open database"
- Solution: DB auto-deletes and recreates with migration

**Firebase Sync Failures**:
- Check `SyncLogModal` for error logs
- Verify Firebase config in Settings
- Check network connectivity
- Retry queue handles temporary failures

**Electron Build Failures**:
- Run `npm run electron:build` separately to debug
- Check TypeScript errors in `dist-electron/`
- Verify `tsconfig.electron.json` configuration

**Auto-Update Not Working**:
- Verify GitHub release has `latest.yml`
- Check app is not in development mode
- Ensure code signing (macOS/Windows) if required

## Future Enhancements

### Planned Features
- Light mode theme (CSS variables ready)
- Multi-language support (i18n)
- Cloud backup to alternative providers (Google Drive, Dropbox)
- Mobile companion app (React Native)
- Pomodoro timer integration
- Calendar integration (Google Calendar, Outlook)
- Task dependencies and subtasks
- Advanced analytics dashboard
- Export/import functionality (JSON, CSV)
- Code signing for macOS and Windows (trusted installation)

### Technical Debt
- Add Content-Security-Policy headers
- Implement IPC type safety (typed channels)
- Add end-to-end tests (Playwright/Spectron)
- Optimize bundle size (code splitting)
- Add error boundary components
- Implement offline-first architecture improvements
- Add database backup/restore functionality
