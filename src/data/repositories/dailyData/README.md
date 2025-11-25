# DailyData Repository

일일 작업 데이터 및 타임블록 상태를 관리하는 Repository 모듈

## 📁 모듈 구조

```
dailyData/
├── index.ts           # Public API re-exports
├── types.ts           # 타입 정의 및 헬퍼 함수
├── coreOperations.ts  # DailyData CRUD (생성, 로드, 저장, 삭제)
├── taskOperations.ts  # Task CRUD (추가, 수정, 삭제, 완료 토글)
├── blockOperations.ts # TimeBlockState 관리 (상태 업데이트, 잠금)
└── queryHelpers.ts    # 조회 전용 함수 (인박스, 완료 작업 등)
```

## 🎯 모듈 분리 이유 (R7 규칙)

기존 `dailyDataRepository.ts`가 **600줄 이상**으로 비대해져 역할별로 분리:

| 모듈 | 책임 | 대략 줄 수 |
|------|------|-----------|
| `types.ts` | 타입, 상수, 헬퍼 함수 | ~50줄 |
| `coreOperations.ts` | DailyData 전체 CRUD | ~150줄 |
| `taskOperations.ts` | 개별 Task CRUD | ~200줄 |
| `blockOperations.ts` | TimeBlockState 관리 | ~100줄 |
| `queryHelpers.ts` | 조회 전용 쿼리 | ~150줄 |

## 📘 사용 예시

### DailyData 로드/저장

```typescript
import { loadDailyData, saveDailyData } from '@/data/repositories/dailyData';

// 로드 (3-tier fallback: IndexedDB → localStorage → Firebase)
const dailyData = await loadDailyData('2025-01-17');

// 저장 (3-tier sync: IndexedDB + localStorage + Firebase)
await saveDailyData('2025-01-17', dailyData);
```

### Task 작업

```typescript
import { addTask, updateTask, deleteTask, toggleTaskCompletion } from '@/data/repositories/dailyData';

// 작업 추가
await addTask('2025-01-17', newTask);

// 작업 수정
await updateTask('2025-01-17', taskId, { text: '수정된 내용' });

// 작업 삭제
await deleteTask('2025-01-17', taskId);

// 완료 토글
await toggleTaskCompletion('2025-01-17', taskId);
```

### TimeBlock 상태 관리

```typescript
import { updateBlockState, toggleBlockLock } from '@/data/repositories/dailyData';

// 블록 상태 업데이트
await updateBlockState('2025-01-17', 'block-1', {
  locked: true,
  perfect: true,
});

// 블록 잠금 토글
await toggleBlockLock('2025-01-17', 'block-1');
```

### 조회 헬퍼

```typescript
import { 
  getInboxTasks, 
  getCompletedTasks, 
  getBlockTasks,
  getRecentDailyData 
} from '@/data/repositories/dailyData';

// 인박스 작업 (timeBlock이 없는 작업)
const inboxTasks = await getInboxTasks('2025-01-17');

// 완료된 작업
const completedTasks = await getCompletedTasks('2025-01-17');

// 특정 블록의 작업
const blockTasks = await getBlockTasks('2025-01-17', 'block-1');

// 최근 N일 데이터
const recentData = await getRecentDailyData(7);
```

## 🔄 데이터 흐름

```
Store (dailyDataStore)
    │
    ▼
Repository (dailyData/)
    │
    ├─▶ IndexedDB (Dexie)     [Primary - 즉시 저장]
    │
    ├─▶ localStorage          [Secondary - 동기 백업]
    │
    └─▶ Firebase              [Cloud - 비동기 동기화]
            │
            └─▶ syncToFirebase(dailyDataStrategy, data, date)
```

## 📊 DailyData 구조

```typescript
interface DailyData {
  date: string;           // 'YYYY-MM-DD'
  tasks: Task[];          // 작업 목록
  timeBlockStates: {      // 블록별 상태
    [blockId: string]: TimeBlockState;
  };
  updatedAt: string;      // ISO timestamp
}

interface TimeBlockState {
  locked: boolean;        // 잠금 여부
  perfect: boolean;       // 퍼펙트 달성
  failed: boolean;        // 실패 상태
  timerActive: boolean;   // 타이머 활성화
  timerStartTime?: string;
  timerPausedTime?: number;
}
```

## ⚙️ 헬퍼 함수 (types.ts)

### `ensureBaseBlockState()`
블록 상태가 없을 때 기본값 제공:
```typescript
const state = ensureBaseBlockState(existingState);
// { locked: false, perfect: false, failed: false, timerActive: false }
```

### `normalizeTimeBlockStates()`
모든 블록에 대해 기본 상태 보장:
```typescript
const normalized = normalizeTimeBlockStates(states);
// 6개 블록 모두에 대해 기본값 설정
```

## 🔗 관련 모듈

- `src/shared/stores/dailyDataStore.ts` - 상태 관리
- `src/data/db/dexieClient.ts` - IndexedDB 스키마
- `src/shared/services/sync/firebase/strategies.ts` - Firebase 동기화 전략
- `src/data/repositories/baseRepository.ts` - 공통 Repository 패턴

## ⚠️ 주의사항

1. **직접 DB 접근 금지**: Store에서만 Repository 호출
2. **날짜 형식**: 반드시 `YYYY-MM-DD` 형식 사용
3. **Optimistic Update**: Store에서 낙관적 업데이트 후 Repository 호출
4. **Firebase 동기화**: 자동으로 처리됨 (SyncEngine Hook)
