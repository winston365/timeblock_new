---
ID: 73
Origin: 73
UUID: c2ab37f1
Status: OPEN
---

# Critique: 073-firebase-rtdb-download-reduction-plan

- **Artifact Path**: agent-output/planning/073-firebase-rtdb-download-reduction-plan-2026-01-07.md
- **Critique Date**: 2026-01-07
- **Status**: Initial Review

## Changelog

| Date       | Handoff  | Request                             | Summary                                      |
|------------|----------|-------------------------------------|----------------------------------------------|
| 2026-01-07 | N/A      | Initial critique request from user | Full review with File Map and Risk sections |

---

## Value Statement Assessment

**STRONG** — Value statement이 명확하고 사용자 관점(특히 ADHD 사용자)에서 작성됨. "so that" 절이 구체적인 비즈니스 가치(속도, 비용, 쿼터 리스크)를 명시.

단, 다음이 누락됨:
- **측정 가능한 성공 기준**: "다운로드가 폭증하지 않게"는 정성적. "cold start 시 다운로드 바이트가 X% 감소" 같은 정량적 기준 필요.

---

## Overview

계획 073은 Firebase RTDB 다운로드 증폭 문제를 해결하기 위한 14개 task breakdown이다. 분석 문서(073-firebase-rtdb-download-analysis.md)에서 도출된 개선안을 실행 가능한 작업으로 변환한 것으로 보인다.

**강점**:
- Task가 Discovery → Instrumentation → Implementation → Documentation 순서로 논리적 배치
- 각 task에 Files/Symbols, Search queries, Acceptance criteria, Test plan이 명시됨
- In/Out of scope가 명확

**약점**:
- 일부 파일 경로가 실제 코드베이스와 불일치
- Instrumentation이 이미 존재하는데 RDB-02가 이를 미반영
- "최근 N일" 상수가 현재 존재하지 않음을 전제로 설명하지 않음
- 기존 테스트와의 관계가 불명확

---

## Architectural Alignment

**적합** — 계획이 repo constraint (no backend/Supabase/Electron IPC)를 준수하며, local-first + repository boundary 패턴과 일관됨.

주의사항:
- `enableFirebaseSync` 레거시 경로 제거(RDB-09)는 기존 사용처가 확인되어야 함 — 검색 결과 `firebaseService.ts`에만 정의되어 있고 호출부가 없어 보임 → **Dead code일 가능성** 확인 필요
- SyncEngine이 유일한 listener entry point임이 확인됨 (`syncEngine.startListening()` → `startRtdbListeners`)

---

## Scope Assessment

**중간 위험** — 14개 task 중 일부는 상호 의존적이며 독립 배포가 어려울 수 있음.

| Task | 의존성 | 독립 배포 가능성 |
|------|--------|-----------------|
| RDB-01 (Discovery) | 없음 | ✅ |
| RDB-02 (Instrumentation) | 없음 (이미 존재 가능) | ⚠️ 중복 확인 필요 |
| RDB-03 (Startup dedup) | RDB-01 | ❌ |
| RDB-04 (Range query) | RDB-01, RDB-05 | ❌ |
| RDB-05 (N-days policy) | 없음 | ✅ |
| RDB-06 (Backfill) | RDB-04, RDB-05 | ❌ |
| RDB-07 (Delta listeners) | RDB-01 | ⚠️ |
| RDB-08 (Unsub correctness) | 없음 | ✅ |
| RDB-09 (Legacy removal) | RDB-08 | ❌ |
| RDB-10 (Write-path opt) | 없음 | ✅ |
| RDB-11 (Echo-amplification) | RDB-10 | ❌ |
| RDB-12 (Multi-window guard) | RDB-08 | ❌ |
| RDB-13 (Documentation) | 전체 | ❌ |
| RDB-14 (Release) | 전체 | ❌ |

**권고**: 독립적으로 배포 가능한 PR 단위로 재그룹핑 필요.

---

## Technical Debt Risks

