# Value Statement and Business Objective
이 문서는 TimeBlock Planner(프론트/UI 중심)의 “전반적인 개선점”을 **카테고리별 문제→가설→검증 포인트(로그/측정/재현)**로 구조화해, 다음 단계(Planner/Implementer)가 우선순위를 빠르게 정하고 안전하게 개선을 진행할 수 있게 한다.

# Objective
- (1) 현재 문제를 카테고리로 분류
- (2) 카테고리별 핵심 가설 2~5개 제시(왜 문제가 생길지)
- (3) 가설 확인을 위한 확인 포인트 + 측정/로그 수집 방법 제시
- (4) 즉시 얻을 수 있는 Quick wins 3개 제안

# Context
- Scope: renderer(React) 중심. backend/Supabase 없음. Electron IPC는 설계 고려만.
- Repo 규칙(요약): localStorage 금지(예외 theme), defaults.ts 중앙관리, optional chaining 권장, 모달은 배경 클릭으로 닫지 않기 + ESC로 닫기.
- No-Memory Mode: Flowbaby memory 도구 미사용(기술적으로 unavailable) → 레포 파일/기존 agent-output 문서 기반.

# Methodology (Read-only)
- 핵심 엔트리/설정/테스트/커버리지/기존 분석 문서 스캔
  - src/main.tsx, src/App.tsx, src/app/AppShell.tsx
  - vite/vitest/eslint/tsconfig
  - agent-output/analysis/*, agent-output/architecture/*, agent-output/critiques/*
- 정적 검색
  - localStorage 사용처, db.systemState 직접 접근, setInterval/timeout 밀집, 모달 overlay onClick 닫기 패턴
- 명령 실행(읽기 전용)
  - npm run lint, npm test

# Findings (Facts)
- localStorage 직접 사용은 theme 관련 3곳으로 제한됨(엔트리 + 설정 테마 탭 + SettingsModal 초기 로드). ESLint도 theme 예외만 허용하도록 override 구성됨.
  - src/main.tsx / src/features/settings/SettingsModal.tsx / src/features/settings/components/tabs/AppearanceTab.tsx
- db.systemState 직접 접근이 UI/서비스에 다수 존재(Repository wrapper가 있음에도 bypass).
  - 예: src/features/schedule/TimelineView/useTimelineData.ts, src/features/schedule/HourBar.tsx, src/shared/services/sync/syncLogger.ts 등
- 모달 UX 규칙(배경 클릭 닫기 금지)과 충돌 가능한 구현이 확인됨.
  - 예: src/features/settings/components/tabs/battle/BattleMissionsSection.tsx에서 overlay div가 onClick={onClose}
- 빌드/개발 안정성 이슈(기존 분석 문서): 중복 import로 Vite React(Babel) 파싱 에러 발생 사례가 문서화됨.
  - agent-output/analysis/009-vite-babel-duplicate-import-analysis.md
- Lint는 현재 “warning 0개” 정책(max-warnings=0)으로 인해 **경고만 있어도 실패**.
  - npm run lint 결과: unused import 2건(warn)으로 exit 1
- 테스트는 vitest(node environment) 기반으로 서비스/유틸 중심.
  - npm test: 13 files, 94 tests 통과. 다만 의도된 stderr 로그가 다수 발생(노이즈 가능).
- 커버리지는 서비스 일부만 include. UI(.tsx)는 exclude.
  - unifiedTaskService는 커버리지가 상대적으로 낮음(coverage-summary.json 기준 lines ~59%).

---

# 문제분류 (Categories)
1) 성능/반응성
2) 안정성(런타임/에러 핸들링)
3) 데이터 무결성/동기화(로컬 Dexie + Firebase)
4) UX/접근성(모달/키보드/일관성)
5) 테스트/품질 게이트(커버리지/노이즈)
6) 빌드-릴리즈(개발 서버/CI-like 게이트)
7) 관측성/디버깅(로그, 성능 모니터링)
8) 보안/비밀정보(키 관리, 로그/동기화 경로)
9) 코드품질/아키텍처 부채(중복, 규칙 위반 위험)

---

# 가설 목록 (카테고리별 2~5개)

## 1) 성능/반응성
H1. UI 컴포넌트/스토어에 setInterval/setTimeout가 광범위하게 존재해(초당/분당 업데이트) 불필요한 리렌더/CPU 사용을 유발할 수 있다.
- 근거: src/features/schedule/ScheduleView.tsx, HourBar.tsx, TaskCard.tsx, TimelineView.tsx, FocusView.tsx 등 다수.

H2. Dexie 조회/put이 렌더링 경로 또는 잦은 상태 변화와 결합되면(예: systemState UI 토글, 패널 레이아웃) IO가 빈번해져 “미세한 끊김”이 발생할 수 있다.
- 근거: db.systemState direct access가 UI/hooks에서 직접 호출됨.

H3. AI/RAG(embedding flush, vector store)와 UI 동작이 같은 스레드에서 돌면서 대화/작업 세분화 같은 화면에서 프레임 드랍을 유발할 수 있다.
- 근거: src/shared/services/rag/*에 debounce/flush 타이머 존재.


## 2) 안정성(런타임/에러 핸들링)
H1. 개발 서버 단계에서 사소한 코드 실수(중복 import 등)가 Babel 파싱 에러로 UI 전체가 뜨지 않는 “하드 실패”로 이어질 수 있다.
- 근거: agent-output/analysis/009-... 문서.

H2. 모달/키보드 이벤트 리스너가 여러 방식(useModalEscapeClose + 개별 addEventListener)으로 중복 구현되어, 특정 화면에서 리스너 누수 또는 예상치 못한 전파 차단이 발생할 수 있다.
- 근거: useModalEscapeClose 존재 + TempScheduleModal 자체 keydown 핸들러.

H3. 테스트는 통과하지만 런타임에서만 터지는 상태(IndexedDB 권한/초기화 타이밍, Firebase init 실패)에서 예외가 console에만 남고 UX로 표면화되지 않을 수 있다.
- 근거: AppShell/useAppInitialization에서 try/catch + console.warn/console.error 패턴.


## 3) 데이터 무결성/동기화
H1. systemState 접근이 repository(systemRepository)와 direct db 접근으로 혼재되어, 키 네이밍/폴백/마이그레이션이 분산되고 데이터 일관성이 깨질 수 있다.
- 근거: systemRepository 존재 + 다수 direct access.

H2. Settings 기본값이 defaults.ts와 repository sanitize/createInitial에 분산되어(일부 하드코딩, 일부 SETTING_DEFAULTS) “새 설치 vs 기존 사용자 마이그레이션”에서 값이 달라질 수 있다.
- 근거: src/shared/constants/defaults.ts vs src/data/repositories/settingsRepository.ts의 혼합.

H3. Firebase 병합 로직(업데이트 타임스탬프 비교, 필드 일부 예외 처리)이 누락된 필드/스키마 변화 시 데이터 손실 또는 덮어쓰기 위험을 만든다.
- 근거: src/app/hooks/useAppInitialization.ts에서 settings 병합.


## 4) UX/접근성
H1. “배경 클릭으로 모달 닫기 금지” 규칙이 일부 모달에서 위반되어, 사용자가 실수로 입력을 잃는 UX 문제가 발생할 수 있다.
- 근거: BattleMissionsSection TimeSlotEditor overlay onClick={onClose}.

H2. 모달별로 overlay z-index/클래스/키보드 처리 방식이 다르면(일부는 modal-overlay CSS, 일부는 직접 클래스) ESC 닫기/포커스/스크린리더 경험이 일관되지 않을 수 있다.

H3. ‘현재 블록 계산/가시성 정책’이 여러 곳에 중복되어(시간대 경계/예외 시간) UI마다 서로 다른 “현재”를 보여줄 수 있다.
- 근거: agent-output/analysis/001-...에서 getCurrentBlock 중복 지적.


## 5) 테스트/품질 게이트
H1. 테스트 환경이 node 위주라(환경: node, UI 제외) 렌더링/상호작용 회귀(모달 닫기, 탭 제거 등)를 테스트가 잡지 못한다.
- 근거: vitest.config.ts에서 src/**/*.tsx exclude.

