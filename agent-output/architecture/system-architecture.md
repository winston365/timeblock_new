# System Architecture — TimeBlock Planner (Renderer 중심)

> Last updated: 2025-12-22

## Changelog
| Date | Change | Rationale | Plan/Ref |
|---|---|---|---|
| 2025-12-17 | Initial master doc created (no-memory mode) | Workspace에 `agent-output/architecture/`가 없어서 생성. 향후 아키텍처 결정을 단일 출처로 유지 | 001-focus-only-blocks-warmup-toggle-architecture-findings.md |
| 2025-12-17 | Phased rollout 설계: UI 5개 변경(탭/목표/TempSchedule/XP바) | 회귀 위험이 높은 UI 삭제를 “엔트리 제거→정리”로 단계화하여 롤백/검증을 단순화 | 002-ui-five-changes-phased-rollout-architecture-findings.md |
| 2025-12-17 | 구조 개선 대안(A/B) 및 추천안 정리(프론트/UI 중심) | 레이어는 존재하지만 DB 접근/이벤트 발행이 경계 밖으로 새어 결합도가 증가 → “경계 재정착”을 최우선으로 제안 | 003-frontend-structural-improvements-architecture-findings.md |
| 2025-12-18 | Firebase RTDB 다운로드 스파이크 완화(Phase 0~3) 설계 추가 | 백엔드 변경 없이도 리스너/초기 fetch 폭주를 즉시 차단하고, 계측→정합성→가드레일 순으로 리스크를 낮춤 | 004-firebase-rtdb-mitigation-phased-architecture-findings.md |
| 2025-12-21 | 장기목표(WeeklyGoal) 프론트/UI 개선 아키텍처 옵션(A/B/C) 및 권고안 추가 | weekly/global 목표 의미론 분리로 인한 경계 혼선을 낮추고, 모달 UX/검증/구조 부채를 “UI-only” 범위에서 우선 해결 | 005-long-term-goals-frontend-architecture-findings.md |
| 2025-12-22 | 전 모달 공통 UX: ESC 닫기 + Ctrl/Cmd+Enter primary 표준화 권고안 추가 | 기존 `useModalEscapeClose`(스택 기반) 패턴을 확장해 스택 정합성과 IME(조합) 리스크를 동시에 해결 | 006-modal-hotkeys-standardization-architecture-findings.md |

## Purpose
- Renderer(Electron + React) 중심의 시스템 경계/데이터 흐름/결정(ADR)을 기록하는 단일 출처.
- UI 규칙(localStorage 금지, defaults 단일 출처, 모달 UX 표준)과 기능 확장 시 영향 범위를 명확히 한다.

## High-Level Architecture
- Renderer(UI): React + TS, feature-first (`src/features/*`)
- 상태: Zustand stores (`src/shared/stores/*`, feature-local stores)
- 데이터 접근: Repository layer (`src/data/repositories/*`)를 통해서만 CRUD
- 로컬 지속: Dexie(IndexedDB) + `db.systemState`(UI 토글/레이아웃/소규모 플래그)
- 동기화: Firebase sync 서비스(`src/shared/services/sync/firebase/*`) — 전략(Strategy) 기반

## Key Runtime Flows (관련 영역)
### Schedule (리스트형 타임블록)
- UI: `src/features/schedule/ScheduleView.tsx`가 하루 타임블록 목록 렌더.
- 데이터: `useDailyData()` 훅이 dailyData/CRUD를 제공.
- 표시 정책: 현재는 “지난 블록 숨김(showPastBlocks)”만 존재(미래 블록은 항상 노출).

### Timeline (패널형 타임라인)
- UI: `src/features/schedule/TimelineView/TimelineView.tsx`
- 데이터 변환: `src/features/schedule/TimelineView/useTimelineData.ts`
- UI 토글 지속: past-hide 토글이 Dexie `systemState`에 저장됨.

### Warmup Preset / Auto Insertion
- 모달: `src/features/schedule/components/WarmupPresetModal.tsx`
- 프리셋 데이터: Firebase sync(기존 warmupPresetStrategy)로 로드/저장.
- 자동 삽입: `src/features/schedule/ScheduleView.tsx` 내부 `useEffect`에서 시간 기반으로 수행(현재는 항상 on).

### Goals (Weekly vs Global)
- Weekly goals(장기목표/주간): `src/features/goals/*` + `useWeeklyGoalStore` → `weeklyGoalRepository` → Dexie(`weeklyGoals`) → Firebase(LWW)
	- 주 경계(월요일) 리셋은 repository load 시점에 수행(히스토리 append + progress reset + bulk sync)
- Global goals(작업 기반/오늘 정합): `useGoalStore` → `globalGoalRepository` → Dexie(`globalGoals`, `dailyData`, `globalInbox`) → Firebase(LWW)
	- 진행률 재계산은 “오늘 + scheduled task(timeBlock != null)” 기준으로만 수행
