# Implementation — 3시간 버킷 UI 통일 (PR#1~#3)

## Plan Reference
- agent-output/planning/009-three-hour-ui-unification-pr-plan.md
- Plan ID: plan-2025-12-20-three-hour-ui-unification-pr-plan

## Date
- 2025-12-20

## Changelog table
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-20 | User: “Planner PR#1~#3 계획대로 실제 코드를 변경” | 3시간 버킷 유틸/정책 단일화, DnD 타겟 정규화, Focus/Timeline/Mission의 seed/라벨/제약(버킷당 3개) 통일, 레거시 HourBar/태그 경로 잔재 최소 정리, 테스트/린트 통과 |

## Implementation Summary
- **Value**: Focus/Timeline/Mission 등 시간 기반 화면이 ‘3시간 버킷’ 기준으로 동일하게 보이고 동작하도록 맞춰, 화면별 1시간/3시간 혼재로 인한 오배치·정책 불일치를 줄였습니다.
- **How**: `Task.hourSlot` 저장 모델은 유지하면서, 모든 입력(클릭 seed/드롭 타겟)을 `bucketStartHour`로 정규화하고, 표시/필터링은 `getBucketStartHour(task.hourSlot)`로 버킷 기준 그룹화되도록 수정했습니다.
- **Policy**: “3개 제한”을 **버킷당 3개**로 통일하고, 공통 유틸(`MAX_TASKS_PER_BUCKET`, `isBucketAtCapacity`, `countItemsInBucket`)로 재사용하게 했습니다.

## Milestones Completed
- [x] PR#1: 버킷 정규화/라벨/정책 공통화 + 유닛 테스트 추가
- [x] PR#2: FocusView 버킷 기준 라벨/필터/seed/제약 통일
- [x] PR#3: TimelineView + MissionModal 버킷 seed/드롭/툴팁 + HourBar 잔재(상태 키/props 경로) 최소 정리
- [x] 품질 게이트: `npm test` PASS, `npm run lint` PASS(경고 0)

## Files Modified
| Path | Changes |
|---|---|
| src/features/schedule/utils/threeHourBucket.ts | (신규 유틸 사용처 확대) 버킷 라벨/정규화/정책/카운트 단일 출처 제공 |
| src/features/schedule/hooks/useDragDropManager.ts | DragData에 `sourceBucketStart` 추가, same-location을 버킷 정규화 기준으로 결정론화 |
| src/features/schedule/hooks/useDragDrop.ts | drag payload에 `sourceBucketStart` 포함, drop hourSlot을 버킷 정규화 값으로 저장 |
| src/features/schedule/components/FocusView.tsx | 현재 1시간 기준 → 현재 3시간 버킷 기준 라벨/필터/추가 seed/제약/타이머 total 통일 |
| src/features/schedule/TimelineView/TimelineView.tsx | 클릭/드롭/모달 seed 버킷 스냅, 버킷당 3개 제한 적용, 하드코딩 기본값 제거(TASK_DEFAULTS) |
| src/features/schedule/TimelineView/TimelineTaskBlock.tsx | tooltip/라벨을 버킷 range 표기로 통일 |
| src/features/battle/components/MissionModal.tsx | “현재 추가” seed/토스트를 버킷 기준으로 통일 + 버킷당 3개 제한 |
| src/data/repositories/systemRepository.ts | HourBar 잔재 시스템 키 정리(사용 경로 제거에 맞춤) |
| src/features/schedule/TaskModal.tsx | 제목 10자 제한 제거 유지 + 초기 기본값을 `TASK_DEFAULTS`로 정규화 |
| src/features/schedule/HourBar.tsx | 레거시 파일 유지하되 상수 하드코딩 제거(공통 `MAX_TASKS_PER_BUCKET` 사용) |
| src/features/schedule/ScheduleView.tsx / TimeBlock.tsx / components/TimeBlockContent.tsx | HourBar/시간대 태그 관련 props/렌더 경로 정리 및 3시간 버킷 렌더 경로 유지 |

## Files Created
| Path | Purpose |
|---|---|
| src/features/schedule/utils/threeHourBucket.ts | 3시간 버킷 정책/정규화/표기 단일 소스 |
| tests/three-hour-bucket-utils.test.ts | 버킷 유틸(라벨/정규화/정책) 유닛 테스트 |
| tests/drag-drop-location-utils.test.ts | DnD same-location 버킷 정규화 계약 리그레션 테스트 |
| src/features/schedule/components/ThreeHourBucket.tsx | 스케줄 표면에서 3시간 버킷 단위 추가/드롭/렌더 컴포넌트 |

## Code Quality Validation
- [x] TypeScript: 신규 `any` 도입 없음
- [x] Optional chaining: 중첩 상태 접근 안전 패턴 유지
- [x] Defaults: `TASK_DEFAULTS` 등 단일 출처 사용(하드코딩 제거)
- [x] Modal UX: 배경 클릭 닫기 변경 없음, ESC 닫기(`useModalEscapeClose`) 유지

## Value Statement Validation
- Original: “Focus/Timeline/Mission 등 모든 시간 기반 화면이 동일한 3시간 버킷 기준으로 보여지고 동작한다(단, hourSlot 모델은 유지).”
- Delivered:
  - 표시/필터/툴팁이 버킷 range를 기준으로 일관되게 정렬/표시됨
  - 생성/드롭/모달 seed가 버킷 시작 시각으로 정규화되어 화면 간 오배치 감소
  - 버킷당 3개 제한이 주요 진입점에서 동일 정책으로 적용됨

## Test Coverage
- Unit
  - tests/three-hour-bucket-utils.test.ts
  - tests/drag-drop-location-utils.test.ts

## Test Execution Results
- `npm test`
  - Result: PASS (20 files / 111 tests)
- `npm run lint`
  - Result: PASS (`--max-warnings 0`, `LINT_OK` 확인)

## Outstanding Items
- HourBar 파일 자체는 현재 `src` 내 참조가 없어 런타임 영향은 없으나, 완전 삭제는 별도 정리 PR로 분리하는 편이 안전합니다(현재는 정책 상수만 중앙화).

## Next Steps
- QA: Focus/Timeline/Mission에서 “버킷당 3개 제한”과 “버킷 스냅”이 UX 기대대로 동작하는지 수동 스모크
- UAT: 실제 사용 플로우에서 버킷 라벨/툴팁/토스트 문구가 혼란 없는지 확인
