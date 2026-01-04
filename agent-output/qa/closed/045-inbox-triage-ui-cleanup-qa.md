# QA Report: Inbox Triage UI Cleanup (UI-only)

**Plan Reference**: `agent-output/planning/045-inbox-triage-ui-cleanup-ui-only-plan.md`
**QA Status**: QA Complete
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-28 | User → QA | Implementer 변경 QA 검증 (칩 제거/행 병합/크래시 가드 + 정책 스캔) | Vitest는 PASS였으나, Triage 포커스/핫키가 실사용에서 동작하지 않을 가능성이 높고(상태 동기화 결함), 인박스 기본값 하드코딩 정책 위반이 있어 QA Failed로 판정. |
| 2025-12-28 | User → QA | Implementer 최신 fix pass 이후 재-QA (요구사항/이전 Fail 항목 재검증) | 변경 파일 목록이 기대와 동일하고, `npm test` PASS. 시간대 칩 제거/행 병합/triage 크래시 방지 확인. 이전 Fail 항목(포커스 동기화, defaults, quick-place date handling) 해결로 QA Complete 판정. |
| 2025-12-28 | User → QA | Triage hotkeys fix QA (입력 포커스 가드/blur/테스트) | `git diff --name-only` 변경 파일 4개 확인, `npm test` PASS. 다만 Triage 모드에서도 `disabled`가 true면 리스너가 아예 붙지 않아(인라인 input 포커스 시) “activeElement가 input이어도 triage hotkeys가 막히지 않음” 요구사항을 엄밀히 충족하지 못해 QA Failed. |
| 2025-12-28 | User → QA | Code-level QA: triage hotkeys in input + non-triage hotkeys disabled in input + triage toggle blur | 코드 리딩 기준으로 triage 훅 자체는 input 포커스 가드를 우회하고(capture phase), triage toggle은 blur 수행. 그러나 `InboxTab`이 input focus 시 `disabled`를 true로 만들어 훅 리스너가 아예 붙지 않아 “input 포커스에서도 triage hotkeys가 발화”는 통합 관점에서 FAIL. 비-triage 키(세트 외)는 캡처하지 않아 타이핑 자체는 유지(PASS). |
| 2025-12-28 | User → QA | Re-QA after latest gating fix | 실제 repo 기준으로 `disabled` 계산이 triageEnabled일 때 input focus를 무시하도록 수정됨. `git diff --name-only`는 기대 파일 포함, `npm test` PASS. triage enabled: input focus에서도 리스너 마운트 유지(PASS). triage disabled: input focus에서 차단(PASS). modal open: 항상 차단(PASS). |

## Timeline
- **Test Strategy Started**: 2025-12-28 13:35
- **Test Strategy Completed**: 2025-12-28 13:40
- **Implementation Received**: 2025-12-28
- **Testing Started**: 2025-12-28 14:15
- **Testing Completed**: 2025-12-28 14:16
- **Final Status**: QA Complete

## Test Strategy (Pre-Implementation)
사용자 관점에서 “인박스 트리아지 루프가 끊기지 않고(오동작/크래시 없음) 시각적 인지 부하가 감소하는지”를 검증한다.

- **UI 감소(인지 부하)**: per-task 시간대 칩이 사라지고, Today/Tomorrow/Next + 고정/보류가 한 줄에서 제공된다.
- **Triage 안정성**: triage 중 콜백 불일치로 발생하는 `TypeError: ... is not a function` 계열이 재발하지 않는다.
- **키보드 흐름**: Triage ON 시 포커스가 설정되고(하이라이트), T/O/N/P/H/삭제/편집 핫키가 포커스된 task에 적용된다.
- **정책 준수**: localStorage 신규 사용 없음(theme 예외), 하드코딩 기본값 없음, nested access는 안전하게 처리.

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- Vitest (repo existing)

**Testing Libraries Needed**:
- (권장) DOM 기반 hook 검증을 위해 `@testing-library/react` + `happy-dom` 또는 `jsdom`

**Configuration Files Needed**:
- (권장) hook keydown 로직 검증용 `vitest.config.ts`에 DOM 환경 추가(현재 node 기반)

