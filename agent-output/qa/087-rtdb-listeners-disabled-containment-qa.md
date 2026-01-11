---
ID: 87
Origin: 87
UUID: 197edc5b
Status: QA Failed
---

# QA Report: 087-rtdb-listeners-disabled-containment

**Plan Reference**: `agent-output/planning/087-rtdb-listeners-disabled-containment-plan.md`
**QA Status**: QA Failed
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2026-01-11 | User | QA 검증 요청: ALL_RTDB_LISTENERS_DISABLED 구현 | 코드/테스트 실행 확인. 단, Implementation 문서 및 TDD Compliance 증빙 부재로 QA Gate 실패 처리. |

## Timeline
- **Test Strategy Started**: 2026-01-11
- **Test Strategy Completed**: 2026-01-11
- **Implementation Received**: 2026-01-11 (workspace 기준)
- **Testing Started**: 2026-01-11
- **Testing Completed**: 2026-01-11
- **Final Status**: QA Failed

## Test Strategy (Pre-Implementation)

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- vitest (repo 기존 사용)

**Testing Libraries Needed**:
- fake-indexeddb (repo 기존 사용, 필요 시 Dexie 기반 테스트)

**Configuration Files Needed**:
- 기존 `vitest.config.ts`, `tests/setup.ts` 사용

**Build Tooling Changes Needed**:
- 없음

### Required Unit Tests
- Feature flag 존재/기본값 검증
- `SyncEngine.startListening()`가 flag=true에서 `startRtdbListeners()`를 호출하지 않음
- flag=false에서 기존 리스너 시작이 유지됨(호출/상태 변화)
- `stopListening()`이 리스너 미시작 상태에서도 예외 없이 동작

### Required Integration Tests
- `useAppInitialization` 경로에서 `SyncEngine.initialize()`(Dexie hooks)와 `startListening()`가 분리되어 있어, flag=true에서도 Local→Remote 업로드 경로가 막히지 않음을 확인

### Acceptance Criteria
- flag=true에서 Remote→Local RTDB listeners가 등록되지 않는다.
- Dexie hooks(Local→Remote) 기반 업로드 경로는 유지된다.
- flag=false에서 기존 리스너 시작 동작이 유지된다.
- start/stop 다중 호출이 안전하다.

## Implementation Review (Post-Implementation)

### TDD Compliance Gate (BLOCKER)
- **BLOCKER**: `agent-output/implementation/087-*.md` 구현 문서가 존재하지 않으며, 필수 "TDD Compliance" 테이블을 확인할 수 없음.
- **Result**: QA 프로세스 상 **즉시 Reject**.

> 참고: 코드 및 테스트는 아래 섹션에서 별도로 확인했으나, 공식 QA 승인(Complete)은 TDD 증빙 문서가 있어야 진행 가능.

### Code Changes Summary
- Feature flag 추가 및 JSDoc 명세
  - `src/shared/constants/featureFlags.ts`: `ALL_RTDB_LISTENERS_DISABLED: true`
- 리스너 시작 가드 추가
  - `src/data/db/infra/syncEngine/index.ts`: `SyncEngine.startListening()` 초반부에서 flag=true면 로그 후 return
- 테스트 추가
  - `tests/rtdb-listeners-disabled.test.ts`

## Test Coverage Analysis

### New/Modified Code
| File | Function/Class | Test File | Test Case | Coverage Status |
|------|---------------|-----------|-----------|-----------------|
| src/shared/constants/featureFlags.ts | FEATURE_FLAGS.ALL_RTDB_LISTENERS_DISABLED | tests/rtdb-listeners-disabled.test.ts | flag exists/default true | COVERED |
| src/data/db/infra/syncEngine/index.ts | SyncEngine.startListening | tests/rtdb-listeners-disabled.test.ts | flag=true: no startRtdbListeners, log emitted | COVERED |
| src/data/db/infra/syncEngine/index.ts | SyncEngine.startListening | (missing) | flag=false: 기존 동작 유지 | MISSING |
| src/data/db/infra/syncEngine/index.ts | SyncEngine.stopListening | (missing) | 미시작 상태에서 예외 없음 | MISSING |

