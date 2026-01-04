# Phase 2 — FocusView/Timeline/Battle 등 3시간 버킷 통일 (UI-only, hourSlot 유지)

## Plan Header
- Plan ID: plan-2025-12-20-phase2-3h-bucket-unification-pr-plan
- Target Release: **1.0.160 (제안, 현재 package.json = 1.0.159)**
- Epic Alignment: “Phase 2(FocusView/Timeline/Battle 등) 3시간 버킷 통일”
- Status: Draft (Critic 순서 반영)
- References:
  - agent-output/analysis/013-three-hour-bucket-unification-analysis.md
  - agent-output/analysis/014-three-hour-bucket-ui-surfaces-analysis.md
  - agent-output/critiques/013-three-hour-bucket-unification-analysis-critique.md

## Value Statement and Business Objective
As a 사용자, I want to Focus/Timeline/Battle(미션) 등 모든 시간 기반 화면이 동일한 “3시간 버킷” 단위로 동일한 용어/라벨/동작을 제공해서, so that 화면 간 이동/추가/드래그 시 작업이 다른 의미로 해석되어 혼란이 생기지 않게 하고 인지 부하를 줄이고 싶다.

## Scope / Constraints (필수)
- [ ] 프론트/UI만 변경 (Dexie 스키마/Repository/동기화 계약/데이터 모델 변경 금지)
- [ ] `Task.hourSlot` 데이터 모델 유지 (저장 구조 변경/마이그레이션 없음)
- [ ] `any` 금지
- [ ] optional chaining 필수(중첩 상태 접근 포함)
- [ ] 기본값 하드코딩 금지(기본값은 단일 출처 상수 사용: `SETTING_DEFAULTS`/`TASK_DEFAULTS`/`MAX_TASKS_PER_BUCKET` 등)

## Guiding Decisions (이번 Phase 2에서 불변으로 간주)
- [ ] “버킷 정책”은 `src/features/schedule/utils/threeHourBucket.ts`의 유틸/상수(`MAX_TASKS_PER_BUCKET`, `normalizeDropTargetHourSlot`, `formatBucketRangeLabel`)를 단일 출처로 사용
- [ ] UI 진입점(추가/드롭/모달 seed)에서 `hourSlot`은 “버킷 시작 시각(anchor)”으로 쓰는 흐름을 유지(이미 Focus/Timeline/Mission에서 부분 적용 중)

---

# PR 실행계획 (Critic 권장 순서)

