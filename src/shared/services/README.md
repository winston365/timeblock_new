# Services

비즈니스 로직 및 도메인 서비스 모음

## 📁 서비스 구조

```
services/
├── ai/                          # AI 통합 서비스
│   └── gemini/                 # Google Gemini API
│       ├── apiClient.ts        # API 호출
│       ├── personaPrompts.ts   # 페르소나 프롬프트
│       ├── taskFeatures.ts     # 작업 분해, 추천
│       └── types.ts
│
├── rag/                         # RAG (Retrieval-Augmented Generation)
│   ├── hybridRAGService.ts     # ⭐ 메인 서비스
│   ├── queryParser.ts          # 자연어 쿼리 파싱
│   ├── directQueryService.ts   # 직접 쿼리
│   ├── vectorStore.ts          # 벡터 검색 (Orama)
│   ├── autoTagService.ts       # 자동 태그 추천
│   └── ragService.ts           # 벡터 RAG (보조)
│
├── sync/                        # Firebase 동기화
│   └── firebase/
│       ├── syncCore.ts         # 동기화 핵심 로직
│       ├── strategies.ts       # 데이터별 동기화 전략
│       ├── conflictResolver.ts # 충돌 해결
│       └── syncRetryQueue.ts   # 재시도 큐
│
├── gameplay/                    # 게임화 비즈니스 로직
│   ├── taskCompletion/         # 작업 완료 처리
│   │   ├── taskCompletionService.ts
│   │   └── handlers/
│   │       ├── xpRewardHandler.ts
│   │       ├── questProgressHandler.ts
│   │       ├── goalProgressHandler.ts
│   │       ├── waifuAffectionHandler.ts
│   │       └── blockCompletionHandler.ts
│   └── xpCalculation.ts        # XP 계산 로직
│
├── behavior/                    # 사용자 행동 추적
│   └── behaviorTrackingService.ts
│
├── media/                       # 미디어 관리
│   └── mediaService.ts
│
└── imageStorageService.ts       # 이미지 저장소
```

## 🎯 서비스 레이어 역할

### 아키텍처 계층

```
┌─────────────────────────────────────────────────┐
│              UI Components                      │
└────────────────┬────────────────────────────────┘
                 │ (call)
                 ▼
┌─────────────────────────────────────────────────┐
│              Zustand Stores                     │
└────────────────┬────────────────────────────────┘
                 │ (delegate complex logic)
                 ▼
┌─────────────────────────────────────────────────┐
│               Services ⭐                        │
│  • 비즈니스 로직                                  │
│  • 복잡한 계산                                    │
│  • 외부 API 호출                                 │
│  • 데이터 변환                                    │
└────────────────┬────────────────────────────────┘
                 │ (use)
    ┌────────────┼────────────┐
    ▼            ▼            ▼
Repositories  EventBus    External APIs
```

### Store vs Service

| 역할 | Store | Service |
|------|-------|---------|
| 상태 관리 | ✅ | ❌ |
| 간단한 CRUD | ✅ | ❌ |
| Repository 호출 | ✅ | ✅ |
| 복잡한 비즈니스 로직 | ❌ | ✅ |
| 외부 API 호출 | ❌ | ✅ |
| 데이터 변환/계산 | ❌ | ✅ |
| EventBus emit | ✅ | ❌ |

## 📘 주요 서비스 상세

### 1. AI Services (`ai/`)

#### Gemini AI
- **위치**: `ai/gemini/`
- **책임**: Google Gemini API 통합
- **주요 기능**:
  - AI 채팅 응답
  - 작업 분해 (큰 작업 → 작은 단계)
  - 작업 소요 시간 예측
  - 페르소나 기반 응답 생성

**사용 예시**:
```typescript
import { callGeminiAPI, decomposeTask } from '@/shared/services/ai/gemini';

// AI 채팅
const response = await callGeminiAPI(userMessage, history, apiKey);

// 작업 분해
const subtasks = await decomposeTask('프로젝트 발표 준비', apiKey);
// ['슬라이드 개요 작성', '자료 조사', '슬라이드 제작', '발표 연습']
```

📄 상세 문서: `ai/gemini/README.md`

### 2. RAG Services (`rag/`)

#### Hybrid RAG System
- **위치**: `rag/`
- **책임**: 과거 작업 기록을 AI 대화에 컨텍스트로 제공
- **주요 기능**:
  - 자연어 쿼리 파싱
  - 구조화된 쿼리 → IndexedDB 직접 검색 (100% 정확, API 비용 0)
  - 의미 기반 쿼리 → 벡터 유사도 검색 (Orama)
  - 자동 태그 추천

