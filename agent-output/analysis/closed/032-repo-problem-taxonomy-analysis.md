# Value Statement and Business Objective
Electron+React 로컬우선(TimeBlock Planner) 프런트엔드의 문제/기회 지형을 압축 분류하고, 각 가설별 검증 포인트(로그·측정·재현 경로)를 제시해 Planner/Implementer가 위험도를 빠르게 파악하고 우선순위를 정하도록 돕는다.

Status: Active

## Changelog
- 2025-12-23: 최초 작성(문제 분류·가설·검증 포인트 정리, 신호 8개 추출).

## Objective
- 품질/성능/동기화/UX/테스트/아키텍처 관점의 문제 분류.
- 카테고리별 가설(2~5개)와 확인 방법(로그·메트릭·테스트·재현 경로) 제안.
- 기존 산출물과 커버리지·lint·테스트 자산에서 현재 신호 5~10개 수집.

## Context (제약·정책)
- localStorage 금지(theme만 예외), 상태는 Dexie systemState 사용.
- Repository 패턴 필수(Dexie/Firebase 직접 호출 금지).
- 모달: 배경 클릭 닫힘 금지, ESC 필수, useModalEscapeClose 권장.
- optional chaining 의무.
- 현 단계: 프런트/UI 한정, 백엔드·Supabase·Electron IPC 구현 금지.

