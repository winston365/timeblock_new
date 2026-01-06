---
ID: 73
Origin: 73
UUID: c2ab37f1
Status: Active
---

# Plan Header
- Plan ID: plan-2026-01-07-firebase-rtdb-download-reduction
- Target Release: **1.0.183** (tentative; current package.json=1.0.182)
- Epic Alignment: Firebase RTDB 비용/대역폭 절감 + Sync 안정성(중복 리스너/중복 스냅샷 제거)
- Status: In Progress

## Changelog
- 2026-01-07: Created from analysis 073; adds discovery + implementation task breakdown.
- 2026-01-07: Status set to In Progress; implementation started (version/release step explicitly skipped by user).

## Value Statement and Business Objective
As a local-first 사용자(특히 ADHD 사용자), I want Firebase RTDB 다운로드가 데이터 크기에 비례해 폭증하지 않게 만들고(특히 dailyData/completedInbox), so that 앱이 재시작/작은 변경에도 느려지지 않고 운영 비용/쿼터 리스크 없이 안정적으로 동기화된다.

## Objective
- (a) 루트/광범위 `onValue` 리스너로 인한 “서브트리 전체 재다운로드”를 제거한다.
- (b) 스타트업의 “bulk get + 리스너 초기 스냅샷” 중복 다운로드를 제거한다.
- (c) write path의 “get-before-set”로 발생하는 추가 read를 최소화하고, 리스너 echo와 결합된 증폭을 줄인다.
- DEV에서 리스너 이벤트당 바이트를 계측해 개선 폭을 수치로 확인한다.

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

# Plan (10 steps)

1) RTDB 사용 지점 확정(리스너/단발 get/set) 및 변경 범위 고정
  - Files: [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts), [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts), [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
  - Acceptance criteria: “경로(path) × 이벤트(onValue/get/set) × attach 위치 × unsubscribe 경로”가 문서에 표로 정리되고, 최적화 대상 TOP 3 경로가 합의된다.
  - Vitest: `npx vitest run tests/rtdb-listener-registry.test.ts`

2) SyncEngine 초기화 흐름(언제/몇 번/어떤 조건으로) 명확화
  - Files: [src/app/AppShell.tsx](src/app/AppShell.tsx), [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts), [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts)
  - Acceptance criteria: init이 idempotent(중복 실행 시 안전)해야 하는 이유(멀티 윈도우/리로드)를 문서화하고, 실제 호출 경로(컴포넌트→훅→infra)를 명시한다.
  - Vitest: `npx vitest run tests/smoke-sync-engine-basic.test.ts`

3) (DEV-only) 다운로드 관측 지표를 추가해 “이벤트당 bytes/빈도”를 확인 가능하게 만들기
  - Files: [src/shared/services/sync/firebase/firebaseDebug.ts](src/shared/services/sync/firebase/firebaseDebug.ts), [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
  - Acceptance criteria: DEV 모드에서 RTDB read/get/onValue 이벤트에 대해 (path, eventType, estimatedBytes)가 관측 가능하고 PROD 기본값에서는 오버헤드가 없거나 최소다.
  - Vitest: `npx vitest run tests/sync-core.test.ts`

4) Startup 중복 다운로드 제거(초기 bulk get vs 초기 onValue snapshot 중복)
  - Files: [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts), [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts)
  - Acceptance criteria: 동일 경로에 대해 “부팅 직후 get + onValue 초기 스냅샷”이 중복 발생하지 않는 구조(또는 예외 경로가 명시된 구조)로 정리된다.
  - Vitest: `npx vitest run tests/smoke-sync-engine-basic.test.ts`

5) 대형 date-keyed map 컬렉션의 “루트 onValue”를 범위 제한 구독으로 축소(Phase 1: listeners only)
  - Files: [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)
  - Acceptance criteria: `dailyData/completedInbox/tokenUsage` 중 1개 이상에서 “작은 변경 → subtree 전체 재다운로드”가 발생하지 않도록 구독 범위가 축소된다(정량은 DEV 계측으로 확인).
  - Vitest: `npx vitest run tests/smoke-sync-engine-basic.test.ts`

