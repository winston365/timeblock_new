# Firebase 동기화

TimeBlock Planner의 클라우드 동기화 아키텍처입니다.

## 동기화 개요

```
┌────────────────────────────────────────────────────────────┐
│                     Sync Pipeline                          │
│                                                            │
│  Local Change → syncCore → Strategy → Firebase RTDB       │
│                     ↓                                      │
│              Conflict Resolution (LWW)                     │
│                     ↓                                      │
│              Retry Queue (실패 시)                          │
└────────────────────────────────────────────────────────────┘
```

## 핵심 모듈

### 위치

```
src/shared/services/sync/firebase/
├── syncCore.ts          # 동기화 파이프라인 핵심
├── strategies.ts        # 데이터 타입별 전략
├── conflictResolver.ts  # 충돌 해결 (LWW)
├── syncRetryQueue.ts    # 실패한 동기화 재시도
└── syncLogger.ts        # 동기화 로그
```

### syncCore.ts

동기화 파이프라인의 중심입니다:

```typescript
// 동기화 흐름
async function syncToFirebase<T>(
  data: T,
  strategy: SyncStrategy<T>
): Promise<SyncResult> {
  // 1. 해시 비교로 변경 감지
  const hash = calculateHash(data);
  if (hash === lastSyncedHash) {
    return { status: 'skipped', reason: 'no-change' };
  }
  
  // 2. 전략에 따라 Firebase 경로 결정
  const path = strategy.getPath(data);
  
  // 3. 충돌 감지 및 해결
  const resolved = await conflictResolver.resolve(data, path);
  
  // 4. Firebase에 쓰기
  try {
    await firebase.database().ref(path).set(resolved);
    return { status: 'success' };
  } catch (error) {
    // 5. 실패 시 재시도 큐에 추가
    syncRetryQueue.enqueue({ data, strategy, error });
    return { status: 'queued' };
  }
}
```

## Strategy Pattern

각 데이터 타입마다 동기화 전략을 정의합니다:

```typescript
// strategies.ts

interface SyncStrategy<T> {
  getPath(data: T): string;
  serialize(data: T): FirebaseData;
  deserialize(raw: FirebaseData): T;
  merge(local: T, remote: T): T;
}

// 예: dailyData 전략
const dailyDataStrategy: SyncStrategy<DailyData> = {
  getPath: (data) => `users/${uid}/dailyData/${data.date}`,
  serialize: (data) => ({ ...data, updatedAt: Date.now() }),
  deserialize: (raw) => parseDailyData(raw),
  merge: (local, remote) => 
    local.updatedAt > remote.updatedAt ? local : remote
};
```

## 충돌 해결 (LWW)

**Last-Write-Wins** 알고리즘을 사용합니다:

```typescript
// conflictResolver.ts

async function resolve<T>(
  local: T & { updatedAt: number },
  remotePath: string
): Promise<T> {
  const remote = await firebase.database().ref(remotePath).get();
  
  if (!remote.exists()) {
    return local; // 원격에 없으면 로컬 사용
  }
  
  const remoteData = remote.val();
  
  // 타임스탬프 비교
  if (local.updatedAt >= remoteData.updatedAt) {
    return local;
  }
  
  return remoteData; // 원격이 더 최신
}
```

## 재시도 큐

실패한 동기화는 지수 백오프로 재시도합니다:

```typescript
// syncRetryQueue.ts

class SyncRetryQueue {
  private queue: SyncJob[] = [];
  private maxRetries = 5;
  
  enqueue(job: SyncJob) {
    this.queue.push({
      ...job,
      retryCount: 0,
      nextRetryAt: Date.now() + 1000
    });
    this.scheduleProcessing();
  }
  
  private async processJob(job: SyncJob) {
    try {
      await syncCore.sync(job.data, job.strategy);
      this.removeFromQueue(job);
    } catch (error) {
      if (job.retryCount < this.maxRetries) {
        // 지수 백오프: 1s, 2s, 4s, 8s, 16s
        job.retryCount++;
        job.nextRetryAt = Date.now() + (1000 * Math.pow(2, job.retryCount));
      } else {
        this.markAsFailed(job);
      }
    }
  }
}
```

## 서버 사이드 템플릿 생성

매일 00:00 KST에 Firebase Cloud Function이 템플릿에서 작업을 자동 생성합니다:

```javascript
// functions/index.js

exports.generateDailyTasks = functions.pubsub
  .schedule('0 0 * * *')
  .timeZone('Asia/Seoul')
  .onRun(async (context) => {
    const users = await getActiveUsers();
    
    for (const user of users) {
      const templates = await getAutoGenerateTemplates(user.uid);
      await generateTasksFromTemplates(user.uid, templates);
    }
  });
```

::: warning 중요
클라이언트는 템플릿에서 직접 작업을 생성하지 않습니다. Firebase를 observe하고 서버가 생성한 작업을 읽기만 합니다.
:::

## 디버깅

### SyncLogModal

```
Settings → Sync → Sync Log
```

### 콘솔 로그

```typescript
// dev 환경에서 syncLogger 활성화
import { syncLogger } from '@/shared/services/sync/firebase/syncLogger';

syncLogger.enable();
// 모든 동기화 이벤트가 콘솔에 출력됨
```

## 데이터 구조 수정 시 체크리스트

데이터 구조를 변경할 때 **세 곳 모두** 업데이트해야 합니다:

1. ✅ Dexie 스키마 (`src/data/db/dexieClient.ts`)
2. ✅ Repository (`src/data/repositories/`)
3. ✅ Sync Strategy (`src/shared/services/sync/firebase/strategies.ts`)

## 다음 단계

- [Handler 패턴](/architecture/handler-pattern) - 작업 완료 파이프라인
- [Repository 패턴](/architecture/repository-pattern) - 데이터 접근 추상화
