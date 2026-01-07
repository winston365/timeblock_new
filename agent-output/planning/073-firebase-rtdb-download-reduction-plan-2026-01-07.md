---
ID: 73
Origin: 73
UUID: c2ab37f1
Status: In Progress
---

# Plan Header
- Plan ID: plan-2026-01-07-firebase-rtdb-download-reduction
- Target Release: **1.0.183** (tentative; current package.json=1.0.182)
- Epic Alignment: Firebase RTDB 비용/대역폭 절감 + Sync 안정성(중복 리스너/중복 스냅샷 제거)
- Status: In Progress

## Bandwidth Goal
- Baseline: **136MB/hour 다운로드**(현재 상태, 수용 불가)
- Target: 정상 사용 기준 **≤ 10MB/hour**, 바쁜 사용(드래그/편집 연속) 기준 **≤ 25MB/hour**
- Success definition: “작은 변경 1회”가 **서브트리 전체 재다운로드를 트리거하지 않음**

## Changelog
- 2026-01-07: Created from analysis 073; adds discovery + implementation task breakdown.
- 2026-01-07: Reformatted into an execution-first, bandwidth-focused task list with estimated reduction per task.
- 2026-01-07: BW-04 진행 — templates/shopItems/globalInbox를 `onValue` 전체 스냅샷에서 child events(`.../data`) 기반 delta 적용으로 전환(테스트 포함).

## Value Statement and Business Objective
As a local-first 사용자(특히 ADHD 사용자), I want Firebase RTDB 다운로드가 데이터 크기에 비례해 폭증하지 않게 만들고(특히 dailyData/completedInbox), so that 앱이 재시작/작은 변경에도 느려지지 않고 운영 비용/쿼터 리스크 없이 안정적으로 동기화된다.

## Objective
- (a) 루트/광범위 `onValue` 리스너로 인한 “서브트리 전체 재다운로드”를 제거한다.
- (b) 스타트업의 “bulk get + 리스너 초기 스냅샷” 중복 다운로드를 제거한다.
- (c) write path의 “get-before-set”로 발생하는 추가 read를 최소화하고, 리스너 echo와 결합된 증폭을 줄인다.
- DEV에서 리스너 이벤트당 바이트를 계측해 개선 폭을 수치로 확인한다.

## Root Causes (Confirmed in code)
- Startup double-download: [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)에서 `fetchDataFromFirebase()`로 대량 `get()` 후, 곧바로 `syncEngine.startListening()`이 RTDB 초기 스냅샷을 다시 수신
- Non-date “single-node arrays” full download: [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)의 `templates/shopItems/globalInbox`가 `onValue`로 전체 배열을 매번 다운로드 + Dexie 전체 clear/bulkPut
- Date-keyed “range onValue” re-download: [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)의 `attachRtdbOnValueKeyRange`는 범위가 좁아도 **변경 이벤트마다 범위 전체 스냅샷을 다운로드**
- Write-triggered reads: [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)의 `syncToFirebase()`가 write 전에 `getRemoteOnce()`를 호출 (특히 dailyData처럼 큰 payload는 read 증폭)
- Legacy listener risk: [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts)의 `enableFirebaseSync()`가 `users/{userId}/dailyData` 루트 `onValue`를 붙임(현재 호출부는 없어 보이나, 재활성화 시 즉시 폭주)

