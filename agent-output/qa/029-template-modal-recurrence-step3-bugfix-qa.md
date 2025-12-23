# QA Report: 029 TemplateModal Recurrence/Step3 Bug Fix

**Plan Reference**: `agent-output/planning/029-template-modal-recurrence-step3-bugfix-plan.md`
**QA Status**: QA Complete
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-23 | User | QA pass for TemplateModal recurrence/step3 bug fix | Verified changed files + key fix points, ran targeted + full Vitest, produced manual verification checklist |

## Timeline
- **Test Strategy Started**: 2025-12-23
- **Test Strategy Completed**: 2025-12-23
- **Implementation Received**: 2025-12-23
- **Testing Started**: 2025-12-23
- **Testing Completed**: 2025-12-23
- **Final Status**: QA Complete

## Test Strategy (Pre-Implementation)
Focus on user-facing workflows:
- 3-step TemplateModal must not close or stall; validation must surface errors.
- Legacy recurring templates must preload recurrence toggle/settings.
- Duplicate/clone/edit flows must preserve or at least correctly display recurrence state.
- Modal safety: backdrop click must not close; ESC must close.

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- Vitest (already present)

**Testing Libraries Needed**:
- None beyond existing repo setup

**Configuration Files Needed**:
- None

**Build Tooling Changes Needed**:
- None

**Dependencies to Install**:
- None

### Required Unit Tests
- Zod recurrence validation maps errors to `recurrenceType` and `weeklyDays` (not generic/root).
- Recurrence validation passes for expected valid combinations.

### Required Integration Tests
- N/A (UI flow is covered via manual checklist; repo currently has unit/smoke coverage only).

### Acceptance Criteria
- All tests pass (`npm test`).
- Recurrence step validation failures show field-specific errors (no silent no-op).
- Legacy recurring template opens with recurrence UI enabled.

## Implementation Review (Post-Implementation)

### Code Changes Summary
- src/features/template/TemplateModal.tsx
  - Legacy fallback for `autoGenerate` based on `recurrenceType`.
  - NaN guards for numeric inputs (`baseDuration`, `intervalDays`).
  - Modal overlay behavior remains: no backdrop-click close; ESC closes via hotkeys.
- tests/template-system.test.ts
  - Added recurrence-step validation tests including error path assertions.
 - agent-output/analysis/041-template-modal-step-issues-analysis.md
   - Root-cause hypotheses + verification plan for reported step issues.

Notes
- 현재 워크스페이스의 `git diff` 기준으로는 `src/shared/schemas/templateSchemas.ts`는 변경되지 않았습니다(플랜 문서의 “Files Touched”와 불일치). 다만 `tests/template-system.test.ts`는 이미 `validateRecurrenceStep`의 에러 경로 매핑을 전제로 테스트를 하고 있어, 스키마 쪽 변경은 과거 커밋/이전 작업에서 반영되었을 가능성이 큽니다.

## Test Coverage Analysis

| File | Function/Class | Test File | Coverage Status |
|------|---------------|-----------|-----------------|
| src/shared/schemas/templateSchemas.ts | validateRecurrenceStep + schema error mapping | tests/template-system.test.ts | COVERED |
| src/features/template/TemplateModal.tsx | legacy fallback + NaN guard (UI) | tests/template-system.test.ts (partial/indirect) | PARTIAL (manual needed) |

### Coverage Gaps
- UI interactions (TemplateModal step navigation, input clearing, recurrence UI toggles) are not directly covered by automated tests; requires manual verification.

## Test Execution Results

### Unit Tests (Targeted)
- **Command**: `npm test -- tests/template-system.test.ts`
- **Status**: PASS
- **Summary**: 1 file, 49 tests passed

### Full Suite
- **Command**: `npm test`
- **Status**: PASS
- **Summary**: 30 files, 219 tests passed

## Handoff
Handing off to uat agent for value delivery validation.

## Manual Reproduction & Verification Checklists (User-Reported 3 Cases)

Preconditions (공통)
- 앱 실행 후 템플릿 관리 화면(TemplatesModal) 진입
- 테스트 전, 가능하면 기존 템플릿을 1~2개 확보(없으면 아래 단계에서 생성)

### Case 1) 신규 템플릿에서 "다음"이 무반응/3단계로 못 감

Goal
- 1→2→3 단계 이동이 항상 동작하고, 실패 시 에러가 보이는지 확인

Steps
1. TemplatesModal에서 "+ 추가" 클릭 → TemplateModal 열림
2. 1단계에서 필수 필드 입력
  - 할 일 이름: 임의 텍스트 입력
  - 소요 시간(분): 기본값 유지 또는 10 입력
