# Task Completion Service

작업 완료 시 발생하는 모든 부수효과(Side Effects)를 통합 관리하는 서비스

## 📁 모듈 구조

```
taskCompletion/
├── index.ts                    # Public API exports
├── taskCompletionService.ts    # 핵심 서비스 (오케스트레이터)
├── types.ts                    # TypeScript 타입 정의
└── handlers/                   # 개별 핸들러들
    ├── goalProgressHandler.ts  # 목표 진행률 업데이트
    ├── xpRewardHandler.ts      # XP 보상 지급
    ├── questProgressHandler.ts # 퀘스트 진행 처리
    ├── waifuAffectionHandler.ts # 와이푸 호감도 변경
    └── blockCompletionHandler.ts # 블록 완료/퍼펙트 처리
```

## 🎯 설계 원칙

### 단일 책임 원칙 (SRP)
각 핸들러는 **하나의 책임**만 담당합니다:
- `XPRewardHandler` → XP 계산 및 지급만
- `GoalProgressHandler` → 목표 진행률 업데이트만
- `WaifuAffectionHandler` → 와이푸 호감도 변경만

### 개방-폐쇄 원칙 (OCP)
새로운 기능 추가 시:
- ✅ 새 핸들러 파일 추가
- ✅ `taskCompletionService.ts`에 등록
- ❌ 기존 핸들러 수정 불필요

## 📘 사용 예시

### 서비스 사용

```typescript
import { taskCompletionService } from '@/shared/services/gameplay/taskCompletion';

// 작업 완료 처리
const result = await taskCompletionService.handleTaskCompletion({
  task: completedTask,
  wasCompleted: false, // 이전 완료 상태
  date: '2025-01-17',
  blockState: currentBlockState,
  blockTasks: tasksInSameBlock,
});

if (result.success) {
  console.log(`XP 획득: ${result.xpGained}`);
  console.log(`레벨업: ${result.levelUp}`);
  console.log(`퍼펙트 블록: ${result.perfectBlock}`);
  
  if (result.waifuMessage) {
    showWaifuMessage(result.waifuMessage);
  }
}
```

### 새 핸들러 추가

```typescript
// handlers/newFeatureHandler.ts
import type { TaskCompletionHandler, TaskCompletionContext } from '../types';

export class NewFeatureHandler implements TaskCompletionHandler {
  name = 'NewFeatureHandler';

  async handle(context: TaskCompletionContext) {
    const { task, wasCompleted } = context;
    
    // 완료 → 미완료 전환은 무시
    if (wasCompleted) return [];
    
    // 기능 구현
    await doSomething(task);
    
    console.log(`[${this.name}] ✅ Processed task: ${task.text}`);
    return [];
  }
}

// taskCompletionService.ts에 등록
this.handlers = [
  new GoalProgressHandler(),
  new XPRewardHandler(),
  new QuestProgressHandler(),
  new WaifuAffectionHandler(),
  new NewFeatureHandler(), // 추가
];
```

## 🔄 실행 흐름

```
dailyDataStore.toggleTaskCompletion()
    │
    ▼
taskCompletionService.handleTaskCompletion(context)
    │
    ├─▶ BlockCompletionHandler  (블록 상태 확인)
    │       └─▶ 퍼펙트 블록 달성 여부 판정
    │
    ├─▶ GoalProgressHandler     (목표 진행률)
    │       └─▶ 관련 목표 자동 업데이트
    │
    ├─▶ XPRewardHandler         (XP 보상)
    │       └─▶ gameStateStore.addXP()
    │
    ├─▶ QuestProgressHandler    (퀘스트 진행)
    │       └─▶ 'complete_tasks' 퀘스트 업데이트
    │
    └─▶ WaifuAffectionHandler   (와이푸 반응)
            └─▶ 호감도 변경, 메시지 생성
    │
    ▼
TaskCompletionResult 반환
```

## 📊 반환 결과 (TaskCompletionResult)

```typescript
interface TaskCompletionResult {
  success: boolean;
  xpGained: number;
  levelUp: boolean;
  perfectBlock: boolean;
  waifuMessage?: string;
  errors: string[];
}
```

## 🧪 테스트 용이성

각 핸들러가 독립적이므로 단위 테스트가 용이합니다:

```typescript
describe('XPRewardHandler', () => {
  it('should calculate XP based on difficulty', async () => {
    const handler = new XPRewardHandler();
    const context = createMockContext({ difficulty: 'high' });
    
    await handler.handle(context);
    
    expect(mockGameStateStore.addXP).toHaveBeenCalledWith(20); // high = 2x
  });
});
```

## 🔗 관련 모듈

- `src/shared/stores/dailyDataStore.ts` - 작업 완료 트리거
- `src/shared/stores/gameStateStore.ts` - XP/퀘스트 상태
- `src/shared/stores/waifuCompanionStore.ts` - 와이푸 상태
- `src/shared/stores/goalStore.ts` - 목표 상태

## ⚠️ 주의사항

1. **핸들러 순서**: `BlockCompletionHandler`는 항상 먼저 실행 (퍼펙트 블록 판정)
2. **에러 격리**: 한 핸들러의 에러가 다른 핸들러 실행을 막지 않음
3. **중복 호출 방지**: `wasCompleted` 상태 확인 필수
4. **EventBus 미사용**: 이 서비스는 직접 호출 패턴 사용 (Store → Service)
