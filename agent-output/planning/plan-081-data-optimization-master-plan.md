---
ID: 081
Origin: 081
UUID: c9d3f7a2
Status: Active
---

# Plan 081: DB 전체 개선 작업 - 3등분 실행 계획

> **As a** TimeBlock 사용자,  
> **I want** Firebase 동기화가 효율적으로 작동하여,  
> **So that** 네트워크 비용이 90% 절감되고 앱이 더 빠르게 반응합니다.

---

## 📋 요약

| Phase | 이름 | 예상 시간 | 목표 |
|-------|------|-----------|------|
| **A** | 기반 인프라 | ~6.5h | 새 인터페이스/타입 정의, 기존 동작 불변 |
| **B** | 핵심 구현 | ~17.5h | Single Item Sync, Repository 최적화, Firebase 마이그레이션 |
| **C** | 통합 및 마무리 | ~10h | EventBus 배치, Debounce, Feature Flag, 롤아웃 |

### 핵심 성과 목표

| 지표 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| WeeklyGoal 동기화 페이로드 | ~5KB/회 | ~0.5KB/회 | **-90%** |
| Firebase 쓰기 호출 수 | 기준 | - | **-50%** |
| task:completed 처리 시간 | 기준 | - | **-30%** |

---

## Phase A: 기반 작업 (1/3)

> **목표**: 새로운 동기화 패턴의 인프라를 구축하되, **기존 동작에 영향 없이** 병렬 작업 가능한 기반 마련

### A-1: ItemSyncStrategy 인터페이스 정의

