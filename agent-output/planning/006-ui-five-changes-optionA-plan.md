# UI 5개 변경 PR 단위 계획 (Option A 기본 + Option B 대안)

## Plan Header
- Plan ID: plan-2025-12-17-ui-5changes
- Target Release: **1.0.157 (제안)**
  - 근거: 현재 [package.json](package.json) 버전이 1.0.156이며, 요청 범위가 “프론트/UI만”의 점진적 표면 변경이므로 patch bump가 합리적.
  - **OPEN QUESTION (BLOCKING)**: 로드맵/릴리즈 목표 버전이 별도로 정해져 있나요? (예: 1.0.156 유지, 1.0.160 등)
- Epic Alignment: “UI 변경 5종(엔트리 제거 + TempSchedule 월/주간 가독성)” 단계적 롤아웃
- Status: Draft (User approved Value Statement)

### Changelog
| Date | Request | Summary |
|---|---|---|
| 2025-12-17 | Option A 기본 + Option B 대안, Phase 1~5 PR 계획 | Phase별 체크리스트/후보 파일/AC/테스트 추천 및 PR 스코프 가드 포함 |

## Value Statement and Business Objective
As a 사용자, I want to 불필요한 진입점/시각적 부담(오늘 목표 UI, 상단 XP바, 가방 탭)을 제거하고 임시스케줄(월/주간) 가독성을 개선해서, so that 오늘 해야 할 일에 더 빨리 집중하고 화면 인지 부하를 줄일 수 있다.

## Scope & Constraints (Hard)
- Frontend/Renderer UI만: **Backend/Supabase/Electron IPC 변경 금지**
- 디자인 시스템 토큰 유지: 새 색상/폰트/그림자 하드코딩 금지
- 모달 UX: 배경 클릭으로 닫기 금지, **ESC 닫기 유지**
- localStorage 금지(테마 예외만), defaults 하드코딩 금지(SETTING_DEFAULTS 단일 출처), optional chaining 안전

## Assumptions (User-provided)
- “TopToolbar XP바 제거”는 **바 UI만 제거**(숫자/다른 XP 이펙트는 유지 가능)
- “가방 탭 제거”는 **탭/진입 UI만 제거**(데이터/레포/스토어는 이번 단계에서 유지)

---

# Option A — 기본 PR 시퀀스 (오늘 목표 UI만 제거)

## PR 시퀀스 요약
- PR1 = Phase 1 (DailyXPBar UI 제거)
- PR2 = Phase 2 (가방 탭 진입 UI 제거)
- PR3 = Phase 3 (TempSchedule 주간 시간 구분선)
- PR4 = Phase 4 (TempSchedule 월간 삐뚤어짐 수정)
- PR5 = Phase 5 (GoalsModal에서 오늘 목표 UI 제거, 장기 목표 유지)

---

## Phase 1 — TopToolbar “오늘 하루 전체 XP바(DailyXPBar)” 제거

### PR 제목 (Conventional Commits)
- `feat(ui): remove daily XP bar from top toolbar`

### Scope Guard
- Renderer UI만 변경
- XP 숫자/기타 XP 이펙트 유지(바 UI만 제거)
- 새로운 상태 저장/feature flag/설정 추가 금지

### 체크리스트
- 변경 전
  - [ ] TopToolbar에 DailyXPBar가 렌더되는 위치 확인
  - [ ] 레이아웃(상단 높이/메인 그리드 시작점) 스냅샷/재현 환경 확보
- 변경 중
  - [ ] AppShell에서 DailyXPBar 렌더만 제거(컴포넌트 파일 삭제는 보류)
  - [ ] 스타일 토큰/클래스 재사용(새 하드코딩 금지)
- 변경 후
  - [ ] 상단 영역 높이 변화로 인한 스크롤/레이아웃 깨짐 없음
  - [ ] XP 숫자/관련 이펙트 동작 유지

