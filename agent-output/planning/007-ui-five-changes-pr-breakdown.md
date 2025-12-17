# UI 5개 변경 — PR 단위 작업 분해(ADHD-friendly)

## Plan Header
- Plan ID: plan-2025-12-17-ui-5changes-pr-breakdown
- Target Release: 1.0.157 (기존 plan-2025-12-17-ui-5changes 제안과 동일)
- Epic Alignment: UI 변경 5종(상단 XP바 제거, 우측 인벤토리 탭 제거, TempSchedule 월/주간 가독성, GoalsModal 오늘 목표 UI 제거)
- Status: Draft

## Value Statement and Business Objective
As a 사용자, I want to 불필요한 진입점/시각적 부담(오늘 목표 UI, 상단 XP바, 가방 탭)을 제거하고 임시스케줄(월/주간) 가독성을 개선해서, so that 오늘 해야 할 일에 더 빨리 집중하고 화면 인지 부하를 줄일 수 있다.

## Scope / Constraints
- Frontend/Renderer UI만 (Backend/DB/IPC 구현 제외)
- localStorage 금지(테마 예외만), 기본값 하드코딩 금지(SETTING_DEFAULTS), optional chaining, 모달 ESC 닫기 및 배경 클릭 닫기 금지 규칙 준수
- PR은 “작게/되돌리기 쉽게”: 1 PR = 1 변화 축, revert로 원복 가능해야 함

## OPEN QUESTION (BLOCKING)
- “오늘 목표 전부 삭제”의 의미가 GoalsModal의 ‘오늘 목표 탭/진입 UI 제거’(Option A)인지, Task 편집/타임라인의 goal 연결·표시까지 포함(Option B)인지 확정 필요.
  - 본 문서는 기본값을 Option A로 둠(회귀 리스크 최소).

---

# PR 단위 분해(6~12개)

아래 PR들은 실패 시 영향 범위를 작게 유지하도록, ‘UI 엔트리 제거/레이아웃 조정’과 ‘정리(cleanup)’를 분리했습니다.

## PR#1 — TopToolbar: DailyXPBar(오늘 하루 XP바) 렌더 제거
- 목표: 상단 영역에서 DailyXPBar UI를 더 이상 표시하지 않음(수치/다른 XP 효과는 유지)
- 변경 범위(후보)
  - src/app/AppShell.tsx
  - (삭제 금지 권장) src/app/components/DailyXPBar.tsx (파일은 남겨두고 미사용화)
- 검증 방법
  - 테스트: npm test
  - 수동: 앱 실행 후 상단 XP바가 사라졌는지, 상단 텍스트 XP/기타 UI가 정상인지 확인
- 롤백 플랜: AppShell에서 DailyXPBar 렌더 블록만 되돌림(컴포넌트 파일 삭제가 없으므로 revert가 단순)

## PR#2 — RightPanel: 인벤토리(가방) 탭 진입 UI 제거(+ 탭 타입 정합성)
- 목표: 우측 패널 탭에서 “가방/인벤토리” 탭 버튼과 panel 렌더 경로를 제거하고, 탭 상태/타입 불일치(컴파일/런타임)를 함께 정리
- 변경 범위(후보)
  - src/app/components/RightPanel.tsx
  - src/app/AppShell.tsx
  - (삭제 금지 권장) src/features/inventory/InventoryPanel.tsx
- 검증 방법
  - 테스트: npm test
  - 수동: 우측 패널 탭 전환이 정상(남은 탭만), 콘솔에 aria-controls/id 경고가 없는지 확인
- 롤백 플랜: RightPanel의 탭 정의/렌더 블록과 AppShell 탭 타입 변경을 revert

