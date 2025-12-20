# TIME_BLOCKS 기준 버킷 분류 회귀(PR 단위 계획)

## Plan Header
- Plan ID: plan-2025-12-20-time-blocks-bucket-realignment
- Target Release: **1.0.161 (제안, 현재 package.json = 1.0.160 기준 patch +1)**
- Epic Alignment: “고정 3시간(0/3/6…) 버킷 → TIME_BLOCKS(05-08, 08-11, …) 기준으로 UI 분류/라벨/그리드 회귀”
- Status: Draft (Critic/Analyst 반영)
- References:
  - agent-output/analysis/015-time-block-bucket-realignment-analysis.md
  - agent-output/critiques/015-time-block-bucket-realignment-analysis-critique.md
  - agent-output/analysis/014-three-hour-bucket-ui-surfaces-analysis.md

## Changelog
| Date | Request | Summary |
|---|---|---|
| 2025-12-20 | TIME_BLOCKS 기준 분류 회귀 계획 | PR1~PR5로 리스크 분리, wrap(23-05) 및 wrap-aware 유틸 옵션 비교 포함 |

---

## Value Statement and Business Objective
As a 사용자, I want 일정 관련 화면의 분류/라벨/그리드가 ‘딱 3시간 고정(0/3/6…)’이 아니라 제품 정의 TIME_BLOCKS(05-08, 08-11, …) 기준으로 유지되어, so that 화면 간 이동/드롭/추가 시 작업이 다른 의미로 해석되어 생기는 혼란과 오배치를 줄이고 싶다.

---

## Scope / Constraints
- 프론트/UI만(저장소/스키마/동기화 계약 변경 금지)
- 리스크 최소화: **데이터 모델(Task.hourSlot) 유지**, 저장 마이그레이션 없음
- 분류 우선순위(제약 반영): 필요 시 **`task.timeBlock` 우선 분류**, `hourSlot`은 보조(정렬/드롭 seed)로 사용
- 정책/코딩 규칙 준수: optional chaining, defaults 단일 출처(하드코딩 금지), localStorage 금지(theme 예외)

---

## Key Decisions & Options (반드시 사전 확정)

### 옵션 A — TIME_BLOCKS에 23-05 추가 여부
- **A1) 추가하지 않는다(현 상태 유지)**
  - 장점: 변경 면적 최소(기존 `start < end` 가정 유지), 야간(23~04)을 “other/null”로 유지 가능
  - 단점: ‘현재 블록/현재 버킷’이 23~04에서 정의되지 않아 UI/미션 추가 등이 계속 예외 처리 필요
  - 적합: “야간은 스케줄링 대상이 아니다/휴식” 정책을 유지하려는 경우

- **A2) 23-05를 TIME_BLOCKS에 추가한다(wrap-around 블록 도입)**
  - 장점: 23~04도 명시적 블록으로 분류되어 ‘현재 블록’/라벨/드롭 타깃의 일관성이 좋아짐
  - 단점: 전역적으로 `start < end` 가정 붕괴 → wrap-aware 판정 표준화가 필요(회귀 면적 상승)
  - 주의: 기존 “야간/휴식” 관련 모듈(예: XP/AI 컨텍스트)이 야간을 블록으로 취급하게 되며 정책 충돌 가능
  - 적합: “야간도 시간 블록의 일부”로 사용자에게 보여주고 배치도 허용하려는 경우

**결정 포인트(오너: PO/Frontend Tech Lead)**
- 야간 시간대(23~04)를 ‘스케줄 그리드에 포함’할지, 포함한다면 ‘작업 배치 허용’까지 할지(또는 읽기 전용 표시만 할지)

### 옵션 B — timeBlockUtils를 wrap-aware로 확장할지
- **B1) wrap-aware로 확장한다(표준 판정 제공)**
  - 장점: TIME_BLOCKS를 순회하는 모든 소비자가 단일 로직을 재사용, 중복 가정 제거(DRY)
  - 단점: 수정 시 파급이 크므로 PR1에서 “순수 헬퍼 + 테스트(유형)”로 안정화가 필요

- **B2) wrap-aware는 별도 래퍼(새 helper)로만 제공한다(timeBlockUtils는 유지)**
  - 장점: 기존 소비자 회귀를 PR 단위로 분리(점진 적용), 위험 격리
  - 단점: 당분간 두 경로가 공존할 수 있어 일관성 리스크(중복 로직 증가)