### 1. Instrumentation 중복 구현 위험
- **현황**: `rtdbMetrics.ts`가 이미 존재하며 `recordRtdbGet`, `recordRtdbSet`, `recordRtdbError`, `isRtdbInstrumentationEnabled` 함수가 구현됨
- **영향**: RDB-02가 이미 부분적으로 완료된 상태
- **권고**: RDB-02를 "확장" 또는 "확인"으로 재정의

### 2. N-days 상수 부재
- **현황**: `defaults.ts`에 `DEFAULT_*DAYS`, `syncWindow`, `lookback` 관련 상수가 없음
- **영향**: RDB-05가 "기존 상수 참조"가 아닌 "신규 상수 정의"가 됨
- **권고**: RDB-05의 scope을 명확히 하고, 상수 네이밍 컨벤션 결정 필요

### 3. 파일 경로 불일치
- **계획 언급**: `src/data/db/infra/useAppInitialization.ts`
- **실제**: 해당 파일 존재 ✅, 단 `src/app/hooks/useAppInitialization.ts`도 별도 존재
- **영향**: 두 파일 중 어느 것이 타겟인지 혼란 가능
- **권고**: 계획에서 두 파일의 역할 구분 명시 필요

---

## Findings

### Critical

#### C-01: Instrumentation 이미 존재 (Status: OPEN)

**Issue**: RDB-02에서 "이벤트당 바이트/누적 바이트를 측정 가능하게 만들기"를 목표로 하지만, `rtdbMetrics.ts`에 이미 관련 함수가 구현되어 있음.

**Evidence**:
- FILE: src/shared/services/sync/firebase/rtdbMetrics.ts
- 검색: `recordRtdbGet|recordRtdbSet|isRtdbInstrumentationEnabled`
- 테스트: tests/sync-core.test.ts 내 "RTDB Instrumentation Branch" 테스트 존재

**Impact**: 중복 작업 또는 기존 구현 미인지로 인한 regression 가능성.

**Recommendation**: RDB-02를 다음으로 재정의:
- "기존 rtdbMetrics 확인 및 DEV 콘솔 출력 확장" 또는
- "listener 이벤트당 estimatedBytes 계산 로직 추가" (현재 미구현 가능성)

---

#### C-02: enableFirebaseSync 호출부 미검증 (Status: OPEN)

**Issue**: RDB-09에서 `enableFirebaseSync` 레거시 경로 제거를 목표로 하지만, 호출부가 실제로 존재하는지 검증 결과 미포함.

**Evidence**:
- FILE: src/shared/services/sync/firebaseService.ts (line 178)
- 검색: `enableFirebaseSync\(` → firebaseService.ts 내 정의만 발견, 호출부 없음

**Impact**: Dead code 제거가 될 수 있으며, 이 경우 가드 로직 불필요.

**Recommendation**: Discovery 단계(RDB-01)에서 `enableFirebaseSync` 호출부 존재 여부를 명시적으로 확인하고, 결과에 따라 RDB-09 scope 조정.

---

### Medium

#### M-01: useAppInitialization 파일 혼동 가능성 (Status: OPEN)

**Issue**: 계획에서 `src/data/db/infra/useAppInitialization.ts`를 언급하지만, 유사한 이름의 `src/app/hooks/useAppInitialization.ts`도 존재.

**Evidence**:
- FILE: src/data/db/infra/useAppInitialization.ts
- FILE: src/app/hooks/useAppInitialization.ts
- 검색: `useAppInitialization` 또는 `fetchDataFromFirebase|startListening`

**Impact**: Implementer가 잘못된 파일을 수정할 위험.

**Recommendation**: 계획에서 두 파일의 역할 구분 명시:
- `src/data/db/infra/useAppInitialization.ts`: Firebase 초기화 + sync 시작 (RDB-03, RDB-12 타겟)
- `src/app/hooks/useAppInitialization.ts`: App-level 초기화 훅

---

