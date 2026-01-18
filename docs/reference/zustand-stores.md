# Zustand 스토어

TimeBlock Planner의 12개 Zustand 스토어 레퍼런스입니다.

## 스토어 위치

```
src/shared/stores/
├── dailyDataStore.ts
├── gameStateStore.ts
├── settingsStore.ts
├── waifuCompanionStore.ts
├── focusStore.ts
├── uiStore.ts
├── toastStore.ts
├── realityCheckStore.ts
├── inboxStore.ts
├── goalStore.ts
├── templateStore.ts
└── completedTasksStore.ts
```

## 핵심 스토어

### dailyDataStore

작업과 타임블록의 중앙 상태 관리

```typescript
interface DailyDataState {
  // 상태
  currentDate: string;
  dailyData: DailyData | null;
  loading: boolean;
  error: string | null;
  
  // 액션
  loadByDate: (date: string) => Promise<void>;
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  moveTaskToBlock: (taskId: string, blockIndex: number) => Promise<void>;
  lockBlock: (blockIndex: number) => Promise<void>;
}
```

**사용 예시:**

```typescript
const { dailyData, updateTask } = useDailyDataStore();

// 작업 업데이트
await updateTask('task-123', { completed: true });
```

### gameStateStore

게이미피케이션 상태 (XP, 레벨, 퀘스트)

```typescript
interface GameStateState {
  // 상태
  level: number;
  totalXP: number;
  availableXP: number;
  streak: number;
  quests: Quest[];
  
  // 액션
  addXP: (amount: number) => Promise<void>;
  spendXP: (amount: number) => Promise<boolean>;
  completeQuest: (questId: string) => Promise<void>;
  refreshDailyQuests: () => Promise<void>;
}
```

### settingsStore

앱 설정 및 사용자 환경설정

```typescript
interface SettingsState {
  // 상태
  geminiApiKey: string | null;
  focusTimerMinutes: number;
  autoMessageInterval: number;
  theme: 'light' | 'dark' | 'system';
  
  // Firebase 설정
  firebaseConfig: FirebaseConfig | null;
  
  // 액션
  updateSetting: <K extends keyof Settings>(
    key: K, 
    value: Settings[K]
  ) => Promise<void>;
}
```

### waifuCompanionStore

AI 동반자 상태 관리

```typescript
interface WaifuCompanionState {
  // 상태
  affection: number;
  currentPose: string;
  currentMessage: string;
  unlockedPoses: string[];
  isVisible: boolean;
  
  // 액션
  increaseAffection: (amount: number) => Promise<void>;
  decreaseAffection: (amount: number) => Promise<void>;
  showPose: (pose: string, duration?: number) => void;
  showMessage: (message: string) => void;
  unlockPose: (pose: string) => Promise<void>;
}
```

## UI 스토어

### uiStore

전역 UI 상태

```typescript
interface UIState {
  // 모달 상태
  isSettingsOpen: boolean;
  isStatsOpen: boolean;
  isShopOpen: boolean;
  activeModal: string | null;
  
  // 패널 상태
  isSidebarExpanded: boolean;
  activeTab: string;
  
  // 액션
  openModal: (modalId: string) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
}
```

### toastStore

토스트 알림 관리

```typescript
interface ToastState {
  toasts: Toast[];
  
  // 액션
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// 사용 예시
const { addToast } = useToastStore();
addToast({
  type: 'success',
  message: '작업이 완료되었습니다!',
  duration: 3000
});
```

### focusStore

집중 타이머 상태

```typescript
interface FocusState {
  // 상태
  isActive: boolean;
  remainingSeconds: number;
  targetTaskId: string | null;
  
  // 액션
  startFocus: (taskId: string, minutes: number) => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: () => void;
  tick: () => void;
}
```

### realityCheckStore

현실 체크 모달 (작업 시간 초과 시)

```typescript
interface RealityCheckState {
  isOpen: boolean;
  taskId: string | null;
  actualDuration: number | null;
  
  // 액션
  openCheck: (taskId: string, actualDuration: number) => void;
  closeCheck: () => void;
  submitFeedback: (feedback: RealityFeedback) => Promise<void>;
}
```

## 데이터 스토어

### inboxStore

글로벌 인박스 관리

```typescript
interface InboxState {
  items: InboxItem[];
  loading: boolean;
  
  // 액션
  loadInbox: () => Promise<void>;
  addItem: (item: Omit<InboxItem, 'id'>) => Promise<void>;
  moveToDate: (itemId: string, date: string, blockIndex: number) => Promise<void>;
  completeItem: (itemId: string) => Promise<void>;
}
```

### goalStore

글로벌 목표 관리

```typescript
interface GoalState {
  goals: Goal[];
  
  // 액션
  loadGoals: () => Promise<void>;
  addGoal: (goal: Omit<Goal, 'id'>) => Promise<void>;
  updateProgress: (goalId: string, progress: number) => Promise<void>;
  completeGoal: (goalId: string) => Promise<void>;
}
```

### templateStore

작업 템플릿 관리

```typescript
interface TemplateState {
  templates: Template[];
  
  // 액션
  loadTemplates: () => Promise<void>;
  addTemplate: (template: Omit<Template, 'id'>) => Promise<void>;
  applyTemplate: (templateId: string, date: string) => Promise<void>;
}
```

### completedTasksStore

완료된 인박스 작업 아카이브

```typescript
interface CompletedTasksState {
  items: CompletedInboxItem[];
  
  // 액션
  loadCompleted: () => Promise<void>;
  restoreItem: (itemId: string) => Promise<void>;
}
```

## 사용 패턴

### 기본 사용

```typescript
import { useDailyDataStore } from '@/shared/stores';

function TaskList() {
  const { dailyData, updateTask } = useDailyDataStore();
  
  const handleComplete = async (taskId: string) => {
    await updateTask(taskId, { completed: true });
  };
  
  return (
    <ul>
      {dailyData?.tasks.map(task => (
        <li key={task.id}>
          {task.title}
          <button onClick={() => handleComplete(task.id)}>완료</button>
        </li>
      ))}
    </ul>
  );
}
```

### 선택적 구독

```typescript
// 전체 상태 구독 (비권장 - 리렌더링 많음)
const state = useDailyDataStore();

// 필요한 것만 선택 (권장)
const tasks = useDailyDataStore(state => state.dailyData?.tasks);
const updateTask = useDailyDataStore(state => state.updateTask);
```

### 스토어 외부에서 사용

```typescript
// 리액트 컴포넌트 밖에서 접근
const { getState, setState } = useDailyDataStore;

// 현재 상태 읽기
const currentData = useDailyDataStore.getState().dailyData;

// 직접 상태 변경 (주의해서 사용)
useDailyDataStore.setState({ loading: true });
```

## 다음 단계

- [EventBus](/reference/event-bus) - 이벤트 기반 통신
- [코딩 가이드라인](/reference/coding-guidelines) - 스토어 사용 규칙
