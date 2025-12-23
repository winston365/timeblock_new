# Final Proposal: Long-term Goals UX (Weekly Goals) — Now / Next / Later (ADHD-friendly, Frontend-only)

## Plan Header
- Plan ID: plan-2025-12-23-long-term-goals-ux-final-now-next-later
- Target Release: **1.0.166 (assumption)**
  - Rationale: `package.json` is 1.0.164 and other active plans already propose 1.0.165; this plan targets the next patch to avoid collisions.
- Epic Alignment: “주간 장기목표(Weekly Goals)를 더 빠르게 이해하고, 뒤처짐을 부드럽게 회복하며, 진행을 안전하게 기록해 꾸준함을 유지(특히 ADHD 친화)한다.”
- Status: Final (Ready for Implementer)

## Changelog
- 2025-12-23: Created final Now/Next/Later set by incorporating Critic feedback (reduced cognitive load, no surprise modals, frontend-only strictness, open questions resolved with assumptions).
- 2025-12-23: Added “Final suggestion lists” section (10 features / 10 UI-UX / 5 quick wins) reflecting Critic 016: merge duplicates, focus ROI top set, add ADHD guardrails + micro-reward text, and make LATER deliverables explicit.

## References
- Proposal (prior): agent-output/planning/015-weekly-goals-ui-enhancements-proposal.md
- Critique: agent-output/critiques/015-weekly-goals-ui-enhancements-proposal-critique.md
- Analysis: agent-output/analysis/012-long-term-goals-ui-addons-analysis.md
- Architecture: agent-output/architecture/005-long-term-goals-frontend-architecture-findings.md

---

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want 주간 목표를 “오늘 무엇을 하면 되는지” 즉시 이해하고, 뒤처졌을 때 죄책감 대신 **예측 가능한 회복 안내**를 받으며, 실수 없이 **안전하게** 진행을 기록해서, so that 목표가 부담이 아니라 실행을 돕는 가벼운 안내판이 된다.

---

## Scope / Constraints (Strict)
- **Frontend-only (Renderer/UI) scope**
  - No Supabase changes, no Electron IPC changes, no backend-like expansion.
  - No domain 모델 확장(예: WeeklyGoal 타입/체크포인트 필드 추가) 및 스키마 마이그레이션.
- State 정책
  - localStorage 사용 금지(theme key만 예외).
  - 영속 상태는 `systemRepository`(Dexie systemState)만 사용.
- Modal UX 정책
  - 배경 클릭 닫기 금지.
  - ESC는 항상 닫기(최상단 레이어 기준).

---

## ADHD-friendly Guardrails (Explicit)
1) **No surprise modals**: 자동 모달은 “앱 시작 시 1회/일(조건 충족 시)”만 허용. Snooze 만료로 인해 **작업 중 갑자기** 모달이 뜨면 안 됨.
2) **Predictable interruptions**: snooze/dismiss는 “언제 다시 보일지”를 텍스트로 명확히 표기.
3) **Reduced cognitive load**: 카드에 새 UI를 추가하더라도 기본 뷰는 3개 정보까지만(상태 배지, Today target, 진행도). 상세는 툴팁/오버레이로 숨김.
4) **Progressive disclosure**: “기록하기(Log)”는 hover/focus 또는 overflow 메뉴로 노출(기본 상시 노출 금지).
5) **One-step safe action**: 진행도 변경은 Undo(마지막 1회) 제공. Delete Undo는 NOW에서 제외.

---

## Now / Next / Later (Final)

### NOW (Low risk, immediate value, no scope creep)
1) Catch-up Alert 2.0 — **배너 + snooze + dismiss**, 단 **snooze 만료 시 자동 모달 금지**
2) WeeklyGoalCard 이해도 강화 — **텍스트 배지 + Today target + 짧은 설명 툴팁**
3) Quick Log Session — 카드 근처 **popover 오버레이**(키보드 친화, ESC 스택 정합)
4) Progress Undo + Micro feedback — 진행 변경 후 **snackbar(Undo/“기록됨”)**

### NEXT (Nice UX, but optional state/complexity)
5) Panel 상단 “Today Focus Top 1~3” — 기본 정렬=behind severity, pin 기능은 다음 단계
6) Delete safety 개선 — **강한 시각적 위험 표시 + confirm copy 개선** (Undo는 여전히 제외)
7) Lightweight metrics (optional) — EventBus 기반 UX 이벤트 emit(운영 판단용)

