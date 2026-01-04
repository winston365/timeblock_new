# Proposal: Weekly Goals UI Enhancements (ADHD-friendly)

> NOTE: This proposal has been superseded by the final Now/Next/Later set:
> - agent-output/planning/016-long-term-goals-ux-final-now-next-later.md

## Plan Header
- Plan ID: proposal-2025-12-23-weekly-goals-ui-enhancements
- Target Release: **1.0.166 (제안)**
  - Note: 현재 `package.json`이 1.0.164이고, 기존 계획 문서에서 1.0.165가 이미 제안된 바 있어(중복 가능성) **다음 patch 버전**을 임시로 1.0.166으로 잡았습니다. 실제 타겟은 릴리즈 운영 상황에 따라 조정이 필요합니다.
- Epic Alignment: “주간 장기목표(Weekly Goals)를 더 빠르게 이해하고, 뒤처짐을 부드럽게 회복하며, 진행을 안전하게 기록해 꾸준함을 유지(특히 ADHD 친화)한다.”
- Status: Proposed

## Changelog
- 2025-12-23: Initial proposal drafted from analyst findings (weekly goals modal/panel/cards, catch-up alert, store).

## References
- Analyst Findings: [agent-output/analysis/012-long-term-goals-ui-addons-analysis.md](../analysis/012-long-term-goals-ui-addons-analysis.md)
- UX/Engineering guardrails (요약): localStorage 금지(theme 예외), defaults.ts 단일 출처, optional chaining 권장, 모달은 배경 클릭 닫기 금지 + ESC 닫기.

---

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want 주간 목표를 “오늘 무엇을 하면 되는지” 즉시 이해하고, 뒤처졌을 때 죄책감 대신 구체적인 회복 플랜을 안내받으며, 실수 없이(undo/안전장치) 진행을 기록해서, so that 목표가 부담이 아니라 실행을 돕는 가벼운 안내판이 된다.

## UX Goals and ADHD-friendly Principles
1) **즉시성**: 오늘 해야 할 행동이 5초 안에 보인다(해석/계산 필요 최소화).
2) **마찰 최소화**: 기록 입력은 1~2번의 조작으로 끝난다(키보드/마우스 모두).
3) **진행의 안전감**: 실수로 눌렀을 때 되돌릴 수 있고(Undo), 파괴적 행동(삭제)은 명확히 구분된다.
4) **낙인 없는 회복**: “뒤처짐”을 경고로만 전달하지 않고, 선택 가능한 다음 행동(오늘만회/분할/스누즈)을 제공한다.
5) **점진적 공개**: 기본은 단순(핵심 1~3개 목표), 필요 시 상세(설명/히스토리/분석)로 확장.
6) **인지부하 절감**: 색상만으로 의미를 전달하지 않고(텍스트 배지/툴팁), 수치/단위를 일관되게 표시한다.

## Scope / Constraints
- Renderer(UI)만: **No backend/Supabase/Electron IPC**.
- 기존 패턴 유지:
  - Modal UX: **배경 클릭 닫기 금지**, **ESC는 항상 닫기**(top modal만).
  - Repository pattern 유지(영속화는 repository 경유; 직접 Dexie 호출 지양).
  - localStorage 금지(theme 예외만).
- 기존 화면 구조(GoalsModal → WeeklyGoalPanel → WeeklyGoalCard, CatchUpAlertModal)는 유지하되, “보조 UI(설명/스낵바/인라인 배지)” 중심으로 확장.

## Non-goals (명시)
- 작업/타임블록과 목표의 자동 연동(예: task→goal 자동 집계, time tracking 기반 목표 충족) — 별도 에픽.
- DB 스키마 마이그레이션이 필요한 대규모 도메인 변경(예: 목표를 다단계 엔티티로 분해).

---

## Prioritized Enhancements (Now / Next / Later)

### NOW (즉시 가치, 위험 낮음)
1) Catch-up Alert 2.0: **스누즈/다시보기/인라인 요약 + 설명 강화**
2) WeeklyGoalCard 이해도 강화: **텍스트 배지/툴팁으로 ‘오늘 목표량/만회 기준’ 설명**
3) 실수 방지 안전장치: **진행도 변경 Undo + 삭제 Undo/보호**
4) 기록 마찰 제거: **Quick “Log Session” 오버레이(숫자 입력/프리셋/키보드 친화)**

### NEXT (체감 개선 크지만 조합 필요)
5) 목표 생성 가이드: **템플릿/프리셋 + ADHD-friendly 스코핑(너무 큰 목표 방지)**
6) 패널 상단 요약: **오늘 집중 Top 1~3 + 주간 진행 요약(히스토리로 도망가지 않기)**
7) 히스토리 접근성: **모달 깊이 감소(요약 카드 인라인) + 트렌드 표시**

