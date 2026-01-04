---
ID: 59
Origin: 59
UUID: 1a4d2f8b
Status: QA Complete
---

# Plan: PR1(Lint/TS 오류 수정) — 세부 Task 분해 (2026-01-03)

- Target Release: **1.0.182** (상위 계획: [agent-output/planning/058-foundation-pr-breakdown-no-doc-deps-2026-01-03.md](agent-output/planning/058-foundation-pr-breakdown-no-doc-deps-2026-01-03.md))
- Epic Alignment: PR1 Gate green (ESLint + TypeScript)
- Source Analysis: [agent-output/analysis/059-lint-tsc-diagnostics-analysis.md](agent-output/analysis/059-lint-tsc-diagnostics-analysis.md)
- Status: QA Complete

## Changelog

| Date | Update | Summary |
|------|--------|---------|
| 2026-01-03 | QA Complete | QA 리포트 작성 및 게이트 재검증 PASS: [agent-output/qa/059-pr1-lint-ts-task-breakdown-qa.md](agent-output/qa/059-pr1-lint-ts-task-breakdown-qa.md) |

## Value Statement and Business Objective
As a 사용자(오빠), I want Lint/TypeScript 게이트가 먼저 초록색이 되길, so that 이후 PR들이 “의미 있는 UX/테스트 변화”에만 집중하고 회귀/불안정 노이즈를 줄인다.

## 입력(Analyst 진단 요약)과 우선순위
- ESLint: duplicate imports 2개(auto-fix), hook deps/fast-refresh 3개(manual), unused var 1개(manual)
- TS: unused params 8개, repo generic/table typing 8개, domain property drift 40개, module/export resolution 8개, component prop/handler mismatch 15개, literal/union 7개, test typing 10개
- 영향 파일(실측): 43개(tsc) + 5개(eslint 중복 포함) + 타입 소스 파일 일부
- 우선순위: **ESLint error → repo/domain typing → module resolution → component props → test typing(마지막)**

---

## 1) Task 리스트

> 제약 준수: 각 Task는 **최대 10파일 / 50LOC 이내**로 계획한다. (실제 구현 중 초과 시 즉시 Task를 더 쪼갠다.)

### ESLint (Gate: `npm run lint`)

**PR1-LINT-A01**
- 목표: `no-duplicate-import` 2개를 auto-fix로 제거한다.
- 영향 파일/폴더: [src/data/repositories/dailyData/coreOperations.ts](src/data/repositories/dailyData/coreOperations.ts), [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx)
- 예상 LOC: 2–8
- 의존성: 없음
- 검증방법: `npm run lint`

**PR1-LINT-M02**
- 목표: `react-refresh/only-export-components` 경고를 해소한다(컴포넌트 외 export 분리/정리).
- 영향 파일/폴더: [src/features/goals/components/GoalsFilterBar.tsx](src/features/goals/components/GoalsFilterBar.tsx) (+ 필요 시 동일 폴더에 helper 파일 1개 추가)
- 예상 LOC: 10–30
- 의존성: PR1-LINT-A01
- 검증방법: `npm run lint`

**PR1-LINT-M03**
- 목표: `react-hooks/exhaustive-deps` 2건을 해소한다(누락 dep 포함/복잡 표현식 분리).
- 영향 파일/폴더: [src/features/goals/hooks/useProgressUndo.ts](src/features/goals/hooks/useProgressUndo.ts)
- 예상 LOC: 5–25
- 의존성: PR1-LINT-A01
- 검증방법: `npm run lint`

**PR1-LINT-M04**
- 목표: `@typescript-eslint/no-unused-vars` 경고(미사용 setter) 1건을 해소한다.
- 영향 파일/폴더: [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)
- 예상 LOC: 1–10
- 의존성: PR1-LINT-A01
- 검증방법: `npm run lint`

### TypeScript (Gate: `npx tsc --noEmit`)