**사용 예시**:
```typescript
import { hybridRAGService } from '@/shared/services/rag/hybridRAGService';

// AI 컨텍스트 생성
const context = await hybridRAGService.generateContext("11월 24일에 완료한 작업");

// 쿼리 파싱
const parsed = hybridRAGService.parseQuery("어제 완료한 작업");
// { dateFilter: "2025-11-25", completedFilter: true, queryType: "date_specific" }
```

**쿼리 유형**:
- `date_specific`: "11월 24일 완료 작업" → DirectQuery (정확)
- `semantic`: "프로그래밍 관련 작업" → Hybrid (DirectQuery + Vector)
- `stats`: "이번 주 몇 개 완료?" → Aggregation

📄 상세 문서: `rag/README.md`

### 3. Sync Services (`sync/`)

#### Firebase Synchronization
- **위치**: `sync/firebase/`
- **책임**: Firebase Realtime Database 동기화
- **주요 기능**:
  - 데이터 업로드/다운로드
  - 충돌 해결 (Last-Write-Wins)
  - 재시도 큐
  - 중복 제거

**사용 예시**:
```typescript
import { syncToFirebase } from '@/shared/services/sync/firebase/syncCore';
import { dailyDataStrategy } from '@/shared/services/sync/firebase/strategies';

// 데이터 동기화
await syncToFirebase(dailyDataStrategy, dailyData, '2025-01-17');
```

**동기화 전략**:
- Last-Write-Wins (LWW) 충돌 해결
- 재시도 큐 (실패 시 자동 재시도)
- Hash 기반 중복 제거

📄 상세 문서: `sync/firebase/README.md`

### 4. Gameplay Services (`gameplay/`)

#### Task Completion Service
- **위치**: `gameplay/taskCompletion/`
- **책임**: 작업 완료 시 모든 부수효과 처리
- **핸들러 파이프라인**:
  1. `BlockCompletionHandler` → 퍼펙트 블록 판정
  2. `GoalProgressHandler` → 목표 진행률 업데이트
  3. `XPRewardHandler` → XP 계산 및 지급
  4. `QuestProgressHandler` → 퀘스트 업데이트
  5. `WaifuAffectionHandler` → 와이푸 호감도 변경

**사용 예시**:
```typescript
import { taskCompletionService } from '@/shared/services/gameplay/taskCompletion';

const result = await taskCompletionService.handleTaskCompletion({
  task: completedTask,
  wasCompleted: false,
  date: '2025-01-17',
  blockState: currentBlockState,
  blockTasks: tasksInSameBlock,
});

console.log(`XP: ${result.xpGained}, 레벨업: ${result.levelUp}`);
```

**Handler Pattern**:
- 각 핸들러는 독립적으로 동작
- 한 핸들러의 에러가 다른 핸들러에 영향 없음
- 새 기능 추가 시 핸들러만 추가

📄 상세 문서: `gameplay/taskCompletion/README.md`

#### XP Calculation
- **위치**: `gameplay/xpCalculation.ts`
- **책임**: XP 계산 로직
- **요소**:
  - 작업 난이도 (easy, medium, hard)
  - 저항도 (low, medium, high)
  - 조정된 소요 시간

### 5. Behavior Tracking (`behavior/`)

#### Behavior Tracking Service
- **위치**: `behavior/behaviorTrackingService.ts`
- **책임**: 사용자 행동 패턴 추적
- **추적 항목**:
  - 미루기 패턴 (작업 생성 후 삭제)
  - 작업 완료율
  - 시간대별 생산성

### 6. Media Services (`media/`)

#### Media Service
- **위치**: `media/mediaService.ts`
- **책임**: 미디어 파일 관리
- **주요 기능**:
  - 이미지 압축
  - 미디어 메타데이터 추출
  - 미디어 캐싱

### 7. Image Storage Service

#### Image Storage
- **위치**: `imageStorageService.ts`
- **책임**: 이미지를 IndexedDB에 저장/로드
- **주요 기능**:
  - Base64 인코딩/디코딩
  - 이미지 압축
  - 캐싱

## 🔄 Service 호출 패턴

### 1. Store → Service
```typescript
// dailyDataStore.ts
import { taskCompletionService } from '@/shared/services/gameplay/taskCompletion';

async toggleTaskCompletion(taskId: string) {
  // ... UI 업데이트 ...

  // Service에 복잡한 로직 위임
  const result = await taskCompletionService.handleTaskCompletion(context);

  // ... EventBus emit ...
}
```

