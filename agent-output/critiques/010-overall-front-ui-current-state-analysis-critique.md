# Critique: Overall Front/UI Current State → Top10 & Risk Prioritization

Artifact: agent-output/analysis/010-overall-front-ui-current-state-analysis.md
Date: 2025-12-17
Status: Initial

## Changelog
| Date | Request | Summary |
|---|---|---|
| 2025-12-17 | Top10 개선점 + 리스크/부채 우선순위 산출 | 정적 근거(파일/폴더 힌트) 기반으로 Top10, 리스크/부채(상/중/하), 방치 시 커지는 부채, 권장 다음 액션을 정리함. |

## Value Statement Assessment
- 원문 분석 문서는 “카테고리별 문제→가설→검증 포인트” 구조가 명확해 다음 단계(Planner/Implementer)가 우선순위를 잡기 좋은 형태다.
- 다만 현재 요청(Top10 + 우선순위 산정)에 필요한 **정량/비용-난이도/리스크 스코어링 축**이 약하므로, 실행 순서와 투자 대비 효과를 빠르게 판단하기 어렵다.

## Context & Process Gaps
- Flowbaby memory 도구 미구현으로 No-Memory Mode로 진행(이전 합의/결정은 repo 문서와 코드에서만 추론).
- Critic 모드 요구사항 중 `.github/chatmodes/planner.chatmode.md`를 매 리뷰 시작에 읽어야 하나, 워크스페이스에 해당 파일이 존재하지 않아 확인 불가.

## Top 10 Improvements (Summary)
아래 Top10은 “효과 대비 리스크 감소” 중심으로 정렬.

1) Repository 경계 재정착(직접 Dexie import 제거)
- 기대효과: 마이그레이션/동기화/폴백 일관성 확보, 변경 영향 범위 축소
- 비용-난이도: 중~상 (사용처 다수)
- 리스크: 기존 동작 회귀(특히 UI 토글/시스템 상태)
- 근거: UI/hooks에서 Dexie 직접 접근 다수(예: src/features/schedule/TimelineView/useTimelineData.ts, src/features/schedule/HourBar.tsx). systemRepository는 존재함(src/data/repositories/systemRepository.ts).

2) EventBus emit 위치 규칙 준수(Repository에서 emit 제거)
- 기대효과: 데이터 계층 순수성, 테스트/추적 용이성, 이벤트 체인 예측 가능
- 비용-난이도: 중
- 리스크: 이벤트 발행 타이밍(저장 전/후) 재정의 필요
- 근거: eventBus README는 “Store→Subscriber” 권장. 그러나 src/data/repositories/tempScheduleRepository.ts에서 emit 발생.

3) 모달 UX 표준 강제(배경 클릭 닫기 금지 + ESC 닫기)
- 기대효과: 입력 유실/오작동 방지, UX 일관성, 접근성 향상
- 비용-난이도: 중 (모달 수 많아 점검 필요)
- 리스크: 기존 사용자가 ‘배경 클릭 닫기’에 익숙한 경우 반발 가능(하지만 repo 정책은 금지)
- 근거: src/features/settings/components/tabs/battle/BattleMissionsSection.tsx 의 TimeSlotEditor에서 backdrop div에 onClick={onClose}.

4) systemState 키/저장소 단일화(systemRepository + SYSTEM_KEYS로 수렴)
- 기대효과: 키 중복/오타/폴백 분산 방지, 상태 진단 쉬움
- 비용-난이도: 중
- 리스크: 기존 key 문자열을 유지해야 데이터 마이그레이션 최소화
- 근거: TimelineView/useTimelineData.ts는 'timelineShowPastBlocks' 문자열을 직접 사용. HourBar.tsx는 'collapsedHourBars' 직접 사용.

5) Settings 기본값/마이그레이션 정합성 강화(Defaults drift 제거)
- 기대효과: 신규 설치/기존 사용자 간 설정 차이 축소, “기본값 어디가 정본?” 혼란 제거
- 비용-난이도: 중
- 리스크: 기존 사용자 설정이 덮어써지는 실수 위험 → sanitize/upgrade 정책 필요
- 근거: src/data/repositories/settingsRepository.ts에서 SETTING_DEFAULTS 외에 DEFAULT_AUTO_MESSAGE_INTERVAL, templateCategories/aiBreakdownTrigger 등의 하드코딩이 혼재.

