# Value Statement and Business Objective
장기목표(주간 목표) UX/데이터 흐름을 파악해 이후 개선(ADHD 친화, 선택 피로 감소, 모달 표준 준수)에 근거를 제공한다.

- **Status**: Planned
- **Changelog**: 2025-12-28 — 초기 리서치 작성.

추가 Changelog
- 2025-12-28: Plan drafted in agent-output/planning/048-goals-hotkeys-focus-preview-density-plan.md.

## Objective
- 장기목표/목적 관련 컴포넌트·스토어·데이터 레이어 위치를 정리한다.
- 사용자 플로우(생성/편집/조회/경고) 단계별 동작을 서술한다.
- 적용/제약 패턴(Zustand, Dexie, 모달 ESC 정책 등)이 기능에 미치는 영향도를 기록한다.
- 현재 UX pain point를 5~10개 도출해 개선 근거를 만든다.

## Context (where it lives)
- 진입: 상단 툴바 CTA에서 Goals 모달 열림 → [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx) → [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx)
- UI 계층: GoalsModal → WeeklyGoalPanel → WeeklyGoalCard + WeeklyGoalModal + WeeklyGoalHistoryModal (+ CatchUpAlertBanner/Modal)
- 상태/데이터: Zustand store [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) ↔ repository [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts) ↔ Dexie weeklyGoals table ([src/data/db/dexieClient.ts](src/data/db/dexieClient.ts)) with Firebase sync wrapper.
- 도메인 타입: WeeklyGoal/WeeklyGoalHistory [src/shared/types/domain.ts](src/shared/types/domain.ts).

## Methodology
- 코드 리드: GoalsModal, WeeklyGoalPanel, WeeklyGoalModal, WeeklyGoalHistoryModal, WeeklyGoalCard, weeklyGoalStore, weeklyGoalRepository, goalConstants, TopToolbar, Dexie schema, domain types.
- 참고: 기존 analysis docs는 참고만 하고, 현행 코드 기준으로 확인.

## Findings (facts unless 표시)
- **GoalsModal**: 단일 탭만 남아 장기목표 패널만 렌더링, ESC 핫키는 `useModalHotkeys`, 자식(WeeklyGoalModal) 열리면 부모 ESC 비활성. 배경 클릭 방지 오버레이 포함. [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx)
- **WeeklyGoalPanel**: 스토어에서 goals 로드, 추가/수정/삭제, 히스토리 열기, Catch-up 배너/모달 제어, 재오픈 버튼 제공. 삭제 시 `confirm`/`alert` 사용. [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx)
- **WeeklyGoalModal**: 목표 생성/수정 입력(제목/숫자/단위/아이콘/색상), 단위 프리셋, 월요일 자동 리셋 안내, ESC/Primary 핫키 `useModalHotkeys`. 입력 검증 실패 시 `alert`. [src/features/goals/WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx)
- **WeeklyGoalCard**: 진행도 표시/증감(+/- 버튼, 직접 입력, Quick Log popover), 오늘 할당량·만회 상태 툴팁, 히스토리 열기, 삭제/수정 액션, 애니메이션. 진행도 계산은 store 유틸 사용, catch-up 계산 util 의존. [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx)
- **WeeklyGoalHistoryModal**: 최근 주 기록 그래프/통계(평균, 최고 기록), 현재 주 진행도 원형 그래프, 5주 히스토리 유지. ESC/Primary `useModalHotkeys`. [src/features/goals/WeeklyGoalHistoryModal.tsx](src/features/goals/WeeklyGoalHistoryModal.tsx)
- **Store/Repository**: Zustand store 래핑으로 CRUD/진행도/정렬/유틸 제공. Repository는 Dexie weeklyGoals + Firebase sync, 주간 리셋 시 지난 주 기록을 history에 푸시(최대 5주), 주 시작 월요일로 정규화. [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts), [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts)
- **데이터 스키마**: Dexie v14에 `weeklyGoals` 테이블 추가, legacy `globalGoals` 테이블은 남아있으나 UI에서 숨김. [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts)
- **도메인 타입**: `WeeklyGoal`에 `currentProgress`, `weekStartDate`, `history: WeeklyGoalHistory[]` 등 포함, 주차 기록은 `dailyProgress` 배열 필드 포함. [src/shared/types/domain.ts](src/shared/types/domain.ts)

## Current Flow (user journey)
1) TopToolbar CTA `🎯 목표` 클릭 → GoalsModal 오픈 (오버레이). [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx)
2) GoalsModal 본문에서 WeeklyGoalPanel 렌더, 마운트 시 goals 로드. [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx)
3) Panel 헤더에서 “+ 추가” 또는 카드의 수정 버튼 → WeeklyGoalModal로 생성/수정 입력 후 저장.
4) 카드에서
   - 진행도 증감 버튼/직접입력/Quick Log 팝오버로 수치 업데이트 → store → Dexie/Firebase 동기화.
   - “오늘” 배지/만회 배지/Severity 툴팁으로 하루 할당량·부족량 확인.
   - 카드 클릭/Enter/Space로 히스토리 모달 열어 지난 주 성과 확인.
