# Data Repositories

데이터 영속성을 관리하는 Repository 패턴 구현 모듈

## 📁 모듈 구조

```
repositories/
├── baseRepository.ts          # 공통 Repository 패턴 기반 클래스
├── dailyData/                 # DailyData Repository (모듈화)
│   ├── index.ts
│   ├── types.ts
│   ├── coreOperations.ts
│   ├── taskOperations.ts
│   ├── blockOperations.ts
│   └── queryHelpers.ts
├── dailyDataRepository.ts     # DailyData Facade (하위 호환)
├── gameStateRepository.ts     # 게임 상태 (XP, 레벨, 퀘스트)
├── templateRepository.ts      # 작업 템플릿
├── inboxRepository.ts         # 글로벌 인박스
├── globalGoalRepository.ts    # 장기 목표
├── waifuRepository.ts         # 와이푸 상태
├── settingsRepository.ts      # 앱 설정
├── chatHistoryRepository.ts   # Gemini 채팅 히스토리
├── energyRepository.ts        # 에너지 레벨
├── shopRepository.ts          # 상점 아이템
├── systemRepository.ts        # 시스템 상태
└── dailyGoalRepository.ts     # 일일 목표
```

## 🎯 Repository 패턴

### 역할
Repository는 **데이터 접근 로직을 추상화**하여 비즈니스 로직(Store, Service)과 분리합니다.

```
Store/Service
    ↓
Repository (추상화 레이어)
    ↓
├─▶ IndexedDB (Dexie)     [Primary]
├─▶ localStorage          [Secondary Fallback]
└─▶ Firebase RTDB         [Cloud Sync]
```

### 3-Tier Persistence Strategy

모든 Repository는 3단계 데이터 저장 전략을 따릅니다:

1. **IndexedDB (Primary)** - Dexie ORM으로 고성능 로컬 저장
2. **localStorage (Secondary)** - 동기식 폴백 (IndexedDB 실패 시)
3. **Firebase (Cloud)** - 비동기 클라우드 동기화 및 백업

```typescript
// 예시: DailyData 저장
await saveDailyData(date, data);
// ↓
// 1. IndexedDB에 저장 (즉시)
// 2. localStorage에 백업 (동기)
// 3. Firebase에 동기화 (비동기)
```

## 📘 주요 Repository

### DailyData Repository
- **파일**: `dailyData/` (모듈화)
- **책임**: 일일 작업 및 타임블록 상태 관리
- **주요 함수**:
  - `loadDailyData(date)` - 일일 데이터 로드
  - `saveDailyData(date, data)` - 일일 데이터 저장
  - `addTask(date, task)` - 작업 추가
  - `updateTask(date, taskId, updates)` - 작업 수정
  - `deleteTask(date, taskId)` - 작업 삭제
  - `toggleTaskCompletion(date, taskId)` - 작업 완료/미완료 토글
  - `updateBlockState(date, blockId, state)` - 블록 상태 업데이트

### GameState Repository
- **파일**: `gameStateRepository.ts`
- **책임**: 게임 상태 (XP, 레벨, 퀘스트, 스트릭) 관리
- **주요 함수**:
  - `loadGameState()` - 게임 상태 로드
  - `saveGameState(state)` - 게임 상태 저장
  - `addXP(amount)` - XP 추가
  - `spendXP(amount)` - XP 소비
  - `updateQuest(questId, progress)` - 퀘스트 업데이트

### Template Repository
- **파일**: `templateRepository.ts`
- **책임**: 작업 템플릿 및 반복 작업 관리
- **주요 함수**:
  - `loadTemplates()` - 템플릿 목록 로드
  - `saveTemplate(template)` - 템플릿 저장
  - `deleteTemplate(id)` - 템플릿 삭제
  - `generateTasksFromTemplate(template, date)` - 템플릿에서 작업 생성

### Inbox Repository
- **파일**: `inboxRepository.ts`
- **책임**: 날짜 독립적 작업 관리
- **주요 함수**:
  - `loadInboxTasks()` - 인박스 작업 로드
  - `addInboxTask(task)` - 인박스에 작업 추가
  - `moveToDaily(taskId, date)` - 작업을 특정 날짜로 이동
  - `completeInboxTask(taskId)` - 인박스 작업 완료

### GlobalGoal Repository
- **파일**: `globalGoalRepository.ts`
- **책임**: 장기 목표 및 시간 추적 관리
- **주요 함수**:
  - `loadGoals()` - 목표 목록 로드
  - `saveGoal(goal)` - 목표 저장
  - `updateGoalProgress(goalId, progress)` - 목표 진행률 업데이트
  - `addTimeToGoal(goalId, minutes)` - 목표에 시간 추가