- **파일**: 
  - [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
- **내용**:
  ```typescript
  /**
   * 단일 항목 동기화 전략 (기존 SyncStrategy<T>와 공존)
   * 
   * 기존: syncToFirebase(strategy, data[])  → 전체 배열 업로드
   * 신규: syncItemToFirebase(itemStrategy, item, itemId) → 단일 항목만 업로드
   */
  export interface ItemSyncStrategy<T> extends SyncStrategy<T[]> {
    /** 개별 항목의 ID를 추출하는 함수 */
    getItemId: (item: T) => string;
    
    /** 개별 항목 동기화 시 로그 메시지 생성 */
    getItemSuccessMessage?: (item: T, itemId: string) => string;
  }
  ```
- **검증**:
  - [ ] TypeScript 컴파일 성공
  - [ ] 기존 `SyncStrategy<T>` 사용 코드 동작 불변
  - [ ] 새 인터페이스가 기존 타입과 호환
- **예상 시간**: 1h

---

### A-2: syncItemToFirebase() 함수 구현

- **파일**: 
  - [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
- **내용**:
  ```typescript
  /**
   * 단일 항목 Firebase 동기화
   * 
   * @template T 데이터 타입
   * @param strategy - ItemSyncStrategy (collection + getItemId 포함)
   * @param item - 동기화할 단일 항목
   * @param itemId - 항목의 고유 ID (선택적, 없으면 getItemId로 추출)
   */
  export async function syncItemToFirebase<T>(
    strategy: ItemSyncStrategy<T>,
    item: T,
    itemId?: string
  ): Promise<void>;
  ```
  - 해시 캐시 키: `${collection}-${itemId}` (기존 `${collection}-root`와 구분)
  - Firebase 경로: `users/{uid}/{collection}/{itemId}`
  - 기존 충돌 해결 로직 재사용 (LWW 또는 커스텀)
- **검증**:
  - [ ] 단위 테스트: 단일 항목 동기화 성공
  - [ ] 단위 테스트: 중복 호출 시 해시 캐시로 스킵
  - [ ] 단위 테스트: 오프라인 시 retryQueue에 추가
- **예상 시간**: 2h

---

### A-3: Item Strategy 정의 (기존 Strategy 확장)

- **파일**: 
  - [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts)
- **내용**:
  ```typescript
  // 기존 weeklyGoalStrategy는 그대로 유지
  export const weeklyGoalStrategy: SyncStrategy<WeeklyGoal[]> = { ... };
  
  // 신규: 단일 항목용 Strategy 추가
  export const weeklyGoalItemStrategy: ItemSyncStrategy<WeeklyGoal> = {
    ...weeklyGoalStrategy,
    getItemId: (goal) => goal.id,
    getItemSuccessMessage: (goal, id) => 
      `WeeklyGoal synced: ${id} (${goal.title}, ${goal.currentProgress}/${goal.target})`,
  };
  
  export const globalInboxItemStrategy: ItemSyncStrategy<Task> = {
    ...globalInboxStrategy,
    getItemId: (task) => task.id,
    getItemSuccessMessage: (task, id) => 
      `Inbox task synced: ${id} (${task.text})`,
  };
  
  export const templateItemStrategy: ItemSyncStrategy<Template> = {
    ...templateStrategy,
    getItemId: (template) => template.id,
    getItemSuccessMessage: (template, id) => 
      `Template synced: ${id} (${template.name})`,
  };
  ```
- **검증**:
  - [ ] 기존 Strategy 사용 코드 동작 불변
  - [ ] 새 ItemStrategy가 syncItemToFirebase()와 호환
- **예상 시간**: 1h

---

### A-4: withFirebaseSyncDebounced() 래퍼 함수 추가

- **파일**: 
  - [src/shared/utils/firebaseGuard.ts](src/shared/utils/firebaseGuard.ts)
- **내용**:
  ```typescript
  import { debounce } from 'lodash-es'; // 또는 직접 구현
  
  const debouncedSyncMap = new Map<string, ReturnType<typeof debounce>>();
  
  /**
   * Debounced Firebase 동기화
   * 
   * @param syncFn - 실행할 동기화 함수
   * @param label - 디바운스 키 (같은 키는 같은 debounce 인스턴스 공유)
   * @param delayMs - 디바운스 지연 시간 (기본: 300ms)
   */
  export function withFirebaseSyncDebounced(
    syncFn: () => Promise<void>,
    label: string,
    delayMs: number = 300
  ): void;
  
  /**
   * 앱 종료 전 모든 대기 중인 동기화 즉시 실행
   */
  export function flushAllDebouncedSync(): void;
  ```
- **검증**:
  - [ ] 단위 테스트: 연속 호출 시 마지막만 실행
  - [ ] 단위 테스트: flushAllDebouncedSync() 호출 시 즉시 실행
- **예상 시간**: 1h

---

### A-5: EventBus 배치 이벤트 타입 추가

- **파일**: 
  - [src/shared/lib/eventBus/types.ts](src/shared/lib/eventBus/types.ts)
- **내용**:
  ```typescript
  /** 다중 작업 완료 배치 이벤트 */
  export interface TaskCompletedBatchEvent {
    tasks: Array<{
      taskId: string;
      xpEarned: number;
      isPerfectBlock: boolean;
      blockId?: string | null;
      goalId?: string | null;
      adjustedDuration: number;
    }>;
    totalXpEarned: number;
  }
  
  // EventTypeMap에 추가
  export interface EventTypeMap {
    // ... 기존 이벤트들
    'task:completedBatch': TaskCompletedBatchEvent;
  }
  ```
- **검증**:
  - [ ] TypeScript 컴파일 성공
  - [ ] 기존 'task:completed' 이벤트 타입 불변
- **예상 시간**: 0.5h

---

### A-6: Phase A 테스트 스위트 작성

- **파일**: 
  - [tests/sync-item-strategy.test.ts](tests/sync-item-strategy.test.ts) (신규)
  - [tests/firebase-guard-debounce.test.ts](tests/firebase-guard-debounce.test.ts) (신규)
- **내용**:
  - `syncItemToFirebase()` 단위 테스트
    - 정상 동기화
    - 해시 캐시 중복 방지
    - 오프라인 retryQueue 추가
    - 충돌 해결 (LWW)
  - `withFirebaseSyncDebounced()` 단위 테스트
    - 디바운스 동작
    - flush 동작
  - 기존 테스트 확인: `tests/sync-strategies-contract.test.ts` 통과
- **검증**:
  - [ ] 모든 신규 테스트 통과
  - [ ] 기존 테스트 315개 전부 통과
- **예상 시간**: 1h

---

### Phase A 완료 기준

- [ ] 새 인터페이스 `ItemSyncStrategy<T>`가 TypeScript 컴파일 통과
- [ ] 기존 `syncToFirebase()` 동작 불변 (리그레션 없음)
- [ ] `syncItemToFirebase()` 함수 단위 테스트 통과
- [ ] `withFirebaseSyncDebounced()` 함수 단위 테스트 통과
- [ ] `task:completedBatch` 이벤트 타입 추가 완료
- [ ] 전체 테스트 스위트 통과 (기존 315개 + 신규)

### Phase A 롤백 지점

- **롤백 트리거**: 기존 테스트 실패 또는 런타임 에러
- **롤백 방법**: 
  1. 새 인터페이스/함수 사용 안 함 (export만 해두고 호출 없음)
  2. git revert로 커밋 되돌리기
- **영향 범위**: 없음 (기존 코드와 공존, 호출 없음)

---

## Phase B: 핵심 구현 (2/3)

> **목표**: Collection Sync → Item Sync 전환 및 Repository 쿼리 최적화 실제 적용

### B-1: Firebase 마이그레이션 스크립트 작성

- **파일**: 
  - [scripts/firebase-migration-collection-to-items.ts](scripts/firebase-migration-collection-to-items.ts) (신규)
  - [functions/migrateWeeklyGoals.js](functions/migrateWeeklyGoals.js) (신규)
- **내용**:
  ```
  기존 경로: users/{uid}/weeklyGoals = { data: [goal1, goal2, goal3], ... }
  신규 경로: users/{uid}/weeklyGoalsV2/{goalId} = { data: goal, ... }
  
  마이그레이션 순서:
  1. Cloud Function으로 기존 데이터 읽기
  2. 각 항목을 개별 경로에 복사
  3. 기존 경로는 유지 (폴백용)
  4. 앱에서 신규 경로 우선 읽기, 구 경로 폴백
  ```
  - 동일 패턴을 globalInbox, templates에도 적용
- **검증**:
  - [ ] Firebase Emulator에서 마이그레이션 테스트
  - [ ] 기존 데이터 유실 없음 확인
  - [ ] 신규 경로에 데이터 정상 복사 확인
- **예상 시간**: 3h
- **리스크**: 🔴 Critical - 데이터 유실 가능

---

### B-2: weeklyGoalRepository Single Item Sync 적용

- **파일**: 
  - [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts)
- **내용**:
  1. **addWeeklyGoal()**: 
     - 변경 전: `syncToFirebase(weeklyGoalStrategy, allGoals)`
     - 변경 후: `syncItemToFirebase(weeklyGoalItemStrategy, newGoal)`
     - 반환 타입 유지: `Promise<WeeklyGoal>` (영향 없음)
  
  2. **updateWeeklyGoal()**:
     - 변경 전: `db.weeklyGoals.toArray()` → 전체 동기화
     - 변경 후: 단일 항목만 동기화
     - 재조회 제거: 이미 `updatedGoal` 객체가 있으므로 불필요
  
  3. **deleteWeeklyGoal()**:
     - Firebase에서 해당 항목 삭제: `deleteItemFromFirebase(strategy, goalId)`
  
  4. **loadWeeklyGoals()**: 
     - 신규 경로 우선 읽기 (`weeklyGoalsV2/{goalId}`)
     - 구 경로 폴백 (`weeklyGoals` 배열)
- **검증**:
  - [ ] CRUD 작업 정상 동작
  - [ ] Firebase 페이로드 크기 ~90% 감소 확인
  - [ ] 낙관적 업데이트 동작 확인
- **예상 시간**: 4h
- **리스크**: 🟠 High - Store 영향

---

### B-3: weeklyGoalStore 연동 업데이트

- **파일**: 
  - [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts)
- **내용**:
  - Repository 반환 타입 변경 대응 (현재 `WeeklyGoal` 반환, 변경 없음)
  - 낙관적 업데이트 패턴 적용:
    ```typescript
    // 기존: await addWeeklyGoal() → loadWeeklyGoals()
    // 신규: 
    set({ goals: [...get().goals, newGoal] }); // 즉시 UI 반영
    await addWeeklyGoal(data); // 백그라운드 동기화
    ```
- **검증**:
  - [ ] Store 액션 정상 동작
  - [ ] UI 즉시 반영 확인
  - [ ] 동기화 실패 시 롤백 동작
- **예상 시간**: 1.5h

---

### B-4: inboxRepository Single Item Sync 적용

- **파일**: 
  - [src/data/repositories/inboxRepository.ts](src/data/repositories/inboxRepository.ts)
- **내용**:
  1. **addInboxTask()**:
     - 변경: `syncGlobalInboxToFirebase()` → `syncItemToFirebase(globalInboxItemStrategy, task)`
  
  2. **updateInboxTask()**:
     - 변경: 전체 동기화 → 단일 항목 동기화
  
  3. **deleteInboxTask()**:
     - 변경: `deleteItemFromFirebase(globalInboxItemStrategy, taskId)`
  
  4. **toggleInboxTaskCompletion()**:
     - 복잡도: 두 테이블 간 이동
     - 변경: 두 항목만 동기화 (삭제 + 추가)
  
  5. **syncGlobalInboxToFirebase()**: 
     - Deprecated 처리, Feature Flag로 전환 준비
- **검증**:
  - [ ] Inbox CRUD 정상 동작
  - [ ] 완료 토글 시 두 테이블 동기화 정상
  - [ ] Firebase 쓰기 횟수 감소 확인
- **예상 시간**: 4h
- **리스크**: 🟠 High - inboxStore, taskOperations 영향

---

### B-5: templateRepository Firebase 동기화 추가

- **파일**: 
  - [src/data/repositories/templateRepository.ts](src/data/repositories/templateRepository.ts)
- **내용**:
  - 현재: Firebase 동기화 미구현 (로드만 있음)
  - 추가 구현:
    1. **createTemplate()**: `syncItemToFirebase(templateItemStrategy, template)`
    2. **updateTemplate()**: `syncItemToFirebase(templateItemStrategy, updatedTemplate)`
    3. **deleteTemplate()**: `deleteItemFromFirebase(templateItemStrategy, id)`
  - 충돌 전략: LWW (템플릿은 충돌 가능성 낮음)
- **검증**:
  - [ ] Template CRUD 시 Firebase 동기화
  - [ ] 다른 기기에서 템플릿 변경 수신
  - [ ] 기존 로컬 데이터와 병합 정상
- **예상 시간**: 3h
- **리스크**: 🟡 Medium - 첫 동기화 시 충돌 가능

---

### B-6: deleteItemFromFirebase() 함수 구현

- **파일**: 
  - [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
- **내용**:
  ```typescript
  /**
   * Firebase에서 단일 항목 삭제
   */
  export async function deleteItemFromFirebase<T>(
    strategy: ItemSyncStrategy<T>,
    itemId: string
  ): Promise<void>;
  ```
  - Firebase `remove()` 사용
  - 해시 캐시에서도 제거
  - retryQueue 지원
- **검증**:
  - [ ] 단위 테스트: 삭제 성공
  - [ ] 단위 테스트: 오프라인 시 retryQueue에 추가
- **예상 시간**: 1h

---

### B-7: Phase B 테스트 업데이트

- **파일**: 
  - [tests/sync-strategies-contract.test.ts](tests/sync-strategies-contract.test.ts)
  - [tests/weekly-goal-repository.test.ts](tests/weekly-goal-repository.test.ts) (신규 또는 확장)
  - [tests/inbox-repository.test.ts](tests/inbox-repository.test.ts) (신규 또는 확장)
- **내용**:
  - Repository 변경에 따른 테스트 업데이트
  - 마이그레이션 전/후 호환성 테스트
  - 멀티 기기 시나리오 테스트 (Firebase Emulator)
- **검증**:
  - [ ] 기존 테스트 업데이트 완료
  - [ ] 신규 통합 테스트 통과
- **예상 시간**: 2h

---

### Phase B 완료 기준

- [ ] WeeklyGoal CRUD 시 Firebase 페이로드 ~90% 감소
- [ ] GlobalInbox 단일 작업 동기화 동작
- [ ] Template Firebase 동기화 정상 동작
- [ ] 마이그레이션 스크립트 검증 완료
- [ ] 멀티 기기 테스트 통과 (Firebase Emulator)
- [ ] 전체 테스트 스위트 통과

### Phase B 롤백 지점

- **롤백 트리거**: 데이터 유실, Store 오류, 동기화 충돌
- **롤백 방법**:
  1. Feature Flag OFF → 기존 Collection Sync로 폴백
  2. 구 경로(`weeklyGoals`)에서 데이터 복원
  3. 신규 경로(`weeklyGoalsV2`) 데이터 무시
- **영향 범위**: Repository, Store, Firebase 경로

---

## Phase C: 통합 및 마무리 (3/3)

> **목표**: EventBus 최적화, Debounce 적용, Feature Flag 및 롤아웃 준비

### C-1: EventBus Subscriber 배치 처리 적용

- **파일**: 
  - [src/shared/subscribers/index.ts](src/shared/subscribers/index.ts)
  - [src/shared/subscribers/xpSubscriber.ts](src/shared/subscribers/xpSubscriber.ts)
  - [src/shared/subscribers/gameStateSubscriber.ts](src/shared/subscribers/gameStateSubscriber.ts)
  - [src/shared/subscribers/waifuSubscriber.ts](src/shared/subscribers/waifuSubscriber.ts)
  - [src/shared/subscribers/googleSyncSubscriber.ts](src/shared/subscribers/googleSyncSubscriber.ts)
- **내용**:
  - `task:completedBatch` 이벤트 핸들러 추가
  - 기존 `task:completed` 핸들러는 유지 (단일 이벤트용)
  - 배치 처리 시 XP 합산, 퀘스트 진행 한 번에 처리
  ```typescript
  // gameStateSubscriber 예시
  eventBus.on('task:completedBatch', (payload) => {
    // 여러 작업 완료를 한 번의 퀘스트 업데이트로 처리
    updateQuestProgress('complete_tasks', payload.tasks.length);
  });
  ```
- **검증**:
  - [ ] 배치 이벤트 핸들러 정상 동작
  - [ ] 단일 이벤트 핸들러 동작 불변
  - [ ] UI 반응성 측정 (지연 없음)
- **예상 시간**: 3h

---

### C-2: Sync Debounce 적용

- **파일**: 
  - [src/data/db/infra/syncEngine/lifecycle.ts](src/data/db/infra/syncEngine/lifecycle.ts)
  - [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts)
  - [src/data/repositories/inboxRepository.ts](src/data/repositories/inboxRepository.ts)
- **내용**:
  - Repository에서 `withFirebaseSync()` → `withFirebaseSyncDebounced()` 전환
  - Debounce 시간: 300ms (연속 입력 시 마지막만 동기화)
  - `beforeunload` 이벤트에서 `flushAllDebouncedSync()` 호출
- **검증**:
  - [ ] 연속 CRUD 시 Firebase 쓰기 횟수 감소
  - [ ] 앱 종료 전 대기 중인 동기화 실행
  - [ ] 데이터 유실 없음
- **예상 시간**: 1h

---

### C-3: Feature Flag 시스템 구축

- **파일**: 
  - [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts) (systemState 테이블 사용)
  - [src/shared/utils/featureFlags.ts](src/shared/utils/featureFlags.ts) (신규)
- **내용**:
  ```typescript
  // featureFlags.ts
  export interface FeatureFlags {
    ITEM_SYNC_ENABLED: boolean;      // Single Item Sync 활성화
    SYNC_DEBOUNCE_ENABLED: boolean;  // Debounce 활성화
    BATCH_EVENTS_ENABLED: boolean;   // EventBus 배치 이벤트 활성화
  }
  
  export const DEFAULT_FLAGS: FeatureFlags = {
    ITEM_SYNC_ENABLED: true,
    SYNC_DEBOUNCE_ENABLED: true,
    BATCH_EVENTS_ENABLED: true,
  };
  
  export async function getFeatureFlag(key: keyof FeatureFlags): Promise<boolean>;
  export async function setFeatureFlag(key: keyof FeatureFlags, value: boolean): Promise<void>;
  ```
  - systemState 테이블에 저장 (Dexie)
  - localStorage 사용 금지 (copilot-instructions 규칙)
- **검증**:
  - [ ] Flag 읽기/쓰기 정상
  - [ ] Flag OFF 시 기존 동작으로 폴백
  - [ ] systemState에 저장 확인
- **예상 시간**: 2h

---

### C-4: 통합 테스트 (E2E 시나리오)

- **파일**: 
  - [tests/integration/multi-device-sync.test.ts](tests/integration/multi-device-sync.test.ts) (신규)
  - [tests/integration/offline-sync.test.ts](tests/integration/offline-sync.test.ts) (신규)
- **내용**:
  1. **멀티 기기 시나리오**:
     - 기기 A에서 Goal 추가 → 기기 B에서 수신 확인
     - 동시 수정 시 LWW 충돌 해결
  
  2. **오프라인 시나리오**:
     - 오프라인 상태에서 CRUD → retryQueue에 저장
     - 온라인 복귀 시 drainRetryQueue() 실행
     - 데이터 일관성 확인
  
  3. **연속 작업 시나리오**:
     - 빠른 연속 CRUD → Debounce로 마지막만 동기화
     - 앱 종료 전 flush 확인
- **검증**:
  - [ ] 모든 E2E 시나리오 통과
  - [ ] Firebase Emulator에서 테스트
- **예상 시간**: 2h

---

### C-5: 성능 측정 및 검증

- **파일**: 
  - [docs/analysis/081-performance-results.md](docs/analysis/081-performance-results.md) (신규)
- **내용**:
  1. **Firebase Console 메트릭**:
     - Realtime Database 읽기/쓰기 횟수
     - 네트워크 전송량
  
  2. **Performance.measure() 계측**:
     - WeeklyGoal CRUD 소요 시간
     - Firebase 동기화 지연 시간
  
  3. **비교 분석**:
     - Phase B 전/후 Firebase 페이로드 크기
     - Phase C 전/후 Firebase 쓰기 횟수
- **검증**:
  - [ ] WeeklyGoal 페이로드 -90% 달성
  - [ ] Firebase 쓰기 -50% 달성
  - [ ] UI 반응성 저하 없음
- **예상 시간**: 1h

---

### C-6: 문서화 및 릴리즈 준비

- **파일**: 
  - [CHANGELOG.md](CHANGELOG.md)
  - [docs/migration-guide-081.md](docs/migration-guide-081.md) (신규)
- **내용**:
  - CHANGELOG에 변경 사항 기록
  - 마이그레이션 가이드 작성 (기존 사용자용)
  - Feature Flag 설명 문서
- **검증**:
  - [ ] CHANGELOG 업데이트 완료
  - [ ] 마이그레이션 가이드 완성
- **예상 시간**: 1h

---

### Phase C 완료 기준

- [ ] Feature Flag로 모든 신규 기능 제어 가능
- [ ] 성능 지표 측정 완료 (목표치 달성)
- [ ] E2E 테스트 통과
- [ ] 문서화 완료
- [ ] 점진적 롤아웃 준비 완료

### Phase C 롤백 지점

- **롤백 트리거**: 성능 저하, UI 반응성 문제, 데이터 일관성 오류
- **롤백 방법**:
  1. Feature Flag 전체 OFF:
     - `ITEM_SYNC_ENABLED: false`
     - `SYNC_DEBOUNCE_ENABLED: false`
     - `BATCH_EVENTS_ENABLED: false`
  2. 자동으로 기존 Collection Sync 동작
- **영향 범위**: 전체 동기화 로직

---

## 전체 의존성 맵

```
Phase A (기반)                     Phase B (핵심)                      Phase C (통합)
─────────────────                 ─────────────────                   ─────────────────

┌──────────────────┐
│ A-1: ItemSync    │
│     Interface    │─────────────┐
└──────────────────┘             │
         │                       │
         ▼                       │
┌──────────────────┐             │
│ A-2: syncItem    │             │
│     ToFirebase() │─────────────┼──────────┐
└──────────────────┘             │          │
         │                       │          │
         ▼                       │          │
┌──────────────────┐             │          │
│ A-3: ItemStrategy│             │          │
│     정의         │─────────────┼──────────┤
└──────────────────┘             │          │
                                 │          │
                                 ▼          │
                     ┌───────────────────────┐
                     │ B-1: Firebase         │
                     │     마이그레이션      │──────────┐
                     └───────────────────────┘          │
                                 │                      │
         ┌───────────────────────┼──────────────────────┤
         │                       │                      │
         ▼                       ▼                      ▼
┌─────────────────┐  ┌─────────────────┐    ┌─────────────────┐
│ B-2: weeklyGoal │  │ B-4: inbox      │    │ B-5: template   │
│     Repository  │  │     Repository  │    │     Repository  │
└─────────────────┘  └─────────────────┘    └─────────────────┘
         │                       │                      │
         ▼                       │                      │
┌─────────────────┐              │                      │
│ B-3: weeklyGoal │              │                      │
│     Store       │              │                      │
└─────────────────┘              │                      │
         │                       │                      │
         └───────────┬───────────┴──────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ B-6: deleteItem       │
         │     FromFirebase()    │
         └───────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ B-7: 테스트 업데이트   │
         └───────────────────────┘
                     │
                     ▼
                     │                      Phase C
                     │                      ─────────────────
                     │
┌──────────────────┐ │
│ A-4: Debounced   │ │
│     래퍼 함수    │─┼───────────────────┐
└──────────────────┘ │                   │
                     │                   ▼
┌──────────────────┐ │       ┌─────────────────────┐
│ A-5: Batch Event │ │       │ C-1: Subscriber     │
│     타입 추가    │─┼──────▶│     배치 처리       │
└──────────────────┘ │       └─────────────────────┘
                     │                   │
                     │                   ▼
                     │       ┌─────────────────────┐
                     └──────▶│ C-2: Sync Debounce  │
                             │     적용            │
                             └─────────────────────┘
                                         │
                                         ▼
                             ┌─────────────────────┐
                             │ C-3: Feature Flag   │
                             │     시스템          │
                             └─────────────────────┘
                                         │
                                         ▼
                             ┌─────────────────────┐
                             │ C-4: E2E 테스트     │
                             └─────────────────────┘
                                         │
                                         ▼
                             ┌─────────────────────┐
                             │ C-5: 성능 측정      │
                             └─────────────────────┘
                                         │
                                         ▼
                             ┌─────────────────────┐
                             │ C-6: 문서화         │
                             └─────────────────────┘
```

### 병렬 작업 가능 영역

| 작업 조합 | 병렬 가능 | 이유 |
|----------|-----------|------|
| A-1 + A-4 + A-5 | ✅ | 서로 독립적인 인터페이스/타입 정의 |
| A-2 + A-3 | ❌ | A-3은 A-2의 타입을 사용 |
| B-2 + B-4 + B-5 | ✅ (B-1 후) | 각 Repository가 독립적 |
| C-1 + C-2 | ❌ | C-2가 C-1의 배치 이벤트에 의존 |

---

## 예외 처리 시나리오

### Phase A 실패 시

| 실패 유형 | 대응 방안 |
|----------|----------|
| TypeScript 컴파일 오류 | 인터페이스 수정 후 재시도 |
| 기존 테스트 실패 | 인터페이스가 기존 타입을 깨뜨리지 않도록 수정 |
| 신규 테스트 실패 | syncItemToFirebase 로직 디버깅 |

**결론**: Phase A는 기존 코드에 영향 없으므로 롤백 비용 최소

---

### Phase B 실패 시

| 실패 유형 | 대응 방안 |
|----------|----------|
| 마이그레이션 데이터 유실 | 구 경로에서 데이터 복원, 마이그레이션 재설계 |
| Repository 반환 타입 오류 | Store 코드 동시 수정, TypeScript 컴파일러 활용 |
| 멀티 기기 충돌 | LWW 전략 검증, 충돌 로그 분석 |
| Store 오류 | Feature Flag OFF로 기존 동작 폴백 |

**결론**: Feature Flag 필수, 구 경로 데이터 보존 기간 설정 (2주)

---

### Phase C 실패 시

| 실패 유형 | 대응 방안 |
|----------|----------|
| UI 반응성 저하 | 배치 이벤트 비활성화 (Feature Flag) |
| Debounce 데이터 유실 | flush 로직 강화, beforeunload 이벤트 확인 |
| 성능 목표 미달 | 배치 크기/Debounce 시간 조정 |

**결론**: 모든 최적화는 Feature Flag로 개별 제어 가능

---

## Open Questions (해결 필요)

| # | 질문 | 권장 답변 | 결정 상태 |
|---|------|----------|----------|
| 1 | 구 경로 데이터 보존 기간? | 2주 (모든 클라이언트 업데이트 확인 후 삭제) | ⏳ 대기 |
| 2 | Debounce 중 오프라인 전환 처리? | 즉시 flush → retryQueue 추가 | ⏳ 대기 |
| 3 | EventBus 배치 크기 최적값? | 초기값 10, 성능 측정 후 조정 | ⏳ 대기 |
| 4 | 템플릿 동기화 충돌 전략? | LWW (충돌 가능성 낮음) | ✅ 결정 |

---

## 다음 단계

1. **즉시**: Phase A-1 (ItemSyncStrategy 인터페이스) 구현 시작
2. **병행**: Phase A-4, A-5 (독립적인 작업) 병렬 진행
3. **Phase A 완료 후**: Critic 리뷰 요청 → Phase B 진행

---

## 📎 관련 문서

- [Analysis 081: 영향도 분석](../analysis/081-data-optimization-impact-analysis.md)

---

| 변경일 | 변경자 | 내용 |
|--------|--------|------|
| 2026-01-09 | Planner | 초안 작성 |
| 2026-01-09 | Planner | 3등분 상세 계획으로 전면 개편 (Analysis 081 기반) |
