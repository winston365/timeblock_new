---
ID: 55
Origin: 55
UUID: 6c2a7f1b
Status: QA Failed
---

# QA Report: Weekly Goals 개선(10개 항목) — 구현 Task 분해 (UI-only)

**Plan Reference**: `agent-output/planning/055-weekly-goals-10-items-task-breakdown.md`
**QA Status**: QA Failed
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2026-01-02 | User | “Weekly Goals 개선 10개 항목(F3/F5/F8/F9/F10/U1~U5) 구현 검증” | 테스트/타입체크/패턴 준수/통합(wiring) 점검 수행. 유틸 단위테스트는 통과했으나 TypeScript 컴파일/회귀 테스트 실패 및 일부 기능 미연결로 QA Failed. |
| 2026-01-02 | User | “최종 검증(테스트는 통과)” 재점검 | `npm test`는 PASS(32 files, 388 pass, 1 skip)로 회귀는 해소. 다만 repo-wide `tsc --noEmit`는 여전히 FAIL(Goals 포함)이며, 일부 핵심 훅/유틸이 UI에 연결되지 않거나(guard/undo) 버튼 액션이 비어있어 기능 요구사항 기준 QA Failed 유지. |

## Timeline
- **Test Strategy Started**: 2026-01-02
- **Test Strategy Completed**: 2026-01-02
- **Implementation Received**: 2026-01-02 (워크스페이스 상태 기준)
- **Testing Started**: 2026-01-02
- **Testing Completed**: 2026-01-02
- **Final Status**: QA Failed

## 검증 결과 요약
- 자동화 테스트(vitest): PASS (`npm test` 기준 32 파일, 388 통과, 1 스킵)
- 타입 안정성(repo-wide): FAIL (`npx tsc -p tsconfig.json --noEmit` 기준 106 errors)
- 사용자 플로우 관점: 일부 핵심 기능이 UI에 미연결(Guard/Undo/테마 그룹/리셋카드 히스토리 버튼 액션)로 실제 사용 시 기대 동작 불일치 리스크

## Test Strategy (Pre-Implementation)
사용자 관점에서 “주간 목표를 매일 여는 흐름”이 깨지지 않는지에 초점을 둔다.

### Primary User Workflows (Manual + Automated)
- Goals 모달 열기 → 이번 주 라벨/상단 배너/필터바가 렌더링
- “오늘만” 토글 → 목표 리스트가 예측 가능하게 줄어듦 + 숨김 카운트
- Catch-up 배너 → snooze/dismiss가 주 1회 정책으로 동작
- 진행도 ± 조절/직접입력 → 큰 변경은 확인/차단, 변경 직후 Undo 가능
- Add/Edit 모달 → Step1/Step2 분리 + ESC 동작 + 배경 클릭으로 닫히지 않음

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- 기존 `vitest` 유지

**Testing Libraries Needed**:
- UI/Hook 통합 검증을 위해 별도 `jsdom` 기반 테스트 런 필요 (현재는 node env)

**Configuration Files Needed**:
- `vitest.ui.config.ts` (또는 현 config 확장) — `environment: 'jsdom'`, TSX 포함 커버리지/실행

