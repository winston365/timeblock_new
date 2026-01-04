# Value Statement and Business Objective
프런트/UI 중심(TimeBlock Planner) 품질·UX·성능·데이터 무결성 개선을 위해 문제 분류→가설→관측 포인트를 구조화하여, 1) 단기간 측정 우선 순위를 제시하고 2) Planner/Implementer가 위험도를 빠르게 판단할 수 있게 돕는다.

Status: Planned

## Changelog
- 2025-12-28: 최초 작성(프런트/UI 개선용 문제 분류·가설·측정 포인트·즉시 측정 체크리스트 작성).
- 2025-12-28: PR 분해 계획 수립에 반영됨(agent-output/planning/046-overall-front-ui-improvements-pr-breakdown.md).

## Objective
- 문제 분류 체계 제시(안정성/성능/UX/데이터 무결성/테스트/빌드·배포/보안/코드구조/관측성).
- 각 분류별 대표 가설 2~4개(증상→가능 원인)와 검증 지점 정의.
- 로그·메트릭·프로파일·커버리지·번들 분석 등 수집 방법을 구체화.
- 1~2시간 내 실행 가능한 "측정 먼저" 체크리스트 제공.

## Scope & Constraints (프런트/UI 중심)
- 로컬 우선 Electron + React + TS, TanStack Query 예정, Zustand + Dexie Repository 패턴. localStorage 금지(theme만 예외). optional chaining 권장.
- 모달: 배경 클릭 닫힘 금지, ESC 필수(useModalEscapeClose), 중첩 시 top만 닫기.
- 백엔드/Supabase/IPC 구현 금지(디자인 고려만). 테스트는 Vitest 기반, 이미 tests/ 존재.
- 레포 핵심 축: 이벤트 버스, 동기화(Firebase/Dexie), 스케줄/타임블록, 핫키/모달 UX, 템플릿/인박스/퀘스트.

## Quick Scan Signals (사실 기반)
- 이벤트 흐름: [src/shared/lib/eventBus](src/shared/lib/eventBus/README.md) 타입 안전 버스 + logger/performance 미들웨어, emit은 스토어, 구독은 subscribers 폴더.
- 데이터 계층: Dexie 스키마([src/data/db/dexieClient.ts](src/data/db/dexieClient.ts)) + Repository 패턴([src/data/repositories](src/data/repositories))로 dailyData/gameState/settings 등 관리.
- 동기화: Firebase 모듈 분리([src/shared/services/sync/firebase](src/shared/services/sync/firebase/README.md)) + syncLogger/syncCore + retry queue.
- UI/기능 범위: schedule/focus/tasks/template/inbox/hotkeys/modal tests 존재. 모달 정책 위반 사례와 bucket 경계 불일치가 이전 분석에 기록([agent-output/analysis/032-repo-problem-taxonomy-analysis.md](agent-output/analysis/032-repo-problem-taxonomy-analysis.md), [agent-output/analysis/010-overall-front-ui-current-state-analysis.md](agent-output/analysis/010-overall-front-ui-current-state-analysis.md)).
- 품질 게이트: lint max-warnings=0, 커버리지는 서비스 중심(tsx 대부분 제외), Vitest 로그 노이즈 가능. unifiedTaskService 커버리지 낮음(coverage-summary.json 기준).

## 분류별 가설과 관측 포인트

### 1) 안정성/런타임
- 가설A1: 중복 import·hook deps 경고가 dev 빌드 파싱 실패나 CI lint 실패로 이어진다. 
  - 관측: `npm run lint -- --max-warnings=0` 결과를 저장, no-duplicate-imports hit 목록 산출. 관련 파일: [agent-output/analysis/009-vite-babel-duplicate-import-analysis.md](agent-output/analysis/009-vite-babel-duplicate-import-analysis.md), [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx).
- 가설A2: ESC/keydown 리스너가 중복 등록되어 중첩 모달에서 두 번 닫힘/포커스 손실이 발생한다.
  - 관측: 모달 열기/닫기 10회 후 keydown 리스너 수를 Chrome Performance 프로파일에서 확인, [tests/modal-hotkeys.test.ts](tests/modal-hotkeys.test.ts) 확장.
- 가설A3: Dexie 초기화/권한 에러가 console에만 남고 UI 피드백 없이 실패한다.
  - 관측: [src/shared/lib/errorHandler.ts](src/shared/lib/errorHandler.ts)와 [src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts) 에러 경로에서 사용자 노출 여부 점검, vitest에 Dexie 권한 실패 모의 테스트 추가.

