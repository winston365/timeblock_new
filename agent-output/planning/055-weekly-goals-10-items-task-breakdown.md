---
ID: 55
Origin: 55
UUID: 6c2a7f1b
Status: Active
---

# Weekly Goals 개선(10개 항목) — 구현 Task 분해 (UI-only)

## Plan Header
- Plan ID: 055-weekly-goals-10-items-task-breakdown
- Target Release: **1.0.179** (reference: 053 문서; package.json 1.0.178 기준 patch +1 제안)
- Scope Constraint: **프론트/UI-only** (백엔드/IPC/Supabase 구현 X)
- Dexie 스키마/Sync 전략 변경은 **“디자인 고려”**로 표기하고 별도 Task로 분리

## Value Statement and Business Objective
As a 주간 목표를 매일 확인하는 사용자, I want to 목표 진행·리셋·만회(catch-up)·히스토리를 덜 헷갈리고(인지부하↓) 작게 시작할 수 있게(마이크로스텝/노이즈 컷) 실패해도 다시 돌아올 수 있게(실패 내성) 만들고, so that 주간 목표를 꾸준히 달성하면서도 압박감과 혼란을 줄인다.

## 대상 범위
- Feature: F3, F5, F8, F9, F10
- UX: U1, U2, U3, U4, U5

---

## Phase 1: 기반/데이터
- T01: [공통] systemState 키 설계/네이밍 정리 - 필터/힌트/고급입력/주간배너 노출 등 새 영속 상태를 목록화하고 key prefix를 통일한다. | 파일: [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts) | 노력: S | 의존: -
- T02: [공통] SYSTEM_STATE_DEFAULTS 확장 - 신규 systemState 키 기본값을 defaults 중앙 상수에 추가한다. | 파일: [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts) | 노력: S | 의존: T01
- T03: [공통] systemState 로드/세이브 경로 표준화 - weekly goals 영역에서 systemState 접근을 repo wrapper 경유로 표준화할 수 있게 최소 헬퍼/유틸 경로를 정리한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts), [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts) | 노력: M | 의존: T01
- T04: [U2/F5] “이번 주” 계산 유틸/표현 확정 - YYYY-WW 라벨과 “이번 주 시작” 기준(타임존/주 시작 요일)을 확정하고 재사용 지점을 정한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) | 노력: S | 의존: -
- T05: [U3/F3] catch-up 배너 액션 인터페이스 정리 - 복귀/숨김/히스토리/권장페이스 전환 버튼의 액션 타입과 핸들러 인터페이스를 정리한다. | 파일: [src/features/goals/utils/catchUpUtils.ts](src/features/goals/utils/catchUpUtils.ts), [src/features/goals/hooks/useCatchUpAlertBanner.ts](src/features/goals/hooks/useCatchUpAlertBanner.ts) | 노력: S | 의존: -
- T06: [F9] 진행도 Guard/Undo 동작 정의 - 음수/과다 변경 방지 규칙, Undo 유효기간(5초), 직접입력 “고급” 정책을 문서/상수로 고정한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts), [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts) | 노력: S | 의존: -
- T07: [F10] WeeklyGoal 테마 필드 모델링(타입/검증) - theme(또는 projectTheme) 필드를 optional로 추가하고, UI가 읽고 쓸 수 있게 데이터 경로를 정리한다. | 파일: [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts), [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) | 노력: M | 의존: -
- T08: [F10][디자인 고려] Dexie/Sync 영향 분석 + 마이그레이션 분리 - theme 필드 영구 저장/동기화 필요 시 Dexie 스키마/Sync 전략 변경 범위를 별도 작업으로 스펙화한다. | 파일: [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts), [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts) | 노력: M | 의존: T07

### Phase 1 검증: 
- systemState 신규 키가 repo wrapper 경유로 읽기/쓰기 가능한 상태(직접 localStorage 사용 없음, 테마 키 예외 규칙 유지)
- 타입/스키마 변경(특히 F10)이 컴파일/린트 단계에서 깨지지 않음