### 파일·컴포넌트 후보 경로
- [src/app/AppShell.tsx](src/app/AppShell.tsx)
- [src/app/components/DailyXPBar.tsx](src/app/components/DailyXPBar.tsx) (PR1에서는 유지 권장)

### 간단 AC
- DailyXPBar UI가 상단에서 더 이상 보이지 않는다.
- XP 숫자/다른 XP UI 요소는 유지된다.

### Vitest 추천
- 권장 커맨드: `npm run test`
- 빠른 스모크(선택): `npx vitest run tests/time-block-visibility.test.ts tests/timeblock-visibility.test.ts`

---

## Phase 2 — 우측 사이드바 “가방(인벤토리) 탭” 진입 UI 제거

### PR 제목 (Conventional Commits)
- `feat(ui): remove inventory tab entry from right panel`

### Scope Guard
- 탭/진입 UI만 제거(Inventory 데이터/레포/스토어 유지)
- 탭 접근성(role/tablist/aria-controls) 정합성 유지
- RightPanel/AppShell 간 tab 타입/props 일치 보장

### 체크리스트
- 변경 전
  - [ ] RightPanel 탭 구조(탭 리스트/tabpanel id/aria-controls) 확인
  - [ ] AppShell의 rightPanelTab 상태/초기값/타입 유니온 확인
- 변경 중
  - [ ] RightPanel에서 inventory 탭 버튼 및 해당 패널 렌더 경로 제거
  - [ ] AppShell의 rightPanelTab 타입/초기값에서 inventory 제거(컴파일 깨짐 방지)
  - [ ] 미사용 컴포넌트/파일 삭제는 보류(이번 단계 목표는 “진입 UI 제거”)
- 변경 후
  - [ ] 우측 패널 탭 전환이 정상 동작(남은 탭만)
  - [ ] aria-controls/id 불일치/콘솔 경고 없음

### 파일·컴포넌트 후보 경로
- [src/app/components/RightPanel.tsx](src/app/components/RightPanel.tsx)
- [src/app/AppShell.tsx](src/app/AppShell.tsx)
- [src/features/inventory/InventoryPanel.tsx](src/features/inventory/InventoryPanel.tsx) (PR2에서는 유지 권장)

### 간단 AC
- 우측 패널에서 “가방” 탭 버튼/진입 UI가 보이지 않는다.
- 다른 탭 전환/렌더는 정상이며 타입/런타임 오류가 없다.

### Vitest 추천
- 권장 커맨드: `npm run test`
- UI와 직접 연관 테스트가 없으므로(가능성), 최소 스모크로 전체 실행 권장

---

## Phase 3 — TempSchedule 주간 뷰 시간별 구분선 추가

### PR 제목 (Conventional Commits)
- `feat(ui): add hourly grid lines to temp schedule weekly view`

### Scope Guard
- 시각적 배경 요소만 추가(드래그&드롭/hover preview 상호작용 방해 금지)
- 새 색상/불투명도 하드코딩 금지(기존 토큰/클래스만)

### 체크리스트
- 변경 전
  - [ ] 주간 뷰에서 시간 레일/블록 배치 레이어 구조 확인
  - [ ] 드래그&드롭/hover preview가 어떤 DOM 레이어를 기준으로 동작하는지 확인
- 변경 중
  - [ ] 구분선 레이어는 `pointer-events: none`을 보장
  - [ ] z-index 충돌 방지(블록/현재시간선보다 아래)
  - [ ] 라인 DOM 수를 시간 슬롯 수준으로 제한(성능 과다 비용 방지)
- 변경 후
  - [ ] 드래그&드롭/hover preview 동작 유지
  - [ ] 스크롤 시 성능 저하 체감 없음

### 파일·컴포넌트 후보 경로
- [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)

### 간단 AC
- 주간 뷰에 시간별 구분선이 보인다.
- 구분선 때문에 드래그/호버가 막히지 않는다.

