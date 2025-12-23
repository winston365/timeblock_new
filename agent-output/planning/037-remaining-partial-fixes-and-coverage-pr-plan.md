# 037 — Remaining Partial Fixes + Coverage Improvements (PR-level Plan)

- Plan ID: **037**
- Target Release: **1.0.171 (제안; 현재 package.json = 1.0.170 기준 patch +1)**
- Epic Alignment: “프론트엔드/UI 품질·입력 UX 안정화(ESC/핫키)·회귀 방지(테스트 커버리지)로 안전한 릴리즈 가능 상태 만들기”
- Status: **Proposed**
- Scope Guard: **Frontend/UI only** (백엔드/Supabase/Electron IPC 구현/Repo 대리 리팩토링/RTL 인프라 구축 제외)

## Changelog
| Date | Author | Change |
|------|--------|--------|
| 2025-12-23 | Planner | Critic P1/P2 우선순위를 3–5개의 “작고 리뷰 가능한 PR”로 재구성. P0 완료 전제. | 

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want QuickAdd와 모달들이 ESC/Primary 단축키에서 예측 가능하게 동작하고(중첩에서도 top-most만 반응), 핵심 서비스 로직(unifiedTaskService/sync)의 분기들이 테스트로 보호되게 해서, so that 입력 실수/회귀로 흐름이 끊기거나 데이터가 꼬이는 불안을 줄일 수 있다.

## Context / Inputs
- Critic priorities: [agent-output/critiques/036-partial-fixes-prioritization-critique.md](../critiques/036-partial-fixes-prioritization-critique.md)
- Existing execution plan (P0/P1/P2 포함): [agent-output/planning/036-lint-hotkeys-coverage-pr-plan.md](036-lint-hotkeys-coverage-pr-plan.md)
- Coverage snapshot 근거(핫스팟): [agent-output/analysis/033-top10-status-verification-analysis.md](../analysis/033-top10-status-verification-analysis.md)

## Constraints (반드시 준수)
- In-scope:
  - React/Renderer UI, shared hooks(`useModalHotkeys`, `useModalEscapeClose`) 사용 통일
  - Vitest 기반 테스트 추가(기존 테스트 파일 확장)
- Out-of-scope (이번 요청에서 명시적으로 제외):
  - RTL/jsdom 인프라 신규 구축
  - Repository 패턴 대규모 리팩토링
  - 백엔드/Supabase/Electron IPC “구현” 변경

---

# PR Breakdown (총 4–5개)

## PR 1 (P1) — QuickAddTask hotkey migration to useModalHotkeys
- Conventional Commit Title: `refactor(hotkeys): migrate QuickAddTask to useModalHotkeys`
- Scope: `hotkeys`
- Can do now: **Yes (Now)**
- Goal:
  - QuickAddTask의 ad-hoc `window.addEventListener('keydown')`를 제거하고, 스택/IME 가드를 갖춘 공용 훅으로 통일
- Expected Files:
  - `src/features/quickadd/QuickAddTask.tsx`
  - (필요 시) `src/shared/hooks/useModalHotkeys.ts` (QuickAdd 요구사항을 훅 옵션으로 흡수해야 할 때만)
- Acceptance Criteria:
  - ESC: QuickAdd 창 닫기 동작이 유지됨
  - Ctrl/Cmd+Enter: 저장(또는 submit) 동작이 유지됨
  - IME 조합 중(`isComposing` 또는 key=`Process`)에는 단축키가 동작하지 않음
  - 핫키가 “중복 실행/누수” 없이, 창 종료 시 정리(cleanup)됨
- Risks:
  - QuickAdd는 “모달”이 아니라 독립 창이므로, modalStackRegistry 참여 방식이 UX에 영향을 줄 수 있음(다른 모달이 열려있을 때 top-of-stack 정책)
  - Ctrl/Cmd+Enter가 입력 중인 textarea/input과 충돌할 수 있음(allowInTextarea/allowInInput 옵션 확인 필요)
- Test Plan (high-level):
  - 자동: `npm run test` (회귀 확인)
  - 수동(Electron): `npm run electron:dev` → QuickAdd 열기 → ESC/ Ctrl(or Cmd)+Enter가 각각 1회만 동작하는지 스모크 확인

## PR 2 (P1) — Modal ESC consistency + TemplateModal isOpen correctness
- Conventional Commit Title: `fix(modal): enforce ESC stack behavior and correct TemplateModal isOpen`
- Scope: `modal`
- Can do now: **Yes (Now)**
- Goal:
  - 모달 ESC는 항상 top-of-stack만 닫는다(정책 준수)
  - TemplateModal에서 `useModalHotkeys({ isOpen: true })` 상수 사용을 제거하고 실제 open 상태로 연결해 “숨겨진 상태에서도 ESC를 가로채는” 위험을 제거
- Expected Files:
  - `src/features/template/TemplateModal.tsx` (isOpen 흐름 정리)
  - `src/features/template/TemplatesModal.tsx` (TemplateModal open/close 소스가 여기라면, isOpen 전달/마운트 전략 정리)
  - `src/features/goals/GoalsModal.tsx` (Critic 기준 ESC 정책 위반/우회 포인트 정리)
  - `src/features/battle/components/BossAlbumModal.tsx` (동일)
  - (필요 시) `src/shared/hooks/useModalEscapeClose.ts`
