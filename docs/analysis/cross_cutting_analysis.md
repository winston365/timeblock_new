# Cross-Cutting Logic Analysis - TimeBlock Planner Features

## 1. Feature Overview
16 features identified in src/features/:
1. energy
2. feedback
3. focus
4. gamification
5. gemini
6. goals
7. insight
8. quickadd
9. schedule
10. settings
11. shop
12. stats
13. tasks
14. template
15. waifu

## 2. Cross-Feature Dependencies Map

### Most Connected Features (Hub Features)

#### **SCHEDULE (Central Hub)**
- **Imports FROM schedule:**
  - tasks/InboxTab → TaskCard, TaskModal, useDragDropManager
  - template/TemplateModal → MemoModal
  - (Largest feature with 7+ components)

- **Imports TO schedule:**
  - waifu/WaifuPanel uses schedule TaskCard patterns
  - gamification may depend on task data

#### **WAIFU (Companion Hub)**
- **Used by 6 features:** insight, gemini, shop, schedule, tasks, gamification
- **Pattern:** Provides `useWaifu()` hook for affection/mood/dialogue
- **Tight Coupling:** Multiple features directly call useWaifu()

#### **ENERGY (Analytics Hub)**
- **Used by 3 features:** insight, gemini, energy (self)
- **Pattern:** Provides `useEnergy()` hook for energy tracking
- **Integration:** Critical for AI insights and companion behavior

#### **TASKS (Breakdown Hub)**
- **Central store:** useTaskBreakdownStore
- **Used by:** schedule/TaskModal (AI task breakdown)
- **Pattern:** Cross-feature modal coordination

### Dependencies Summary

```
FEATURES WITH CROSS-FEATURE IMPORTS:
└── insight (imports: waifu, energy, shared services)
└── gemini (imports: waifu, energy, shared services)
└── schedule (imports: nothing from features, but heavily imported)
└── tasks (imports: schedule for components)
└── shop (imports: waifu)
└── template (imports: schedule)

FEATURES WITH NO EXTERNAL DEPENDENCIES:
└── focus, feedback, gamification, goals, settings, stats, quickadd
```

## 3. Shared Stores (Cross-Feature State)

### Core Shared Stores (7 instances):
1. **gameStateStore** - Used by 3 features (feedback, insight, waifu)
2. **settingsStore** - Used by 7 features (most used!)
3. **waifuCompanionStore** - Used by 4 features
4. **inboxStore** - Used by 2 features
5. **goalStore** - Used by 2 features
6. **toastStore** - Used by 2 features
7. **dailyDataStore** - Used by 1 feature (core)

### Feature-Specific Stores:
- energyStore (energy feature)
- waifuStore (waifu feature)
- focusModeStore (schedule feature)
- breakdownStore (tasks feature)

## 4. Cross-Cutting Concerns

### A. Task Completion Pipeline (Handler Pattern)
**Location:** src/shared/services/gameplay/taskCompletion/

Triggered across ALL features when task completes:
1. GoalProgressHandler → Updates globalGoals
2. XPRewardHandler → Increases XP
3. QuestProgressHandler → Updates quests (gamification)
4. WaifuAffectionHandler → Increases companion affection
5. BlockCompletionHandler → Checks perfect block bonus

**Features Affected:**
- schedule (triggers on task complete)
- gamification (receives quest updates)
- waifu (receives affection updates)
- goals (receives progress updates)
- insight (uses data from completion)

### B. AI Integration (Cross-Feature Pattern)
**Features using Gemini API:**
- gemini/GeminiFullscreenChat
- schedule/TaskModal (emoji suggestion, breakdown)
- tasks/TaskBreakdownModal
- insight/InsightPanel

**Shared Service:** src/shared/services/ai/geminiApi
- Token tracking across all AI features
- API key validation in settings

### C. Toast Notifications (UI Pattern)
**Used by 9 files across features:**
- schedule/TaskCard
- schedule/TimeBlock  
- schedule/ScheduleView
- tasks/InboxTab
- shop components
- settings components

**Pattern:** Direct react-hot-toast import (not centralized through store)

### D. Waifu Companion Messaging
**Multiple Integration Points:**
1. Task completion → WaifuAffectionHandler
2. Insight generation → InsightPanel shows waifu message
3. Interaction system → WaifuPanel
4. Emoji suggestions → TaskModal
5. Shop purchases → ShopPanel

**Pattern:** useWaifu() hook used everywhere for affection state

### E. Firebase Synchronization (Cross-Feature)
**Affected Data:**
- dailyData (tasks, timeblocks)
- gameState (XP, levels, quests)
- waifuState (affection, interactions)
- globalGoals (progress tracking)
- templates (server-side generation)

**Sync Strategy:**
- IndexedDB → localStorage → Firebase
- Conflict resolution: Last-Write-Wins

## 5. Feature Coupling Analysis

### High Coupling
- **schedule ↔ waifu** (TaskModal uses useWaifu)
- **schedule ↔ tasks** (InboxTab imports TaskCard, TaskModal)
- **schedule ↔ energy** (through insight panel)
- **gemini ↔ waifu** (GeminiChat displays waifu)
- **insight ↔ waifu** (shows waifu message on insight)