## PR#3 — (옵션) RightPanel 부수효과 최소화: 인벤토리 뱃지/집계 의존성 정리
- 목표: “탭 UI 제거” 이후 남는 인벤토리 관련 집계/뱃지 계산 등 UI 의존 코드를 최소화(사용되지 않는 값/경고 제거). 기능 삭제가 아니라 UI 표면 회귀 리스크 감소가 목적
- 변경 범위(후보)
  - src/shared/stores/gameStateStore.ts (인벤토리 총합/뱃지 계산 등 UI 전용 의존이 있을 경우)
  - src/app/components/RightPanel.tsx (PR#2에 포함됐으면 생략 가능)
- 검증 방법
  - 테스트: npm test
  - 수동: 우측 패널/상단 뱃지 등이 남아있다면 정상 동작 확인(없다면 확인 생략)
- 롤백 플랜: 해당 계산/selector 변경만 revert

## PR#4 — TempSchedule(주간): 시간별 구분선 추가
- 목표: 주간 뷰에서 시간대 구분이 쉬워지도록 구분선을 추가하되, 드래그/호버 등 상호작용을 방해하지 않음
- 변경 범위(후보)
  - src/features/tempSchedule/components/WeeklyScheduleView.tsx
- 검증 방법
  - 테스트: npm test
  - 수동: 주간 뷰에서 구분선 표시 + 드래그/드롭/호버가 막히지 않는지 확인(pointer-events none 등)
- 롤백 플랜: 구분선 레이어(한 블록)만 revert

## PR#5 — TempSchedule(월간): 헤더-바디 그리드 정렬(삐뚤어짐) 수정
- 목표: 월간 캘린더에서 요일 헤더와 날짜 그리드의 컬럼 정렬을 일치시켜 ‘삐뚤어짐’을 제거
- 변경 범위(후보)
  - src/features/tempSchedule/components/MonthlyScheduleView.tsx
  - (간접 확인) src/features/tempSchedule/TempScheduleModal.tsx
- 검증 방법
  - 테스트: npm test
  - 수동: (1) 스크롤바 유무 (2) 윈도우 DPI/줌 (3) 리사이즈에서 헤더/바디 컬럼이 계속 맞는지 확인
- 롤백 플랜: MonthlyScheduleView 레이아웃 변경만 revert(로직/데이터 변경은 하지 않는 것을 전제)

## PR#6 — GoalsModal: “오늘 목표” 탭/진입 UI 제거(Option A 기본)
- 목표: GoalsModal에서 ‘오늘 목표’ 탭을 제거하고 장기 목표만 노출(모달 ESC 닫기/배경 클릭 금지 규칙 유지). 목표 데이터/스토어/핸들러 체인은 건드리지 않음
- 변경 범위(후보)
  - src/features/goals/GoalsModal.tsx
  - (삭제 금지 권장) src/features/goals/GoalPanel.tsx, src/features/goals/GoalModal.tsx
- 검증 방법
  - 테스트: npm test
  - 수동: GoalsModal에서 오늘 목표 탭이 보이지 않고, ESC로 닫히며, 배경 클릭으로 닫히지 않는지 확인
- 롤백 플랜: GoalsModal의 탭/렌더 변경만 revert

## PR#7 — (선택) 미사용 UI 컴포넌트 정리(파일 삭제는 별도 PR로 격리)
- 목표: PR#1~#6 이후 미사용이 된 import/코드 경로를 정리하되, “파일 삭제”는 별도 커밋으로 분리해서 실패 시 복구를 쉽게 함
- 변경 범위(후보)
  - src/app/components/DailyXPBar.tsx (삭제 또는 유지 결정)
  - src/features/inventory/InventoryPanel.tsx
  - src/features/goals/GoalPanel.tsx, src/features/goals/GoalModal.tsx
- 검증 방법
  - 테스트: npm test
  - 수동: (해당 없음) 빌드/실행 스모크
- 롤백 플랜: 삭제/정리 커밋만 revert(기능 PR들은 유지)

## PR#8 — 문서/릴리즈 아티팩트(버전/CHANGELOG) 업데이트
- 목표: 릴리즈 버전 정합성(예: 1.0.157) 및 변경 요약을 릴리즈 아티팩트에 반영
- 변경 범위(후보)
  - package.json
  - CHANGELOG(존재 시)
  - README.md (사용자-facing 변경 안내가 필요할 때만)
- 검증 방법
  - 테스트: npm test
  - 수동: 앱 실행 스모크(선택)
- 롤백 플랜: 버전/문서 변경만 revert

---

# PR 의존성 / 순서(권장)

## 병렬 가능(리스크 낮음)
- PR#1, PR#2, PR#4, PR#5는 서로 독립적이므로 병렬 진행 가능.

## 순서 제안(단계)
1) PR#1 + PR#2 (진입점/상단 정리)
2) PR#4 + PR#5 (TempSchedule 가독성)
3) PR#6 (GoalsModal 변경: 리스크 높아 마지막)
4) PR#3 (옵션: 인벤토리 부수효과 정리) — PR#2 이후 또는 PR#2와 함께
5) PR#7 (선택: 삭제/정리)
6) PR#8 (버전/릴리즈)

## DAG(텍스트)
- PR#1 ─┐
- PR#2 ─┼─> PR#6 ─> PR#7 ─> PR#8
- PR#4 ─┤
- PR#5 ─┘
- PR#3 depends on PR#2 (또는 PR#2에 흡수)