- Acceptance Criteria:
  - GoalsModal/BossAlbumModal은 ESC 처리에서 스택 정책(top-of-stack)과 IME 가드를 만족
  - TemplateModal이 “열려 있을 때만” hotkeys 스택에 등록된다
  - 배경 클릭으로 모달이 닫히지 않는 정책은 유지된다
- Risks:
  - 기존 중첩 모달 닫힘 순서(자식 먼저/부모 다음)가 체감상 달라질 수 있음
  - TemplateModal open 상태 전달 방식 변경 시, 부모 모달의 open/close 조건과 불일치 위험
- Test Plan (high-level):
  - 자동: `npm run test` (특히 `tests/modal-hotkeys.test.ts` 존재 시 영향 확인)
  - 수동(Electron): 템플릿 모달(부모+자식) 중첩 상태에서 ESC를 연속 입력했을 때 top-most만 닫히는지 확인

## PR 3 (P2, Deferred) — Coverage uplift: unifiedTaskService branch-heavy paths
- Conventional Commit Title: `test(task): improve unifiedTaskService branch coverage`
- Scope: `task`
- Can do now: **Deferred (Plan only)**
- Goal:
  - `unifiedTaskService`의 “dual-storage / location unknown / 분기”를 테스트로 고정(동작 변경 없이)
- Expected Files:
  - `tests/unified-task-service.test.ts`
  - (필요 시) 테스트 픽스처/헬퍼 파일 1개(테스트 전용)
- Acceptance Criteria:
  - `coverage/coverage-summary.json` 기준으로 unifiedTaskService의 branch/line이 유의미하게 상승
  - 테스트는 결정적(deterministic)이며 시간/랜덤 의존이 없다
- Risks:
  - 테스트가 내부 구현에 과도 결합하면 작은 리팩토링에도 테스트가 과다하게 깨질 수 있음
- Test Plan (high-level):
  - `npm run test`
  - `npm run test:coverage` (수치 확인)

## PR 4 (P2, Deferred) — Coverage uplift: conflictResolver + syncCore branch paths
- Conventional Commit Title: `test(sync): improve conflictResolver and syncCore branch coverage`
- Scope: `sync`
- Can do now: **Deferred (Plan only)**
- Goal:
  - sync 충돌 병합(conflictResolver)과 동기화 코어(syncCore)의 실패/경계 분기를 테스트로 보호(동작 변경 없음)
- Expected Files:
  - `tests/conflict-resolver.test.ts`
  - `tests/sync-core.test.ts`
  - (필요 시) 기존 sync 테스트 파일 1개
- Acceptance Criteria:
  - conflictResolver/syncCore branch 커버리지가 유의미하게 상승
  - flaky 없이 반복 실행 시 안정적으로 green
- Risks:
  - sync 테스트는 모킹/타이밍 의존으로 flake 위험이 상대적으로 큼
- Test Plan (high-level):
  - `npm run test`
  - `npm run test:coverage`

## PR 5 (Release, Optional/Deferred) — Version management for the release batch
- Conventional Commit Title: `chore(release): bump version to 1.0.171`
- Scope: `release`
- Can do now: **Deferred (release bundling 시점에만)**
- Goal:
  - 위 PR들이 한 묶음으로 릴리즈될 때 Target Release 정합성 확보
- Expected Files:
  - `package.json`
- Acceptance Criteria:
  - 버전이 1.0.171로 일치
- Risks:
  - 매우 낮음(메타데이터)
- Test Plan (high-level):
  - `npm run lint`; `npm run test`

---

# Dependency / Order
1) PR 1 (QuickAdd hotkeys) — PR 2와 병렬 가능하나, 입력 UX 리스크 격리를 위해 독립 PR 유지
2) PR 2 (Modal ESC + TemplateModal isOpen) — P1 핵심, 수동 스모크 필요
3) PR 3–4 (Coverage tests) — 기능 변경 없이 “테스트만”이므로 P1 이후/병렬 가능(단, CI 시간 증가 고려)
4) PR 5 (release bump) — 최종 merge 후 마지막

---

# Validation (Engineering-level)
- Static: `npm run lint -- --max-warnings=0`
- Tests: `npm run test`
- Optional Coverage: `npm run test:coverage` (P2 PR에서 필수)
- Runtime smoke: `npm run electron:dev`로 QuickAdd/모달 ESC 스택 확인

---

# Rollback Notes
- PR 1/2: 입력 UX 회귀 시 PR 단독 revert로 즉시 복구 가능해야 하므로 기능 섞지 않음
- PR 3/4: 테스트만 변경 원칙 → revert 안전

---

# OPEN QUESTION (승인 필요)
- Target Release를 **1.0.171**로 잡고(기존 플랜 036과 정합), 이 플랜의 PR5(버전 bump)를 “릴리즈 묶음 마지막”으로 남겨도 될까요?

## Critic Handoff (Required)
- 본 문서는 Critic의 PR 크기/리스크 격리 원칙을 따르므로, 실행 전 Critic 리뷰(범위/수용 기준/리스크) 1회 권장.