#### M-02: N-days 상수 네이밍 미결정 (Status: OPEN)

**Issue**: RDB-05에서 "N일 값이 defaults에서만 정의되고..."라고 했지만, 현재 관련 상수가 존재하지 않음.

**Evidence**:
- FILE: src/shared/constants/defaults.ts
- 검색: `DEFAULT_.*DAYS|syncWindow|lookback` → 결과 없음

**Impact**: 상수 네이밍이 구현자 재량이 되어 일관성 저하 가능.

**Recommendation**: 계획에 상수 네이밍 제안 추가:
```typescript
// defaults.ts에 추가할 예시
SYNC_DEFAULTS: {
  LISTENER_WINDOW_DAYS: 30,      // 실시간 리스너 범위
  BACKFILL_BATCH_SIZE: 7,       // 백필 배치 단위
}
```

---

#### M-03: Test Plan이 기존 테스트 실행만 명시 (Status: OPEN)

**Issue**: 대부분의 task에서 Test plan이 "기존 테스트 실행"만 언급하고, 새로운 테스트 추가 여부가 불명확.

**Evidence**: RDB-04의 Test plan이 `npx vitest run tests/smoke-sync-engine-basic.test.ts`만 명시.

**Impact**: Range query 로직에 대한 새 테스트 없이 기존 테스트만으로 검증 부족.

**Recommendation**: 각 task의 Test plan을 "기존 테스트"와 "추가 테스트"로 분리:
- **기존 테스트**: 회귀 방지
- **추가 테스트**: 새 동작 검증

---

### Low

#### L-01: OPEN QUESTION 미해결 (Status: OPEN)

**Issue**: 계획에 OPEN QUESTION (Q1: Target Release 충돌 여부)이 BLOCKING으로 표시되어 있으나 해결되지 않음.

**Recommendation**: 구현 전 확인 또는 "1.0.183 확정" 결정 기록.

---

## Unresolved Open Questions

계획에 다음 OPEN QUESTION이 `[RESOLVED]`로 표시되지 않음:

1. **Q1**: Target Release를 1.0.183으로 잡아도 현재 운영/배포 라인과 충돌이 없는가?

**질문**: 이 계획을 OPEN QUESTION 미해결 상태로 구현 승인하시겠습니까, 아니면 Planner가 먼저 해결해야 합니까?

---

## Questions for Planner

1. `enableFirebaseSync`가 실제로 호출되는 곳이 있는가? Dead code라면 RDB-09를 "삭제"로 단순화 가능.
2. rtdbMetrics.ts의 현재 구현이 RDB-02 요구사항을 얼마나 충족하는가?
3. N-days 상수의 기본값(예: 30일?)과 네이밍은?
4. Range query 적용 시 "범위 밖 데이터"에 대한 UI 표시 정책은? (예: "더 보기" 버튼?)

---

## Risk Assessment

| 위험 | 확률 | 영향 | 완화책 |
|------|------|------|--------|
| Root listener 변경 시 데이터 누락 | 중 | 높음 | DEV에서 충분한 bandwidth 계측 후 적용, 단계적 롤아웃 |
| 중복 리스너 방지 로직 오류 | 낮음 | 중 | rtdb-listener-registry.test.ts 강화 |
| N-days 범위 밖 데이터 접근 실패 | 중 | 중 | RDB-06 backfill 로직 선행 구현 |
| Instrumentation 성능 영향 | 낮음 | 낮음 | PROD 기본 비활성, DEV only |

---

## Recommendations

### 즉시 조치 (구현 전)

1. **RDB-01 Discovery 확장**: `enableFirebaseSync` 호출부 확인, rtdbMetrics.ts 현황 문서화
2. **RDB-02 재정의**: "신규 구현"에서 "기존 확장/확인"으로 변경
3. **상수 네이밍 결정**: SYNC_DEFAULTS.LISTENER_WINDOW_DAYS 등 제안
4. **OPEN QUESTION Q1 해결**: Target Release 확정

