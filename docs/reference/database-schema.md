# DB 스키마 레퍼런스

Dexie.js v17 데이터베이스 스키마 전체 목록입니다.

## 스키마 위치

```
src/data/db/dexieClient.ts
```

## 테이블 목록

### 핵심 데이터

#### dailyData

날짜별 작업과 타임블록 데이터의 핵심 저장소입니다.

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `date` | `string` (PK) | YYYY-MM-DD 형식 |
| `tasks` | `Task[]` | 해당 날짜의 작업 목록 |
| `blockStates` | `BlockState[]` | 6개 블록의 상태 |
| `createdAt` | `number` | 생성 timestamp |
| `updatedAt` | `number` | 수정 timestamp |

```typescript
// Task 타입
interface Task {
  id: string;
  title: string;
  estimatedDuration: number;
  adjustedDuration: number;
  resistance: 'low' | 'medium' | 'high';
  completed: boolean;
  completedAt?: number;
  timeBlockIndex: number;
  order: number;
  tags?: string[];
  linkedGoalId?: string;
}
```

#### gameState

게임 상태 (싱글톤, key: 'current')

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `key` | `string` (PK) | 항상 'current' |
| `level` | `number` | 현재 레벨 |
| `totalXP` | `number` | 누적 총 XP |
| `availableXP` | `number` | 사용 가능한 XP |
| `streak` | `number` | 연속 로그인 일수 |
| `lastLoginDate` | `string` | 마지막 로그인 날짜 |
| `quests` | `Quest[]` | 일일 퀘스트 목록 |
| `bossProgress` | `BossProgress` | 보스 레이드 진행 |

### 인박스 시스템

#### globalInbox

날짜가 지정되지 않은 작업 목록

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `number` (PK, auto) | 자동 증가 ID |
| `title` | `string` | 작업 제목 |
| `estimatedDuration` | `number` | 예상 시간 (분) |
| `resistance` | `string` | 저항도 |
| `createdAt` | `number` | 생성 timestamp |
| `tags` | `string[]` | 태그 목록 |

#### completedInbox (v7+)

완료된 인박스 작업 아카이브

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `number` (PK, auto) | 자동 증가 ID |
| `title` | `string` | 작업 제목 |
| `completedAt` | `number` (index) | 완료 timestamp |
| `originalId` | `number` | 원본 인박스 ID |

### 템플릿 & 목표

#### templates

반복 작업 템플릿

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `number` (PK, auto) | 자동 증가 ID |
| `name` | `string` (index) | 템플릿 이름 |
| `tasks` | `TemplateTask[]` | 작업 목록 |
| `autoGenerate` | `boolean` | 자동 생성 여부 |
| `recurrence` | `Recurrence` | 반복 설정 |

#### weeklyGoals (v14+)

주간 목표

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `string` (PK) | 주 식별자 (YYYY-Www) |
| `goals` | `Goal[]` | 목표 목록 |
| `createdAt` | `number` | 생성 timestamp |

### AI & 동반자

#### waifuState

동반자 상태 (싱글톤)

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `key` | `string` (PK) | 항상 'current' |
| `affection` | `number` | 호감도 (0-100) |
| `unlockedPoses` | `string[]` | 해금된 포즈 목록 |
| `interactionCount` | `number` | 상호작용 횟수 |
| `lastInteraction` | `number` | 마지막 상호작용 |

#### chatHistory

Gemini AI 대화 기록

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `number` (PK, auto) | 자동 증가 ID |
| `timestamp` | `number` (index) | 메시지 timestamp |
| `role` | `string` | 'user' \| 'assistant' |
| `content` | `string` | 메시지 내용 |
| `category` | `string` | 대화 카테고리 |

#### ragDocuments (v12+)

벡터 임베딩 저장소

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `string` (PK) | 문서 ID |
| `content` | `string` | 원본 텍스트 |
| `embedding` | `number[]` | 벡터 임베딩 |
| `metadata` | `object` | 메타데이터 |

### 시스템 & 설정

#### systemState (v6+)

시스템 상태 키-값 저장소 (localStorage 대체)

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `key` | `string` (PK) | 키 이름 |
| `value` | `any` | 저장 값 |

```typescript
// 사용 예시
await db.systemState.put({ key: 'lastTemplateGeneration', value: Date.now() });
const record = await db.systemState.get('lastTemplateGeneration');
```

#### settings (v8+)

앱 설정

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `key` | `string` (PK) | 항상 'main' |
| `geminiApiKey` | `string` | Gemini API 키 |
| `focusTimerMinutes` | `number` | 집중 타이머 시간 |
| `autoMessageInterval` | `number` | 자동 메시지 간격 |
| `dontDoChecklist` | `string[]` | 하지 않을 일 목록 |

### Google 연동 (v17+)

#### taskGoogleTaskMappings

앱 작업 ↔ Google Tasks 매핑

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `taskId` | `string` (PK) | 앱 내 작업 ID |
| `googleTaskId` | `string` (index) | Google Tasks ID |
| `googleListId` | `string` | Tasks List ID |
| `lastSyncedAt` | `number` | 동기화 timestamp |

#### tempScheduleTasks (v15+)

임시 스케줄 (타임블록 배치 전)

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `number` (PK, auto) | 자동 증가 ID |
| `title` | `string` | 일정 제목 |
| `startTime` | `string` (index) | 시작 시간 ISO |
| `endTime` | `string` | 종료 시간 ISO |
| `source` | `string` | 'manual' \| 'google' |

#### tempScheduleCalendarMappings (v17+)

임시 스케줄 ↔ Google Calendar 매핑

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `tempScheduleId` | `string` (PK) | 앱 내 ID |
| `calendarEventId` | `string` | Calendar 이벤트 ID |
| `calendarId` | `string` | Calendar ID |

### 기타

#### images (v9+)

이미지 저장소

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `string` (PK) | 이미지 ID |
| `data` | `Blob` | 이미지 데이터 |
| `type` | `string` | MIME 타입 |

#### weather (v10+)

날씨 캐시

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `string` (PK) | 위치 ID |
| `data` | `object` | 날씨 데이터 |
| `fetchedAt` | `number` | 조회 timestamp |

#### aiInsights (v11+)

AI 인사이트 캐시

| 필드 | 타입 | 설명 |
|:---|:---|:---|
| `id` | `string` (PK) | 인사이트 ID |
| `content` | `string` | 인사이트 내용 |
| `generatedAt` | `number` | 생성 timestamp |

## 마이그레이션 가이드

스키마 변경 시:

1. `dexieClient.ts`에서 버전 번호 증가
2. `.upgrade()` 함수로 마이그레이션 작성
3. 멱등성 보장 (여러 번 실행해도 동일 결과)

```typescript
db.version(18).stores({
  // 새 테이블 추가
  newTable: '++id, name'
}).upgrade(tx => {
  // 기존 데이터 마이그레이션
  return tx.table('newTable').bulkAdd([...]);
});
```

## 다음 단계

- [Zustand 스토어](/reference/zustand-stores) - 상태 관리
- [Repository 패턴](/architecture/repository-pattern) - 데이터 접근