**PR1-TS-REPO-01**
- 목표: repository generic/table typing 불일치(대표: baseRepository)로 인한 연쇄 오류를 끊는다.
- 영향 파일/폴더:
  - [src/data/repositories/baseRepository.ts](src/data/repositories/baseRepository.ts)
  - [src/data/repositories/gameState/index.ts](src/data/repositories/gameState/index.ts)
  - [src/data/repositories/settingsRepository.ts](src/data/repositories/settingsRepository.ts)
  - [src/data/repositories/waifuRepository.ts](src/data/repositories/waifuRepository.ts)
  - [src/features/pip/PipTimer.tsx](src/features/pip/PipTimer.tsx)
  - [src/shared/stores/settingsStore.ts](src/shared/stores/settingsStore.ts)
- 예상 LOC: 20–50
- 의존성: PR1-LINT-* 전체 완료 권장(최소 PR1-LINT-A01)
- 검증방법: `npx tsc --noEmit`

**PR1-TS-DOMAIN-01**
- 목표: AIInsight/Quest 도메인 드리프트(예: `generatedAt`, `reward`)를 계약(타입) 기준으로 정렬한다.
- 영향 파일/폴더:
  - [src/shared/types/domain.ts](src/shared/types/domain.ts)
  - [src/data/repositories/aiInsightsRepository.ts](src/data/repositories/aiInsightsRepository.ts)
  - [src/data/repositories/gameState/index.ts](src/data/repositories/gameState/index.ts)
  - [src/data/repositories/gameState/questOperations.ts](src/data/repositories/gameState/questOperations.ts)
- 예상 LOC: 10–35
- 의존성: PR1-TS-REPO-01(권장)
- 검증방법: `npx tsc --noEmit`

**PR1-TS-DOMAIN-02**
- 목표: BattleSettings 도메인 드리프트(예: `bossDefeatXP`, `dailyBossCount`, `bossBaseHP`)를 정렬한다.
- 영향 파일/폴더:
  - [src/shared/types/domain.ts](src/shared/types/domain.ts)
  - [src/features/battle/utils/xp.ts](src/features/battle/utils/xp.ts)
  - [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts)
- 예상 LOC: 5–25
- 의존성: PR1-TS-DOMAIN-01
- 검증방법: `npx tsc --noEmit`

**PR1-TS-DOMAIN-03**
- 목표: Task 도메인 드리프트(예: `updatedAt`, `scheduledDate`)를 정렬하고 conflictResolver 산술 타입 오류를 해소한다.
- 영향 파일/폴더:
  - [src/shared/types/domain.ts](src/shared/types/domain.ts)
  - [src/shared/services/sync/firebase/conflictResolver.ts](src/shared/services/sync/firebase/conflictResolver.ts)
  - [src/shared/subscribers/googleSyncSubscriber.ts](src/shared/subscribers/googleSyncSubscriber.ts)
- 예상 LOC: 10–35
- 의존성: PR1-TS-DOMAIN-01
- 검증방법: `npx tsc --noEmit`

**PR1-TS-DOMAIN-04**
- 목표: TaskCompletionResult 드리프트(`xpEarned`)를 정렬한다.
- 영향 파일/폴더:
  - [src/shared/services/gameplay/taskCompletion/types.ts](src/shared/services/gameplay/taskCompletion/types.ts)
  - [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts)
  - [src/shared/stores/inboxStore.ts](src/shared/stores/inboxStore.ts)
- 예상 LOC: 5–25
- 의존성: PR1-TS-DOMAIN-01
- 검증방법: `npx tsc --noEmit`

**PR1-TS-DOMAIN-05**
- 목표: Calendar mapping 드리프트(`eventId`)를 정렬한다(중복 정의 포함).
- 영향 파일/폴더:
  - [src/shared/services/calendar/googleCalendarTypes.ts](src/shared/services/calendar/googleCalendarTypes.ts)
  - [src/shared/services/calendar/googleCalendarService.ts](src/shared/services/calendar/googleCalendarService.ts)
  - [src/data/repositories/calendarRepository.ts](src/data/repositories/calendarRepository.ts)
- 예상 LOC: 5–25
- 의존성: PR1-TS-DOMAIN-01
- 검증방법: `npx tsc --noEmit`