### File Map 추가 권고

Planner가 계획에 다음 "File Map" 섹션을 추가하길 권고:

---

## FILE MAP (Critic 권고안)

아래는 구현 시 검사/수정할 파일 목록이다. 각 항목에 정확한 경로와 검색 쿼리를 포함.

### 1. RTDB Listener Registry

| 파일 | 용도 | 검색 쿼리 |
|------|------|-----------|
| FILE: src/shared/services/sync/firebase/rtdbListenerRegistry.ts | 리스너 등록/해제, refCount 관리 | `attachRtdbOnValue\|detachRtdbOnValue\|stopAllRtdbListeners` |
| FILE: tests/rtdb-listener-registry.test.ts | 리스너 중복 방지, stopAll 검증 | `describe.*rtdbListenerRegistry` |

### 2. Sync Engine Init

| 파일 | 용도 | 검색 쿼리 |
|------|------|-----------|
| FILE: src/data/db/infra/syncEngine/index.ts | SyncEngine 클래스, startListening/stopListening | `class SyncEngine\|startListening\|stopListening` |
| FILE: src/data/db/infra/syncEngine/listener.ts | 컬렉션별 RTDB 리스너 정의 | `startRtdbListeners\|attachRtdbOnValue.*dailyData` |
| FILE: src/data/db/infra/useAppInitialization.ts | App 부팅 시 Firebase 초기화 + sync 시작 | `fetchDataFromFirebase\|syncEngine\.startListening` |

### 3. Fetch/Write Helpers

| 파일 | 용도 | 검색 쿼리 |
|------|------|-----------|
| FILE: src/shared/services/sync/firebaseService.ts | fetchDataFromFirebase, enableFirebaseSync (레거시) | `fetchDataFromFirebase\|enableFirebaseSync` |
| FILE: src/shared/services/sync/firebase/syncCore.ts | syncToFirebase, getRemoteOnce, listenToFirebase | `syncToFirebase\|getRemoteOnce\|listenToFirebase` |

### 4. Strategies & Conflict Resolution

| 파일 | 용도 | 검색 쿼리 |
|------|------|-----------|
| FILE: src/shared/services/sync/firebase/strategies.ts | 컬렉션별 SyncStrategy 정의 | `SyncStrategy\|collection:` |
| FILE: src/shared/services/sync/firebase/conflictResolver.ts | LWW 충돌 해결 로직 | `resolveConflict\|mergeGameState\|mergeTaskArray` |
| FILE: tests/conflict-resolver.test.ts | 충돌 해결 테스트 | `describe.*conflict` |
| FILE: tests/sync-strategies-contract.test.ts | Strategy 계약 테스트 | `describe.*strategies` |

### 5. Instrumentation (기존)

| 파일 | 용도 | 검색 쿼리 |
|------|------|-----------|
| FILE: src/shared/services/sync/firebase/rtdbMetrics.ts | RTDB 계측 (이미 존재) | `recordRtdbGet\|recordRtdbSet\|isRtdbInstrumentationEnabled` |
| FILE: tests/sync-core.test.ts | Instrumentation 분기 테스트 | `RTDB Instrumentation Branch` |

### 6. Defaults

| 파일 | 용도 | 검색 쿼리 |
|------|------|-----------|
| FILE: src/shared/constants/defaults.ts | 중앙 집중 기본값 (N-days 상수 추가 대상) | `SETTING_DEFAULTS\|GAME_STATE_DEFAULTS` |

### 7. Retry Queue

| 파일 | 용도 | 검색 쿼리 |
|------|------|-----------|
| FILE: src/shared/services/sync/firebase/syncRetryQueue.ts | 실패한 sync 재시도 큐 | `addToRetryQueue\|drainRetryQueue` |
| FILE: tests/sync-retry-queue.test.ts | Retry 큐 테스트 | `describe.*syncRetryQueue` |

---

## RISK & ROLLBACK (Critic 권고안)