5) Catch-up 배너: 뒤처진 목표가 있을 때 Panel 상단에서 안내/스눅, 배너 재오픈 버튼 제공, CatchUpAlertModal로 상세 확인.
6) 주간 리셋: repository가 주 시작일 변화를 감지해 기존 주 기록을 history에 저장 후 진행도 0으로 초기화.

## Constraints / Guidelines Impact (observed)
- **Zustand + Dexie + Firebase**: 모든 CRUD가 store→repository→Dexie→Firebase 경로를 거침; 로컬 우선, 주간 리셋 포함. 로직 분리는 유지되나 Firebase guard 래퍼로 비동기 중첩 복잡도 존재.
- **Modal ESC 정책**: Hooks(`useModalHotkeys`)로 ESC 처리하지만 modal stack 전용 훅(`useModalEscapeClose`)은 미사용이라 중첩 모달 시 정책 일관성 리스크.
- **LocalStorage 금지**: 장기목표 상태는 Dexie persist만 사용(테마 제외). 스누즈/배너 상태 등도 store/hook 내부 관리로 일관성 유지.
- **Optional chaining 필요**: 도메인 타입 주석에 맞춰 방어 로직 필요; Panel/Card 일부에서 직접 접근(예: goal.history) 있으므로 입력 검증이 중요.
- **주간 자동 리셋**: Repository가 주간 기준을 강제(월요일 시작)하므로 UX에서 날짜/타임존 혼동 시 설명이 필요.

## Pain Points (with evidence)
1) **Confirm/alert 의존**: 삭제/검증 실패/저장 실패 등에서 브라우저 `confirm`/`alert` 사용 → 통일된 모달 UX/ESC 정책과 불일치, 접근성 낮음. Evidence: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) 삭제, [src/features/goals/WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx) 검증.
2) **Modal stack 일관성 미흡**: GoalsModal, WeeklyGoalHistoryModal, WeeklyGoalModal 모두 `useModalHotkeys`만 사용, 전역 스택 훅 미사용 → 중첩 시 ESC 우선순위 불명확. Evidence: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx), [src/features/goals/WeeklyGoalHistoryModal.tsx](src/features/goals/WeeklyGoalHistoryModal.tsx), [src/features/goals/WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx).
3) **Catch-up 배너/모달 중복 경로**: 배너, 재오픈 버튼, 모달 등 여러 진입점이 분산되어 포커스 이동/키보드 흐름이 불명확(ADHD 사용자에게 과부하). Evidence: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx).
4) **입력 검증 UX 단편적**: 제목/단위/숫자 검증이 alert로만 전달, 폼 수준 피드백/하이라이트 없음 → 오류 재진입 피로. Evidence: [src/features/goals/WeeklyGoalModal.tsx](src/features/goals/WeeklyGoalModal.tsx).
5) **Progress 조작 경로가 다층**: 카드에서 버튼, 직접 입력, Quick Log 팝오버가 동시 제공되어 초보 사용자는 어떤 방식을 써야 하는지 혼란 가능(특히 팝오버 ESC 처리 명시 없음). Evidence: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx).
6) **Weekly reset 가시성 부족**: 자동 리셋/히스토리 저장 로직은 repository에서 수행되지만 UI에서는 알림/토스트 없이 조용히 진행 → 주간 변경 시 진행도 0 초기화에 당황할 수 있음. Evidence: [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts).
7) **Legacy globalGoals 테이블 존치**: Dexie에 글로벌 목표 테이블이 남아있어 장기목표와 명칭 충돌 위험, 데이터 헷갈림 가능(비가시적 debt). Evidence: [src/data/db/dexieClient.ts](src/data/db/dexieClient.ts).
8) **History depth 제한 UI 노출 부족**: 히스토리 5주만 유지하지만 UI 설명이 부족해 오래된 기록 손실 시 사용자 놀람 가능. Evidence: [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts) (history slice -5), [src/features/goals/WeeklyGoalHistoryModal.tsx](src/features/goals/WeeklyGoalHistoryModal.tsx).

## Recommendations (non-binding, for planner)
- Modal stack 표준 훅 적용 및 confirm/alert 제거를 검토해 ESC/키보드 흐름을 단일화.
- 진행도 조작 UI를 우선 순위화(핵심 CTA 1~2개)하고 팝오버 ESC 동작을 명시.
- 주간 리셋/히스토리 보존 정책을 UI 메시지로 노출(첫 리셋 시 안내 토스트 등).
- Legacy `globalGoals` 제거 여부를 정리해 데이터/명칭 혼선을 해소.

## Open Questions
- 주간 리셋 시점(로컬 자정 기준)과 타임존 차이로 인한 오차가 보고된 적이 있는가?
- Catch-up 배너 스누즈 상태는 어디에 persist 되는가(앱 재시작 후 유지 필요 여부)?
- Quick Log 팝오버 ESC/포커스 순서가 다른 모달과 충돌하지 않는지 수동 테스트가 있는가?
- 장기목표/게임화(퀘스트, XP) 연동이 계획되어 있는가? 없다면 카드 내 보상 피드백을 단순화할 필요가 있는가?
