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

## Build System Architecture

### Build Pipeline
1. **TypeScript Compilation** (`tsc`) - Type checking and transpilation
2. **Vite Build** - Bundling, optimization, and asset processing
3. **PostCSS Processing** - CSS transformation pipeline

### Build Tool Configuration

**Vite 7.2.2** (`vite.config.ts`):
- **Plugin**: `@vitejs/plugin-react` v4.3 (Fast Refresh, JSX transformation)
- **Path Alias**: `@` → `./src` (resolve absolute imports)
- **Module Resolution**: Bundler mode (ESNext)

**TypeScript 5.4.5** (Two-stage config):
- **tsconfig.json**: App source compilation
  - Target: ES2020, Module: ESNext
  - Strict mode: enabled (noUnusedLocals, noUnusedParameters)
  - Path mapping: `@/*` → `./src/*`
  - JSX: react-jsx (new JSX transform)
- **tsconfig.node.json**: Build tool config (Vite)
  - Composite project for faster incremental builds

**PostCSS** (`postcss.config.js`):
- `@tailwindcss/postcss` v4.1.17 (Tailwind v4 architecture)
- `autoprefixer` v10.4.22 (vendor prefix automation)

**ESLint 8.57**:
- TypeScript ESLint parser and plugin v7.0
- React Hooks plugin (enforces hooks rules)
- React Refresh plugin (Fast Refresh compatibility)
- Configured via package.json scripts (no separate config file)

### Tailwind CSS v4 Migration

**IMPORTANT**: This project uses Tailwind CSS v4.1.17 with the new PostCSS architecture.

**Key Changes from v3**:
- Uses `@tailwindcss/postcss` plugin instead of traditional `tailwindcss` plugin
- PostCSS config: `plugins: { '@tailwindcss/postcss': {} }`
- Maintains backward compatibility with v3 config format

**Configuration** (`tailwind.config.js`):
- **Content Scanning**: `./index.html`, `./src/**/*.{js,ts,jsx,tsx}`
- **Custom Theme System**:
  - Color palette: primary, secondary, success, warning, danger, reward, bg, text, border, resistance
  - Typography scale: 2xs (11px) → 3xl (40px) with line-height presets
  - Spacing system: 8px base unit (xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px)
  - Font family: Pretendard (Korean web font) + system font stack
  - Animations: fadeIn, scaleIn, shimmer, bounce with custom keyframes
  - Border radius: sm (4px) → 2xl (32px)
  - Box shadows: sm, md, lg, xl (dark mode optimized)

### CSS Architecture

**3-Layer CSS System** (imported in `main.tsx`):
1. **design-system.css** (7.6K) - Design tokens, CSS variables, utility classes
2. **globals.css** (23K) - Global styles, theme variables, component base styles
3. **layout.css** (12K) - Layout primitives, grid systems, spacing utilities

**Theme System**:
- Theme attribute: `data-theme` on `<html>` element
- Persistence: localStorage key `'theme'`
- Initialization: main.tsx reads and applies on mount
- CSS variables in globals.css map to Tailwind config

**Component-Scoped CSS**:
- Some features use dedicated CSS files (e.g., `template/template.css`)
- Imported directly in component files

### Entry Point Chain

```
index.html
  └─> main.tsx (React root initialization)
      ├─> design-system.css
      ├─> globals.css
      ├─> layout.css
      └─> App.tsx
          └─> AppShell.tsx (main application shell)
```

## Architecture Overview

