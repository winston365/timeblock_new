# Cross-Cutting Logic Analysis - Executive Summary

## Analysis Scope
Analyzed all 16 features in `src/features/` to identify:
- Cross-feature imports and dependencies
- Shared utilities, hooks, and components
- Cross-cutting concerns (logging, validation, etc.)
- Inter-feature communication patterns
- Feature coupling and tight coupling issues

## Key Findings

### 1. Feature Dependency Overview

**16 Features identified:**
energy, feedback, focus, gamification, gemini, goals, insight, quickadd, schedule, settings, shop, stats, tasks, template, waifu

**Coupling Analysis:**
- 6 features have cross-feature imports
- 10 features are isolated (no external feature imports)
- Average 2-3 shared store dependencies per feature
- **settingsStore** used by 7 features (highest utilization)

### 2. Hub Features (High Connectivity)

| Feature | Imports FROM | Imports TO | Coupling |
|---------|-------------|-----------|----------|
| **schedule** | None | 2 features (tasks, template) | Central Hub |
| **waifu** | None | 6 features (insight, gemini, shop, schedule, tasks, gamification) | Highest Coupling |
| **energy** | None | 3 features (insight, gemini, energy) | Analytics Hub |
| **tasks** | schedule (3 imports) | None | Dependent |
| **insight** | waifu, energy | None | Dependent |
| **gemini** | waifu, energy | None | Dependent |

### 3. Cross-Cutting Concerns

#### A. Task Completion Pipeline
- Handler chain affecting 5+ features
- Triggered from schedule/TaskCard
- Coordinates: goals, gamification, waifu, insight
- **Location:** src/shared/services/gameplay/taskCompletion/

#### B. AI Integration
- 4 features use Gemini API independently
- Shared token tracking needed
- **Files:** schedule/TaskModal, gemini, insight, tasks/TaskBreakdownModal

#### C. Notification System
- 9 files use react-hot-toast directly
- Inconsistent patterns (some use toastStore)
- **Files:** schedule (3), tasks (2), shop (2), settings, goals (2)

#### D. Waifu Messaging
- 6-way coupling on useWaifu() hook
- Multiple update points: task completion, insights, purchases
- **Pattern:** Hook imports spread across features

#### E. Firebase Synchronization
- Affects all features through stores
- 3-tier fallback: IndexedDB → localStorage → Firebase
- Repository pattern handles sync logic

### 4. Tight Coupling Issues

**Issue #1: Schedule Component Exports (CRITICAL)**
- TaskCard and TaskModal imported by tasks/InboxTab
- These are schedule-internal but used elsewhere
- Changes to schedule break tasks feature
- **Impact:** HIGH - Structural coupling

**Issue #2: Waifu Hook Over-coupling (CRITICAL)**
- useWaifu() imported by 6 features
- Multiple features read affection state directly
- Difficult to refactor waifu without breaking 6 places
- **Impact:** HIGH - 6-way dependency

**Issue #3: Inconsistent Notification Pattern (MEDIUM)**
- 9 files use different notification approaches
- Some use react-hot-toast, some use useToastStore
- Hard to centralize notification logic
- **Impact:** MEDIUM - Code quality

**Issue #4: Missing Event Bus (MEDIUM)**
- Gameplay events trigger multiple features
- No clear event contract
- Features communicate through shared stores
- **Impact:** MEDIUM - Architecture clarity

**Issue #5: Store Access Inconsistency (LOW)**
- Features access stores differently
- Some use hooks, some use getState()
- No standardized pattern
- **Impact:** LOW - Maintainability

### 5. Cross-Feature Communication Patterns

#### Store-Based Communication (Primary)
```
Feature A → Shared Store → Feature B
```
Used by: majority of features
Pros: Reactive, predictable
Cons: Hard to trace flow

#### Direct Hook Import (Secondary)
```
Feature A → Feature B Hook → Feature B Store
```
Used by: waifu (6 features), energy (3 features)
Pros: Simple
Cons: Tight coupling

#### Component Reuse (Tertiary)
```
Feature A → Feature B Component → Feature B State
```
Used by: schedule components (tasks, template)
Pros: DRY principle
Cons: Structural coupling

#### Event-Driven (Currently Missing)
```
Feature A → Event Bus → Multiple Features
```
Used by: Task completion handlers (partial)
Pros: Decoupled, traceable
Cons: Requires event bus implementation

### 6. Shared Resources Summary

**Shared Stores (7 total):**
- gameStateStore (3 features)
- settingsStore (7 features) ← most used
- waifuCompanionStore (4 features)
- inboxStore (2 features)
- goalStore (2 features)
- toastStore (2 features)
- dailyDataStore (1 feature)

**Shared Hooks (4 total):**
- useGameState (3+ features)
- useDailyData (2+ features)
- useWaifu (6 features) ← most imported
- useEnergy (3 features)

**Shared Components:**
- TaskCard (imported by tasks, template)
- TaskModal (imported by tasks, template)
- MemoModal (imported by template)
- Various UI components (NeonCheckbox, XPBar, Typewriter)

**Shared Services:**
- AI: geminiApi, aiService, emojiSuggester
- Sync: firebase services, syncLogger
- Gameplay: taskCompletionService, handlers
- Media: audioService

**Shared Types:**
- Task, TimeBlock, TimeBlockId, Resistance
- DailyGoal, Quest, ShopItem, WaifuState, EnergyLevel
- All in src/shared/types/domain

