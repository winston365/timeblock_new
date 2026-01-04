# QA Report: TIME_BLOCKS 기준 버킷 분류 회귀

**Plan Reference**: `agent-output/planning/010-time-blocks-bucket-realignment-pr-plan.md`
**QA Status**: QA Complete
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-21 | Implementer | 구현 완료(테스트/린트 PASS) 최종 QA 검증 요청 | UI 라벨/드롭 정규화/문구/잔재 점검 + `npm test`/`npm run lint` 재실행. 기능 요구사항은 충족(PASS)하나, threeHourBucket 관련 파일/테스트명 잔재는 혼란 리스크로 최소 정리 권장 |
| 2025-12-21 | QA | ‘어제 할 일’이 ‘오늘’로 표시되는 버그 수정 후 수동 재현/검증 시나리오 + 회귀 체크리스트 작성 요청 | TempSchedule(일간/주간/월간) + 자정 경계(23:50~00:10) + 데이터 케이스(없음/과거만/혼재) 중심의 수동 검증 절차/체크리스트/디버그 포인트 추가 |

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

---

## Manual Validation Scenarios (Step-by-step)

### 공통 준비(권장)
1) **Windows 시간대 확인**: 로컬 시간대(예: KST/Asia-Seoul)를 사용 중인지 확인한다.
2) **테스트 데이터 표식**: 작업 이름 앞에 `[YDAY]`, `[TODAY]`를 붙여 UI에서 날짜 혼선을 쉽게 구분한다.
3) **검증 화면**: 임시 스케줄은 `📅 임시 스케줄` 모달에서 **일간/주간/월간**을 각각 확인한다.

### 시나리오 1 — 일간(TempSchedule Day)에서 ‘어제/오늘’ 분리 확인
목적: 하루 단위(selectedDate) 작업이 다른 날짜로 섞여 보이지 않는지 확인.
1) `📅 임시 스케줄` 모달을 연다.
2) 상단에서 **일간**을 선택한다.
3) 우측 상단 `오늘` 버튼을 눌러 **오늘**로 이동한다.
4) 오늘에 `[TODAY] 00:05` (예: 00:05~00:20) 작업을 1개 추가한다.
5) 상단 `◀`을 눌러 **어제**로 이동한다.
6) 어제에 `[YDAY] 23:55` (예: 23:55~24:00 또는 23:55~00:10 형태가 가능하면) 작업을 1개 추가한다.
7) **어제 화면**에서 작업 목록/타임라인에 `[YDAY]`만 보이고 `[TODAY]`가 보이지 않는지 확인한다.
8) `▶`로 **오늘**로 돌아와 `[TODAY]`만 보이고 `[YDAY]`가 보이지 않는지 확인한다.

### 시나리오 2 — 주간(TempSchedule Week)에서 날짜 컬럼/표시/클릭 이동 검증
목적: 주간 그리드의 날짜 산출(월~일)이 로컬 날짜 기준으로 하루 밀리거나 당겨지지 않는지 확인.
1) `📅 임시 스케줄` 모달 → **주간**으로 전환한다.
2) 상단 날짜 레이블(예: `YYYY년 M월 D일 ~ D일`)이 현재 선택 날짜의 “해당 주(월~일)” 범위를 올바르게 나타내는지 확인한다.
3) 이번 주의 **어제 컬럼**에 `[YDAY]` 작업이 보이고, **오늘 컬럼**에 `[TODAY]` 작업이 보이는지 확인한다.
4) **어제 컬럼 헤더(날짜)**를 클릭해 **일간 뷰로 이동**했을 때, 헤더의 날짜가 “어제”로 정확히 바뀌는지 확인한다.
5) **오늘 컬럼 헤더(날짜)**를 클릭해 일간 뷰로 이동했을 때, 헤더의 날짜가 “오늘”로 정확히 바뀌는지 확인한다.
6) (가능하면) `[YDAY]` 작업을 드래그하여 오늘 컬럼으로 옮긴 뒤, 오늘 일간 뷰에서 실제로 오늘 작업으로 나타나는지 확인한다.

### 시나리오 3 — 월간(TempSchedule Month)에서 ‘오늘’ 마커/날짜 셀/팝오버 검증
목적: 월간 캘린더 날짜 산출 및 `오늘` 표시가 UTC 파싱 영향으로 어긋나지 않는지 확인.
1) `📅 임시 스케줄` 모달 → **월간**으로 전환한다.
2) 캘린더에서 `오늘` 라벨/강조가 **실제 로컬 날짜**의 셀에 표시되는지 확인한다.
3) 어제 날짜 셀에 작업이 있다면(시나리오 1/2에서 생성), 어제 셀에 색상 도트/개수 등 요약이 나타나는지 확인한다.
4) 어제 셀에 마우스를 올려 팝오버가 뜰 경우, 팝오버 헤더의 날짜(예: `12월 20일`)가 실제 “어제”인지 확인한다.
5) 팝오버의 `일간 뷰로 →`를 눌렀을 때, 일간 뷰 헤더가 해당 날짜로 이동하는지 확인한다.