### LATER (도메인 확장/합의 필요)
8) 목표 쪼개기: **마일스톤/체크포인트(주간 목표를 작은 단계로)**
9) 미세 축하/강화: **오늘 목표 달성 시 부드러운 피드백(과잉 자극 없이)**

---

# Item Specs

## 1) Catch-up Alert 2.0 (Priority: NOW)

### User Story
As a 사용자, I want 뒤처짐 알림이 “한 번 띄우고 끝”이 아니라, 오늘 일정/컨디션에 맞게 **스누즈**하거나 **나중에 다시 확인**할 수 있어서, so that 알림이 부담이 아니라 도움이 된다.

### UX Spec (Interaction + States)
- Entry points
  - 앱 시작 시 기존처럼 자동 노출(조건 충족 시)
  - GoalsModal/WeeklyGoalPanel 상단에 “Behind goals” 인라인 요약 배너(클릭 시 모달 열기)
- Interaction
  - 모달에 3개 액션 제공:
    1) **지금 보기(유지)**: 기존 리스트 그대로 표시
    2) **스누즈 2시간**: 오늘 내에서 다시 띄움
    3) **오늘은 닫기**: 기존 하루 1회 규칙 유지
  - 모달 내부에서 각 목표에 “오늘 해야 할 양”을 1줄로 요약(예: “오늘 +3 하면 안전 구간”)하고, 상세는 펼침.
- States
  - Loading: goals 로딩 중에는 판단하지 않음(현재 동작 유지)
  - Empty: goals가 없으면 표시 안 함(현재 동작 유지)
  - Behind: behind goals가 1개 이상이면 배너/모달 후보
  - Snoozed: snooze 기간 내에는 자동 팝업 금지, 배너는 유지(사용자 제어)
- Accessibility/Keyboard
  - ESC로 닫기, 배경 클릭 닫기 금지
  - 버튼 포커스 순서 명확히(닫기/스누즈/오늘은 닫기)

### Minimal Data/State Needs
- Existing
  - `useWeeklyGoalStore`: `goals`, `loading`, `getTodayTarget`
  - `systemRepository`:
    - `SYSTEM_KEYS.CATCH_UP_ALERT_SHOWN_DATE`(이미 사용)
- Proposed (systemRepository 키 추가; UI-only persistence)
  - `SYSTEM_KEYS.CATCH_UP_ALERT_SNOOZE_UNTIL` (ISO datetime string)
  - `SYSTEM_KEYS.CATCH_UP_ALERT_LAST_SEEN_AT` (optional, 분석/튜닝용)
- No new domain schema required.

### Acceptance Criteria
- 뒤처진 목표가 있고 snooze가 아닌 경우: 앱 시작 후 1초 내 모달이 열린다.
- “스누즈 2시간” 선택 시: 2시간 내 앱 재시작/리렌더에도 자동 모달이 다시 뜨지 않는다.
- “오늘은 닫기” 선택 시: 같은 날짜에는 더 이상 자동 모달이 뜨지 않는다(기존 규칙 유지).
- GoalsModal/WeeklyGoalPanel에서 behind 요약 배너로 언제든 모달을 수동 재오픈할 수 있다.

---

## 2) WeeklyGoalCard 이해도 강화 (Priority: NOW)

### User Story
As a 사용자, I want 카드에서 “왜 경고인지/오늘 얼마를 해야 안전인지”를 바로 이해해서, so that 숫자와 색에 압도되지 않는다.

### UX Spec (Interaction + States)
- Card UI
  - 색상(severity) + **텍스트 배지**를 함께 표기(예: Safe / Warning / Danger)
  - “오늘 목표량”을 명시적으로 표시(예: `Today: 3`)
  - `i` 아이콘/툴팁으로 설명 제공:
    - “오늘 목표량 = (남은 목표량 ÷ 남은 일수) 올림” 등 간단한 문장
    - “Warning/Danger 기준”도 짧게(정책 변경은 아님, 설명만)
- Interaction
  - 툴팁은 hover + keyboard focus 모두 지원
  - 툴팁은 화면을 가리지 않는 작은 레이어(모달 아님)
- States
  - 목표 단위(unit) 없는 목표도 자연스럽게(예: “회/분/페이지” 등)

### Minimal Data/State Needs
- Existing 계산 함수 유지
  - `getDailyTargetForToday(target, currentProgress)` 등
- New state not required (pure UI enhancement)

### Acceptance Criteria
- 색상만 보지 않아도 상태를 이해할 수 있다(텍스트 배지 존재).
- 카드에서 “오늘 해야 할 양”이 항상 표시된다(목표가 0/완료인 경우는 예외 처리).
- 툴팁은 키보드로 접근 가능하고 ESC로 닫기 동작을 방해하지 않는다.

