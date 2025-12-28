# 설계 패턴 및 가이드라인

## 핵심 아키텍처 패턴

### 1. Repository Pattern (데이터 접근)
모든 데이터 작업은 Repository를 통해 수행합니다.

```typescript
// ❌ 직접 DB 접근 금지
import { db } from '@/data/db/dexieClient';
await db.dailyData.put(data);

// ✅ Repository 사용
import { dailyDataRepository } from '@/data/repositories';
await dailyDataRepository.upsert(data);
```

**Repository 위치**: `src/data/repositories/`
- 큰 Repository는 모듈화: `dailyData/` (coreOperations, taskOperations, blockOperations)

### 2. Handler Pattern (작업 완료 파이프라인)
작업 완료 시 순차 실행되는 핸들러 체인:

```typescript
// src/shared/services/gameplay/taskCompletion/handlers/
1. GoalProgressHandler     → 목표 진행도 업데이트
2. XPRewardHandler         → XP 계산 및 지급
3. QuestProgressHandler    → 일일 퀘스트 업데이트
4. WaifuAffectionHandler   → 동반자 호감도 증가
5. BlockCompletionHandler  → 타임블록 완료 체크
```

새 핸들러 추가 시 `TaskCompletionHandler` 인터페이스 구현 후 `taskCompletionService.ts`에 등록

### 3. Strategy Pattern (Firebase 동기화)
각 데이터 타입별 동기화 전략:

```typescript
// src/shared/services/sync/firebase/strategies.ts
interface SyncStrategy<T> {
  upload(data: T): Promise<void>;
  download(): Promise<T | null>;
  resolveConflict(local: T, remote: T): T;
}
```

**충돌 해결**: Last-Write-Wins (LWW)
**재시도**: `syncRetryQueue.ts`에서 실패한 동기화 자동 재시도

### 4. EventBus Pattern (이벤트 기반 통신)
Pub/Sub 패턴으로 컴포넌트 간 통신:

```typescript
// src/shared/lib/eventBus/
// 이벤트 명명: [domain]:[action]
eventBus.emit('task:completed', { taskId: '123' });
eventBus.on('task:completed', handler);

// useEffect cleanup에서 반드시 구독 해제
useEffect(() => {
  const unsubscribe = eventBus.on('task:completed', handler);
  return () => unsubscribe();
}, []);
```

### 5. Optimistic Updates Pattern
UI를 먼저 업데이트하고, 실패 시 롤백:

```typescript
const updateTask = async (task: Task) => {
  const originalState = { ...state };
  // 즉시 UI 업데이트
  setState({ ...state, tasks: [...state.tasks, task] });
  
  try {
    await repository.update(task);
  } catch (error) {
    // 롤백
    setState(originalState);
    toast.error('업데이트 실패');
  }
};
```

## 데이터 저장 정책

### localStorage 사용 금지 (예외: theme)
```typescript
// ❌ 금지
localStorage.setItem('myKey', JSON.stringify(data));

// ✅ Dexie systemState 사용
import { db } from '@/data/db/dexieClient';
await db.systemState.put({ key: 'myKey', value: data });
const record = await db.systemState.get('myKey');
```

### 기본값 중앙 집중화
```typescript
// src/shared/constants/defaults.ts
import { SETTING_DEFAULTS, IDLE_FOCUS_DEFAULTS, GAME_STATE_DEFAULTS } from '@/shared/constants/defaults';
```

## Zustand Store 사용 패턴

```typescript
// 스토어 정의
export const useMyStore = create<MyState>()(
  persist(
    (set, get) => ({
      data: null,
      setData: (data) => set({ data }),
      // 비동기 작업은 Repository에 위임
      loadData: async () => {
        const data = await myRepository.getAll();
        set({ data });
      },
    }),
    { name: 'my-store' }
  )
);
```

## 타임블로킹 시스템

**6개 시간 블록**: 5-8, 8-11, 11-14, 14-17, 17-20, 20-23

**저항도 레벨**:
- 🟢 Low (1.0x): 즐거운 작업
- 🟡 Medium (1.3x): 중립적 작업  
- 🔴 High (1.6x): 미루고 싶은 작업

**블록 상태**: `lock`, `perfect`, `failed`, `timer`

## Electron 보안 설정
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- Preload 스크립트를 통한 안전한 IPC 통신
