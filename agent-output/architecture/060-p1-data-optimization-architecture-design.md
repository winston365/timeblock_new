# P1 핵심 데이터 최적화 아키텍처 설계

> Date: 2026-01-09  
> Status: Draft  
> Scope: Collection Sync 최적화, Repository 쿼리 효율화

---

## 1. Collection Sync → Single Item Sync

### As-Is (현재 패턴)

```
┌──────────────────────────────────────────────────────────────────┐
│ weeklyGoalRepository.addWeeklyGoal()                             │
│   └→ db.weeklyGoals.put(newGoal)                                 │
│   └→ withFirebaseSync(async () => {                              │
│         const allGoals = await db.weeklyGoals.toArray(); ← ❌ 전체 재조회
│         await syncToFirebase(weeklyGoalStrategy, allGoals); ← ❌ 전체 업로드
│      })                                                          │
└──────────────────────────────────────────────────────────────────┘
```

**문제점:**
- `templates`, `shopItems`, `globalInbox`, `weeklyGoals` 등 **배열 기반 컬렉션**은 단일 아이템 변경에도 전체 배열을 업로드
- `SyncStrategy<T[]>` 타입으로 정의되어 개별 아이템 동기화 불가
- N개 아이템 컬렉션에서 CRUD 1회 → N개 항목 × sync 횟수만큼 Firebase 쓰기 발생
- 연속 편집 시 debounce 없이 각각 full upload 발생

**영향받는 Strategy 목록:**
| Strategy | Collection | 예상 크기 |
|----------|------------|----------|
| `templateStrategy` | templates | ~20-50 |
| `shopItemsStrategy` | shopItems | ~10-30 |
| `globalInboxStrategy` | globalInbox | ~50-200 |
| `weeklyGoalStrategy` | weeklyGoals | ~5-10 |
| `battleMissionsStrategy` | battleMissions | ~10-20 |
| `warmupPresetStrategy` | warmupPreset | ~5-15 |

### To-Be (목표 패턴)

```
┌──────────────────────────────────────────────────────────────────┐
│ weeklyGoalRepository.addWeeklyGoal()                             │
│   └→ db.weeklyGoals.put(newGoal)                                 │
│   └→ withFirebaseSync(async () => {                              │
│         await syncSingleItem(weeklyGoalItemStrategy, newGoal);   │
│      })   ↑ 단일 항목만 업로드                                      │
└──────────────────────────────────────────────────────────────────┘
```

**핵심 변경:**
- **개별 아이템 경로**: `/{collection}/{itemId}` 형태로 Firebase path 세분화
- **단일 항목 동기화**: `SyncStrategy<T>` (개별 아이템) + item ID 기반 동기화
- **삭제 동기화**: `removeFromFirebase(strategy, itemId)` 추가 (set(null) 패턴)

### 솔루션

#### 1) 새로운 인터페이스 정의

```typescript
// src/shared/services/sync/firebase/syncCore.ts

/**
 * 개별 아이템 동기화용 Strategy (기존 컬렉션 전체 동기화와 분리)
 */
export interface ItemSyncStrategy<T> {
  /** 컬렉션 이름 (예: 'weeklyGoals') */
  collection: string;
  /** 아이템 ID 추출 함수 */
  getItemId: (item: T) => string;
  /** 성공 메시지 생성 */
  getSuccessMessage?: (item: T, action: 'add' | 'update' | 'delete') => string;
  /** userId 가져오기 */
  getUserId?: () => string;
  /** 직렬화 (optional) */
  serialize?: (item: T) => unknown;
}

/**
 * 개별 아이템을 Firebase에 동기화 (add/update)
 */
export async function syncItemToFirebase<T>(
  strategy: ItemSyncStrategy<T>,
  item: T
): Promise<void>;

/**
 * 개별 아이템을 Firebase에서 삭제
 */
export async function removeItemFromFirebase<T>(
  strategy: ItemSyncStrategy<T>,
  itemId: string
): Promise<void>;
```

#### 2) Strategy 정의 예시

