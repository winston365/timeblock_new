# Refactoring Strategies for Cross-Cutting Logic

## Executive Summary

**Current State:**
- 16 features with moderate to high coupling (avg 2-3 dependencies per feature)
- 6 features depend on waifu hook (highest coupling point)
- Task components shared between schedule and tasks (structural coupling)
- Inconsistent notification patterns (9 files use different approaches)
- Missing event bus for gameplay coordination

**Target State:**
- Low coupling (avg <1 dependency per feature)
- Centralized service layers for cross-feature operations
- Shared component library for reusable UI
- Event-driven architecture for feature coordination

---

## PRIORITY 1: Extract Shared Task Components (Immediate)

### Issue
TaskCard and TaskModal are schedule-internal but used by tasks/InboxTab and template/TemplateModal.

### Current Structure
```
src/features/schedule/
├── TaskCard.tsx (imported by tasks)
├── TaskModal.tsx (imported by tasks, template)
└── MemoModal.tsx (imported by template)
```

### Proposed Structure
```
src/shared/components/
├── task/
│   ├── TaskCard.tsx
│   ├── TaskModal.tsx
│   ├── MemoModal.tsx
│   └── index.ts

src/features/schedule/
├── hooks/
├── utils/
├── [schedule-specific components]
└── ScheduleView.tsx
```

### Implementation Steps

1. Create src/shared/components/task/index.ts
```typescript
export { default as TaskCard } from './TaskCard';
export { default as TaskModal } from './TaskModal';
export { default as MemoModal } from './MemoModal';
```

2. Copy TaskCard.tsx, TaskModal.tsx, MemoModal.tsx to shared

3. Update imports in features:
```typescript
// Before
import TaskCard from '@/features/schedule/TaskCard';

// After
import { TaskCard } from '@/shared/components/task';
```

4. Update schedule/ScheduleView.tsx:
```typescript
// Before
import TaskCard from './TaskCard';

// After
import { TaskCard } from '@/shared/components/task';
```

5. Keep schedule/components/ for schedule-specific UI only

### Coupling Impact
- **Before:** schedule ↔ tasks, schedule ↔ template
- **After:** shared ← tasks, shared ← schedule, shared ← template
- **Result:** Removes 2 cross-feature dependencies

---

## PRIORITY 2: Centralize Waifu Messaging (High Impact)

### Issue
6 features directly import useWaifu() to read/display affection state.

### Current Pattern
```typescript
// In insight/InsightPanel.tsx
const { waifuState } = useWaifu();

// In gemini/GeminiFullscreenChat.tsx
const { waifuState } = useWaifu();

// In shop/ShopPanel.tsx
const { waifuState } = useWaifu();

// [4 more places...]
```

### Proposed Service Layer

Create `src/features/waifu/services/companionService.ts`:
```typescript
import { useWaifuCompanionStore } from '@/shared/stores/waifuCompanionStore';
import { useWaifuStore } from '../stores/waifuStore';

export const companionService = {
  /**
   * Show companion message
   */
  showMessage(message: string) {
    const store = useWaifuCompanionStore.getState();
    store.show(message);
  },

  /**
   * Update affection and show message
   */
  async updateAffection(amount: number, reason?: string) {
    const waifuStore = useWaifuStore.getState();
    const companionStore = useWaifuCompanionStore.getState();

    // Update state
    const newAffection = await waifuStore.onTaskComplete?.();

    // Generate contextual message
    const messages = {
      task_complete: `작업 완료했구나! 얼마나 자랑스러운데! (+${amount} 호감도)`,
      insight_generated: `새로운 인사이트를 발견했어! 함께 성장하고 있어! 💡`,
      shop_purchase: `멋진 선택이야! 나를 위해 뭔가 사줬네! 😍`,
    };

    const message = reason && messages[reason] 
      ? messages[reason] 
      : `좋아! 호감도 올라갔어! (+${amount})`;

    companionStore.show(message);
    return newAffection;
  },

  /**
   * Get current affection (read-only)
   */
  getAffection() {
    const waifuStore = useWaifuStore.getState();
    return waifuStore.waifuState?.affection ?? 0;
  },

  /**
   * Get mood based on affection
   */
  getMood() {
    const affection = this.getAffection();
    return affection > 80 ? 'loving' : affection > 50 ? 'affectionate' : 'neutral';
  }
};
```

### Migration Steps

1. Replace direct useWaifu() in insight/InsightPanel.tsx:
```typescript
// Before
const { waifuState } = useWaifu();
// ...use waifuState.affection directly

// After
const affection = companionService.getAffection();
companionService.showMessage('새 인사이트가 준비됐어요!');
```

