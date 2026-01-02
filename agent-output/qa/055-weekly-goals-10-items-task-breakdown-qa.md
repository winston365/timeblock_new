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

## Timeline
- **Test Strategy Started**: 2026-01-02
- **Test Strategy Completed**: 2026-01-02
- **Implementation Received**: 2026-01-02 (워크스페이스 상태 기준)
- **Testing Started**: 2026-01-02
- **Testing Completed**: 2026-01-02
- **Final Status**: QA Failed

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
- **Status**: FAIL
- **Notes**: `tests/template-system.test.ts`에서 2개 실패(weekly-goals와 직접 관련 없는 회귀로 보이지만, CI 관점에서는 블로커)

### Type Safety
- **Command**: `npx tsc -p tsconfig.json --noEmit`
- **Status**: FAIL
- **Notes**: repo-wide로 다수 에러(Goals 관련 파일에서도 boolean literal typing/unused import 등 오류 관측)

## Key Findings (User-Facing Risk)
- 구현된 훅 중 일부(`useProgressGuard`, `useProgressUndo`, `useRecommendedPace`)는 call-site가 확인되지 않아 실제 UX로 발현되지 않을 가능성이 큼
- `WeeklyResetCard`의 “📊 히스토리” 버튼은 UI는 존재하나 실제 액션 연결 여부가 불명확(테스트/코드 연결 확인 필요)
- 현재 테스트 인프라(vitest node-only)에서는 Goals TSX 상호작용(ESC/모달/핫키/버튼 클릭)을 자동 검증할 수 없음

---

## Handoff
Handing off to uat agent for value delivery validation