### LATER (Design exploration only; no domain changes)
8) 템플릿/프리셋(생성 가이드) — UX 시안/프로토타입만
9) 체크포인트/마일스톤 — UX 시안/프로토타입만 (WeeklyGoal 타입 확장 없음)
10) 축하 피드백 확장 — 애니메이션/설정 옵션은 추후

---

## Final Suggestion Lists (Critic-reflected)

> Format: 한 줄 요약 + 2~3줄 상세(행동/조건/피드백) + 우선순위(P0/P1/P2) + 예상 구현 기간(0.5d/1-2d/3-5d/1-2w)

### 1) 추가기능 10개

1) [P0 | 1-2d] Catch-up: Behind 배너(인라인)로 “사용자 주도” 재오픈 제공
  행동: WeeklyGoalPanel 상단에 behind 요약 배너를 노출하고 클릭 시 Catch-up 모달을 연다.
  조건: behind goals ≥ 1일 때만 노출하며, 로딩 중에는 판단/표시하지 않는다.
  피드백: “뒤처짐”을 낙인 대신 안내 톤으로 표시(예: “회복 플랜 보기”).

2) [P0 | 1-2d] Catch-up: Snooze(기본 2h) 상태를 systemState에 저장
  행동: Snooze 선택 시 `SYSTEM_KEYS.CATCH_UP_ALERT_SNOOZE_UNTIL`을 저장하고 기간 동안 자동 모달을 차단한다.
  조건: 시간 비교는 ISO string 저장 + `Date.now()` 비교만 사용(시간대 변환 로직 금지).
  피드백: 배너에 “스누즈 종료: HH:MM”처럼 다음 노출 조건을 텍스트로 명시한다.

3) [P0 | 1-2d] Catch-up: 모달 3액션(View / Snooze / Dismiss-for-today) 확정
  행동: CatchUpAlertModal에 3개 액션을 제공하고 선택 결과를 즉시 반영한다.
  조건: Dismiss는 기존 “하루 1회 자동 노출” 규칙과 합치되게 동작한다.
  피드백: 각 액션 후 스낵바로 “적용됨”을 짧게 표시(자극 최소).

4) [P0 | 0.5d] WeeklyGoalCard: 텍스트 severity 배지(색상 보조) 추가
  행동: Safe/Warning/Danger를 색상+텍스트로 병기하여 색상 의존을 제거한다.
  조건: 카드 기본 뷰 정보량을 늘리지 않도록 배지는 짧은 라벨로 제한한다.
  피드백: 스크린리더를 위해 배지에 의미가 드러나는 aria-label을 제공한다.

5) [P0 | 0.5d] WeeklyGoalCard: Today target 라인(“오늘 해야 할 양”) 상시 표기
  행동: 카드에 Today: N(단위 포함)을 기본으로 표시해 즉시 행동을 제시한다.
  조건: 완료/0 목표 등 예외 케이스는 “오늘 목표 없음”처럼 오해 없는 문구로 처리한다.
  피드백: Today target이 바뀌는 순간(주간 리셋 등) 사용자가 혼란스럽지 않게 문구를 일관화한다.

6) [P1 | 0.5d] Today target 설명 툴팁(키보드/터치 접근성 포함)
  행동: “Today target이 왜 이 값인지”를 1~2문장으로 툴팁에 제공한다.
  조건: hover-only 금지(포커스/터치로도 열 수 있어야 함), ESC 동작을 방해하지 않는다.
  피드백: 설명은 계산식 대신 사용자 언어(“남은 기간에 맞춘 오늘 분량”)로 유지한다.

7) [P0 | 1-2d] Quick Log Session popover(프리셋 + Enter 저장 + ESC 취소)
  행동: 카드 근처 popover에서 숫자 입력(기본 포커스) + 프리셋(+1/+5/…)을 제공한다.
  조건: 음수/NaN 방지, 결과가 0 미만이면 0으로 clamp, 저장 중 중복 제출 방지.
  피드백: 저장 직후 “기록됨 ✓” 스낵바를 짧게 노출한다.

8) [P0 | 1-2d] Popover가 ESC 스택에 참여(GoalsModal과 우선순위 충돌 방지)
  행동: popover open 시 stack 등록, close 시 제거하여 ESC 1회=popover 닫기, 2회=GoalsModal 닫기.
  조건: 배경 클릭 닫기 금지 원칙을 깨지 않도록(특히 모달 영역) 이벤트를 정리한다.
  피드백: 키보드 사용자에게 포커스가 “원래 버튼”으로 돌아오도록 복귀 규칙을 둔다.