### Vitest 추천
- 권장 커맨드: `npm run test`
- 빠른 스모크(선택): `npx vitest run tests/store-utils.test.ts tests/event-bus.test.ts`

---

## Phase 4 — TempSchedule 월간 달력 UI 삐뚤어짐 수정

### PR 제목 (Conventional Commits)
- `fix(ui): align temp schedule monthly grid header and body`

### Scope Guard
- 레이아웃 정렬/가독성만(로직/데이터 모델 변경 금지)
- 팝오버/hover 위치 계산 로직은 가능하면 유지(회귀 최소화)

### 체크리스트
- 변경 전
  - [ ] 삐뚤어짐 재현 조건 정리(스크롤바 유무/줌/해상도)
  - [ ] 요일 헤더와 날짜 그리드가 동일한 컬럼 폭을 쓰는지 확인
- 변경 중
  - [ ] 헤더/바디가 동일한 레이아웃 시스템(grid 등)으로 정렬되도록 조정
  - [ ] border 누적/scrollbar 폭 차이로 인한 1px 오프셋 재발 방지
- 변경 후
  - [ ] 헤더-바디 컬럼 정렬이 일관적이며 “삐뚤어짐”이 재현되지 않음
  - [ ] hover popover/일자 선택 UX가 기존과 동일하게 동작

### 파일·컴포넌트 후보 경로
- [src/features/tempSchedule/components/MonthlyScheduleView.tsx](src/features/tempSchedule/components/MonthlyScheduleView.tsx)
- (간접 확인) [src/features/tempSchedule/TempScheduleModal.tsx](src/features/tempSchedule/TempScheduleModal.tsx)

### 간단 AC
- 월간 뷰에서 요일 헤더와 날짜 그리드가 정렬된다.
- 기존 상호작용(hover/선택)이 유지된다.

### Vitest 추천
- 권장 커맨드: `npm run test`

---

## Phase 5 (Option A) — GoalsModal에서 “오늘 목표” UI만 제거 (장기 목표 유지)

### PR 제목 (Conventional Commits)
- `feat(ui): remove today goals tab from goals modal`

### Scope Guard
- GoalsModal의 탭/진입 UI만 제거
- 목표 데이터/스토어/레포/이벤트 체인 유지(이번 단계에서 변경 금지)
- 모달 ESC 닫기 유지, 배경 클릭 닫기 금지 유지

### 체크리스트
- 변경 전
  - [ ] GoalsModal 탭 구성(오늘/장기) 및 초기 탭 로직 확인
  - [ ] ESC 닫기 훅/키 핸들링이 어디서 적용되는지 확인
- 변경 중
  - [ ] 오늘 목표 탭 및 관련 렌더 경로 제거
  - [ ] 탭 유니온 타입/초기값/aria-controls 정합성 유지
  - [ ] “장기 목표” 탭이 기본 진입이 되도록 조정
  - [ ] 오늘 목표 관련 컴포넌트 파일 삭제는 보류(미사용화)
- 변경 후
  - [ ] GoalsModal에서 오늘 목표 탭이 보이지 않는다.
  - [ ] 장기 목표 탭은 기존과 동일하게 동작한다.
  - [ ] ESC로 모달이 닫히며, 배경 클릭으로는 닫히지 않는다.

### 파일·컴포넌트 후보 경로
- [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx)
- (삭제 보류) [src/features/goals/GoalPanel.tsx](src/features/goals/GoalPanel.tsx)
- (삭제 보류) [src/features/goals/GoalModal.tsx](src/features/goals/GoalModal.tsx)

### 간단 AC
- GoalsModal에 오늘 목표 UI(탭/진입)가 없다.
- 장기 목표 UI는 유지된다.
- 모달 닫기 UX 규칙(ESC, 배경 클릭 금지)이 유지된다.