### 7. Health Assessment

**Features by Health Score:**

**Excellent (Isolated):**
- focus (0 external imports)
- feedback (0 external imports)
- settings (0 external imports)
- quickadd (0 external imports)
- stats (0 external imports)
- gamification (0 direct feature imports)

**Good (Dependent but clean):**
- goals (uses shared stores only)
- shop (1 feature import: waifu)
- template (1 feature import: schedule)

**Fair (Moderate coupling):**
- energy (3 feature imports)
- tasks (3 feature imports from schedule)
- insight (2 feature imports: waifu, energy)
- gemini (2 feature imports: waifu, energy)

**Needs Refactoring (High coupling):**
- schedule (2 features import from it, needs extraction)
- waifu (6 features depend on it, needs service layer)

---

## Refactoring Recommendations

### PRIORITY 1: Extract Shared Task Components
**Effort:** 2 days | **Impact:** HIGH | **Risk:** LOW

Move TaskCard, TaskModal, MemoModal from schedule to shared/components/task/

**Benefits:**
- Removes structural coupling between schedule and tasks
- Establishes shared component library
- Foundation for other refactorings

**Affected Files:** 3 features (schedule, tasks, template)

### PRIORITY 2: Centralize Waifu Messaging
**Effort:** 3 days | **Impact:** HIGH | **Risk:** MEDIUM

Create companionService to wrap useWaifu() calls

**Benefits:**
- Reduces 6-way coupling to 1 service facade
- Centralizes affection update logic
- Easier to test waifu-dependent features

**Affected Files:** 6 features (insight, gemini, shop, schedule, tasks, gamification)

### PRIORITY 3: Standardize Notifications
**Effort:** 2 days | **Impact:** MEDIUM | **Risk:** LOW

Create notificationService wrapping react-hot-toast

**Benefits:**
- Consistent notification pattern
- Easier to customize notifications globally
- Centralized notification logic

**Affected Files:** 9 files (schedule, tasks, shop, settings, goals)

### PRIORITY 4: Implement Event Bus
**Effort:** 4 days | **Impact:** MEDIUM | **Risk:** MEDIUM

Create event bus for gameplay events (task completion, level up, etc.)

**Benefits:**
- Decouples features from each other
- Clear event contracts
- Easier to trace cross-feature interactions
- Better foundation for testing

**Affected Files:** taskCompletionService + all consumers

### PRIORITY 5: Standardize Store Access
**Effort:** 1 day | **Impact:** LOW | **Risk:** LOW

Create useAppState wrapper for consistent store access

**Benefits:**
- Consistent pattern across features
- Easier to refactor stores
- Better code readability

**Affected Files:** 7+ features

---

## Metrics

### Before Refactoring
- **Cross-feature imports:** 9 instances
- **Feature coupling:** Average 1.8 per feature
- **Store dependencies:** Average 2.3 per feature
- **Shared hooks:** 4 hooks used by multiple features
- **Notification patterns:** 2 patterns (toast + store)
- **Event coordination:** Manual through stores

### After Refactoring (Target)
- **Cross-feature imports:** 0 direct imports
- **Feature coupling:** Average <0.1 per feature
- **Store dependencies:** Average 0.5 per feature
- **Shared hooks:** 0 cross-feature hooks (all wrapped in services)
- **Notification patterns:** 1 pattern (notificationService)
- **Event coordination:** Event bus

### Estimated Timeline
- **Sprint 1-2:** Extract task components
- **Sprint 3-4:** Centralize waifu messaging
- **Sprint 5-6:** Standardize notifications
- **Sprint 7-8:** Implement event bus
- **Sprint 9-10:** Standardize store access

**Total: 10 sprints (5 months) of part-time work**

---

## Documents Provided

This analysis includes:

1. **cross_cutting_analysis.md** - High-level overview of all cross-cutting logic
2. **feature_dependency_details.md** - Detailed import graph and coupling analysis
3. **refactoring_strategies.md** - Implementation guide with code examples
4. **ANALYSIS_SUMMARY.md** - This executive summary

---

## Recommended Next Steps

1. **Review** this analysis with the team
2. **Prioritize** based on business needs and bandwidth
3. **Start with Priority 1** (extract task components) as foundation
4. **Document patterns** as each priority is completed
5. **Update CLAUDE.md** with new architecture decisions
6. **Monitor** for new cross-feature dependencies

---

## Key Insights

### What's Working Well
- Zustand stores provide clean state management
- Task completion handler chain is well-architected
- Feature-based organization is clean
- Shared type system is comprehensive
- Isolated features have no coupling

### What Needs Improvement
- Component reuse is too coupled (schedule→tasks)
- Hook usage is inconsistent (waifu spread across 6 features)
- Notification patterns are not standardized
- Missing event bus for gameplay coordination
- Store access patterns are inconsistent

### Architecture Principles to Adopt
1. **Services over Hooks** for cross-feature communication
2. **Event Bus** for decoupled feature coordination
3. **Shared Component Library** instead of feature imports
4. **Centralized Services** for cross-cutting concerns
5. **Clear Boundaries** between features

### Long-Term Vision
- Features import only from shared (not from other features)
- All cross-feature communication goes through event bus or services
- Shared component library for reusable UI
- Consistent patterns across all features
- Easy to add/remove features without breaking others