9) [P0 | 1-2d] Progress Undo + Feedback Snackbar 통합(중복 제거)
  행동: 진행도 변경 후 1회 Undo(메모리 only)를 제공하고 동일 스낵바에서 상태를 안내한다.
  조건: Undo는 마지막 1회만, 앱 재시작 시 초기화(영속화 금지/명시).
  피드백: Undo 외에도 “기록됨 ✓”를 같은 스낵바 패턴으로 재사용해 UI를 무겁게 만들지 않는다.

10) [P1 | 1-2d] Today Focus Top 1~3(요약 블록) — pin은 제외하고 단순 버전부터
  행동: 패널 상단에 “오늘 우선순위” 1~3개를 표시하고 클릭 시 해당 카드로 이동/강조한다.
  조건: 기본 정렬은 behind severity 기반(규칙이 단순해야 함), pin/커스텀은 P2로.
  피드백: 목표가 0개인 경우엔 빈 상태 CTA(목표 추가)로 전환한다.

### 2) UI/UX 개선안 10개

1) [P0 | 0.5d] 카드 기본 뷰 “3요소 제한” 가드레일(정보 과밀 방지)
  행동: 기본 상태에서 (배지 + Today target + 진행률)만 항상 보이게 설계한다.
  조건: 나머지 컨트롤(기록/조정)은 focus/hover/오버플로우로 점진적 노출.
  피드백: 사용자가 “어디를 봐야 할지” 즉시 알 수 있게 시각적 위계를 고정한다.

2) [P0 | 0.5d] +/- 버튼은 hover/focus에서만 노출(ADHD 과자극 완화)
  행동: 마우스/키보드 포커스 시에만 조정 버튼을 노출해 시각 요소를 줄인다.
  조건: 키보드 사용자는 Tab으로 접근 가능해야 하며, 터치 환경은 대체 진입점 제공.
  피드백: “실수로 눌렀다” 불안을 Undo 스낵바로 즉시 흡수한다.

3) [P0 | 0.5d] 스누즈/디스미스 결과를 ‘예측 가능한 문장’으로 표시
  행동: “2시간 후 다시 알림” 같은 결과 문구를 배너/모달에 명확히 남긴다.
  조건: 스누즈 만료로 인해 작업 중 자동 모달이 뜨지 않음을 문장으로 보장한다.
  피드백: 죄책감 유발 문구 금지(“미달성” 대신 “회복 제안”).

4) [P1 | 1-2d] 포커스 관리 규칙(열림=입력 포커스, 닫힘=트리거 복귀)
  행동: popover/모달에서 첫 포커스를 예측 가능하게 고정한다.
  조건: ESC 닫힘 후 포커스가 화면 상단으로 튀지 않도록 복귀 지점을 정의한다.
  피드백: 키보드 사용자에게 ‘길 잃음’을 최소화한다.

5) [P1 | 0.5d] 터치 친화 트리거(tooltip/overflow hit target 확대)
  행동: hover-only UI를 제거하고 터치에서 눌러 열 수 있게 한다.
  조건: 작은 아이콘만으로 기능을 숨기지 말고, 최소 클릭 영역을 확보한다.
  피드백: 잘못 터치해도 Undo/닫기 규칙으로 회복 가능해야 한다.

6) [P1 | 0.5d] 접근성 텍스트(배지/버튼/툴팁 aria 라벨) 정리
  행동: 색상 의미를 텍스트로 보강하고, 보조기기에서 문맥이 유지되게 한다.
  조건: 아이콘 버튼은 반드시 label/tooltip 중 하나로 의미를 가진다.
  피드백: 상태 변화(저장됨 등)는 화면 리더 친화적인 방식으로도 전달한다.

7) [P1 | 1-2d] 로딩/빈 상태 UX(스켈레톤 + “목표 추가” CTA)
  행동: 로딩 중에는 임시 레이아웃을 유지해 화면 점프를 줄인다.
  조건: 목표 0개일 때는 빈 상태 설명 + 추가 버튼을 우선 노출한다.
  피드백: 사용자가 “뭘 해야 하는지” 즉시 알게 한다.