H2. 테스트가 의도적으로 stderr/console을 많이 찍어, 실제 회귀 로그가 노이즈에 묻힐 수 있다.
- 근거: npm test 출력에서 EventBus/FirebaseSanitizer/StoreUtils 등의 stderr 로그.

H3. lint가 warning 0개 정책이라, 작은 미사용 import도 릴리즈/CI에서 “빌드 실패”로 이어질 수 있다.


## 6) 빌드-릴리즈
H1. 스크립트 체인이 길고(electron:dev = electron:build + dev + wait-on), 중간 단계 한 곳에서 실패하면 원인 파악이 어려워질 수 있다.

H2. electron-updater/릴리즈 흐름은 Settings UI에서 체크하지만, 실제 릴리즈 아티팩트 누락/네트워크 조건 문제는 UI에서만 확인되어 회귀가 늦게 발견될 수 있다.


## 7) 관측성/디버깅
H1. “관측성 정보”가 console과 SyncLog(systemState 저장)로 분산되어, 사용자 리포트/재현 시 필요한 로그를 빠르게 수집하기 어렵다.

H2. 이벤트 기반 흐름(EventBus, task completion pipeline)은 잘 설계됐지만, UI에서의 원인-결과 추적(어떤 액션이 어떤 핸들러를 촉발했는지)이 부족하면 디버깅 시간이 길어진다.


## 8) 보안/비밀정보
H1. Settings에는 API 키류가 포함되며, 로컬 전용 저장(updateLocalSettings)과 동기화 저장(updateSettings)이 혼재되어 실수로 동기화될 가능성이 있다(특히 신규 필드 추가 시).
- 근거: SettingsModal에서 secretKeys를 분리해 저장.

H2. 로그/SyncLog에 민감 값이 포함될 경우(에러 객체, payload) 노출 위험이 있다.


