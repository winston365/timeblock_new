---
ID: 64
Origin: 64
UUID: 8e4fa2b9
Status: Active
---

# Plan: PR6(유틸 가드 추가) — 구현 계획 (2026-01-03)

- Target Release: **1.0.182**
- Epic Alignment: 런타임 안전성 강화(가드 표준화의 첫 단추)
- Source Analysis (closed): [agent-output/analysis/closed/064-pr6-guard-utils-analysis.md](agent-output/analysis/closed/064-pr6-guard-utils-analysis.md)
- Status: Proposed

## Changelog

| Date | Update | Summary |
|------|--------|---------|
| 2026-01-03 | Initial | PR6 범용 가드 유틸(타입 가드 + 컬렉션 가드) 정의 및 단위 테스트 추가 계획 작성 |

## Value Statement and Business Objective
As a 사용자(오빠), I want null/undefined 및 컬렉션(배열) 경계에서의 안전 장치를 **일관된 유틸 가드**로 제공받아, so that 인라인 체크의 중복/실수를 줄이고(특히 filter/map 파이프라인) 점진적 리팩토링이 가능해진다.

## Scope & Constraints
- 이번 PR 범위: **유틸 정의 + 단위 테스트 추가만**
- 비범위: 기존 런타임 코드(스토어/리포지토리/서비스) 전반에 대한 대규모 적용/리팩토링
- 기존 동작/UX 변경 금지(정의만 추가하고, 기존 사용처는 그대로 유지)

## Context (현재 관측된 관련 코드)
- 미사용(또는 낮은 채택) 가드: [src/shared/lib/errorHandler.ts](src/shared/lib/errorHandler.ts) 내 `assertExists`, `assertNotEmpty`, `assertInRange`
- 사용 중(스토어): [src/shared/lib/storeUtils.ts](src/shared/lib/storeUtils.ts) 내 `assertDailyDataExists`
- 사용 중(Firebase 래퍼): [src/shared/utils/firebaseGuard.ts](src/shared/utils/firebaseGuard.ts)
- 에러 표준 타입 후보: [src/shared/lib/standardError.ts](src/shared/lib/standardError.ts)

## Assumptions
- Target Release **1.0.182**는 PR1~PR6 묶음 릴리즈로 운영 가능하다.
- 새 유틸은 기존 import 스타일을 강제하지 않는다(이번 PR은 “제공”에 집중).

## OPEN QUESTION (승인 필요)
1) 새 가드 파일 배치: `src/shared/lib` 아래에 **신규 파일 1개**(예: `typeGuards.ts`)로 만들까요, 아니면 기존 [src/shared/lib/errorHandler.ts](src/shared/lib/errorHandler.ts)에 **섞어서** 추가할까요?
   - 제안: 신규 파일 1개(응집도 유지), 기존 assert들은 현 위치 유지.
2) 에러 메시지/코드 규약: 이번 PR에서 **최소한의 prefix 통일(문자열)**까지만 할까요, 아니면 [src/shared/lib/standardError.ts](src/shared/lib/standardError.ts) 기반의 **표준 에러 객체**를 가드 유틸에 도입할까요?
   - 제안: 이번 PR은 문자열 prefix 수준으로 제한(리스크/파급 최소), 표준 에러 도입은 후속 PR로.

---

## PR6 구현 계획

### Task T100-01: 기존 가드 정리(미사용 유틸 처리 방침 확정)
- 대상: [src/shared/lib/errorHandler.ts](src/shared/lib/errorHandler.ts), [src/shared/lib/storeUtils.ts](src/shared/lib/storeUtils.ts)
- 작업:
  1. `assertExists`/`assertNotEmpty`/`assertInRange` 및 `findTaskOrThrow`의 “유지 vs 제거” 기준을 문서화하고 PR6 범위 내 결론을 확정한다.
  2. 유지하는 경우: 외부에서 재사용 가능한지(범용성)와 에러 메시지 prefix를 최소한으로 정렬한다.
  3. 제거하는 경우: 전역 사용처 0을 확인하고, 제거로 인한 public API 변화가 없는지(테스트/빌드) 확인한다.
- 검증: `npm test` 통과

### Task T100-02: 범용 타입 가드 세트 추가 (Non-nullish)
- 대상: (신규) `src/shared/lib/<새 가드 파일>.ts`
- 작업:
  1. `isNonNullish` 추가(배열 `filter`에서 타입 narrowing 지원).
  2. nullish와 falsy(0, "")를 혼동하지 않도록 함수 계약을 명확히 한다.
  3. 외부 입력(unknown)을 다루는 함수는 필요한 경우 별도 가드로 분리한다(예: record/array).
- 검증: `npm test` 통과

### Task T100-03: 컬렉션 가드 추가 (Non-empty array + array assertion)
- 대상: (신규) `src/shared/lib/<새 가드 파일>.ts` (또는 [src/shared/lib/errorHandler.ts](src/shared/lib/errorHandler.ts) 확장)
- 작업:
  1. `isNonEmptyArray` 추가(비어있지 않은 배열을 판별하는 타입 가드).
  2. `assertArray` 추가(unknown 입력이 배열임을 보장하는 assertion 가드) 및 에러 메시지 규약을 통일한다.
  3. 기존 `assertNotEmpty`와 역할이 겹치는 부분은 “중복 최소화” 원칙으로 정리한다(필요 시 내부 위임).
- 검증: `npm test` 통과

### Task T100-04: 가드 함수 단위 테스트 추가
- 대상: (신규) `tests/guard-utils.test.ts` (또는 `tests/type-guards.test.ts`)
- 작업:
  1. PR6에서 추가/정리한 가드들의 성공/실패 경로를 단위 테스트로 고정한다.
  2. (선택) TS 타입 narrowing이 중요한 가드는 `tsc --noEmit` 게이트에서 확인 가능하도록 타입 예시를 함께 유지한다(방식은 구현자가 선택).
  3. 에러 메시지 규약이 도입되면, 메시지 포맷의 최소 계약(예: prefix 포함)을 테스트로 고정한다.
- 검증: `npm test` 통과

### Task T100-99: 버전/릴리즈 아티팩트 정합성 확인
- 대상: [package.json](package.json)
- 작업:
  1. Target Release가 **1.0.182**로 확정되면 버전 업데이트를 포함한다(릴리즈 묶음 정책에 따름).
  2. CI 게이트: `npm run lint` → `npx tsc --noEmit` → `npm test` 순으로 통과를 확인한다.
- 검증: `npm run lint`, `npx tsc --noEmit`, `npm test` 통과

## Validation (High-level)
- Build/Type/Lint/Test 게이트 모두 PASS
- 기존 런타임 동작 변화 없음(유틸 추가 + 테스트만)

## Risks
- 새 파일 추가 위치/네이밍이 향후 채택에 영향을 줄 수 있음(Discoverability).
- 에러 규약을 과하게 도입하면 파급이 커질 수 있음(이번 PR은 최소 규약 권장).
