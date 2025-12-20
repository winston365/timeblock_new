# QA Report: TIME_BLOCKS 기준 버킷 분류 회귀

**Plan Reference**: `agent-output/planning/010-time-blocks-bucket-realignment-pr-plan.md`
**QA Status**: QA Complete
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-21 | Implementer | 구현 완료(테스트/린트 PASS) 최종 QA 검증 요청 | UI 라벨/드롭 정규화/문구/잔재 점검 + `npm test`/`npm run lint` 재실행. 기능 요구사항은 충족(PASS)하나, threeHourBucket 관련 파일/테스트명 잔재는 혼란 리스크로 최소 정리 권장 |

## Timeline
- **Test Strategy Started**: 2025-12-21
- **Test Strategy Completed**: 2025-12-21
- **Implementation Received**: 2025-12-21
- **Testing Started**: 2025-12-21
- **Testing Completed**: 2025-12-21
- **Final Status**: QA Complete

## Test Strategy (Pre-Implementation)
사용자 관점에서 “고정 3시간(0/3/6, 00-03 등) 기준으로 보이거나 저장되는지”를 깨뜨리는 시나리오를 중심으로 검증한다.

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- Vitest (repo에 이미 구성됨)

**Testing Libraries Needed**:
- 없음(기존 vitest/RTL 기반 스모크+순수함수 테스트로 충분)

**Configuration Files Needed**:
- 없음

**Build Tooling Changes Needed**:
- 없음

**Dependencies to Install**:
```bash
# none
```

### Required Unit Tests
- TIME_BLOCKS 기반 라벨/분류 헬퍼가 0/3/6 스냅을 하지 않는지(특히 normalizeDropTargetHourSlot).
- getBucketStartHour가 TIME_BLOCKS 시작 시각(05/08/11...)으로 매핑되는지.

### Required Integration Tests
- TimelineView/ScheduleView 드롭/추가 경로에서 hourSlot 저장 값이 0/3/6으로 강제 정규화되지 않는지.
- FocusView/MissionModal에서 사용자 문구가 ‘버킷’이 아닌 ‘타임블록/시간대’ 기준으로 노출되는지.

### Acceptance Criteria
- Schedule/Timeline 라벨이 TIME_BLOCKS(05-08, 08-11...) 기반이며 00-03 레이블이 UI에 남아있지 않다.
- 드래그/추가 시 hourSlot이 0/3/6 고정 스냅으로 저장되지 않는다(정규화 유틸 포함).
- FocusView/TimelineView/MissionModal의 사용자 노출 텍스트에 ‘버킷’ 용어가 남아있지 않다.
- `npm test` / `npm run lint` 재실행 PASS.
- 3시간 버킷(threeHourBucket) 잔재가 제품 동작을 혼동시키지 않는 수준으로 정리되었거나, 최소한 ‘미사용/위험’으로 명확히 구분된다.

## Implementation Review (Post-Implementation)

### Code Changes Summary
작업 트리는 미커밋 변경이 다수 존재(unstaged). 이번 요구사항과 직접 연관된 핵심 파일은 아래로 식별됨:
- TIME_BLOCKS 정의: `src/shared/types/domain.ts`
- TIME_BLOCKS 기반 버킷 유틸(핵심): `src/features/schedule/utils/timeBlockBucket.ts`
- (잔재/미사용 가능) 3시간 버킷 유틸: `src/features/schedule/utils/threeHourBucket.ts`
- Schedule: `src/features/schedule/ScheduleView.tsx`, `src/features/schedule/components/TimeBlockContent.tsx`, `src/features/schedule/components/TimeBlockBucket.tsx`
- Drag&Drop: `src/features/schedule/hooks/useDragDrop.ts`, `src/features/schedule/hooks/useDragDropManager.ts`, `src/features/schedule/TaskCard.tsx`
- Timeline: `src/features/schedule/TimelineView/TimelineView.tsx`, `src/features/schedule/TimelineView/useTimelineData.ts`, `src/features/schedule/TimelineView/TimelineTaskBlock.tsx`
- FocusView: `src/features/schedule/components/FocusView.tsx`
- MissionModal: `src/features/battle/components/MissionModal.tsx`
- 테스트: `tests/three-hour-bucket-utils.test.ts` (내용상 timeBlockBucket 테스트로 변경됨)

