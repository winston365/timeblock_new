# Google Calendar 연동

TimeBlock Planner와 Google Calendar/Tasks의 양방향 동기화입니다.

## 개요

앱 내 작업과 일정을 Google 서비스와 연동합니다:

- **Google Tasks** ↔ 앱 내 '주요 작업'
- **Google Calendar** ↔ 앱 내 '임시 스케줄'

## 동기화 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    TimeBlock Planner                        │
│                                                             │
│  ┌─────────────────┐        ┌─────────────────────────┐    │
│  │   주요 작업      │        │   임시 스케줄 (Temp)     │    │
│  │   (Tasks)       │        │   (TempScheduleTasks)   │    │
│  └────────┬────────┘        └───────────┬─────────────┘    │
│           │                             │                   │
└───────────┼─────────────────────────────┼───────────────────┘
            │                             │
            ↓                             ↓
┌───────────────────────┐    ┌────────────────────────────────┐
│    Google Tasks       │    │      Google Calendar           │
│                       │    │                                │
│  - 작업 목록           │    │  - 이벤트                       │
│  - 완료 상태           │    │  - 시작/종료 시간               │
│  - 마감일              │    │  - 반복 설정                    │
└───────────────────────┘    └────────────────────────────────┘
```

## 매핑 테이블 (v17)

### taskGoogleTaskMappings

앱 작업 ↔ Google Tasks 매핑:

```typescript
interface TaskGoogleTaskMapping {
  taskId: string;        // 앱 내 작업 ID
  googleTaskId: string;  // Google Tasks ID
  googleListId: string;  // Google Tasks List ID
  lastSyncedAt: number;  // 마지막 동기화 시간
  syncStatus: 'synced' | 'pending' | 'conflict';
}
```

### tempScheduleCalendarMappings

임시 스케줄 ↔ Google Calendar 매핑:

```typescript
interface TempScheduleCalendarMapping {
  tempScheduleId: string;  // 앱 내 임시 스케줄 ID
  calendarEventId: string; // Google Calendar 이벤트 ID
  calendarId: string;      // Calendar ID (기본: 'primary')
  lastSyncedAt: number;
  syncStatus: 'synced' | 'pending' | 'conflict';
}
```

## 동기화 흐름

### 앱 → Google

```typescript
// 작업 완료 시 Google Tasks 업데이트
eventBus.on('Task:Completed', async ({ task }) => {
  const mapping = await getTaskMapping(task.id);
  if (mapping) {
    await googleTasks.update(mapping.googleTaskId, {
      status: 'completed',
      completed: new Date().toISOString()
    });
  }
});
```

### Google → 앱

```typescript
// Google Calendar 변경 감지 (Polling)
async function syncFromGoogle() {
  const events = await googleCalendar.list({
    timeMin: startOfDay,
    timeMax: endOfDay
  });
  
  for (const event of events) {
    await updateOrCreateTempSchedule(event);
  }
}
```

## 충돌 해결

양쪽에서 동시에 변경된 경우:

```typescript
// Last-Modified 기반 충돌 해결
if (localModified > googleModified) {
  // 로컬 우선 → Google에 push
  await pushToGoogle(localData);
} else {
  // Google 우선 → 로컬에 pull
  await pullFromGoogle(googleData);
}
```

## 설정

Settings에서 Google 연동을 활성화합니다:

```
Settings → Integrations → Google Account
  ├── Google Tasks 동기화: [ON/OFF]
  ├── 작업 목록 선택: [My Tasks ▼]
  ├── Google Calendar 동기화: [ON/OFF]
  └── 캘린더 선택: [Primary ▼]
```

## OAuth 인증 흐름

```
1. 사용자가 "Google 연결" 클릭
2. OAuth 동의 화면 표시
3. 권한 부여 후 Access Token 획득
4. Token을 settingsStore에 저장
5. Firebase를 통해 다른 기기와 동기화
```

::: warning 토큰 관리
Access Token은 만료될 수 있습니다. Refresh Token을 사용하여 자동 갱신합니다.
:::

## 임시 스케줄 (Temp Schedule)

타임블록에 바로 배치하지 않는 일정입니다:

```typescript
interface TempScheduleTask {
  id: string;
  title: string;
  startTime: string;  // ISO 8601
  endTime: string;
  isAllDay: boolean;
  source: 'manual' | 'google_calendar';
  calendarEventId?: string;
}
```

### UI

```
┌─────────────────────────────────────────┐
│  📅 임시 스케줄                          │
├─────────────────────────────────────────┤
│  10:00 - 11:00  팀 미팅        🔗 Google │
│  14:00 - 15:00  치과 예약      📝 수동   │
│  16:00 - 16:30  커피챗         🔗 Google │
└─────────────────────────────────────────┘
```

## 소스 코드 위치

```
src/features/tempSchedule/
├── components/
│   └── TempSchedulePanel.tsx
├── hooks/
│   └── useTempScheduleSync.ts
└── utils/
    └── googleCalendarMapper.ts

src/shared/services/
└── googleIntegration/
    ├── googleTasksService.ts
    ├── googleCalendarService.ts
    └── tokenManager.ts

src/data/repositories/
├── taskGoogleTaskMappingRepository.ts
└── tempScheduleRepository.ts
```

## 다음 단계

- [타임블로킹](/features/time-blocking) - 임시 스케줄을 블록에 배치
- [DB 스키마](/reference/database-schema) - 매핑 테이블 상세