```typescript
// src/shared/services/sync/firebase/strategies.ts

// 기존: 전체 컬렉션용 (마이그레이션/초기 로드용으로 유지)
export const weeklyGoalStrategy: SyncStrategy<WeeklyGoal[]> = {
  collection: 'weeklyGoals',
  getSuccessMessage: (data) => `WeeklyGoals synced (${data.length} goals)`,
};

// 신규: 개별 아이템용
export const weeklyGoalItemStrategy: ItemSyncStrategy<WeeklyGoal> = {
  collection: 'weeklyGoals',
  getItemId: (goal) => goal.id,
  getSuccessMessage: (goal, action) => 
    `WeeklyGoal ${action}: ${goal.title}`,
};
```

#### 3) syncCore 구현 추가

```typescript
// src/shared/services/sync/firebase/syncCore.ts

export async function syncItemToFirebase<T>(
  strategy: ItemSyncStrategy<T>,
  item: T
): Promise<void> {
  if (!isFirebaseInitialized()) return;

  const db = getFirebaseDatabase();
  const userId = strategy.getUserId?.() || 'user';
  const itemId = strategy.getItemId(item);
  const deviceId = getDeviceId();

  // 개별 아이템 경로: /users/{userId}/{collection}/{itemId}
  const path = getFirebasePath(userId, strategy.collection, itemId);
  const dataRef = ref(db, path);

  let dataToSync = item as unknown;
  if (strategy.serialize) {
    dataToSync = strategy.serialize(item);
  }

  const sanitizedData = sanitizeForFirebase(dataToSync);
  const dataHash = getDataHash(sanitizedData);
  const hashKey = `${strategy.collection}-${itemId}`;

  // 중복 동기화 방지
  if (lastSyncHash[hashKey] === dataHash) return;

  const syncData: SyncData<unknown> = {
    data: sanitizedData,
    updatedAt: getServerTimestamp(),
    deviceId,
  };

  await set(dataRef, syncData);
  lastSyncHash[hashKey] = dataHash;

  const message = strategy.getSuccessMessage?.(item, 'update') || 
    `${strategy.collection}/${itemId} synced`;
  addSyncLog('firebase', 'sync', message);
}

export async function removeItemFromFirebase<T>(
  strategy: ItemSyncStrategy<T>,
  itemId: string
): Promise<void> {
  if (!isFirebaseInitialized()) return;

  const db = getFirebaseDatabase();
  const userId = strategy.getUserId?.() || 'user';

  const path = getFirebasePath(userId, strategy.collection, itemId);
  const dataRef = ref(db, path);

  await set(dataRef, null); // Firebase 삭제 패턴

  // 해시 캐시 제거
  delete lastSyncHash[`${strategy.collection}-${itemId}`];

  addSyncLog('firebase', 'sync', `${strategy.collection}/${itemId} removed`);
}
```

#### 4) Repository 수정 예시 (weeklyGoalRepository)

```typescript
// BEFORE
export async function addWeeklyGoal(...): Promise<WeeklyGoal> {
  await db.weeklyGoals.put(newGoal);
  withFirebaseSync(async () => {
    const allGoals = await db.weeklyGoals.toArray(); // ❌ 전체 조회
    await syncToFirebase(weeklyGoalStrategy, allGoals); // ❌ 전체 업로드
  }, 'WeeklyGoal:add');
  return newGoal;
}

// AFTER
export async function addWeeklyGoal(...): Promise<WeeklyGoal> {
  await db.weeklyGoals.put(newGoal);
  withFirebaseSync(
    () => syncItemToFirebase(weeklyGoalItemStrategy, newGoal), // ✅ 단일 항목
    'WeeklyGoal:add'
  );
  return newGoal;
}

export async function deleteWeeklyGoal(goalId: string): Promise<void> {
  await db.weeklyGoals.delete(goalId);
  withFirebaseSync(
    () => removeItemFromFirebase(weeklyGoalItemStrategy, goalId), // ✅ 단일 삭제
    'WeeklyGoal:delete'
  );
}
```

