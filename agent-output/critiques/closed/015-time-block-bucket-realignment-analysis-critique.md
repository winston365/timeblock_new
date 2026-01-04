# 015-time-block-bucket-realignment-analysis – Risk Critique

- Artifact: [agent-output/analysis/015-time-block-bucket-realignment-analysis.md](../analysis/015-time-block-bucket-realignment-analysis.md)
- Supporting analyst docs: [agent-output/analysis/013-three-hour-bucket-unification-analysis.md](../analysis/013-three-hour-bucket-unification-analysis.md), [agent-output/analysis/014-three-hour-bucket-ui-surfaces-analysis.md](../analysis/014-three-hour-bucket-ui-surfaces-analysis.md)
- Date: 2025-12-20
- Status: Initial

## Changelog

| Date | Request | Summary |
|---|---|---|
| 2025-12-20 | TIME_BLOCKS 기반 분류로 회귀 리스크 평가 | 모듈별 리스크/핫스팟/변경 순서·롤백 전략 제시 |

## Value Statement Assessment (MUST)

- Value statement는 명확함: “고정 3시간(0/3/6…) 버킷”으로 인해 제품 정의 TIME_BLOCKS(05-08…)와 UI/정신모델이 불일치 → TIME_BLOCKS 기반 분류로 되돌려 사용자 혼란/오배치를 줄임.
- 단, **wrap-around(23-05) 블록을 TIME_BLOCKS에 포함할지**가 미정이면 ‘현재 블록’/‘야간(other)’의 의미가 흔들려 가치 전달이 지연될 수 있음(즉시 의사결정 필요).

## Overview

현 상태는 “UI 상호작용/저장 정규화는 3시간 버킷 시작시각으로 통일”되어 있으나, 그 3시간 경계가 TIME_BLOCKS와 무관(0/3/6)합니다. 회귀 작업의 본질은:

1) 시간→블록 매핑(현재 블록, 드롭 타깃, 라벨, 진행률)을 **TIME_BLOCKS 기반**으로 일원화
2) Task의 **timeBlock(정규/인박스 분류)** 과 **hourSlot(세부 시각/정렬)** 간 충돌을 제거
3) TimelineView가 갖고 있는 “시간 그리드/라벨/드롭존” 의미를 재정의

## Module Risk Ratings (High/Med/Low)

### Shared / Domain
- High: [src/shared/types/domain.ts](../../src/shared/types/domain.ts)
  - TIME_BLOCKS 변경은 타입(TimeBlockId)·전역 로직·AI/통계·XP 등 광범위 파급.
- High: [src/shared/utils/timeBlockUtils.ts](../../src/shared/utils/timeBlockUtils.ts)
  - getBlockIdFromHour가 현재 `start <= hour < end`만 지원(23-05 불가). blockMap 기반 캐시라 변경 시 영향이 즉시 전체로 확산.
- High: [src/shared/lib/utils.ts](../../src/shared/lib/utils.ts)
  - getBlockIdFromHour가 timeBlockUtils를 래핑하면서 ‘other’ 분기 제공. wrap-around가 들어오면 ‘other’의 의미/사용처가 바뀜.
- High: [src/shared/lib/personaUtils.ts](../../src/shared/lib/personaUtils.ts)
  - `currentHour >= start && currentHour < end` 패턴으로 currentBlock 산출(23-05 깨짐). AI 컨텍스트가 잘못되면 사용자 체감이 큼.
- High: [src/shared/lib/timeBlockXP.ts](../../src/shared/lib/timeBlockXP.ts)
  - 이미 “23-05는 야간/휴식”을 별도 모델링. TIME_BLOCKS에 23-05를 추가하면 이 모듈의 ‘야간’ 정의와 충돌 가능.

### Schedule (UI/Interaction)
- High: [src/features/schedule/utils/threeHourBucket.ts](../../src/features/schedule/utils/threeHourBucket.ts)
  - 광범위 소비(Focus/Timeline/TaskCard/드래그 훅). 제거/대체 시 회귀 범위가 큼.
