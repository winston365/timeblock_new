# Task Service

Task 저장소를 추상화하는 통합 서비스 레이어입니다.

## 배경

TimeBlock에서 Task는 두 곳에 저장됩니다:

| 저장소 | 조건 | 용도 |
|--------|------|------|
| `dailyData.tasks` | `timeBlock !== null` | 날짜별 스케줄 작업 |
| `globalInbox` | `timeBlock === null` | 전역 대기 작업 |

## 문제

통합 검색 등 **두 저장소의 작업을 함께 다루는 기능**에서는 작업이 어디서 왔는지 매번 확인해야 했습니다:

```typescript
// ❌ 기존 방식: 분기 처리 필요
const isDailyTask = dailyData?.tasks?.some(t => t.id === taskId);
if (isDailyTask) {
  await updateTask(taskId, updates);
} else {
  await updateInboxTask(taskId, updates);
}
```

## 해결

`unifiedTaskService.ts`는 저장소 위치를 자동 감지합니다:

```typescript
// ✅ 통합 서비스 사용
import { updateAnyTask } from '@/data/repositories';

await updateAnyTask(taskId, updates); // 저장소 자동 감지
```

## API

### CRUD

```typescript
import {
  updateAnyTask,
  deleteAnyTask,
  toggleAnyTaskCompletion,
  getAnyTask,
} from '@/data/repositories';

// 업데이트
await updateAnyTask(taskId, { text: 'updated' });

// 삭제
await deleteAnyTask(taskId);

// 완료 토글
await toggleAnyTaskCompletion(taskId);

// 조회
const task = await getAnyTask(taskId);
```

### 벌크 조회

```typescript
import { getAllActiveTasks, getUncompletedTasks } from '@/data/repositories';

// 모든 활성 작업 (dailyData + inbox)
const allTasks = await getAllActiveTasks('2024-01-15');

// 미완료 작업만
const pending = await getUncompletedTasks();
```

### 위치 확인

```typescript
import { findTaskLocation } from '@/data/repositories';

const { location, task, date } = await findTaskLocation(taskId);
// location: 'daily' | 'inbox' | 'not_found'
```

## 성능 힌트

`dateHint` 파라미터를 전달하면 DailyData 검색 범위를 좁혀 성능이 향상됩니다:

```typescript
// 날짜를 알고 있으면 힌트로 전달
await updateAnyTask(taskId, updates, '2024-01-15');
```

## 사용 사례

- **통합 검색**: 모든 작업에서 키워드 검색 시
- **드래그 앤 드롭**: inbox ↔ dailyData 간 이동 시
