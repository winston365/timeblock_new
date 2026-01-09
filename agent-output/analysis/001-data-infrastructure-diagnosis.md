# 데이터 인프라 현황 진단 및 병목 지점 분석

**분석일시**: 2026-01-09  
**분석 대상**: TimeBlock Planner - Dexie/Firebase 데이터 인프라  
**분석자**: Analyst Agent

---

## 1. DB 스키마 현황

### 1.1 테이블 목록 및 인덱스 구성 (v17)

| 테이블명 | 인덱스 구성 | 용도 |
|----------|-------------|------|
| `dailyData` | `date, updatedAt` | 일일 스케줄 데이터 |
| `gameState` | `key` | 게임 상태 (XP, 퀘스트) |
| `templates` | `id, name, autoGenerate` | 스케줄 템플릿 |
| `shopItems` | `id, name` | 상점 아이템 |
| `waifuState` | `key` | 와이프 상태 |
| `settings` | `key` | 앱 설정 |
| `chatHistory` | `date, updatedAt` | 대화 기록 |
| `dailyTokenUsage` | `date, updatedAt` | AI 토큰 사용량 |
| `globalInbox` | `id, createdAt, completed` | 미배치 작업 |
| `completedInbox` | `id, completedAt, createdAt` | 완료된 인박스 |
| `globalGoals` | `id, createdAt, order` | ⚠️ **사용되지 않음 (레거시)** |
| `systemState` | `key` | 시스템 상태 (K-V) |
| `images` | `id` | 이미지 저장 |
| `weather` | `id` | 날씨 캐시 |
| `aiInsights` | `date` | AI 인사이트 |
| `ragDocuments` | `id, type, date, completed, contentHash, indexedAt` | RAG 벡터 |
| `weeklyGoals` | `id, weekStartDate, order` | 주간 목표 |
| `tempScheduleTasks` | `id, scheduledDate, parentId, order, createdAt` | 임시 스케줄 |
| `taskCalendarMappings` | `taskId, calendarEventId, date, syncStatus` | ⚠️ **Deprecated** |
| `taskGoogleTaskMappings` | `taskId, googleTaskId, googleTaskListId, syncStatus` | Google Tasks 연동 |
| `tempScheduleCalendarMappings` | `taskId, calendarEventId, date, syncStatus` | Calendar 연동 |

### 1.2 인덱스 문제점

| 문제 | 위치 | 영향 |
|------|------|------|
| **누락된 복합 인덱스** | `dailyData` | `date + updatedAt` 범위 쿼리 시 풀스캔 |
| **미활용 인덱스** | `completed` (globalInbox) | Boolean 인덱스는 Dexie에서 비효율적 (1/0 변환 필요) |
| **과도한 인덱스** | `ragDocuments` | 6개 인덱스 → 쓰기 부하 증가 |
| **레거시 테이블 존재** | `globalGoals`, `taskCalendarMappings` | 마이그레이션 후 미삭제 |

### 1.3 데이터 중복 저장 현황

| 중복 영역 | 설명 | 영향도 |
|-----------|------|--------|
| **Task 저장 위치 분산** | `dailyData.tasks[]` vs `globalInbox` vs `completedInbox` | ⚠️ 높음 - 동일 Task가 여러 테이블에 존재 가능 |
| **systemState 남용** | 35개 이상의 키 사용 (분산된 상태 관리) | 중간 - 조회 시 오버헤드 |
| **TempSchedule 템플릿** | `db.systemState`에 JSON으로 저장 | 낮음 - 별도 테이블 고려 필요 |

---

## 2. 쿼리 패턴 분석

### 2.1 과도한 쿼리 호출 지점

