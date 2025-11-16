# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install              # Install dependencies
npm run dev              # Start dev server (Vite)
npm run build            # Build for production (TypeScript + Vite)
npm run preview          # Preview production build
npm run lint             # Run ESLint
```

### Development Setup

**Prerequisites**:
- Node.js (ES2020+ support required)
- npm or compatible package manager

**Environment Variables**:
- **No `.env` file required** - Application works without environment variables
- Firebase configuration is hardcoded (gitignored at `src/data/firebase/config.ts`)
- Gemini API keys expected to be configured via UI (stored in IndexedDB)

**First-Time Setup**:
1. `npm install` - Install all dependencies
2. `npm run dev` - Start development server (typically http://localhost:5173)
3. Open browser to local dev URL
4. Configure API keys via Settings modal (if using Gemini/Firebase features)

**Build Output**:
- TypeScript compilation first (`tsc`), then Vite bundling
- Output directory: `dist/` (gitignored)
- Entry point: `index.html` → `src/main.tsx`
- Assets copied from `public/` to `dist/` as-is

## Architecture Overview

### Tech Stack
- **Frontend**: React 18.3.1 + TypeScript 5.4.5
- **Build Tool**: Vite 7.2.2 (with `@` alias for `/src`)
- **State Management**: Zustand 5.0.8 (stores in `src/shared/stores/`)
- **Local Database**: Dexie 4.0.0 (IndexedDB wrapper) + dexie-react-hooks 1.1.7
- **Cloud Sync**: Firebase Realtime Database 10.7.1
- **AI Integration**: Google Gemini 2.5 Flash API

### Build Configuration

**Vite** (`vite.config.ts`):
- Plugin: `@vitejs/plugin-react` 4.3.0
- Path alias: `@` → `./src` (absolute imports)
- Entry point: `src/main.tsx`

**TypeScript** (`tsconfig.json`):
- Target: ES2020, Module: ESNext
- Module resolution: `bundler` (Vite-optimized)
- Strict mode enabled: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- JSX: `react-jsx` (automatic runtime)
- Path mapping: `@/*` → `./src/*`
- Asset type declarations: `vite-env.d.ts` (PNG, JPG, SVG, WEBP support)

**Linting**:
- ESLint 8.57.0 with TypeScript plugin 7.0.0
- React Hooks plugin 4.6.0 + React Refresh plugin 0.4.5
- Run via: `npm run lint`
- No `.eslintrc` config file (inline or default configuration)

### Directory Structure

```
/
├── index.html                     # HTML entry point (Vite SPA)
├── package.json                   # Dependencies and npm scripts
├── vite.config.ts                 # Vite build configuration
├── tsconfig.json                  # TypeScript compiler config
├── tsconfig.node.json             # TypeScript config for build tools
├── .gitignore                     # Git ignore rules (includes .env, Firebase config)
│
├── public/                        # Static assets (copied as-is to dist)
│   └── assets/waifu/poses/        # Waifu character images (production)
│       ├── hyeeun_*.png           # Global emotion poses
│       ├── hostile/               # Affection tier 1 poses
│       ├── wary/                  # Affection tier 2 poses
│       ├── indifferent/           # Affection tier 3 poses
│       ├── interested/            # Affection tier 4 poses
│       ├── affectionate/          # Affection tier 5 poses
│       └── loving/                # Affection tier 6 poses
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
    │       ├── RightPanel.tsx     # Right panel (quests, shop, waifu)
    │       └── CenterContent.tsx  # Main content area
    │
    ├── features/                  # Feature modules (domain-driven organization)
    │   ├── gemini/                # Gemini AI chat integration
    │   │   └── GeminiFullscreenChat.tsx  # Visual novel-style chat UI
    │   ├── waifu/                 # Waifu companion system
    │   │   ├── WaifuPanel.tsx     # Waifu display panel
    │   │   ├── waifuImageUtils.ts # Image selection & fallback logic
    │   │   └── poses/             # Development waifu images
    │   ├── insight/               # AI-generated insights
    │   │   └── InsightPanel.tsx   # Auto-refreshing insight display
    │   ├── schedule/              # Time block scheduling
    │   │   ├── ScheduleView.tsx   # Drag-and-drop schedule interface
    │   │   ├── TimeBlock.tsx      # Individual time block component
    │   │   ├── TaskCard.tsx       # Task card with resistance indicators
    │   │   ├── TaskModal.tsx      # Task creation/edit modal
    │   │   ├── TimerConfirmModal.tsx        # Focus timer confirmation
    │   │   └── CompletionCelebrationModal.tsx  # Block completion celebration
    │   ├── tasks/                 # Task management
    │   │   ├── InboxTab.tsx       # Unscheduled task inbox
    │   │   ├── CompletedTab.tsx   # Completed tasks view
    │   │   └── BulkAddModal.tsx   # Bulk task addition
    │   ├── gamification/          # XP, leveling, quests
    │   │   ├── QuestsPanel.tsx    # Daily quests display
    │   │   └── LevelUpNotification.tsx  # Level-up celebration
    │   ├── energy/                # Energy tracking system
    │   │   └── EnergyTab.tsx      # Energy level visualization
    │   ├── settings/              # User settings
    │   │   ├── SettingsModal.tsx  # Settings configuration UI
    │   │   └── SyncLogModal.tsx   # Firebase sync log viewer
    │   ├── shop/                  # XP shop for rewards
    │   │   ├── ShopPanel.tsx      # Shop display
    │   │   └── ShopModal.tsx      # Shop purchase interface
    │   ├── stats/                 # Statistics and analytics
    │   │   └── StatsTab.tsx       # Statistics dashboard
    │   └── template/              # Recurring task templates
    │       ├── TemplatePanel.tsx  # Template quick actions
    │       ├── TemplatesModal.tsx # Template management UI
    │       └── TemplateModal.tsx  # Template creation/edit
    │
    ├── data/                      # Data layer
    │   ├── db/
    │   │   └── dexieClient.ts     # IndexedDB schema (9 tables, version 2)
    │   └── repositories/          # Repository pattern for data access
    │       ├── dailyDataRepository.ts    # Tasks & time block states
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
        │   ├── geminiApi.ts       # Gemini API client (fetch-based)
        │   ├── firebaseService.ts # Legacy Firebase service
        │   ├── syncLogger.ts      # Sync operation logger
        │   └── firebase/          # Firebase sync infrastructure
        │       ├── firebaseClient.ts      # Firebase initialization
        │       ├── syncCore.ts            # Core sync engine
        │       ├── strategies.ts          # Merge strategies
        │       ├── conflictResolver.ts    # Conflict resolution logic
        │       ├── syncUtils.ts           # Sync utilities
        │       └── firebaseDebug.ts       # Debug logging
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
        │   ├── usePersonaContext.ts    # Persona context builder
        │   ├── useXPToast.ts      # XP notification hook
        │   ├── useKeyboardNavigation.ts  # Keyboard shortcuts
        │   └── index.ts           # Hook exports
        ├── components/            # Reusable UI components
        │   ├── XPBar.tsx          # XP progress bar
        │   └── XPToast.tsx        # XP gain toast notification
        ├── types/
        │   └── domain.ts          # Core domain type definitions
        ├── lib/                   # Utility libraries
        │   ├── constants.ts       # App constants (time blocks, etc.)
        │   ├── utils.ts           # General utilities (linkifyText, etc.)
        │   └── personaUtils.ts    # Persona generation utilities
        └── utils/
            └── gamification.ts    # XP calculation utilities
```

## Key Architectural Patterns

### 1. Repository Pattern
All data access goes through repositories in `src/data/repositories/`. Each repository:
- Manages IndexedDB operations via Dexie
- Handles Firebase sync (dual-write pattern)
- Provides typed data access functions

**Example**: `dailyDataRepository.ts` manages tasks and time block states per date.

### 2. State Management Strategy
- **Zustand stores** (`src/shared/stores/`): Global reactive state (gameStateStore, waifuCompanionStore, settingsStore, dailyDataStore)
- **Custom hooks** (`src/shared/hooks/`): Encapsulate state logic (useWaifuState, useGameState, usePersonaContext)
- **IndexedDB as source of truth**: All state persisted via Dexie, stores sync from DB

### 3. Data Flow
```
User Action → Repository (IndexedDB write + Firebase sync) → Store update → UI re-render
```

**Key Principles**:
- **Local-first**: IndexedDB is source of truth, UI reads from local DB
- **Optimistic updates**: UI updates immediately from IndexedDB
- **Background sync**: Firebase sync happens asynchronously after local write
- **Conflict resolution**: Merge strategies handle concurrent updates

### 4. Module Organization

**Feature-First Structure**:
- Each feature module is self-contained with its UI components
- Shared business logic goes in `src/shared/` (hooks, stores, services)
- Data access abstracted through repositories (never direct Dexie calls from UI)

**Import Path Convention**:
- Use `@/` alias for absolute imports: `import { X } from '@/shared/hooks'`
- Relative imports discouraged (harder to refactor)
- All repository/store imports should use absolute paths

**Component Organization**:
- Top-level feature components in `src/features/{feature}/`
- Layout components in `src/app/components/`
- Reusable shared components in `src/shared/components/`
- No component nesting beyond 2 levels deep in folders

### 5. Firebase Sync Architecture
- Located in `src/shared/services/firebase/`
- **syncCore.ts**: Core sync engine with conflict resolution
- **strategies.ts**: Merge strategies (client-wins, server-wins, last-write-wins)
- **Dual-write pattern**: Local-first with background cloud sync
- Each repository calls `syncToFirebase()` after local writes

**Synced Collections**:
- `dailyData`: Tasks and time block states (per date)
- `gameState`: XP, level, quests (single record)
- `chatHistory`: Gemini chat messages (per date)
- `tokenUsage`: Daily API token usage (per date)
- `energyLevels`: Energy tracking data (per date)
- `templates`: Task templates (all templates as array, key: 'all')

## Code Conventions & Standards

### File Naming
- **Components**: PascalCase with `.tsx` extension (e.g., `TaskCard.tsx`, `AppShell.tsx`)
- **Utilities/Services**: camelCase with `.ts` extension (e.g., `geminiApi.ts`, `waifuImageUtils.ts`)
- **Stores**: camelCase with `Store` suffix (e.g., `gameStateStore.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useGameState.ts`)
- **Repositories**: camelCase with `Repository` suffix (e.g., `dailyDataRepository.ts`)
- **Types**: `domain.ts` for core domain types (avoid `types.ts` or `index.ts` for types)

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
- Example from `main.tsx`:
  ```typescript
  /**
   * 앱 엔트리 포인트
   *
   * @role React 앱을 초기화하고 DOM에 마운트
   * @input 없음
   * @output React 앱 렌더링
   * @dependencies React, ReactDOM, App 컴포넌트, 글로벌 스타일
   */
  ```

### TypeScript Conventions
- Strict mode enabled - all type errors must be resolved
- Prefer `interface` over `type` for object shapes (domain types)
- Use `type` for unions, intersections, and utility types
- Avoid `any` - use `unknown` and type guards instead
- All React components typed with explicit return types

### React Patterns
- Functional components only (no class components)
- Hooks for all stateful logic
- Custom hooks for reusable logic (prefixed with `use`)
- `React.StrictMode` enabled in production
- Zustand for global state, local `useState` for component-specific state

## Domain Model

### Core Entities (see `src/shared/types/domain.ts`)

**Task**: Individual work items with:
- `resistance`: Psychological difficulty (low/medium/high)
- `timeBlock`: 5-hour block assignment (5-8, 8-11, etc.)
- `baseDuration` & `adjustedDuration`: Time estimation with resistance multiplier
- `preparation1-3`: Pre-task preparation notes

**TimeBlock**: 6 fixed daily blocks (5-8, 8-11, 11-14, 14-17, 17-19, 19-24) with:
- Lock mechanism (prevents changes)
- Perfect completion tracking
- Failure states

**GameState**: Gamification layer
- Level, XP (daily/total/available)
- Daily quests (6 types)
- Streak tracking
- XP history (7 days)

**WaifuState**: AI companion
- Affection: 0-100 (6 tiers: hostile, wary, indifferent, interested, affectionate, loving)
- Each tier maps to specific pose images in `public/assets/waifu/poses/{tier}/`

**Template**: Recurring tasks with:
- `recurrenceType`: none/daily/weekly/interval
- Auto-generation logic for daily reset

## IndexedDB Schema (Dexie)

Database name: `timeblock_db`

**Tables** (version 2):
1. `dailyData` - Tasks and block states per date (primary key: date)
2. `gameState` - Single record (key: 'current')
3. `waifuState` - Single record (key: 'current')
4. `templates` - Task templates (primary key: id)
5. `shopItems` - XP shop items (primary key: id)
6. `energyLevels` - Energy tracking (composite id: date + timestamp)
7. `settings` - App settings (key: 'current')
8. `chatHistory` - Gemini chat messages per date (primary key: date)
9. `dailyTokenUsage` - Daily Gemini token usage (primary key: date)

## Gemini AI Integration

### API Configuration
- **Model**: `gemini-2.5-flash-preview-05-20`
- **Endpoint**: `generativelanguage.googleapis.com/v1beta/models/`
- **Context window**: Max 20 messages history
- **Generation config**: temp=0.9, topK=40, topP=0.95, maxOutputTokens=8192

### Persona System
`generateWaifuPersona(PersonaContext)` in `geminiApi.ts` creates system prompts with:
- Waifu affection level, game state (level, XP)
- Task completion data (inbox, completed, resistance)
- Time block status (locked, perfect, failed)
- Energy levels and patterns
- 7-day XP trends and completion patterns

Persona characteristics:
- 19-year-old counselor AI named "혜은"
- ADHD/ASD specialized support
- Panoptic empathy + intimate omniscience
- Tone varies by affection level

### Waifu Image System
- **6 affection tiers** with distinct emotion sets:
  1. `hostile` (0-16 affection)
  2. `wary` (17-33 affection)
  3. `indifferent` (34-50 affection)
  4. `interested` (51-66 affection)
  5. `affectionate` (67-83 affection)
  6. `loving` (84-100 affection)
- **Image storage**:
  - Development: `src/features/waifu/poses/{tier}/hyeeun_{emotion}.png`
  - Production: `public/assets/waifu/poses/{tier}/hyeeun_{emotion}.png`
  - Global fallbacks: `public/assets/waifu/poses/hyeeun_{emotion}.png` (no tier subfolder)
- **Filename format**: `hyeeun_{emotion}.png`
  - Examples: `hyeeun_happy.png`, `hyeeun_blushing shyly.png`, `hyeeun_neutral.png`
  - Spaces in emotion names are allowed (e.g., "blushing shyly")
- **Image utility**: `waifuImageUtils.ts`
  - `getWaifuImage(tier, emotion)`: Get specific image path
  - `getRandomWaifuImage(tier)`: Random selection within tier
  - Automatic fallback chain: tier-specific → global → placeholder
- **Asset handling**:
  - Vite type declarations in `vite-env.d.ts` (PNG, JPG, JPEG, GIF, SVG, WEBP)
  - Images imported as strings (bundled URLs)
  - Public assets served at `/assets/` path

## Important Implementation Details

### Time Block System
- Blocks defined in constants as string literals: `'5-8' | '8-11' | '11-14' | '14-17' | '17-19' | '19-24' | null`
- `null` = inbox (unscheduled tasks)
- Lock prevents task edits after block starts
- Perfect = all tasks completed in block

### XP Calculation
- Base XP per task: 10
- Resistance multipliers: low (1x), medium (1.5x), high (2x)
- Timer bonus: +5 XP for using focus timer
- Preparation bonus: +1 XP per filled preparation field
- Block completion bonuses (perfect/partial)
- XP tracked per block in `gameState.timeBlockXP`

### Daily Reset Logic
- Runs on date change (checked in AppShell)
- Auto-generates recurring templates
- Resets daily quests
- Archives completed tasks to history
- Clears time block locks

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
  - Prevents clipping inside time block containers

## Feature-Specific Notes

### FullscreenChat (Gemini)
- Visual novel style: 50/50 split (waifu image | chat interface)
- Image changes randomly within affection tier on each Gemini response
- Supports waifuMode: 'normal' (base.png) vs 'trait' (affection-based)
- Max 20 messages sent to API for context

### Schedule View
- Drag-and-drop task assignment to blocks
- Time block locking mechanism
- Resistance-based duration adjustments visualized
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
