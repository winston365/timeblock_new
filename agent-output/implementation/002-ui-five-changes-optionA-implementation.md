# UI 5개 변경 구현 문서 (Option A)

## Plan Reference
- Plan ID: plan-2025-12-17-ui-5changes
- Plan File: [006-ui-five-changes-optionA-plan.md](../planning/006-ui-five-changes-optionA-plan.md)

## Date
- 2025-12-17

## Changelog
| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2025-12-17 | Initial | Phase 1~5 UI 변경 구현 | DailyXPBar 제거, 인벤토리 탭 제거, 주간 뷰 구분선, 월간 달력 정렬, 오늘 목표 UI 제거 |

## Implementation Summary

### Value Statement Delivery
사용자가 불필요한 진입점/시각적 부담(오늘 목표 UI, 상단 XP바, 가방 탭)을 제거하고 임시스케줄(월/주간) 가독성을 개선하여 오늘 해야 할 일에 더 빨리 집중하고 화면 인지 부하를 줄일 수 있게 되었습니다.

### Phase별 구현 내용

#### Phase 1: TopToolbar DailyXPBar 제거
- AppShell에서 `<DailyXPBar>` 컴포넌트 렌더링 제거
- import 문 제거 (컴포넌트 파일은 유지)
- XP 숫자/기타 XP 이펙트는 유지됨

#### Phase 2: 우측 사이드바 인벤토리 탭 제거
- RightPanel에서 inventory 탭 버튼 및 패널 제거
- Props 타입에서 `'inventory'` 제거 (`'shop'`만 유지)
- AppShell의 `rightPanelTab` 상태 타입 업데이트
- InventoryPanel import 제거 (컴포넌트 파일은 유지)
- gameStateStore 의존성 제거 (inventoryTotal 미사용)

#### Phase 3: TempSchedule 주간 뷰 시간별 구분선 추가
- DayColumn 컴포넌트 내 스케줄 블록 영역에 시간별 구분선 추가
- `pointer-events: none` 적용으로 드래그&드롭 방해 방지
- z-index 0으로 설정하여 블록보다 아래 레이어 유지
- 기존 토큰 사용: `border-[var(--color-border)]/20`

#### Phase 4: TempSchedule 월간 달력 정렬 수정
- 헤더를 `flex` → `grid grid-cols-7`로 변경
- 캘린더 셀 행을 `flex` → `grid grid-cols-7`로 변경
- 불필요한 `<div className="flex-1">` 래퍼 제거
- 헤더와 바디가 동일한 CSS Grid 레이아웃으로 정확히 정렬됨

#### Phase 5: GoalsModal 오늘 목표 탭 제거
- 탭 UI 완전 제거 (장기 목표만 표시)
- activeTab 상태 제거 (불필요)
- Daily Goal 관련 상태/핸들러 제거
- GoalPanel, GoalModal import 제거 (컴포넌트 파일은 유지)
- 모달 설명 텍스트 수정: "장기 목표를 관리하세요."
- ESC 닫기 동작 유지

## Milestones Completed
- [x] Phase 1: DailyXPBar UI 제거
- [x] Phase 2: 인벤토리 탭 진입 UI 제거
- [x] Phase 3: 주간 뷰 시간별 구분선 추가
- [x] Phase 4: 월간 달력 헤더-바디 정렬 수정
- [x] Phase 5: GoalsModal 오늘 목표 UI 제거

## Files Modified
| Path | Changes | Lines Changed |
|------|---------|---------------|
| [src/app/AppShell.tsx](../../src/app/AppShell.tsx) | DailyXPBar 제거, rightPanelTab 타입 수정 | ~10 |
| [src/app/components/RightPanel.tsx](../../src/app/components/RightPanel.tsx) | 인벤토리 탭 제거, Props 타입 수정 | ~50 |
| [src/features/tempSchedule/components/WeeklyScheduleView.tsx](../../src/features/tempSchedule/components/WeeklyScheduleView.tsx) | 시간별 구분선 추가 | ~10 |
| [src/features/tempSchedule/components/MonthlyScheduleView.tsx](../../src/features/tempSchedule/components/MonthlyScheduleView.tsx) | flex → grid 레이아웃 변경 | ~15 |
| [src/features/goals/GoalsModal.tsx](../../src/features/goals/GoalsModal.tsx) | 오늘 목표 탭/관련 코드 제거 | ~70 |