### Medium Coupling
- **tasks ↔ schedule** (component reuse)
- **shop ↔ waifu** (displays affection)
- **goals ↔ schedule** (task→goal linking)
- **template ↔ schedule** (MemoModal reuse)

### Low/No Coupling
- **focus** (standalone)
- **feedback** (standalone)
- **gamification** (event-driven, not imported)
- **stats** (read-only aggregation)
- **quickadd** (isolated)
- **settings** (configuration only)

## 6. Shared Hooks (Cross-Feature)

### In src/shared/hooks/:
- **useGameState** - Used by 3+ features
- **useDailyData** - Used by 2+ features
- **useToastStore** - Inconsistently used (some use toast directly)
- **useQuests** - For quest system

### In Features (Feature-Specific):
- **useWaifu()** - waifu/hooks (used by 6 features!)
- **useEnergy()** - energy/hooks (used by 3 features)
- **useDragDropManager()** - schedule/hooks
- **useTimeBlockCalculations()** - schedule/hooks
- **useTimeBlockTimer()** - schedule/hooks

## 7. Shared Utilities & Type System

### Common Across All Features:
- **Type System:** src/shared/types/domain
  - Task, TimeBlock, DailyGoal, Quest, ShopItem, etc.
  
- **Calculation Utils:**
  - calculateAdjustedDuration (task resistance multiplier)
  - calculateTaskXP (XP calculation)
  - TIME_BLOCKS, RESISTANCE_MULTIPLIERS constants

- **Date/Format Helpers:**
  - getLocalDate, formatTime, formatDuration

### Services Used Across Features:
1. **syncLogger** - logging sync operations
2. **geminiApi** - AI task suggestion, breakdown, emoji
3. **aiService** - context building for AI
4. **audioService** - sound effects
5. **emojiSuggester** - scheduled emoji suggestions

## 8. Communication Patterns

### Store-Based Communication
Most features communicate through shared Zustand stores rather than direct imports.

```
Feature A → Store → Feature B
```

### Direct Component Imports
- schedule/TaskCard imported by tasks/InboxTab
- schedule/TaskModal imported by tasks/InboxTab, template
- schedule/MemoModal imported by template
- waifu/hooks imported by 6 features

### Event-Driven (Gameplay)
Task completion triggers handler chain affecting multiple features:
```
TaskCompletionService
├── GoalProgressHandler
├── XPRewardHandler
├── QuestProgressHandler
├── WaifuAffectionHandler
└── BlockCompletionHandler
```

## 9. Tight Coupling Issues & Refactoring Opportunities

### Current Tight Couplings
1. **schedule ↔ tasks** - Component reuse instead of composition
   - InboxTab directly imports TaskCard, TaskModal
   - Better: Export composition interface

2. **Multiple features ↔ waifu** - 6-way coupling on single hook
   - Affection syncing in: insight, gemini, shop, schedule, tasks, gamification
   - Better: Centralize waifu updates through service

3. **Inconsistent notification pattern**
   - Some use react-hot-toast directly
   - Some use useToastStore
   - Better: Standardize on one pattern

4. **Template ↔ Schedule** - Component reuse
   - TemplateModal imports MemoModal
   - Better: Export from shared

### Refactoring Opportunities

1. **Extract Shared Component Library**
   - Move schedule/TaskCard to shared/components
   - Move schedule/TaskModal to shared/components
   - Move schedule/MemoModal to shared/components

2. **Centralize Waifu Messaging**
   - Create waifu/services/companionMessagingService
   - Deprecate direct useWaifu calls for affection updates
   - Use event bus for waifu state changes

3. **Standardize Notifications**
   - Create shared/services/notificationService
   - Wrap both toast and toastStore
   - Eliminate direct react-hot-toast imports

4. **Extract Task Management Service**
   - Common task operations scattered across schedule, tasks, inbox
   - Create shared/services/taskManagementService

## 10. Feature Interaction Diagram

```
                    [SETTINGS]
                         |
                         v
        [GAMIFICATION] ← [SCHEDULE] → [TEMPLATE]
              |              |              |
              v              v              v
          [WAIFU] ← [INSIGHT] [TASKS] → [FOCUS]
              |       |         |
              v       v         v
           [SHOP] [GEMINI] [GOALS]
                         |
                         v
                     [ENERGY]
```

## 11. Key Patterns for Refactoring

### Pattern 1: Composition over Inheritance
Instead of:
```tsx
// InboxTab.tsx
import TaskCard from '@/features/schedule/TaskCard';
```

Better:
```tsx
// InboxTab.tsx
import TaskCard from '@/shared/components/TaskCard';
```

### Pattern 2: Service Layer for Cross-Feature Operations
Instead of:
```tsx
// Multiple places
const { waifuState } = useWaifu();
// direct state mutation
```

Better:
```tsx
// companionService.ts
export const incrementAffection = (amount: number) => {
  // Centralized logic
};

// Feature
companionService.incrementAffection(10);
```

### Pattern 3: Event-Driven for State Synchronization
Instead of:
```tsx
// Direct store coupling
const { updateWaifu } = useWaifu();
const { gameState } = useGameState();
```

Better:
```tsx
// Event bus
eventBus.emit('task:completed', { task, xp });
// Features listen and react independently
```

