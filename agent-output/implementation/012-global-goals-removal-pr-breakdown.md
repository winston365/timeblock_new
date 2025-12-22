# Implementation: Weekly Goals Only — Global Goals 레거시 전체 제거 (PR Breakdown)

## Plan Reference
- Plan: agent-output/planning/012-global-goals-removal-pr-breakdown.md
- Plan ID: plan-2025-12-21-remove-global-goals
- Target Release: Release A (1.0.164)

## Date
- 2025-12-21

## Changelog
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-21 | Implementer | Release A PR#1/#2/#3/#5 범위에서 global goals 런타임/동기화/UI 경로 제거 + 잔재 정리 + 버전 1.0.164 반영 |

## Implementation Summary
- Global goals 관련 런타임 파이프라인(핸들러/이벤트/구독자)과 UI 연결(선택/표시/색상)을 제거하여 weekly goals만 남는 UX/실행 경로를 보장했습니다.
- Firebase 초기 fetch 및 Dexie 초기 병합에서 globalGoals를 읽거나 쓰는 경로를 제거하여, 원격에 남아있는 과거 `globalGoals` 노드는 “안전하게 무시”되도록 했습니다.
- PR#5로 남아있던 레거시 파일(Goal store/subscriber/handler/repository/UI) 및 문서/타입 잔재를 정리했고, `EventBus` 타입 파일의 손상(미닫힘 주석/깨진 매핑)을 복구했습니다.

## Milestones Completed
- [x] PR#1: task completion pipeline/emit/subscriber에서 global goals 업데이트 경로 제거
- [x] PR#2: TaskModal/Timeline/TaskCard에서 global goals 선택·표시 제거, 신규 저장 시 goalId null 강제
- [x] PR#3: Firebase/Dexie sync에서 globalGoals write 제거 + read는 무시(호환)
- [x] PR#5: goal 이벤트/타입/문서/미사용 UI/파일 삭제, 전역 사용처 0 보장
- [x] Release A 버전: package.json 1.0.164 반영

## Files Modified
| Path | Changes |
|---|---|
| src/shared/lib/eventBus/types.ts | 손상된 타입 정의 복구, 실제 사용 이벤트 기반 EventTypeMap 재구성, goal 이벤트 제거 |
| src/shared/lib/eventBus/index.ts | 제거/추가된 이벤트 타입 export 정리 |
| src/shared/lib/eventBus/README.md | goal 이벤트/goalSubscriber 언급 제거, 사용 현황 표 최신화 |
| src/shared/services/gameplay/taskCompletion/taskCompletionService.ts | 주석 정리(GoalProgressHandler 제거 반영) |
| src/shared/services/gameplay/taskCompletion/README.md | goalProgressHandler 언급 제거 및 예시/흐름 최신화 |
| src/shared/subscribers/index.ts | goalSubscriber 문서 잔재 제거 |
| src/features/goals/GoalsModal.tsx | 삭제된 레거시 컴포넌트 관련 주석 정리 |
| src/data/db/README.md | globalGoals 테이블을 레거시/미사용으로 명시 |
| tests/task-completion.test.ts | GoalProgressHandler 제거 반영(안정적 순서/에러 테스트 수정) |
| tests/task-completion-handlers.test.ts | GoalProgressHandler 단위 테스트 제거 |
| package.json | version 1.0.164로 업데이트 |

## Files Created
- (없음)

## Files Deleted
| Path | Purpose |
|---|---|
| src/shared/subscribers/goalSubscriber.ts | goal:progressChanged 기반 진행 재계산 구독자(레거시) 제거 |
| src/shared/stores/goalStore.ts | global goals Zustand store(레거시) 제거 |
| src/shared/services/gameplay/taskCompletion/handlers/goalProgressHandler.ts | task completion에서 goal 재계산 핸들러(레거시) 제거 |
| src/data/repositories/globalGoalRepository.ts | Dexie globalGoals CRUD/recalculate(레거시) 제거 |
| src/data/repositories/dailyGoalRepository.ts | daily goals 레거시 repo 제거 |
| src/features/goals/GoalPanel.tsx | global goals UI(레거시) 제거 |
| src/features/goals/GoalModal.tsx | global goals UI(레거시) 제거 |

## Code Quality Validation
- [x] TypeScript errors: VS Code problems 기준 `src/**`, `tests/**` 오류 0
- [x] Lint: `npm run lint` 실행
- [x] Tests: `npm test` 실행

## Value Statement Validation
- Original: weekly goals만 유지하고 global goals 레거시를 완전 제거하여 백그라운드 비용/혼란/회귀 위험을 낮춘다.
- Delivered:
  - 런타임에서 global goals 진행 업데이트 경로(핸들러/이벤트/구독자/스토어)가 제거되어 “보이지 않지만 계속 돌아가는” 작업이 중단됨
  - UI에서 goal 태깅/표시가 제거되어 weekly goals만 남는 UX로 단순화됨
  - 동기화/초기화에서 globalGoals를 읽거나 쓰지 않아 과거 데이터가 남아도 안전하게 무시됨

## Test Coverage
- Unit/Integration: 기존 Vitest 스위트 내 taskCompletion 관련 테스트가 변경사항을 커버하도록 업데이트됨

## Test Execution Results
- `npm test`: 24 files, 122 tests passed
- `npm run lint`: 성공(에러/경고 0)

## Outstanding Items
- (없음) — Release A 범위에서 계획된 PR#1/#2/#3/#5 완료

## Next Steps
- QA: Release A 회귀 검증(부팅/동기화/스케줄·인박스·weekly goals 핵심 플로우)
- UAT: 실제 사용자 시나리오로 goal 관련 크래시/SyncLog 이상 여부 확인