**PR1-TS-DOMAIN-06**
- 목표: Weather forecast 타입(예: `DayForecast[]` vs `forecast`) 드리프트를 정렬한다.
- 영향 파일/폴더:
  - [src/shared/types/weather.ts](src/shared/types/weather.ts)
  - [src/data/repositories/weatherRepository.ts](src/data/repositories/weatherRepository.ts)
- 예상 LOC: 5–25
- 의존성: PR1-TS-DOMAIN-01
- 검증방법: `npx tsc --noEmit`

**PR1-TS-DOMAIN-07**
- 목표: unifiedTaskService의 TimeBlockId 타입 불일치(string → TimeBlockId)를 해소한다.
- 영향 파일/폴더: [src/shared/services/task/unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts)
- 예상 LOC: 5–25
- 의존성: PR1-TS-DOMAIN-01
- 검증방법: `npx tsc --noEmit`

### Module / Export Resolution

**PR1-TS-MOD-01**
- 목표: repositories index 재export 충돌(TS2308)을 해소한다.
- 영향 파일/폴더: [src/data/repositories/index.ts](src/data/repositories/index.ts)
- 예상 LOC: 5–20
- 의존성: PR1-TS-REPO-01
- 검증방법: `npx tsc --noEmit`

**PR1-TS-MOD-02**
- 목표: settings tabs 타입 모듈 경로/재export 누락(TS2307/TS2459)을 해소한다.
- 영향 파일/폴더:
  - [src/features/settings/components/tabs/types.ts](src/features/settings/components/tabs/types.ts)
  - [src/data/repositories/tokenUsageRepository.ts](src/data/repositories/tokenUsageRepository.ts)
  - (필요 시) [src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts)
- 예상 LOC: 10–30
- 의존성: PR1-TS-REPO-01
- 검증방법: `npx tsc --noEmit`

**PR1-TS-MOD-03**
- 목표: TimelineView에서 누락된 export(TS2305: HourGroup)를 해소한다.
- 영향 파일/폴더:
  - [src/features/schedule/TimelineView/index.ts](src/features/schedule/TimelineView/index.ts)
  - [src/features/schedule/TimelineView/useTimelineData.ts](src/features/schedule/TimelineView/useTimelineData.ts)
- 예상 LOC: 3–15
- 의존성: PR1-TS-MOD-01
- 검증방법: `npx tsc --noEmit`

**PR1-TS-MOD-04**
- 목표: TemplatesModal에서 잘못된 named export(TS2724)를 해소한다.
- 영향 파일/폴더:
  - [src/features/template/TemplatesModal.tsx](src/features/template/TemplatesModal.tsx)
  - [src/shared/services/template/templateTaskService.ts](src/shared/services/template/templateTaskService.ts)
- 예상 LOC: 5–20
- 의존성: PR1-TS-MOD-02
- 검증방법: `npx tsc --noEmit`

### Component Props / Handler / UI typing

**PR1-TS-UI-01**
- 목표: 잘못된 React named import(TS2724) 및 관련 UI 타이핑 이슈를 해소한다.
- 영향 파일/폴더:
  - [src/features/battle/components/modal/BattleMissionCard.tsx](src/features/battle/components/modal/BattleMissionCard.tsx)
  - [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx)
  - [src/features/battle/components/MissionModal.tsx](src/features/battle/components/MissionModal.tsx)
- 예상 LOC: 5–25
- 의존성: PR1-TS-MOD-* 완료 권장
- 검증방법: `npx tsc --noEmit` (+ `npm test` 선택)

**PR1-TS-UI-02**
- 목표: FocusView/ScheduleView의 props 계약 불일치 및 미사용 핸들러(TS2322/TS6133)를 해소한다.
- 영향 파일/폴더:
  - [src/features/schedule/components/FocusView.tsx](src/features/schedule/components/FocusView.tsx)
  - [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx)
- 예상 LOC: 10–40
- 의존성: PR1-TS-MOD-03
- 검증방법: `npx tsc --noEmit`