6) 리스너 중복 attach 및 unsubscribe 정합성 강화(중복 리스너로 인한 다운로드 배수 차단)
  - Files: [src/shared/services/sync/firebase/rtdbListenerRegistry.ts](src/shared/services/sync/firebase/rtdbListenerRegistry.ts), [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)
  - Acceptance criteria: 동일 path/event 조합에 대해 subscribe가 1회만 일어나며, stop/cleanup 시 refCount/registry 상태가 0으로 복원된다.
  - Vitest: `npx vitest run tests/rtdb-listener-registry.test.ts`

7) 레거시(비-SyncEngine) 리스닝 경로가 SyncEngine과 중복되지 않도록 단일화/가드
  - Files: [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts), [src/shared/services/sync/syncEngine.ts](src/shared/services/sync/syncEngine.ts)
  - Acceptance criteria: 코드베이스에서 SyncEngine과 별도로 루트 리스너가 붙는 흐름이 제거되거나(권장) “동시에 활성화되지 않는” 가드가 명확하다.
  - Vitest: `npx vitest run tests/smoke-sync-engine-basic.test.ts`

8) write-path의 불필요 read(get-before-set) 줄이기(경로별 정책 분리)
  - Files: [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
  - Acceptance criteria: “blind write 가능한 작은 노드”는 pre-get 없이 쓰기를 허용하고, 충돌 가능 경로는 기존 정책을 유지(또는 최소 범위만 get)한다는 정책이 문서/코드에서 일관된다.
  - Vitest: `npx vitest run tests/sync-core.test.ts`

9) repository 레벨의 직접 RTDB read/write 호출이 있다면(예: 게임 상태) sync layer와 충돌하지 않게 정렬
  - Files: [src/data/repositories/gameState/dayOperations.ts](src/data/repositories/gameState/dayOperations.ts), [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts)
  - Acceptance criteria: repository의 RTDB read/write가 SyncEngine 리스너/업로드와 함께 “중복 다운로드/echo 증폭”을 만들지 않는다는 근거(가드, 문서, 또는 경로 분리)가 있다.
  - Vitest: `npx vitest run tests/sync-engine-basic.test.ts`

10) 릴리즈 버전/아티팩트 정합성(Target Release 확정 포함)
  - Files: [package.json](package.json), [agent-output/planning/073-firebase-rtdb-download-reduction-plan-2026-01-07.md](agent-output/planning/073-firebase-rtdb-download-reduction-plan-2026-01-07.md)
  - Acceptance criteria: Target Release(예: 1.0.183)가 확정되고, 릴리즈 PR/배치 정책에 맞게 버전 및 요약이 일관된다.
  - Vitest: `npm test`

# Ordered Task List (10–20)

- RDB-01 — Discovery: 과다 다운로드 발생 지점/리스너 스코프를 “정확한 심볼/호출 그래프”로 확정
  - Objective: root-level `onValue` / startup bulk reads / get-before-set 호출부를 실제 파일/함수 단위로 확정해 변경 범위를 고정한다.
  - Files/Symbols (known from analysis):
    - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) (collection root listeners)
    - [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)
    - [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts)
    - [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts)
  - Search queries (fallback):
    - `onValue(`, `onChildAdded(`, `onChildChanged(`, `off(`
    - `fetchDataFromFirebase`, `startListening`, `enableFirebaseSync`
    - `getRemoteOnce`, `syncToFirebase`, `ref(db,`, `query(`
  - Acceptance criteria:
    - 문서화된 “리스너 목록”(path, event type, query 범위, attach 위치, unsubscribe 경로)이 계획 문서에 추가된다.
  - Test plan: `npx vitest run tests/rtdb-listener-registry.test.ts` (변경 전 현행 계약 파악용)

