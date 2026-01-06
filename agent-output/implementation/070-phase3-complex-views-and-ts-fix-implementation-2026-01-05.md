---
ID: 70
Origin: 70
UUID: 9e4b2d71
Status: Active
---

# Phase 3 (Complex Views) + TS Fix — Implementation

## Plan Reference
- Baseline plan: `agent-output/planning/070-refactor-3phase-refactoring-plan-v1.0.md`
- Note: 본 작업에는 플랜 Phase 3 범위를 넘어서는(사용자 요청 기반) ScheduleView/FocusView 추가 분리가 포함됩니다.

## Date
- 2026-01-05

## Changelog
| Date | Request | Summary |
|---|---|---|
| 2026-01-05 | UserRequest | TS2677 수정 + Schedule/Focus/TempScheduleTimelineView 로직 분리 |

## Implementation Summary
- TS2677(TimeBlockId가 `null` 포함) 타입 가드 오류를 수정하여 `tsc --noEmit`이 통과하도록 합니다.
- ScheduleView에서 워밍업/자동삽입/상태 초기화/이동 등 오케스트레이션을 훅/서비스로 이동해 UI에서 Firebase/Dexie 직접 호출을 제거합니다.
- FocusView에서 음악 로직과 작업/타이머 제어 로직을 별도 훅으로 분리해 컴포넌트 책임을 축소합니다.
- TempScheduleTimelineView에서 드래그/생성 프리뷰 계산을 순수 유틸로 분리합니다.

## Milestones Completed
- [x] Step 0: TS 에러(TS2677) 해결
- [x] Step 1: ScheduleView 오케스트레이션 분리
- [x] Step 2: FocusView 음악/작업제어 분리
- [x] Step 3: TempScheduleTimelineView 드래그/수학 유틸 분리(추가)
- [x] Step 4: 테스트/타입체크/커버리지 검증

## Files Modified
| Path | Summary |
|---|---|
| src/features/tasks/utils/taskParsing.ts | TimeBlockId 타입 가드(TS2677) 수정 |
| src/features/tempSchedule/components/TempScheduleTimelineView.tsx | 드래그/생성 프리뷰 계산을 유틸 호출로 전환 |
| src/features/schedule/ScheduleView.tsx | warmup/sync/orchestration 훅으로 분리, UI에서 Firebase 직접 호출 제거 |
| src/features/schedule/components/FocusView.tsx | 음악/작업제어 로직을 focus 훅으로 분리 |

## Files Created
| Path | Purpose |
|---|---|
| src/features/tempSchedule/utils/timelineCalculations.ts | 타임라인 드래그/생성 관련 순수 계산 유틸 |
| src/features/schedule/services/scheduleOrchestrator.ts | warmup preset Firebase sync + systemState 로드/저장 오케스트레이터 |
| src/features/schedule/hooks/useScheduleSync.ts | ScheduleView 오케스트레이션 훅(워밍업/자동삽입/초기화/미완료 이동) |
| src/features/focus/hooks/useMusicPlayer.ts | 음악 플레이어 상태/최초 로드 캡슐화 |
| src/features/focus/hooks/useTaskControl.ts | 작업 완료/자동완료/휴식 타이머 로직 캡슐화 |

## Code Quality Validation
- [x] TypeScript: `npx tsc --noEmit --pretty false`
- [x] Unit/Integration: `npm test`
- [x] Coverage: `npm run test:coverage`

## Value Statement Validation
- Original intent: 큰 컴포넌트에서 오케스트레이션/비-UI 로직을 분리해 유지보수성과 회귀 리스크를 낮춘다.
- Delivered: UI 컴포넌트에서 Firebase/Dexie 직접 호출 및 드래그 수학 로직을 분리했고, 타입체크/테스트/커버리지를 통과했다.

## Test Coverage
- Existing suites 중심으로 회귀 확인(타임라인 관련 단일 테스트 + 전체 test/coverage).

## Test Execution Results
- `npx tsc --noEmit --pretty false`: PASS
- `npx vitest run tests/timeline-positioning.test.ts --reporter verbose`: PASS
- `npm test`: PASS
- `npm run test:coverage`: PASS

## Outstanding Items
- (확인 필요) 사용자 요청의 ScheduleView/FocusView 분리가 플랜 070 Phase 3 범위 밖이므로, 최종적으로는 플랜 문서 업데이트/승인이 필요할 수 있습니다.

## Next Steps
- QA → UAT 게이트 진행