8) [P1 | 1-2d] 실패 시 롤백+명확한 에러 메시지(유령 progress 방지)
  행동: 저장 실패 시 변경을 되돌리고 “저장 실패”를 짧게 안내한다.
  조건: 실패 후에도 UI가 ‘저장된 것처럼’ 남아 있지 않게 한다.
  피드백: 사용자가 다음 행동(다시 시도/닫기)을 알 수 있게 한다.

9) [P2 | 3-5d] GoalsModal 상단 요약 영역 시각 계층 재정비(선택 피로 감소)
  행동: 상단 요약/Today Focus를 시각적으로 고정해 ‘결정 먼저’ 흐름을 만든다.
  조건: 상세 정보는 아래로 내려서 “필요할 때만” 접근.
  피드백: 목표가 많아도 처음 5초 내 행동 결정을 돕는다.

10) [P2 | 1-2w] LATER 탐색 항목은 산출물(시안/프로토타입) 중심으로 문서화
  행동: 템플릿/체크포인트/축하 확장은 “UI mockup 1개 + 사용 시나리오 1페이지”처럼 결과물을 명시한다.
  조건: 도메인 타입 확장/마이그레이션은 포함하지 않는다(Frontend-only 준수).
  피드백: 기대 관리 비용을 줄이고, 구현 착수 전에 합의가 쉬워진다.

### Quick wins (5)

1) [P0 | 0.5d] 텍스트 severity 배지 추가(색상 의존 제거)
  행동: Safe/Warning/Danger 라벨을 카드에 추가한다.
  조건: 기존 레이아웃을 깨지 않도록 짧은 배지로 제한한다.
  피드백: 색약/ADHD 모두 “즉시 이해” 체감이 크다.

2) [P0 | 0.5d] Today target 라인 상시 표기(오늘 해야 할 양)
  행동: Today: N(단위) 한 줄을 카드 기본 정보로 보여준다.
  조건: 완료/0 목표의 문구 예외를 정리한다.
  피드백: “오늘 뭐 하면 돼?” 질문을 바로 닫아준다.

3) [P0 | 0.5d] “기록됨 ✓” 스낵바(애니메이션 없이)
  행동: Log 제출/진행 변경 직후 짧은 확인 피드백을 통일된 패턴으로 표시한다.
  조건: 자극 과잉 방지를 위해 애니메이션/사운드는 제외한다.
  피드백: 습관 루프의 ‘즉각 보상’을 최소 비용으로 보강한다.

4) [P0 | 0.5d] Log/조정 진입점 progressive disclosure(기본 화면 단순화)
  행동: 기본 뷰에서 버튼을 줄이고 hover/focus/overflow에서만 노출한다.
  조건: 키보드/터치 환경에서 접근 가능한 대체 진입점을 제공한다.
  피드백: 정보 밀도 증가로 인한 ADHD 역효과를 예방한다.

5) [P1 | 0.5d] Today target 툴팁 1문장 설명 추가
  행동: “남은 기간에 맞춘 오늘 분량” 같은 짧은 설명을 제공한다.
  조건: hover-only 금지(포커스/터치 가능) + ESC 동작 방해 금지.
  피드백: 숫자의 ‘이유’를 제공해 불안/혼란을 줄인다.

---

## Open Questions — Resolved with Assumptions
- Target Release: **1.0.166** (assumption; 1.0.165는 다른 계획과 충돌 가능성이 높음)
- Delete Undo: **NOW에서 제외** (repo 확장/정책 결정 필요 → scope creep 위험)
- Top 1~3 선정 기준: **기본=behind severity 우선**, pin은 NEXT 이후
- Snooze 기본값: **2시간**(고정). 단, snooze 만료 후 자동 모달 재등장 금지(배너만 활성)

---

# Implementation Backlog (Concise)

## Epic A — Catch-up Alert: Predictable, No-Surprise

### Task A1 — Snooze state + no surprise re-open
- Touchpoints
  - src/features/goals/hooks/useCatchUpAlert.ts
  - src/data/repositories/systemRepository.ts (SYSTEM_KEYS)
- Acceptance Criteria
  - Snooze 기간 동안 자동 모달이 **절대** 뜨지 않는다.
  - Snooze가 만료되어도 앱이 켜져 있는 동안 **자동 모달로 전환되지 않는다**(배너만).
  - 다음 앱 시작 시 behind 조건이 여전히 true면 모달 후보가 된다.