- RDB-02 — DEV-only bandwidth instrumentation: 이벤트당 바이트/누적 바이트를 측정 가능하게 만들기
  - Objective: 어떤 리스너가 다운로드를 지배하는지 수치로 보이게 해서 최적화의 효과를 검증한다(DEV 전용).
  - Files/Symbols to touch (discover via search):
    - Search: `rtdbMetrics`, `recordRtdbGet`, `recordRtdbSet`, `instrumentation`, `syncLogger`
    - Likely areas: [src/shared/services/sync/firebase/](src/shared/services/sync/firebase/)
  - Acceptance criteria:
    - DEV 모드에서 각 RTDB 이벤트(`onValue`/`onChild*`/`get`)마다 (path, eventType, estimatedBytes, elapsedMs)이 로그/메트릭으로 남는다.
    - PROD 빌드에서는 기본적으로 비활성(성능 영향 최소)이며, 플래그로만 활성화된다.
  - Test plan: `npx vitest run tests/sync-core.test.ts` (계측 플래그 ON/OFF 분기 고정)

- RDB-03 — Startup de-duplication: “bulk fetch + initial listener snapshot” 중복을 제거
  - Objective: 앱 부팅 시 동일 데이터가 2번 다운로드되는 구조를 제거한다.
  - Files/Symbols to touch:
    - [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts) (bootstrap order)
    - [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts) (`fetchDataFromFirebase` / legacy `enableFirebaseSync`)
  - Implementation direction (non-prescriptive):
    - 큰 컬렉션(dailyData/completedInbox/tokenUsage/globalInbox 등)은 “초기 로드의 단일 소스”를 정하고, 나머지는 그에 맞춰 get 또는 listener 중 하나를 제거/지연한다.
  - Acceptance criteria:
    - DEV 계측에서 cold start 시 동일 path에 대해 `get`과 `onValue` 초기 스냅샷이 중복 계상되지 않는다(또는 small nodes만 예외로 명시).
  - Test plan: `npx vitest run tests/smoke-sync-engine-basic.test.ts`

- RDB-04 — Replace root `onValue` for date-keyed maps with range-limited queries (phase 1: listeners only)
  - Objective: `dailyData`, `completedInbox`, `tokenUsage`에서 “작은 변경 → 전체 map 재다운로드”를 없앤다.
  - Files/Symbols to touch:
    - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)
    - Search for date-range helpers: `parseDate`, `formatDate`, defaults in [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts)
  - Acceptance criteria:
    - DEV 계측 기준: 해당 컬렉션에서 단일 날짜 변경 시 다운로드 바이트가 “전체 subtree 크기”가 아니라 “해당 날짜(또는 범위) 수준”으로 떨어진다.
    - 기능 유지: 최근 범위(N days) 내의 변경은 실시간 반영된다.
  - Test plan: `npx vitest run tests/smoke-sync-engine-basic.test.ts`

- RDB-05 — Narrow query window policy: “최근 N일” 기준을 defaults에서 관리하고 UI/기능 회귀를 방지
  - Objective: “얼마나 좁힐지”를 하드코딩하지 않고 defaults로 중앙 관리하며, 회귀 리스크를 낮춘다.
  - Files/Symbols to touch:
    - [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts)
    - Search: `DEFAULT_*DAYS`, `syncWindow`, `lookback`
  - Acceptance criteria:
    - N일 값이 defaults에서만 정의되고, listener query builder가 이를 참조한다.
    - N일 범위 밖 데이터는 로컬(Dexie)에서 계속 접근 가능(기존 UX 유지)하며, 원격 실시간 동기화 범위 밖임을 문서화한다.
  - Test plan: `npx vitest run tests/temp-schedule-date-utils.test.ts` (날짜 유틸 변경 시), `npm test`