### Tech Stack
- **Frontend**: React 18.3.1 + TypeScript 5.4.5
- **Build Tool**: Vite 7.2.2 (with `@` alias for `/src`)
- **Styling**: Tailwind CSS v4.1.17 + PostCSS + Custom CSS
- **State Management**: Zustand 5.0.8 (stores in `src/shared/stores/`)
- **Local Database**: Dexie 4.0.0 (IndexedDB wrapper)
- **Cloud Sync**: Firebase 10.7.1 (Realtime Database)
- **AI Integration**: Google Gemini 2.5 Flash API
- **Localization**: Korean (ko) UI

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
│   └── repositories/       # Repository pattern for data access (9 repositories)
│       ├── dailyDataRepository.ts    # Daily tasks and time blocks
│       ├── gameStateRepository.ts    # XP, level, quests
│       ├── waifuRepository.ts        # Waifu state and affection
│       ├── chatHistoryRepository.ts  # Gemini chat history
│       ├── energyRepository.ts       # Energy tracking data
│       ├── settingsRepository.ts     # App settings
│       ├── shopRepository.ts         # Shop items
│       ├── templateRepository.ts     # Task templates
│       └── index.ts                  # Barrel export
│
├── styles/                 # Global CSS (3-layer architecture)
│   ├── design-system.css   # Design tokens and CSS variables
│   ├── globals.css         # Global styles and theme system
│   └── layout.css          # Layout primitives and utilities
│
└── shared/                 # Shared resources
    ├── services/           # External service integrations
    │   ├── geminiApi.ts    # Gemini API client
    │   └── firebase/       # Firebase sync infrastructure (7 files)
    │       ├── firebaseClient.ts     # Firebase initialization
    │       ├── syncCore.ts           # Core sync engine
    │       ├── strategies.ts         # Merge strategies (client/server/LWW)
    │       ├── conflictResolver.ts   # Conflict resolution logic
    │       ├── syncUtils.ts          # Sync utility functions
    │       ├── firebaseDebug.ts      # Debug logging
    │       └── README.md             # Firebase sync documentation
    ├── stores/             # Zustand state stores (4 stores)
    │   ├── dailyDataStore.ts         # Daily tasks and blocks
    │   ├── gameStateStore.ts         # Game state (XP, level, quests)
    │   ├── settingsStore.ts          # App settings
    │   └── waifuCompanionStore.ts    # Waifu companion state
    ├── hooks/              # Custom React hooks
    ├── types/
    │   └── domain.ts       # Core domain type definitions
    ├── components/         # Reusable UI components
    ├── lib/                # Utility libraries
    └── utils/              # Utility functions
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

**Location**: `src/shared/services/firebase/` (7 files)

**Core Components**:
- **firebaseClient.ts**: Firebase app initialization, Realtime Database connection
- **syncCore.ts**: Core sync engine with bidirectional sync, conflict resolution
- **strategies.ts**: Merge strategies (client-wins, server-wins, last-write-wins)
- **conflictResolver.ts**: Automatic conflict resolution based on timestamps
- **syncUtils.ts**: Helper functions for sync operations
- **firebaseDebug.ts**: Debug logging for sync operations
- **README.md**: Sync architecture documentation

**Sync Pattern**:
- **Dual-write pattern**: Local-first with background cloud sync
- Each repository calls `syncToFirebase()` after local writes
- Conflict resolution: automatic timestamp-based merging
- Real-time listeners: optional bidirectional sync

**Synced Collections**:
- `dailyData`: Tasks and time block states (per date)
- `gameState`: XP, level, quests (single record, key: 'current')
- `chatHistory`: Gemini chat messages (per date)
- `dailyTokenUsage`: Daily API token usage (per date)
- `energyLevels`: Energy tracking data (per date)
- `templates`: Task templates (all templates as array, key: 'all')
- `waifuState`: Waifu companion state (single record, key: 'current')
- `settings`: App settings (single record, key: 'current')
- `shopItems`: Shop items (synced as needed)

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

### CSS Theming & Styling System

**3-Layer CSS Architecture**:
1. **design-system.css**: Design tokens, CSS custom properties (CSS variables)
2. **globals.css**: Global styles, theme system, component base classes
3. **layout.css**: Layout primitives, grid systems, spacing utilities

**CSS Variables** (in `globals.css`):
- **Background colors**: `--color-bg-base`, `--color-bg-surface`, `--color-bg-elevated`, `--color-bg-interactive`
- **Text colors**: `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`
- **Semantic colors**: `--color-primary`, `--color-danger`, `--color-success`, `--color-warning`, `--color-reward`
- **Resistance colors**: `--color-resistance-low`, `--color-resistance-medium`, `--color-resistance-high`
- **Typography scale**: `--text-2xs` (11px) through `--text-3xl` (40px)
- **Spacing scale**: `--spacing-xs` (4px) through `--spacing-2xl` (48px)

**Tailwind Integration**:
- Tailwind v4 classes coexist with CSS variables
- Custom theme in `tailwind.config.js` extends default palette
- Utility-first approach with custom component classes
- Dark mode optimized (default theme)

**Theme Persistence**:
- Theme stored in localStorage: key `'theme'`
- Applied via `data-theme` attribute on `<html>`
- Initialized in `main.tsx` before React mount
- Switchable via settings (if implemented)

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