3. 1단계에서 "다음" 클릭
4. 2단계에서 아무것도 입력하지 않고 "다음" 클릭
5. 3단계(주기 설정) 화면 진입 확인
6. 3단계에서 "자동 생성 켜기" 체크
7. 반복 주기를 weekly로 변경 후 요일을 0개로 유지
8. "완료" 클릭

Expected (Fix)
- 3단계에 정상 진입한다(버튼 무반응/모달 종료 없음)
- 7~8에서 저장이 막히고, 3단계 상단에 전역 에러 배너가 표시된다(요일 선택 필요 등)
- 요일을 1개 이상 선택하면 "완료"가 정상 동작한다

Extra Edge (숫자 입력 무효 값)
1. 1단계의 소요 시간 입력을 지우거나 비정상 값으로 만들어본다(예: 텍스트 입력 시도/빈 값 등)
2. "다음" 클릭
Expected
- 단계가 넘어가지 않으며, 소요 시간 필드에 에러가 표시된다(조용한 no-op 금지)

### Case 2) 기존 반복 템플릿 편집 시 주기 설정 탭(자동 생성)이 꺼져 보임

Goal
- 레거시 데이터(autogenerate 누락/false + recurrenceType 존재)에서도 주기 UI가 켜져서 보이는지 확인

Precondition
- 아래 조건을 만족하는 템플릿 1개
  - recurrenceType: daily/weekly/interval 중 하나
  - autoGenerate: undefined(레거시) 또는 false(데이터 불일치)

Steps
1. TemplatesModal에서 해당 템플릿 "수정" 진입
2. 1단계→2단계→3단계로 "다음" 이동
3. 3단계에서 "자동 생성 켜기" 상태 확인
4. 반복 주기 select의 기본값 확인

Expected (Fix)
- 자동 생성이 켜진 상태로 표시되거나(레거시 추론), 최소한 반복 주기 설정이 숨겨지지 않는다
- autoGenerate가 켜진 상태에서 recurrenceType이 none/미존재라면, UI는 daily로 기본값을 잡아 validation no-op을 방지한다

Notes
- UI에서 레거시(autoGenerate missing) 생성이 어렵다면, 실제 사용자 DB/마이그레이션 데이터로 확인하는 것을 권장

### Case 3) 템플릿 복제 후 주기 설정이 사라지거나 "다음"에서 막힘

Goal
- 복제 시 반복 관련 값이 보존되어, 재편집 시에도 3단계가 정상 동작하는지 확인

Steps
1. 템플릿 1개 생성(또는 기존 템플릿 선택)
2. TemplateModal 3단계에서 다음 중 하나로 반복을 설정하고 저장
  - weekly + 요일 2개 이상 선택, 또는 interval + 3일
  - "완료"로 저장
3. TemplatesModal 목록에서 해당 템플릿 "복제" 클릭
4. 복제된 템플릿을 "수정"으로 열기
5. 1→2→3단계 "다음" 이동
6. 3단계에서 자동 생성/반복 주기/요일 또는 간격 값이 원본과 동일한지 확인

Expected (Fix)
- 복제 템플릿에서도 3단계 값이 보존되어 있다(autoGenerate, recurrenceType, weeklyDays, intervalDays)
- 1→2→3 이동이 막히지 않는다

## Regression Checklist (High-Risk Adjacent Behaviors)

Modal Safety
1. TemplateModal 열림 상태에서 배경 클릭으로 닫히지 않는다
2. ESC는 항상 닫힌다: TemplateModal이 먼저 닫히고, 그 다음 TemplatesModal이 닫힌다(모달 스택 정상)

Cancel/Back/Navigation
3. 1단계에서 "취소" 클릭 시 TemplateModal만 닫히고 TemplatesModal은 유지된다
4. 2/3단계에서 "이전" 클릭 시 입력값이 유지되며, 다시 "다음" 시 정상 진입한다
5. 3단계에서 validation 에러가 발생한 뒤, 값을 수정하면 에러가 즉시/재검증 시 사라진다(에러 상태 고착 금지)

Save/Close
6. 3단계에서 "완료" 저장 후, 목록에 변경이 반영되고 재오픈 시 동일 값이 로드된다
7. 저장 중(isSaving)에는 ESC/PrimaryAction이 저장을 중단시키지 않는다(중복 저장/유실 방지)

Hotkeys & Focus
8. Ctrl/Cmd+Enter(PrimaryAction)는 3단계에서만 동작하고, 1/2단계에서는 아무 동작도 하지 않는다(모달 종료/submit 금지)
9. Tab 키로 포커스가 모달 밖으로 빠지지 않는다(배경 UI와 상호작용 금지)

CRUD & List UX
10. "삭제" 확인/취소 플로우가 정상이며 삭제 후 리스트가 갱신된다
11. 복제 템플릿이 필터(매일/7일 이내)와 정렬(다음 생성일)에 정상 반영된다(자동생성 관련 필드 보존 확인)
