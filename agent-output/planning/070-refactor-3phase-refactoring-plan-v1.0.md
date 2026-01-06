---
ID: 70
Origin: 70
UUID: 9e4b2d71
Status: QA Failed
---

# Refactoring Plan v1.1

> QA: Final verification NEEDS_FIXES (2026-01-05). See `agent-output/qa/070-refactor-3phase-refactoring-final-qa.md`.

## Plan Header
- **Target Release:** **1.0.185 (proposed)**
  - Note: 현재 [package.json](package.json) 버전은 1.0.182.
- **Epic Alignment:** Structural refactor hotspot reduction (Priority 1) + regression risk controls
- **Changelog (v1.0 → v1.1):** Critic 피드백(C1~C3, H1~H4) 반영 + BossAlbumModal을 Phase 2로 이동 + syncEngine↔toast “엔트리 포인트” 파일 경로 명시

## Pre-Implementation Checklist
- [ ] Git tags created
- [ ] Test baseline established
- [ ] Import graph generated

### Pre-Implementation Tasks (timebox: 1–2h each)
1. **Git 태그 규약 확정 + baseline 태그 생성**
   - 목표: 롤백을 “작업 단위”로 보장
   - 태그 규약(필수):
     - `refactor/baseline`
     - `refactor/phase-1-start`, `refactor/phase-1-complete`
     - `refactor/phase-2-start`, `refactor/phase-2-complete`
     - `refactor/phase-3-start`, `refactor/phase-3-complete`

2. **테스트/커버리지 베이스라인 캡처(회귀 가드 준비)**
   - 실행: `npm run test:coverage`
   - 기록 위치(고정): `agent-output/planning/070-refactor-coverage-baseline.md`
   - 최소 기록 대상(경로 고정):
     - [src/shared/services/task/unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts) (분석상 58.91%로 알려짐)
     - [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts)
     - [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts)
     - [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)
     - [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx)
     - [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx)
     - [src/features/insight/DailySummaryModal.tsx](src/features/insight/DailySummaryModal.tsx)
     - [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx)

3. **Import dependency graph 생성 + circular dependency 0 확인(Phase 착수 전 차단 조건)**
   - 목표: Phase 간 역방향 import/순환 의존을 조기에 차단
   - 산출물 위치(고정): `agent-output/planning/070-refactor-import-graph.md`
   - 도구(권장): `madge`(없으면 devDependency로 추가) 또는 동등 도구
   - 최소 산출물: (a) import graph 이미지/텍스트, (b) circular dependency 목록(0이어야 함)
   - 명문화할 규칙(필수):
     - 허용 import 방향: Phase 1 → Phase 2 → Phase 3
     - 금지: Phase 2/3가 Phase 1로 역수입을 강제하는 구조(특히 Foundation 유틸이 store를 import)

4. **TemplateModal 범위 확정(혼동 방지)**
   - In-scope: [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx)
   - Out-of-scope(명시): [src/features/tempSchedule/components/TemplateModal.tsx](src/features/tempSchedule/components/TemplateModal.tsx)

---

## Phase 1: Foundation & Service Extraction (Implementer 1)

### Scope
- [src/shared/types/domain.ts](src/shared/types/domain.ts)
- [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts)
- [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)
- [src/features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx)
- [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx)
- [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx)
- [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx)
- [src/features/stats/StatsModal.tsx](src/features/stats/StatsModal.tsx)

### Tasks (timebox: 1–2h each)
1. **Tag phase start**: `refactor/phase-1-start`

2. **domain.ts: facade scaffold only (no semantic change)**
   - 대상: [src/shared/types/domain.ts](src/shared/types/domain.ts)
   - 산출: `src/shared/types/domain/` 디렉터리 + re-export 중심 facade 구조 준비

3. **domain.ts: move 1 domain bundle (tasks)**
   - 대상: [src/shared/types/domain.ts](src/shared/types/domain.ts)
   - 원칙: 기존 import 경로는 유지(기존 파일은 re-export)

4. **domain.ts: move 1 domain bundle (schedule)**
   - 대상: [src/shared/types/domain.ts](src/shared/types/domain.ts)

5. **syncEngine↔toast 결합 해소: toast는 엔트리 포인트에서만(경로 고정) + 모듈화 1회차(순수 헬퍼)**
   - 대상: [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts), [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)
   - 규칙(필수): toast/store 의존은 “엔트리 포인트(초기화/오케스트레이션)”에서만.
     - 엔트리 포인트(이 플랜에서 고정): [src/data/db/infra/useAppInitialization.ts](src/data/db/infra/useAppInitialization.ts)
     - 목표 상태: `syncEngine.ts`는 toast store를 직접 import 하지 않음(동기화 결과/상태를 상위로 전달)
     - 하위 모듈(추출되는 파일들)에는 toast/UI store import 신규 추가 금지