2. Replace in gemini/GeminiFullscreenChat.tsx:
```typescript
// Before
const { waifuState } = useWaifu();
<WaifuImage affection={waifuState.affection} />

// After
const affection = companionService.getAffection();
<WaifuImage affection={affection} />
```

3. Replace in shop/ShopPanel.tsx:
```typescript
// Before
const { waifuState } = useWaifu();
// direct affection display

// After
const affection = companionService.getAffection();
// indirect display through service
```

4. Update schedule/TaskModal.tsx:
```typescript
// Before
const { waifuState } = useWaifu();

// After
const affection = companionService.getAffection();
// only used for read-only display
```

5. Update tasks/TaskBreakdownModal.tsx similarly

6. Keep useWaifu() only in waifu/WaifuPanel.tsx and waifu-specific features

### Coupling Impact
- **Before:** 6 features → useWaifu()
- **After:** 6 features → companionService (decoupled interface)
- **Result:** Reduces coupling points from 6 direct hooks to 1 service facade

---

## PRIORITY 3: Standardize Notification Pattern (Medium Impact)

### Issue
Inconsistent use of toast notifications across 9 features.

### Current Problems
```typescript
// In schedule/TaskCard.tsx
import { toast } from 'react-hot-toast';
toast('완료를 취소했어요...');

// In tasks/InboxTab.tsx
import { toast } from 'react-hot-toast';
toast.error('작업 저장에 실패했습니다.');

// In stats/StatsTab.tsx
import { useToastStore } from '@/shared/stores/toastStore';
// uses custom store instead
```

### Proposed Solution

Create `src/shared/services/notificationService.ts`:
```typescript
import { toast } from 'react-hot-toast';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export const notificationService = {
  /**
   * Show success notification
   */
  success(message: string, duration?: number) {
    return toast.success(message, {
      duration: duration ?? 3000,
      position: 'bottom-right',
    });
  },

  /**
   * Show error notification
   */
  error(message: string, duration?: number) {
    return toast.error(message, {
      duration: duration ?? 4000,
      position: 'bottom-right',
    });
  },

  /**
   * Show info notification
   */
  info(message: string, duration?: number) {
    return toast(message, {
      duration: duration ?? 3000,
      position: 'bottom-right',
      icon: 'ℹ️',
    });
  },

  /**
   * Show warning notification
   */
  warning(message: string, duration?: number) {
    return toast(message, {
      duration: duration ?? 4000,
      position: 'bottom-right',
      icon: '⚠️',
    });
  },

  /**
   * Show custom toast
   */
  custom(message: string, options?: any) {
    return toast(message, options);
  },

  /**
   * Dismiss all toasts
   */
  dismissAll() {
    toast.remove();
  }
};
```

### Migration Path

**Phase 1: Add service alongside existing patterns**
- Keep existing toast imports working
- Add new code uses notificationService
- Gradual migration over 2-3 sprints

**Phase 2: Deprecate direct imports**
- Update existing code to use service
- Remove direct toast imports

**Phase 3: Cleanup**
- Verify all notifications go through service
- Remove any remaining direct imports

### Files to Update
1. schedule/TaskCard.tsx
2. schedule/TimeBlock.tsx
3. schedule/ScheduleView.tsx
4. tasks/InboxTab.tsx
5. shop/ShopModal.tsx
6. shop/ShopPanel.tsx
7. settings/SettingsModal.tsx
8. goals/GoalModal.tsx
9. goals/GoalPanel.tsx

### Coupling Impact
- **Before:** 9 files with direct toast imports
- **After:** 9 files using notificationService
- **Result:** Centralized notification logic, easier to customize

---

## PRIORITY 4: Create Event Bus for Gameplay (Long-Term Architecture)

### Issue
Gameplay events (task completion, level up, etc.) trigger multiple features, but no clear event contract.

### Proposed Event System

Create `src/shared/services/eventBus.ts`:
```typescript
type EventListener<T = any> = (payload: T) => void | Promise<void>;

interface EventBusEvents {
  'task:completed': { task: Task; xpGained: number; isPerfectBlock: boolean };
  'level:up': { newLevel: number; totalXP: number };
  'quest:completed': { quest: Quest; reward: number };
  'waifu:affection_changed': { affection: number; reason: string };
  'insight:generated': { text: string };
  'shop:purchased': { item: ShopItem };
}

export class EventBus {
  private listeners = new Map<string, Set<EventListener>>();

  on<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)!.delete(listener);
    };
  }

  async emit<K extends keyof EventBusEvents>(
    event: K,
    payload: EventBusEvents[K]
  ) {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    await Promise.all(
      Array.from(listeners).map(listener => 
        Promise.resolve(listener(payload)).catch(console.error)
      )
    );
  }

  off<K extends keyof EventBusEvents>(
    event: K,
    listener: EventListener<EventBusEvents[K]>
  ) {
    this.listeners.get(event)?.delete(listener);
  }
}

export const eventBus = new EventBus();
```

