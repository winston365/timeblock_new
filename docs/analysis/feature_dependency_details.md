# Detailed Feature Dependency Analysis

## A. Feature Import Graph

### 1. INSIGHT
**Imports from features:**
- @/features/waifu/hooks/useWaifu
- @/features/energy/hooks/useEnergy

**Why:** Builds AI context from energy levels and companion affection
**Coupling:** High - requires real-time state from 2 features

### 2. GEMINI
**Imports from features:**
- @/features/waifu/hooks/useWaifu
- @/features/waifu/waifuImageUtils
- @/features/waifu/base.png
- @/features/energy/hooks/useEnergy

**Why:** Displays waifu beside chat, uses affection for context
**Coupling:** High - displays waifu companion during chat

### 3. SCHEDULE
**Imports from features:** None
**Imported by:**
- tasks/InboxTab → TaskCard, TaskModal, useDragDropManager
- template/TemplateModal → MemoModal

**Why:** Core feature - contains reusable task components
**Coupling:** Central hub - 2 features depend on its components

### 4. TASKS
**Imports from features:**
- @/features/schedule/TaskCard
- @/features/schedule/TaskModal
- @/features/schedule/hooks/useDragDropManager

**Why:** Inbox needs task cards and modal from schedule
**Coupling:** High - direct component dependency

### 5. SHOP
**Imports from features:**
- @/features/waifu/hooks/useWaifu

**Why:** Displays waifu affection changes when purchasing
**Coupling:** Medium - uses hook for state

### 6. TEMPLATE
**Imports from features:**
- @/features/schedule/MemoModal

**Why:** Reuses memo editing modal from schedule
**Coupling:** Low-Medium - component reuse

### 7. FOCUS, FEEDBACK, GAMIFICATION, GOALS, SETTINGS, STATS, QUICKADD
**Imports from features:** None
**Coupling:** Isolated - no feature interdependencies

---

## B. Store Usage Across Features

### SETTINGSSTORE (7 features)
- gemini/GeminiFullscreenChat
- schedule/TaskModal
- insight/InsightPanel
- tasks/TaskBreakdownModal
- tasks/GlobalTaskBreakdown
- energy/EnergyTab
- shop/ShopModal

**Impact:** Settings are foundational - changes affect multiple features

### WAIFUCOMPANIONSTORE (4 features)
- gemini/GeminiFullscreenChat
- insight/InsightPanel
- shop/ShopPanel
- app/AppShell (for visibility management)

**Impact:** Manages companion display state globally

### GAMESTATESTORE (3 features)
- waifu/hooks/useWaifu (sync affection with XP)
- feedback/RealityCheckModal
- insight/InsightPanel

**Impact:** XP changes trigger companion updates

### INBOXSTORE (2 features)
- tasks/InboxTab (main usage)
- shared hooks

### GOALSTORE (2 features)
- goals/GoalPanel
- shared hooks

### TOASTSTORE (2 features)
- stats/StatsTab
- shared hooks

---

## C. Service Layer Dependencies

### AI SERVICES
**Used by 4 features:**
1. schedule/TaskModal
   - suggestTaskEmoji
   - generateTaskBreakdown
   - scheduleEmojiSuggestion

2. gemini/GeminiFullscreenChat
   - callAIWithContext (insight generation)

3. insight/InsightPanel
   - callAIWithContext
   - getInsightInstruction

4. tasks/TaskBreakdownModal
   - generateTaskBreakdown
   - callAIWithContext

**Pattern:** All AI calls go through shared/services/ai/

### SYNC SERVICES
**Used by multiple features indirectly:**
- Firebase sync affects all data changes
- Sync conflict resolution happens at repository level
- Features don't directly call sync (handled by stores)

### GAMEPLAY SERVICES
**Task Completion Handler Chain affects:**
1. Goals feature (GoalProgressHandler)
2. Gamification (QuestProgressHandler)
3. Waifu (WaifuAffectionHandler)
4. Schedule (BlockCompletionHandler)

**Triggered from:** schedule/TaskCard (on completion toggle)

---

## D. Hook Reuse Patterns

### useWaifu() - 6-Way Coupling
```
Files importing useWaifu():
1. insight/InsightPanel.tsx:15
2. gemini/GeminiFullscreenChat.tsx:16
3. shop/ShopPanel.tsx:17
4. schedule/TaskModal.tsx:16
5. tasks/TaskBreakdownModal.tsx:16
6. waifu/WaifuPanel.tsx:14 (self)
```

**Risk:** Changes to waifuStore affect 6 files
**Better Pattern:** Wrap waifu state updates in service layer

### useEnergy() - 3-Way Coupling
```
Files importing useEnergy():
1. insight/InsightPanel.tsx:16
2. gemini/GeminiFullscreenChat.tsx:17
3. energy/EnergyTab.tsx:2 (self)
```

### useGameState() - 3+ Files
- insight/InsightPanel
- feedback/RealityCheckModal
- waifu/hooks/useWaifu
- Multiple schedule components

---

## E. Type System Dependencies

### SHARED TYPES (used everywhere)
- Task
- TimeBlock
- TimeBlockId
- Resistance
- DailyGoal
- Quest
- ShopItem
- WaifuState
- EnergyLevel

