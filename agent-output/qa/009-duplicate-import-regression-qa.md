# QA Report: Duplicate Import (Babel/TS Parser) Regression Guard

**Plan Reference**: `agent-output/analysis/009-vite-babel-duplicate-import-analysis.md`
**QA Status**: Awaiting Implementation
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-17 | User | 중복 import(파서 에러) 회귀 방지 테스트 전략 제안 | vitest 중심 한계 명시 + 최소 lint/typecheck 게이트 + PR 체크리스트/가이드 제안 |

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

## Implementation Review (Post-Implementation)
- (대상 아님) 이 문서는 전략 제안용이며, 구현 수령 시 Phase 2로 갱신 예정.