## Test Coverage Analysis
### New/Modified Code
| File | Function/Class | Test File | Test Case | Coverage Status |
|------|---------------|-----------|-----------|-----------------|
| src/features/schedule/utils/timeBlockBucket.ts | normalizeDropTargetHourSlot/getBucketStartHour/formatBucketRangeLabel | tests/three-hour-bucket-utils.test.ts | timeBlockBucket utils (TIME_BLOCKS 기반) | COVERED |
| src/features/schedule/TimelineView/useTimelineData.ts | TIME_BLOCKS 기반 그룹/visibleStartHour 계산 | (기존 타임라인 스모크/단위 테스트 없음) | - | PARTIAL (코드리뷰 기반) |
| src/features/schedule/TimelineView/TimelineView.tsx | 드롭/추가 시 hourSlot 경로 | (직접 테스트 없음) | - | PARTIAL (코드리뷰 기반) |

### Coverage Gaps
- TimelineView/ScheduleView의 실제 DnD 이벤트 흐름은 순수함수 테스트로 완전 커버되지 않음(수동 코드리뷰로 리스크 확인).

### Comparison to Test Plan
- **Tests Planned**: 4~6개(순수함수 + 주요 화면 코드리뷰/스모크)
- **Tests Implemented/Present**: timeBlockBucket 순수함수 단위 테스트 존재
- **Tests Missing**: UI DnD e2e/컴포넌트 상호작용 테스트(현 repo 스타일 상 미도입)

## Test Execution Results
### Unit Tests
- **Command**: `npm test`
- **Status**: PASS
- **Summary**: 20 test files / 111 tests passed

### Lint
- **Command**: `npm run lint`
- **Status**: PASS

## Findings & Recommendations

### Requirement Checks
1) **Schedule 라벨/섹션이 TIME_BLOCKS 기준인지**: PASS
- TIME_BLOCKS는 05-08, 08-11...로 정의됨(`src/shared/types/domain.ts`).
- Schedule 렌더링은 `TimeBlockContent` → `TimeBlockBucket`에서 `bucketStartHour={block.start}` 및 `formatBucketRangeLabel` 사용.

2) **드래그/추가 시 hourSlot 0/3/6 스냅 방지**: PASS
- 핵심 정규화 `normalizeDropTargetHourSlot`은 hourSlot을 블록 시작으로 강제 스냅하지 않고(검증만) TIME_BLOCKS 내부 값은 그대로 유지.
- DnD/추가 경로는 `clampHourSlotToBlock` 또는 `getSuggestedHourSlotForBlock`로 “블록 내부”만 보장.

3) **FocusView/TimelineView/MissionModal 문구에서 ‘버킷’ 제거**: PASS (사용자 노출 텍스트 기준)
- 해당 파일들에서 사용자 노출 toast/label 문자열에 ‘버킷’ 용어 미사용 확인.

4) **vitest + lint 재확인**: PASS

5) **threeHourBucket 유틸/테스트 잔재 혼란 여부**: SOFT PASS (혼란 리스크 존재)
- `src/features/schedule/utils/threeHourBucket.ts`는 현재 코드베이스에서 import 사용처가 보이지 않으며, 내부에 “bucketStart로 저장 스냅” 로직이 남아있어 재도입 시 회귀 위험.
- `src/features/schedule/components/ThreeHourBucket.tsx`도 이름이 정책과 어긋나 혼란 가능.
- `tests/three-hour-bucket-utils.test.ts`는 실제로 `timeBlockBucket`을 테스트하므로 파일명이 부정확.

### Minimal Fix Suggestions (Implementer action)
- (권장) 미사용 확인 후 `src/features/schedule/utils/threeHourBucket.ts` 제거 또는 `timeBlockBucket.ts`로 re-export만 남기고 스냅 동작 제거.
- (권장) `tests/three-hour-bucket-utils.test.ts` 파일명을 `tests/time-block-bucket-utils.test.ts` 등으로 변경(내용과 일치).
- (선택) `src/features/schedule/components/ThreeHourBucket.tsx` 미사용이면 제거/rename(정책 용어 정합).

Handing off to uat agent for value delivery validation