### Coverage Gaps
- flag=false 시나리오에 대한 단위 테스트 부재
- `stopListening()` 안전성(미시작/중복 stop) 테스트 부재

## Test Execution Results

### Unit Tests
- **Command**: `npx vitest run tests/rtdb-listeners-disabled.test.ts --reporter=verbose`
- **Status**: PASS (ExitCode=0)
- **Notes**: repo 전체 544개 테스트 PASS는 사용자 보고를 신뢰(본 QA에서는 단일 파일 재실행으로 확인)

## QA Findings

### Functional Verification
- flag=true일 때 리스너 등록 안 됨: **PASS** (코드 가드 + 단위 테스트로 확인)
- flag=true일 때 Dexie hooks 작동: **PASS(코드 구조 근거)**
  - `useAppInitialization`에서 `syncEngine.initialize()`(hooks 등록) 후 `startListening()` 호출
  - 즉, 리스너 차단이 Local→Remote 업로드 경로를 직접 막지 않음
- 앱 → Firebase 업로드 계속: **PASS(코드 구조 근거)**
  - 업로드는 `SyncEngine.initialize()`에서 Dexie hooks → `syncToFirebase()`로 트리거됨

### Additional Functional Risk (Remote → Local 초기 동기화)
- **RISK**: 현재 `runStartupFirebaseInitialRead()`는 BW-01로 초기 bulk download를 스킵하고 `null`을 반환함.
- 따라서 `ALL_RTDB_LISTENERS_DISABLED=true`(리스너 미등록)일 때는 **Remote → Local로 로컬 DB를 채우는 경로가 사실상 부재**할 수 있음.
  - 단일 디바이스(로컬 DB가 이미 존재) 사용자에게는 영향이 작을 수 있으나,
  - **신규 설치/다른 디바이스/로컬 DB 초기화 상황에서는 원격 데이터가 내려오지 않는 사용자 이슈**로 이어질 수 있음.
- `featureFlags.ts`의 "앱 재시작 필요" 설명은, 현재 BW-01 상태에서는 실제로 충족되지 않을 가능성이 있어 문구 정합성 점검이 필요.

### Edge Cases
- flag=false에서 리스너 정상 작동: **PASS(코드 경로)** / **MISSING(테스트 증거)**
- `startListening()` 다중 호출 안전성: **PASS(코드 경로)** / **MISSING(테스트 증거)**
  - flag=false에서는 `isListening` 가드로 중복 시작 방지
  - flag=true에서는 매 호출마다 로그가 남을 수 있음(호출 빈도에 따라 로그 노이즈 가능)
- `stopListening()` 예외 없이 동작: **PASS(코드 경로)** / **MISSING(테스트 증거)**
  - `stopRtdbListeners([])`는 안전 (forEach)

### Code Quality
- JSDoc: **PASS** (새 플래그 설명이 목적/영향/업로드 유지까지 포함)
- 코드 스타일 일관성: **PASS** (기존 FEATURE_FLAGS 패턴 유지)
- imports: **PASS**

### Documentation Drift
- Plan 087의 Key Decision은 `RTDB_LISTENERS_DISABLED`를 제안하지만, 구현은 `ALL_RTDB_LISTENERS_DISABLED`로 반영됨.
- 이는 Critique에서 제안된 명명 개선 방향과는 정합하지만, Plan 문서 업데이트가 필요.

---

## Required Fixes Before QA Approval
1. `agent-output/implementation/087-*.md` 구현 문서 추가
2. 구현 문서에 "TDD Compliance" 테이블 포함 및 증빙 채우기
3. (권장) flag=false 및 stopListening 관련 단위 테스트 추가
4. Plan 087의 플래그 명칭/설명 업데이트 (문서-코드 정합성)

---

Handing off to uat agent for value delivery validation: BLOCKED (QA Failed)