## Scope / Constraints
- In scope: renderer/client sync code (특히 [src/shared/services/sync/firebase/**](src/shared/services/sync/firebase/) 및 sync engine listener).
- Out of scope: Supabase/백엔드/Electron IPC 신규 구현.
- Must preserve: 현재 기능(데이터 무결성, 기존 UI 흐름, 기존 테스트 패턴) 유지.

## Assumptions
- A1: `dailyData`, `completedInbox`, `tokenUsage`는 date-keyed map 형태이며 key 정렬로 범위 쿼리(startAt/endAt)가 가능하다.
- A2: `rtdbListenerRegistry` 또는 동등한 리스너 관리 유틸이 존재하며, refCount/dedupe로 중복 attach를 방지할 수 있다.
- A3: 테스트는 Firebase mock을 사용한다(실제 RTDB bandwidth는 DEV 수동 측정으로 보완).

## OPEN QUESTION (BLOCKING)
- Q1: Target Release를 **1.0.183**으로 잡아도 현재 운영/배포 라인과 충돌이 없는가?

---

# Quick Repo Discovery (RTDB & SyncEngine Init)

## File Map (12 links)
- [src/app/AppShell.tsx](src/app/AppShell.tsx) — renderer에서 초기화 훅을 호출(부트스트랩 진입점)
- [src/app/hooks/useAppInitialization.ts](src/app/hooks/useAppInitialization.ts) — 앱 훅 re-export(경계 유지)
- [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts) — SyncEngine/RAG 등 초기화 오케스트레이션
- [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts) — SyncEngine singleton + (리더 락/가드) 중심
- [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) — RTDB 리스너 구성(루트 리스너/구독 범위 핵심)
- [src/shared/services/sync/syncEngine.ts](src/shared/services/sync/syncEngine.ts) — SyncEngine re-export(레이어 규칙 문서화)
- [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts) — 초기 bulk `get()` + 일부 `onValue()` 리스닝 경로
- [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts) — `ref/get/set/onValue` 기반 read/write core
- [src/shared/services/sync/firebase/rtdbListenerRegistry.ts](src/shared/services/sync/firebase/rtdbListenerRegistry.ts) — `onValue` unsubscribe/dedupe(중복 리스너 방지)
- [src/shared/services/sync/firebase/firebaseClient.ts](src/shared/services/sync/firebase/firebaseClient.ts) — `getDatabase` 등 Firebase RTDB 클라이언트
- [src/shared/services/sync/firebase/firebaseDebug.ts](src/shared/services/sync/firebase/firebaseDebug.ts) — RTDB `ref/get` 디버그 유틸(DEV 관측 포인트)
- [src/data/repositories/gameState/dayOperations.ts](src/data/repositories/gameState/dayOperations.ts) — RTDB `get/set/ref` 호출(레포 레벨의 원격 읽기/쓰기 후보)

### Notes
- RTDB SDK 사용은 위 파일들에서 확인됨: `onValue/ref/get/set`.
- `query(`는 “firebase/database import 기준”으로는 발견되지 않았음(미사용 가능성이 높음).

---


# Prioritized Task List (Aggressive, maximum impact)

## BW-01 — Eliminate startup double-download (remove bulk fetch or scope it)
- Objective: 부팅 시 “대량 `get()` + 리스너 초기 스냅샷”으로 같은 데이터를 2번 다운로드하는 구조를 제거한다.
- Files to modify:
  - [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)
  - [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts) (초기 fetch의 역할 재정의)
  - [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts)
- Acceptance criteria:
  - cold start에서 `fetchDataFromFirebase()`가 “대형 컬렉션(dailyData/completedInbox/tokenUsage/globalInbox/templates/shopItems)”을 다운로드하지 않는다.
  - RTDB 리스너 초기 수신과 bulk fetch가 같은 path를 중복으로 읽지 않는다(DEV 계측으로 확인).
- Risk assessment:
  - Medium: 초기 병합 로직이 바뀌며, “첫 설치 + 빈 로컬”에서 원격 데이터가 UI에 늦게 반영될 수 있음(로딩/동기화 상태 표시 필요).
- Estimated bandwidth reduction:
  - **10–30%** (재시작/다중 창 환경에서 특히 큼)

## BW-02 — Switch date-keyed range listeners from `onValue` to delta events
- Objective: `dailyData/completedInbox/tokenUsage`에서 “변경 1회 → 최근 N일 전체 스냅샷 재다운로드”를 즉시 차단한다.
- Files to modify:
  - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)
  - [src/shared/services/sync/firebase/rtdbListenerRegistry.ts](src/shared/services/sync/firebase/rtdbListenerRegistry.ts) (delta listener helper 추가/교체)
  - [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts) (윈도우 정책은 defaults 단일 출처 유지)
- Acceptance criteria:
  - date-keyed 컬렉션에서 단일 날짜 변경 시, 다운로드가 “그 날짜 노드” 수준으로만 발생한다(DEV 계측에서 확인).
  - lookback window 유지 여부와 관계없이, 이벤트 당 다운로드 바이트가 범위 전체 크기에 비례하지 않는다.
- Risk assessment:
  - Low–Medium: listener 이벤트 형태 변경으로, applyRemoteUpdate 처리 순서/중복 이벤트 처리에 주의 필요.
- Estimated bandwidth reduction:
  - **40–70%** (현재 30일 범위 전체 재다운로드가 사실이라면 상단값에 근접)

## BW-03 — Optional: per-date subscriptions (only subscribe to dates user views)
- Objective: 실제로 사용자가 보는 날짜(오늘/선택한 날짜/근접 날짜)만 구독하여 “불필요한 watch 대상”을 제거한다.
- Files to modify:
  - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) (구독 API 분리)
  - [src/shared/hooks/useDailyData.ts](src/shared/hooks/useDailyData.ts) 또는 해당 훅의 실제 구현 파일(날짜 전환 시 구독 조정)
  - [src/features/schedule/](src/features/schedule/) (날짜 탐색 UI가 있는 경우)
- Acceptance criteria:
  - 앱 시작 시 기본 구독은 “오늘(±1일 같은 작은 세트)”로 제한된다.
  - 사용자가 날짜를 이동/조회할 때만 해당 date-key 리스너가 추가된다.
- Risk assessment:
  - Medium: 구독 생명주기/캐시/빠른 날짜 이동 시 레이스 컨디션 가능.
- Estimated bandwidth reduction:
  - **5–20%** (BW-02 이후 추가 최적화; 초기 구독 범위가 현재 큰 경우에만 의미 큼)

## BW-04 — Stop full-subtree downloads for templates/shopItems/globalInbox (immediate containment)
- Objective: 현재 구조(단일 노드에 배열 저장)는 작은 변경에도 전체 배열을 재다운로드하게 만든다. “실시간 리스너 + 전체 clear/bulkPut”를 즉시 중단해 폭주를 멈춘다.
- Files to modify:
  - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)
  - [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts) (업로드 정책과의 정합성)
- Acceptance criteria:
  - `templates/shopItems/globalInbox`는 기본적으로 RTDB 실시간 리스너가 활성화되지 않는다(또는 매우 명확한 가드/플래그로만 활성화).
  - 동일 컬렉션에서 “원격 변경 1회 → 전체 배열 다운로드” 패턴이 사라진다.
- Risk assessment:
  - Medium–High(기능): 다른 디바이스의 변경이 즉시 반영되지 않을 수 있음. 단, Local-first 동작은 유지되어야 함.
- Estimated bandwidth reduction:
  - **10–40%** (사용 패턴/컬렉션 크기에 따라 편차 큼)

## BW-05 — Long-term fix for array-like collections: migrate to per-item children + child listeners
- Objective: `templates/shopItems/globalInbox`를 “배열 전체 sync”에서 “아이템 단위 delta sync”로 전환해, 변경량에 비례하는 다운로드로 만든다.
- Files to modify:
  - [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts) (전략/경로 정책)
  - [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts) (부분 업데이트/멀티 경로 업데이트 지원 필요 시)
  - [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts) (Dexie hook → per-item remote writes로 전환)
  - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) (onChildAdded/Changed/Removed 기반)
- Acceptance criteria:
  - 아이템 1개 변경 시 RTDB 다운로드는 해당 아이템만 발생한다.
  - 레거시 데이터 형식(전체 배열)과의 호환/마이그레이션 경로가 문서화되고, 롤백 가능한 단계로 나뉜다.
- Risk assessment:
  - High: 데이터 포맷 변경은 회귀/부분 업그레이드(서로 다른 버전 동시 사용) 리스크가 큼.
- Estimated bandwidth reduction:
  - **10–50%** (BW-04로 즉시 완화 후, 근본 해결로 안정화)

## BW-06 — Eliminate write-triggered reads safely (replace `getRemoteOnce` with listener-fed cache)
- Objective: 모든 write 전에 발생하는 `getRemoteOnce()` 다운로드를 제거하되, 충돌 정책(LWW/merge) 안정성은 유지한다.
- Files to modify:
  - [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
  - [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts) 및 [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) (원격 최신값 캐시 공급 지점)
- Acceptance criteria:
  - 일반 write 경로에서 네트워크 `get()` 호출이 발생하지 않는다(DEV 계측에서 확인).
  - 충돌 가능 경로는 “리스너 캐시가 있을 때만 비교” 또는 “필요 시에만 제한적 네트워크 read”처럼 정책이 명확히 분리된다.
- Risk assessment:
  - Medium: 캐시 미스/초기 상태에서 충돌 판단이 흔들릴 수 있어, 정책 분리가 필수.
- Estimated bandwidth reduction:
  - **20–60%** (dailyData/빈번 write 경로가 크면 상단값)

## BW-07 — Disable/remove legacy root listeners (`enableFirebaseSync`)
- Objective: SyncEngine 외부에서 루트 `onValue` 리스너가 붙을 가능성을 원천 차단한다.
- Files to modify:
  - [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts)
- Acceptance criteria:
  - `enableFirebaseSync`는 제거되거나, 명시적 디버그 플래그 없이는 실행되지 않는다.
  - 코드베이스에 호출부가 없음을 확인하고(현재 검색상 없음), 문서로 남긴다.
- Risk assessment:
  - Low: 현재 사용 중인 코드 경로가 아니라면 영향 최소.
- Estimated bandwidth reduction:
  - **0–20%** (현재는 “보험” 성격이지만, 실수로 켜졌을 때 폭주를 막는 가치가 큼)

## BW-08 — Add a bandwidth “circuit breaker” (guardrails)
- Objective: 회귀/버그/비정상 상태에서 다운로드가 다시 폭주할 때 자동으로 리스너를 차단해 비용을 통제한다.
- Files to modify:
  - [src/shared/services/sync/firebase/rtdbMetrics.ts](src/shared/services/sync/firebase/rtdbMetrics.ts) (이미 존재)
  - [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts) (stopListening 트리거)
  - [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts) (임계값)
- Acceptance criteria:
  - 일정 기간(예: 5분) 다운로드가 임계값을 넘으면 자동으로 리스너가 중지되고, 사용자에게 “동기화 안전모드”가 표시된다.
  - Local-first 동작은 유지되며, 사용자가 수동으로 재시도할 수 있다.
- Risk assessment:
  - Medium: 과도한 차단은 “원격 반영 지연”을 만들 수 있으므로 임계값/재시도 UX가 중요.
- Estimated bandwidth reduction:
  - **0–90%** (평상시엔 0에 가까우나, 회귀 시 비용 폭주를 강제로 컷)

---

## Testing Strategy (High-level)
- Unit: syncCore/conflictResolver/listener registry 관련 기존 테스트를 활용해 회귀를 빠르게 탐지
- Integration(smoke): SyncEngine 부팅/리스너 시작/중지 경로가 여전히 idempotent임을 확인
- Manual validation: Firebase 콘솔(Usage) + DEV 계측 로그로 “경로별 bytes”가 목표 범위로 내려갔는지 확인

## Rollback Notes
- 리스너 변경은 “컬렉션 단위”로 분리해 단계적으로 적용하고, 각 단계는 단독 revert 가능하도록 PR을 쪼갠다.

## OPEN QUESTION (Unresolved)
- Q1: 오빠, 이번 대역폭 핫픽스를 **1.0.183**으로 바로 묶을까요? 아니면 “기능 영향(특히 BW-04)”을 고려해 **1.0.183(Containment) + 1.0.184(Migration)**처럼 2단으로 갈까요?