**PR1-TS-UI-03**
- 목표: TaskCard의 handler 타입 불일치(이벤트 파라미터) 문제를 해소한다.
- 영향 파일/폴더: [src/features/schedule/TaskCard.tsx](src/features/schedule/TaskCard.tsx)
- 예상 LOC: 5–15
- 의존성: PR1-TS-UI-02
- 검증방법: `npx tsc --noEmit`

**PR1-TS-UI-04**
- 목표: TaskModal의 duration state literal 타입(예: SetStateAction<15>) 및 Task 조립 타입 불일치를 해소한다.
- 영향 파일/폴더: [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx)
- 예상 LOC: 10–35
- 의존성: PR1-TS-UI-02
- 검증방법: `npx tsc --noEmit`

**PR1-TS-UI-05**
- 목표: InboxTab의 state literal 타입/미사용 함수(TS2345/TS6133)와 ESLint unused-vars를 함께 정리한다.
- 영향 파일/폴더: [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)
- 예상 LOC: 10–40
- 의존성: PR1-LINT-M04, PR1-TS-MOD-* 완료 권장
- 검증방법: `npm run lint`; `npx tsc --noEmit`

**PR1-TS-UI-06**
- 목표: InboxTab의 eventBus 이벤트 키/페이로드 타입 불일치(TS2345/TS2339)를 해소한다.
- 영향 파일/폴더:
  - [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx)
  - [src/shared/lib/eventBus/types.ts](src/shared/lib/eventBus/types.ts)
- 예상 LOC: 5–25
- 의존성: PR1-TS-UI-05
- 검증방법: `npx tsc --noEmit`

**PR1-TS-UI-07**
- 목표: SettingsModal의 prop/value 타입 불일치(TS2322)를 해소한다.
- 영향 파일/폴더: [src/features/settings/SettingsModal.tsx](src/features/settings/SettingsModal.tsx)
- 예상 LOC: 10–30
- 의존성: PR1-TS-MOD-02
- 검증방법: `npx tsc --noEmit`

**PR1-TS-UI-08**
- 목표: StatsModal의 차트 데이터 타입 불일치(TS2322)를 해소한다.
- 영향 파일/폴더: [src/features/stats/StatsModal.tsx](src/features/stats/StatsModal.tsx)
- 예상 LOC: 5–20
- 의존성: PR1-TS-UI-07
- 검증방법: `npx tsc --noEmit`

**PR1-TS-UI-09**
- 목표: WeatherStore/Widget 타입 불일치(lastErrorAt, union literal)를 해소한다.
- 영향 파일/폴더:
  - [src/features/weather/stores/weatherStore.ts](src/features/weather/stores/weatherStore.ts)
  - [src/features/weather/WeatherWidget.tsx](src/features/weather/WeatherWidget.tsx)
- 예상 LOC: 10–35
- 의존성: PR1-TS-DOMAIN-06
- 검증방법: `npx tsc --noEmit`

**PR1-TS-UI-10**
- 목표: Escape key 비교 타입 오류(TS2367)를 해소한다.
- 영향 파일/폴더: [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts)
- 예상 LOC: 3–15
- 의존성: PR1-TS-UI-01
- 검증방법: `npx tsc --noEmit`

**PR1-TS-UI-11**
- 목표: eventBus logger middleware 오버로드 오류(TS2769) 및 logger 미사용 헬퍼(TS6133)를 정리한다.
- 영향 파일/폴더:
  - [src/shared/lib/eventBus/middleware/logger.ts](src/shared/lib/eventBus/middleware/logger.ts)
  - [src/shared/lib/logger.ts](src/shared/lib/logger.ts)
- 예상 LOC: 5–25
- 의존성: PR1-TS-UI-06
- 검증방법: `npx tsc --noEmit`

**PR1-TS-LIT-01**
- 목표: autoTagService의 TimeBlock label map 리터럴/유니온 불일치(TS2740)를 해소한다.
- 영향 파일/폴더: [src/shared/services/rag/autoTagService.ts](src/shared/services/rag/autoTagService.ts)
- 예상 LOC: 5–25
- 의존성: PR1-TS-DOMAIN-01
- 검증방법: `npx tsc --noEmit`