### Settings Repository
- **파일**: `settingsRepository.ts`
- **책임**: 앱 설정 및 API 키 관리
- **주요 함수**:
  - `loadSettings()` - 설정 로드
  - `saveSettings(settings)` - 설정 저장
  - ⚠️ **보안**: API 키는 로컬에만 저장, Firebase 동기화 안 됨

## 🔧 BaseRepository

모든 Repository는 `baseRepository.ts`를 확장하여 공통 기능을 재사용합니다:

```typescript
export abstract class BaseRepository<T> {
  protected abstract tableName: string;

  async get(key: string): Promise<T | undefined>;
  async put(key: string, data: T): Promise<void>;
  async delete(key: string): Promise<void>;
  async getAll(): Promise<T[]>;

  // 3-tier persistence
  protected async persistToIndexedDB(key: string, data: T);
  protected async persistToLocalStorage(key: string, data: T);
  protected async syncToFirebase(key: string, data: T);
}
```

## 📋 사용 예시

### Store에서 Repository 호출

```typescript
// dailyDataStore.ts
import { loadDailyData, saveDailyData } from '@/data/repositories/dailyData';

export const dailyDataStore = create((set, get) => ({
  async loadData(date: string) {
    // Repository를 통해 데이터 로드
    const data = await loadDailyData(date);
    set({ dailyData: data });
  },

  async addTask(task: Task) {
    // Optimistic Update
    const newTasks = [...get().dailyData.tasks, task];
    set({ dailyData: { ...get().dailyData, tasks: newTasks } });

    try {
      // Repository를 통해 영속화
      await saveDailyData(get().currentDate, get().dailyData);
    } catch (error) {
      // Rollback on error
      set({ dailyData: originalData });
      throw error;
    }
  },
}));
```

## 🔄 Firebase 동기화

Repository는 자동으로 Firebase와 동기화됩니다:

```typescript
// 내부 구현
protected async syncToFirebase<T>(
  strategy: SyncStrategy<T>,
  data: T,
  key?: string
) {
  if (!isFirebaseInitialized()) return;

  await syncToFirebase(strategy, data, key);
  // → src/shared/services/sync/firebase/syncCore.ts
}
```

동기화 전략은 `src/shared/services/sync/firebase/strategies.ts`에 정의되어 있습니다.

## ⚠️ 중요 규칙

### 1. Repository는 데이터 레이어만 담당
- ✅ CRUD 작업
- ✅ 3-tier 영속화
- ❌ 비즈니스 로직 (→ Store/Service)
- ❌ UI 로직 (→ Component)

### 2. Store에서만 Repository 호출
```typescript
// ✅ 올바른 패턴
// Store → Repository
dailyDataStore.addTask() → addTask(date, task)

// ❌ 잘못된 패턴
// Component → Repository (Store 생략)
TaskModal.tsx → addTask(date, task) // 금지!
```

### 3. Optimistic Update 패턴
```typescript
// 1. UI 즉시 업데이트
setState(newData);

// 2. Repository 호출
try {
  await repository.save(newData);
} catch (error) {
  // 3. 실패 시 rollback
  setState(originalData);
}
```

### 4. 에러 처리
모든 Repository 함수는 에러를 throw합니다. 호출하는 쪽(Store)에서 try-catch로 처리해야 합니다.

## 🔗 관련 모듈

- `src/data/db/dexieClient.ts` - IndexedDB 스키마
- `src/shared/services/sync/firebase/` - Firebase 동기화
- `src/shared/stores/` - Zustand 상태 관리
- `src/data/repositories/dailyData/README.md` - DailyData Repository 상세

## 📊 Repository 의존성 그래프

```
┌─────────────────────────────────────────────────┐
│                   Stores                        │
│  (dailyDataStore, gameStateStore, ...)          │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│               Repositories                      │
│  (dailyData, gameState, template, ...)          │
└────────────────┬────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Dexie   │  │localStorage│  │Firebase │
│(IndexDB)│  │           │  │ RTDB    │
└─────────┘  └─────────┘  └─────────┘
```

## 🧪 테스트 가이드

Repository는 독립적으로 테스트 가능합니다:

```typescript
describe('DailyData Repository', () => {
  it('should save and load daily data', async () => {
    const testData = createMockDailyData();
    await saveDailyData('2025-01-17', testData);

    const loaded = await loadDailyData('2025-01-17');
    expect(loaded).toEqual(testData);
  });
});
```