- High: [src/features/schedule/TimelineView/useTimelineData.ts](../../src/features/schedule/TimelineView/useTimelineData.ts)
  - 버킷 생성 루프가 고정 step=3(THREE_HOUR_BUCKET_SIZE). TIME_BLOCKS 기반(특히 wrap 포함)으로 바꾸면 데이터 그룹핑/정렬/표시 시작 시각(visibleStartHour) 로직이 바뀜.
- High: [src/features/schedule/TimelineView/TimelineView.tsx](../../src/features/schedule/TimelineView/TimelineView.tsx)
  - BLOCK_BOUNDARIES/BLOCK_BACKGROUND_COLORS가 0/3/6…에 하드 결합. 라벨/드롭타깃/초과(overtime)도 버킷 가정.
- Med: [src/features/schedule/components/FocusView.tsx](../../src/features/schedule/components/FocusView.tsx)
  - 현재는 3시간 버킷 기반으로 잘 동작. 하지만 TIME_BLOCKS가 05-08 기준이면 “현재 버킷” 계산, 남은시간, 추가 제한, 라벨이 전부 재해석 필요.

### Battle / Other Surfaces
- Med: [src/features/battle/components/MissionModal.tsx](../../src/features/battle/components/MissionModal.tsx)
  - 현재 시각→버킷 시작시각→blockId 산출. 23-04는 blockId=null로 에러. wrap-around 추가 시 UX/정책이 바뀜(야간에도 배치 가능해짐).
- Low~Med: [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](../../src/features/tempSchedule/components/TempScheduleTimelineView.tsx)
  - hourSlot*60 기반 배치. TIME_BLOCKS 재정의와 직접 충돌하진 않지만, ‘표시/정렬’ 의미 통일 관점에서 불일치가 남을 수 있음.

### Tests
- High: [tests/three-hour-bucket-utils.test.ts](../../tests/three-hour-bucket-utils.test.ts)
  - 유틸 대체 시 테스트가 ‘스펙 변경’으로 대거 수정 필요.
- Med: [tests/time-block-visibility.test.ts](../../tests/time-block-visibility.test.ts), [tests/three-hour-bucket-utils.test.ts](../../tests/three-hour-bucket-utils.test.ts)
  - 시간대 분류의 기준이 바뀌면 기대값 수정/추가 필요.

## Most Brittle Hotspots (핵심 함수/파일)

1) TIME_BLOCKS에 wrap-around(23-05) 추가 시 “start < end” 가정 붕괴
- getBlockIdFromHour: [src/shared/utils/timeBlockUtils.ts](../../src/shared/utils/timeBlockUtils.ts)
- currentBlock 산출: [src/shared/lib/personaUtils.ts](../../src/shared/lib/personaUtils.ts)
- isActive 산출: [src/shared/lib/timeBlockXP.ts](../../src/shared/lib/timeBlockXP.ts)
- 진행률/남은시간 계산의 음수 위험: [src/shared/utils/timeBlockUtils.ts](../../src/shared/utils/timeBlockUtils.ts) (duration), [src/shared/lib/utils.ts](../../src/shared/lib/utils.ts) (getBlockProgress)

2) Task.timeBlock vs hourSlot 충돌 (데이터 정합성/표시 정합성)
- Task 정의상 timeBlock은 “인박스(null) vs 배치됨”의 정규 분류, hourSlot은 선택적 세부 슬롯입니다: [src/shared/types/domain.ts](../../src/shared/types/domain.ts)
- 그런데 Timeline 계열은 group/key를 hourSlot 기반으로 삼는 경향이 강함: [src/features/schedule/TimelineView/useTimelineData.ts](../../src/features/schedule/TimelineView/useTimelineData.ts)
- 회귀 중 가장 위험한 케이스는:
  - timeBlock은 A인데 hourSlot이 A 범위를 벗어남(또는 undefined/잘못된 값)
  - 드래그/추가가 hourSlot만 바꾸고 timeBlock은 그대로(또는 반대)
  - wrap-around 블록에서 hourSlot을 23으로 정규화하면 “02시 작업”이 23시 근처로 정렬/표시되는 오해를 만들 수 있음(표시 모델 정의 필요)

