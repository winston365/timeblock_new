# 데이터 계층

TimeBlock Planner의 데이터 영속화 전략과 Repository 패턴입니다.

## 저장소 정책

::: danger 중요
**localStorage는 사용하지 않습니다!** (`theme` 키 제외)
:::

### 왜 Dexie인가?

| localStorage | Dexie (IndexedDB) |
|:---|:---|
| 5MB 제한 | 제한 없음 (기가바이트 단위) |
| 동기 API (UI 블로킹) | 비동기 API |
| 문자열만 저장 | 구조화된 데이터 + 인덱스 |
| 트랜잭션 없음 | 트랜잭션 지원 |

### 올바른 저장 방식

```typescript
// ❌ 잘못된 방식 - dev에서 경고 발생
localStorage.setItem('myKey', JSON.stringify(data));

// ✅ 올바른 방식 - systemState 테이블 사용
import { db } from '@/data/db/dexieClient';

// 저장
await db.systemState.put({ key: 'myKey', value: data });

// 로드
const record = await db.systemState.get('myKey');
const data = record?.value;
```

## Dexie 스키마

### 버전 관리

총 17번의 스키마 마이그레이션을 거쳤습니다. 스키마 변경 시:

1. 버전 번호 증가
2. 마이그레이션 함수 작성
3. 멱등성(idempotent) 보장

### 핵심 테이블

```typescript
// src/data/db/dexieClient.ts

db.version(17).stores({
  // 날짜별 작업 데이터 (PK: date YYYY-MM-DD)
  dailyData: 'date',
  
  // 게임 상태 (싱글톤, key: 'current')
  gameState: 'key',
  
  // 인박스 작업 (날짜 미지정)
  globalInbox: '++id, createdAt',
  
  // 완료된 인박스 (v7+)
  completedInbox: '++id, completedAt',
  
  // 작업 템플릿
  templates: '++id, name',
  
  // 동반자 상태
  waifuState: 'key',
  
  // AI 채팅 기록
  chatHistory: '++id, timestamp',
  
  // 시스템 상태 (KV 저장소, v6+)
  systemState: 'key',
  
  // 설정
  settings: 'key',
  
  // Google Tasks 매핑 (v17+)
  taskGoogleTaskMappings: 'taskId, googleTaskId',
  
  // 임시 스케줄 (v15+)
  tempScheduleTasks: '++id, startTime'
});
```

## Repository 패턴

### 기본 구조

```typescript
// src/data/repositories/baseRepository.ts

export abstract class BaseRepository<T> {
  abstract tableName: string;
  
  async getById(id: string): Promise<T | undefined> {
    return db.table(this.tableName).get(id);
  }
  
  async save(item: T): Promise<void> {
    await db.table(this.tableName).put(item);
    await this.syncToFirebase(item); // 비동기 동기화
  }
  
  protected abstract syncToFirebase(item: T): Promise<void>;
}
```

### 대형 레포지토리 모듈화

`dailyDataRepository`처럼 큰 레포지토리는 폴더로 분리합니다:

```
repositories/dailyData/
├── index.ts           # 공개 API
├── coreOperations.ts  # 기본 CRUD
├── taskOperations.ts  # 작업 관련 연산
├── blockOperations.ts # 타임블록 연산
├── queryHelpers.ts    # 쿼리 유틸리티
└── types.ts           # 타입 정의
```

### 사용 예시

```typescript
// Store에서 Repository 사용
export const dailyDataStore = create<DailyDataState>((set, get) => ({
  tasks: [],
  
  async updateTask(taskId: string, updates: Partial<Task>) {
    const current = get().tasks;
    const original = [...current];
    
    // 낙관적 업데이트
    const updated = current.map(t => 
      t.id === taskId ? { ...t, ...updates } : t
    );
    set({ tasks: updated });
    
    try {
      await dailyDataRepository.updateTask(taskId, updates);
    } catch (error) {
      // 롤백
      set({ tasks: original });
      throw error;
    }
  }
}));
```

## 데이터 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                    React Component                       │
│                                                          │
│  const { tasks, updateTask } = useDailyDataStore()      │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    Zustand Store                         │
│                                                          │
│  1. 낙관적 업데이트 (UI 즉시 반영)                        │
│  2. Repository 호출                                      │
│  3. 실패 시 롤백                                         │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────┐
│                    Repository                            │
│                                                          │
│  1. Dexie에 저장 (동기)                                  │
│  2. Firebase에 동기화 (비동기)                           │
└────────────┬────────────────────────────┬───────────────┘
             │                            │
             ↓                            ↓
┌────────────────────────┐  ┌────────────────────────────┐
│   Dexie (IndexedDB)    │  │   Firebase RTDB (Cloud)    │
│   [Primary Storage]    │  │   [Backup & Sync]          │
└────────────────────────┘  └────────────────────────────┘
```

## 다음 단계

- [Firebase 동기화](/architecture/firebase-sync) - 동기화 전략 상세
- [DB 스키마 레퍼런스](/reference/database-schema) - 전체 테이블 목록