## Phase 2: UI 뼈대
- T09: [U2] GoalsModal 헤더 주차 라벨 UI - “이번 주(YYYY-WW)” 라벨과 “이번 주 시작” 안내(상세는 툴팁) UI를 추가한다. | 파일: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) | 노력: S | 의존: T04
- T10: [F5] 주간 리셋 안내 카드 UI - 새 주 감지 시 노출될 상단 카드(지난주 1줄 요약 + 히스토리 보기)를 UI로 추가한다(로직은 Phase 3). | 파일: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) | 노력: S | 의존: T04
- T11: [F8] “오늘만 보기” 토글/칩 UI - WeeklyGoalPanel에 1탭 필터 토글을 추가하고 활성 상태를 칩/배지로 강하게 표시한다. | 파일: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) | 노력: S | 의존: T01,T02
- T12: [F8] 필터 활성 시 숨김 카운트 UI - 필터로 숨겨진 목표 수(N개)를 명시하는 배지를 추가한다(카운트 계산은 Phase 3). | 파일: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) | 노력: S | 의존: T11
- T13: [U3] catch-up 배너 레이아웃/문구(3버튼) - 압박 톤을 제거하고 “권장 페이스/숨김/히스토리” 3버튼 구조로 재배치한다. | 파일: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx), [src/features/goals/hooks/useCatchUpAlertBanner.ts](src/features/goals/hooks/useCatchUpAlertBanner.ts) | 노력: S | 의존: T05
- T14: [F3] “권장 페이스로 전환(0.5x)” 버튼 UI - catch-up 배너에 실패 내성 CTA 버튼을 추가한다(실제 계산 적용은 Phase 3). | 파일: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) | 노력: S | 의존: T13
- T15: [U1] 축소 모드 정보 최적화(레이아웃) - 축소 모드에 제목/주간 진행/오늘 할당/만회 상태만 남기고 액션은 확장/더보기로 이동한다. | 파일: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx), [src/features/goals/WeeklyProgressBar.tsx](src/features/goals/WeeklyProgressBar.tsx) | 노력: M | 의존: -
- T16: [U1] 첫 1회 더보기 힌트 UI - 축소 모드에서 “더보기 위치”를 1회만 안내하는 힌트(툴팁/배지)를 추가한다. | 파일: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) | 노력: S | 의존: T01,T02,T15
- T17: [F9] 직접 입력 UI를 “고급”으로 이동(스캐폴딩) - 진행도 직접 입력을 고급 섹션으로 숨기고 기본은 ± 중심 UI로 정리한다(동작 제약은 Phase 3). | 파일: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx), [src/features/goals/WeeklyProgressBar.tsx](src/features/goals/WeeklyProgressBar.tsx) | 노력: M | 의존: T06
- T18: [F10] 목표 카드 테마 라벨 표시 UI - WeeklyGoalCard에 theme 라벨을 칩 형태로 표시(없으면 미표시)한다. | 파일: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) | 노력: S | 의존: T07
- T19: [F10] 테마 입력 UI(프리셋+자유입력) - Add/Edit에서 테마를 선택 사항으로 입력할 수 있게 프리셋 3개 + 자유 입력 1칸 UI를 추가한다. | 파일: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx), [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) | 노력: M | 의존: T07
- T20: [U5] Add/Edit 모달 2단계 UI 골격 - Step 1(제목/주간 목표량)과 Step 2(선택: 단위/테마/기타)를 구분하는 레이아웃과 내비게이션(다음/나중에)을 만든다. | 파일: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) | 노력: M | 의존: T01,T02

### Phase 2 검증:
- GoalsModal/WeeklyGoalCard에서 새 UI 요소가 표시되며, ESC로 닫기/배경클릭 금지 패턴을 해치지 않음
- “오늘만 보기”/catch-up 배너/주차 라벨/2단계 모달이 동시에 존재해도 레이아웃이 깨지지 않음

