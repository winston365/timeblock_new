# UI 변경 5종 리스크/핫스팟 분석 (Critic)

- Artifact path: N/A (ad-hoc request, 2025-12-17)
- Context docs checked: `.github/chatmodes/planner.chatmode.md` (not found in repo)
- Mode: Critic (pre-implementation)
- Date: 2025-12-17
- Status: Initial

## Value Statement Assessment
요청은 “프론트/UI만” 범위에서 5개 변경의 핫스팟/리스크/영향 범위를 선제 파악하여, 실제 구현 시 회귀 위험을 최소화하는 데 목적이 있음. 변경 자체가 기능 삭제/레이아웃 수정 위주라 회귀 가능성이 높고, 특히 ‘오늘 목표’ 제거는 UI만으로 끝내기 어려울 수 있어(타 모듈에서 목표 데이터 사용) 명확한 범위 합의가 필요.

## Overview
대상 변경은 크게 (A) UI 엔트리 제거(우측 패널 탭, GoalsModal 탭, DailyXPBar), (B) TempSchedule 달력 레이아웃/가독성 개선(월간 깨짐, 주간 시간 구분선)로 분류됨.

핵심 위험은 다음 3가지:
1) “UI 삭제”가 실제로는 상태/타입/데이터 흐름(목표, XP, 패널 탭 상태)에 연동되어 있어 컴파일/런타임/UX 회귀가 발생할 수 있음.
2) TempSchedule 월/주간 뷰는 스크롤/고정 헤더/보더가 얽혀 있어 1px 오프셋, border collapse 부재, overflow 컨테이너 차이로 ‘삐뚤어짐’이 재발하기 쉬움.
3) 삭제 대상이 다른 기능의 affordance(진입점)인 경우, 대체 경로/단축키/접근성(aria-controls, tabIndex)까지 같이 정리되지 않으면 깨짐.

## Findings
### (1) 우측 사이드바 인벤토리(가방) 탭 제거
- Hotspots
  - src/app/components/RightPanel.tsx (탭 정의/렌더 조건)
  - src/app/AppShell.tsx (rightPanelTab 타입/초기값)
  - src/features/inventory/InventoryPanel.tsx (엔트리 제거 이후 dead code 가능)
  - src/shared/stores/gameStateStore.ts (inventory 총합 뱃지 계산에 사용; UI 제거 시에도 데이터는 남음)
- Risk: Medium
  - 주된 위험은 타입 유니온(`'shop' | 'inventory'`) 및 탭 전환 핸들러가 남아있을 때 컴파일 오류/불필요 상태가 되는 것.
  - UI만 제거하면 데이터/동기화는 유지되므로 기능적 위험은 낮지만, AppShell과 RightPanel 간 props 일치가 깨지기 쉬움.
- Common breakpoints
  - 키보드 단축키(우측 패널 토글 자체는 유지되나, 사용자가 ‘가방’ 진입을 기대할 수 있음)
  - 접근성(role=tablist/tabpanel aria-controls) 정합성

### (2) 목표관리에서 ‘오늘 목표’ 관련 전부 삭제, 장기목표 유지
- Hotspots
  - src/features/goals/GoalsModal.tsx (탭 구조, daily 탭/GoalModal 상태)
  - src/features/goals/GoalPanel.tsx, src/features/goals/GoalModal.tsx (오늘 목표 UI)
  - src/shared/stores/goalStore.ts (이름은 DailyGoal이지만 사실상 global goals; UI 외에도 광범위 사용)
  - src/shared/stores/dailyDataStore.ts (task.goalId 변경 시 recalculateProgress 호출)
  - src/features/schedule/TaskModal.tsx (목표 목록 로드 및 goalId 선택 UI)
  - src/features/schedule/TimelineView/TimelineView.tsx (goals 로드/표시)
  - src/shared/subscribers/goalSubscriber.ts (goal:progressChanged 처리)
- Risk: High
  - “오늘 목표 전부 삭제”를 UI 레이어로만 해석하면: GoalsModal에서 daily 탭/GoalPanel/GoalModal을 제거해도, TaskModal/TimelineView 등에서 목표(=DailyGoal 타입)를 계속 사용하므로 ‘기능 삭제’로 인지되는 범위와 불일치 가능.
  - 반대로 goalStore/타입/연산까지 제거하려 하면 UI 범위를 넘어 상태/서비스 계층을 광범위하게 건드리게 되어 회귀 위험 급상승.
- Common breakpoints
  - 작업 생성/수정에서 goalId 선택 드롭다운
  - 작업 완료 파이프라인에서 목표 진행률 업데이트(핸들러/스토어)
  - EventBus(goal:progressChanged) 구독 체인

### (3) 임시스케줄 월간 달력 UI 깨짐(삐뚤어짐) 수정
- Hotspots
  - src/features/tempSchedule/components/MonthlyScheduleView.tsx (요일 헤더 flex, 주별 flex row, DayCell border 조합)
  - (연관) TempScheduleModal / 컨테이너 overflow 설정에 따라 fixed popover 좌표가 달라질 수 있음
