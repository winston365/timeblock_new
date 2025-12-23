# QA Report: Duplicate Import (Babel/TS Parser) Regression Guard

**Plan Reference**: `agent-output/analysis/009-vite-babel-duplicate-import-analysis.md`
**QA Status**: Awaiting Implementation
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-17 | User | 중복 import(파서 에러) 회귀 방지 테스트 전략 제안 | vitest 중심 한계 명시 + 최소 lint/typecheck 게이트 + PR 체크리스트/가이드 제안 |
| 2025-12-23 | User | ESLint `no-duplicate-imports` 규칙 추가 후 QA 회귀 체크리스트 | 32개 위반 처리 전략/CI 영향/TS import 함정/최소 안전 수정 순서 추가 |

## Timeline
- **Test Strategy Started**: 2025-12-17
- **Test Strategy Completed**: 2025-12-17
- **Implementation Received**: -
- **Testing Started**: -
- **Testing Completed**: -
- **Final Status**: Awaiting Implementation

## Test Strategy (Pre-Implementation)

### Problem Statement (User-Facing Failure Mode)
- 증상: `npm run dev`에서 Vite React(Babel) 변환 단계가 **SyntaxError**로 중단 → UI가 뜨지 않음.
- 원인 사례: 동일 스코프에서 동일 식별자를 **중복 import**하여 `Identifier 'X' has already been declared`.
- 중요 포인트: 이건 런타임 로직 버그가 아니라 **파서/빌드 파이프라인 단계의 차단 오류**이며, 해당 파일이 테스트에서 import되지 않으면 vitest만으로는 놓칠 수 있음.

### Testing Infrastructure Requirements

**Test Frameworks Needed**:
- Vitest (이미 사용 중)

**Testing Libraries Needed**:
- 추가 라이브러리 도입은 기본적으로 불필요

**Configuration Files Needed**:
- (선택) `tsconfig.typecheck.json` (typecheck 범위를 명확히 하고 싶을 때만)

**Build Tooling Changes Needed (Minimal)**:
- `package.json`에 `typecheck` 스크립트 추가(추천)
  - `tsc -p tsconfig.json --noEmit`
- (선택) `verify` 스크립트 추가
  - `npm run lint && npm run typecheck && npm test`

**Dependencies to Install**:
- 없음(typescript/ eslint 이미 존재)

### Required Checks (What actually catches this regression)

#### 1) Lint Gate (Fast, catches “import block” 실수)
- `npm run lint`는 파일 전체를 파싱하므로, **중복 import로 인한 파서 오류**는 규칙 이전에 실패로 드러남.
- 추가로 명시적 규칙을 두면(선택) 의도 전달/유사 실수 예방에 도움:
  - ESLint core rule `no-duplicate-imports`: 동일 모듈에서 여러 import 문을 금지(정리 유도)

#### 2) Typecheck Gate (Fast, catches unreferenced files too)
- `tsc --noEmit`은 tsconfig 범위 내 **모든 TS/TSX를 파싱/타입체크**하므로,
  - “테스트에서 import 안 되는 UI 파일”에서 터지는 신텍스 문제까지 잡을 확률이 높음.

#### 3) Build/Dev Smoke (Most realistic, but heavier)
- 실제로 사용자에게 영향을 주는 건 `vite`(dev) / `vite build` 파이프라인.
- 최소 스모크 옵션(상황에 따라 PR에만 적용):
  - `npm run build` 또는 변경 범위가 크면 `npm run electron:prod`

### What Vitest CAN/CANNOT catch (Honest Limits)

**Vitest로 가능한 영역**
- 해당 파일이 테스트 실행 중 직접/간접 import 되면, Vite transform 단계에서 같은 파서 오류가 나면서 테스트가 실패할 수 있음.

**Vitest로 놓치기 쉬운 영역 (핵심 한계)**
- 문제 파일이 테스트에서 전혀 import되지 않으면, vitest는 그 파일을 파싱하지 않을 수 있어 회귀를 놓침.
- 따라서 이 유형(빌드 차단 신텍스 오류)은 **vitest 단독 게이트로는 불충분**하고,
  - `lint` 또는 `typecheck(tsc --noEmit)` 같은 “전체 소스 스캔형” 검증이 필요.