### 2. Component → Service (직접 호출)
```typescript
// GeminiChat.tsx
import { callGeminiAPI } from '@/shared/services/ai/gemini';

async function sendMessage(message: string) {
  const response = await callGeminiAPI(message, history, apiKey);
  setMessages([...messages, response]);
}
```

### 3. Service → Repository
```typescript
// taskCompletionService.ts
import { updateGoalProgress } from '@/data/repositories/globalGoalRepository';

async handleTaskCompletion(context) {
  // ... 로직 ...

  // Repository에 데이터 영속화 위임
  await updateGoalProgress(goalId, newProgress);
}
```

## ⚠️ Service 설계 원칙

### 1. 단일 책임 원칙 (SRP)
하나의 Service는 하나의 책임만 담당합니다.

```typescript
// ✅ 올바른 예
// xpCalculation.ts - XP 계산만 담당
export function calculateXP(task: Task): number {
  return task.adjustedDuration * difficultyMultiplier;
}

// ❌ 잘못된 예
// xpService.ts - 너무 많은 책임
export class XPService {
  calculateXP() { ... }
  saveToDatabase() { ... }  // Repository 역할
  showNotification() { ... } // UI 역할
}
```

### 2. Pure 함수 우선
가능한 한 Pure 함수로 구현합니다 (테스트 용이성).

```typescript
// ✅ Pure 함수
export function resolveConflictLWW(local: Data, remote: Data): Data {
  return local.updatedAt > remote.updatedAt ? local : remote;
}

// ❌ Side Effect 함수 (최소화)
export async function syncToFirebase(data: Data) {
  await firebase.ref().set(data);  // I/O
}
```

### 3. Dependency Injection
필요한 의존성은 파라미터로 주입합니다.

```typescript
// ✅ 올바른 예
export async function callGeminiAPI(
  message: string,
  history: Message[],
  apiKey: string  // DI
) {
  // ...
}

// ❌ 잘못된 예
export async function callGeminiAPI(message: string) {
  const apiKey = settingsStore.getState().geminiApiKey;  // 전역 상태 의존
}
```

### 4. 에러 처리
Service는 에러를 throw하고, 호출하는 쪽에서 처리합니다.

```typescript
// Service
export async function decomposeTask(task: string, apiKey: string) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  // ...
}

// Store/Component
try {
  const subtasks = await decomposeTask(task, apiKey);
} catch (error) {
  showToast('작업 분해 실패', 'error');
}
```

## 🧪 테스트 가이드

Service는 독립적으로 테스트 가능합니다:

```typescript
// xpCalculation.test.ts
import { calculateXP } from './xpCalculation';

describe('XP Calculation', () => {
  it('should calculate XP based on duration and difficulty', () => {
    const task = {
      adjustedDuration: 30,
      difficulty: 'medium',
    };

    const xp = calculateXP(task);
    expect(xp).toBe(15); // 30 * 0.5
  });
});
```

## 🔗 관련 모듈

- `src/shared/stores/` - 상태 관리
- `src/data/repositories/` - 데이터 영속화
- `src/shared/lib/eventBus/` - 이벤트 통신
- `src/shared/subscribers/` - 이벤트 구독자

## 📊 Service 의존성 그래프

```
┌─────────────────────────────────────────────┐
│            Stores / Components              │
└──────────────┬──────────────────────────────┘
               │ (delegate)
               ▼
┌─────────────────────────────────────────────┐
│              Services                       │
│  ┌────────────────────────────────────┐    │
│  │ AI         (Gemini API)            │    │
│  │ RAG        (Hybrid Search)         │    │
│  │ Sync       (Firebase)              │    │
│  │ Gameplay   (XP, Quest, ...)        │    │
│  │ Behavior   (Tracking)              │    │
│  └────────────────────────────────────┘    │
└──────────────┬──────────────────────────────┘
               │ (use)
   ┌───────────┼────────────┐
   ▼           ▼            ▼
Repositories  APIs    External Services
```

## 📝 새 Service 추가 가이드

1. **Service 파일 생성**
   ```typescript
   // services/myFeature/myService.ts
   export function doSomething(param: string): Result {
     // Pure 로직
     return result;
   }
   ```

2. **Store에서 호출**
   ```typescript
   // stores/myStore.ts
   import { doSomething } from '@/shared/services/myFeature/myService';

   async performAction() {
     const result = doSomething(param);
     // ...
   }
   ```

3. **README 작성**
   - 서비스 책임 명시
   - 사용 예시 제공
   - 주요 함수 설명

4. **테스트 작성**
   ```typescript
   // services/myFeature/myService.test.ts
   describe('My Service', () => {
     it('should do something', () => {
       expect(doSomething('input')).toBe('output');
     });
   });
   ```