| 위치 | 패턴 | 문제 | 호출 빈도 |
|------|------|------|-----------|
| [weeklyGoalRepository.ts#L232](src/data/repositories/weeklyGoalRepository.ts#L232) | `db.weeklyGoals.toArray()` | 매 CRUD 후 전체 로드 | 매우 높음 |
| [weeklyGoalRepository.ts#L265](src/data/repositories/weeklyGoalRepository.ts#L265) | `db.weeklyGoals.toArray()` | 업데이트 후 전체 동기화 | 매우 높음 |
| [weeklyGoalRepository.ts#L286](src/data/repositories/weeklyGoalRepository.ts#L286) | `db.weeklyGoals.toArray()` | 삭제 후 전체 동기화 | 높음 |
| [tempScheduleRepository.ts#L42](src/data/repositories/tempScheduleRepository.ts#L42) | `db.tempScheduleTasks.toArray()` | 날짜 필터링 전 전체 로드 | 높음 |
| [inboxRepository.ts#L34](src/data/repositories/inboxRepository.ts#L34) | `db.globalInbox.toArray()` | 동기화용 전체 로드 | 높음 |

**증거 코드** (weeklyGoalRepository.ts):
```typescript
// addWeeklyGoal, updateWeeklyGoal, deleteWeeklyGoal 모두 동일 패턴
withFirebaseSync(async () => {
  const allGoals = await db.weeklyGoals.toArray(); // ⚠️ 매번 전체 로드
  await syncToFirebase(weeklyGoalStrategy, allGoals);
}, 'WeeklyGoal:add');
```

### 2.2 N+1 쿼리 패턴

| 위치 | 패턴 | 문제 |
|------|------|------|
| [queryHelpers.ts#L71-L80](src/data/repositories/dailyData/queryHelpers.ts#L71-L80) | `getRecentDailyData()` | N일 × `loadDailyData()` 호출 |
| [directQueryService.ts#L51](src/shared/services/rag/directQueryService.ts#L51) | 날짜별 반복 | 각 날짜마다 개별 `loadDailyData()` |

**증거 코드** (queryHelpers.ts):
```typescript
export async function getRecentDailyData(days: number): Promise<Array<DailyData & { date: string }>> {
  const dataPromises = dates.map(async date => {
    const data = await loadDailyData(date); // ⚠️ N번 호출
    return { date, ...data };
  });
  return await Promise.all(dataPromises);
}
```

### 2.3 불필요한 전체 테이블 스캔

| 위치 | 함수 | 문제 |
|------|------|------|
| [tempScheduleRepository.ts#L183](src/data/repositories/tempScheduleRepository.ts#L183) | `loadTempScheduleTasks()` | 날짜 필터 전 모든 작업 로드 |
| [tempScheduleRepository.ts#L220](src/data/repositories/tempScheduleRepository.ts#L220) | `loadTempScheduleTasksForDate()` | 전체 → 메모리 필터링 |
| [tempScheduleRepository.ts#L230](src/data/repositories/tempScheduleRepository.ts#L230) | `loadTempScheduleTasksForRange()` | 전체 로드 후 각 날짜별 필터 |

---

## 3. 동기화 메커니즘 분석

### 3.1 현재 동기화 전략 요약

| 전략 | 데이터 타입 | 충돌 해결 | 동기화 방식 |
|------|-------------|-----------|-------------|
| **LWW (Last-Write-Wins)** | dailyData, chatHistory, tokenUsage, templates, settings | 타임스탬프 비교 | 전체 덮어쓰기 |
| **Delta-based Merge** | gameState | `mergeGameState()` | 필드별 병합 |
| **ID-based Merge** | globalInbox | `mergeTaskArray()` | ID 기준 최신 유지 |
| **Collection Sync** | templates, shopItems, globalInbox | debounce (500-750ms) | 전체 배열 업로드 |

### 3.2 과도한 동기화 트리거

| 위치 | 문제 | 트리거 빈도 |
|------|------|-------------|
| **Dexie Hooks** ([syncEngine/index.ts#L62-L120](src/data/db/infra/syncEngine/index.ts#L62-L120)) | 모든 테이블 변경 시 자동 동기화 | 매우 높음 |
| **Collection 동기화** | 단일 항목 변경 → 전체 컬렉션 업로드 | 높음 |
| **completedInbox** | 날짜별 그룹화 → N개 동기화 요청 | 중간 |

**문제 시나리오**:
```
1. Task 1개 완료
2. globalInbox 전체 동기화 (templates처럼 debounce됨)
3. completedInbox 날짜별 N개 동기화
4. 총 N+1번의 Firebase 쓰기 발생
```

### 3.3 동기화 지연/실패 처리

| 구현 | 위치 | 상태 |
|------|------|------|
| **재시도 큐** | [syncRetryQueue.ts](src/shared/services/sync/firebase/syncRetryQueue.ts) | ✅ 구현됨 (exponential backoff) |
| **중복 방지** | [syncCore.ts#L63](src/shared/services/sync/firebase/syncCore.ts#L63) | ✅ 해시 캐시로 구현 |
| **리더 선출** | [firebaseSyncLeaderLock.ts](src/shared/services/sync/firebase/firebaseSyncLeaderLock.ts) | ✅ 멀티 윈도우 대응 |
| **Observed Cache** | [rtdbObservedCache.ts](src/shared/services/sync/firebase/rtdbObservedCache.ts) | ✅ BW-06 최적화 |

**미해결 이슈**:
- 오프라인 → 온라인 전환 시 `drainRetryQueue()` 호출이 자동화되지 않음
- 동기화 실패 알림이 사용자에게 노출되지 않는 경우 존재

---

## 4. 데이터 흐름 비효율

### 4.1 중복 로딩 지점

| 위치 | 호출 체인 | 중복 내용 |
|------|-----------|-----------|
| **Store → Repository** | `inboxStore.loadData()` → `loadInboxTasks()` | 매 작업 후 전체 재로드 |
| **taskOperations.ts** | `updateTask()` → `loadData(currentDate, true)` | 이동 후 전체 재로드 |
| **googleSyncSubscriber.ts** | 이벤트 수신 → `loadDailyData()` | 동기화 후 전체 재로드 |

**증거 코드** ([inboxStore.ts](src/shared/stores/inboxStore.ts)):
```typescript
addTask: async (task) => {
  await addInboxTask(task); 
  await get().loadData(); // ⚠️ 추가 후 전체 재로드
}
```

### 4.2 캐싱 미사용 영역

| 영역 | 현황 | 권장 |
|------|------|------|
| **loadDailyData()** | 매번 IndexedDB 조회 | React Query 또는 Zustand 캐시 활용 |
| **loadWeeklyGoals()** | 매번 전체 로드 + 정규화 | 단순 캐시 + invalidate 패턴 |
| **loadTempScheduleTasks()** | 매번 전체 로드 | 날짜 범위 캐시 |
| **systemState 조회** | 개별 키 매번 조회 | 일괄 로드 후 메모리 캐시 |

### 4.3 과도한 상태 업데이트

| 위치 | 문제 | 영향 |
|------|------|------|
| **EventBus 연쇄 반응** | `task:completed` → 5개 이상 subscriber 반응 | UI 리렌더링 폭주 |
| **Store 간 참조** | gameStateSubscriber → useGameStateStore.refresh() | 연쇄 DB 조회 |

**EventBus 연쇄 흐름 예시**:
```
task:completed 발생
├── xpSubscriber: XP 계산
├── gameStateSubscriber: 퀘스트 진행도 업데이트
├── waifuSubscriber: 메시지 트리거
├── googleSyncSubscriber: Google Tasks 동기화
└── inboxSubscriber: 인박스 상태 갱신
```

---

## 5. 병목 지점 요약 (Top 10)

| # | 위치 | 문제 유형 | 예상 영향도 | 증거 |
|---|------|-----------|-------------|------|
| 1 | `weeklyGoalRepository` | **전체 로드 후 동기화** | 🔴 매우 높음 | 매 CRUD 후 `toArray()` + Firebase 업로드 |
| 2 | `loadTempScheduleTasksForDate()` | **전체 스캔 + 메모리 필터** | 🔴 매우 높음 | `toArray()` → `filter()` 패턴 |
| 3 | `SyncEngine (Collection)` | **단일 변경 → 전체 업로드** | 🔴 높음 | templates, shopItems, globalInbox |
| 4 | `Store.loadData()` | **매 작업 후 전체 재로드** | 🟠 높음 | inboxStore, templateStore 등 |
| 5 | `getRecentDailyData()` | **N+1 쿼리 패턴** | 🟠 높음 | N일 × loadDailyData() |
| 6 | `EventBus 연쇄 반응` | **이벤트 폭주** | 🟠 중간 | task:completed → 5+ 핸들러 |
| 7 | `systemState` 분산 | **35+ 키 개별 관리** | 🟡 중간 | 타입 안전성 부재, 조회 분산 |
| 8 | `dailyData Boolean 인덱스` | **비효율적 인덱스** | 🟡 낮음 | `completed` 필드 1/0 변환 |
| 9 | `레거시 테이블` | **미사용 데이터 잔존** | 🟡 낮음 | globalGoals, taskCalendarMappings |
| 10 | `ragDocuments 인덱스 과다` | **쓰기 부하** | 🟢 낮음 | 6개 인덱스 유지 비용 |

---

## 6. 권장 개선 사항

### 6.1 즉시 개선 가능 (Quick Wins)

1. **weeklyGoalRepository 최적화**
   - 개별 항목 동기화 전략 도입 (`syncToFirebase(strategy, goal, goal.id)`)
   - 전체 동기화는 reorder 시에만 수행

2. **tempSchedule 인덱스 쿼리 활용**
   - `db.tempScheduleTasks.where('scheduledDate').equals(date)` 사용
   - 반복 규칙 작업은 별도 처리

3. **Store loadData() 패턴 개선**
   - 낙관적 업데이트 후 background revalidation만 수행
   - 전체 재로드 제거

### 6.2 중기 개선 (Refactoring)

1. **systemState 타입 안전 래퍼**
   - 키별 타입 정의 + 일괄 로드/캐싱

2. **N+1 쿼리 해결**
   - `db.dailyData.bulkGet(dates)` 활용
   - 단일 트랜잭션으로 처리

3. **Collection Sync → Delta Sync**
   - 변경된 항목만 개별 동기화
   - Firebase 경로 구조 변경 필요

### 6.3 장기 개선 (Architecture)

1. **캐싱 레이어 도입**
   - Repository 레벨 메모리 캐시
   - Stale-while-revalidate 패턴

2. **EventBus 병목 해소**
   - 이벤트 배칭 (debounce/throttle)
   - 우선순위 기반 실행 제어

3. **레거시 테이블 마이그레이션**
   - globalGoals → weeklyGoals 완전 이전
   - taskCalendarMappings 제거

---

## 7. Open Questions

1. **tempSchedule 반복 규칙 최적화**: 인덱스로 해결 가능한가, 별도 계산 테이블 필요한가?
2. **Firebase 대역폭 비용**: Collection Sync가 실제 비용에 미치는 영향?
3. **멀티 디바이스 충돌 빈도**: LWW가 실제 데이터 손실을 유발하는 빈도?
4. **systemState 키 통합**: 어떤 키들을 병합/구조화할 수 있는가?

---

**Status**: 분석 완료  
**Next Steps**: Planner에게 핸드오프하여 개선 계획 수립
