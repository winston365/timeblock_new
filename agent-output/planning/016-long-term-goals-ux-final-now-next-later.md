# Final Proposal: Long-term Goals UX (Weekly Goals) — Now / Next / Later (ADHD-friendly, Frontend-only)

## Plan Header
- Plan ID: plan-2025-12-23-long-term-goals-ux-final-now-next-later
- Target Release: **1.0.166 (assumption)**
  - Rationale: `package.json` is 1.0.164 and other active plans already propose 1.0.165; this plan targets the next patch to avoid collisions.
- Epic Alignment: “주간 장기목표(Weekly Goals)를 더 빠르게 이해하고, 뒤처짐을 부드럽게 회복하며, 진행을 안전하게 기록해 꾸준함을 유지(특히 ADHD 친화)한다.”
- Status: Final (Ready for Implementer)

## Changelog
- 2025-12-23: Created final Now/Next/Later set by incorporating Critic feedback (reduced cognitive load, no surprise modals, frontend-only strictness, open questions resolved with assumptions).

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