## Phase 3: 기능 로직
- T21: [F8] 필터 로직 연결 + systemState 영속화 - “오늘 할당량>0” 기반 predicate와 숨김 N개 카운트를 연결하고 토글 상태를 systemState에 저장/복원한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts), [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) | 노력: M | 의존: T03,T11,T12
- T22: [F5] 주간 리셋 카드 주 1회 노출 로직 - 새 주 감지 시에만 배너가 1회 뜨도록 lastSeenWeekStart(systemState) 기반 가드를 추가한다. | 파일: [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts), [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) | 노력: M | 의존: T01,T02,T04,T10
- T23: [F5] 지난주 1줄 요약 계산 + 히스토리 링크 - 지난주 달성률(또는 완료/목표) 요약 문자열을 계산하고 “히스토리 보기” 액션으로 연결한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts), [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) | 노력: M | 의존: T22
- T24: [U3] catch-up 배너 숨김(snooze) 주 1회 재등장 - snooze/dismiss 상태를 systemState로 저장하고 주 1회만 자동 재등장하도록 가드를 추가한다. | 파일: [src/features/goals/hooks/useCatchUpAlertBanner.ts](src/features/goals/hooks/useCatchUpAlertBanner.ts), [src/features/goals/utils/catchUpUtils.ts](src/features/goals/utils/catchUpUtils.ts), [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts) | 노력: M | 의존: T01,T02,T05,T13
- T25: [F3] “0.5x 재시작” 권장 페이스 적용 - 버튼 클릭 시 권장 페이스로 전환되는 계산 규칙을 catch-up 계산에 연결한다(정의 불명확 시 최소 규칙으로 시작). | 파일: [src/features/goals/utils/catchUpUtils.ts](src/features/goals/utils/catchUpUtils.ts), [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) | 노력: M | 의존: T14,T24
- T26: [F9] 진행도 변경 Guard 적용 - 음수/과다 변경을 방지하고 사용자 피드백(문구/토스트)을 제공한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts), [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx), [src/features/goals/WeeklyProgressBar.tsx](src/features/goals/WeeklyProgressBar.tsx) | 노력: M | 의존: T06,T17
- T27: [F9] 5초 Undo 구현(트랜지언트) - 최근 변경을 5초 동안 되돌릴 수 있는 임시 상태(undo stack 1개)를 구현하고 UI에서 Undo를 노출한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts), [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) | 노력: M | 의존: T26
- T28: [F10] 테마 기반 그룹/필터 로직 연결 - 테마별 묶어보기/필터링을 선택 옵션으로 제공하고, UX를 “선택 사항”으로 유지한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts), [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx), [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) | 노력: M | 의존: T07,T18,T19
- T29: [U4] 히스토리 인사이트 계산(3줄) - 최고 달성 주/최근 평균/칭찬 기반 요약을 계산하고 빈 히스토리(historic empty) 가드를 추가한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) | 노력: M | 의존: -
- T30: [U4] 인사이트 UI 노출(히스토리 상단) - 히스토리 상단에 인사이트 3줄을 표시하고 비교/랭킹 톤을 피한다. | 파일: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) | 노력: S | 의존: T29
- T31: [U5] Step 1 저장→Step 2 선택 진입 플로우 완성 - Step 1 저장 직후 “추가로 다듬기”로 Step 2 진입을 제공하고, 편집 진입 시 Step 2로 바로 열기 옵션을 정리한다. | 파일: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx), [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) | 노력: M | 의존: T20,T19

### Phase 3 검증:
- “오늘만 보기” 토글이 새로 열어도 유지되며( systemState ), 숨김 카운트가 정확히 일치
- 진행도 변경이 Guard를 통과하지 못할 때 안전하게 차단되고, Undo가 5초 내 정상 동작
- 주간 리셋 카드/만회 배너(snooze)가 주 1회 규칙을 지킴

## Phase 4: 통합/정리
- T32: [공통] 모달/단축키/ESC 패턴 점검 - Goals 관련 모달에서 ESC 닫기, 배경클릭 금지, 포커스 복귀 흐름을 점검하고 불일치가 있으면 정리한다. | 파일: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) | 노력: M | 의존: T09,T20
- T33: [공통] eventBus/스토어 사이드이펙트 정합성 확인 - 진행도 변경/리셋/히스토리 접근 흐름에서 이벤트/부수효과가 중복/누락되지 않게 점검한다. | 파일: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) | 노력: S | 의존: T26,T27,T22
- T34: [문서] 계획/사용자 가이드 동기화 - Weekly Goals 개선 동작(필터, 리셋 배너, Undo, 테마)을 문서에 요약 반영한다. | 파일: [agent-output/planning/055-weekly-goals-10-items-task-breakdown.md](agent-output/planning/055-weekly-goals-10-items-task-breakdown.md), [agent-output/planning/053-weekly-goals-20-proposals-ui-only.md](agent-output/planning/053-weekly-goals-20-proposals-ui-only.md) | 노력: S | 의존: T21,T22,T27,T28,T30,T31
- T35: [릴리즈] 버전/릴리즈 아티팩트 정합(1.0.179) - 실제 PR 병합 단위에서 package.json 버전 및 CHANGELOG(존재 시)를 Target Release와 일치시킨다. | 파일: [package.json](package.json) | 노력: S | 의존: T34

### Phase 4 검증:
- GoalsModal 전반 UX가 일관되고(ESC/포커스), 신규 기능들이 서로 충돌하지 않음
- 릴리즈 아티팩트 버전이 Target Release(1.0.179)와 정합
