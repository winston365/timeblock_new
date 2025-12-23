# Schedule View Changes: Hotspot/Risk Analysis

> **Artifact Type:** Pre-Implementation Hotspot Analysis  
> **Date:** 2025-12-23  
> **Status:** Initial Analysis  
> **Requested Changes:**
> 1. Remove schedule view task limit (currently max 3 per timeblock)
> 2. Inbox → Timeblock immediate UI update without refresh

---

## Change #1: Remove Task Limit (MAX_TASKS_PER_BLOCK = 3)

### (a) File Paths & Symbols Where Limit Is Enforced

| File | Symbol | Role |
|------|--------|------|
| [src/features/schedule/utils/timeBlockBucket.ts](src/features/schedule/utils/timeBlockBucket.ts#L4) | `MAX_TASKS_PER_BLOCK = 3` | **Primary constant** – 모든 제한의 기준 |
| [src/features/schedule/utils/timeBlockBucket.ts](src/features/schedule/utils/timeBlockBucket.ts#L6) | `MAX_TASKS_PER_BUCKET` | Backward-compat alias (같은 값) |
| [src/features/schedule/utils/timeBlockBucket.ts](src/features/schedule/utils/timeBlockBucket.ts#L8) | `isBucketAtCapacity()` | 용량 체크 함수 – default param으로 `MAX_TASKS_PER_BLOCK` 사용 |
| [src/features/schedule/utils/threeHourBucket.ts](src/features/schedule/utils/threeHourBucket.ts#L8) | `MAX_TASKS_PER_BUCKET = 3` | **중복 정의** – 정리 필요 (동일 로직) |
| [src/features/schedule/utils/threeHourBucket.ts](src/features/schedule/utils/threeHourBucket.ts#L54) | `isBucketAtCapacity()` | 중복 함수 – timeBlockBucket.ts와 동일 |
| [src/features/schedule/HourBar.tsx](src/features/schedule/HourBar.tsx#L14-L16) | `MAX_TASKS_PER_HOUR` | HourBar 로컬 상수 (= `MAX_TASKS_PER_BLOCK`) |
| [src/features/schedule/HourBar.tsx](src/features/schedule/HourBar.tsx#L205-L206) | inline input guard | 작업 추가 시 제한 검증 |
| [src/features/schedule/HourBar.tsx](src/features/schedule/HourBar.tsx#L240-L241) | drop-to-end guard | 드롭 시 제한 검증 |
| [src/features/schedule/HourBar.tsx](src/features/schedule/HourBar.tsx#L261-L262) | drop-before guard | 순서 재배치 시 제한 검증 |
| [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx#L41) | import | `MAX_TASKS_PER_BLOCK` import |
| [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx#L213) | handleSaveTask guard | 새 작업 저장 시 제한 |
| [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx#L314) | handleDrop guard | 드래그&드롭 이동 시 제한 |

### Test File Affected

| File | Test Case |
|------|-----------|
| [tests/three-hour-bucket-utils.test.ts](tests/three-hour-bucket-utils.test.ts#L45-L50) | `isBucketAtCapacity: applies MAX_TASKS_PER_BLOCK by default` – **asserts value = 3** |

### Risk Assessment: Limit Removal

| Risk Level | Issue | Impact | Mitigation |
|------------|-------|--------|------------|
| 🟡 Medium | **UI 레이아웃 붕괴** | 무한 작업 시 타임블록 높이 급격히 증가 → 스크롤/오버플로우 문제 | max-height + overflow-y-auto 추가 또는 가상화(virtualization) 고려 |
| 🟡 Medium | **중복 상수** | `threeHourBucket.ts`에 동일 상수가 중복 정의됨 | 제거하거나 `timeBlockBucket.ts`에서 re-export |
| 🟢 Low | **테스트 실패** | 테스트가 `MAX_TASKS_PER_BLOCK === 3` 단언 | 값 변경 시 테스트도 함께 수정 필요 |
| 🟢 Low | **Toast 메시지** | 제한 해제 시 "최대 3개" 메시지가 불필요해짐 | 제한 체크 로직 및 관련 toast 제거 |

### Suggested Safest Approach

1. **Single Source of Truth**: `defaults.ts`에 `MAX_TASKS_PER_BLOCK` 또는 `Infinity` 정의
2. **Conditional Guard**: `isBucketAtCapacity()` 함수에서 `Infinity`이면 항상 `false` 반환
3. **UI Container**: `TimeBlockContent` 및 `HourBar` 작업 목록 영역에 `max-h-[400px] overflow-y-auto` 적용
4. **Remove Duplicate**: `threeHourBucket.ts`의 중복 상수 제거
5. **Test Update**: 테스트 케이스 수정 (값 검증 → `Infinity` 허용 여부 체크)

---

## Change #2: Inbox → Timeblock Immediate UI Update

### (b) Likely Root Cause for "Refresh Needed" Issue

#### Data Flow Analysis

```
InboxTab.tsx
  └─ updateTask(taskId, { timeBlock, hourSlot })
       └─ useInboxStore.updateTask()
            └─ import('@/data/repositories/dailyDataRepository').updateTask()
            └─ **await get().loadData()** ← 인박스 재로드

ScheduleView.tsx / TimelineView.tsx
  └─ useDailyDataStore → dailyData?.tasks 구독
       └─ dailyDataStore.updateTask()
            └─ **isInboxToBlockMove** 감지
            └─ await loadData(currentDate, true) ← 강제 새로고침
```

#### Root Cause Breakdown

| Cause | File/Symbol | Description |
|-------|-------------|-------------|
| **1. 강제 새로고침 의존** | [dailyDataStore.ts](src/shared/stores/dailyDataStore.ts#L304-L305) | inbox → block 이동 시 `loadData(currentDate, true)` 호출로 전체 새로고침 |
| **2. Optimistic Update 스킵** | [dailyDataStore.ts](src/shared/stores/dailyDataStore.ts#L280-L282) | `isInboxToBlockMove` 또는 `isBlockToInboxMove`인 경우 optimistic update가 적용되지 않음 |
| **3. 별도 Store 사용** | `inboxStore.ts` vs `dailyDataStore.ts` | 두 store가 분리되어 있어 상태 동기화 지연 발생 |
| **4. Repository 레벨 이동** | [taskOperations.ts](src/data/repositories/dailyData/taskOperations.ts#L92-L118) | `moveInboxTaskToBlock()` 호출 후 `saveDailyData()` – store 상태와 무관하게 DB만 업데이트 |

#### Why `loadData()` Is Called

[dailyDataStore.ts#L304-L306](src/shared/stores/dailyDataStore.ts#L304-L306):
```typescript
// 🔹 inbox ↔ timeBlock 이동 시 강제 새로고침
if (isInboxToBlockMove || isBlockToInboxMove) {
  await loadData(currentDate, true);
}
```

이 코드가 문제의 직접적 원인. 새로고침 대신 **optimistic update**로 전환해야 함.

### Why React Query Is Not Involved

- 현재 프로젝트는 **Zustand + Dexie** 조합
- React Query는 `copilot-instructions.md`에 "Supabase sync 시 도입 예정"으로 명시됨
- 현재 단계에서는 Zustand store의 optimistic update 패턴으로 해결해야 함

### Risk Assessment: Immediate Update

| Risk Level | Issue | Impact | Mitigation |
|------------|-------|--------|------------|
| 🔴 High | **Optimistic Update 누락 시 데이터 불일치** | repository 저장 실패 시 UI와 DB 상태 불일치 | 기존 `createRollbackState` 패턴 활용한 롤백 로직 필수 |
| 🟡 Medium | **중복 작업 방지 로직** | [taskOperations.ts#L110-L116](src/data/repositories/dailyData/taskOperations.ts#L110-L116)에 중복 체크 있음 – store 레벨에도 필요 | store에서 ID 중복 체크 추가 |
| 🟡 Medium | **inboxStore 상태 동기화** | inbox store도 해당 task 제거해야 함 | eventBus 사용 또는 직접 호출 |
| 🟢 Low | **hourSlot 자동 설정** | block 시작 시간으로 자동 설정됨 – 명시적 전달 권장 | `updates`에 `hourSlot` 포함 확인 |

### Suggested Safest Approach

1. **Optimistic Update 활성화** (dailyDataStore.updateTask):
   ```typescript
   // isInboxToBlockMove일 때도 optimistic update 적용
   if (isInboxToBlockMove && inboxTask) {
     const optimisticTask = { ...inboxTask, ...sanitizedUpdates };
     const optimisticTasks = addTaskToArray(dailyData.tasks, optimisticTask);
     set(createOptimisticTaskUpdate(dailyData, optimisticTasks));
   }
   ```

2. **inboxStore 동기화** (eventBus 활용):
   ```typescript
   eventBus.emit('inbox:taskMovedToBlock', { taskId });
   // inboxStore에서 구독하여 해당 task 제거
   ```

3. **loadData 제거 또는 조건부 유지**:
   - 성공 시 loadData 불필요 (optimistic update로 대체)
   - 실패 시 rollback으로 복구

4. **중복 방지 로직 store 레벨 추가**:
   ```typescript
   if (dailyData.tasks.some(t => t.id === taskId)) {
     // 이미 존재하면 update만, add 스킵
   }
   ```

---

## (c) Risk List Summary

### Critical (Must Address)

| ID | Risk | Files Affected |
|----|------|----------------|
| R1 | Optimistic update 미적용으로 inbox→block 이동 시 UI 지연 | `dailyDataStore.ts` |
| R2 | 강제 새로고침(loadData) 호출이 성능 저하 및 UX 저하 유발 | `dailyDataStore.ts` |

### Medium (Should Address)

| ID | Risk | Files Affected |
|----|------|----------------|
| R3 | 상수 중복 정의 (`MAX_TASKS_PER_BLOCK` / `MAX_TASKS_PER_BUCKET`) | `timeBlockBucket.ts`, `threeHourBucket.ts` |
| R4 | 무한 작업 시 UI 오버플로우 | `TimeBlock.tsx`, `HourBar.tsx`, `TimelineView.tsx` |
| R5 | inboxStore 상태 동기화 누락 가능 | `inboxStore.ts`, `dailyDataStore.ts` |

### Low (Nice to Have)

| ID | Risk | Files Affected |
|----|------|----------------|
| R6 | Toast 메시지 "최대 3개" 불필요해짐 | `HourBar.tsx`, `TimelineView.tsx` |
| R7 | 테스트 실패 (값 검증) | `three-hour-bucket-utils.test.ts` |

---

## (d) Relevant Tests & Recommendations

### Existing Tests

| Test File | Coverage | Status |
|-----------|----------|--------|
| [tests/three-hour-bucket-utils.test.ts](tests/three-hour-bucket-utils.test.ts) | `MAX_TASKS_PER_BLOCK`, `isBucketAtCapacity` | ⚠️ 값 변경 시 업데이트 필요 |
| [tests/unified-task-service.test.ts](tests/unified-task-service.test.ts) | `findTaskLocation`, `updateAnyTask` | ✅ 이동 로직 테스트 존재 |

### Tests to Add/Adjust

| Test Type | Description | Priority |
|-----------|-------------|----------|
| **Unit** | `isBucketAtCapacity(n, Infinity)` 시 항상 false 반환 검증 | High |
| **Unit** | inbox → block 이동 시 dailyData.tasks에 즉시 반영 검증 | High |
| **Integration** | drag-drop으로 inbox → timeblock 이동 시 새로고침 없이 UI 업데이트 확인 | Medium |
| **Regression** | 기존 limit 로직 제거 후 4개 이상 작업 추가 가능 검증 | Medium |
| **UI/Visual** | 10개 이상 작업 시 레이아웃 붕괴 없음 검증 | Low |

---

## Architecture Alignment Check

| Aspect | Status | Notes |
|--------|--------|-------|
| Repository Pattern | ✅ Aligned | `dailyDataRepository`, `inboxRepository` 경유 |
| No localStorage | ✅ Compliant | Dexie `systemState` 사용 (theme 예외) |
| Optional Chaining | ⚠️ Check | `dailyData?.tasks`, `task?.timeBlock` 등 확인 필요 |
| Modal UX (ESC close) | N/A | 이 변경과 무관 |
| Defaults from defaults.ts | ⚠️ Action | `MAX_TASKS_PER_BLOCK`을 `defaults.ts`로 이동 권장 |

---

## Recommendations for Planner

1. **Limit Removal (Change #1)**:
   - `defaults.ts`에 상수 정의 → re-export
   - UI overflow 처리 명시 (max-height + scroll)
   - 중복 파일 정리 (`threeHourBucket.ts`)

2. **Immediate Update (Change #2)**:
   - optimistic update 패턴 적용 (기존 `createOptimisticTaskUpdate` 재사용)
   - `loadData(currentDate, true)` 호출 제거
   - eventBus로 inboxStore 동기화

3. **Testing**:
   - 기존 테스트 값 검증 수정
   - inbox → block 이동 통합 테스트 추가

---

## Changelog

| Date | Action | Summary |
|------|--------|---------|
| 2025-12-23 | Initial Analysis | Hotspot identification, root cause analysis, risk assessment |