### Integration with TaskCompletionService

```typescript
// In taskCompletionService.ts
async handleTaskCompletion(context: TaskCompletionContext) {
  // ... existing handler logic ...

  // Emit task completion event
  await eventBus.emit('task:completed', {
    task: context.task,
    xpGained,
    isPerfectBlock
  });

  // Emit level-up if applicable
  if (leveledUp) {
    await eventBus.emit('level:up', {
      newLevel: newLevel,
      totalXP: totalXP
    });
  }
}
```

### Feature Usage Examples

**gamification/QuestsPanel.tsx:**
```typescript
useEffect(() => {
  const unsubscribe = eventBus.on('task:completed', ({ task, xpGained }) => {
    updateQuestProgress(task);
  });

  return unsubscribe;
}, []);
```

**waifu/WaifuPanel.tsx:**
```typescript
useEffect(() => {
  const unsubscribe = eventBus.on('level:up', ({ newLevel }) => {
    showCongratulationsMessage(newLevel);
  });

  return unsubscribe;
}, []);
```

**insight/InsightPanel.tsx:**
```typescript
useEffect(() => {
  const unsubscribe = eventBus.on('waifu:affection_changed', ({ affection }) => {
    // Use affection in context building
  });

  return unsubscribe;
}, []);
```

### Benefits
- **Decoupling:** Features don't import each other
- **Contract:** Clear event interface for cross-feature communication
- **Traceability:** All gameplay events go through one system
- **Testing:** Events can be tested independently
- **Performance:** Async event handling prevents blocking

### Coupling Impact
- **Before:** Direct store imports between features
- **After:** Event-based, features only know about eventBus
- **Result:** Removes all direct feature-to-feature coupling

---

## PRIORITY 5: Consolidate Store Usage (Ongoing)

### Issue
Features inconsistently use settingsStore, gameStateStore, etc.

### Current Pattern
```typescript
// In insight/InsightPanel.tsx
const { settings } = useSettingsStore();
const { gameState } = useGameState();

// In gemini/GeminiFullscreenChat.tsx
const { settings } = useSettingsStore();
const { gameState } = useGameState();

// Different pattern in shop/ShopPanel.tsx
const settings = useSettingsStore(state => state.settings);
```

### Standardization

1. Create wrapper hook: `src/shared/hooks/useAppState.ts`
```typescript
export function useAppState() {
  const settings = useSettingsStore(s => s.settings);
  const gameState = useGameState()[0];
  const dailyData = useDailyData()[0];

  return { settings, gameState, dailyData };
}
```

2. Use consistently:
```typescript
// Before
const { settings } = useSettingsStore();
const { gameState } = useGameState();

// After
const { settings, gameState } = useAppState();
```

3. Document in CLAUDE.md which stores each feature should use

---

## Implementation Timeline

### Sprint 1 (Week 1-2)
- Extract shared task components
- Create task component index.ts
- Update imports in schedule, tasks, template

### Sprint 2 (Week 3-4)
- Create companionService
- Migrate waifu imports (insight, gemini)
- Test waifu-dependent features

### Sprint 3 (Week 5-6)
- Create notificationService
- Migrate toast usage (9 files)
- Ensure consistent notifications

### Sprint 4 (Week 7-8)
- Create eventBus system
- Update taskCompletionService
- Add event listeners to affected features

### Sprint 5 (Week 9-10)
- Standardize store usage patterns
- Create useAppState wrapper
- Document in CLAUDE.md

### Sprint 6+ (Ongoing)
- Monitor for new cross-feature dependencies
- Refactor as needed
- Update documentation

---

## Testing Strategy

### Unit Tests
- companionService methods
- notificationService methods
- eventBus emit/listen
- Shared component imports

### Integration Tests
- Task completion triggers waifu affection
- Insight generation shows waifu message
- Notifications appear correctly
- Events propagate to all listeners

### E2E Tests
- Complete task → waifu affection increases → insight uses new affection
- Purchase from shop → affection changes → waifu message shown
- Gameplay events cascade correctly

---

## Rollback Strategy

Each priority can be rolled back independently:

1. **Task Components:** Revert import paths to schedule
2. **companionService:** Remove service, use hooks again
3. **notificationService:** Keep both working, use direct toast
4. **eventBus:** Remove events, use store subscriptions
5. **Store Standardization:** Remove wrapper hook

Keep feature branches for each priority to enable selective rollback.

