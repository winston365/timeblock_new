# QA Report: UI 5개 변경 — PR 단위 작업 분해(적용분 검증)

**Plan Reference**: `agent-output/planning/007-ui-five-changes-pr-breakdown.md`
**QA Status**: QA Failed
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-20 | Implementer | PR#1/PR#2 적용 후 QA 검증 | 스케줄 HourBar→3시간 버킷 전환/10자 제한 제거/드래그 payload 변경 점검. `npm test` PASS, `npm run lint` FAIL(경고 3건). |

## Timeline
- **Test Strategy Started**: 2025-12-20 08:50
- **Test Strategy Completed**: 2025-12-20 08:52
- **Implementation Received**: 2025-12-20 (요청에 포함)
- **Testing Started**: 2025-12-20 08:52
- **Testing Completed**: 2025-12-20 08:54
- **Final Status**: QA Failed

## Test Strategy (Pre-Implementation)
> 주: 요청의 “PR#1/PR#2”는 본 플랜 문서의 PR#1/PR#2와 범위가 다를 수 있으나, 이번 QA는 실제 적용된 스케줄 관련 변경(3시간 버킷, HourBar 제거, 제목 제한 제거, 드래그 페이로드 호환)을 기준으로 사용자 영향 중심으로 검증함.

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- vitest (repo 기존 설정 사용)

**Testing Libraries Needed**:
- (추가 없음)

**Configuration Files Needed**:
- (추가 없음)

**Build Tooling Changes Needed**:
- (추가 없음)

### Required Unit Tests
- 3시간 버킷 유틸(`getBucketStartHour`, `getBucketStartHoursForBlock`, `getEffectiveHourSlotForBucketInBlock`) 경계값
- 드래그 payload가 기존 필드(`sourceHourSlot`)를 유지하며 확장 필드(`sourceBucketStart`) 추가로 역호환되는지

### Required Integration Tests
- 스케줄 표면에서 3시간 버킷 렌더링 경로(TimeBlockContent→ThreeHourBucket)
- 드래그 드롭이 “버킷 단위”로만 목적지를 제공하는지(시간 슬롯 단위 UI 잔존 여부)

### Acceptance Criteria
- `npm test`(vitest) 전체 PASS
- `npm run lint` PASS(현재는 `--max-warnings 0`이므로 경고도 0이어야 함)
- 작업 제목 10자 제한 제거(단, 공백 제외 1자 이상은 유지)
- 스케줄 표면에서 3시간 단위로만 표시/추가/드롭 가능

## Implementation Review (Post-Implementation)

### Code Changes Summary
- 10자 제한 제거:
  - src/features/schedule/TaskModal.tsx
  - src/features/schedule/components/FocusView.tsx
  - src/features/schedule/HourBar.tsx
- 3시간 버킷 UI 도입 및 HourBar 경로 제거:
  - src/features/schedule/components/TimeBlockContent.tsx (HourBar→ThreeHourBucket)
  - src/features/schedule/components/ThreeHourBucket.tsx (신규)
  - src/features/schedule/utils/threeHourBucket.ts (신규)
- Drag payload 확장(버킷 단위 동일 위치 판정 지원):
  - src/features/schedule/hooks/useDragDropManager.ts (`sourceBucketStart?: number` 추가, isSameLocation 로직 확장)
  - src/features/schedule/TaskCard.tsx, src/features/schedule/hooks/useDragDrop.ts (setDragData에 sourceBucketStart 포함)
- 태그/HourSlot tag 관련 props 제거:
  - src/features/schedule/ScheduleView.tsx, src/features/schedule/TimeBlock.tsx, src/features/schedule/components/TimeBlockContent.tsx
- 테스트 추가:
  - tests/three-hour-bucket-utils.test.ts (신규)

## Test Coverage Analysis