3) TimelineView의 그리드/라벨/드롭 타깃 의미 변경
- 현재: 24시간 축 + 3시간 버킷 경계(0/3/6…) + drop target도 버킷 시작시각 기반
- TIME_BLOCKS 회귀 시: 05-08, 08-11… 기준 경계/색/라벨로 재구성 필요. 특히 23-05를 넣으면 **축이 당일을 넘어감**.
- 하드 결합 지점:
  - BLOCK_BOUNDARIES: [src/features/schedule/TimelineView/useTimelineData.ts](../../src/features/schedule/TimelineView/useTimelineData.ts)
  - BLOCK_BACKGROUND_COLORS(0/3/6 키): [src/features/schedule/TimelineView/TimelineView.tsx](../../src/features/schedule/TimelineView/TimelineView.tsx)

4) “현재 블록/현재 버킷” 의미 (FocusView / MissionModal)
- FocusView는 bucketStartHour를 기준으로 작업 범위를 결정(현재는 0/3/6 모델): [src/features/schedule/components/FocusView.tsx](../../src/features/schedule/components/FocusView.tsx)
- MissionModal은 현재 시각이 속한 blockId를 얻어 그 블록에 추가(야간은 실패): [src/features/battle/components/MissionModal.tsx](../../src/features/battle/components/MissionModal.tsx)
- wrap-around를 도입하면 “야간은 배치 불가” 정책을 유지할지, “23-05도 블록으로 배치 가능”으로 바꿀지 UX 결정이 필요.

5) threeHourBucket 유틸 제거/대체의 파급
- 소비자(핵심): FocusView, TimelineView(+useTimelineData/TimelineTaskBlock), TaskCard, ThreeHourBucket, useDragDrop/useDragDropManager, HourBar
- 제거는 마지막 단계가 안전(그 전에는 어댑터/병행 필요).

## Findings

### Critical
1) Wrap-around 결정 부재 (OPEN)
- Description: TIME_BLOCKS에 23-05를 넣으면 기존 “야간(other)” 모델(timeBlockXP, utils.getBlockIdFromHour의 other)이 의미 충돌.
- Impact: 현재 블록/XP 진행/AI 컨텍스트/미션 배치가 서로 다른 규칙을 적용할 위험.
- Recommendation: 먼저 ‘야간을 TIME_BLOCKS의 일부로 만들지’ 결정. 포함한다면 wrap-aware 시간 범위 판정(예: start > end인 경우 `hour >= start || hour < end`)을 전역 표준으로 채택.

2) timeBlock/hourSlot 이중 소스 충돌 위험 (OPEN)
- Description: 분류(블록)는 timeBlock이 정규, 표시/드롭/정렬은 hourSlot로 흔들릴 수 있음.
- Impact: 작업이 “다른 블록에 보이는데 저장은 다른 블록” 같은 정합성 버그로 직결.
- Recommendation: UI 분류 기준을 명시적으로 1개로 고정(예: timeBlock 우선, hourSlot은 정렬 보조). 또한 업데이트 파이프라인에서 두 필드를 동시에 일관되게 갱신하도록 규약화.

3) TimelineView의 의미 전환이 가장 큰 회귀 면적 (OPEN)
- Description: 현재 Timeline은 fixed 3-hour step과 0/3/6 색/경계에 결합.
- Impact: 드롭 타깃, 빈 영역 클릭, overtime 경고가 TIME_BLOCKS와 불일치하거나 잘못 계산될 수 있음.
- Recommendation: Timeline을 1) 데이터 그룹핑 2) 그리드/라벨 3) 드롭 타깃의 3층으로 나눠 단계적으로 TIME_BLOCKS 기반으로 전환.

### Medium
4) timeBlockXP/personaUtils의 숨은 가정 (OPEN)
- Description: timeBlockXP는 이미 “23-05 휴식”을 별도 처리. personaUtils는 TIME_BLOCKS find 조건이 wrap에 취약.
- Impact: wrap-around 도입 시 사용자에게 ‘지금 블록’과 ‘다음 블록’ 정보가 잘못 안내될 수 있음.
- Recommendation: wrap 결정 후, TIME_BLOCKS 소비자(shared/lib 계층)를 우선 일괄 정비.