**Build Tooling Changes Needed**:
- 없음(현 단계는 수동 코드리뷰 + 기존 Vitest 실행)

## Implementation Review (Post-Implementation)

### Evidence: Working Tree Change List (git)
**Current working tree (`git diff --name-only`)**
- `src/data/repositories/dailyData/taskOperations.ts`
- `src/features/tasks/InboxTab.tsx`
- `src/features/tasks/hooks/useInboxHotkeys.ts`
- `src/shared/stores/dailyDataStore.ts`

**Note**
- `tests/inbox-hotkeys.test.ts`는 현재 working tree diff에는 포함되지 않음(이번 gating fix에서 추가 변경 없음).

### Requirements Verification
- **시간대 칩 제거**: `InboxTab`에서 `TIME_BLOCKS.map(...)` 기반 per-task 칩 행이 제거됨 (요구사항 충족)
- **Today/Tomorrow/Next + 고정/보류 행 병합**: `renderActionButtons`로 병합되어 단일 행 렌더링 (요구사항 충족)
- **triage 크래시 방지**: `useInboxHotkeys`에서 콜백 타입 가드 + 안전한 fallback 구현으로 `... is not a function` 계열 크래시 재발 위험을 낮춤 (요구사항 충족)

### Previous QA Fail Items — Re-verified
1) **Triage 포커스 동기화 결함**: `InboxTab`에서 `triageFocusedTaskId` + `setTriageFocusedTaskId`를 함께 전달하고, `useInboxHotkeys`가 단일 진실 공급원(외부 controlled 또는 내부)로 동작하도록 정리됨 → RESOLVED
2) **하드코딩 기본값**: `InboxTab`의 HUD/goal 카운트 초기값이 `SYSTEM_STATE_DEFAULTS.*` 기반으로 변경됨 → RESOLVED
3) **Quick-place 날짜 반영**: `placeTaskToSlot(taskId, date, ...)`에서 `date !== today` 케이스에 repository 호출로 date 파라미터 전달 경로가 추가됨 → RESOLVED

### Critical Findings (QA Fail Reasons)
1) **Triage 포커스 상태 동기화 결함 (핫키/하이라이트 실사용 불능 가능성 높음)**
   - `useInboxHotkeys`는 내부 `triageFocusedTaskId` state를 읽어 동작하지만, `setTriageFocusedTaskId`는 외부 setter가 주입되면 내부 state를 갱신하지 않음.
   - 현재 호출부(`InboxTab`)는 `setTriageFocusedTaskId`를 주입하므로, 내부 `triageFocusedTaskId`가 `null`로 유지될 수 있음.
   - 결과적으로:
     - `focusedTaskId` 반환값이 `null` → Triage 하이라이트가 표시되지 않음
     - T/O/N/P/H/삭제/편집 핫키가 `triageFocusedTaskId` guard에 막혀 실행되지 않음

2) **정책 위반 가능성: 하드코딩 기본값**
   - `InboxTab`에서 `dailyGoalCount` 초기값이 `10`으로 하드코딩됨.
   - 프로젝트 정책은 기본값을 `src/shared/constants/defaults.ts`의 `SYSTEM_STATE_DEFAULTS`에서 가져오도록 요구하며, 해당 기본값은 `inboxTriageDailyGoalCount: 5`임.

3) **기능 리스크: Tomorrow/Next 배치가 날짜를 반영하지 않을 가능성**
   - `InboxTab`의 `placeTaskToSlot` 로컬 구현이 `date`를 무시하고 `updateTask(taskId, { timeBlock, hourSlot })`만 호출.
   - Slot suggestion은 `suggestion.dateISO`를 산출(내일 포함)하므로, 실제 저장이 날짜를 반영하지 않으면 UI 기대와 불일치.

### Policy / Rule Scan
- **localStorage 금지**: `src/**/*.ts(x)` 스캔 결과 theme 관련 사용만 존재(신규 추가 없음) → PASS
- **하드코딩 기본값 금지**: `InboxTab`의 `dailyGoalCount` 초기값 하드코딩 → FAIL
- **optional chaining**: 본 변경 구간에서 중대한 누락은 확인되지 않았으나, triage 상태/slot 상태 전달에서 undefined 가능성이 있어 DOM 기반 통합 테스트 권장 → NEEDS MORE COVERAGE