**권장(리스크 관점)**
- A1(23-05 미추가)라면 B2도 가능(변경 최소).
- A2(23-05 추가)라면 B1이 사실상 필수(중복 가정 제거 없이는 회귀 위험 높음).

---

## Migration Principle (핵심 규약)
- UI에서 “시간 → 블록/버킷 분류”가 필요할 때 **단일 helper**만 사용한다.
- UI 렌더링 분류는 다음 우선순위를 따른다:
  1) `task.timeBlock` (존재하면 가장 신뢰)
  2) `hourSlot` → TIME_BLOCKS 기반으로 유도(필요 시)
  3) 둘 다 불명확하면 “미분류(other/inbox)”로 폴백(정책에 따라)

---

# PR Breakdown (권장 순서)

## PR1 — 유틸/상수 정리(TIME_BLOCKS 기반 label/start/end helpers)
- 목표
  - TIME_BLOCKS 기준 분류/라벨/시각 연산을 “단일 출처”로 제공
  - (옵션 A2 선택 시) wrap(23-05)까지 포함한 판정 규칙을 표준화
- 변경 파일 후보
  - src/shared/types/domain.ts (TIME_BLOCKS 정의)
  - src/shared/utils/timeBlockUtils.ts (TIME_BLOCKS 기반 helper 정리/확장)
  - src/shared/lib/utils.ts (timeBlockUtils 래퍼/other 처리 경로 정합)
  - (A2 선택 시) src/shared/lib/personaUtils.ts, src/shared/lib/timeBlockXP.ts 등 ‘현재 블록’ 계산 소비자
- AC (Acceptance Criteria)
  - [ ] TIME_BLOCKS 기준으로 blockId/label/start/end/duration을 얻는 helper가 “단일 출처”로 정리됨
  - [ ] (A2 선택 시) wrap(23-05) 시간대도 동일 helper로 정확히 분류됨
  - [ ] 기존 UI가 사용하는 핵심 API 계약이 문서화되고(계획 수준), 중복 로직 도입이 중단됨
- 롤백
  - [ ] PR revert 시 기존 TIME_BLOCKS/유틸 로직으로 즉시 복귀(데이터 영향 없음)
- 테스트(체크리스트, 유형만)
  - [ ] `npm test` (vitest)
  - [ ] TIME_BLOCKS 기반 helper에 대한 단위 테스트(순수 함수 중심) 보강/수정
  - [ ] `npm run lint`

---

## PR2 — ScheduleView(ThreeHourBucket 등) → TIME_BLOCKS 기반 ‘BlockBucket’로 교체
- 목표
  - Schedule 화면의 분류/라벨/드롭 대상이 0/3/6 버킷이 아닌 TIME_BLOCKS 기준으로 표현/동작
  - “버킷” 개념이 남아야 한다면, 그 버킷은 TIME_BLOCKS의 블록 자체(예: 05-08)를 의미하도록 정렬
- 변경 파일 후보
  - src/features/schedule/components/ThreeHourBucket.tsx
  - src/features/schedule/components/TimeBlockContent.tsx
  - src/features/schedule/TaskCard.tsx
  - src/features/schedule/hooks/useDragDrop.ts
  - src/features/schedule/hooks/useDragDropManager.ts
  - (관련 유틸) src/features/schedule/utils/threeHourBucket.ts (완전 제거는 PR5)
- AC
  - [ ] ScheduleView에서 라벨/그룹 기준이 TIME_BLOCKS와 일치(05-08, 08-11…)
  - [ ] 드롭/추가 seed가 TIME_BLOCKS 블록 기준으로 정해지고, 분류/표시가 흔들리지 않음
  - [ ] 분류 충돌 시 `task.timeBlock`이 우선 적용(요구사항)
- 롤백
  - [ ] ScheduleView 관련 변경만 revert 하면 기존 버킷 UI로 복귀
- 테스트(체크리스트, 유형만)
  - [ ] `npm test`
  - [ ] 스케줄 분류/드롭 관련 순수 계산 로직이 분리되는 경우 단위 테스트 보강
  - [ ] `npm run lint`

---

## PR3 — TimelineView TIME_BLOCKS 기반 그리드/드롭 타깃 변경
- 목표
  - TimelineView의 그리드 경계/라벨/배경 및 드롭 타깃 의미를 TIME_BLOCKS 기준으로 재정의
  - 0/3/6 경계(BLOCK_BOUNDARIES 등) 의존 제거