5) 테스트 스위트의 ‘스펙 변경’ (OPEN)
- Description: threeHourBucket 기반 테스트는 단순 리팩토링이 아니라 기대 동작이 바뀌는 변경.
- Impact: 테스트 실패가 대량 발생 가능. 동시에, 테스트가 변경을 견인하는 안전장치이기도 함.
- Recommendation: TIME_BLOCKS 기반 helper에 대한 순수 함수 테스트를 먼저 추가하고, 기존 threeHourBucket 테스트는 전환이 끝날 때까지 유지.

### Low
6) 라벨/토스트/툴팁 텍스트의 일관성 (OPEN)
- Description: ‘버킷’ 용어가 0/3/6 모델을 암시할 수 있음.
- Impact: 기능은 맞는데 UX는 어색해지는 형태의 잔버그.
- Recommendation: TIME_BLOCKS 기반이면 라벨을 block.label 중심으로 통일.

## Safe Change Order (변경 순서)

1) 의사결정 고정
- wrap-around(23-05)를 TIME_BLOCKS에 넣을지(=야간도 블록으로 취급) vs 유지하지 않을지(=야간은 other/블록 외)
- “현재 블록”의 정의(야간 포함 여부), MissionModal의 야간 동작(추가 허용/차단)을 먼저 합의

2) Shared 유틸 표준화 (순수 함수 + 테스트 우선)
- TIME_BLOCKS 기반으로 hour→block 판정/label/duration 계산을 한 곳에서 제공
- wrap 포함 시 start>end를 지원하는 표준 판정식을 전체(shared/lib, utils, persona, XP)에 적용

3) Cross-cutting consumers 정비
- personaUtils, timeBlockXP, utils.getBlockProgress 등 TIME_BLOCKS를 직접 순회하는 곳을 우선 수정(가정 제거)

4) Schedule UI 전환
- TimelineView: 경계/색/라벨/드롭타깃부터 TIME_BLOCKS로 전환(가장 회귀 면적 큼)
- FocusView/MissionModal: ‘현재 블록/현재 버킷’ 계산과 에러/토스트 메시지를 TIME_BLOCKS 의미로 재정렬

5) threeHourBucket 유틸 단계적 폐기
- 모든 소비자가 TIME_BLOCKS 기반 helper로 이동한 뒤, threeHourBucket 제거 및 테스트 교체

## Rollback Strategy

- 원칙: “데이터(저장된 task.timeBlock/hourSlot)는 가능한 한 이전 버전도 안전하게 해석 가능”해야 함.
- 실무적 롤백 포인트:
  1) TIME_BLOCKS에 23-05를 추가했다면, 롤백 시에도 기존 클라이언트가 이해할 수 있도록(unknown id 처리) ‘other/null로 폴백’ 경로가 필요
  2) UI 전환은 단계별로 PR/커밋을 쪼개고, TimelineView(최대 리스크)를 별도 롤백 가능한 단위로 분리
  3) threeHourBucket는 최종 단계까지 유지해, 회귀 시 즉시 복귀 가능하게 함

## Questions (Need answers before implementation)

1) wrap-around(23-05)를 TIME_BLOCKS에 “정식 블록”으로 포함하나요, 아니면 계속 “휴식/other”로 남기나요?
2) Task.timeBlock과 hourSlot이 불일치할 때, UI는 무엇을 정답으로 취급하나요(timeBlock 우선 vs hourSlot 우선)?
3) TimelineView는 24시간 축을 유지하나요, 아니면 TIME_BLOCKS 단위(6~7행) 그리드로 축약하나요?

## Risk Assessment

- Overall: High
- Driver: wrap-around 도입 시 전역 가정 붕괴 + TimelineView의 큰 의미 변경 + timeBlock/hourSlot 이중 소스

## Recommendations

- 우선순위 1: wrap-around 정책 결정 및 shared 레벨에서 시간 판정 표준화
- 우선순위 2: TimelineView를 가장 먼저 리스크 기반으로 분리/단계화(경계·라벨 → 드롭타깃 → 그룹핑)
- 우선순위 3: timeBlock/hourSlot 규약을 문서화하고 업데이트 파이프라인에서 강제