- RDB-06 — Add on-demand backfill for out-of-window dates (optional, guarded)
  - Objective: 새 설치/로컬 데이터가 비어있는 경우에도 “전체 히스토리 부재”로 기능이 깨지지 않도록 안전한 보완 경로를 둔다.
  - Files/Symbols to touch (discover):
    - Search: `Dexie`, `repositories`, `dailyData repository`, `fetchDataFromFirebase` 사용부
  - Acceptance criteria:
    - 범위 밖 날짜가 필요하다고 판단되는 경우(로컬 미존재) 한 번의 “단발성 get”로 해당 날짜/배치만 가져오고, root listener를 확장하지 않는다.
  - Test plan: `npx vitest run tests/db-access-boundary.test.ts`, `npx vitest run tests/smoke-sync-engine-basic.test.ts`

- RDB-07 — Replace root listeners for non-date collections with delta-style listeners where feasible
  - Objective: `templates`, `shopItems`, `globalInbox` 등에서 root `onValue` 대신 “child-level 이벤트(onChildAdded/onChildChanged)”로 변경 가능 여부를 평가/적용한다.
  - Files/Symbols to touch:
    - [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts)
    - Search: `globalInbox`, `templates`, `shopItems`, `onChildAdded`, `onChildChanged`
  - Acceptance criteria:
    - 작은 변경(템플릿 1개 수정 등) 시 다운로드가 subtree 전체가 아닌 단일 child 단위로 계측된다.
    - 기능 회귀(정렬/삭제/전체 리프레시 필요) 시에는 명시적으로 예외 처리하고 근거를 남긴다.
  - Test plan: `npx vitest run tests/smoke-sync-engine-basic.test.ts`, `npm test`

- RDB-08 — Unsubscribe correctness: 리스너 중복 attach 방지 및 stop/cleanup 경로를 단일화
  - Objective: 부팅/재로그인/재초기화 시 리스너가 중복으로 붙어 다운로드가 배가되는 상황을 차단한다.
  - Files/Symbols to touch (discover):
    - Search: `rtdbListenerRegistry`, `stopAll`, `unsubscribe`, `startListening(`, `stopListening(`
    - Likely tests: [tests/rtdb-listener-registry.test.ts](tests/rtdb-listener-registry.test.ts)
  - Acceptance criteria:
    - 동일 path/event/query에 대해 startListening이 여러 번 호출되어도 실제 RTDB subscribe는 1회만 발생한다.
    - cleanup 시 모든 리스너가 해제되고 registry/refCount가 0으로 돌아온다.
  - Test plan: `npx vitest run tests/rtdb-listener-registry.test.ts`

- RDB-09 — Eliminate legacy duplicate listener paths (guard/disable unused enableFirebaseSync)
  - Objective: SyncEngine 외부에서 root listener를 추가로 붙일 수 있는 레거시 경로를 제거하거나, 최소한 “동시에 켜지지 않게” 방어한다.
  - Files/Symbols to touch:
    - [src/shared/services/sync/firebaseService.ts](src/shared/services/sync/firebaseService.ts) (`enableFirebaseSync`)
    - Search: `enableFirebaseSync(` call sites
  - Acceptance criteria:
    - 코드베이스에서 `enableFirebaseSync`가 호출되지 않거나, 호출되더라도 SyncEngine 리스너와 중복되지 않는다는 보장이 있다(가드/단일화).
  - Test plan: `npx vitest run tests/sync-core.test.ts` (간접 영향), `npm test`

