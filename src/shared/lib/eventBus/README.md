# Event Bus

타입 안전하고 디버깅이 쉬운 Pub/Sub 이벤트 버스

## 특징

- ✅ **타입 안전**: TypeScript로 모든 이벤트 타입 정의
- 🐛 **디버깅 친화적**: Event Logger, Performance Monitor 내장
- 🔒 **에러 격리**: 한 subscriber의 에러가 다른 subscriber에 영향 없음
- 🔄 **순환 감지**: 무한 루프 방지
- ⚡ **성능 모니터링**: 느린 핸들러 자동 감지
- 🎨 **색상 코딩**: 콘솔에서 이벤트 타입별 색상 구분

## 설치 및 초기화

```typescript
// src/app/main.tsx
import { eventBus, loggerMiddleware, performanceMiddleware } from '@/shared/lib/eventBus';

// 미들웨어 등록 (개발 환경만)
if (import.meta.env.DEV) {
  eventBus.use(loggerMiddleware);
  eventBus.use(performanceMiddleware);
}
```

## 사용법

### 1. 이벤트 발행

```typescript
import { eventBus } from '@/shared/lib/eventBus';

// Task 완료 이벤트 발행
eventBus.emit('task:completed', {
  taskId: 'task_123',
  xpEarned: 50,
  isPerfectBlock: true,
  blockId: 'morning',
  adjustedDuration: 30,
}, {
  source: 'dailyDataStore.toggleTaskCompletion',
  correlationId: 'evt_abc123',
});
```

### 2. 이벤트 구독

```typescript
import { eventBus } from '@/shared/lib/eventBus';

// Task 완료 시 XP 추가
eventBus.on('task:completed', async ({ xpEarned }) => {
  await useGameStateStore.getState().addXP(xpEarned);
});

// 일회성 구독
eventBus.once('level:up', ({ newLevel }) => {
  console.log(`Level Up! New level: ${newLevel}`);
});

// 우선순위 지정 (높을수록 먼저 실행)
eventBus.on('task:completed', handler, { priority: 10 });
```

### 3. 구독 해제

```typescript
// 특정 핸들러 제거
const unsubscribe = eventBus.on('task:completed', handler);
unsubscribe();

// 또는
eventBus.off('task:completed', handler);

// 특정 이벤트의 모든 구독 해제
eventBus.off('task:completed');
```

## 이벤트 명명 규칙

모든 이벤트는 `[domain]:[action]:[detail?]` 형식을 따릅니다.

### Task 도메인
- `task:created` - 작업 생성
- `task:updated` - 작업 수정
- `task:deleted` - 작업 삭제
- `task:completed` - 작업 완료

### Block 도메인
- `block:locked` - 블록 잠금
- `block:unlocked` - 블록 잠금 해제
- `block:perfect` - Perfect Block 달성

### XP/Level 도메인
- `xp:earned` - XP 획득
- `xp:spent` - XP 소비
- `level:up` - 레벨업

### Quest 도메인
- `quest:progress` - 퀘스트 진행
- `quest:completed` - 퀘스트 완료

### Goal 도메인
- `goal:progressChanged` - 목표 진행률 변경

### Waifu 도메인
- `waifu:message` - Waifu 메시지 표시

## Logger 출력 예시

```
🔵 [EVENT] task:completed
  ├─ Timestamp: 09:59:44.123
  ├─ Source: dailyDataStore.toggleTaskCompletion
  ├─ Payload: { taskId: "task_123", xpEarned: 50, ... }
  └─ Duration: 3.9ms
```

## Performance Monitoring

```typescript
// 콘솔에서 통계 확인
window.__performanceMonitor.printReport();

// 출력 예시:
📊 [Performance] Event Statistics
  task:completed: 15 calls, avg 3.2ms, max 8.5ms
  xp:earned: 15 calls, avg 1.1ms, max 2.3ms
  goal:progressChanged: 5 calls, avg 45.2ms, max 89.1ms ⚠️ 2 slow
```

## 커스텀 미들웨어

```typescript
import type { Middleware } from '@/shared/lib/eventBus';

const myMiddleware: Middleware = (event, payload, meta, next) => {
  console.log(`Before: ${event}`);
  next(); // 다음 미들웨어 또는 핸들러 실행
  console.log(`After: ${event}`);
};

eventBus.use(myMiddleware);
```

## 디버깅 팁

### 1. 특정 이벤트만 로깅
```typescript
import { createLoggerMiddleware } from '@/shared/lib/eventBus';

eventBus.use(createLoggerMiddleware({
  filter: (event) => event.startsWith('task:'),
}));
```

### 2. 느린 이벤트 찾기
```typescript
import { createPerformanceMiddleware } from '@/shared/lib/eventBus';

const { middleware, monitor } = createPerformanceMiddleware({
  slowThreshold: 10, // 10ms 초과 시 경고
});

eventBus.use(middleware);

// 나중에 통계 확인
monitor.printReport();
```

### 3. 이벤트 체인 추적
```typescript
// CorrelationId로 관련 이벤트 묶기
const correlationId = generateId('evt');

eventBus.emit('task:completed', payload, { correlationId });
// ... 내부적으로 다른 이벤트 발행 시 같은 correlationId 사용
```

## 주의사항

1. **순환 이벤트 방지**: Event Bus가 자동으로 감지하지만, 설계 시 순환 구조를 피하세요
2. **비동기 핸들러**: `async` 핸들러는 에러를 catch해서 처리하세요
3. **메모리 누수**: 컴포넌트 unmount 시 반드시 구독 해제하세요

```typescript
useEffect(() => {
  const unsubscribe = eventBus.on('task:completed', handler);
  return () => unsubscribe(); // cleanup
}, []);
```
