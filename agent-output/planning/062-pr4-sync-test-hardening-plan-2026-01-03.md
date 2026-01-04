---
ID: 62
Origin: 62
UUID: e7f4c8a2
Status: Active
---

# Plan: PR4 — Sync 테스트 강화 (2026-01-03)

- Target Release: **1.0.182** (상위 배치: agent-output/planning/058-foundation-pr-breakdown-no-doc-deps-2026-01-03.md; 현재 package.json=1.0.181)
- Epic Alignment: Sync reliability hardening (offline→online, TTL/계측, 전략 계약, 리스너 생명주기)
- Status: Active

## Changelog
- 2026-01-03: Created plan from analysis 062; prioritizes HIGH→MED→LOW and preserves existing test structure.

## Value Statement and Business Objective
As a 사용자(오빠), I want 동기화가 네트워크/충돌/리스너 이슈가 있어도 “조용히 망가지지 않게” 자동화 테스트로 보호되길, so that 일정/작업 데이터가 안정적으로 유지되고 ADHD 사용자에게 예측 가능한 경험을 제공한다.

## Objective
- PR4 범위에서 **동작 변경 없이** sync 관련 고위험 경로를 테스트로 고정한다.
- 각 Task는 단독 실행/검증 가능하도록 독립성을 유지한다(기존 테스트 파일 구조/패턴 유지).

