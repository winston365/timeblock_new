# Handler 패턴

작업 완료 시 발생하는 복잡한 사이드 이펙트를 관리하는 Handler Chain 패턴입니다.

## 개요

작업을 완료하면 여러 가지 일이 동시에 발생합니다:

- 목표 진행도 업데이트
- XP 획득
- 퀘스트 진행
- 동반자 호감도 증가
- 타임블록 상태 변경

이 모든 것을 하나의 함수에서 처리하면 복잡해지고 유지보수가 어렵습니다.

## 솔루션: Handler Chain

단일 책임 원칙(SRP)에 따라 각 사이드 이펙트를 별도의 핸들러로 분리합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    Task Completed Event                     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  GoalProgressHandler                         │
│                  (목표 진행도 업데이트)                        │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    XPRewardHandler                           │
│                  (XP 계산 및 지급)                            │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  QuestProgressHandler                        │
│                  (일일 퀘스트 갱신)                           │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  WaifuAffectionHandler                       │
│                  (동반자 호감도 증가)                         │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  BlockCompletionHandler                      │
│                  (타임블록 완료 처리)                         │
└─────────────────────────────────────────────────────────────┘
```

## 구현

### 핸들러 인터페이스

```typescript
// src/shared/services/gameplay/taskCompletion/types.ts

interface TaskCompletionContext {
  task: Task;
  date: string;
  timeBlock: TimeBlock;
  gameState: GameState;
}

interface TaskCompletionResult {
  xpAwarded?: number;
  questsUpdated?: string[];
  affectionGained?: number;
  blockStatus?: BlockStatus;
}

interface TaskCompletionHandler {
  name: string;
  handle(
    context: TaskCompletionContext
  ): Promise<Partial<TaskCompletionResult>>;
}
```

### 핸들러 구현 예시

```typescript
// handlers/XPRewardHandler.ts

export class XPRewardHandler implements TaskCompletionHandler {
  name = 'XPRewardHandler';
  
  async handle(context: TaskCompletionContext) {
    const { task } = context;
    
    // 난이도와 시간에 따른 XP 계산
    const baseXP = task.adjustedDuration * 2;
    const resistanceBonus = this.getResistanceBonus(task.resistance);
    const xpAwarded = Math.floor(baseXP * resistanceBonus);
    
    // 게임 상태 업데이트
    await gameStateStore.addXP(xpAwarded);
    
    return { xpAwarded };
  }
  
  private getResistanceBonus(resistance: Resistance): number {
    switch (resistance) {
      case 'high': return 1.5;
      case 'medium': return 1.2;
      case 'low': return 1.0;
    }
  }
}
```

### 서비스에서 체인 실행

```typescript
// taskCompletionService.ts

class TaskCompletionService {
  private handlers: TaskCompletionHandler[] = [
    new GoalProgressHandler(),
    new XPRewardHandler(),
    new QuestProgressHandler(),
    new WaifuAffectionHandler(),
    new BlockCompletionHandler(),
  ];
  
  async completeTask(task: Task): Promise<TaskCompletionResult> {
    const context = await this.buildContext(task);
    const result: TaskCompletionResult = {};
    
    // 핸들러 체인 순차 실행
    for (const handler of this.handlers) {
      try {
        const handlerResult = await handler.handle(context);
        Object.assign(result, handlerResult);
      } catch (error) {
        console.error(`Handler ${handler.name} failed:`, error);
        // 개별 핸들러 실패가 전체를 막지 않음
      }
    }
    
    // 이벤트 발행
    eventBus.emit('Task:Completed', { task, result });
    
    return result;
  }
}
```

## 핸들러 목록

| 핸들러 | 역할 |
|:---|:---|
| `GoalProgressHandler` | 관련 글로벌 목표의 진행도 업데이트 |
| `XPRewardHandler` | 난이도/시간 기반 XP 계산 및 지급 |
| `QuestProgressHandler` | 일일 퀘스트 조건 체크 및 갱신 |
| `WaifuAffectionHandler` | 동반자 호감도 증가 트리거 |
| `BlockCompletionHandler` | 타임블록 Perfect/Failed 상태 결정 |

## 새 핸들러 추가하기

1. `TaskCompletionHandler` 인터페이스 구현
2. `handlers/` 폴더에 파일 생성
3. `taskCompletionService.ts`의 handlers 배열에 등록

```typescript
// handlers/NewFeatureHandler.ts

export class NewFeatureHandler implements TaskCompletionHandler {
  name = 'NewFeatureHandler';
  
  async handle(context: TaskCompletionContext) {
    // 새로운 사이드 이펙트 로직
    return { /* result */ };
  }
}

// taskCompletionService.ts에 등록
private handlers = [
  // ... 기존 핸들러
  new NewFeatureHandler(),
];
```

## 장점

1. **단일 책임** - 각 핸들러는 하나의 일만 담당
2. **테스트 용이** - 핸들러별 독립 테스트 가능
3. **확장성** - 새 기능 추가 시 기존 코드 수정 불필요
4. **격리된 실패** - 한 핸들러 실패가 전체에 영향 없음

## 다음 단계

- [Repository 패턴](/architecture/repository-pattern) - 데이터 접근 추상화
- [이벤트버스 레퍼런스](/reference/event-bus) - 이벤트 기반 통신