- 변경 파일 후보
  - src/features/schedule/TimelineView/TimelineView.tsx
  - src/features/schedule/TimelineView/useTimelineData.ts
  - src/features/schedule/TimelineView/TimelineTaskBlock.tsx
  - (시간 가시성/현재 블록) src/features/schedule/utils/timeBlockVisibility.ts
- AC
  - [ ] Timeline 그리드(경계/라벨)가 TIME_BLOCKS 정의와 정확히 일치
  - [ ] 드롭 타깃/빈영역 클릭 seed가 TIME_BLOCKS 기준으로 일관(분류 충돌 시 timeBlock 우선)
  - [ ] (A2 선택 시) wrap(23-05)이 있는 경우에도 UI가 깨지지 않음(축/정렬 정책은 PR3에서 명시적으로 선택)
- 롤백
  - [ ] Timeline 관련 변경만 revert 가능(다른 화면에 영향 최소)
- 테스트(체크리스트, 유형만)
  - [ ] `npm test`
  - [ ] Timeline 데이터 변환/그룹핑 로직의 단위 테스트(가능한 순수 로직만)
  - [ ] `npm run lint`

---

## PR4 — FocusView/MissionModal 문구 + ‘현재 블록’ 정합
- 목표
  - FocusView와 MissionModal의 “현재 블록/현재 시간대” 표현 및 동작이 TIME_BLOCKS 기준과 일치
  - (A2 선택 시) 23~04 시간대에서 ‘현재 블록 없음’ 같은 UX 깨짐을 정책에 맞게 처리
- 변경 파일 후보
  - src/features/schedule/components/FocusView.tsx
  - src/features/battle/components/MissionModal.tsx
  - (필요 시, 정책 정합) src/shared/lib/personaUtils.ts
- AC
  - [ ] FocusView의 현재 블록 라벨/정렬/추가 동작이 TIME_BLOCKS 기준으로 일관
  - [ ] MissionModal의 “현재 시간대에 추가”가 TIME_BLOCKS 기준으로 일관(정책상 불가 시 명확한 메시지)
  - [ ] 용어(버킷/블록/시간대)가 화면 간 일관
- 롤백
  - [ ] FocusView/MissionModal 변경만 revert
- 테스트(체크리스트, 유형만)
  - [ ] `npm test`
  - [ ] `npm run lint`

---

## PR5 — threeHourBucket 제거/사용처 정리 + 테스트 갱신
- 목표
  - 더 이상 사용되지 않는 threeHourBucket(0/3/6 기반) 의존을 제거하고, TIME_BLOCKS 기반 규약으로 완전 수렴
- 변경 파일 후보
  - src/features/schedule/utils/threeHourBucket.ts
  - tests/three-hour-bucket-utils.test.ts
  - (잔여 사용처 정리) PR2~PR4에서 남은 import 지점
- AC
  - [ ] threeHourBucket 관련 유틸/상수/테스트가 더 이상 제품 동작에 필요하지 않음이 확인됨
  - [ ] TIME_BLOCKS 기반 helper 및 관련 테스트(유형)로 안전망이 전환됨
  - [ ] 전체 빌드/런타임 오류 없이 동작
- 롤백
  - [ ] 제거 PR은 단독 revert 가능(단, 이전 PR들이 threeHourBucket에 의존하지 않도록 선행 PR에서 완전 전환 필요)
- 테스트(체크리스트, 유형만)
  - [ ] `npm test`
  - [ ] `npm run lint`

---

## Version Management (마지막 마일스톤)
- 목표: Target Release(제안: 1.0.161)로 버전/릴리즈 아티팩트를 정합성 있게 반영
- 변경 파일 후보
  - package.json
  - CHANGELOG.md (존재 시)
- AC
  - [ ] 버전이 Target Release와 일치
  - [ ] 변경 요약이 2~3줄로 명확히 기록

---

## OPEN QUESTION (BLOCKING)
- [ ] (정책) 23-05를 TIME_BLOCKS에 포함할까요? 포함한다면 **야간에 작업 배치 허용**까지 할까요?
- [ ] (규약) 분류 충돌(`task.timeBlock` vs `hourSlot`) 시 UI는 항상 `task.timeBlock` 우선으로 고정할까요? (요구사항상 ‘필요시 우선’이므로, “항상 우선”으로 강화할지 결정 필요)
- [ ] (릴리즈) Target Release를 1.0.161로 올리는 것이 맞나요? (현재 1.0.160)

---

## Handoff (Critic Review Required)
- 이 계획서는 구현 전 Critic 리뷰를 반드시 거친 후, Implementer가 PR1→PR5 순서로 실행한다.
