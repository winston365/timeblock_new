# RTDB Leak Hotfix — Changes (Path visibility artifact)

## 수정된 파일 목록 (상대경로)
- agent-output/architecture/system-architecture.md
- src/data/db/infra/syncEngine.ts
- src/data/db/infra/useAppInitialization.ts
- src/data/repositories/calendarRepository.ts
- src/features/schedule/ScheduleView.tsx
- src/features/stats/StatsModal.tsx
- src/shared/services/calendar/googleCalendarService.ts
- src/shared/services/sync/firebase/firebaseClient.ts
- src/shared/services/sync/firebase/syncCore.ts
- src/shared/services/sync/firebaseService.ts
- tests/db-access-boundary.test.ts
- tests/sync-core.test.ts

## 추가된 파일 목록 (상대경로)
- agent-output/analysis/011-firebase-rtdb-download-spike-analysis.md
- agent-output/analysis/012-firebase-rtdb-spike-high-risk-codepoints-analysis.md
- agent-output/architecture/004-firebase-rtdb-mitigation-phased-architecture-findings.md
- agent-output/critiques/008-firebase-rtdb-download-leak-pr-breakdown-critique.md
- agent-output/implementation/008-firebase-rtdb-download-leak-pr-breakdown-implementation.md
- agent-output/planning/008-firebase-rtdb-download-leak-pr-breakdown.md
- agent-output/qa/008-firebase-rtdb-download-leak-qa.md
- src/shared/services/sync/firebase/firebaseSyncLeaderLock.ts
- src/shared/services/sync/firebase/rtdbListenerRegistry.ts
- src/shared/services/sync/firebase/rtdbMetrics.ts
- tests/rtdb-listener-registry.test.ts

---

## 핵심 diff 요약 (스니펫)

### 1) RTDB 리스너 중복/누수 방지: 레지스트리(경로당 1개 onValue) 도입
```ts
// src/shared/services/sync/firebase/rtdbListenerRegistry.ts
// - 동일 path는 실제 onValue 1개만 유지
// - consumer refCount로 재사용/해제 관리
// - stopAllRtdbListeners()로 일괄 해제 지원

export function attachRtdbOnValue(db, path, handler, opts?): () => void {
  // existing: refCount++ and reuse
  // new: create single onValue and fan-out to consumers
}

export function stopAllRtdbListeners(): void {
  // unsubscribe all + clear registry
}
```

### 2) 멀티 윈도우 방지: 리더락(1개 창만 리스너 활성)
```ts
// src/shared/services/sync/firebase/firebaseSyncLeaderLock.ts
// navigator.locks 기반 소프트 락 (미지원 환경에서는 리더로 간주)

export async function acquireFirebaseSyncLeaderLock(): Promise<FirebaseSyncLeaderHandle> {
  // isLeader 판정 후 release() 제공
}
```

### 3) SyncEngine 리스닝 생명주기: startListening async + stopListening + attachRtdbOnValue 사용
```ts
// src/data/db/infra/syncEngine.ts
public async startListening(): Promise<void> {
  if (this.isListening) return;
  // leader lock 획득 → 리더 아니면 리스너 스킵
  // attachRtdbOnValue(database, path, handler, { tag })로 등록
}

public stopListening(): void {
  // unsubscribe 전부 호출 + debounce 타이머 정리 + leader release
}
```

### 4) 대형 컬렉션 업로드 폭주 완화: Dexie hook 업로드 debounce
```ts
// src/data/db/infra/syncEngine.ts
// templates/shopItems/globalInbox/completedInbox syncToFirebase를 scheduleDebounced()로 래핑

private scheduleDebounced(key: string, delayMs: number, fn: () => Promise<void>): void {
  // 이전 타이머 clear → delay 후 실행
}
```

### 5) pre-get read amplification 완화: single-flight + short TTL cache
```ts
// src/shared/services/sync/firebase/syncCore.ts
// syncToFirebase() 내부의 remote pre-get을 getRemoteOnce()로 래핑
// - 2초 TTL 캐시
// - 동일 path inFlight 중복 get 병합

async function getRemoteOnce(dataRef, path): Promise<unknown> {
  // cache/inFlight 사용
}
```