### Firebase 경로 구조 마이그레이션

```
// AS-IS (전체 배열)
/users/{uid}/weeklyGoals → [goal1, goal2, goal3]

// TO-BE (개별 아이템)
/users/{uid}/weeklyGoals/wgoal-xxx → { data: goal1, ... }
/users/{uid}/weeklyGoals/wgoal-yyy → { data: goal2, ... }
```

**마이그레이션 전략:**
1. 신규 경로로 쓰기 시작 (dual-write 기간)
2. 읽기 시 신규 경로 우선, fallback으로 레거시 배열 지원
3. 안정화 후 레거시 경로 삭제

### 리스크/완화

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|----------|
| Firebase 경로 변경으로 기존 데이터 호환성 문제 | High | Dual-read 패턴: 신규 경로 없으면 레거시 배열에서 추출 |
| 리스너 변경 필요 | Medium | `listenToFirebase` 확장하여 컬렉션 하위 감시 지원 |
| Reorder 시 다수 아이템 업데이트 | Medium | `syncBatchItems()` 추가하여 bulk 처리 (선택적) |
| 충돌 해결 정책 변경 | Low | 개별 아이템 LWW는 기존과 동일하게 동작 |

---

## 2. Repository 쿼리 최적화

### As-Is (현재 패턴)

```typescript
// weeklyGoalRepository.ts - 모든 CRUD에서 반복
export async function updateWeeklyGoal(goalId, updates): Promise<WeeklyGoal> {
  const goal = await db.weeklyGoals.get(goalId);        // 1️⃣ 조회
  const updatedGoal = { ...goal, ...updates };
  await db.weeklyGoals.put(updatedGoal);                // 2️⃣ 저장
  
  withFirebaseSync(async () => {
    const allGoals = await db.weeklyGoals.toArray();    // 3️⃣ 전체 재조회 (불필요)
    await syncToFirebase(weeklyGoalStrategy, allGoals);
  }, 'WeeklyGoal:update');
  
  return updatedGoal;                                   // 4️⃣ 이미 가진 값 반환
}
```

**문제점:**
- CRUD 후 `db.weeklyGoals.toArray()` 재조회 → 불필요한 IndexedDB I/O
- 동일 함수 내에서 이미 조회/생성한 객체를 재조회
- Firebase sync를 위해 전체 컬렉션을 매번 메모리로 로드

### To-Be (목표 패턴)

```typescript
export async function updateWeeklyGoal(goalId, updates): Promise<WeeklyGoal> {
  const goal = await db.weeklyGoals.get(goalId);
  const updatedGoal = { ...goal, ...updates, updatedAt: new Date().toISOString() };
  await db.weeklyGoals.put(updatedGoal);
  
  // ✅ 이미 가진 객체만 전달 (재조회 없음)
  withFirebaseSync(
    () => syncItemToFirebase(weeklyGoalItemStrategy, updatedGoal),
    'WeeklyGoal:update'
  );
  
  return updatedGoal;
}
```

### 솔루션

#### 1) 함수 내 객체 재사용 원칙

```typescript
// ❌ BEFORE: 저장 후 다시 조회
await db.weeklyGoals.put(newGoal);
const allGoals = await db.weeklyGoals.toArray();
await syncToFirebase(strategy, allGoals);

// ✅ AFTER: 이미 가진 객체 직접 사용
await db.weeklyGoals.put(newGoal);
await syncItemToFirebase(itemStrategy, newGoal);
```

#### 2) Batch 연산 최적화

```typescript
// reorderWeeklyGoals - 현재: bulkPut 후 toArray
export async function reorderWeeklyGoals(goals: WeeklyGoal[]): Promise<void> {
  const updatedGoals = goals.map((goal, index) => ({
    ...goal,
    order: index,
    updatedAt: new Date().toISOString(),
  }));
  
  await db.weeklyGoals.bulkPut(updatedGoals);
  
  // ✅ 이미 가진 배열 사용 (toArray 불필요)
  withFirebaseSync(
    () => syncBatchItems(weeklyGoalItemStrategy, updatedGoals),
    'WeeklyGoal:reorder'
  );
}
```

