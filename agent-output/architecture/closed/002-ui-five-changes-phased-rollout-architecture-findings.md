# 002 — Architecture Findings: UI 5개 변경사항 Phase 설계(위험 최소화)

Date: 2025-12-17
Mode: Architect (no-memory)
Scope: Frontend/UI only (no backend/Supabase/Electron IPC 구현 금지)

## No-Memory Mode
Flowbaby memory가 사용 불가하여, 본 문서는 레포 내 산출물/코드 기반으로 작성됨.

## Changelog
| Date | Trigger | Outcome |
|---|---|---|
| 2025-12-17 | Critic 005 기반 “5개 변경 Phase 설계” 요청 | 변경 1개=1 Phase로 분리(롤백 용이), Goals(오늘 목표) 2가지 해석 옵션/장단점, 파일 후보/영향도/롤백 전략 제시 |

## Inputs (근거)
- Critique: [agent-output/critiques/005-ui-changes-risk-analysis-critique.md](agent-output/critiques/005-ui-changes-risk-analysis-critique.md)
- Architecture master: [agent-output/architecture/system-architecture.md](agent-output/architecture/system-architecture.md)
- Hotspot 코드(대표)
  - Right panel 탭: [src/app/components/RightPanel.tsx](src/app/components/RightPanel.tsx)
  - App shell(TopToolbar/DailyXPBar): [src/app/AppShell.tsx](src/app/AppShell.tsx)
  - Daily XP bar: [src/app/components/DailyXPBar.tsx](src/app/components/DailyXPBar.tsx)
  - Goals modal(오늘/장기 탭): [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx)
  - TempSchedule 월/주간 뷰: [src/features/tempSchedule/components/MonthlyScheduleView.tsx](src/features/tempSchedule/components/MonthlyScheduleView.tsx), [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)

## 공통 가드레일(제약 준수 체크리스트)
- localStorage 사용 금지(테마 예외) — 이번 작업은 저장소 추가 필요 없음.
- 디자인 시스템/토큰/기존 컴포넌트만 사용(새 컬러/폰트/그림자 하드코딩 금지).
- 모달 UX 규칙 유지: 배경 클릭으로 닫지 않기, ESC 닫기 유지.
- “UI 변경만”을 원칙으로: 데이터 스키마/Repository/Sync 계약 변경 금지.

---

## Phase 설계 원칙(위험 최소화)
1) **변경 1개 = PR/커밋 1개(=1 Phase)** 로 분리 → git revert가 즉시 가능.
2) **삭제보다 ‘엔트리 제거(렌더/탭/CTA 제거)’를 먼저**: 컴포넌트/로직은 남기고 표면만 제거하면 회귀가 가장 적음.
3) 타입/상태/접근성(aria-controls) 같은 “컴파일/런타임 깨짐 포인트”를 Phase 경계 안에서 완결.
4) TempSchedule의 레이아웃은 **월/주간을 분리**해 회귀 범위를 줄임.
5) Goals(오늘 목표)는 리스크가 가장 커서 마지막 Phase로 두고, **해석 옵션을 분기**한다.

---

## Phases (권장 순서)

### Phase 1 — (5) TopToolbar의 “오늘 하루 전체 XP바(목표 x6)” 제거
**What (목표/범위)**
- 상단 영역에서 **DailyXPBar UI를 더 이상 렌더하지 않음**.
- XP 숫자(“⭐ 오늘 XP”) 및 TimeBlockXPBar는 유지(요구사항에 없음).

**변경 파일 후보 / 영향도**
- [src/app/AppShell.tsx](src/app/AppShell.tsx): DailyXPBar 렌더 제거 (Low)
- [src/app/components/DailyXPBar.tsx](src/app/components/DailyXPBar.tsx): Phase 1에서는 파일 유지(미사용) 권장 (Low)

**리스크/주의점**
- 상단 높이 변화로 인해 메인 그리드 시작 위치/스크롤 느낌이 바뀔 수 있음(시각적).

**롤백 전략**
- AppShell에서 DailyXPBar 렌더 한 줄(블록)만 되돌리면 복구.
- 컴포넌트 파일은 삭제하지 않아 revert 범위 최소.

---