### New/Modified Code
| File | Function/Class | Test File | Test Case | Coverage Status |
|------|---------------|-----------|-----------|-----------------|
| src/features/schedule/utils/threeHourBucket.ts | getBucketStartHour/getBucketStartHoursForBlock/getEffectiveHourSlotForBucketInBlock | tests/three-hour-bucket-utils.test.ts | threeHourBucket utils | COVERED |
| src/features/schedule/hooks/useDragDropManager.ts | isSameLocation (bucket-aware) | (없음) | (없음) | MISSING |
| src/features/schedule/components/TimeBlockContent.tsx | 3시간 버킷 렌더링/필터링 | (없음) | (없음) | MISSING |
| src/features/schedule/components/ThreeHourBucket.tsx | 버킷 단위 드롭/추가 | (없음) | (없음) | MISSING |

### Coverage Gaps
- `useDragDropManager.isSameLocation`의 버킷 판정 분기(특히 hour-slot UI가 남아있을 때의 오판정 가능성) 테스트 부재
- `TimeBlockContent`가 비정렬(block start가 3의 배수가 아닌) 블록을 렌더링할 때의 표시(버킷 라벨) 회귀 테스트 부재

## Test Execution Results

### Unit Tests
- **Command**: `npm test`
- **Status**: PASS
- **Evidence**: 19 files / 107 tests passed

### Lint
- **Command**: `npm run lint`
- **Status**: FAIL
- **Output (요약)**:
  - src/features/schedule/HourBar.tsx: `toast` unused
  - src/features/schedule/ScheduleView.tsx: `settings` unused
  - src/features/schedule/TaskModal.tsx: `toast` unused

## Requirements Verification

### 1) “10자 제한 제거” + “공백 제외 1자 이상 유지”
- **결론**: PASS
- 근거(코드 경로):
  - TaskModal: `const trimmedText = text.trim(); if (!trimmedText) ...`만 남음
  - FocusView/ThreeHourBucket: Enter 처리에서 `inlineInputValue.trim()` 기반으로 빈 값 차단

### 2) “3시간 단위로만 표시/추가/드롭(스케줄 표면 기준)”
- **결론**: PASS(단, 비정렬 블록에서 UX 리스크 존재)
- 근거(코드 경로):
  - TimeBlockContent가 HourBar(시간 슬롯 단위) 렌더를 제거하고, `getBucketStartHoursForBlock` 기반으로 ThreeHourBucket만 렌더
  - ThreeHourBucket의 생성/드롭이 `effectiveHourSlot`로 단일 hourSlot 값을 지정(사용자는 버킷 단위 목적지만 가짐)
- 리스크:
  - 블록 시작/끝이 3시간 경계에 정렬되지 않을 경우, 버킷 라벨이 블록 밖 시간을 포함해 보일 수 있음(예: 08-11 블록에서 06:00-09:00 버킷이 표시될 가능성). 제품에서 블록이 항상 3시간 정렬이면 문제 없음.

## Failures & Fix Suggestions

### FAIL-1: ESLint 경고 3건으로 `npm run lint` 실패
- **Minimal Repro**:
  1) `npm run lint`
  2) 위 3개 경고로 exit code 1
- **Fix Suggestion (최소 수정)**:
  - src/features/schedule/TaskModal.tsx: 더 이상 사용하지 않는 `toast` import 제거
  - src/features/schedule/ScheduleView.tsx: 사용되지 않는 `settings` 구조분해 제거(또는 실제 사용처가 필요하면 복구)
  - src/features/schedule/HourBar.tsx: 사용되지 않는 `toast` import 제거 (또는 HourBar 컴포넌트를 완전히 제거하는 PR로 분리)

### Risk-1(비차단): hour-slot UI가 다시 살아날 경우 드롭 판정 오동작 가능성
- `useDragDropManager.isSameLocation`이 `sourceBucketStart === targetHourSlot`을 같은 위치로 간주함.
- hour-slot(1시간) 단위 드롭 UI가 남아/복귀하면, 같은 버킷 내 다른 hourSlot로 옮기는 드롭이 “같은 위치”로 오판정될 수 있음.
- **대응 제안**: hour-slot 모드와 bucket 모드를 명시적으로 구분(예: `targetKind: 'hour'|'bucket'`)하거나, bucket 비교는 bucket drop에서만 수행.

---
Handing off to uat agent for value delivery validation