### Vitest 추천
- 권장 커맨드: `npm run test`
- 회귀 방지 스모크(선택):
  - `npx vitest run tests/task-completion.test.ts tests/task-completion-handlers.test.ts`
  - (목표 연관 로직이 간접 영향 가능하므로) `npx vitest run tests/unified-task-service.test.ts`

---

# Option B — 대안 PR 시퀀스 (오늘 목표 UI 제거 + “goal 연결/표시”까지 단계적으로 숨김)

> 주의: Option B는 ‘프론트/UI만’ 범위 안에서도 실제 체감상 “기능 제거”에 가까워져 회귀 리스크가 커집니다. 따라서 **Phase 5를 PR 단위로 더 쪼개서** 롤백 가능성을 높이는 시퀀스로 제시합니다.

## PR 시퀀스 요약
- PR1~PR4: Option A와 동일(Phase 1~4)
- Phase 5를 3개 PR로 분할 권장
  - PR5A: GoalsModal 오늘 목표 탭 제거(Option A의 Phase 5와 동일)
  - PR5B: 작업 생성/편집 UI에서 goal 연결 UI 숨김(데이터는 유지)
  - PR5C: 스케줄/타임라인 등 화면에서 goal 표시 UI 숨김(데이터는 유지)

### PR5A 제목
- `feat(ui): remove today goals tab from goals modal`

### PR5B 제목
- `feat(ui): hide goal linkage controls in task editor`

### PR5C 제목
- `feat(ui): hide goal indicators in schedule views`

### Option B 공통 Scope Guard
- **데이터 마이그레이션 금지**(goalId 값은 유지 가능; UI만 숨김)
- store/repository/서비스/이벤트 체인 변경 금지(“표시/진입 UI”만)
- optional chaining/기본값 단일 출처/모달 ESC 규칙 준수

### PR5B 후보 경로
- [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx) (Critic 언급)

### PR5C 후보 경로
- [src/features/schedule/TimelineView/TimelineView.tsx](src/features/schedule/TimelineView/TimelineView.tsx) (Critic 언급)

### Option B Vitest 추천
- PR5A/5B/5C 각각: `npm run test`
- 특히 PR5B/5C 후 스모크(선택):
  - `npx vitest run tests/unified-task-service.test.ts`
  - `npx vitest run tests/task-completion.test.ts tests/task-completion-handlers.test.ts`

---

## Testing Strategy (High-level)
- Vitest 기반의 회귀 탐지: 단계별(각 PR) `npm run test`, 최종 머지 전 `npm run test:coverage` 선택
- 정적 검사: 각 PR에서 `npm run lint` 권장(규칙 위반 예방)

---

## Risks & Rollback
- 가장 큰 리스크: Goals(오늘 목표) 관련(특히 Option B). 탭/표시 제거가 타입/aria 정합성 및 간접 의존성에 영향을 줄 수 있음.
- 롤백 원칙: “변경 1개 = PR 1개”를 유지하여 `git revert`로 즉시 복구 가능하게 설계.

---

## Version Management Milestone (Final)
- 목표: 타깃 릴리즈 버전(OPEN QUESTION 확정 후)에 맞춰 버전/릴리즈 아티팩트 정합성 확보
- 작업(예시)
  - `npm run bump` 또는 프로젝트 정책에 맞는 방식으로 patch bump
  - `package.json` 버전 반영 확인
  - 릴리즈 노트/변경 요약은 레포 관례에 맞춰 최소 1곳에 기록(현 레포는 CHANGELOG 부재 → README 또는 릴리즈 시스템을 따름)

---

## Owner / Dependencies
- Owner: Frontend
- Dependencies: 없음 (UI만)

## Approval Needed
- **OPEN QUESTION (BLOCKING)**: Target Release 버전(로드맵 기준)을 확인해 주세요.
- Option B 선택 시: “goal 연결/표시 UI까지 숨김”이 제품 범위로 승인되었는지 재확인 필요.