#### 3) Load-once 패턴 적용

```typescript
// loadWeeklyGoals() 반환값을 캐시하여 후속 연산에 재사용
// (Store 레벨에서 관리)

// Store 예시
const useWeeklyGoalStore = create((set, get) => ({
  goals: [] as WeeklyGoal[],
  
  async load() {
    const goals = await loadWeeklyGoals();
    set({ goals });
    return goals;
  },
  
  async add(data) {
    const currentGoals = get().goals;
    const newGoal = await addWeeklyGoal(data);
    // ✅ 서버 왕복 없이 로컬 상태 직접 업데이트
    set({ goals: [...currentGoals, newGoal] });
    return newGoal;
  },
}));
```

### 리스크/완화

| 리스크 | 심각도 | 완화 방안 |
|--------|--------|----------|
| 메모리 불일치 가능성 | Low | Store가 단일 진실 소스; conflict 시 revalidate |
| Optimistic update 롤백 복잡도 | Medium | 실패 시 `loadWeeklyGoals()` 강제 호출 |
| 동시 편집 충돌 | Low | Single-writer 가정 유지; LWW 정책 적용 |

---

## 3. 추가 권장사항

### 3.1 Debounce 전략

**현재 상태:** 연속 편집 시 각각 독립적으로 Firebase sync 발생

**권장안:**

```typescript
// src/shared/utils/syncDebounce.ts

const syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const DEBOUNCE_MS = 300;

export function debouncedSync(
  key: string,
  syncFn: () => Promise<void>
): void {
  if (syncTimers[key]) {
    clearTimeout(syncTimers[key]);
  }
  
  syncTimers[key] = setTimeout(async () => {
    delete syncTimers[key];
    await syncFn();
  }, DEBOUNCE_MS);
}

// 사용 예시
withFirebaseSync(() => {
  debouncedSync(`weeklyGoal:${goalId}`, () => 
    syncItemToFirebase(weeklyGoalItemStrategy, updatedGoal)
  );
}, 'WeeklyGoal:update');
```

**적용 대상:**
- `updateWeeklyGoal` (진행도 연속 증가)
- `updateInboxTask` (빠른 텍스트 편집)
- `updateTemplate` (설정 변경)

### 3.2 EventBus 최적화

**현재 상태:** `task:completed` 등 이벤트 발생 시 연쇄 sync 가능

**권장안:**
- EventBus에서 Firebase sync를 직접 트리거하지 않음 (ADR-005 준수)
- sync는 Repository에서만, 이벤트는 UI 갱신/부수효과에만 사용

```typescript
// ✅ Good: Subscriber는 Store/UI만 갱신
eventBus.on('task:completed', (task) => {
  useGoalStore.getState().recalculateProgress(task);
  // sync는 recalculateProgress 내부 Repository 호출에서 처리
});

// ❌ Bad: Subscriber에서 직접 sync
eventBus.on('task:completed', async (task) => {
  await syncToFirebase(someStrategy, data); // 경계 위반
});
```

### 3.3 캐싱 레이어 도입 여부

**현재 구조:**
```
UI → Store (메모리) → Repository → Dexie (IndexedDB) → Firebase
```

**권장: 추가 캐시 레이어 불필요**

이유:
1. Dexie가 이미 IndexedDB 레벨 캐싱 제공
2. Store가 in-memory 캐시 역할 수행
3. 추가 레이어는 불일치 위험 및 복잡도만 증가

**대신 권장:**
- Store의 `revalidate` 패턴 명확화
- Repository 함수 내 불필요한 재조회 제거 (이 문서의 주요 내용)

### 3.4 구현 우선순위