6. **syncEngine: 모듈화 2회차(하위 서브시스템 1개만 추출)**
   - 대상: [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts)

7. **parseInput 통합 전 보호(특성화) 테스트 추가**
   - 대상: [src/features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx), [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx)
   - 목표: 통합 과정에서의 미묘한 동작 변화 방지

8. **parseInput 공용 유틸 도입 + BulkAddModal 전환**
   - 대상: [src/features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx)

9. **TaskBreakdownModal 전환 + 중복 제거**
   - 대상: [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx)

10. **TemplateModal: 검증/스키마 로직 분리 1회차**
   - 대상: [src/features/template/TemplateModal.tsx](src/features/template/TemplateModal.tsx)

11. **TaskModal: recurrence/date 계산 분리 1회차(순수 유틸)**
   - 대상: [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx)

12. **StatsModal: 집계 로직 1회차 분리(순수 헬퍼/selector)**
   - 대상: [src/features/stats/StatsModal.tsx](src/features/stats/StatsModal.tsx)

13. **Tag phase complete**: `refactor/phase-1-complete`

### Deliverables
- `src/shared/types/domain/*` + facade 유지: [src/shared/types/domain.ts](src/shared/types/domain.ts)
- `src/data/db/infra/syncEngine/*` + facade 유지: [src/data/db/infra/syncEngine.ts](src/data/db/infra/syncEngine.ts)
- `src/features/tasks/utils/*`(또는 동등 위치) 공용 파서 유틸
- Template/Task/Schedule/Stats에 대한 hooks/utils/components 분리 시작(최소 1개씩)

### Verification Checklist
- [ ] `npm run build` 통과
- [ ] `npm run test` 통과
- [ ] `npm run test:coverage`에서 **베이스라인 대비 회귀가 5% 초과하지 않음**
- [ ] Import graph/circular check 통과(새 순환 의존 0)
- [ ] syncEngine 하위 모듈에 toast/UI store 의존이 새로 추가되지 않음

---

## Phase 2: Store Refactor & Core UI Split (Implementer 2)

### Scope
- [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts)
- [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)
- [src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts)
- [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx)
- [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx)
- [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx)
- [src/features/battle/stores/battleStore.ts](src/features/battle/stores/battleStore.ts)

### Tasks (timebox: 1–2h each)
1. **Tag phase start**: `refactor/phase-2-start`

2. **dailyDataStore consumer mapping (필수 선행, 15+ 소비자 예상)**
   - 대상: [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts)
   - 산출물(고정): `agent-output/planning/070-dailyDataStore-consumer-map.md`
   - 내용: dailyDataStore import 소비자 목록 + 사용 action/selector 요약

3. **dailyDataStore slice 설계 1회차(consumer map 기반)**
   - 대상: [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts)
   - 원칙: facade 유지 + 소비자 수정 최소화

4. **dailyDataStore selectors-only slice 추출(읽기 전용 우선)**
   - 대상: [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts)

5. **dailyDataStore mutation cluster 1개 추출(예: completion/toggle)**
   - 대상: [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts)

6. **InboxTab: UI 섹션 1개 분리(presentation 컴포넌트)**
   - 대상: [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)

7. **InboxTab: 비-UI 관심사 1개 분리(hook/controller)**
   - 대상: [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)

8. **useInboxHotkeys 책임 분리(네비게이션 vs 뮤테이션)**
   - 대상: [src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts)

9. **WeeklyGoalCard: 렌더 vs mutation/usecase 분리 1회차**
   - 대상: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx)

10. **TemplatesModal: list UI vs selection/pagination/mutation 분리 1회차**
   - 대상: [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx)

11. **battleStore: 계산 로직 1개를 순수 유틸로 이동**
   - 대상: [src/features/battle/stores/battleStore.ts](src/features/battle/stores/battleStore.ts)

12. **BossAlbumModal(689 LOC): UI 섹션 1개 컴포넌트 분리**
   - 대상: [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx)

13. **BossAlbumModal: 상태/계산 로직 1개를 hook/utils로 분리**
   - 대상: [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx)

14. **Tag phase complete**: `refactor/phase-2-complete`

### Deliverables
- `agent-output/planning/070-dailyDataStore-consumer-map.md`
- `src/shared/stores/dailyDataStore/*` 슬라이스 모듈(기존 export 유지)
- `src/features/tasks/components/inbox/*` + `src/features/tasks/hooks/inbox/*` (또는 동등 위치)
- `src/features/goals/hooks/*` (또는 동등 위치)
- `src/features/template/hooks/*` + `src/features/template/components/*`
- `src/features/battle/utils/*` (또는 동등 위치)
- `src/features/battle/hooks/*` + `src/features/battle/components/*` (BossAlbumModal 분해 산출)

