---
ID: 87
Origin: 87
UUID: 197edc5b
Status: Active
---

# Plan Header
- Plan ID: 087-rtdb-listeners-disabled-containment
- Target Release: **1.0.193** (current package.json=1.0.192)
- Epic Alignment: Firebase RTDB 과다 다운로드 근본 해결(실시간 리스너 완전 차단으로 지속 다운로드 제거)
- Status: Active

## Value Statement and Business Objective
As a local-first 사용자(특히 single-device 사용자), I want Firebase RTDB가 “앱을 켜놓기만 해도 지속적으로 다운로드되는 상태”를 완전히 없애고, so that 실제 데이터 크기(예: 3MB)만큼만 다운로드하며 비용/쿼터/배터리/발열 리스크를 제거한다.

## Objective
- Firebase RTDB 실시간 리스너(Remote → Local)를 **기본값으로 완전 비활성화**한다.
- Dexie hooks 기반의 앱 → Firebase 업로드(Local → Remote)는 유지한다.
- 앱이 idle 상태여도 발생하던 지속 다운로드를 0에 가깝게 만든다.

## Non-goals
- 실시간 다중 디바이스 동기화 품질 개선(Phase 2+)
- 데이터 포맷 마이그레이션, onChildAdded 이벤트 최적화(BW-02/05 계열)
- 백엔드/Supabase/Electron IPC 신규 구현

## Confirmed Root Cause
- Firebase `onChildAdded` 리스너는 등록 시점에 “기존 자식 전체”에 대해 이벤트를 발생시킨다.
- 네트워크 재연결 시 초기 스냅샷이 재전송되어, 앱이 방치 상태에서도 다운로드가 누적될 수 있다.

## Current Code Touchpoints (for implementer)
- SyncEngine 리스너 시작 지점: [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts) `SyncEngine.startListening()`
- 부팅 시 리스너 시작 호출: [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)
- 리스너 구성 함수: [src/data/db/infra/syncEngine/listener.ts](src/data/db/infra/syncEngine/listener.ts) `startRtdbListeners()`

## Key Decision
- 새로운 Feature Flag `RTDB_LISTENERS_DISABLED`를 도입하고, 기본값을 **true**로 설정한다.
- `SyncEngine.startListening()`는 flag가 true면 리스너를 시작하지 않고 즉시 반환한다.

## Expected Impact
- ✅ 지속 다운로드: 사실상 0(리스너 구독 자체가 없으므로)
- ✅ 초기 다운로드: 앱 부팅 시 fetch 경로만 남음(현 구조 유지)
- ✅ 업로드: Dexie hooks 기반 Local → Remote sync 유지
- ⚠️ 다중 디바이스: 다른 디바이스의 변경이 앱 실행 중에는 반영되지 않음(앱 재시작/수동 fetch까지 지연)

---

# Atomic Task Breakdown (Requested Format)

## Task 1 — Feature Flag 추가
1) 수정할 파일 경로
- [src/shared/constants/featureFlags.ts](src/shared/constants/featureFlags.ts)

2) 구체적인 코드 변경 내용
- `FEATURE_FLAGS` 객체에 `RTDB_LISTENERS_DISABLED: true`를 추가한다.
- JSDoc에 아래를 명시한다.
  - Remote → Local 실시간 반영(리스너)이 완전히 꺼진다는 점
  - Local → Remote 업로드는 유지된다는 점(Dexie hooks)
  - single-device 사용자에게 영향이 작지만, multi-device 사용자에게는 “실시간 반영 지연”이 발생한다는 점

3) 예상되는 영향
- 모든 환경에서 기본적으로 RTDB 리스너가 시작되지 않도록 “정책 스위치”가 생긴다.
- 테스트/디버깅에서 리스너 경로를 검증할 때는 flag를 false로 두고 실행해야 한다.

Acceptance criteria
- 빌드 타임 상수로 플래그가 노출되며, 다른 플래그들과 동일한 사용 패턴을 따른다.

---

## Task 2 — startListening() 조건부 비활성화
1) 수정할 파일 경로
- [src/data/db/infra/syncEngine/index.ts](src/data/db/infra/syncEngine/index.ts)

2) 구체적인 코드 변경 내용
- `SyncEngine.startListening()`의 초반부(가능하면 `if (this.isListening) return;` 다음)에 플래그 체크를 추가한다.
- `FEATURE_FLAGS.RTDB_LISTENERS_DISABLED`가 true인 경우:
  - 리더 락 획득, DB 핸들 생성, `startRtdbListeners()` 호출을 **모두 스킵**
  - 즉시 반환
- (권장) 동작 확인을 위해 `addSyncLog`로 “리스너 비활성화로 스킵” 로그를 1회 남길지 결정한다.

