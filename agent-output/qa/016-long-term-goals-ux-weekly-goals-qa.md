# QA Report: Long-term Goals UX (Weekly Goals) — Now items (Banner/Tooltip/Quota Toast)

**Plan Reference**: `agent-output/planning/016-long-term-goals-ux-final-now-next-later.md`
**QA Status**: QA Complete
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-23 | Implementer | Verify weekly-goals UX enhancements (3 items) | Reviewed changed files, verified test suite status, added minimal systemState persistence tests for new keys, logged policy/edge-case risks. |

## Timeline
- **Test Strategy Started**: 2025-12-23
- **Test Strategy Completed**: 2025-12-23
- **Implementation Received**: 2025-12-23
- **Testing Started**: 2025-12-23
- **Testing Completed**: 2025-12-23
- **Final Status**: QA Complete

## Test Strategy (Pre-Implementation)
사용자 관점에서 weekly-goals UX 3가지가 “방해되지 않게, 중복 없이, 날짜 경계에서도 안정적으로” 동작하는지 확인한다.

- **배너(Catch-up alert) UX**: 갑작스러운 모달 없이 배너로 노출되며, snooze/dismiss가 영속화되고 재실행에도 유지되는지.
- **설명 툴팁**: 목표 계산 설명이 UI를 깨거나 ESC/modal 동작을 방해하지 않는지.
- **오늘 할당량 달성 토스트**: 목표별 하루 1회만 노출되며 중복/스팸이 없는지(영속화 포함).

### Testing Infrastructure Requirements
⚠️ **TESTING INFRASTRUCTURE NEEDED (optional, not required for minimal QA)**
- React 훅 렌더링 테스트(예: `@testing-library/react` + `jsdom` 환경)가 있으면 hook-level 시나리오(날짜 rollover, snooze timer cleanup, toast dedupe)를 더 직접적으로 검증할 수 있음.
- 현재 Vitest 기본 환경은 `node`이며, 본 QA는 “UI 비의존 단위 테스트(저장소 영속성)” 중심으로 최소 보강함.

### Required Unit Tests
- `systemRepository` 신규 키(`SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE`, `SYSTEM_KEYS.QUOTA_ACHIEVED_GOALS`)의 구조화 값 저장/조회/삭제가 안정적인지.

### Required Integration Tests (Nice-to-have)
- `useCatchUpAlertBanner`의 snooze 만료 타이밍/cleanup(타이머 중복)과 날짜 변경(midnight) 재평가.
- `useQuotaAchievement`의 날짜 rollover 시 achievedGoalIds 리셋.

### Acceptance Criteria
- `npm test`(Vitest full) PASS.
- localStorage 신규 사용 없음(테마 예외만).
- 배너/툴팁이 모달 ESC 동작을 깨지 않음.
- snooze/dismiss/achieved 상태가 Dexie systemState에 저장됨.

## Implementation Review (Post-Implementation)

### Code Changes Summary (weekly-goals 관련)
- Added banner-based catch-up alert UI:
  - `src/features/goals/components/CatchUpAlertBanner.tsx`
  - `src/features/goals/hooks/useCatchUpAlertBanner.ts`
  - `src/features/goals/WeeklyGoalPanel.tsx` (banner mount)
- Added goal status tooltip:
  - `src/features/goals/components/GoalStatusTooltip.tsx`
  - `src/features/goals/WeeklyGoalCard.tsx` (tooltip usage)
- Added quota achievement celebration (toast + persistence):
  - `src/features/goals/hooks/useQuotaAchievement.ts`
  - `src/features/goals/components/QuotaAchievementToast.tsx`
  - `src/data/repositories/systemRepository.ts` (new keys)

### Policy Compliance Check
- **No localStorage**: weekly-goals 변경점에서는 localStorage 신규 사용 없음. 영속 상태는 `systemRepository` 사용.
- **Optional chaining**: 신규 훅에서 `state?.dismissedDate`, `state?.snoozeUntil` 등 안전 접근 사용.
- **No surprise modals**: `CatchUpAlertModal`/`useCatchUpAlert`는 deprecated로 표기, 실제 패널에는 배너가 들어감.
- **ESC behavior**:
  - `CatchUpAlertBanner`는 snooze 메뉴가 열린 경우 ESC로 메뉴를 닫고 `stopPropagation()` 처리.
  - `GoalStatusTooltip`는 ESC로 툴팁 닫기.

## Test Coverage Analysis

### New/Modified Code
| File | Function/Class | Test File | Coverage Status |
|------|---------------|-----------|-----------------|
| src/data/repositories/systemRepository.ts | `SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE`, `SYSTEM_KEYS.QUOTA_ACHIEVED_GOALS` | tests/weekly-goals-system-state.test.ts | COVERED |
| src/features/goals/hooks/useCatchUpAlertBanner.ts | hook behavior | (none) | MISSING (hook 렌더 필요) |
| src/features/goals/hooks/useQuotaAchievement.ts | hook behavior | (none) | MISSING (hook 렌더 필요) |

### Coverage Gaps
- 훅 내부 로직(날짜 rollover, setTimeout cleanup, toast dedupe)은 현재 테스트로 직접 검증되지 않음.

## Test Execution Results

### Unit/Integration (full suite)
- **Command**: `npx vitest run --reporter verbose --no-color`
- **Status**: PASS
- **Output**: 28 test files passed, 158 tests passed

### Tests Added/Updated
- Added: `tests/weekly-goals-system-state.test.ts`

## Issues / Regressions / Edge Cases to Fix (Implementer)
- **Date rollover risk (quota toast)**: `useQuotaAchievement` 초기화는 1회만 수행되어, 앱이 자정 넘어 계속 켜져 있으면 다음날에도 `achievedGoalIds`가 리셋되지 않을 수 있음 → “하루 1회” 규칙이 날짜 경계에서 깨질 가능성.
- **Date rollover risk (catch-up banner)**: `useCatchUpAlertBanner`도 날짜 변경을 주기적으로 재평가하지 않아, 자정 이후 goals가 변하지 않으면 전날 dismissed 상태가 계속 유지될 수 있음.
- **Timer cleanup/duplication risk**: `useCatchUpAlertBanner`에서 snooze 관련 `setTimeout`을 새로 설정할 때 기존 타이머를 clear하지 않아, 연속 snooze/재평가로 타이머가 중복 실행될 수 있음(배너 재등장 중복).
- **PR hygiene**: `.github/copilot-instructions.md.check`는 기능과 무관한 산출물로 보이며 merge 전 제거 권장.

---

Handing off to uat agent for value delivery validation
