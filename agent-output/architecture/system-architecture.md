# System Architecture — TimeBlock Planner (Renderer 중심)

> Last updated: 2025-12-17

## Changelog
| Date | Change | Rationale | Plan/Ref |
|---|---|---|---|
| 2025-12-17 | Initial master doc created (no-memory mode) | Workspace에 `agent-output/architecture/`가 없어서 생성. 향후 아키텍처 결정을 단일 출처로 유지 | 001-focus-only-blocks-warmup-toggle-architecture-findings.md |
| 2025-12-17 | Phased rollout 설계: UI 5개 변경(탭/목표/TempSchedule/XP바) | 회귀 위험이 높은 UI 삭제를 “엔트리 제거→정리”로 단계화하여 롤백/검증을 단순화 | 002-ui-five-changes-phased-rollout-architecture-findings.md |

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