| 순위 | 항목 | 예상 효과 | 구현 복잡도 |
|-----|------|----------|------------|
| 1 | Single Item Sync (weeklyGoal) | Firebase 쓰기 ~90% 감소 | Medium |
| 2 | Repository 재조회 제거 | IndexedDB I/O ~50% 감소 | Low |
| 3 | Single Item Sync (globalInbox) | 대용량 컬렉션 최적화 | Medium |
| 4 | Debounce 적용 | 연속 편집 최적화 | Low |
| 5 | 나머지 컬렉션 Single Item 전환 | 전체 정합성 | Medium |

---

## 4. 테스트 요구사항

### 단위 테스트

```typescript
describe('syncItemToFirebase', () => {
  it('should sync single item to correct path', async () => {
    const goal = { id: 'wgoal-123', title: 'Test' };
    await syncItemToFirebase(weeklyGoalItemStrategy, goal);
    // verify: /users/user/weeklyGoals/wgoal-123 에 저장됨
  });
  
  it('should skip duplicate sync with same hash', async () => {
    const goal = { id: 'wgoal-123', title: 'Test' };
    await syncItemToFirebase(weeklyGoalItemStrategy, goal);
    await syncItemToFirebase(weeklyGoalItemStrategy, goal);
    // verify: set() 1회만 호출
  });
});

describe('removeItemFromFirebase', () => {
  it('should set null to remove item', async () => {
    await removeItemFromFirebase(weeklyGoalItemStrategy, 'wgoal-123');
    // verify: set(ref, null) 호출
  });
});
```

### 통합 테스트

```typescript
describe('weeklyGoalRepository with single item sync', () => {
  it('should not query toArray after add', async () => {
    const spy = vi.spyOn(db.weeklyGoals, 'toArray');
    await addWeeklyGoal({ title: 'New Goal', ... });
    expect(spy).not.toHaveBeenCalled();
  });
});
```

---

## 5. 마이그레이션 계획

### Phase 1: 인프라 준비 (1-2일)
- [ ] `ItemSyncStrategy` 인터페이스 정의
- [ ] `syncItemToFirebase`, `removeItemFromFirebase` 구현
- [ ] 단위 테스트 작성

### Phase 2: weeklyGoal 파일럿 (1일)
- [ ] `weeklyGoalItemStrategy` 정의
- [ ] Repository CRUD 함수 수정
- [ ] Firebase 경로 마이그레이션 (dual-read)

### Phase 3: 확산 (2-3일)
- [ ] `globalInboxItemStrategy`, `templateItemStrategy` 등 추가
- [ ] 해당 Repository 수정
- [ ] Debounce 적용 (선택)

### Phase 4: 정리 (1일)
- [ ] 레거시 전체 배열 경로 제거
- [ ] 문서 업데이트

---

## 6. 결정 기록 (ADR)

### ADR-010: Collection Sync는 Item-level로 세분화한다

**Context:**
배열 기반 컬렉션(templates, shopItems, globalInbox, weeklyGoals)의 단일 아이템 변경이 전체 배열 업로드를 유발하여 Firebase 쓰기 비용이 O(N)으로 증가함.

**Decision:**
- `ItemSyncStrategy<T>` 인터페이스를 도입하여 개별 아이템 단위 sync 지원
- Firebase 경로를 `/{collection}/{itemId}` 형태로 세분화
- 기존 `SyncStrategy<T[]>`는 초기 로드/마이그레이션용으로 유지

**Consequences:**
- Firebase 쓰기 비용 O(N) → O(1)로 감소
- 경로 구조 변경으로 마이그레이션 필요
- 리스너 구조 변경 필요 (하위 컬렉션 감시)

### ADR-011: Repository는 함수 내 객체를 재사용한다

**Context:**
CRUD 연산 후 sync를 위해 `toArray()`로 전체 재조회하는 패턴이 불필요한 IndexedDB I/O를 유발함.

**Decision:**
- 함수 내에서 생성/수정한 객체를 직접 sync에 전달
- Store가 메모리 캐시 역할을 담당하고, 필요 시 `load()` 강제 호출로 revalidate

**Consequences:**
- IndexedDB I/O 감소
- 메모리 불일치 가능성은 Store의 revalidate 패턴으로 완화
