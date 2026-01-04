---
ID: 61
Origin: 61
UUID: d3b9a4e2
Status: Active
---

## Changelog
- 2026-01-03: Created plan from analysis 061; focuses on closing skipped/placeholder tests and adding minimal missing coverage for error/warn branches.

## Value Statement and Business Objective
As a user, I want task move/aggregation operations to be reliable even in edge/error conditions, so that core scheduling flows (inbox triage → time block placement) remain data-safe and predictable.

## Objective
Strengthen unit coverage for `unifiedTaskService` by closing the known gaps without restructuring the existing test suite.

## Target Release
- 1.0.182 (aligns with the current foundation batch plans; current `package.json` is 1.0.181)

## Scope
- In scope: add/adjust tests in `tests/unified-task-service.test.ts` for non-optimistic move paths, move error wrapping codes, and `getUncompletedTasks` error propagation.
- Out of scope: any production code changes in `src/shared/services/task/unifiedTaskService.ts`.

## Plan (PR3)

### Task T70-01: moveInboxToBlock non-optimistic not_found 커버리지 복구
- 대상: `tests/unified-task-service.test.ts`
- 작업:
  1. `it.skip` 상태인 `moveInboxToBlock returns false when task not in inbox (non-optimistic)`를 활성화한다.
  2. 해당 테스트가 다른 테스트의 mock 잔여값에 영향을 받지 않도록, 테스트 내에서 필요한 repository/store mock 반환값을 명시적으로 세팅해 독립 실행 가능하게 만든다(구조 유지).
- 검증: `npm test` 통과

### Task T70-02: moveBlockToInbox non-optimistic 성공 경로 assert 추가(placeholder 제거)
- 대상: `tests/unified-task-service.test.ts`
- 작업:
  1. placeholder로 남아있는 `moveBlockToInbox with optimistic=false calls repo when task found`를 실제 동작 검증으로 교체한다(테스트 이름/describe 구조 유지).
  2. 비-optimistic 모드에서 `updateDailyTask` 호출과 store refresh 호출이 발생하는지를 검증한다.
- 검증: `npm test` 통과

### Task T70-03: moveInboxToBlock 에러 코드 래핑(TASK_MOVE_INBOX_TO_BLOCK_FAILED) 검증
- 대상: `tests/unified-task-service.test.ts`
- 작업:
  1. 비-optimistic `moveInboxToBlock` 경로에서 repository 에러가 발생했을 때 표준 에러 코드 `TASK_MOVE_INBOX_TO_BLOCK_FAILED`가 노출되는지 검증하는 테스트를 추가한다.
- 검증: `npm test` 통과

### Task T70-04: moveBlockToInbox 에러 코드 래핑(TASK_MOVE_BLOCK_TO_INBOX_FAILED) 검증
- 대상: `tests/unified-task-service.test.ts`
- 작업:
  1. 비-optimistic `moveBlockToInbox` 경로에서 repository 에러가 발생했을 때 표준 에러 코드 `TASK_MOVE_BLOCK_TO_INBOX_FAILED`가 노출되는지 검증하는 테스트를 추가한다.
- 검증: `npm test` 통과

### Task T70-05: getUncompletedTasks 에러 전파(TASK_GET_ALL_ACTIVE_FAILED) 검증
- 대상: `tests/unified-task-service.test.ts`
- 작업:
  1. `getAllActiveTasks`가 실패하는 조건을 유발하고, `getUncompletedTasks`가 동일 에러(코드 포함)를 전파하는지 검증하는 테스트를 추가한다.
- 검증: `npm test` 통과

### Task T70-06: (Low) getRecentDates 간접 커버리지 보강
- 대상: `tests/unified-task-service.test.ts`
- 작업:
  1. `findTaskLocation`의 “recent 7 days fallback search” 테스트를 보강해, 최소 1회 이상 과거 날짜 조회가 실제로 발생했음을 간접적으로 확인한다(내부 helper 직접 테스트는 지양).
- 검증: `npm test` 통과

### Task T70-99: Version & Release Artifacts 정합(배치 기준)
- 대상: 문서/릴리즈 프로세스
- 작업:
  1. 본 PR3 단위에서는 `package.json` 버전 bump를 하지 않는다(상위 배치 Target Release 1.0.182에서 처리).
  2. PR 설명/체인지 요약에 “unifiedTaskService 테스트 강화(비-optimistic move 경로 + move 에러 코드 + getUncompletedTasks 에러 전파)”를 포함한다.
- 검증: `npm test` 통과

## Dependencies
- T70-01 → T70-03 (non-optimistic 안정화 후 에러 래핑 테스트 추가)
- T70-02 → T70-04 (성공 경로 확정 후 에러 래핑 테스트 추가)

## Validation
- Primary gate: `npm test`
- Optional local confirmation: `npx vitest run tests/unified-task-service.test.ts`

## Risks / Notes
- ESM import 캐시/공유된 mock 상태로 인해 비-optimistic 경로가 flaky할 수 있으므로, 각 테스트가 필요한 mock 반환값을 독립적으로 선언하는 방향을 우선한다(테스트 구조는 유지).