### Task A2 — Behind banner entry-point (manual open)
- Touchpoints
  - src/features/goals/WeeklyGoalPanel.tsx
  - src/features/goals/CatchUpAlertModal.tsx
- Acceptance Criteria
  - Behind goals가 1개 이상이면 패널 상단에 배너가 보인다.
  - 배너 클릭으로 모달을 사용자가 **명시적으로** 열 수 있다.

### Task A3 — Modal actions: View / Snooze / Dismiss-for-today
- Touchpoints
  - src/features/goals/CatchUpAlertModal.tsx
  - src/features/goals/hooks/useCatchUpAlert.ts
- Acceptance Criteria
  - 모달에 3개 액션이 있고, 각 액션의 결과가 즉시 반영된다.
  - “Dismiss for today”는 기존 1일 1회 규칙을 유지한다.

## Epic B — WeeklyGoalCard: Clarity Without Clutter

### Task B1 — Severity text badge + Today target line
- Touchpoints
  - src/features/goals/WeeklyGoalCard.tsx
  - src/shared/stores/weeklyGoalStore.ts (selector usage only)
- Acceptance Criteria
  - 색상 없이도 상태를 알 수 있도록 텍스트 배지가 항상 보인다.
  - Today target이 카드의 기본 정보로 표시된다(0/완료 등 예외는 명확히).

### Task B2 — Tooltip for “Today target” explanation (a11y-safe)
- Touchpoints
  - src/features/goals/WeeklyGoalCard.tsx
- Acceptance Criteria
  - 툴팁은 키보드 포커스로 열 수 있고, ESC를 방해하지 않는다.
  - 터치 환경에서도 접근 가능한 트리거를 제공한다(hover-only 금지).

## Epic C — Logging: Fast, Keyboard-friendly, Stack-safe

### Task C1 — Log Session popover with progressive disclosure
- Touchpoints
  - src/features/goals/WeeklyGoalCard.tsx
  - (new) src/features/goals/WeeklyGoalLogPopover.tsx
- Acceptance Criteria
  - “기록하기” 진입점은 hover/focus 또는 overflow 메뉴에서만 보인다.
  - Enter=저장, ESC=닫기, 저장 중 중복 제출이 발생하지 않는다.

### Task C2 — Popover participates in ESC stack
- Touchpoints
  - src/features/goals/WeeklyGoalCard.tsx (or log popover component)
  - src/shared/lib/modalStackRegistry/* (existing stack registry)
  - src/shared/hooks/useModalEscapeClose (if applicable)
- Acceptance Criteria
  - ESC 1회는 popover만 닫는다.
  - ESC 2회는 GoalsModal을 닫는다.

## Epic D — Safety & Feedback: Undo + “Recorded”

### Task D1 — Progress Undo (last change only, memory-only)
- Touchpoints
  - src/shared/stores/weeklyGoalStore.ts
  - src/features/goals/WeeklyGoalCard.tsx
- Acceptance Criteria
  - 진행 변경 후 snackbar가 뜨고, 8초 내 Undo가 가능하다.
  - Undo는 마지막 1회만 지원하며 앱 재시작 시 초기화된다.
  - 결과 progress는 0 미만으로 내려가지 않는다.

### Task D2 — Micro reward: “기록됨 ✓” snackbar integration
- Touchpoints
  - src/features/goals/WeeklyGoalCard.tsx
  - (optional) src/shared/lib/eventBus/*
- Acceptance Criteria
  - Log 제출 또는 +/- 변경 직후 “기록됨 ✓” 피드백이 짧게 표시된다.
  - 시각 자극(애니메이션/사운드)은 NOW에서 사용하지 않는다.

---

## Validation (High-level)
- UI smoke: GoalsModal 열기/닫기, ESC 스택(GoalsModal ↔ popover), behind 조건에서 배너/모달 동작 확인.
- Regression: 기존 +/- 버튼과 direct input 동작 유지.

## Risks / Rollback Notes
- ESC 스택 불일치 위험이 가장 큼 → popover stack 참여를 “필수 조건”으로 둔다.
- Snooze 로직에서 timezone 혼동 위험 → ISO string 저장 + `Date.now()` 비교 기반으로 단순화(시간대 변환 로직 금지).

## Version Management Milestone
- Update `package.json` version to Target Release (assumption: 1.0.166) and align any release notes if project uses them.