**Location:** src/shared/types/domain

**Impact:** Type changes require updates across all 16 features

### CONSTANTS (used across features)
- TIME_BLOCKS = ['5-8', '8-11', '11-14', '14-17', '17-20', '20-23']
- RESISTANCE_MULTIPLIERS = { low: 1.0, medium: 1.3, high: 1.6 }
- RESISTANCE_LABELS = { 'low': '쉬움', 'medium': '보통', 'high': '어려움' }

**Usage:** All features dealing with tasks use these

---

## F. Component Sharing Patterns

### SCHEDULE EXPORTS
- TaskCard → imported by tasks/InboxTab, waifu styling
- TaskModal → imported by tasks/InboxTab, tasks/TaskBreakdownModal
- MemoModal → imported by template/TemplateModal
- TimeBlock → core schedule component
- HourBar → visualization component

**Issue:** TaskCard and TaskModal are schedule-internal but exported to tasks

### SHARED COMPONENTS
- NeonCheckbox (schedule, gamification, etc.)
- XPBar (shared UI)
- Typewriter (gemini chat effects)
- Toast components (across features)

---

## G. Data Flow Through Stores

### TASK COMPLETION FLOW
```
1. schedule/TaskCard toggles task.completed
2. TaskCard calls dailyDataStore.updateTask()
3. Store triggers taskCompletionService.handleTaskCompletion()
4. Service chains handlers:
   ├─ GoalProgressHandler updates goalStore
   ├─ XPRewardHandler updates gameStateStore
   ├─ QuestProgressHandler updates gameStateStore (quests)
   ├─ WaifuAffectionHandler updates waifuCompanionStore
   └─ BlockCompletionHandler updates dailyDataStore
5. Event handlers emit events
6. Features react to store updates independently
```

**Features affected:** schedule, gamification, waifu, goals, insight

### INSIGHT GENERATION FLOW
```
1. insight/InsightPanel mounted
2. Check if insight needs refresh (time-based)
3. Gather context:
   ├─ useDailyData() → current tasks
   ├─ useGameState() → XP, level, streaks
   ├─ useWaifu() → affection
   └─ useEnergy() → energy levels
4. Call callAIWithContext() → Gemini API
5. Store result in systemState (Dexie)
6. Show waifu message (waifuCompanionStore)
7. Display in insight panel
```

**Cross-feature dependencies:** waifu, energy, gameState

---

## H. Problematic Patterns Identified

### 1. Tight Waifu Coupling
**Problem:**
```tsx
// In 6 different files
const { waifuState } = useWaifu();
// Then all directly access/display affection
```

**Impact:** Waifu state changes break multiple features
**Solution:** Create companionService layer

### 2. Direct Toast Usage
**Problem:**
```tsx
// Some files
import { toast } from 'react-hot-toast';

// Other files  
import { useToastStore } from '@/shared/stores';
```

**Impact:** Inconsistent notification handling
**Solution:** Create notificationService wrapper

### 3. Schedule Component Exports
**Problem:**
- TaskCard and TaskModal are schedule implementation details
- Imported by tasks/InboxTab as if they were shared components
- Changes to schedule break tasks

**Impact:** Tight coupling between schedule and tasks
**Solution:** Move to shared/components/task/

### 4. Cross-Feature AI Integration
**Problem:**
- 4 features independently call Gemini API
- Token tracking split across services
- No central API quota management

**Impact:** Difficult to track total usage, manage quotas
**Solution:** Create AI service layer with quota management

### 5. Missing Event Bus
**Problem:**
- Features communicate through shared stores
- No clear event contract
- Difficult to track cross-feature interactions

**Solution:** Add event bus for gameplay events

---

## I. Feature Health Scores

### ISOLATED FEATURES (Healthy)
- focus (0 dependencies)
- feedback (0 dependencies)  
- settings (0 dependencies)
- quickadd (0 dependencies)
- stats (0 dependencies)
- gamification (0 direct imports)

**Average Coupling:** 0
**Maintainability:** High

### HUB FEATURES (High Responsibility)
- schedule (2 features import from it)
- waifu (6 features import from it)
- energy (3 features import from it)

**Average Coupling:** 3-6
**Maintainability:** Medium (frequently changed)

### DEPENDENT FEATURES (Moderate Coupling)
- tasks (imports from schedule)
- insight (imports from waifu, energy)
- gemini (imports from waifu, energy)
- shop (imports from waifu)
- template (imports from schedule)

**Average Coupling:** 1-2
**Maintainability:** Medium-High

---

## J. Refactoring Priority Matrix

| Feature | Current Coupling | Refactor Impact | Priority |
|---------|------------------|-----------------|----------|
| schedule | 2 out | HIGH | **HIGH** |
| waifu | 6 out | HIGH | **HIGH** |
| tasks | 3 in | HIGH | **MEDIUM** |
| insight | 2 in | MEDIUM | MEDIUM |
| gemini | 2 in | MEDIUM | MEDIUM |
| template | 1 in | LOW | LOW |
| shop | 1 in | LOW | LOW |

**Recommended sequence:**
1. Extract shared task components (affects schedule & tasks)
2. Centralize waifu messaging (affects 6 features)
3. Standardize notifications (affects 9 features)
4. Create event bus (foundation for all features)

