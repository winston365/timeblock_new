---
ID: 081
Origin: 081
UUID: e4f2a8b3
Status: Active
---

# 데이터 최적화 실행 로드맵

**As a** TimeBlock 개발자,
**I want** 데이터 최적화 계획을 독립 배포 가능한 PR 단위로 분해하여,
**So that** 서비스 중단 없이 점진적으로 성능을 개선할 수 있다.

---

## 현황 분석

### 영향 받는 파일 및 현재 패턴

| 컬렉션 | Repository/Store | 현재 패턴 | 문제점 |
|--------|------------------|----------|--------|
| weeklyGoals | `weeklyGoalRepository.ts` | 전체 컬렉션 sync | CRUD 후 `db.weeklyGoals.toArray()` → Firebase 업로드 |
| globalInbox | `inboxRepository.ts` | 전체 컬렉션 sync | 모든 CRUD에서 `syncGlobalInboxToFirebase()` 호출 |
| templates | `templateRepository.ts` | Firebase fetch만 | 로컬 저장만, Firebase sync 누락 |
| shopItems | `strategies.ts` | 전략 정의만 | Repository 없음, 직접 동기화 없음 |

### Memory Context
- 동기화 재시도 큐, 해시 캐시 스코핑, 충돌 해결 전략(LWW, mergeGameState, mergeTaskArray)이 이미 구현됨
- PR 5에서 오프라인 큐, 해시 캐시 중복 방지, 리스너 필터링 테스트 완료

---

## 실행 로드맵

### Phase 1: 기반 작업 (Week 1)