**Dependencies to Install (제안)**:
```bash
npm i -D jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

### Required Unit Tests
- 주간 계산/라벨 유틸 (weekUtils)
- 테마 그룹/필터 유틸 (themeGroupUtils)
- 히스토리 인사이트 계산 유틸 (historyInsightUtils)
- systemState 헬퍼(get/set)와 키 삭제/기본값 동작

### Required Integration Tests
- “오늘만 보기” 토글 → 리스트 변화 + 숨김 카운트
- Catch-up 배너 → snooze/dismiss 저장 + 다음 주 재등장
- Undo/Guard → 큰 변경 confirm/차단 + 5초 undo
- WeeklyResetCard → 주 1회 노출 + 닫기 저장
- Add/Edit 2-step 모달 → ESC/step-back + 배경 클릭 금지

### Acceptance Criteria
- `npm test` 통과
- `npx tsc -p tsconfig.json --noEmit` 통과
- 새로 추가된 핵심 훅/유틸이 실제 UI에서 호출되는 call-site 존재
- systemState는 repo wrapper(`systemRepository`) 경유 (직접 localStorage/Dexie 접근 금지)

## Implementation Review (Post-Implementation)

### Code Changes Summary
- 신규 유틸/훅/컴포넌트가 Goals feature에 다수 추가됨 (weekUtils/themeGroupUtils/historyInsightUtils, systemState helpers, undo/guard/recommended pace hooks, reset/expand hint/filter UI 등)
- `coverage/` 아래에 커버리지 HTML 산출물이 생성됨(테스트 실행 부산물)

## Test Coverage Analysis

### New/Modified Code
| File | Function/Class | Test File | Coverage Status |
|------|---------------|-----------|-----------------|
| `src/features/goals/utils/weekUtils.ts` | 날짜/주 계산 유틸 | `tests/weekly-goals-utils.test.ts` | COVERED (부분 미커버 함수 있음) |
| `src/features/goals/utils/themeGroupUtils.ts` | 테마 그룹/필터 | `tests/weekly-goals-utils.test.ts` | COVERED |
| `src/features/goals/utils/historyInsightUtils.ts` | 인사이트 계산 | `tests/weekly-goals-utils.test.ts` | COVERED |
| `src/features/goals/utils/goalSystemState.ts` | systemState get/set | `tests/weekly-goals-system-state.test.ts` | PARTIAL (키 수준 중심) |
| `src/features/goals/hooks/useGoalsSystemState.ts` | UI state↔systemState 동기화 | (없음) | MISSING |
| `src/features/goals/hooks/useCatchUpAlertBanner.ts` | 배너 표시/스누즈 로직 | (없음) | MISSING |
| `src/features/goals/hooks/useProgressUndo.ts` | 5초 undo | (없음) | MISSING |
| `src/features/goals/hooks/useProgressGuard.ts` | 변경 guard | (없음) | MISSING |
| `src/features/goals/hooks/useRecommendedPace.ts` | 0.5x 재시작 | (없음) | MISSING |
| `src/features/goals/components/WeeklyResetCard.tsx` | 주간 리셋 카드 | (없음) | MISSING (현 인프라상 TSX 미검증) |
| `src/features/goals/components/GoalsFilterBar.tsx` | 오늘만/compact 토글 | (없음) | MISSING (현 인프라상 TSX 미검증) |

### Coverage Gaps
- node 환경 테스트만 존재해 TSX/Hook 기반 UX는 자동 검증이 사실상 불가
- hook 로직(undo/guard/recommended pace/catch-up) 대부분 0% 실행

## Test Execution Results

### Unit Tests
- **Command**: `npx vitest run tests/weekly-goals-utils.test.ts`
- **Status**: PASS (37 tests)

- **Command**: `npx vitest run tests/weekly-goals-system-state.test.ts`
- **Status**: PASS (3 tests)

### Regression / Full Suite
- **Command**: `npm test`
- **Status**: PASS
- **Output Summary**: Test Files 32 passed (32) / Tests 388 passed | 1 skipped (389)

### Type Safety
- **Command**: `npx tsc -p tsconfig.json --noEmit`
- **Status**: FAIL
- **Notes**: repo-wide로 106 errors. Weekly Goals 영역에서도 에러가 포함됨(예: `src/features/goals/GoalsModal.tsx` unused import, `src/features/goals/hooks/useGoalsSystemState.ts` boolean state typing, `src/features/goals/hooks/useRecommendedPace.ts` unused variable).

## Key Findings (User-Facing Risk)
- `useProgressGuard` / `useProgressUndo` / `useRecommendedPace`는 현재 코드베이스에서 import/호출(call-site)이 확인되지 않음 → 기능이 “구현되어 있으나 사용자에게 노출되지 않는” 통합 리스크.
- `themeGroupUtils`는 테스트 외 사용처가 없어(=UI 연결 없음) “테마 그룹/필터” 기능이 요구사항 대비 미완.
- `WeeklyResetCard`의 “📊 히스토리” 버튼은 onClick이 없어 사용자 액션이 동작하지 않음(현재는 시각적 버튼만 존재).
- `npm test`는 PASS지만, repo-wide `tsc --noEmit`가 FAIL이라 타입 안정성 기준으로는 배포 리스크가 남아 있음.

## 구현 완료 vs 남은 작업

### 구현 완료(확인됨)
- 주차 계산/표현 유틸: `weekUtils` (unit tests PASS)
- 히스토리 인사이트 계산 + UI: `historyInsightUtils` + `HistoryInsightPanel` (유틸 테스트 PASS, TSX는 자동 검증 불가)
- “오늘만 보기”/축소 모드 토글 UI: `GoalsFilterBar` (WeeklyGoalPanel/GoalsModal에 연결 확인)
- 주 1회 배지/힌트 상태 영속화: `goalSystemState` 경유로 systemState 저장(직접 localStorage 사용 없음)

### 남은 작업(블로커/갭)
- Guard/Undo/권장페이스 훅을 실제 UI(WeeklyGoalCard/CatchUp 등)와 연결하고, 사용자 플로우로 검증
- `WeeklyResetCard` 히스토리 버튼에 실제 액션(히스토리 모달 오픈 등) 연결
- repo-wide `tsc -p tsconfig.json --noEmit` 통과(Goals 관련 오류 포함)
- (권장) UI/Hook 상호작용 테스트 인프라 추가(jsdom + testing-library 등)로 Goals TSX 자동 검증 가능하게 확장

## 권장 후속 작업
- **P0(배포 전)**: `tsc --noEmit`를 0 에러로 만들거나, 최소한 Goals 관련 에러를 제거해 “변경 범위”를 안정화
- **P0(기능 완성)**: Guard/Undo/ResetCard 히스토리 버튼을 실제 UX에 연결하고 수동 시나리오(±, 직접입력, undo 타이머, 주간 배너 1회 규칙) 체크리스트로 확인
- **P1(품질/회귀 방지)**: Goals 영역에만 한정한 jsdom 기반 테스트 러너(또는 분리된 vitest config)를 추가해 TSX/Hook 상호작용을 자동 검증

---

## Handoff
Handing off to uat agent for value delivery validation