### 2) 성능/반응성
- 가설P1: schedule/focus 화면의 setInterval·setTimeout 다중 사용으로 CPU 스파이크와 리렌더 폭주가 발생한다.
  - 관측: Performance 프로파일(60초)에서 타이머 호출 스택 확인, [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx), [src/features/schedule/TimelineView/useTimelineData.ts](src/features/schedule/TimelineView/useTimelineData.ts), [src/features/focus](src/features/focus) 타이머 개수 계측.
- 가설P2: 렌더 경로에서 Dexie systemState 접근이 잦아 프레임 드랍을 유발한다.
  - 관측: db.systemState get/put 호출을 monkey patch해 key별 호출 수·경로 로그, [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts) 경유율 측정.
- 가설P3: 이벤트 버스 핸들러에서 비동기 연산이 길어 paint를 막는다.
  - 관측: eventBus performance middleware(report), 느린 이벤트 목록 확인([src/shared/lib/eventBus/EventBus.ts](src/shared/lib/eventBus/EventBus.ts)).

### 3) 데이터 무결성/동기화
- 가설D1: systemState direct 접근과 repository 접근 혼재로 키/기본값 불일치가 발생한다.
  - 관측: 코드 grep으로 systemState 문자열 목록 수집→systemRepository 매핑과 diff, [src/features/schedule/TimelineView/useTimelineData.ts](src/features/schedule/TimelineView/useTimelineData.ts) 등 점검.
- 가설D2: settings 기본값이 defaults.ts vs repository sanitize/createInitial에 분산되어 신규 설치/마이그레이션 시 다른 값이 저장된다.
  - 관측: [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts)와 [src/data/repositories/settingsRepository.ts](src/data/repositories/settingsRepository.ts) 값을 테이블화, vitest snapshot 비교.
- 가설D3: Firebase sync conflict resolver가 필드 추가 시 누락/덮어쓰기 위험을 만든다.
  - 관측: [src/shared/services/sync/firebase/conflictResolver.ts](src/shared/services/sync/firebase/conflictResolver.ts) LWW/merge 케이스에 필드 추가 테스트, syncLogger에서 updatedAt/field count 추적.
- 가설D4: retry queue/leader lock 미동작 시 동시 sync로 데이터 중복/충돌이 발생한다.
  - 관측: [src/shared/services/sync/firebase/syncRetryQueue.ts](src/shared/services/sync/firebase/syncRetryQueue.ts) enqueue/dequeue 로그, lock 획득 시각/owner 기록.

### 4) UX/접근성 (ADHD 친화)
- 가설U1: 배경 클릭 닫힘 금지 규칙을 위반하는 모달이 있어 입력 손실을 만든다.
  - 관측: RTL로 overlay click 시 닫힘 여부 테스트, 후보: [src/features/settings/components/tabs/battle/BattleMissionsSection.tsx](src/features/settings/components/tabs/battle/BattleMissionsSection.tsx), [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx).
- 가설U2: ESC/Ctrl+Enter 단축키 일관성이 없어 입력 흐름이 끊긴다.
  - 관측: [tests/modal-hotkeys.test.ts](tests/modal-hotkeys.test.ts) 확장, [tests/inbox-hotkeys.test.ts](tests/inbox-hotkeys.test.ts) 기준으로 모달별 핫키 매트릭스 작성.
- 가설U3: 시간 블록 경계(threeHourBucket vs TIME_BLOCKS)가 화면별로 달라 일정 인지가 혼란스러워진다.
  - 관측: [src/features/schedule/utils/threeHourBucket.ts](src/features/schedule/utils/threeHourBucket.ts) vs TIME_BLOCKS 스냅샷 비교, UI 스냅샷 테스트 추가.
- 가설U4: 포커스/알림 소리·토스트가 과도해 집중을 방해한다.
  - 관측: [src/shared/lib/notify.ts](src/shared/lib/notify.ts) 호출 빈도 로그, 토스트 스토어 상태 변화 카운트([src/shared/stores/toastStore.ts](src/shared/stores/toastStore.ts)).

### 5) 테스트/커버리지
- 가설T1: UI/모달 회귀를 Vitest가 커버하지 않아 정책 위반을 놓친다.
  - 관측: coverage --collectCoverageFrom "src/**/*.tsx" 샘플 실행, RTL smoke 추가 후 diff 확인.
- 가설T2: 서비스 로직 커버리지(특히 unifiedTaskService)가 낮아 리팩토링 회귀 위험이 높다.
  - 관측: [src/shared/services/task/unifiedTaskService.ts](src/shared/services/task/unifiedTaskService.ts) targeted tests 작성, branch coverage 85% 목표 측정.
- 가설T3: 테스트 로그 노이즈가 실패 신호를 묻는다.
  - 관측: vitest --reporter verbose --no-color 캡처([tasks/capture full vitest log](agent-output/analysis/032-repo-problem-taxonomy-analysis.md)) 후 stderr 필터링 규칙 정의.

