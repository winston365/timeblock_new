# Status: Implemented

## Changelog
- 2025-12-23: 초기 주간/장기목표(Weekly Goals) 구조 파악 및 UX/데이터 흐름 정리

## Value Statement and Business Objective
주간/장기목표 기능의 아키텍처와 UX 흐름을 빠르게 파악해, 향후 UX 개선과 동기화/데이터 정합성 점검을 효율적으로 진행할 수 있는 기반 자료를 마련한다.

## Objective
- 주간/장기목표 관련 코드/스토어/리포지토리/컴포넌트/테스트 위치를 식별하고 간결히 정리한다.
- 상태 관리(Zustand)와 Dexie systemState 사용 여부, Firebase 싱크 전략을 확인한다.
- 생성/수정/진행도 업데이트/삭제 흐름을 파악해 UX 영향 지점을 명확히 한다.

## Context
- 로컬 퍼스트(Electron+React) 구조에서 주간 목표가 Dexie 테이블(`weeklyGoals`)과 systemState로 관리됨.
- Firebase는 `weeklyGoalStrategy`(Last-Write-Wins)로 동기화.
- 모달 UX: `GoalsModal`이 주간 목표만 다루며 ESC 닫기 훅 적용.

## Methodology
- 코드 리딩: domain 타입, Zustand 스토어, 리포지토리, 패널/모달/카드 UI, 알림 훅, Firebase 전략, systemState 리포지토리, 관련 테스트를 확인.
- 테스트 스캔: weekly goals와 연계된 systemState 단위 테스트 검토.

## Findings
- Fact: 도메인 모델 `WeeklyGoal`/`WeeklyGoalHistory`가 주간 초기화, 히스토리, 진행도, 정렬 순서를 포함. (src/shared/types/domain.ts)
- Fact: Zustand `useWeeklyGoalStore`가 CRUD/진행도/정렬 및 오늘 목표 계산 유틸을 래핑해 리포지토리 호출. (src/shared/stores/weeklyGoalStore.ts)
- Fact: 리포지토리 `weeklyGoalRepository`가 Dexie `weeklyGoals` 테이블과 Firebase 싱크를 관리하며 새 주 감지 시 `resetWeeklyGoals`로 진행도 0 리셋+히스토리 적재. (src/data/repositories/weeklyGoalRepository.ts)
- Fact: UI 흐름은 `GoalsModal` → `WeeklyGoalPanel` → `WeeklyGoalCard`/`WeeklyGoalModal`/`WeeklyGoalHistoryModal`로 구성되며, 카드에서 진행도 증가/설정, 히스토리 보기, 삭제, 오늘 목표량/만회 상태 표시를 제공. (src/features/goals/*)
- Fact: 만회 배너 `useCatchUpAlertBanner`와 오늘 할당량 축하 `useQuotaAchievement`가 systemState(`CATCH_UP_SNOOZE_STATE`, `QUOTA_ACHIEVED_GOALS`)에 Dexie로 기록. (src/features/goals/hooks/*, src/data/repositories/systemRepository.ts)
- Fact: Firebase 동기화는 `weeklyGoalStrategy`로 Last-Write-Wins 메시지 포함. (src/shared/services/sync/firebase/strategies.ts)
- Fact: systemState 저장/삭제 동작은 단위 테스트 `weekly-goals-system-state.test.ts`로 검증. (tests/weekly-goals-system-state.test.ts)

## Recommendations
- UX 검토 시 만회 배너/토스트와 카드 애니메이션이 ADHD 사용자에게 과자극이 되는지 평가하고, 설정 토글 노출 여부 고려.
- 주간 초기화(`resetWeeklyGoals`)가 주간 변경 시점에만 실행되므로, 앱 장기 미사용 후 복귀 시 사용자 피드백(배너/토스트) 필요 여부를 확인.
- 진행도 직접 입력(설정 vs 증감) 규칙을 UI 텍스트로 더 명확히 안내할 여지 확인.

## Open Questions
- 주간 초기화 타이밍(현지 시간 기준 월요일 00:00)과 멀티타임존 사용 시 요구사항이 있는지?
- Firebase 동기화 충돌 시 Last-Write-Wins 외에 머지 규칙 필요 여부?
- 히스토리 저장 용량/보존 정책(현재 최근 5주 유지) 확장 필요 여부?