#### PR-081-A: ItemSyncStrategy 인터페이스 도입
**범위:**
- [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
- [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts)
- `tests/sync-item-strategy.test.ts` (신규)

**변경 내용:**
```typescript
// syncCore.ts - 신규 인터페이스 추가
export interface ItemSyncStrategy<T> extends SyncStrategy<T[]> {
  getItemPath: (itemId: string) => string;
  getItemKey: (item: T) => string;
}

// 신규 함수
export async function syncItemToFirebase<T>(
  strategy: ItemSyncStrategy<T>,
  item: T
): Promise<void>;

export async function deleteItemFromFirebase<T>(
  strategy: ItemSyncStrategy<T>,
  itemId: string
): Promise<void>;
```

**의존성:** 없음 (기존 코드 변경 없음, 확장만)
**테스트:**
- ItemSyncStrategy 인터페이스 타입 체크
- syncItemToFirebase 단일 아이템 업로드 검증
- deleteItemFromFirebase 아이템 삭제 검증
- 해시 캐시가 item-level로 스코핑되는지 확인
**예상 시간:** 3시간
**롤백:** 신규 코드 제거만으로 완전 롤백 가능

---

#### PR-081-B: Repository 직접 반환 패턴 인프라
**범위:**
- `src/data/repositories/_repositoryHelpers.ts` (신규)
- `tests/repository-helpers.test.ts` (신규)

**변경 내용:**
```typescript
// _repositoryHelpers.ts
/**
 * CRUD 작업 후 재조회 없이 객체 직접 반환을 위한 헬퍼
 */
export function withTimestamp<T extends { updatedAt?: string }>(
  data: T
): T {
  return { ...data, updatedAt: new Date().toISOString() };
}

export function normalizeOptionalFields<T>(
  data: T,
  defaults: Partial<T>
): T {
  return { ...defaults, ...data };
}
```

**의존성:** 없음
**테스트:**
- withTimestamp 반환 객체 타입 검증
- normalizeOptionalFields 누락 필드 기본값 적용 확인
**예상 시간:** 1.5시간
**롤백:** 신규 코드 제거만으로 완전 롤백 가능

---

### Phase 2: 핵심 최적화 (Week 2-3)

#### PR-081-C: WeeklyGoal Single Item Sync
**범위:**
- [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts#L217-L225)
- [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts)
- `tests/weekly-goal-item-sync.test.ts` (신규)

**변경 내용:**
```typescript
// strategies.ts - weeklyGoalItemStrategy 추가
export const weeklyGoalItemStrategy: ItemSyncStrategy<WeeklyGoal> = {
  collection: 'weeklyGoals',
  getItemPath: (itemId) => `weeklyGoals/items/${itemId}`,
  getItemKey: (item) => item.id,
  getSuccessMessage: (data) => `WeeklyGoal item synced: ${data.id}`,
};

// weeklyGoalRepository.ts - CRUD 함수 수정
export async function addWeeklyGoal(...): Promise<WeeklyGoal> {
  // 기존: await db.weeklyGoals.toArray() → syncToFirebase(allGoals)
  // 변경: syncItemToFirebase(weeklyGoalItemStrategy, newGoal)
  // + 직접 newGoal 반환 (재조회 제거)
}
```

**의존성:** PR-081-A
**테스트:**
- addWeeklyGoal → Firebase path가 `weeklyGoals/items/{id}`인지 확인
- updateWeeklyGoal → 해당 아이템만 업데이트
- deleteWeeklyGoal → 해당 아이템만 삭제
- 기존 테스트(`tests/sync-strategies-contract.test.ts`) 회귀 없음
**예상 시간:** 4시간
**위험:** Firebase 경로 변경으로 기존 데이터 접근 불가
**완화:** Feature flag로 점진적 전환, 마이그레이션 스크립트 준비

---

#### PR-081-D: GlobalInbox Single Item Sync
**범위:**
- [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts#L112-L120)
- [src/data/repositories/inboxRepository.ts](src/data/repositories/inboxRepository.ts)
- `tests/inbox-item-sync.test.ts` (신규)

**변경 내용:**
```typescript
// strategies.ts
export const globalInboxItemStrategy: ItemSyncStrategy<Task> = {
  collection: 'globalInbox',
  getItemPath: (itemId) => `globalInbox/items/${itemId}`,
  getItemKey: (item) => item.id,
  resolveConflict: mergeTaskLWW, // 단일 아이템용 충돌 해결
};

// inboxRepository.ts - syncGlobalInboxToFirebase() 제거 후 개별 sync
```

**의존성:** PR-081-A
**테스트:**
- addInboxTask → 단일 아이템만 Firebase 업로드
- toggleInboxTaskCompletion → 관련 아이템만 업데이트
- 기존 `tests/inbox-hotkeys.test.ts` 회귀 없음
**예상 시간:** 4시간
**위험:** 완료된 인박스(completedInbox)도 함께 변경 필요
**완화:** completedInbox는 date-keyed 유지, globalInbox만 item-sync 적용

---

#### PR-081-E: Template Firebase Sync 추가
**범위:**
- [src/data/repositories/templateRepository.ts](src/data/repositories/templateRepository.ts)
- [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts#L97-L103)
- `tests/template-sync.test.ts` (신규)

**변경 내용:**
```typescript
// templateRepository.ts - createTemplate, updateTemplate, deleteTemplate에 동기화 추가
export async function createTemplate(...): Promise<Template> {
  // ... 기존 로직
  
  // Firebase 동기화 추가
  withFirebaseSync(async () => {
    await syncItemToFirebase(templateItemStrategy, template);
  }, 'Template:create');
  
  return template;
}
```

**의존성:** PR-081-A
**테스트:**
- createTemplate → Firebase에 동기화 확인
- updateTemplate → 변경사항 Firebase 반영
- deleteTemplate → Firebase에서 삭제
- `tests/template-system.test.ts` 회귀 없음
**예상 시간:** 3시간
**위험:** 낮음 (현재 Firebase sync 없어서 신규 기능)

---

#### PR-081-F: Repository 쿼리 최적화 (재조회 제거)
**범위:**
- [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts)
- [src/data/repositories/inboxRepository.ts](src/data/repositories/inboxRepository.ts)
- [src/data/repositories/templateRepository.ts](src/data/repositories/templateRepository.ts)

**변경 내용:**
```typescript
// 기존 패턴
export async function updateWeeklyGoal(goalId: string, updates: Partial<WeeklyGoal>): Promise<WeeklyGoal> {
  const goal = await db.weeklyGoals.get(goalId); // 조회 1
  const updatedGoal = { ...goal, ...updates };
  await db.weeklyGoals.put(updatedGoal);
  // Firebase sync 후...
  // 기존에 다시 조회하는 코드 있었다면 제거
  return updatedGoal; // 생성/수정 객체 직접 반환
}

// 최적화 패턴
export async function updateWeeklyGoal(goalId: string, updates: Partial<WeeklyGoal>): Promise<WeeklyGoal> {
  const goal = await db.weeklyGoals.get(goalId);
  if (!goal) throw new Error(`Weekly goal not found: ${goalId}`);
  
  const updatedGoal = withTimestamp({ ...goal, ...updates });
  await db.weeklyGoals.put(updatedGoal);
  
  withFirebaseSync(() => 
    syncItemToFirebase(weeklyGoalItemStrategy, updatedGoal),
    'WeeklyGoal:update'
  );
  
  return updatedGoal; // 재조회 없이 직접 반환
}
```

**의존성:** PR-081-B, PR-081-C, PR-081-D, PR-081-E
**테스트:**
- 각 CRUD 함수 반환값이 즉시 사용 가능한지 확인
- 반환값의 updatedAt이 현재 시각인지 확인
**예상 시간:** 2시간
**위험:** 낮음 (이미 대부분 직접 반환 패턴 사용 중)

---

### Phase 3: 이벤트 최적화 (Week 3)

#### PR-081-G: Sync Debounce 적용
**범위:**
- [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
- `src/shared/utils/debounce.ts` (신규 또는 기존 활용)
- `tests/sync-debounce.test.ts` (신규)

**변경 내용:**
```typescript
// syncCore.ts
const pendingSyncs: Map<string, { data: any; timeout: NodeJS.Timeout }> = new Map();
const DEBOUNCE_MS = 300;

export async function syncToFirebaseDebounced<T>(
  strategy: SyncStrategy<T>,
  data: T,
  key?: string
): Promise<void> {
  const hashKey = `${strategy.collection}-${key || 'root'}`;
  
  // 기존 대기 중인 sync 취소
  const pending = pendingSyncs.get(hashKey);
  if (pending) {
    clearTimeout(pending.timeout);
  }
  
  // 300ms 후 실제 sync 실행
  const timeout = setTimeout(() => {
    pendingSyncs.delete(hashKey);
    syncToFirebase(strategy, data, key);
  }, DEBOUNCE_MS);
  
  pendingSyncs.set(hashKey, { data, timeout });
}
```

**의존성:** 없음
**테스트:**
- 300ms 이내 연속 호출 시 마지막 데이터만 sync
- 300ms 이후 호출은 새 sync로 처리
- flush 함수로 즉시 sync 가능
**예상 시간:** 2.5시간
**위험:** 낮음 (기존 sync 함수는 유지, 새 함수 추가)

---

#### PR-081-H: EventBus task:completed 최적화
**범위:**
- [src/shared/lib/eventBus/types.ts](src/shared/lib/eventBus/types.ts)
- [src/shared/subscribers/xpSubscriber.ts](src/shared/subscribers/xpSubscriber.ts)
- [src/shared/subscribers/waifuSubscriber.ts](src/shared/subscribers/waifuSubscriber.ts)
- [src/shared/subscribers/gameStateSubscriber.ts](src/shared/subscribers/gameStateSubscriber.ts)
- `tests/task-completed-chain.test.ts` (신규)

**변경 내용:**
```typescript
// types.ts - BatchTaskCompletedEvent 추가
export interface BatchTaskCompletedEvent {
  tasks: Array<{
    taskId: string;
    xpEarned: number;
    isPerfectBlock: boolean;
    blockId?: string | null;
  }>;
  totalXpEarned: number;
}

// EventTypeMap에 추가
'task:batchCompleted': BatchTaskCompletedEvent;

// subscribers - 배치 이벤트 처리 추가
eventBus.on('task:batchCompleted', async ({ tasks, totalXpEarned }) => {
  // 여러 완료를 한 번에 처리
});
```

**의존성:** 없음
**테스트:**
- 단일 task:completed는 기존대로 동작
- 다중 완료 시 task:batchCompleted 발행 검증
- 각 subscriber가 배치 이벤트 처리하는지 확인
**예상 시간:** 3시간
**위험:** 중간 (기존 이벤트 흐름 변경)
**완화:** 기존 task:completed도 유지, 배치는 옵트인 방식

---

### Phase 4: 안정화 (Week 4)

#### PR-081-I: Firebase 마이그레이션 스크립트
**범위:**
- `scripts/migrate-firebase-paths.ts` (신규)
- `docs/migration-guide.md` (신규)

**변경 내용:**
```typescript
/**
 * Firebase 경로 마이그레이션 스크립트
 * 
 * 기존: users/{userId}/weeklyGoals = { data: [...], updatedAt, deviceId }
 * 신규: users/{userId}/weeklyGoals/items/{id} = { data: {...}, updatedAt, deviceId }
 * 
 * 실행: npm run migrate:firebase-paths
 */
async function migrateWeeklyGoals(userId: string) {
  const oldPath = `users/${userId}/weeklyGoals`;
  const newBasePath = `users/${userId}/weeklyGoals/items`;
  // ...마이그레이션 로직
}
```

**의존성:** PR-081-C, PR-081-D
**테스트:**
- 마이그레이션 전후 데이터 무결성 검증
- 롤백 스크립트 동작 확인
**예상 시간:** 3시간

---

#### PR-081-J: Feature Flags 및 점진적 롤아웃
**범위:**
- `src/shared/constants/featureFlags.ts` (신규)
- 영향받는 모든 Repository

**변경 내용:**
```typescript
// featureFlags.ts
export const FEATURE_FLAGS = {
  ITEM_SYNC_WEEKLY_GOALS: false, // PR-081-C 적용 후 true로 전환
  ITEM_SYNC_GLOBAL_INBOX: false, // PR-081-D 적용 후 true로 전환
  SYNC_DEBOUNCE: false,          // PR-081-G 적용 후 true로 전환
  BATCH_TASK_COMPLETED: false,   // PR-081-H 적용 후 true로 전환
};

// Repository에서 사용
if (FEATURE_FLAGS.ITEM_SYNC_WEEKLY_GOALS) {
  await syncItemToFirebase(weeklyGoalItemStrategy, newGoal);
} else {
  const allGoals = await db.weeklyGoals.toArray();
  await syncToFirebase(weeklyGoalStrategy, allGoals);
}
```

**의존성:** 모든 PR
**테스트:**
- Feature flag on/off 시 동작 검증
- 런타임 토글 가능 여부 확인
**예상 시간:** 2시간

---

## 의존성 다이어그램

```
PR-081-A (ItemSyncStrategy 인터페이스)
    │
    ├──────────────────────┬────────────────────────────┐
    │                      │                            │
    v                      v                            v
PR-081-C (WeeklyGoal)  PR-081-D (GlobalInbox)     PR-081-E (Template)
    │                      │                            │
    └──────────────────────┴────────────────────────────┘
                           │
                           v
PR-081-B (Repository Helpers) ───> PR-081-F (쿼리 최적화)
                                           │
                                           v
PR-081-G (Debounce) ──────────────> PR-081-I (마이그레이션)
                                           │
PR-081-H (EventBus) ──────────────>        │
                                           v
                                  PR-081-J (Feature Flags)
```

**병렬 작업 가능:**
- PR-081-A, PR-081-B (기반 작업)
- PR-081-C, PR-081-D, PR-081-E (PR-081-A 완료 후)
- PR-081-G, PR-081-H (독립적)

---

## 위험 관리

| PR | 리스크 | 심각도 | 완화 방안 | 롤백 계획 |
|----|--------|--------|-----------|-----------|
| PR-081-A | 없음 (확장만) | 낮음 | N/A | 코드 제거 |
| PR-081-B | 없음 (신규) | 낮음 | N/A | 코드 제거 |
| PR-081-C | Firebase 경로 변경으로 기존 데이터 접근 불가 | 높음 | Feature flag + 마이그레이션 스크립트 | Flag off로 즉시 롤백 |
| PR-081-D | completedInbox와 불일치 | 중간 | globalInbox만 적용, completedInbox는 date-keyed 유지 | Flag off로 롤백 |
| PR-081-E | 기존 sync 없어서 데이터 불일치 | 낮음 | 점진적 적용 | Firebase 데이터 삭제 |
| PR-081-F | 반환값 타입 불일치 | 낮음 | 기존 테스트 회귀 확인 | Git revert |
| PR-081-G | Debounce로 데이터 유실 | 중간 | flush 함수 제공, 앱 종료 시 강제 sync | Flag off로 롤백 |
| PR-081-H | 이벤트 체인 깨짐 | 중간 | 기존 이벤트 유지, 배치는 추가 | 배치 이벤트만 제거 |
| PR-081-I | 마이그레이션 실패 | 높음 | 백업 후 실행, 롤백 스크립트 준비 | 롤백 스크립트 실행 |
| PR-081-J | Flag 관리 복잡성 | 낮음 | 중앙 집중 관리 | 개별 flag off |

---

## 성공 지표

| 항목 | 현재 | 목표 | 측정 방법 |
|------|------|------|-----------|
| WeeklyGoal 동기화 페이로드 | 전체 배열 (~5KB) | 단일 아이템 (~0.5KB) | Firebase Console → Network 탭 |
| GlobalInbox 동기화 빈도 | CRUD마다 전체 sync | 변경된 아이템만 sync | syncLogger 카운트 |
| Firebase 쓰기 호출 수/분 | 측정 필요 | -50% 감소 | rtdbMetrics 집계 |
| task:completed 이벤트 처리 시간 | 측정 필요 | -30% 감소 | Performance.now() 측정 |
| 테스트 커버리지 | 현재 수준 유지 | 영향 코드 80% 이상 | vitest --coverage |

### 측정 구현 (PR-081-J에 포함)

```typescript
// rtdbMetrics.ts에 추가
export function getSyncStats(): {
  totalSyncs: number;
  payloadSizeAvg: number;
  syncDurationAvg: number;
} {
  // 집계 로직
}
```

---

## 일정 요약

| 주차 | PR | 예상 시간 | 누적 |
|------|-------|----------|------|
| Week 1 | PR-081-A, PR-081-B | 4.5시간 | 4.5시간 |
| Week 2 | PR-081-C, PR-081-D | 8시간 | 12.5시간 |
| Week 3 | PR-081-E, PR-081-F, PR-081-G, PR-081-H | 10.5시간 | 23시간 |
| Week 4 | PR-081-I, PR-081-J | 5시간 | 28시간 |

**총 예상 시간:** 28시간 (버퍼 포함 35시간 권장)

---

## 체크리스트

각 PR 머지 전 확인:

- [ ] 기존 테스트 모두 통과 (`npm test`)
- [ ] 신규 테스트 추가 및 통과
- [ ] Feature flag 적용 (해당 시)
- [ ] 문서 업데이트 (CHANGELOG, README 해당 시)
- [ ] 롤백 절차 문서화
- [ ] 코드 리뷰 완료

---

## Changelog

| 날짜 | 작성자 | 변경 내용 |
|------|--------|-----------|
| 2026-01-09 | Planner | 초안 작성 |

---

## Open Questions

1. **shopItems Repository**: 현재 Repository가 없는데, 신규 생성 vs 기존 firebaseService 활용?
   - **권장**: PR-081-E 이후 별도 PR로 shopItemsRepository 생성

2. **마이그레이션 타이밍**: Firebase 경로 변경을 앱 업데이트와 어떻게 동기화할 것인가?
   - **권장**: Feature flag로 신/구 경로 모두 지원 → 2주 후 구 경로 제거

3. **Debounce와 오프라인 큐 상호작용**: Debounce 중 오프라인 전환 시 어떻게 처리?
   - **권장**: Debounce timeout 즉시 취소, 현재 데이터로 retry queue에 추가