### 잠재적 회귀 시나리오

| 시나리오 | 트리거 | 증상 | 탐지 방법 |
|----------|--------|------|-----------|
| R-01: 실시간 업데이트 누락 | Root listener → range query 변경 | N일 이전 데이터 변경이 반영 안 됨 | DEV에서 "범위 밖 날짜" 수정 후 다른 기기 확인 |
| R-02: Startup 데이터 불완전 | Bulk fetch 제거 후 listener만 의존 | Cold start 시 일부 컬렉션 누락 | E2E: 새 설치 후 모든 컬렉션 로드 확인 |
| R-03: 리스너 중복 attach | refCount 로직 오류 | 다운로드 배수 증가 | rtdbMetrics에서 동일 path 중복 attach 로그 |
| R-04: Echo amplification | deviceId 비교 로직 누락 | 로컬 write 후 불필요한 re-apply | syncLogger에서 "same device" 로그 |
| R-05: Multi-window 충돌 | init idempotency 실패 | 여러 창에서 중복 리스너 | getActiveRtdbListenerCount() > 예상값 |

### Rollback 전략

1. **컬렉션 단위 롤아웃**: 각 컬렉션(dailyData, completedInbox, tokenUsage)에 대한 변경을 독립 PR로 분리
2. **Feature flag 고려**: `SYNC_DEFAULTS.USE_RANGE_QUERIES` 같은 플래그로 런타임 토글 가능하게
3. **Revert 가능한 PR 구조**: 각 PR이 독립적으로 revert 가능하도록 상호 의존성 최소화

### 보호 장치

| 장치 | 위치 | 목적 |
|------|------|------|
| `rtdb-listener-registry.test.ts` | tests/ | 리스너 중복 방지, stopAll 검증 |
| `smoke-sync-engine-basic.test.ts` | tests/ | Sync engine 기본 동작 검증 |
| `sync-core.test.ts` | tests/ | getRemoteOnce, syncToFirebase, instrumentation |
| DEV rtdbMetrics 로그 | 콘솔 | 경로별 다운로드 바이트 실시간 확인 |

### 권장 테스트 추가

1. **Range query 경계 테스트**: `tests/sync-range-query.test.ts` (신규)
   - N일 경계의 데이터가 올바르게 포함/제외되는지
   - 타임존 경계 케이스

2. **Startup dedup 테스트**: `tests/startup-dedup.test.ts` (신규)
   - Cold start 시 동일 path에 get + onValue 중복 호출 없음 확인

3. **Echo filtering 테스트**: 기존 `sync-core.test.ts` 확장
   - 동일 deviceId의 snapshot이 무시되는지

---

## Vitest Target Summary

계획 검증을 위한 필수 테스트 타겟:

```bash
# 회귀 방지 (기존)
npx vitest run tests/rtdb-listener-registry.test.ts
npx vitest run tests/smoke-sync-engine-basic.test.ts
npx vitest run tests/sync-core.test.ts
npx vitest run tests/conflict-resolver.test.ts
npx vitest run tests/sync-strategies-contract.test.ts
npx vitest run tests/sync-retry-queue.test.ts

# 전체 suite
npm test
```

새 테스트 추가 시:
```bash
# Range query (RDB-04, RDB-05)
npx vitest run tests/sync-range-query.test.ts  # 신규

# Startup dedup (RDB-03)
npx vitest run tests/startup-dedup.test.ts     # 신규
```

---

## Revision History

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2026-01-07 | Initial critique |

---

## Approval Status

- [ ] OPEN QUESTION Q1 해결됨
- [ ] C-01 (Instrumentation 중복) 해결됨
- [ ] C-02 (enableFirebaseSync 호출부) 확인됨
- [ ] M-01 (파일 혼동) 명확화됨
- [ ] M-02 (상수 네이밍) 결정됨
- [ ] M-03 (Test plan) 구체화됨

**현재 상태**: 구현 전 Planner 수정 필요
