# EventBus

컴포넌트 간 이벤트 기반 통신을 위한 EventBus 시스템입니다.

## 개요

React 컴포넌트 트리를 벗어난 통신이 필요할 때 EventBus를 사용합니다.

```typescript
// 발행
eventBus.emit('Task:Completed', { task, xpAwarded: 150 });

// 구독
eventBus.on('Task:Completed', ({ task, xpAwarded }) => {
  showCelebration(xpAwarded);
});
```

## 위치

```
src/shared/lib/eventBus/
├── index.ts       # EventBus 클래스
└── types.ts       # 이벤트 타입 정의
```

## 이벤트 명명 규칙

`[Domain]:[Action]` 형식을 사용합니다:

```typescript
// 좋은 예
'Task:Completed'
'Block:Locked'
'Quest:Finished'
'Waifu:AffectionChanged'

// 나쁜 예
'taskCompleted'      // 도메인 구분 없음
'TASK_COMPLETED'     // 대문자 스네이크케이스
'onTaskComplete'     // on 접두사 불필요
```

## 주요 이벤트 목록

### Task 도메인

| 이벤트 | 페이로드 | 설명 |
|:---|:---|:---|
| `Task:Completed` | `{ task, xpAwarded }` | 작업 완료 |
| `Task:Created` | `{ task }` | 작업 생성 |
| `Task:Deleted` | `{ taskId }` | 작업 삭제 |
| `Task:Moved` | `{ taskId, fromBlock, toBlock }` | 블록 이동 |

### Block 도메인

| 이벤트 | 페이로드 | 설명 |
|:---|:---|:---|
| `Block:Locked` | `{ blockIndex, date }` | 블록 잠금 |
| `Block:Perfect` | `{ blockIndex, date }` | Perfect Block |
| `Block:Failed` | `{ blockIndex, date }` | 블록 실패 |

### Game 도메인

| 이벤트 | 페이로드 | 설명 |
|:---|:---|:---|
| `Game:LevelUp` | `{ level, totalXP }` | 레벨업 |
| `Game:QuestCompleted` | `{ quest }` | 퀘스트 완료 |
| `Game:XPAwarded` | `{ amount, source }` | XP 획득 |

### Waifu 도메인

| 이벤트 | 페이로드 | 설명 |
|:---|:---|:---|
| `Waifu:AffectionChanged` | `{ delta, newValue }` | 호감도 변화 |
| `Waifu:PoseUnlocked` | `{ pose }` | 포즈 해금 |
| `Waifu:MessageTriggered` | `{ message }` | 대사 트리거 |

## 사용 방법

### 이벤트 발행

```typescript
import { eventBus } from '@/shared/lib/eventBus';

// 단순 발행
eventBus.emit('Task:Completed', { 
  task: completedTask, 
  xpAwarded: 100 
});
```

### 이벤트 구독

```typescript
// 컴포넌트에서 구독
useEffect(() => {
  const unsubscribe = eventBus.on('Task:Completed', ({ xpAwarded }) => {
    showXPAnimation(xpAwarded);
  });
  
  // 클린업 필수!
  return () => unsubscribe();
}, []);
```

### 일회성 구독

```typescript
// 한 번만 실행 후 자동 해제
eventBus.once('Game:LevelUp', ({ level }) => {
  showLevelUpModal(level);
});
```

## Subscribers

전역 이벤트 핸들러는 `src/shared/subscribers/`에 정의합니다:

```
src/shared/subscribers/
├── taskSubscribers.ts     # 작업 관련 구독
├── gameSubscribers.ts     # 게임 관련 구독
├── waifuSubscribers.ts    # 동반자 관련 구독
└── index.ts               # 모든 구독자 등록
```

```typescript
// taskSubscribers.ts
export function registerTaskSubscribers() {
  eventBus.on('Task:Completed', async ({ task }) => {
    // 완료 파이프라인 실행
    await taskCompletionService.process(task);
  });
}

// index.ts (앱 시작 시 호출)
export function registerAllSubscribers() {
  registerTaskSubscribers();
  registerGameSubscribers();
  registerWaifuSubscribers();
}
```

## 미들웨어

### 로깅 미들웨어

```typescript
// 개발 환경에서 모든 이벤트 로깅
if (import.meta.env.DEV) {
  eventBus.use((event, payload) => {
    console.log(`[EventBus] ${event}`, payload);
  });
}
```

### 퍼포먼스 미들웨어

```typescript
// window.__performanceMonitor에 기록
eventBus.use((event, payload, duration) => {
  window.__performanceMonitor?.recordEvent(event, duration);
});
```

## 타입 안전성

```typescript
// types.ts
interface EventMap {
  'Task:Completed': { task: Task; xpAwarded: number };
  'Task:Created': { task: Task };
  'Block:Locked': { blockIndex: number; date: string };
  'Game:LevelUp': { level: number; totalXP: number };
  // ...
}

// 타입 안전한 emit/on
eventBus.emit<'Task:Completed'>('Task:Completed', {
  task,          // Task 타입 필수
  xpAwarded: 100 // number 타입 필수
});

eventBus.on<'Task:Completed'>('Task:Completed', (payload) => {
  // payload가 자동으로 타입 추론됨
  console.log(payload.task.title);
});
```

## 주의사항

### 1. 클린업 필수

```typescript
// ❌ 메모리 누수 발생
useEffect(() => {
  eventBus.on('Task:Completed', handler);
}, []);

// ✅ 올바른 클린업
useEffect(() => {
  const unsub = eventBus.on('Task:Completed', handler);
  return () => unsub();
}, []);
```

### 2. 무한 루프 주의

```typescript
// ❌ 무한 루프 위험
eventBus.on('Task:Completed', () => {
  // 이벤트 핸들러 내에서 동일 이벤트 발생
  eventBus.emit('Task:Completed', { ... });
});

// ✅ 가드 사용
eventBus.on('Task:Completed', ({ task }) => {
  if (task.processed) return; // 가드
  // 처리 로직
});
```

### 3. 비동기 핸들러

```typescript
// 핸들러가 async여도 emit은 기다리지 않음
eventBus.on('Task:Completed', async (payload) => {
  await saveToDatabase(payload); // 비동기
});

eventBus.emit('Task:Completed', payload);
// emit 직후 핸들러 완료를 보장하지 않음
```

## 디버깅

```javascript
// 콘솔에서 이벤트 모니터링
window.__eventBusDebug = true;

// 등록된 구독자 확인
eventBus.getSubscribers('Task:Completed');
```

## 다음 단계

- [코딩 가이드라인](/reference/coding-guidelines) - 이벤트 네이밍 규칙
- [Handler 패턴](/architecture/handler-pattern) - 이벤트와 핸들러 연계