---

## 3) 실수 방지: 진행도 Undo + 삭제 보호 (Priority: NOW)

### User Story
As a 사용자, I want 실수로 +/−를 눌러도 되돌릴 수 있고, 목표 삭제는 안전하게 처리되어서, so that 목표 관리가 무섭지 않다.

### UX Spec (Interaction + States)
- Progress Undo
  - 각 카드에서 진행 변경(+, −, 직접 입력) 후 하단에 **snackbar/toast 스타일 Undo** 노출(예: 5~8초)
  - Undo는 “마지막 변경 1회”만 지원(복잡도/리스크 최소화)
- Delete protection
  - 삭제 버튼은 유지하되, 삭제 직후에도 동일한 Undo UI 제공(가능하면)
  - 파괴적 버튼 스타일(색/라벨)로 구분
- States
  - 저장 실패 시: 변경을 롤백하고 “저장 실패”를 명확히 표시

### Minimal Data/State Needs
- Existing
  - `useWeeklyGoalStore.updateProgress` / `setProgress` / `deleteGoal`
- Proposed additions (Zustand store에 **UI 전용** 상태)
  - `lastMutation?: { type: 'progress' | 'delete'; goalId: string; previousGoalSnapshot?: WeeklyGoal; previousProgress?: number; appliedAt: number }`
  - `undoLastMutation: () => Promise<void>`
  - 주의: delete undo가 영속화까지 포함하려면 repository에 “복원”이 필요할 수 있음. NOW에서는 **progress undo를 우선**으로 하고, delete undo는 NEXT로 내려도 됨(아래 OPEN QUESTION 참고).

### Acceptance Criteria
- 사용자가 진행도를 변경한 뒤 8초 내 Undo를 누르면 변경 전 값으로 복구된다.
- Undo는 한 번만 가능(연속 히스토리 스택 없음).
- 저장 실패 시 유령 값이 남지 않고, UI는 이전 상태로 되돌아온다.

---

## 4) Quick “Log Session” 오버레이 (Priority: NOW)

### User Story
As a 사용자, I want 매번 수치를 계산해서 입력하지 않고, “이번에 한 만큼”을 빠르게 기록해서, so that 목표 기록이 귀찮지 않다.

### UX Spec (Interaction + States)
- Entry
  - WeeklyGoalCard에 “기록하기” 버튼(또는 카드 클릭 메뉴) 추가
- Interaction
  - 작은 오버레이(모달이 아니라 카드 근처 popover 형태)에서:
    - 숫자 입력(기본 포커스)
    - 프리셋 버튼(예: +1, +5, +10 / 단위 기반 기본값)
    - Enter=저장, ESC=닫기
  - 저장 시 즉시 진행도 반영(기존 updateProgress 사용)
- States
  - 입력값 검증: 음수/NaN 방지, 0은 no-op 처리
  - 로딩 중에는 버튼 disabled + 스피너

### Minimal Data/State Needs
- UI-only state
  - 카드별 `isLogPopoverOpen`, `draftDelta`
  - 전역 store 변경 불필요(컴포넌트 로컬로 충분)

### Acceptance Criteria
- “기록하기”를 누르면 입력에 자동 포커스가 간다.
- Enter를 누르면 진행도가 업데이트되고, 오버레이가 닫힌다.
- ESC를 누르면 입력이 취소되고, 오버레이가 닫힌다.

---

## 5) 목표 생성 가이드: 템플릿/프리셋 + 스코핑 (Priority: NEXT)

### User Story
As a 사용자, I want 목표를 만들 때 추천 템플릿과 적정 목표량 가이드를 받아서, so that 처음부터 무리한 목표를 세우지 않는다.

### UX Spec (Interaction + States)
- WeeklyGoalModal(추가/수정) 상단에 템플릿 영역
  - 예: 공부(시간/페이지), 운동(세트/분), 건강(물/걸음)
- 템플릿 선택 시
  - 목표 이름/단위/권장 주간 목표량이 채워짐
  - “너무 큰 목표” 경고(예: 남은 일수 기준 오늘 목표량이 과도하면 안내)

### Minimal Data/State Needs
- No persistence required
  - 템플릿 목록은 상수(기존 defaults.ts 패턴 준수)로 관리
- Optional
  - 마지막 사용 템플릿을 systemRepository에 저장(선호도)

### Acceptance Criteria
- 템플릿을 선택하면 입력 필드가 즉시 채워진다.
- 사용자가 값을 수정해도 템플릿에 잠기지 않는다(자유 편집).

---

## 6) 패널 상단 요약: 오늘 집중 Top 1~3 (Priority: NEXT)