3) 예상되는 영향
- RTDB 실시간 구독이 시작되지 않아 앱 방치/재연결 시 다운로드가 누적되지 않는다.
- 기존 리스너 관련 코드(`listener.ts`, `rtdbListenerRegistry`)는 남아있으나 실행 경로에서 빠진다.

Acceptance criteria
- 플래그 true에서 `startListening()` 호출이 side-effect 없이 빠르게 종료한다.
- 플래그 false에서 기존 리스너 시작 동작이 그대로 유지된다.

---

## Task 3 — 테스트 업데이트
1) 수정할 파일 경로
- (기존 테스트 보강 또는 신규 테스트 추가 권장)
  - [tests/smoke-sync-engine-basic.test.ts](tests/smoke-sync-engine-basic.test.ts) (선택: 스모크에 “startListening 호출이 안전”을 추가할 경우)
  - 또는 신규: `tests/sync-engine-startListening-flag.test.ts` (권장)

2) 구체적인 코드 변경 내용
- `RTDB_LISTENERS_DISABLED=true`일 때:
  - `SyncEngine.startListening()`이 `startRtdbListeners()`를 호출하지 않음을 검증한다.
- `RTDB_LISTENERS_DISABLED=false`일 때:
  - Firebase 초기화/DB 핸들/리더락을 mock한 상태에서 `startRtdbListeners()`가 호출됨을 검증한다.
- 기존 리스너 구성 테스트([tests/sync-engine-rtdb-range-listeners.test.ts](tests/sync-engine-rtdb-range-listeners.test.ts))는 `startRtdbListeners()`를 직접 호출하므로 영향이 없지만, 향후 “통합 경로” 테스트를 추가할 때는 플래그 상태를 명시적으로 고정한다.

3) 예상되는 영향
- 플래그 기본값이 true여도, 테스트가 의도적으로 리스너를 켜서 검증할 수 있게 된다.
- 회귀(플래그 추가로 인해 리스너가 영구적으로 막히거나, 반대로 의도치 않게 켜지는 문제)를 조기에 탐지한다.

Testing strategy (high-level)
- Unit: startListening 가드(플래그 on/off) + mocked firebase modules
- Existing listener unit tests: 그대로 유지

---

## Task 4 — (선택) 앱 포커스 시 수동 fetch 1회 (Phase 2)
1) 수정할 파일 경로(후보)
- [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)
- 또는 포커스/가시성 이벤트를 다루는 공용 훅/구독자 레이어(존재 시)

2) 구체적인 코드 변경 내용
- 실시간 리스너를 대체하기 위해, 앱이 포커스를 받을 때 제한적으로 1회 `fetchDataFromFirebase()` 또는 필요한 전략만 `fetchFromFirebase()`를 호출한다.
- 재진입/빈번 호출을 막기 위해 debounce/throttle(예: 30–60초 쿨다운) 정책을 둔다.

3) 예상되는 영향
- multi-device 사용자 경험이 “재시작 필요”에서 “포커스 복귀 시 최신화”로 개선된다.
- 하지만 fetch 자체가 큰 다운로드가 될 수 있으므로, 이 Phase에서는 ‘지속 다운로드 제거’와 분리해 위험을 통제한다.

---

# Dependencies
- None (로직상 독립)
- 단, 플래그 기본값을 true로 두는 결정은 제품 정책(멀티 디바이스 지원 수준)과 직접 연결됨

# Risks / Mitigations
- Risk: multi-device 실시간 반영 상실
  - Mitigation: Task 4(포커스 fetch) 또는 사용자가 플래그를 끌 수 있는 runtime kill-switch(추후 별도)
- Risk: “부팅 시 bulk fetch + 리스너 초기 스냅샷”의 이중 다운로드는 이번 변경으로 해결되지만, 부팅 fetch 자체는 여전히 클 수 있음
  - Mitigation: 별도 최적화(BW-01/BW-02 계열)로 추후 개선

# Version & Release Milestone
- package.json 버전 및 CHANGELOG/릴리즈 노트(존재 시)를 Target Release 1.0.193에 맞게 갱신
- 릴리즈 노트에 ‘실시간 리스너 기본 비활성화로 지속 다운로드 제거’와 ‘멀티 디바이스 실시간 반영 지연’ 영향 명시

# OPEN QUESTION (Needs explicit user confirmation)
- Q1: `RTDB_LISTENERS_DISABLED` 기본값을 정말로 **true(기본 OFF가 아니라 기본 ON)**로 가져갈까요? (멀티 디바이스 사용자 영향 수용 여부)
- Q2: Task 4(포커스 fetch)는 이번 릴리즈(1.0.193)에 포함할까요, 아니면 “Phase 2”로 확실히 분리할까요?