### 6) Firebase App 재초기화/연결 해제 시 리스너 전부 해제
```ts
// src/shared/services/sync/firebase/firebaseClient.ts
import { stopAllRtdbListeners } from './rtdbListenerRegistry';

export function initializeFirebase(config): boolean {
  if (firebaseApp) {
    stopAllRtdbListeners();
    // deleteApp 후 재초기화
  }
}

export function disconnectFirebase(): void {
  stopAllRtdbListeners();
  // deleteApp
}
```

### 7) onValue 구독 해제 방식 정리(off 제거 → unsubscribe 사용)
```ts
// src/shared/services/sync/firebase/syncCore.ts
// src/shared/services/sync/firebaseService.ts
// firebase/database의 onValue()가 반환하는 unsubscribe를 사용

const unsubscribe = onValue(ref(db, path), (snapshot) => { /* ... */ });
return () => unsubscribe();
```

---

## 테스트 변경

### 변경된 테스트
- tests/sync-core.test.ts
  - onValue가 반환하는 unsubscribe를 사용하도록 기대값 변경(off 호출 기대 제거)
- tests/db-access-boundary.test.ts
  - 허용 경로 외부에서의 `db.*` 직접 접근을 추가로 탐지하도록 가드 강화

### 추가된 테스트
- tests/rtdb-listener-registry.test.ts
  - 동일 path에서 attach 중복 시 onValue 1회만 호출되는지, refCount에 따라 마지막 해제에서만 unsubscribe되는지 검증

### 실행한 테스트(최근)
- `npm test` (Exit Code: 0)

---

## 롤백 방법

### A) 작업 트리(커밋 전)에서 전부 원복
1) 수정 파일 되돌리기
- `git restore agent-output/architecture/system-architecture.md`
- `git restore src/data/db/infra/syncEngine.ts`
- `git restore src/data/db/infra/useAppInitialization.ts`
- `git restore src/data/repositories/calendarRepository.ts`
- `git restore src/features/schedule/ScheduleView.tsx`
- `git restore src/features/stats/StatsModal.tsx`
- `git restore src/shared/services/calendar/googleCalendarService.ts`
- `git restore src/shared/services/sync/firebase/firebaseClient.ts`
- `git restore src/shared/services/sync/firebase/syncCore.ts`
- `git restore src/shared/services/sync/firebaseService.ts`
- `git restore tests/db-access-boundary.test.ts`
- `git restore tests/sync-core.test.ts`

2) 추가된 파일 삭제
- `git clean -f agent-output/analysis/011-firebase-rtdb-download-spike-analysis.md`
- `git clean -f agent-output/analysis/012-firebase-rtdb-spike-high-risk-codepoints-analysis.md`
- `git clean -f agent-output/architecture/004-firebase-rtdb-mitigation-phased-architecture-findings.md`
- `git clean -f agent-output/critiques/008-firebase-rtdb-download-leak-pr-breakdown-critique.md`
- `git clean -f agent-output/implementation/008-firebase-rtdb-download-leak-pr-breakdown-implementation.md`
- `git clean -f agent-output/planning/008-firebase-rtdb-download-leak-pr-breakdown.md`
- `git clean -f agent-output/qa/008-firebase-rtdb-download-leak-qa.md`
- `git clean -f src/shared/services/sync/firebase/firebaseSyncLeaderLock.ts`
- `git clean -f src/shared/services/sync/firebase/rtdbListenerRegistry.ts`
- `git clean -f src/shared/services/sync/firebase/rtdbMetrics.ts`
- `git clean -f tests/rtdb-listener-registry.test.ts`

### B) 커밋된 상태에서 롤백
- 단일 커밋으로 묶여 있다면: `git revert <commit_sha>`
- 여러 커밋이면: 영향 범위를 확인 후 순차 revert (또는 해당 브랜치 폐기)

### C) “기능만 임시로 끄기” (코드 롤백 없이)
- 이번 변경은 리스너/초기 fetch 토글 UI(킬스위치)까지 포함하는 완성형이 아니므로,
  기능만 끄는 방식은 보장하지 않습니다. 안전한 임시 차단이 필요하면 롤백(A/B)을 권장합니다.