### Phase 2 — (1) 우측 사이드바 “가방(인벤토리) 탭” 제거
**What (목표/범위)**
- RightPanel 탭 목록에서 “가방” 탭 버튼과 해당 panel 렌더를 제거.
- 데이터(인벤토리, gameState.inventory)는 유지(UI만 제거).

**변경 파일 후보 / 영향도**
- [src/app/components/RightPanel.tsx](src/app/components/RightPanel.tsx): 탭 정의/aria-controls/tabpanel 정리 (Medium)
- [src/app/AppShell.tsx](src/app/AppShell.tsx): rightPanelTab 상태 타입/초기값 정리 (Medium)
- (유지 권장) [src/features/inventory/InventoryPanel.tsx](src/features/inventory/InventoryPanel.tsx): Phase 2에서는 삭제하지 않음 (Low)
- (간접) [src/features/settings/components/tabs/ShortcutsTab.tsx](src/features/settings/components/tabs/ShortcutsTab.tsx): rightPanel 토글 단축키는 유지 (Low)

**리스크/주의점**
- `activeTab` 타입이 `'shop' | 'inventory'`로 묶여 있어 컴파일 오류 또는 불필요 상태가 생기기 쉬움.
- tablist/tabpanel의 접근성 속성(aria-controls/id)이 탭 제거 후 정합성이 깨지지 않아야 함.

**롤백 전략**
- “가방 탭/패널” 렌더 블록만 복구하면 즉시 되돌림.
- 안정성을 최우선으로 하면 Phase 2에서는 `InventoryPanel`/gameState 계산 코드를 삭제하지 않고 미사용 상태로 둔다.

---

### Phase 3 — (4) 임시스케줄 ‘주간’에 시간별 구분선 추가
**What (목표/범위)**
- WeeklyScheduleView에서 시간별(START_HOUR~END_HOUR) 가로 구분선을 추가해 가독성 개선.
- 드래그&드롭/hover preview 동작을 방해하지 않아야 함.

**변경 파일 후보 / 영향도**
- [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx): DayColumn 배경/오버레이 또는 반복 div 라인 추가 (Low~Medium)

**구현 가이드(아키텍처 관점)**
- 포인터 이벤트 방지: 구분선 레이어는 `pointer-events: none` (또는 Tailwind `pointer-events-none`) 필수.
- stacking 충돌 회피: TaskBlock(absolute) / 현재시간선(있다면)보다 아래 z-index.
- 성능: 라인을 “시간 수(대략 19개)” 수준 DOM으로 제한.
- 색상: `border-[var(--color-border)]/…` 등 기존 토큰만 사용(새 rgba 하드코딩 금지).

**롤백 전략**
- 구분선 레이어(한 블록)만 삭제/되돌리면 완료.

---

### Phase 4 — (3) 임시스케줄 ‘월간’ 달력 UI 깨짐(삐뚤어짐) 수정
**What (목표/범위)**
- 월간 캘린더에서 요일 헤더와 날짜 그리드의 컬럼 폭이 어긋나 ‘삐뚤어져’ 보이는 문제를 제거.
- 팝오버/hover 위치 계산 로직은 가능하면 그대로 유지.

**변경 파일 후보 / 영향도**
- [src/features/tempSchedule/components/MonthlyScheduleView.tsx](src/features/tempSchedule/components/MonthlyScheduleView.tsx): 헤더/바디 레이아웃 구성(추천: 동일 grid 템플릿 공유) (Medium)
- (간접) [src/features/tempSchedule/TempScheduleModal.tsx](src/features/tempSchedule/TempScheduleModal.tsx): 컨테이너 overflow/scrollbar 유무에 따라 재현성이 달라질 수 있어 확인 필요 (Low)

**구현 가이드(아키텍처 관점)**
- 원인 가정(가장 흔한 케이스):
  - 헤더와 바디가 각각 flex 레이아웃으로 계산되어 scrollbar 유무/1px border 누적로 폭이 달라짐.
- 권장 방향:
  - 헤더(요일)와 바디(날짜 cells)를 동일한 `grid-template-columns: repeat(7, minmax(0, 1fr))` 기반으로 맞춘다.
  - border 누적 대신 `gap-px` + 배경색(토큰)로 그리드를 구성하는 방식도 회귀가 적음(단, 색상 토큰만 사용).