## PR#1 — MissionModal 문구 정렬 (Low risk)
- [ ] 목표: Battle 미션 “스케줄에 추가” UX 문구를 3시간 버킷 용어로 통일하고, 현재 구현(버킷 anchor로 hourSlot 저장)의 의미를 사용자에게 일관되게 전달
- [ ] 변경 파일 후보:
  - [ ] src/features/battle/components/MissionModal.tsx
  - [ ] (문구가 분산된 경우) src/features/battle/components/* (Mission 카드/토스트 관련)
- [ ] 주요 변경점(요지):
  - [ ] “현재 시간대”/“현재 시간” 중심 표현을 “현재 버킷” 중심으로 정렬
  - [ ] 성공/실패 토스트에서 버킷 범위(`formatBucketRangeLabel`)를 일관되게 노출
  - [ ] “현재 시간에 해당하는 블록이 없음” 같은 에지 케이스 메시지를 버킷 기준 표현으로 정리(동작 자체 변경은 최소화)
- [ ] AC(수용 기준):
  - [ ] MissionModal에서 스케줄 추가 관련 모든 사용자-facing 텍스트가 “버킷” 용어로 통일
  - [ ] 기능 동작(버킷 capacity 체크/추가 성공/실패)은 기존과 동일(문구만 변경)
  - [ ] optional chaining/기본값 단일 출처 규칙 위반 없음
- [ ] 롤백 방법:
  - [ ] PR 단위 revert로 문구만 원복(데이터/상태 영향 없음)
- [ ] 테스트 전략(vitest):
  - [ ] vitest 추가/수정 불필요(문구 변경 중심)
  - [ ] 단, 문구 생성이 별도 유틸로 분리된다면 해당 유틸은 단위 테스트 추가 고려(순수 함수에 한함)

---

## PR#2 — FocusView 라벨 정리 (Medium risk)
- [ ] 목표: FocusView가 이미 “버킷 기반 동작”인 점을 전제로, 라벨/카피에서 1시간/현재 시각(HH:MM) 중심 인상을 줄이고 “버킷 범위”를 1차 정보로 고정
- [ ] 변경 파일 후보:
  - [ ] src/features/schedule/components/FocusView.tsx
  - [ ] (필요 시) FocusView 내 하위 프리젠테이션 컴포넌트
- [ ] 주요 변경점(요지):
  - [ ] 상단 슬롯 라벨에서 “HH:MM”을 1차 정보로 노출하는 구조를 완화(버킷 범위가 1차)
  - [ ] “현재 버킷/이번 버킷” 등 카피를 통일(버킷/블록 용어 혼재 제거)
  - [ ] 버킷 capacity 표기/에러 문구가 `formatBucketRangeLabel`와 일관되게 표현
- [ ] AC(수용 기준):
  - [ ] FocusView 내 시간 관련 라벨/문구가 “3시간 버킷” 기준으로 일관
  - [ ] 작업 필터링/추가/진행률 로직은 변경하지 않거나(가능하면) 최소 변경으로 제한
  - [ ] PiP/메모/브레이크 전환 등 파이프라인의 동작 회귀 없음(라벨 변경으로 인한 부수효과 없음)
- [ ] 롤백 방법:
  - [ ] FocusView 관련 커밋만 revert
- [ ] 테스트 전략(vitest):
  - [ ] vitest 추가는 원칙적으로 불필요(표시/문구 중심)
  - [ ] 단, 라벨 계산을 유틸로 분리하는 경우 순수 유틸에 한해 테스트 추가 가능

---

## PR#3 — HourBar 사용 여부 확인/정리 (Low~Medium)
- [ ] 목표: HourBar(레거시 1시간 UI)가 실제 사용 중인지 확정하고, 미사용이면 코드/영구 상태 키를 정리하여 “버킷 통일”과 충돌할 여지를 제거
- [ ] 변경 파일 후보:
  - [ ] src/features/schedule/HourBar.tsx
  - [ ] src/data/repositories/systemRepository.ts (HourBar 관련 systemState 키가 있다면)
  - [ ] (추가) HourBar import/라우팅/렌더 위치(검색으로 확인된 파일들)
- [ ] 주요 변경점(요지):
  - [ ] 1단계(확인): 코드 검색으로 HourBar import/사용처 유무를 확정하고 계획에 기록
  - [ ] 2단계(정리): 미사용이 확정되면 제거(또는 최소한 export 제거/접근 불가화) + 관련 systemState 키 정리 여부 결정
  - [ ] 사용 중이라면: Phase 2 범위에서 “버킷 통일” 목표와 충돌하는 지점을 문서화하고, 제거/대체는 Timeline PR과 분리하여 별도 PR로 처리(이번 PR에서 무리하게 리팩터링 금지)
- [ ] AC(수용 기준):
  - [ ] HourBar가 미사용인 경우: 제거 후에도 빌드/런타임 오류 없음
  - [ ] HourBar가 사용 중인 경우: 사용 위치와 역할이 문서화되고, 최소한의 안전 조치(중복 정책/라벨 충돌 방지)가 합의됨
  - [ ] systemState 정리는 “데이터 마이그레이션 없이도” 안전한 범위로 제한(필요 시 키는 남기되 미사용 처리)
- [ ] 롤백 방법:
  - [ ] HourBar 정리만 revert 하면 즉시 복구 가능하도록 커밋을 단일 목적(삭제/정리)로 유지
- [ ] 테스트 전략(vitest):
  - [ ] vitest 추가/수정 불필요(사용처 제거/정리 중심)
  - [ ] 대신 `npm run lint` 및 앱 부팅 스모크 검증을 필수로 포함(단, QA 문서에 테스트 케이스로 작성하지는 않음)

---

## PR#4 — Calendar export 의미 결정 (Medium risk)
- [ ] 목표: Google Calendar export가 `hourSlot`을 “정확한 시간”으로 해석하는지, “버킷 anchor(시작 시각)”로 해석하는지 제품/UX 의미를 확정하고 그에 맞게 UI/서비스를 정합화
- [ ] 변경 파일 후보:
  - [ ] src/shared/services/calendar/googleCalendarService.ts (`taskToCalendarEvent`)
  - [ ] src/features/settings/components/tabs/GoogleCalendarTab.tsx (설명/도움말/문구가 있는 경우)
  - [ ] src/shared/subscribers/googleSyncSubscriber.ts (temp/task 이벤트 생성 경로 확인)
  - [ ] (관련 repo) src/data/repositories/calendarRepository.ts
- [ ] 주요 변경점(요지):
  - [ ] **의미 결정**: export 시작 시각을 (A) `task.hourSlot` 그대로, (B) `getBucketStartHour(task.hourSlot)`로 정규화, (C) timeBlock 시작 시각 기반 등 중 하나로 확정
  - [ ] 확정된 의미를 Settings UI에서 명시(“이벤트는 버킷 시작 시각 기준으로 생성됨” 등)
  - [ ] 기본값(현재 `task.hourSlot ?? 9`)은 하드코딩 제거/대체(단일 출처 상수/설정 기반) 검토
- [ ] AC(수용 기준):
  - [ ] Calendar export의 시작 시각 규칙이 문서/화면 설명/실제 동작이 모두 일치
  - [ ] “버킷 통일”로 인해 많은 작업이 같은 시각(예: 08:00)에 몰릴 수 있다는 점이 의도된 동작인지 확인되고, 의도라면 UI에서 충분히 안내
  - [ ] hourSlot 미존재 시 fallback 규칙이 명확하고 하드코딩 기본값 규칙을 위반하지 않음
- [ ] 롤백 방법:
  - [ ] calendar export 관련 변경만 revert 하면 이전 export 동작으로 복구(데이터 마이그레이션 없음)
- [ ] 테스트 전략(vitest):
  - [ ] `taskToCalendarEvent`가 순수 함수이므로, 의미 결정 후 해당 규칙을 단위 테스트로 고정하는 것을 권장(기존 테스트가 없다면 추가)
  - [ ] UI 테스트는 범위 밖(단, 설정 탭의 문구 변경은 스모크 확인)

---

## PR#5 — TimelineView 구조 통일 (High risk, 마지막)
- [ ] 목표: TimelineView가 “버킷 통일” 목표와 일치하도록, 화면 구조(그룹/행 모델/라벨/상호작용)를 3시간 버킷 기준으로 정렬
- [ ] 변경 파일 후보:
  - [ ] src/features/schedule/TimelineView/TimelineView.tsx
  - [ ] src/features/schedule/TimelineView/useTimelineData.ts
  - [ ] src/features/schedule/TimelineView/TimelineTaskBlock.tsx
  - [ ] (DnD 관련) src/features/schedule/hooks/useDragDrop.ts, src/features/schedule/hooks/useDragDropManager.ts
  - [ ] (공유 유틸) src/features/schedule/utils/threeHourBucket.ts
- [ ] 주요 변경점(요지) — sub-step (한 PR 내 체크리스트):
  - [ ] (1) **행 모델 결정**: “24시간 행 유지 + 버킷 동작만” vs “버킷 행(3시간 단위)로 UI도 전환” 중 하나로 확정
  - [ ] (2) `useTimelineData`의 grouping을 행 모델에 맞게 재정의(1시간 hourGroups 의존 제거/축소)
  - [ ] (3) overtime/경고 계산을 행 모델에 맞게 재정의(시간당 60분 기준 가정 제거)
  - [ ] (4) empty 클릭/모달 seed/드롭 타겟이 `normalizeDropTargetHourSlot` 규칙과 항상 일치하도록 정리
  - [ ] (5) tooltip/라벨이 버킷 범위 중심으로 통일(1시간 라벨이 남는 경우 “정확한 시간”이 아니라 “시각 격자”임을 명확히)
  - [ ] (6) 성능 리스크(렌더링 행 수 변화, DnD hit-test 변화) 확인 및 최소 완화
- [ ] AC(수용 기준):
  - [ ] Timeline에서 보이는 “시간 단위/라벨/상호작용”이 다른 화면(ThreeHourBucket/Focus/Mission)과 동일한 버킷 의미를 가진다
  - [ ] 빈 영역 클릭, 드롭 이동, 툴팁 표시가 버킷 기준으로 일관되며, 버킷 capacity 정책이 항상 동일하게 적용된다
  - [ ] 고정된 규칙(버킷 유틸/정규화/상수) 외에 새로운 “시간 계산 규칙”이 중복 도입되지 않는다(DRY)
- [ ] 롤백 방법:
  - [ ] PR#5는 단독 revert가 가능하도록 다른 PR과 의존 커밋을 섞지 않는다
  - [ ] DnD/유틸 변경이 불가피하다면 “Timeline 전용 변경”으로 범위를 제한하고, 이전 PR의 계약을 깨지 않도록 유지
- [ ] 테스트 전략(vitest):
  - [ ] UI 자체보다는, Timeline에서 분리 가능한 순수 계산(그룹핑/오버타임/정규화)을 유틸화하여 단위 테스트로 고정하는 것을 권장
  - [ ] 기존 `tests/three-hour-bucket-utils.test.ts`와 충돌 없이 보강(새 테스트 파일 추가 가능)

---

## Version / Release Artifacts (마지막 마일스톤)
- [ ] 목표: Target Release(제안: 1.0.160)로 버전 및 변경 요약을 정합성 있게 반영
- [ ] 변경 파일 후보:
  - [ ] package.json
  - [ ] CHANGELOG.md (존재 시)
  - [ ] README.md (사용자-facing 변경 안내가 필요할 때만)
- [ ] AC(수용 기준):
  - [ ] 버전이 Target Release에 맞게 업데이트되고, “3시간 버킷 통일(Phase 2)” 변경이 2~3줄로 요약된다

---

## OPEN QUESTION (BLOCKING)
- [ ] Calendar export 의미(PR#4)는 (A) hourSlot 그대로(=버킷 anchor가 되면 충돌 가능) vs (B) 버킷 anchor를 의도적으로 내보냄 vs (C) 별도 규칙 중 무엇으로 확정할까요?
- [ ] Target Release를 1.0.160으로 올리는 것이 맞나요? (현재 1.0.159)
