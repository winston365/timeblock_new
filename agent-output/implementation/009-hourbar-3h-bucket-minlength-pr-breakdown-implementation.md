# Implementation — HourBar 삭제(3시간 버킷 UI) + 작업 제목 10자 제한 제거 (Option A)

## Plan Reference
- agent-output/planning/009-hourbar-3h-bucket-minlength-pr-breakdown.md
- Plan ID: plan-2025-12-20-hourbar-3h-bucket-minlength

## Date
- 2025-12-20

## Changelog table
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-20 | User request | PR#1: schedule 작업 제목 10자 최소 제한 제거(공백-only 차단 유지). PR#2: Schedule에서 HourBar 렌더 제거, 3시간 버킷 단위 표시/추가/드롭으로 통일(모델 hourSlot 유지). 유틸 테스트 추가 및 vitest 통과 확인. |

## Implementation Summary
- PR#1: schedule feature 내부에서 작업 제목의 최소 10자 제한을 제거하고(단, `trim()` 후 빈 문자열은 계속 차단), UI 카피(placeholder/토스트)의 “10자 이상” 언급을 제거했습니다.
- PR#2: Schedule 표면에서 1시간 단위 HourBar 렌더/접힘 개념을 제거하고, 3시간 버킷(`floor(hour/3)*3`) 단위로만 작업이 표시/추가/드롭되도록 `TimeBlockContent`를 교체했습니다.
- 모델(`Task.hourSlot`)은 유지하고, 표시만 버킷으로 그룹화합니다. 드래그/드롭 payload에는 `sourceBucketStart`를 추가해(기존 `sourceHourSlot` 유지) 버킷 기준 same-location 판정이 안전하게 동작하도록 했습니다.

## Milestones Completed
- [x] PR#1: title minlength(10) 제한 제거 + 카피 정리
- [x] PR#2: Schedule HourBar 렌더 제거 + 3시간 버킷 UI로 표시/추가/드롭 통일
- [x] 순수 유틸 분리(`getBucketStartHour` 등) + vitest 추가
- [x] `npm test` 실행 및 통과

## Files Modified
| Path | Changes |
|---|---|
| src/features/schedule/TaskModal.tsx | 제목 10자 최소 제한 제거(공백-only 차단 유지) |
| src/features/schedule/components/FocusView.tsx | 제목 10자 최소 제한 제거 + placeholder 카피 정리 |
| src/features/schedule/HourBar.tsx | 제목 10자 최소 제한 제거(Phase 1에서 렌더 제거되지만 PR#1 범위로 정리) |
| src/features/schedule/components/TimeBlockContent.tsx | HourBar 렌더 제거 → 3시간 버킷 렌더로 교체 |
| src/features/schedule/ScheduleView.tsx | TimeBlockContent/HourBar 태그 의존 제거(렌더/props 정리) |
| src/features/schedule/TimeBlock.tsx | hourSlot tag 관련 props 정리(3h 버킷 렌더로 전환) |
| src/features/schedule/hooks/useDragDropManager.ts | DragData에 `sourceBucketStart` 추가 + same-location 판정 개선 |
| src/features/schedule/hooks/useDragDrop.ts | drag payload에 `sourceBucketStart` 포함 |
| src/features/schedule/TaskCard.tsx | drag payload에 `sourceBucketStart` 포함 |

## Files Created
| Path | Purpose |
|---|---|
| src/features/schedule/utils/threeHourBucket.ts | 3시간 버킷 계산 유틸(표현/스냅 단일 출처) |
| src/features/schedule/components/ThreeHourBucket.tsx | Schedule 내부 3시간 버킷 단위 렌더/추가/드롭 컴포넌트 |
| tests/three-hour-bucket-utils.test.ts | 버킷 유틸 단위 테스트 |

## Code Quality Validation
- [x] TypeScript `any` 신규 도입 없음
- [x] optional chaining 유지/보강
- [x] localStorage 신규 사용 없음
- [x] 테스트 추가(순수 유틸)로 UI TSX 테스트 강요 회피

## Value Statement Validation
- Original: “작업 제목을 짧게도 추가할 수 있고, 일정 화면에서 1시간 HourBar 없이 3시간 단위로만 작업을 추가/표시”
- Delivered:
  - 제목 1~9자도 Schedule/Focus/HourBar 입력에서 정상 입력 가능(공백-only는 차단).
  - Schedule(TimeBlockContent)에서 HourBar가 더 이상 렌더되지 않고, 3시간 버킷 단위로만 작업이 표시/추가/드롭됨.

## Test Coverage
- Unit: tests/three-hour-bucket-utils.test.ts
- Integration/Smoke: 기존 vitest 전체 스위트

## Test Execution Results
- Command: `npm test`
- Result: PASS (Test Files 19 passed, Tests 107 passed)

## Outstanding Items
- Phase2(요청 범위 밖): Focus/Timeline/Battle에서 “현재 시간대” 의미를 3시간 버킷으로 통일하는 정합 작업은 미수행(요청대로 런타임/임포트 깨짐 방지 범위를 넘어가지 않음).

## Next Steps
- QA: 변경된 Schedule 화면에서 버킷 단위 추가/드롭/재정렬 수동 스모크 확인
- UAT: 실제 사용 흐름에서 “10자 이상” 카피/제약이 남아있는지 최종 확인