### Verification Checklist
- [ ] `npm run build` 통과
- [ ] `npm run test` 통과
- [ ] `npm run test:coverage`에서 **베이스라인 대비 회귀가 5% 초과하지 않음**
- [ ] Import graph/circular check 통과(새 순환 의존 0)
- [ ] dailyDataStore 공개 API/기존 import 경로 유지(Facade)

---

## Phase 3: Remaining Component Splits & Integration Verification (Implementer 3)

### Scope
- [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
- [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx)
- [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)
- [src/features/insight/DailySummaryModal.tsx](src/features/insight/DailySummaryModal.tsx)

### Tasks (timebox: 1–2h each)
1. **Tag phase start**: `refactor/phase-3-start`

2. **WeeklyScheduleView: 그리드 렌더 컴포넌트 분해 1회차**
   - 대상: [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)

3. **TempScheduleTimelineView: positioning math를 순수 유틸로 분리**
   - 대상: [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx)

4. **TempScheduleTaskList: grouping/filter 로직 분리**
   - 대상: [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)

5. **DailySummaryModal: async orchestration을 hook/controller로 분리 1회차**
   - 대상: [src/features/insight/DailySummaryModal.tsx](src/features/insight/DailySummaryModal.tsx)

6. **Integration smoke(최소 수동) 기록**
   - 대상: Phase 3 scope 전부
   - 체크: (a) 모달 오픈, (b) 1회 주요 액션, (c) ESC 닫기

7. **Version management milestone (release artifacts 준비)**
   - 작업: CHANGELOG에 “구조 리팩터/회귀 가드/의존 그래프” 변경 요약 초안 작성 + 릴리즈 버전(1.0.185 제안) 확인

8. **Tag phase complete**: `refactor/phase-3-complete`

### Deliverables
- `src/features/tempSchedule/utils/*` + `src/features/tempSchedule/hooks/*` + `src/features/tempSchedule/components/*` 분리 아웃풋
- `src/features/insight/hooks/*` + `src/features/insight/components/*`
- CHANGELOG 초안(릴리즈 그룹용)

### Verification Checklist
- [ ] `npm run build` 통과
- [ ] `npm run test` 통과
- [ ] `npm run test:coverage`에서 **베이스라인 대비 회귀가 5% 초과하지 않음**
- [ ] Import graph/circular check 통과(새 순환 의존 0)
- [ ] `npm run electron:dev`로 주요 화면/모달 오픈이 깨지지 않음(수동 최소 체크)

---

## Rollback Procedures
- **Each phase independently revertible:** 다음 phase 착수는 반드시 직전 phase의 Verification Checklist 통과 + `refactor/phase-N-complete` 태그 생성 이후
- **Rollback unit:** 문제가 확인되면 가장 최근 `refactor/phase-N-complete` 태그로 되돌리고(또는 `refactor/phase-N-start` 이전), 원인을 축소한 뒤 재시도
- **Tag-based workflow:** 시작 태그가 없는 phase는 착수 금지(롤백 경로 보장)

## Risk Mitigation Matrix

| Item | Risk | Likelihood | Impact | Mitigation in v1.1 | Verification Gate |
|------|------|------------|--------|--------------------|------------------|
| C1 | BossAlbumModal 누락 | High | Medium | Phase 2 scope에 [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx) 추가 | Phase 2 build/test/coverage/cycle |
| C2 | 커버리지 베이스라인 부재 | High | Medium | Pre-Implementation에서 baseline 캡처 + phase별 회귀 ≤5% | `npm run test:coverage` 비교 |
| C3 | 순환 의존 검증 부재 | Medium | High | Pre-Implementation에서 import graph + 매 phase 후 재검증 | circular 0 + 방향 규칙 위반 0 |
| H1 | dailyDataStore 중앙 결합 | High | High | Phase 2에서 consumer map 생성 후 slice 설계/추출 | consumer map 존재 + 테스트 통과 |
| H2 | syncEngine↔toast 결합 | Medium | Medium | toast 방출은 엔트리에서만, 하위 모듈은 순수 로직 | 하위 모듈 toast/UI 의존 0 |
| H3 | TemplateModal 2개 혼동 | Medium | Low | Pre-Implementation에서 경로로 in/out scope 고정 | 리뷰에서 스코프 혼동 0 |
| H4 | 롤백 전략 부재 | Medium | High | phase start/complete 태그 + 착수 게이트 | 태그 존재 + revert 가능 |