- Risk: Medium
  - ‘삐뚤어짐’은 주로 (a) 헤더와 바디의 column 폭 불일치, (b) border 두께 누적, (c) 스크롤바 유무로 인한 폭 차이에서 발생.
  - 현재 구조는 요일 헤더와 그리드가 모두 flex 기반이라, 특정 브라우저/스크롤 상황에서 1px씩 틀어질 수 있음.
- Common breakpoints
  - hover popover 위치(스크롤/컨테이너 offset 변경 시 튀는 현상)
  - 주차별 row 높이(셀 min-height + 하단 패널의 flex 비율)

### (4) 임시스케줄 주간 뷰 시간별 구분선 추가
- Hotspots
  - src/features/tempSchedule/components/WeeklyScheduleView.tsx
    - DayColumn 내부의 스케줄 블록 컨테이너(현재는 블록 absolute 배치만 있고 배경 gridline 없음)
    - 시간 레일은 존재(TIME_RAIL_WIDTH)하므로, 구분선은 7일 영역에 overlay로 추가하는 형태가 자연스러움
- Risk: Low~Medium
  - 시각적 변경이지만, absolute 배치된 TaskBlock들과 z-index/hover preview, 현재 시간선(z-[15])과의 stacking 충돌이 흔한 실패 지점.
- Common breakpoints
  - 드래그&드롭(드롭 인식 영역이 구분선 element에 의해 방해될 수 있음 → pointer-events 처리 필요)
  - 스크롤 성능(라인을 과도하게 DOM으로 만들면 비용 증가)

### (5) TopToolbar ‘오늘 하루 전체 XP바(목표 x6)’ 제거
- Hotspots
  - src/app/AppShell.tsx (TopToolbar 아래에 DailyXPBar 렌더)
  - src/app/components/DailyXPBar.tsx (삭제/미사용화)
  - src/shared/types/domain.ts의 TIME_BLOCKS 길이에 따라 x6 표기가 달라짐
- Risk: Low
  - 엔트리 제거만 하면 기능적으로 독립적. 다만 XP 파티클 타겟은 TopToolbar의 “오늘 XP 숫자”에 묶여 있어(DOM 위치 등록) DailyXPBar 제거 자체는 영향이 거의 없음.
- Common breakpoints
  - 상단 바 높이 변화에 따른 레이아웃(특히 메인 grid 시작점/스크롤)

## Safety / Rollout Recommendations
- 공통 원칙: “데이터/스토어는 유지하고 UI 엔트리만 먼저 제거” → 회귀 최소화.
- 단계적 삭제 순서(권장)
  1) 진입점 제거: 탭 버튼/CTA 버튼/모달 탭 등 UI entry를 먼저 숨김
  2) 연결 상태 정리: AppShell/Props/union 타입 등 컴파일 핫스팟 정리
  3) 사용처가 남아있지 않은 컴포넌트부터 삭제(InventoryPanel, GoalPanel/GoalModal 등)
  4) 마지막으로 서비스/스토어/타입 정리(요구가 ‘기능 제거’로 확정된 경우에만)
- 가드/플래그(프론트 범위)
  - 런타임 설정 기반 feature flag는 Dexie systemState를 사용할 수 있으나, 이번 단계는 “UI만”이므로 가장 안전한 것은 단순 조건부 렌더(상수)로 시작.
  - 삭제가 아니라 숨김이라면, code path는 유지하고 사용자에게는 보이지 않게 처리(회귀 최소).

## Questions (Need Product Clarification)
1) “오늘 목표 전부 삭제”는 GoalsModal의 ‘오늘 목표 탭’과 관련 UI만 제거하는 의미인가요, 아니면 작업 생성/편집의 goalId 선택(목표 연결)까지 포함해 목표 기능 자체를 없애는 의미인가요?
2) DailyXPBar 제거는 AppShell에서 해당 바만 제거하면 되는지, 아니면 설정(GameplayTab의 timeBlockXPGoal 의미/문구)도 함께 정리하길 원하는지요?
3) 월간 달력 ‘삐뚤어짐’은 어떤 화면/해상도/줌에서 재현되나요? (예: 스크롤바 생길 때 헤더-바디 폭이 어긋남 vs 특정 주차만 라인이 틀어짐)

## Risk Assessment
- Highest risk: (2) 오늘 목표 제거 (범위가 UI-only인지 기능 제거인지에 따라 변경 폭이 급변)
- Medium risk: (3) 월간 달력 레이아웃(회귀/브라우저 차이)
- Lower risk: (1) 인벤토리 탭 제거, (4) 주간 구분선, (5) DailyXPBar 제거

## Revision History
| Date | Request | Summary |
|------|---------|---------|
| 2025-12-17 | Initial | 5개 변경에 대해 핫스팟/리스크/연관 기능/안전장치/질문 정리 |