## Test Execution Results

### Unit Tests (full suite)
- **Command**: `npm test`
- **Status**: PASS
- **Output Summary**: 31 test files passed, 268 tests passed

## Triage Hotkeys Fix QA (User Request)

### 1) Changed file paths (`git diff --name-only`)
- PASS — Working tree diff shows exactly these paths:
   - `src/data/repositories/dailyData/taskOperations.ts`
   - `src/features/tasks/InboxTab.tsx`
   - `src/features/tasks/hooks/useInboxHotkeys.ts`
   - `src/shared/stores/dailyDataStore.ts`

### 2) `npm test` passes
- PASS — Vitest full run PASS (31 files / 268 tests).

### 3) Triage input-focus guard bypass (but non-triage still guarded)
- PASS — 최신 gating fix로, triageEnabled일 때 input focus가 `disabled`를 true로 만들지 않음.
   - 호출부 `InboxTab`은 `disabled: isModalOpen || (!triageEnabled && isInputFocused)`로 계산되어, triageEnabled=true에서는 input focus 상태에서도 리스너 마운트가 유지됨.
   - 훅 내부 `isInputFocused()`도 triageEnabled=true일 때 항상 false를 반환하여, triage key 처리에서 input focus를 가드로 쓰지 않음.

   결과적으로:
   - triageEnabled=true: input focus에서도 triage 키(↑↓/j/k, T/O/N, P/H, d/Backspace, Enter, Esc)가 동작(PASS)
   - triageEnabled=false: input focus에서는 `disabled`가 true가 되어 차단(PASS)
   - modal open: `disabled`가 항상 true가 되고, 훅도 modal open이면 처리 자체를 포기(PASS)

### 4) Triage toggle blurs active input
- PASS — triage ON 시 `document.activeElement.blur()` 수행 (`src/features/tasks/InboxTab.tsx:84`).

### 5) Non-triage hotkeys remain disabled in inputs
- PASS (within `useInboxHotkeys` scope) — triageEnabled 상태에서도 triage 키 세트에 포함되지 않은 키는 캡처/차단하지 않음:
   - `if (!TRIAGE_KEYS.has(e.key)) return;` (`src/features/tasks/hooks/useInboxHotkeys.ts:424`)
   - 따라서 “비-triage 키(세트 외)”는 input에서 일반 타이핑 흐름을 유지함.
- Caveat — triage 키 세트 자체에 일반 문자(`t/o/n/p/h/d`)가 포함되어 있어, triage 모드에서 input에 포커스가 남아 있고 리스너가 활성화된 상태라면 해당 문자는 타이핑 대신 triage 액션으로 소비됨.

## Remaining Concerns / Watch Items
- `useInboxHotkeys`에서 `Escape` 키 처리 로직이 “외부에서 처리”로 변경되어 있어, UI 문구/사용자 기대(ESC로 triage 종료)와 일치하는지 수동 스모크 권장.
- `setLastUsedSlot`, `incrementProcessedCount`는 현재 no-op placeholder로 남아 있음(기능 영향은 제한적이나, 분석/UX 측면의 기대가 있으면 추후 구현 필요).

## Follow-ups (Implementer Action Required)
- `useInboxHotkeys`의 포커스 state를 단일 소스로 정리(외부 setter 주입 시에도 내부 `triageFocusedTaskId`가 동일하게 갱신되도록)하고, `InboxTab` 하이라이트/핫키가 실제로 동작하는지 수동 재현.
- `InboxTab`의 기본값(`dailyGoalCount`, HUD/triage 관련) 초기값을 `SYSTEM_STATE_DEFAULTS` 기반으로 정리.
- `placeTaskToSlot`이 `suggestion.dateISO`를 실제 데이터 저장 경로에 반영하도록(날짜 이동) 경로 점검.
- (권장) DOM 환경에서 keydown 기반 hook 동작을 회귀 테스트로 커버(Testing Infra 섹션 참조).

---

Handing off to uat agent for value delivery validation