**롤백 전략**
- MonthlyScheduleView 내부 레이아웃 변경만 되돌리면 복구.
- 팝오버/업무 로직(shouldShowOnDate 등)은 건드리지 않는 것을 원칙으로 롤백 비용 최소.

---

### Phase 5 — (2) 목표관리에서 ‘오늘 목표’ 전부 삭제(장기목표 유지)
> Highest risk. “오늘 목표”가 UI 탭만 의미하는지, 목표 기능(선택/연결/진행률) 전체를 의미하는지에 따라 영향 범위가 급변.

#### Option A: “UI만 제거”(권장 기본)
**What**
- GoalsModal에서 ‘오늘 목표’ 탭과 관련 UI(GoalPanel/GoalModal 진입)를 제거.
- 장기 목표(WeeklyGoalPanel/WeeklyGoalModal)는 그대로 유지.
- Task/Timeline 등 다른 화면의 `goalId` 선택/표시는 유지(목표 기능은 살아있음).

**변경 파일 후보 / 영향도**
- [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx): 탭 타입/초기 탭/ESC 스택 닫기 로직 정리 (High)
- (유지 권장) [src/features/goals/GoalPanel.tsx](src/features/goals/GoalPanel.tsx), [src/features/goals/GoalModal.tsx](src/features/goals/GoalModal.tsx): Phase 5에서는 삭제하지 않음 (Low)

**Pros**
- 회귀 위험 최소: store/service/event chain(GoalStore, task completion pipeline, subscribers)을 건드리지 않음.
- 롤백이 매우 쉬움(GoalsModal UI만 되돌리면 됨).

**Cons**
- 사용자가 기존 “오늘 목표”를 더 이상 관리할 수 없게 보이는데, 다른 화면(TaskModal 등)에서 목표 연결이 남아있으면 혼란 가능.
- ‘오늘 목표’ 데이터가 남아있고 진행률 업데이트도 계속될 수 있어 “보이지 않는 기능”이 됨.

**롤백 전략**
- GoalsModal에 daily 탭/GoalPanel 렌더 블록만 복구하면 즉시 복구.

#### Option B: “goal 선택/연결까지 제거”(고위험)
**What**
- GoalsModal에서 오늘 목표 UI 제거 + Task 생성/편집/표시에서 goal 연결 UI까지 제거.
- 단, 데이터 마이그레이션을 피하기 위해 기존 task.goalId는 유지할지(숨김) 또는 null로 정리할지 정책 결정이 필요.

**변경 파일 후보 / 영향도**
- [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) (High)
- Task 생성/편집 목표 선택 UI (예: Critic 언급) [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx) (High)
- 목표 표시가 있는 타임라인/뷰: [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx) 및 관련 훅 (Medium~High)
- 연쇄 영향 가능(주의): `dailyDataStore`의 goal progress 재계산 호출, `goalSubscriber` 이벤트 체인 등은 ‘UI만’ 범위를 넘어설 수 있음.

**Pros**
- UX 일관성: 사용자 관점에서 “오늘 목표 기능이 정말로 사라짐”.
- 목표 관련 혼란/부채가 줄어듦(사용 경로 제거).

**Cons**
- 사실상 “기능 제거”에 가까워짐: renderer 내부라도 store/서비스/핸들러 체인까지 영향이 번질 수 있음.
- task completion pipeline/goal progress update 등 숨은 의존성이 많아 회귀 위험이 급상승.
- 롤백이 어려움(다수 표면 변경 필요).

**롤백 전략(필수 전제)**
- Phase 5를 더 쪼개서(5A: GoalsModal만, 5B: TaskModal에서 선택 UI 제거, 5C: Timeline 표시 제거) 단계별 revert가 가능하게 해야 함.
- 데이터는 건드리지 않는 방향(기존 goalId 유지)으로 시작하면 되돌리기가 비교적 쉬움.

---

## Verdict
APPROVED_WITH_CHANGES
- Phase 1~4는 UI 표면/레이아웃 중심으로 국소 변경이므로 승인.
- Phase 5는 범위가 불명확하므로 **Option A(UI만 제거)** 를 기본 권고.
- Option B(연결까지 제거)는 ‘프론트/UI만’이라는 문구를 넘어 실질적 기능 제거가 되기 쉬워, 제품 범위 확정 후 별도 리스크 리뷰가 필요.
