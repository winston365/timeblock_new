# Zustand Stores

전역 상태 관리를 위한 Zustand 스토어 모음

## 📁 Store 목록

```
stores/
├── dailyDataStore.ts          # 일일 작업 & 타임블록 상태 (가장 큰 스토어)
├── gameStateStore.ts          # XP, 레벨, 퀘스트, 스트릭
├── settingsStore.ts           # API 키, Firebase 설정, 사용자 설정
├── waifuCompanionStore.ts     # 와이푸 상태 (호감도, 포즈, 메시지)
├── focusStore.ts              # 포커스 타이머 상태
├── uiStore.ts                 # UI 상태 (모달, 패널 열림/닫힘)
├── toastStore.ts              # Toast 알림 관리
├── realityCheckStore.ts       # 현실 체크 모달 상태
├── inboxStore.ts              # 글로벌 인박스 작업
├── goalStore.ts               # 글로벌 목표
├── templateStore.ts           # 작업 템플릿
└── completedTasksStore.ts     # 완료된 인박스 작업
```

## 🎯 Store 아키텍처

### 상태 관리 계층

```
Components (UI)
    ↓ (subscribe)
Zustand Stores (State Management)
    ↓ (persist)
Repositories (Data Layer)
    ↓
Dexie / localStorage / Firebase
```

### 핵심 원칙

1. **단일 책임 원칙**: 각 Store는 하나의 도메인만 담당
2. **Optimistic Update**: UI 먼저 업데이트, 실패 시 rollback
3. **Repository 위임**: 데이터 영속화는 Repository에 위임
4. **Immutable Update**: Immer 없이 스프레드 연산자 사용

## 📘 주요 Store 상세

### 1. dailyDataStore
**책임**: 일일 작업 및 타임블록 상태 관리

```typescript
interface DailyDataStore {
  // State
  currentDate: string;
  dailyData: DailyData | null;
  loading: boolean;

  // Actions
  loadDailyData: (date: string) => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskCompletion: (taskId: string) => Promise<void>;
  updateBlockState: (blockId: string, state: Partial<TimeBlockState>) => Promise<void>;
  moveTaskToBlock: (taskId: string, blockId: string) => Promise<void>;
}
```

**사용 예시**:
```typescript
import { useDailyDataStore } from '@/shared/stores/dailyDataStore';

function TaskList() {
  const { dailyData, addTask, toggleTaskCompletion } = useDailyDataStore();

  const handleAddTask = async () => {
    await addTask({ text: '새 작업', timeBlock: 'morning', ... });
  };

  return (
    <div>
      {dailyData?.tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={() => toggleTaskCompletion(task.id)}
        />
      ))}
    </div>
  );
}
```

### 2. gameStateStore
**책임**: 게임화 요소 (XP, 레벨, 퀘스트, 스트릭) 관리

```typescript
interface GameStateStore {
  // State
  totalXP: number;
  availableXP: number;
  level: number;
  dailyQuests: Quest[];
  loginStreak: number;

  // Actions
  addXP: (amount: number) => Promise<void>;
  spendXP: (amount: number) => Promise<void>;
  updateQuest: (questId: string, progress: number) => Promise<void>;
  checkAndResetDailyQuests: () => Promise<void>;
}
```

**자동 실행**:
- 작업 완료 시 XP 자동 지급 (`taskCompletionService`)
- 퀘스트 진행률 자동 업데이트

### 3. settingsStore
**책임**: 앱 설정 및 API 키 관리

```typescript
interface SettingsStore {
  // State
  geminiApiKey: string | null;
  firebaseConfig: FirebaseConfig | null;
  geminiModel: string;
  theme: 'light' | 'dark' | 'auto';
  autoSaveInterval: number;

  // Actions
  setGeminiApiKey: (key: string) => Promise<void>;
  setFirebaseConfig: (config: FirebaseConfig) => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
}
```