## Signals (현재 관측된 증거)
- Lint: no-duplicate-imports 32건 + hook deps 경고 [lint-errors.txt](lint-errors.txt#L4-L41) — CI 차단 잠재.
- 커버리지: 전체 lines 88.32%, branches 79.44%; `shared/services/task/unifiedTaskService.ts` lines 58.91% [coverage/coverage-summary.json](coverage/coverage-summary.json#L1-L20) — 업무로직 테스트 갭.
- Modal ESC/주요 단축키 불일치 사례 인벤토리 [agent-output/analysis/012-modal-ux-escape-ctrlenter-analysis.md](agent-output/analysis/012-modal-ux-escape-ctrlenter-analysis.md) — 스택 무시 ESC 핸들러 2건(GoalsModal, BossAlbumModal).
- TIME_BLOCKS vs 3시간 버킷 불일치 분석 [agent-output/analysis/015-time-block-bucket-realignment-analysis.md](agent-output/analysis/015-time-block-bucket-realignment-analysis.md) — 캘린더/포커스/미션에서 시간 경계 상이.
- 프런트 전반 문제 스캔(성능 타이머, systemState 직접 접근 등) [agent-output/analysis/010-overall-front-ui-current-state-analysis.md](agent-output/analysis/010-overall-front-ui-current-state-analysis.md) — 정책 위반 위험 지적.
- README 기능·아키텍처 선언(Repository, Dexie/Firebase, 모달 정책) [README.md](README.md#L1-L247) — 기대 행동 기준점.
- 테스트 스위트 vitest 기반, UI 제외(jsdom 미사용) [tests/](tests/) — 렌더링 회귀 커버 부족.
- Dexie 접근 규칙 위반 스캔 결과 기록(dexie-violations-scan) [agent-output/analysis/dexie-violations-scan.txt](agent-output/analysis/dexie-violations-scan.txt) — direct db 접근 사례 존재.

## Problem Taxonomy (가설·검증 포인트·코드 영역)
Category | Hypotheses | Confirm (logs/metrics/tests) | Likely code areas
---|---|---|---
품질/빌드 게이트 | (1) 중복 import 누락 정리로 lint가 상시 fail. (2) hook deps 경고 방치로 릴리즈 차단. | npm run lint 재현; eslint no-duplicate-imports hit count; fix-rate 추적. | [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx), [src/data/repositories/dailyData/coreOperations.ts](src/data/repositories/dailyData/coreOperations.ts), [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx#L20-L40) 등 lint 보고서 경로.
성능/반응성 | (1) schedule/focus에 다중 setInterval·Dexie 접근이 리렌더를 가중. (2) systemState IO를 렌더 경로에서 호출해 잔뜩 읽기/쓰기. | DevTools Performance 60초 캡처; 타이머 수/cleanup 로그 삽입; Dexie call count 로깅. | [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx), [src/features/schedule/TimelineView/useTimelineData.ts](src/features/schedule/TimelineView/useTimelineData.ts), [src/features/schedule/components/FocusView.tsx](src/features/schedule/components/FocusView.tsx).
신뢰성/동기화 | (1) systemState direct access와 repository 병용으로 키/기본값 불일치 위험. (2) Firebase 병합 로직이 스키마 변화 시 필드 누락 가능. | systemState.get/put 문자열 리스트업 → systemRepository 키와 diff; 오프라인→온라인 설정 병합 시 SyncLog 확인; vitest sync-logger.test 확장. | [src/shared/services/sync/firebase/syncCore.ts](src/shared/services/sync/firebase/syncCore.ts), [src/data/repositories/settingsRepository.ts](src/data/repositories/settingsRepository.ts), [src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts).
UI/UX (ADHD 친화) | (1) 모달 ESC/배경 정책 미준수(GoalsModal, BossAlbumModal 등). (2) Ctrl+Enter 일관성 부재로 입력 흐름 끊김. (3) TIME_BLOCKS vs 3h bucket 불일치로 시간 인지 혼란. | jsdom RTL: ESC/배경 클릭/ctrl+enter 시나리오; 실제 앱 electron:dev 수동 재현. 시간 블록 라벨/색상 일치 여부 스냅샷. | [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx), [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx), [src/features/schedule/utils/threeHourBucket.ts](src/features/schedule/utils/threeHourBucket.ts), [src/shared/types/domain.ts](src/shared/types/domain.ts#L856-L863).
테스트/커버리지 | (1) UI/모달 회귀를 vitest가 커버하지 않아 정책 위반을 놓침. (2) 업무 로직(unifiedTaskService) 커버리지 59%대로 회귀 위험. | 새 RTL tests for ESC/배경/ctrl+enter; coverage --collectCoverageFrom *.tsx 샘플; branch coverage 목표 85%+ for unifiedTaskService. | [tests/modal-hotkeys.test.ts](tests/modal-hotkeys.test.ts), [src/shared/services/task/unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts).
아키텍처 드리프트 | (1) Repository 패턴 우회(Dexie direct)와 defaults 분산으로 정책 괴리. (2) threeHourBucket 유틸이 TIME_BLOCKS 정책과 충돌. | 코드베이스 grep: db.systemState, new Dexie() 호출; defaults.ts vs repository createInitial 비교표; 세션당 direct call 수 로그. | [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts), [src/shared/utils/timeBlockUtils.ts](src/shared/utils/timeBlockUtils.ts), [src/features/schedule/utils/threeHourBucket.ts](src/features/schedule/utils/threeHourBucket.ts).
관측성 | (1) 콘솔/SyncLog 분산으로 재현시 단서 부족. (2) vitest 로그 노이즈가 실패 신호를 희석. | syncLogger payload 필드 목록화; vitest --reporter verbose 로그 패턴 점검; log redaction 정책 검토. | [src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts), [tests/sync-logger.test.ts](tests/sync-logger.test.ts).

## Verification Routes (재현/측정)
- npm test (기존): 서비스/유틸 회귀 확인, 로그 노이즈 파악.
- npm run electron:dev: 모달 ESC/배경 클릭/ctrl+enter, 시간 블록 라벨 확인.
- Vitest RTL 추가 후: ESC 스택, Ctrl+Enter primary action, backdrop click no-close.
- Performance 프로파일: Schedule/Focus 화면 60초 기록 후 scripting time 및 interval 누수 검사.
- systemState 키 인벤토리: 코드 grep 결과 vs systemRepository 매핑 테이블 작성.

## Top 5 Immediate Measurement Additions
1) Dexie systemState wrapper에 debug hook(일시적)으로 get/put 호출 카운트+키 로그 → 렌더 경로 IO 확인.
2) Schedule/Timeline 진입 시 활성 setInterval 수 측정 및 cleanup 검증 로그.
3) Modal ESC 스택 단위 RTL 테스트 추가(두 모달 동시 열기 후 Escape → top만 닫힘).
4) Ctrl+Enter primary action RTL 테스트(예: SettingsModal, TemplatesModal)로 정책 준수 여부 가시화.
5) TIME_BLOCKS 기반 라벨/경계 스냅샷 테스트(threeHourBucket 대조)로 시각적 일관성 회귀 감시.

## Open Questions
- systemState direct access를 전면 금지(Repository 강제)할지, 성능 이유로 예외 리스트를 둘지 결정 필요.
- TIME_BLOCKS에 wrap 블록(23-05) 추가 여부와 용량 규칙(시간대 길이별 가중) 정책 확정 필요.
- Ctrl+Enter 적용 범위: 정보성 모달까지 강제할지, 입력형 모달에 한정할지 UX 정책 결정 필요.