6) timeBlock visibility 테스트 중복 정리(단일 파일로 병합)
- 기대효과: 유지보수 비용 감소, 정책 변경 시 누락 방지
- 비용-난이도: 하
- 리스크: 없음(테스트만 정리)
- 근거: tests/timeblock-visibility.test.ts 와 tests/time-block-visibility.test.ts가 중복 목적(같은 유틸 테스트)이며 내용 일부가 겹치고 모드 커버리지가 분산됨.

7) Lint 게이트(경고 0개) 운영 전략 명시
- 기대효과: 개발 생산성/릴리즈 안정성 균형, “사소한 경고가 배포 중단” 상황 예방
- 비용-난이도: 하~중 (정책/워크플로 합의)
- 리스크: 게이트 완화 시 품질 저하 우려(대신 자동 수정/프리커밋으로 보완)
- 근거: package.json에서 eslint --max-warnings 0.

8) UI 타이머/interval 사용 인벤토리화 및 정리(누수/중복 렌더 예방)
- 기대효과: CPU/배터리/프레임 드랍 감소, 장시간 실행 안정성
- 비용-난이도: 중
- 리스크: 시간 기반 UI 로직 회귀
- 근거: 010 분석 문서에서 schedule 계열에 interval 다수 가설 제시(예: ScheduleView는 1분 interval).

9) UI 회귀 감지를 위한 최소 Smoke Test 전략(렌더러 상호작용)
- 기대효과: 모달 닫기/탭 제거/레이아웃 회귀를 조기 탐지
- 비용-난이도: 중
- 리스크: 테스트 인프라 추가 부담
- 근거: 현 테스트는 서비스/유틸 중심이며 UI(.tsx) 커버리지 제외.

10) 문서/정책의 단일 출처 정리(프로세스 부채)
- 기대효과: 신규 기여자 온보딩/규칙 위반 감소
- 비용-난이도: 하
- 리스크: 없음
- 근거: planner chatmode 파일 부재로 Critic 워크플로 자체가 불완전.

## Risk / Debt Prioritization
- 상: Repository 경계 위반(직접 Dexie), Repository에서 EventBus emit, 모달 배경 클릭 닫기 위반
- 중: Defaults drift(설정 기본값/마이그레이션), 테스트 중복, lint 경고 0개 정책 운영 리스크, UI 타이머/interval 확산
- 하: 문서/프로세스 단일 출처 부재, 테스트 로그 노이즈/커버리지 범위 불균형

## “지금 안 하면 커지는” 부채 3~5개
1) 직접 Dexie 접근 확산(사용처 증가 → 교체 비용 기하급수)
2) EventBus 계층 경계 붕괴(Repository emit가 더 늘면 추적/테스트 난이도 급상승)
3) Defaults drift(새 설정 필드 추가 때마다 초기값/마이그레이션 불일치 누적)
4) 모달 UX 비일관성(기능 추가될수록 예외가 늘어 규칙 강제 어려워짐)
5) 중복 테스트/규칙 분산(정책 변경 시 일부만 업데이트되는 누락 위험)

## Recommended Next Actions (Order Hint)
1) “DB 접근/키 관리” 경계 원칙을 문서화하고 현재 위반 인벤토리(경로+종류) 작성
2) tempScheduleRepository의 emit를 store/orchestrator로 이동하는 설계 합의(발행 시점 포함)
3) 모달 UX 감사(Audit): backdrop 클릭 닫기 제거 + ESC 닫기 표준화(훅 사용) 체크리스트 수립
4) settingsRepository 기본값/마이그레이션 소스 정리(SETTING_DEFAULTS 중심) + 하드코딩 목록화
5) timeblock visibility 테스트 2개를 단일 파일로 병합하고 모드 커버리지(특히 hide-future) 기준 확정