- Event/Side-effect 연동
	- task completion pipeline의 `GoalProgressHandler` 및 `goalSubscriber`는 **global goal만** 업데이트
	- weekly goal은 현재 task completion/eventBus와 직접 연동하지 않음

## Data Boundaries / Invariants
- localStorage 사용 금지(예외: theme)
- 기본값 하드코딩 금지 → defaults는 `src/shared/constants/defaults.ts` 단일 출처
- Repository 경계 준수: Dexie/Firebase 직접 호출은 repo/service에서만
- 모달 UX 표준: 배경 클릭으로 닫지 않음 + ESC로 닫힘

## Decisions (ADRs)
### ADR-001: “현재 3h 블록만 표시”는 표시 정책(렌더링 레벨)로 시작한다
**Context**
- 요구사항: 지난 + 미래 타임블록을 가려 현재 진행중인 3h 타임블록만 보이게.
- Risk: 계획/조망(미래 블록 편집) 기능 약화, 빈 화면 케이스(현재 블록 없음), 상태 소스 분산.

**Choice**
- 1차 구현은 데이터 삭제/이동이 아닌 “표시 정책(렌더링 레벨 가드)”로 제한한다.
- 정책은 ScheduleView(리스트) 기준으로 우선 적용하고, Timeline/다른 표면은 별도 결정(Findings 001 참조).

**Alternatives**
- 데이터 레벨에서 미래 블록을 생성하지 않거나 제거: 회귀/디버깅 비용 큼, 되돌리기 어려움.
- TimeBlock 컴포넌트에 future 상태를 주입하여 내부에서 마스킹: 컴포넌트 책임 증가.

**Consequences**
- 데이터는 존재하되 UI에서 보이지 않는 영역이 생김 → 디버그/QA 포인트를 명시해야 함.

### ADR-002: Warmup 자동생성 on/off는 단일 플래그로 UI side-effect를 가드한다
**Context**
- 요구사항: WarmupPresetModal에 자동생성 토글 추가(현재는 무조건 on).
- 현재 자동 삽입 로직이 ScheduleView 내부에 있어 회귀 위험이 큼.

**Choice**
- 단일 boolean 플래그(저장 위치 후보는 Findings 001 참조)를 읽어 `useEffect`가 early-return 하도록 설계한다.
- 기본값은 기존 동작과 동일(= on)로 두어 회귀를 최소화한다.

**Consequences**
- 토글 state 소스가 늘어날 수 있으므로, systemState 키 네이밍/소유권을 명확히 해야 한다.

### ADR-003: UI 기능 제거는 “표면(엔트리) 제거”를 먼저, 데이터/스토어는 보존한다
**Context**
- 요청된 5개 변경은 대부분 UI 엔트리 삭제(탭/바) 및 레이아웃 수정(TempSchedule)이며, 일부(Goals)는 다른 표면(TaskModal/Timeline/파이프라인)과 강하게 연결됨.
- “프론트/UI만” 제약하에서 기능을 제거하려고 데이터/스토어/서비스까지 건드리면 회귀 및 롤백 비용이 급증.

**Choice**
- 기본 전략은 1) UI 엔트리(탭/CTA/바) 제거, 2) 접근성/타입/props 정합성만 최소 정리, 3) 안정화 후 dead code 정리(선택) 순으로 진행.
- Goals의 ‘오늘 목표 전부 삭제’는 **UI-only(GoalsModal에서 daily 탭 제거)** 를 기본값으로 하고, goal 선택/연결까지 제거하는 해석은 별도 범위 확정 후 재검토한다.

**Alternatives**
- 초기부터 store/타입/핸들러 체인까지 삭제: 기능 제거로는 깔끔하나 UI-only 제약과 상충하고 되돌리기 어려움.

**Consequences**
- “보이지 않는 기능(데이터는 남아있음)”이 일시적으로 생길 수 있어, Phase 경계/검증 체크리스트를 명확히 유지해야 함.

### ADR-004: Dexie(DB) 접근은 Repository를 단일 관문으로 강제한다
**Context**
- 원칙상 CRUD는 `src/data/repositories/*`를 통해서만 수행해야 하나, 실제로는 `db` 직접 import가 store/subscriber/service 일부에 잔존.
- 결과: 마이그레이션/폴백/키 관리가 분산되고, 회귀 범위가 넓어짐.

**Choice**
- `src/data/db/*` 및 `src/data/repositories/*` 외부에서는 `db` 직접 접근을 금지한다.
- systemState는 `systemRepository.ts`를 정본으로 삼아 키/CRUD를 수렴한다.

**Alternatives**
- store/service에서 DB 접근을 허용(편의성): 단기 속도는 오르나 결합도/회귀 위험이 누적.