## 9) 코드품질/아키텍처 부채
H1. 정책(중앙 defaults, optional chaining, repo 통해 CRUD)과 실제 구현이 일부 불일치하여, 새 기능 추가 시 동일한 실수가 반복될 수 있다.
- 근거: settingsRepository의 하드코딩/혼합, systemState direct access, 모달 닫기 규칙 위반 사례.

H2. “God Component 해소” 노력은 보이지만(AppShell hooks 분리), 여전히 최상위에서 많은 concern을 오케스트레이션하고 있어(초기화/IPC/토스트/패널/모달) 회귀 범위가 넓다.

---

# 확인 포인트(로그/측정) 체크리스트
(각 가설을 빠르게 검증하기 위한 실무 체크리스트)

## 성능
- React Profiler: ScheduleView/TimelineView/TempSchedule(week/month)에서 commit time, 렌더 빈도 확인
- Electron/Chromium Performance 탭: 60초 녹화 후 setInterval 기반 타이머로 인한 scripting time 비중 확인
- “타이머 수” 점검: 화면 진입/이탈 반복 후 활성 interval이 누적되는지(리스너/타이머 cleanup 누락 여부)
- Dexie IO: systemState get/put 호출 빈도 측정(기능 토글/패널 토글/모달 오픈 시)
  - 방법: db.systemState wrapper에 debug 로그(추후) 또는 DevTools에서 IndexedDB activity 관찰

## 안정성
- 개발 서버 재현: npm run dev에서 Babel/TS 파싱 에러 발생 여부(특히 settings 탭 컴포넌트)
- 이벤트 리스너 누수: 모달을 10회 열고 닫은 뒤 ESC 핸들러가 1번만 동작하는지(중복 close 발생 여부)

## 데이터 무결성/동기화
- systemState 키 인벤토리화: direct 접근 키 문자열 목록 추출 후(systemState.get('...')) systemRepository/SYSTEM_KEYS와 매핑
- Settings 기본값 정합성: createInitial/sanitize/SETTING_DEFAULTS의 값이 일치하는지(특히 interval 단위: 분 vs ms)
- Firebase merge 시나리오: 로컬에서 설정 변경 후 오프라인→온라인 전환 시, updatedAt 비교로 어떤 필드가 승리하는지 확인
  - 방법: SyncLogModal/LogsTab에서 시퀀스 확인 + settings.updatedAt 추적

## UX/접근성
- 모달 닫기 규칙 점검:
  - 배경 클릭: 닫히면 안 됨
  - ESC: 닫혀야 함(중첩 모달은 top만)
  - 포커스: 열릴 때 초점/닫힐 때 원래 위치 복귀(가능하면)
- 위반 후보(우선 확인): BattleMissionsSection TimeSlotEditor

## 테스트/품질 게이트
- lint: 경고 0개 정책 유지 시, PR마다 “unused import”가 빌드 블로커가 되는지 확인
- 테스트 노이즈: stderr 로그가 실제 실패 신호를 가리는지(특히 CI 로그에서)
- 커버리지 갭: UI 회귀를 잡기 위한 최소 smoke test 필요 여부 판단

## 빌드-릴리즈
- electron:dev / electron:prod / dist 스크립트별 실패 지점 분리 로깅이 있는지 확인
- 업데이트 확인 플로우: 프로덕션 빌드에서만 활성화되는지 + 사용자에게 필요한 로그/오류 메시지 제공 여부

## 관측성
- SyncLog: 어떤 이벤트가 기록되고, 문제 재현 시 어떤 정보를 남기는지(키/액션/에러 스택) 확인
- 성능 리포트(Dev 환경): window.__performanceMonitor.printReport() 유무/출력 내용 확인

## 보안
- secretKeys 목록이 Settings 타입 변화에 따라 유지보수되는지(새 키 추가 시 누락 위험)
- 로그에 민감 값 포함 여부: update 실패 시 error 객체에 요청 payload가 포함되는지 확인

---

# 즉시 얻을 수 있는 Quick wins (3개)
1) 모달 닫기 UX 규칙 위반 제거(배경 클릭 닫기 금지) 후보부터 정리
   - 1순위: src/features/settings/components/tabs/battle/BattleMissionsSection.tsx (overlay onClick 제거)
2) “중앙 defaults” 준수 강화를 위한 정합성 점검
   - SETTING_DEFAULTS에 누락된 필드(예: isAlwaysOnTopEnabled 등) 추가/정렬 + settingsRepository sanitize/createInitial에서 하드코딩 최소화
3) 품질 게이트 개선(개발 생산성)
   - lint가 warning도 실패시키므로, unused import 같은 ‘사소한’ 경고를 주기적으로 제거하는 워크플로 확립(또는 CI/로컬 분리 정책 논의)

# Open Questions (Planner에게)
1) ‘모달 배경 클릭 닫기 금지’는 전체 앱에서 절대 규칙인가요(예외 허용 없음)?
2) Settings 기본값의 단위 정책(분 vs ms)은 어디가 단일 진실인가요? defaults.ts vs shared/lib/constants vs repository createInitial 중 무엇을 정본으로 할까요?
3) systemState direct access를 전면 금지하고 repository로 강제할까요, 아니면 성능/간편성을 이유로 일부 예외를 둘까요?
