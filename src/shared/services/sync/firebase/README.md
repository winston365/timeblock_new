# Firebase Sync Module - 리팩토링 결과

## 📁 모듈 구조 (R5, R6, R7, R8 적용)

```
src/shared/services/firebase/
├── firebaseClient.ts      # Firebase 초기화/연결 관리 (R5, R6)
├── conflictResolver.ts    # Pure 충돌 해결 로직 (R5)
├── syncUtils.ts          # 공통 유틸리티 (R5, R8)
├── syncCore.ts           # 제네릭 동기화 코어 (R8)
└── README.md             # 이 문서
```

## 🎯 적용된 규칙

### R5: Isolate Side Effects
- **Pure 로직 분리**: `conflictResolver.ts`, `syncUtils.ts`
  - 테스트 용이, 예측 가능
  - Firebase I/O 없음
- **Side Effect 격리**: `firebaseClient.ts`, `syncCore.ts`
  - Firebase API 호출만 담당

### R6: Maintain Context Consistency
- **명확한 명명**:
  - `firebaseClient` → Firebase 연결 관리
  - `conflictResolver` → 충돌 해결 알고리즘
  - `syncCore` → 동기화 핵심 로직
  - `syncUtils` → 공통 유틸리티

### R7: Decompose Large Files
- **기존**: `firebaseService.ts` (748줄, 8개 기능)
- **분해**:
  - `firebaseClient.ts` (114줄, 1개 책임)
  - `conflictResolver.ts` (156줄, 1개 책임)
  - `syncUtils.ts` (41줄, 1개 책임)
  - `syncCore.ts` (175줄, 1개 책임)

### R8: Consolidate Duplicate Features
- **기존**: DailyData, GameState, ChatHistory, TokenUsage 동기화 로직 중복
- **통합**: `syncCore.ts`의 제네릭 함수
  - `syncToFirebase<T>(strategy, data, key)`
  - `listenToFirebase<T>(strategy, onUpdate, key)`
  - `fetchFromFirebase<T>(strategy, key)`

## 📘 사용 예시

### 1. Firebase 초기화

```typescript
import { initializeFirebase, isFirebaseInitialized } from './firebase/firebaseClient';

const config = {
  apiKey: '...',
  authDomain: '...',
  // ...
};

initializeFirebase(config);
```

### 2. 데이터 동기화 (제네릭)

```typescript
import { syncToFirebase, listenToFirebase } from './firebase/syncCore';
import type { DailyData } from '@/shared/types/domain';

// 동기화 전략 정의
const dailyDataStrategy = {
  collection: 'dailyData',
  getSuccessMessage: (data: DailyData, key?: string) =>
    `DailyData synced: ${key} (${data.tasks.length} tasks)`,
};

// 업로드
await syncToFirebase(dailyDataStrategy, myDailyData, '2025-11-15');

// 실시간 리스닝
const unsubscribe = listenToFirebase(
  dailyDataStrategy,
  (data) => console.log('Updated:', data),
  '2025-11-15'
);
```

### 3. 충돌 해결 (Pure)

```typescript
import { resolveConflictLWW, mergeGameState } from './firebase/conflictResolver';

// Last-Write-Wins
const resolved = resolveConflictLWW(localData, remoteData);

// GameState Delta Merge
const merged = mergeGameState(localGameState, remoteGameState);
```

## 🧪 테스트 용이성

### Pure 함수 (R5)
```typescript
// conflictResolver.ts - Side Effect 없음
describe('resolveConflictLWW', () => {
  it('should keep newer data', () => {
    const local = { data: {}, updatedAt: 100, deviceId: 'a' };
    const remote = { data: {}, updatedAt: 200, deviceId: 'b' };

    const result = resolveConflictLWW(local, remote);
    expect(result.updatedAt).toBe(200);
  });
});
```

### 제네릭 함수 (R8)
```typescript
// syncCore.ts - 모든 데이터 타입에 재사용
const testStrategy = { collection: 'test' };
await syncToFirebase(testStrategy, testData, 'key');
```

## 📊 리팩토링 효과

| 항목 | 기존 | 리팩토링 후 |
|-----|------|-----------|
| 파일 수 | 1개 (firebaseService.ts) | 4개 (역할별 분리) |
| 최대 파일 크기 | 748줄 | 175줄 |
| 중복 코드 | 4개 동기화 함수 중복 | 제네릭 1개로 통합 |
| 테스트 가능한 Pure 함수 | 2개 (내부 함수) | 15개+ (export) |
| 문맥 일관성 | 낮음 (8개 책임) | 높음 (1파일 1책임) |

## 🔄 마이그레이션 가이드

기존 코드:
```typescript
import { syncDailyDataToFirebase } from '@/shared/services/firebaseService';
await syncDailyDataToFirebase(date, dailyData);
```

리팩토링 후:
```typescript
import { syncToFirebase } from '@/shared/services/firebase/syncCore';
import { dailyDataStrategy } from '@/shared/services/firebase/strategies';

await syncToFirebase(dailyDataStrategy, dailyData, date);
```

## 📝 향후 작업

- [ ] `strategies.ts` 파일 생성 (데이터 타입별 전략 모음)
- [ ] `firebaseDebug.ts` 분리
- [ ] 기존 `firebaseService.ts`를 facade로 변경 (하위 호환성)
- [ ] 모든 Repository에서 제네릭 sync 사용으로 전환
- [ ] 단위 테스트 작성

## 🎓 학습 포인트

1. **관심사 분리**: Pure vs Side Effect
2. **단일 책임 원칙**: 1파일 1책임
3. **중복 제거**: 제네릭/전략 패턴
4. **명명 일관성**: Client, Resolver, Core, Utils
5. **테스트 용이성**: Pure 함수 우선