### 시나리오 4 — 데이터 케이스 매트릭스(없음/과거만/혼재)
목적: 데이터 분포에 따라 ‘어제 → 오늘’ 오표시가 재발하지 않는지 확인.

케이스 A) **일정이 없을 때**
1) 임시 스케줄에서 작업이 없는 날짜(미래 날짜 등)로 이동한다.
2) 일간/주간/월간에서 “등록된 스케줄 없음”/빈 상태가 정상이며, 다른 날짜의 작업이 끼어들지 않는지 확인한다.

케이스 B) **지난 일정만 있을 때(오늘=0개, 어제>0개)**
1) 오늘 날짜에 작업이 없도록 정리한다(필요 시 오늘 작업 삭제).
2) 어제에만 작업이 존재하도록 만든다.
3) 주간/월간에서 오늘이 비어 있고 어제가 채워져 있는지, 그리고 오늘 셀/컬럼에 어제 작업이 보이지 않는지 확인한다.

케이스 C) **오늘+어제 섞여 있을 때**
1) 오늘/어제 각각 1개 이상 작업을 둔다.
2) 주간/월간에서 두 날짜가 각각 올바른 위치에 표시되는지 확인한다.

### 시나리오 5 — 자정 경계(23:50~00:10) 회귀 체크
목적: 자정 전후에 날짜 키/‘오늘’ 표시가 하루 밀리지 않는지 확인.
1) (가능하면) Windows에서 시간을 수동으로 `23:50` 전후로 맞춘다(자동 시간 동기화 OFF 필요할 수 있음).
2) 앱을 실행하고 `📅 임시 스케줄` 모달을 연 뒤 **주간** 또는 **월간**을 켜둔다.
3) `23:55`에 해당 날짜(자정 직전 날짜)에 `[YDAY] 23:55` 작업이 올바른 날짜에 표시되는지 확인한다.
4) 시스템 시간이 `00:05`를 지난 뒤:
	- `오늘` 마커/강조가 다음 날짜로 이동해야 하는 UX라면, 화면 갱신(탭 전환, `오늘` 버튼 클릭, `◀▶` 이동 후 복귀) 후 올바르게 반영되는지 확인한다.
	- 최소 기준: `오늘` 버튼을 눌렀을 때 이동하는 날짜가 실제 로컬 “오늘”이어야 한다.
5) `00:05` 이후에도 어제 작업이 오늘로 합쳐져 보이지 않는지(특히 월간/주간 날짜 셀/컬럼) 재확인한다.

---

## Regression Checklist (Short)
- TempSchedule **일간**: 어제/오늘 이동 시 작업이 섞이지 않는다.
- TempSchedule **주간**: 월~일 날짜 컬럼이 로컬 기준으로 하루 밀리지 않는다.
- TempSchedule **월간**: `오늘` 마커가 실제 로컬 날짜 셀에 표시된다.
- 월간 팝오버/주간 컬럼 클릭 → **일간 이동** 시 선택 날짜가 하루 틀어지지 않는다.
- **23:50~00:10** 경계에서 `오늘` 버튼/선택 날짜가 잘못된 날짜로 이동하지 않는다.
- 일정 **없음/과거만/혼재** 3케이스에서 날짜 오표시가 재발하지 않는다.

---

## Debug / Logging Pointers
문제 재발 시 아래 포인트를 우선 확인한다.

### 1) 날짜 문자열 생성/파싱 경로(UTC ↔ Local)
- `toISOString().split('T')[0]` 사용 여부(주간/월간 날짜 배열 생성에서 흔한 오프셋 원인)
- `new Date('YYYY-MM-DD')` 파싱 사용 여부(환경에 따라 UTC로 해석되어 날짜가 하루 틀어질 수 있음)
- 로컬 날짜를 의도한 경로는 `getLocalDate(...)` 사용 여부

### 2) TempSchedule 날짜별 필터링
- `shouldShowOnDate(task, date)` 결과가 “어제/오늘” 경계에서 기대대로인지
- 반복(recurrence) 규칙이 있을 경우, ‘표시 날짜’ 계산이 UTC 기준으로 흔들리지 않는지

### 3) 관찰 방법
- Electron DevTools 콘솔에서 `selectedDate`(TempSchedule store) 값이 클릭/이동 시 예상 날짜 문자열인지 확인
- 월간/주간에서 생성되는 날짜 배열(렌더링용 date string)이 로컬 날짜 기준으로 생성되는지 확인

---

## Suggested Automated Tests (Ideas)
1) **Week/Month 날짜 배열 생성 유틸 테스트**
	- 주간/월간이 내부적으로 만드는 `YYYY-MM-DD` 리스트가 “로컬 기준”으로 생성되는지 검증(특히 KST 같은 +offset 환경에서 `toISOString` 기반 오프셋 회귀 방지).
2) **TempSchedule 날짜 필터링(shouldShowOnDate) 자정 경계 테스트**
	- `selectedDate=어제/오늘` 각각에 대해 동일 task가 올바른 날짜에만 표시되는지(‘어제 task가 오늘에 노출’ 방지) 테스트 케이스 추가.

Handing off to uat agent for value delivery validation