### Suggested Minimal CI / PR Gate (Overkill 금지 버전)
- 현재 레포는 `.github/workflows/release.yml`(main push + dist:win)만 존재.
- PR 단계에서 빠르게 잡으려면 가장 작은 CI는 다음 정도(제안):
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`

### Acceptance Criteria
- PR에서 “중복 import/중복 바인딩 선언”이 생기면 `lint` 또는 `typecheck` 단계에서 실패한다.
- 테스트(import) 유무와 무관하게, `src/**` 내 문법 오류가 CI에서 차단된다.
- 개발자가 로컬에서 단일 커맨드로 동일 검증을 재현할 수 있다(예: `npm run verify`).

---

## Regression Checklist: ESLint `no-duplicate-imports` Rule Added

### 1) 개발자가 다음에 해야 할 조치 (현재 32개 위반 처리 전략)
- **권장(대부분)**: 일괄 정리(한 번에 끝내기)
  - 이유: `npm run lint`가 `--max-warnings 0`라서 “경고로 점진 적용”이 사실상 불가(경고도 실패).
  - 실행 가이드(로컬): `npm run lint -- --fix` → 다시 `npm run lint`.
  - PR 크기가 커지면: 폴더 단위로 나누되, **각 PR이 lint 0-error 상태**를 유지(부분적 규칙 해제/주석 회피는 최소화).
- **점진 적용(예외적으로만)**:
  - 전략 A: 규칙을 특정 경로에만 적용(ESLint overrides)하고 범위를 단계적으로 확대.
  - 전략 B: 린트 스크립트에서 `--max-warnings 0` 정책을 CI/로컬로 분리(권장도 낮음: 팀 규율 혼란).

### 2) lint가 CI/빌드에 미치는 영향 (스크립트/파이프라인 가정)
- 현재 [package.json](package.json)의 `lint`는 `eslint ... --max-warnings 0` → **에러 1개라도 CI 즉시 실패**.
- 현재 [ .github/workflows/release.yml](.github/workflows/release.yml)은 `npm run lint`/`npm test`를 호출하지 않고 `npm run dist:win`만 수행.
  - 즉: “릴리즈 빌드가 통과한다”와 “린트가 깨지지 않는다”는 별개.
- 향후 CI에 `npm run lint`가 추가되거나, 빌드 파이프라인 앞단에 `lint`를 묶으면:
  - 지금 상태(32 errors, 4 warnings)에서는 **항상 실패**.

### 3) 중복 import 정리 시 흔한 함정 (QA 관점)
- **Type-only import**
  - 함정: `import { X } from 'm'` + `import type { T } from 'm'`를 따로 두면 규칙에 걸릴 수 있음.
  - 안전한 합치기: `import { X, type T } from 'm'`.
- **Side-effect import**
  - `import 'reflect-metadata'`, `import './styles.css'` 같은 라인은 **절대 다른 import와 합치지 말 것**(의미가 다름).
  - 중복이 보이면 “중복 제거”가 아니라 “실행 순서/의존성 확인”이 먼저.
- **namespace import vs named/default**
  - `import * as Foo from 'm'`는 `import { bar } from 'm'`와 합칠 수 없음 → 한 스타일로 통일해야 함(리팩터링 발생 가능).
- **자동 수정의 착시**
  - ESLint autofix가 합쳐주더라도, type/value 경계(트리쉐이킹, 번들/런타임 참조)가 바뀌는지 코드리뷰로 확인.

### 4) '최소 안전 수정' 권장 순서 (실제 회귀 방지 중심)
1. **동일 모듈 중복 선언만 병합**(기능 변화 0에 가까움)
   - 같은 source의 import 구문을 1개로 합치되, side-effect import는 유지.
2. **Type-only를 TS 방식으로 병합**
   - `import type` 분리 대신 `type` modifier로 단일 import로 정리.
3. **React/라이브러리 중복 import 정리 후 컴파일 확인**
   - 특히 `react` 중복은 단순 병합이 안전.
4. 검증 순서(로컬): `npm run lint` → `npm test` → `npm run build` (가능하면 `npm run electron:prod`)

### 최소 회귀 시나리오(체크)
- `npm run dev`가 즉시 뜨고, 주요 화면(스케줄/인박스/설정/템플릿)이 렌더된다.
- 빌드: `npm run build`가 성공한다.
- 테스트: `npm test`가 통과한다.

## Implementation Review (Post-Implementation)
- (대상 아님) 이 문서는 전략 제안용이며, 구현 수령 시 Phase 2로 갱신 예정.