## Scope / Constraints
- In scope: tests/*sync*, tests/conflict-resolver.test.ts, tests/rtdb-listener-registry.test.ts, tests/smoke-sync-engine-basic.test.ts, (필요 시 최소한의 testability 개선)
- Out of scope: Firebase 실제 호출(항상 mock), Sync 전략/동작 변경, Electron IPC/백엔드 구현
- Must hold: 기존 테스트 구조 유지, `npm test` 게이트 통과, flaky 테스트 금지(타이머/비동기 제어 표준화)

## Assumptions
- A1: Firebase RTDB 호출은 기존 테스트와 동일한 mock 패턴을 사용한다.
- A2: 시간 기반(TTL=2초 등)은 fake timers 또는 시간 주입 방식으로 안정적으로 검증 가능하다.
- A3: PR4 단독으로 버전 bump는 수행하지 않는다(상위 배치 PR7에서 처리).

## OPEN QUESTION (REQUIRES ANALYSIS; before implementing T80-03)
- Q1: “오프라인→온라인 재연결” 시점에 `drainRetryQueue`를 호출하는 오케스트레이터가 실제로 어디에 있는가?
  - 후보: firebaseService(enableFirebaseSync/initialize), sync 엔진 초기화 흐름, 또는 UI/Store 레벨.
  - 결정: **실제 프로덕션 경로를 따라가는 테스트(통합)** vs **명시적 트리거 유틸을 단위로 검증** 중 선택 필요.

---

## PR4 구현 계획

### Task T80-01: getRemoteOnce 단일 비행(in-flight) + 2초 TTL 캐시 동작 검증
- 대상: tests/sync-core.test.ts
- 작업:
  1. 동일 path에 대해 짧은 간격으로 연속 호출 시, 실제 RTDB get이 1회만 발생하는지(단일 비행) 검증한다.
  2. 2초 TTL 내 재호출은 캐시로 처리되고, TTL 이후에는 재조회가 발생하는지를 검증한다.
  3. 타이머/시간 제어는 flaky를 피하기 위해 프로젝트 표준(fakes)로 통일한다.
- 검증: npm test 통과

### Task T80-02: RTDB instrumentation 분기(recordRtdbGet/Set/Error) 검증
- 대상: tests/sync-core.test.ts
- 작업:
  1. instrumentation 활성화 플래그 ON/OFF 각각에서 계측 함수가 호출/미호출되는 계약을 검증한다.
  2. get 성공/실패, set 성공/실패 각각에서 record 계측이 올바른 분기로 호출되는지 검증한다.
  3. 계측은 “테스트에서만 관찰”하고 제품 동작/전략 로직은 변경하지 않는다.
- 검증: npm test 통과

### Task T80-03: 오프라인→온라인 재연결 시 retry queue 드레인(drainRetryQueue) 소모 검증
- 대상: tests/sync-retry-queue.test.ts, tests/sync-core.test.ts 또는 tests/smoke-sync-engine-basic.test.ts
- 작업:
  1. 네트워크 실패를 모사해 write가 retry queue에 enqueue되는 흐름을 재현한다.
  2. “재연결 트리거” 발생 시 drainRetryQueue가 호출되고 큐가 성공적으로 소모되는지(성공/실패 카운트 및 잔여 항목 유무) 검증한다.
  3. 구현 위치(어디서 drain을 호출하는지)는 Q1 분석 결과에 맞춰 테스트 레벨(단위 vs 시나리오)을 선택한다.
- 검증: npm test 통과

### Task T80-04: strategies.ts 전략 매핑/직렬화 계약 테스트
- 대상: tests (신규 권장: tests/sync-strategies-contract.test.ts)
- 작업:
  1. 전략의 collection name 매핑이 의도된 문자열로 고정되는지 검증한다(변경 시 테스트가 깨지도록).
  2. strategy별 resolveConflict/serialize가 “정해진 입력 형태를 받아 일관된 출력 형태를 만든다”는 계약을 검증한다.
  3. Firebase 호출 없이, 순수 계약 테스트로 구성한다.
- 검증: npm test 통과

### Task T80-05: firebaseService facade 초기 로드/리스너 필터(동일 device 무시) 검증
- 대상: tests (신규 권장: tests/firebase-service-sync-facade.test.ts)
- 작업:
  1. fetchDataFromFirebase가 SyncData 형태를 올바르게 unwrap(또는 방어적으로 무시)하는지 검증한다.
  2. enableFirebaseSync(또는 리스너 연결부)에서 same-device 이벤트를 무시하는 필터가 유지되는지 검증한다.
  3. RTDB snapshot/onValue는 기존 패턴대로 mock 처리한다.
- 검증: npm test 통과

### Task T80-06: rtdbListenerRegistry 예외 격리 + stopAllRtdbListeners + 계측 분기 검증
- 대상: tests/rtdb-listener-registry.test.ts
- 작업:
  1. consumer 콜백이 예외를 던져도 다른 consumer/리스너 관리가 깨지지 않는지(예외 격리) 검증한다.
  2. stopAllRtdbListeners가 모든 리스너를 정리하고 refCount/registry 상태가 정상화되는지 검증한다.
  3. (존재 시) 계측/로깅 분기가 최소 1회 이상 테스트로 진입되도록 구성한다.
- 검증: npm test 통과

### Task T80-07: conflictResolver 창 제약(5일/50개 캡) 회귀 보호
- 대상: tests/conflict-resolver.test.ts
- 작업:
  1. timeBlockXPHistory 병합이 5일 창 제약을 준수하는지 검증한다.
  2. completedTasksHistory 병합 결과가 50개 제한을 초과하지 않음을 검증한다.
  3. 결정성(determinism)이 유지되는지 확인한다(같은 입력→같은 출력).
- 검증: npm test 통과

### Task T80-08: syncLogger MAX_LOGS 한도 + 에러 경로(방어) 검증
- 대상: tests/sync-logger.test.ts
- 작업:
  1. 로그가 최대 보관 한도를 초과할 때의 절삭/유지 정책이 회귀하지 않도록 고정한다.
  2. 저장/로드 실패 등 에러 경로에서 호출자가 예측 가능한 동작(throw/복구/무시)을 하는지 계약을 검증한다.
- 검증: npm test 통과

### Task T80-99: Version & Release Artifacts (배치 기준)
- 대상: 릴리즈 프로세스(상위 배치 PR7)
- 작업:
  1. PR4 단위에서는 package.json 버전 bump를 하지 않는다.
  2. PR4 설명/릴리즈 노트에 “sync 테스트 강화: TTL/계측/재연결 드레인/전략 계약/리스너 예외 격리/로그 캡” 요약을 포함한다.
- 검증: npm test 통과

## Dependencies
- T80-01 → T80-02 (syncCore 기반/시간 제어 패턴 확립 후 계측 분기 확장)
- T80-01 → T80-03 (TTL/단일비행 안정화 후 시나리오 테스트로 확장)
- T80-06 → T80-05 (리스너 레지스트리 예외 격리 패턴 확정이 facade 시나리오 안정성에 도움)

## Validation (High-level)
- Primary gate: `npm test`
- Optional local focus: `npx vitest run tests/sync-core.test.ts`, `npx vitest run tests/sync-retry-queue.test.ts`

## Risks / Rollback Notes
- 타이밍/비동기 테스트 flake 위험: fake timers/await flush 표준화가 핵심.
- 전략/동작 변경 금지 원칙 유지: 테스트 가능성 개선이 필요하더라도 최소 변경만 허용.

## Handoff
- Critic 리뷰 요청 포인트: T80-03의 “재연결 트리거” 위치(단위 vs 시나리오) 선택, 그리고 새 테스트 파일 추가가 기존 구조/철학을 해치지 않는지.