### User Story
As a 사용자, I want GoalsModal을 열자마자 “오늘 우선순위”가 보여서, so that 선택 피로가 줄어든다.

### UX Spec (Interaction + States)
- WeeklyGoalPanel 상단에 요약 카드
  - Behind goals 수 / 오늘 목표량 합 / 완료까지 남은 양
  - “Today Focus”로 Top 1~3 목표(정렬 기준: behind severity, remaining, user pin)
- Interaction
  - 각 항목 클릭 시 해당 카드로 스크롤/하이라이트

### Minimal Data/State Needs
- Optional store additions
  - `pinnedGoalIds?: string[]` (systemRepository에 저장하면 더 좋지만, NEXT 단계에서 결정)
- 대부분은 계산으로 가능(현재 goals 기반)

### Acceptance Criteria
- 목표가 많아도 Top 1~3가 항상 상단에 노출된다.
- 클릭 시 해당 목표 카드가 화면에 보이도록 이동한다.

---

## 7) 히스토리 접근성: 인라인 요약 + 트렌드 (Priority: NEXT)

### User Story
As a 사용자, I want 과거 성과를 매번 모달을 열지 않고도 가볍게 확인해서, so that 동기부여를 잃지 않는다.

### UX Spec (Interaction + States)
- WeeklyGoalPanel에 “지난 주 요약” 미니 카드(현재는 history modal에 숨어 있음)
- Trend
  - 지난주 대비 평균 % 상승/하락을 화살표로 표기(텍스트 포함)

### Minimal Data/State Needs
- Existing
  - `WeeklyGoal.history`에 최근 주 기록 존재
- No new persistence required

### Acceptance Criteria
- GoalsModal에서 모달 추가 없이 지난 주 요약을 볼 수 있다.
- 트렌드 표시는 색상+텍스트로 이해 가능하다.

---

## 8) 마일스톤/체크포인트 (Priority: LATER)

### User Story
As a 사용자, I want 주간 목표를 더 작은 체크포인트로 나눠서, so that 큰 목표도 압박감 없이 진행할 수 있다.

### UX Spec (Interaction + States)
- WeeklyGoalCard 내 “체크포인트” 섹션(접힘 기본)
- 체크포인트는 단순 리스트(이름, 목표량, 완료 여부)

### Minimal Data/State Needs
- **REQUIRES ANALYSIS (도메인/저장 방식 합의 필요)**
  - `WeeklyGoal` 타입 확장(예: checkpoints)
  - weeklyGoalRepository 저장/마이그레이션 여부

### Acceptance Criteria
- 체크포인트는 기본 UI를 방해하지 않고, 펼치면 즉시 이해된다.

---

## 9) 미세 축하/강화 피드백 (Priority: LATER)

### User Story
As a 사용자, I want 오늘 목표량을 달성했을 때 과하지 않은 축하 피드백을 받아서, so that 꾸준함이 강화된다.

### UX Spec (Interaction + States)
- Trigger
  - “오늘 목표량 달성” 조건 충족 시 1회(스팸 방지)
- Feedback
  - 작은 배지/텍스트 + (선택) 아주 가벼운 애니메이션

### Minimal Data/State Needs
- systemRepository
  - `SYSTEM_KEYS.WEEKLY_GOAL_TODAY_CELEBRATED_DATE_BY_GOAL` 같은 키로 중복 방지(또는 in-memory로만)

### Acceptance Criteria
- 같은 목표에 대해 같은 날 반복 축하가 발생하지 않는다.
- 시각 자극이 과하지 않고, 끌 수 있는 옵션(설정)이 추후 추가 가능하다.

---

## OPEN QUESTION (승인 필요)
1) Target Release를 **1.0.165 vs 1.0.166** 중 무엇으로 맞출까요? (기존 다른 PR/계획과 충돌 가능)
2) Delete Undo를 NOW에 포함할까요, 아니면 progress undo만 먼저 할까요? (복원은 repo 지원이 필요할 수 있음)
3) Top 1~3 선정 기준: behind severity 우선 vs 사용자가 pin한 목표 우선, 어느 쪽이 기본값이어야 할까요?
4) Catch-up alert의 스누즈 기본값: 2시간이 적당할까요? (1h/3h 옵션)

---

## Version / Release Artifacts (Milestone)
- Objective: Target Release에 맞춘 버전/릴리즈 아티팩트 일치.
- Tasks:
  - `package.json` version을 Target Release로 bump.
  - CHANGELOG/릴리즈 노트 파일이 운영 중이라면(프로젝트 규칙 확인 후) 해당 파일 업데이트.
- Acceptance Criteria:
  - 버전 아티팩트가 Target Release와 일치.
