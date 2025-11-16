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

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TypeScript 5.4
- **Build Tool**: Vite 7.2 (with `@` alias for `/src`)
- **State Management**: Zustand 5.0 (stores in `src/shared/stores/`)
- **Local Database**: Dexie 4.0 (IndexedDB wrapper)
- **Cloud Sync**: Firebase Realtime Database 10.7
- **AI Integration**: Google Gemini 2.5 Flash API

### Directory Structure

```
src/
├── app/                    # Application shell and layout
│   ├── AppShell.tsx        # Main app container
│   └── components/         # Layout components (TopToolbar, LeftSidebar, etc.)
│
├── features/               # Feature modules (domain-driven organization)
│   ├── gemini/             # Gemini AI chat integration
│   ├── waifu/              # Waifu companion system with affection mechanics
│   ├── insight/            # AI-generated insights
│   ├── schedule/           # Time block scheduling (5-hour blocks: 5-8, 8-11, 11-14, 14-17, 17-19, 19-24)
│   ├── tasks/              # Task management (inbox, completion tracking)
│   ├── gamification/       # XP, leveling, quests
│   ├── energy/             # Energy tracking system
│   ├── settings/           # User settings and configuration
│   ├── shop/               # XP shop for rewards
│   ├── stats/              # Statistics and analytics
│   └── template/           # Recurring task templates
│
├── data/                   # Data layer
│   ├── db/
│   │   └── dexieClient.ts  # IndexedDB schema (9 tables)
│   └── repositories/       # Repository pattern for data access
│       ├── dailyDataRepository.ts
│       ├── gameStateRepository.ts
│       ├── waifuRepository.ts
│       ├── chatHistoryRepository.ts
│       └── ...
│
└── shared/                 # Shared resources
    ├── services/           # External service integrations
    │   ├── geminiApi.ts    # Gemini API client
    │   └── firebase/       # Firebase sync infrastructure
    ├── stores/             # Zustand state stores
    ├── hooks/              # Custom React hooks
    ├── types/
    │   └── domain.ts       # Core domain type definitions
    └── components/         # Reusable UI components
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

### 4. Firebase Sync Architecture
- Located in `src/shared/services/firebase/`
- **syncCore.ts**: Core sync engine with conflict resolution
- **strategies.ts**: Merge strategies (client-wins, server-wins, last-write-wins)
- **Dual-write pattern**: Local-first with background cloud sync
- Each repository calls `syncToFirebase()` after local writes

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
- 6 affection tiers with distinct emotion sets
- Images stored: `src/features/waifu/poses/` (dev) + `public/assets/waifu/poses/` (prod)
- Filename format: `hyeeun_{emotion}.png` (e.g., `hyeeun_happy.png`, `hyeeun_blushing shyly.png`)
- `waifuImageUtils.ts`: Handles image selection, fallback, and random selection within tier

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

### CSS Theming
Global variables in `src/styles/globals.css`:
- Dark mode palette: `--color-bg-base`, `--color-bg-surface`, `--color-bg-elevated`
- Semantic colors: `--color-primary`, `--color-danger`, `--color-success`, etc.
- Typography scale: `--text-2xs` through `--text-3xl`

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
