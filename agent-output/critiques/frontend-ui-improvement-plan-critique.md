# Critique: Frontend/UI Improvement Plan

Artifact: docs/plan/frontend-ui-improvement-plan.md
Date: 2025-12-17
Status: Initial (Hotspot/Risk Review for 2 urgent requirements)

## Changelog
| Date | Request | Summary |
|---|---|---|
| 2025-12-17 | Identify hotspots/risks for 2 requirements | Scanned schedule rendering + warmup preset modal + timeline hook. Flagged UX/tech risks and safe-change boundaries. |

## Value Statement Assessment
- Plan의 가치/원칙(인지부하 최소, 상태 가시성, ADHD 친화)과 이번 2개 요구사항은 방향성이 일치한다.
- 다만 “미래 타임블록 숨김”은 계획/조망(미래 블록에 작업 배치) 기능을 실질적으로 약화시킬 수 있어, 사용자 가치의 트레이드오프(집중 vs 계획)가 명시되어야 한다.

## Context & Gaps
- Flowbaby memory unavailable → 과거 결정/정책 근거는 문서/코드만 기반.
- Critic 모드 요구사항 중 `.github/chatmodes/planner.chatmode.md`를 읽어야 하나, 현재 워크스페이스의 `.github/`에 `chatmodes/` 디렉터리가 존재하지 않아 확인 불가.

## Hotspot Summary (Evidence)
1) ScheduleView(리스트형 타임블록)
- Past 블록 숨김만 구현되어 있고 Future 블록은 항상 렌더링됨.
- Auto warmup insertion 로직이 ScheduleView 내부 `useEffect`로 강결합.

2) TimeBlock 컴포넌트
- `isPastBlock` 전용 스타일/행동(자동 접힘, pointer-events none 등)이 존재.
- Future 개념이 props로 모델링되어 있지 않아 “미래 블록 마스킹”은 상위에서 필터링/프롭 추가 중 선택이 필요.

3) TimelineView/useTimelineData
- Past 숨김 토글이 타임라인 전용으로 독립 상태(Dexie systemState)에 저장됨.
- Future 숨김/현재블록만 표시 요구에 영향 가능(표시 범위/스크롤/현재시각 라인 등).

4) WarmupPresetModal
- 워밍업 프리셋 편집/저장/적용 UI만 있고, 자동생성 on/off 상태는 모델/스토리지/UX가 없음.

## Risks
### UX Risks
- 미래 블록이 보이지 않으면 사용자는 “다음 블록에 할 일 미리 넣기” 동선이 사라져 혼란/불안이 증가할 수 있음(특히 계획형 사용자).
- 현재 블록만 보이면 빈 화면/컨텍스트 손실 위험: 현재 블록이 없는 시간대(블록 외 시간)에서 무엇을 보여줄지 정의가 필요.
- 워밍업 자동생성 토글이 모달 내부에만 있으면, 자동 삽입이 언제/왜 발생하는지 사용자가 놓칠 수 있음(예측 가능성/설명 필요).

### Technical Risks
- 상태 소스 분산: ScheduleView는 zustand store(showPastBlocks) + 컴포넌트 내부 상태 + Dexie(systemState, timeline) + settingsStore가 혼재.
- Auto warmup insertion이 렌더러 컴포넌트에 박혀 있어 회귀 범위가 큼(타이머, dailyData, preset 로드 타이밍, 중복 삽입).
- Future 숨김이 단순 필터링으로 끝나면, 드래그/배치/검색/인박스 이동 등 다른 플로우에서 ‘존재하지만 보이지 않는 데이터’가 늘어 디버깅 난이도 상승.

## Safe-change Boundaries (Proposed)
- Requirement 1: “렌더링 레벨 가드” 우선(표시만 제한) + 예외 케이스(현재 블록 없음) 명확화.
- Requirement 2: “단일 플래그(예: systemState key)”로 자동 삽입 useEffect를 early-return 하도록 가드 → 기본값은 기존과 동일(true)로 회귀 위험 최소화.

## Open Questions
- 미래 블록 숨김은 ScheduleView(리스트)만 대상인가, TimelineView도 동일 UX로 맞춰야 하는가?
- 현재 블록이 없는 시간대(예: 23시 이후/새벽)에는 어떤 화면을 보여야 하는가?
- 워밍업 자동생성 토글의 지속 범위: 기기 로컬(Dexie systemState)인가, 계정 동기화(Firebase settings) 대상인가?