### 6) 빌드·배포
- 가설B1: lint 경고 1개만 있어도 CI 실패(max-warnings=0)로 개발 피로가 높다.
  - 관측: lint 결과에서 warn 수를 따로 집계, quick-fix cadence 정리.
- 가설B2: electron 빌드/업데이트 체인 오류가 UI만으로 드러나 회귀 감지가 늦다.
  - 관측: dist-electron 로그 캡처, 업데이트 확인 플로우에서 오류 메시지/네트워크 실패를 toast/로그로 표면화 여부 확인.
- 가설B3: 번들 크기 증가로 초기 로드가 느려질 수 있다.
  - 관측: `vite build --analyze`로 renderer 번들 사이즈 측정, hot path(React Query 도입 시) 대비 예산 설정.

### 7) 보안/민감정보
- 가설S1: settings secret 필드가 로컬 저장(updateLocalSettings)과 sync(updateSettings) 경로에서 혼재되어 원치 않는 동기화가 발생할 수 있다.
  - 관측: [src/shared/types/domain.ts](src/shared/types/domain.ts) settings 타입 secretKeys 리스트 vs [src/features/settings/SettingsModal.tsx](src/features/settings/SettingsModal.tsx) 처리 비교, sync payload 로깅에서 민감 필드 존재 여부 확인.
- 가설S2: 로그/syncLogger에 민감 정보가 포함될 위험이 있다.
  - 관측: syncLogger payload 샘플 점검([src/shared/services/sync/syncLogger.ts](src/shared/services/sync/syncLogger.ts)), 에러 객체 stringify 시 필터 여부 확인.

### 8) 코드구조/아키텍처
- 가설C1: defaults.ts와 repository createInitial/sanitize 불일치로 신규 필드 추가 시 분산 수정이 필요해 부채가 증가한다.
  - 관측: diff 테이블 작성(defaults vs repos), 신규 필드 추가 절차 정의.
- 가설C2: 이벤트 버스가 UI 렌더 트리거 용도로 오용되면 데이터 흐름 추적이 어려워진다.
  - 관측: eventBus logger middleware에서 렌더 관련 이벤트(filter) 카운트, 구독 위치가 subscribers 폴더 밖에 있는지 스캔.
- 가설C3: 중복된 시간/블록 계산 유틸이 여러 곳에 존재한다.
  - 관측: getCurrentBlock/threeHourBucket/TIME_BLOCKS 호출 위치 매핑, 하나의 helper로 수렴 여부 평가.

### 9) 운영 관측성
- 가설O1: syncLogger와 console 로그가 분산되어 재현 시 단서가 부족하다.
  - 관측: syncLogger 필드(키/액션/에러/updatedAt) 표준화 여부 점검, 로그 샘플을 vitest fixture로 캡처([tests/sync-logger.test.ts](tests/sync-logger.test.ts)).
- 가설O2: 성능 측정(프론트) 채널이 일관되지 않아 병목 확인이 어렵다.
  - 관측: eventBus performance monitor + React Profiler 결과를 issue와 연결하는 템플릿 마련.
- 가설O3: 핫키 실패/중복 발생 시 추적용 로그가 부족하다.
  - 관측: [src/shared/hooks](src/shared/hooks) hotkey 등록 래퍼에 debug flag를 두어 등록/해제 이벤트 로그 수집.

## 1~2시간 내 "측정 먼저" 체크리스트
1) `npx vitest run --reporter verbose --no-color` 로그 캡처 후 stderr 노이즈 목록화(로그 필터 대상 식별).
2) grep으로 `db.systemState` 직접 접근 위치 수집 → systemRepository 경유율 표 작성(키/모듈별).
3) Schedule/Timeline 화면 Performance 프로파일 60초 녹화 → setInterval 호출 스택과 scripting time 비중 기록.
4) 모달 3종(GoalsModal, BossAlbumModal, BattleMissionsSection) RTL 시나리오: overlay click/ESC/Ctrl+Enter 동작 캡처.
5) eventBus performance monitor 활성화 후 task:completed·schedule 관련 이벤트 20회 실행 → 평균/최대 처리 시간 리포트 스냅샷 저장.

## Open Questions
- systemState direct access를 어디까지 허용할지(성능 예외 vs 전면 금지) 정책이 필요한가?
- Ctrl+Enter/ESC 적용 범위를 모든 입력형 모달로 강제할지, 특정 모달만 적용할지 UX 정책이 필요한가?
- 성능 예산(첫 화면 렌더/상호작용, 번들 크기) 기준을 어디에 둘지? React Query 도입 시 예산 재설정 필요.