- RDB-10 — Write-path optimization: get-before-set 정책을 컬렉션/경로별로 분리해 불필요한 reads 제거
  - Objective: 모든 write마다 remote get을 수행하는 정책을 완화해 읽기 증폭을 줄인다.
  - Files/Symbols to touch:
    - [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts) (`syncToFirebase`, `getRemoteOnce`)
    - Search: `getRemoteOnce(`, `TTL`, `single-flight`, `resolveConflict`
  - Acceptance criteria:
    - “안전하게 blind write 가능한” 경로(예: 단일 문서/작은 노드)는 remote get 없이 set/patch 된다.
    - 충돌 위험 경로는 기존 conflictResolver 정책을 유지하거나, 필요한 최소 범위만 get 한다.
    - DEV 계측에서 write 1회당 `get` 횟수가 감소한다.
  - Test plan: `npx vitest run tests/sync-core.test.ts`, `npx vitest run tests/conflict-resolver.test.ts`

- RDB-11 — Prevent echo-amplification: listener echo를 delta 처리/ignore 정책으로 흡수
  - Objective: 로컬 write 직후 수신되는 동일 데이터 echo를 “전체 리프레시”로 처리하지 않게 한다.
  - Files/Symbols to touch (discover):
    - Search: `sameDevice`, `deviceId`, `lastWrite`, `ignoreEcho`, `originDeviceId`
    - Likely: sync engine apply logic / firebase service facade
  - Acceptance criteria:
    - 동일 device의 write echo가 들어와도 Dexie에 “중복 대량 업데이트”가 발생하지 않는다.
    - DEV 계측에서 write→echo로 인한 다운로드/처리 비용이 감소한다.
  - Test plan: `npx vitest run tests/sync-core.test.ts`, `npx vitest run tests/sync-engine-basic.test.ts || tests/smoke-sync-engine-basic.test.ts` (존재 파일 기준)

- RDB-12 — Guardrails for multi-window / re-init: 리스너 attach 조건을 명확히 하고 중복 초기화를 방지
  - Objective: 여러 창/리로드/설정 변경으로 sync init이 반복될 때 중복 다운로드가 누적되지 않게 한다.
  - Files/Symbols to touch:
    - [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)
    - Search: `initialize`, `startListening`, `firebaseConfig`, `useEffect` dependencies
  - Acceptance criteria:
    - init 경로가 idempotent(한 번만 실행되거나, 재실행 시 기존 리스너 정리 후 재구성)임이 보장된다.
  - Test plan: `npx vitest run tests/smoke-sync-engine-basic.test.ts`, `npx vitest run tests/rtdb-listener-registry.test.ts`

- RDB-13 — Documentation/Dev workflow: “어떻게 bandwidth를 확인하는지”를 개발자 문서로 남기기
  - Objective: Implementer/리뷰어가 동일한 방식으로 개선 폭을 확인할 수 있게 한다.
  - Files to touch:
    - [README.md](README.md) 또는 [docs/analysis](docs/analysis)/ 관련 문서(프로젝트 관례에 맞춰 선택)
  - Acceptance criteria:
    - DEV에서 `npm run electron:dev` 실행 후 어떤 로그/플래그로 (path별 bytes, 누적 bytes)를 확인하는지 문서화된다.
  - Test plan: `npm test`

- RDB-14 — Version & Release Artifacts
  - Objective: Target Release에 맞춰 버전/릴리즈 노트를 정리한다(배치 릴리즈 정책에 맞게).
  - Files to touch:
    - [package.json](package.json)
    - (존재 시) CHANGELOG / release notes 문서
  - Acceptance criteria:
    - Target Release 버전이 확정되고(OPEN QUESTION 해소), 릴리즈 아티팩트가 일관되게 업데이트된다.
  - Test plan: `npm test`, `npm run lint`

---

## Validation (High-level)
- Primary: `npm test`
- Focus runs:
  - `npx vitest run tests/smoke-sync-engine-basic.test.ts`
  - `npx vitest run tests/rtdb-listener-registry.test.ts`
  - `npx vitest run tests/sync-core.test.ts`
  - `npx vitest run tests/conflict-resolver.test.ts`

## Rollback Notes
- 리스너 변경은 “컬렉션 단위”로 분리해 단계적으로 적용하고, 각 단계는 단독 revert 가능하도록 PR을 쪼갠다.