## Development Best Practices

### Code Organization
- **Feature-first structure**: Each feature in `src/features/` is self-contained
- **Colocation**: Component-specific CSS, types, and utilities live with components
- **Barrel exports**: Use `index.ts` for clean imports (e.g., `src/data/repositories/index.ts`)
- **Separation of concerns**: UI components separate from data/business logic

### State Management Guidelines
- **Local state**: Use React hooks (`useState`, `useReducer`) for UI-only state
- **Global state**: Use Zustand stores for cross-component reactive state
- **Persisted state**: Use repositories (IndexedDB) for data that must survive sessions
- **Derived state**: Compute in components or custom hooks, don't store redundantly

### Data Access Patterns
- **Always use repositories**: Never access Dexie directly from components
- **Batch operations**: Repository functions handle batch updates efficiently
- **Sync after write**: Repositories automatically trigger Firebase sync
- **Error handling**: All repository functions should handle errors gracefully

### TypeScript Best Practices
- **Strict mode**: All code must pass strict TypeScript checks
- **Domain types**: Use types from `src/shared/types/domain.ts` for core entities
- **Avoid `any`**: Use proper typing or `unknown` if type is truly dynamic
- **Path aliases**: Use `@/` prefix for absolute imports (e.g., `import { Task } from '@/shared/types/domain'`)

### Styling Guidelines
- **Prefer Tailwind classes**: Use utility classes for most styling
- **CSS variables**: Use for dynamic theming and shared design tokens
- **Component CSS**: Only create separate CSS files for complex components
- **Naming**: Use BEM-style naming for custom CSS classes (e.g., `.modal-overlay`, `.task-card__header`)
- **Responsive design**: Mobile-first approach, use Tailwind breakpoints

### Performance Considerations
- **Code splitting**: Vite handles automatic chunking
- **Lazy loading**: Use React.lazy() for heavy components (e.g., FullscreenChat)
- **IndexedDB queries**: Use indexed fields for filtering (defined in dexieClient.ts)
- **Gemini API**: Limit context window to 20 messages to control token usage
- **Image optimization**: Waifu images are pre-optimized PNGs in public/assets

### Firebase Sync Guidelines
- **Local-first**: Always write to IndexedDB first, sync to Firebase second
- **Conflict resolution**: Trust automatic strategies (configured per collection)
- **Error recovery**: Sync failures are logged but don't block local operations
- **Rate limiting**: Batch multiple changes when possible to reduce Firebase writes

### Build and Deployment
- **Type checking**: Run `npm run build` to catch TypeScript errors
- **Linting**: Run `npm run lint` before committing
- **Production build**: `npm run build` outputs to `dist/` directory
- **Preview**: Test production build with `npm run preview` before deployment
- **Environment variables**: Firebase config should use environment variables (not committed)

### Common Pitfalls
- **Don't bypass repositories**: Direct Dexie access breaks Firebase sync
- **Don't mutate state**: Zustand and React rely on immutability
- **Path alias in Vite config**: Must match tsconfig.json paths
- **Tailwind purging**: Ensure dynamic class names are safelisted in config
- **Firebase offline**: App works offline but requires online sync for multi-device

### Debugging Tips
- **React DevTools**: Inspect component hierarchy and props
- **Redux DevTools**: Zustand supports Redux DevTools for time-travel debugging
- **IndexedDB Inspector**: Chrome DevTools → Application → IndexedDB
- **Firebase Console**: Monitor sync operations in Realtime Database
- **Console logs**: firebaseDebug.ts provides detailed sync logging
- **Network tab**: Monitor Gemini API calls and Firebase operations

### Project Documentation
- **CLAUDE.md** (this file): Architecture and implementation guide
- **TAILWIND_MIGRATION.md**: Tailwind v4 migration notes
- **TEMPLATE_DESIGN_PROPOSAL.md**: Template system design
- **docs/PROJECT_UI_FEATURES_REPORT.md**: Comprehensive UI feature inventory
- **docs/MISSING_FEATURES.md**: Planned features and technical debt
- **src/shared/services/firebase/README.md**: Firebase sync architecture

### Korean Localization Notes
- **UI Language**: All user-facing text is in Korean
- **Font**: Pretendard web font (optimized for Korean)
- **Date formatting**: Use Korean locale for dates (e.g., "오늘", "내일", "모레")
- **Number formatting**: Follow Korean conventions for numbers and currency