**Consequences**
- 단기적으로 wrapper/치환 작업이 필요하나, 장기적으로 디버깅/변경 비용이 감소.

### ADR-005: EventBus 발행(emit)은 Store(또는 오케스트레이터 서비스)만 담당한다
**Context**
- EventBus README는 Store→Subscriber 패턴을 권장.
- repository에서 `eventBus.emit`이 발생하면 “데이터 저장 계층”과 “도메인 이벤트”가 결합되어 추적/테스트가 어려워짐.

**Choice**
- emit은 store(또는 usecase/orchestrator)에서만 수행하고, subscriber는 `src/shared/subscribers/*`에 집중한다.
- repository는 순수하게 데이터 접근/영속화 책임만 가진다.

**Alternatives**
- repository emit 유지: 저장 성공/실패를 이벤트로 알리기 쉽지만, 계층 경계가 무너짐.

**Consequences**
- 이벤트 발행 타이밍(optimistic update vs commit 이후)을 store 레벨에서 명시적으로 관리해야 함.

### ADR-006: Firebase RTDB Sync는 “폭주 방지(Containment) 우선”으로 단계적 완화한다
**Context**
- RTDB 저장량 대비 다운로드 급증이 관측되었고, 현재 구조는 (1) 앱 시작 시 다수 루트 `get()`(초기 전체 읽기), (2) 여러 컬렉션 루트 `onValue()` 리스너, (3) Dexie hook 기반 전체 업로드 + `syncToFirebase()`의 사전 `get()` 결합으로 “변경 1회 → 큰 서브트리 반복 다운로드”가 발생하기 쉬움.
- Electron은 다중 렌더러(QuickAdd 등)에서 동일 리스너가 중복 등록되어 다운로드가 배수로 증가할 수 있음.

**Choice**
- 우선순위를 다음과 같이 고정한다.
	- Phase 0: 백엔드 변경 없이 **리스너/초기 fetch 게이트(킬스위치 포함)** 로 다운로드 폭주를 먼저 멈춘다.
	- Phase 1: `onValue`/`get`/`syncToFirebase` 경로의 **빈도·크기 계측** 으로 원인 TOP 경로를 확정한다.
	- Phase 2: 루트 리스너 범위 축소, 리스너 생명주기(stopListening), 전체 업로드/사전 get 최적화로 **정합성+비용** 을 함께 개선한다.
	- Phase 3: 세션 다운로드 budget, rate-limit, 회귀 테스트 등 **가드레일** 로 재발을 방지한다.

**Constraints / Invariants**
- 플래그/세이프모드 저장은 localStorage가 아니라 `Dexie.systemState`를 사용(테마 예외 유지).
- Firebase SDK 직접 호출은 sync/service 경계 내부로 제한(Repository/Store/EventBus 규칙 유지).

**Alternatives**
- 즉시 대규모 리팩터(증분 모델 전환 포함): 근본 개선은 빠르나, 원인 확정 전 변경 범위가 커져 회귀/롤백 비용이 급증.
- 백엔드 규칙(보안/인덱스/쿼터)만으로 해결: 가능한 경우도 있으나 “백엔드 변경 불가” 조건에서는 즉시 적용 불가.

**Consequences**
- Phase 0에서 동기화가 일부/전체 중단될 수 있으나, Local-first(Dexie)로 앱 기능은 유지되어야 한다.
- Phase 2에서 `pre-get` 생략/부분 업로드는 충돌 정책(단일-writer 가정 등)을 문서화한 뒤에만 허용.

### ADR-007: 장기목표(WeeklyGoal) 개선은 “UI 하드닝 + 경계 명확화”를 우선한다
**Context**
- WeeklyGoal(수동 카운터)과 GlobalGoal(작업 기반)이 공존하며, 이벤트/파이프라인도 global에만 붙어 있다.
- UI-only 제약에서 의미론 통합(=스키마/마이그레이션/핸들러 확장)을 바로 수행하면 회귀 범위가 급증한다.

**Choice**
- 1차 개선은 Option A(하드닝 + feature-first 분리)를 정본으로 한다.
	- `confirm/alert` 제거 및 모달 UX 규칙 통일
	- 입력/정규화 경계를 문서화(향후 zod 도입 시 대체 가능)
	- weekly/global 의미론 통합은 별도 Epic(Option C)으로 분리

**Alternatives**
- 즉시 zod 도입(Option B): 데이터 정합성 이점은 크나 신규 deps/정책 결정 비용이 든다.
- 즉시 의미론 통합(Option C): 장기적으로 깔끔하나, UI-only 범위를 넘어서는 마이그레이션/정책 결정이 필요하다.

**Consequences**
- weekly goal은 당분간 수동 카운터로 남아 task 기반 정합성은 보장하지 않는다.
- 대신 모달/구조/검증의 부채를 먼저 줄여, 이후 Option B/C의 착수 비용을 낮춘다.