## Files Created
(없음)

## Code Quality Validation
- [x] TypeScript 컴파일 오류 없음
- [x] ESLint 경고/오류 없음 (변경 파일 기준)
- [x] 모든 기존 테스트 통과
- [x] 기존 컴포넌트 파일 유지 (삭제 없음, 재사용 가능성 보존)

## Value Statement Validation
- **Original**: "사용자가 불필요한 진입점/시각적 부담을 제거하고 임시스케줄 가독성을 개선해서 오늘 해야 할 일에 더 빨리 집중하고 화면 인지 부하를 줄일 수 있다."
- **Implementation Delivers**: 
  - DailyXPBar 제거 → 상단 영역 간소화
  - 인벤토리 탭 제거 → 우측 패널 단순화
  - 오늘 목표 탭 제거 → 목표 모달 단순화
  - 주간 뷰 구분선 → 시간대 가독성 향상
  - 월간 달력 정렬 → 레이아웃 일관성 확보

## Test Coverage
- **Unit Tests**: 기존 94개 테스트 모두 통과
- **Integration Tests**: UI 변경은 기존 테스트 범위 외

## Test Execution Results
```
npm test

 RUN  v3.2.4 E:/git/timeblock_new

 ✓ tests/event-bus.test.ts (7 tests) 13ms
 ✓ tests/firebase-sanitizer.test.ts (6 tests) 6ms
 ✓ tests/sync-retry-queue.test.ts (5 tests) 9ms
 ✓ tests/sync-logger.test.ts (4 tests) 77ms
 ✓ tests/conflict-resolver.test.ts (8 tests) 17ms
 ✓ tests/timeblock-visibility.test.ts (20 tests) 8ms
 ✓ tests/store-utils.test.ts (16 tests) 19ms
 ✓ tests/unified-task-service.test.ts (8 tests) 131ms
 ✓ tests/sync-core.test.ts (6 tests) 214ms
 ✓ tests/task-completion-handlers.test.ts (6 tests) 266ms
 ✓ tests/task-completion.test.ts (4 tests) 350ms
 ✓ tests/time-block-visibility.test.ts (3 tests) 6ms
 ✓ tests/battle-mission-tier.test.ts (1 test) 3ms

 Test Files  13 passed (13)
      Tests  94 passed (94)
   Duration  1.48s
```

## Outstanding Items

### Incomplete Items
(없음)

### Known Issues
(없음)

### Deferred Items
- 미사용 컴포넌트 파일 삭제 보류 (DailyXPBar, InventoryPanel, GoalPanel, GoalModal)
  - 이유: 향후 재활성화 가능성, 현 단계에서는 UI 진입점만 제거

### Test Failures
(없음)

### Missing Coverage
- UI 시각적 테스트 (Storybook/Playwright 등): 현재 테스트 인프라에 미포함

## Constraints Compliance
- [x] 프론트/UI만 변경 (Backend/Supabase/Electron IPC 미변경)
- [x] 디자인 시스템 토큰만 사용 (새 색상/폰트/그림자 하드코딩 없음)
- [x] 모달 UX 규칙 준수 (배경 클릭 닫기 금지, ESC 닫기 유지)
- [x] localStorage 미사용
- [x] optional chaining 사용
- [x] SETTING_DEFAULTS 단일 출처 유지

## Next Steps
1. QA 검증 → QA 팀에서 시각적/기능적 검증
2. UAT 검증 → 사용자 관점에서 UI 변경 확인
3. (선택) 미사용 컴포넌트 정리 PR 별도 진행