**보안 주의**:
- API 키는 로컬에만 저장
- Firebase 동기화 **안 됨** (보안)

### 4. waifuCompanionStore
**책임**: 와이푸 상태 관리 (호감도, 포즈, 메시지)

```typescript
interface WaifuCompanionStore {
  // State
  affection: number;          // 0-100
  currentPose: string;        // 'happy', 'sad', etc.
  currentMessage: string | null;
  isVisible: boolean;

  // Actions
  increaseAffection: (amount: number) => Promise<void>;
  decreaseAffection: (amount: number) => Promise<void>;
  showMessage: (message: string, duration?: number) => void;
  updatePose: (pose: string) => Promise<void>;
  toggleVisibility: () => void;
}
```

**트리거**:
- 작업 완료 → 호감도 증가
- 작업 삭제 → 호감도 감소
- 호감도 변화 → 포즈 자동 업데이트

### 5. inboxStore
**책임**: 글로벌 인박스 (날짜 독립적 작업) 관리

```typescript
interface InboxStore {
  // State
  inboxTasks: InboxTask[];
  completedTasks: InboxTask[];

  // Actions
  addInboxTask: (task: InboxTask) => Promise<void>;
  updateInboxTask: (id: string, updates: Partial<InboxTask>) => Promise<void>;
  deleteInboxTask: (id: string) => Promise<void>;
  completeInboxTask: (id: string) => Promise<void>;
  moveToDaily: (id: string, date: string) => Promise<void>;
}
```

### 6. goalStore
**책임**: 장기 목표 관리

```typescript
interface GoalStore {
  // State
  goals: GlobalGoal[];

  // Actions
  addGoal: (goal: GlobalGoal) => Promise<void>;
  updateGoal: (id: string, updates: Partial<GlobalGoal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  updateProgress: (id: string, progress: number) => Promise<void>;
  addTimeToGoal: (id: string, minutes: number) => Promise<void>;
}
```

**자동 업데이트**:
- 작업 완료 시 관련 목표의 진행률 자동 업데이트 (`goalProgressHandler`)

### 7. uiStore
**책임**: UI 상태 (모달, 패널) 관리

```typescript
interface UIStore {
  // State
  isGeminiChatOpen: boolean;
  isSettingsOpen: boolean;
  isStatsOpen: boolean;
  activePanel: 'schedule' | 'goals' | 'stats' | null;

  // Actions
  openGeminiChat: () => void;
  closeGeminiChat: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setActivePanel: (panel: string | null) => void;
}
```

### 8. toastStore
**책임**: Toast 알림 관리

```typescript
interface ToastStore {
  // State
  toasts: Toast[];

  // Actions
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  hideToast: (id: string) => void;
}
```

**사용 패턴**:
```typescript
import { useToastStore } from '@/shared/stores/toastStore';

function MyComponent() {
  const showToast = useToastStore(s => s.showToast);

  const handleSuccess = () => {
    showToast('작업이 완료되었습니다!', 'success');
  };
}
```

## 🔄 Optimistic Update 패턴

모든 Store는 Optimistic Update를 따릅니다:

```typescript
// dailyDataStore.ts
async deleteTask(taskId: string) {
  const { dailyData, currentDate } = get();
  if (!dailyData) return;

  // 1. 원본 데이터 백업
  const originalData = { ...dailyData };

  // 2. UI 즉시 업데이트 (Optimistic)
  const newTasks = dailyData.tasks.filter(t => t.id !== taskId);
  set({ dailyData: { ...dailyData, tasks: newTasks } });

  try {
    // 3. Repository에 영속화
    await deleteTask(currentDate, taskId);
  } catch (error) {
    // 4. 실패 시 Rollback
    set({ dailyData: originalData });
    console.error('Failed to delete task:', error);
    throw error;
  }
}
```

## 📊 Store 간 통신

### EventBus를 통한 느슨한 결합

Store는 직접 다른 Store를 호출하지 않고, EventBus를 통해 통신합니다:

```
dailyDataStore.toggleTaskCompletion()
    │
    ▼
eventBus.emit('task:completed', { taskId, xpEarned })
    │
    ├─▶ gameStateStore (XP 추가)
    ├─▶ waifuCompanionStore (호감도 증가)
    ├─▶ goalStore (목표 진행률 업데이트)
    └─▶ ...
```

자세한 내용은 `src/shared/lib/eventBus/README.md` 참조

## 🧪 Store 구독 방법

### 1. 전체 Store 구독 (비권장)
```typescript
const store = useDailyDataStore();
// ❌ Store 전체가 변경되면 리렌더링
```

### 2. Selector로 필요한 상태만 구독 (권장)
```typescript
const dailyData = useDailyDataStore(s => s.dailyData);
const addTask = useDailyDataStore(s => s.addTask);
// ✅ dailyData가 변경될 때만 리렌더링
```

### 3. Shallow Compare (여러 상태 구독)
```typescript
import { shallow } from 'zustand/shallow';

const { dailyData, loading } = useDailyDataStore(
  s => ({ dailyData: s.dailyData, loading: s.loading }),
  shallow
);
```

## ⚠️ 중요 규칙

### 1. Store는 비즈니스 로직만 담당
- ✅ 상태 관리
- ✅ Repository 호출
- ✅ 간단한 유효성 검사
- ❌ 복잡한 비즈니스 로직 (→ Service)
- ❌ UI 로직 (→ Component)

### 2. Repository 위임
```typescript
// ✅ 올바른 패턴
async addTask(task: Task) {
  // UI 업데이트
  set({ tasks: [...get().tasks, task] });

  // Repository에 위임
  await taskRepository.save(task);
}

// ❌ 잘못된 패턴
async addTask(task: Task) {
  // Store에서 직접 DB 접근 금지!
  await db.tasks.put(task);
}
```

### 3. Immutable Update
```typescript
// ✅ 올바른 패턴
set({ tasks: [...get().tasks, newTask] });
set({ dailyData: { ...get().dailyData, tasks: newTasks } });

// ❌ 잘못된 패턴
get().tasks.push(newTask);  // Mutation 금지!
```

### 4. 에러 처리
Store 메서드에서 에러가 발생하면 rollback하고 throw합니다:

```typescript
try {
  await repository.save(data);
} catch (error) {
  set({ data: originalData });  // Rollback
  throw error;  // Component에서 처리하도록 전파
}
```

## 🔗 관련 모듈

- `src/data/repositories/` - 데이터 영속화
- `src/shared/lib/eventBus/` - Store 간 통신
- `src/shared/services/` - 비즈니스 로직
- `src/shared/subscribers/` - EventBus 구독자

## 📈 Store 의존성 그래프

```
┌───────────────────────────────────────────────┐
│              UI Components                    │
└────────────────┬──────────────────────────────┘
                 │ (subscribe)
                 ▼
┌───────────────────────────────────────────────┐
│             Zustand Stores                    │
│  ┌─────────────────────────────────────┐     │
│  │ dailyDataStore ─┬─▶ Repository      │     │
│  │                 └─▶ EventBus.emit()  │     │
│  │                                      │     │
│  │ gameStateStore ───▶ Repository      │     │
│  │ waifuStore ───────▶ Repository      │     │
│  │ goalStore ────────▶ Repository      │     │
│  └─────────────────────────────────────┘     │
└───────────────┬───────────────────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
Repositories  EventBus   Services
```

## 🎓 Best Practices

1. **최소 구독**: 필요한 상태만 selector로 구독
2. **Optimistic Update**: 사용자 경험 향상
3. **에러 처리**: try-catch + rollback
4. **불변 업데이트**: 항상 새 객체/배열 생성
5. **EventBus 활용**: Store 간 직접 호출 금지
6. **Repository 위임**: 데이터 영속화는 Repository에
