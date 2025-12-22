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

### XP 도메인
- `xp:earned` - XP 획득
- `xp:spent` - XP 소비

### Quest 도메인
- `quest:progress` - 퀘스트 진행
- `quest:completed` - 퀘스트 완료

### Goal 도메인
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
  block:perfect: 5 calls, avg 4.8ms, max 9.1ms
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

---

## ⚠️ 사용 규칙 (DO / DON'T)

EventBus는 강력한 도구이지만 오용하면 디버깅이 어려운 코드베이스를 만들 수 있습니다.  
아래 규칙을 준수하여 예측 가능하고 유지보수 가능한 코드를 유지하세요.

### ✅ DO (권장 패턴)

| 패턴 | 설명 | 예시 |
|------|------|------|
| **Store → Subscriber** | Store에서 emit, Subscriber 모듈에서 구독 | `dailyDataStore` → `xpSubscriber` |
| **Cross-cutting Concerns** | 여러 도메인에 영향을 주는 작업 | Task 완료 → XP, Waifu, Quest 업데이트 |
| **구독은 `subscribers/` 폴더에** | 중앙 집중화된 구독 관리 | `src/shared/subscribers/*.ts` |
| **명확한 이벤트 명명** | `[domain]:[action]` 형식 | `task:completed`, `block:locked` |
| **CorrelationId 사용** | 관련 이벤트 체인 추적 | 디버깅, 로깅, 성능 분석 |
| **Side Effect 분리** | 핵심 로직과 부수 효과 분리 | Task 완료(핵심) vs XP 추가(Side Effect) |

```typescript
// ✅ 올바른 예: Store에서 emit
// dailyDataStore.ts
toggleTaskCompletion() {
  // ... 핵심 로직 ...
  eventBus.emit('task:completed', { taskId, xpEarned }, { source: 'dailyDataStore' });
}

// ✅ 올바른 예: Subscriber에서 구독
// xpSubscriber.ts
export function initXpSubscriber() {
  eventBus.on('task:completed', async ({ xpEarned }) => {
    await useGameStateStore.getState().addXP(xpEarned);
  });
}
```

### ❌ DON'T (금지 패턴)

| 안티패턴 | 문제점 | 대안 |
|----------|--------|------|
| **UI 컴포넌트에서 emit** | 데이터 흐름 추적 어려움 | Store 메서드 호출 |
| **Props 대체로 사용** | 컴포넌트 간 암시적 의존성 | Props drilling, Context, Zustand |
| **렌더링 트리거** | 예측 불가능한 리렌더링 | Store 구독, useState |
| **동기적 결과 기대** | 이벤트는 fire-and-forget | 직접 함수 호출 |
| **컴포넌트 내 구독** | 라이프사이클 복잡성 | Subscriber 모듈 사용 |
| **이벤트 체인 과다** | A→B→C→D... 추적 어려움 | 최대 2-3 hop 권장 |

```typescript
// ❌ 잘못된 예: UI 컴포넌트에서 직접 emit
function TaskItem({ task }) {
  const handleClick = () => {
    // ❌ 컴포넌트에서 emit하지 마세요
    eventBus.emit('task:completed', task);
  };
  // 대신: store.toggleTaskCompletion(task.id)
}

// ❌ 잘못된 예: 렌더링을 위한 이벤트 사용
function Dashboard() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    // ❌ 이벤트로 상태 업데이트하지 마세요
    eventBus.on('stats:updated', setStats);
  }, []);
  
  // 대신: const stats = useStatsStore(s => s.stats)
}

// ❌ 잘못된 예: 반환값 기대
async function completeTask() {
  // ❌ 이벤트는 결과를 반환하지 않습니다
  const result = eventBus.emit('task:complete', data);
  // 대신: const result = await taskService.complete(data)
}
```

### 📐 아키텍처 원칙

```
┌─────────────────────────────────────────────────────────────┐
│                        적합한 사용처                          │
├─────────────────────────────────────────────────────────────┤
│  • 여러 도메인에 영향을 미치는 Side Effects                    │
│  • Fire-and-forget 패턴 (결과 불필요)                         │
│  • Cross-cutting Concerns (로깅, 분석, 게이미피케이션)          │
│  • 느슨한 결합이 필요한 모듈 간 통신                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      부적합한 사용처                          │
├─────────────────────────────────────────────────────────────┤
│  • 컴포넌트 간 직접 데이터 전달 → Props, Context 사용          │
│  • UI 렌더링 트리거 → Zustand Store 구독 사용                  │
│  • 동기적 결과가 필요한 작업 → 직접 함수 호출                   │
│  • 단순 부모-자식 통신 → Props, Callbacks 사용                 │
└─────────────────────────────────────────────────────────────┘
```

### 🔍 현재 프로젝트의 EventBus 사용 현황

```
발행처 (emit):
├─ dailyDataStore.ts     → task:completed, block:locked
└─ inboxStore.ts         → task:created (inbox에서)

구독처 (subscribers/):
├─ xpSubscriber.ts       → XP 추가 로직
├─ waifuSubscriber.ts    → Waifu 반응 로직
├─ gameStateSubscriber.ts → 게임 상태 업데이트
└─ googleSyncSubscriber.ts → Google Calendar 동기화
```

> **핵심 원칙**: EventBus는 "누군가 이걸 했다"를 알리는 용도입니다.  
> "이걸 해달라"는 요청에는 직접 함수/메서드 호출을 사용하세요.