### Tests (마지막)

**PR1-TS-TEST-01**
- 목표: conflict-resolver 테스트의 Task.updatedAt 관련 타입 오류를 해소한다.
- 영향 파일/폴더: [tests/conflict-resolver.test.ts](tests/conflict-resolver.test.ts)
- 예상 LOC: 5–20
- 의존성: PR1-TS-DOMAIN-03
- 검증방법: `npx tsc --noEmit`; `npm test`

**PR1-TS-TEST-02**
- 목표: 나머지 테스트 타이핑 오류(escape 비교, spread tuple, boolean 타입)를 해소한다.
- 영향 파일/폴더:
  - [tests/modal-hotkeys.test.ts](tests/modal-hotkeys.test.ts)
  - [tests/temp-schedule-date-parsing.test.ts](tests/temp-schedule-date-parsing.test.ts)
  - [tests/template-system.test.ts](tests/template-system.test.ts)
- 예상 LOC: 5–25
- 의존성: PR1-TS-UI-10
- 검증방법: `npx tsc --noEmit`; `npm test`

---

## 2) Task 실행 순서(의존성 기반)
1. PR1-LINT-A01
2. PR1-LINT-M02
3. PR1-LINT-M03
4. PR1-LINT-M04
5. PR1-TS-REPO-01
6. PR1-TS-DOMAIN-01
7. PR1-TS-DOMAIN-02
8. PR1-TS-DOMAIN-03
9. PR1-TS-DOMAIN-04
10. PR1-TS-DOMAIN-05
11. PR1-TS-DOMAIN-06
12. PR1-TS-DOMAIN-07
13. PR1-TS-MOD-01
14. PR1-TS-MOD-02
15. PR1-TS-MOD-03
16. PR1-TS-MOD-04
17. PR1-TS-UI-01
18. PR1-TS-UI-02
19. PR1-TS-UI-03
20. PR1-TS-UI-04
21. PR1-TS-UI-05
22. PR1-TS-UI-06
23. PR1-TS-UI-07
24. PR1-TS-UI-08
25. PR1-TS-UI-09
26. PR1-TS-UI-10
27. PR1-TS-UI-11
28. PR1-TS-LIT-01
29. PR1-TS-TEST-01
30. PR1-TS-TEST-02

---

## 3) 각 Task별 롤백 전략
- 원칙: Task당 1커밋(또는 최소 커밋 수)으로 유지해 `git revert`가 항상 가능한 상태를 만든다.
- PR1-LINT-A01: 해당 2파일만 되돌리면 됨(중복 import 라인 복구).
- PR1-LINT-M02: helper 분리/정리만 되돌리면 됨(추가 파일이 있으면 함께 revert).
- PR1-LINT-M03: useEffect deps 변경만 revert.
- PR1-LINT-M04: InboxTab에서 setter 사용/삭제만 revert.
- PR1-TS-REPO-01: repo helper 제네릭/테이블 키 타입 변경을 통째로 revert(연쇄 수정 방지 위해 이 Task는 단독 커밋 권장).
- PR1-TS-DOMAIN-01~07: 타입(계약) 변경은 영향이 넓으므로 **각 Task 단독 커밋**으로 관리하고, 문제가 생기면 그 Task 커밋만 revert.
- PR1-TS-MOD-01~04: export surface 변경은 충돌 가능성이 있어 단독 커밋으로 revert.
- PR1-TS-UI-01~11 및 PR1-TS-LIT-01: UI 타이핑 변경은 해당 컴포넌트 파일만 revert.
- PR1-TS-TEST-01~02: 테스트만 revert 가능(제품 코드에 영향 없음).

---

## 4) 전체 예상 시간
- 총합: **약 4–6시간**
  - ESLint: 30–60분
  - Repo/Domain typing: 2–3시간
  - Module/Exports + UI props: 1–2시간
  - Tests typing(마지막): 30–60분

## OPEN QUESTION (CLOSED)
- “Task당 ≤10파일/≤50LOC” 제약을 만족하도록 TS 오류 파일(43개)을 기능 단위로 분해 완료.
