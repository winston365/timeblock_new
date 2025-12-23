# 036 - Lint + Modal Hotkeys + Coverage PR Execution Plan

- Plan ID: **036**
- Target Release: **1.0.171** (현재 `package.json` = 1.0.170 기준 patch +1)
- Epic Alignment: “프론트엔드/UI 품질·정책 준수(린트/경계)·입력 UX 안정화(ESC/핫키)·회귀 방지(테스트)로 안전한 릴리즈 가능 상태 만들기”
- Status: **In Progress** (PR1 Complete, QA Verified)
- Sources:
  - Analyst: [agent-output/analysis/034-lint-duplicate-imports-report-analysis.md](../analysis/034-lint-duplicate-imports-report-analysis.md)
  - Analyst: [agent-output/analysis/028-eslint-lint-status-analysis.md](../analysis/028-eslint-lint-status-analysis.md)
  - Critic: [agent-output/critiques/035-lint-cleanup-prioritized-execution-plan-critique.md](../critiques/035-lint-cleanup-prioritized-execution-plan-critique.md)

---

## Value Statement and Business Objective
As a developer, I want CI to stay zero-warning and keyboard-driven modal flows to behave consistently (ESC/primary hotkeys), so that UI iteration remains unblocked and users avoid confusing input regressions—without touching backend/Supabase/Electron IPC scope.

---

## Constraints (Frontend-only, No Scope Creep)
- **In-scope**: UI/React components + shared hooks, ESLint warnings cleanup, Vitest unit/integration tests in `tests/` that run locally.
- **Out-of-scope (explicit)**:
  - Backend (Cloud Functions), Supabase schema/auth.
  - Electron main/preload IPC implementation changes.
  - Sync 엔진 “동작 변경” 또는 아키텍처 대규모 리팩터(테스트 추가는 허용).
- **No scope creep rule**: 각 PR은 “단일 목적 / 단일 위험군”으로 유지. PR 간 섞어치기 금지(예: 핫키 PR에 린트/테스트 끼워 넣기).

---

## Current Situation (Analyst + Critic 반영)
- P0: ESLint가 **warnings=0 정책**에서 4 warnings로 CI를 막고 있음.
- P1: 모달 ESC/핫키는 `useModalHotkeys` / `useModalEscapeClose`로 분산되어 있고, 특히 QuickAddTask는 **ad-hoc `window.addEventListener`**로 스택/IME 정책을 우회함.
- P2: 커버리지 핫스팟(특히 branch)이 남아있음: `unifiedTaskService`, `conflictResolver`, `syncCore`.
- Repository boundary(“dexieClient 직접 import 금지”)는 이미 **ESLint 규칙 + 경계 테스트**가 존재함(강화/문서화 여부만 검토).

---

## Open Questions
- OPEN QUESTION [CLOSED]: `useModalHotkeys`는 ESC 스택 정책에 비준수인가?
  - 현행 구현은 `modalStackRegistry`를 공유하며 top-of-stack만 반응하도록 설계되어 있어 **정책 준수**로 판단.
  - 결론: “ESC-only면 `useModalEscapeClose` / ESC+Primary면 `useModalHotkeys`”를 표준으로 문서화하고, ad-hoc 리스너를 제거.
- OPEN QUESTION [CLOSED]: “dexieClient 직접 import 금지” 경계 가드는 없는가?
  - `.eslintrc.cjs`의 `no-restricted-imports`/`no-restricted-syntax` + `tests/db-access-boundary.test.ts`가 이미 존재.
  - 결론: 신규 추가가 아니라 **(a) 동작 확인 (b) 필요한 경우만 미세 강화/문서화**로 처리.

---

## PR Breakdown (3–6 PRs)

### PR 1 — CI-blocking lint warnings (P0)
- Conventional Commit Title: `fix(lint): resolve CI-blocking warnings`
- Scope: `lint`
- Goal: `npm run lint -- --max-warnings=0`에서 0 warnings 복구(정책 유지)
- Expected Files (touch 최소화):
  - `src/features/tasks/InboxTab.tsx`
  - `src/features/tasks/hooks/useInboxHotkeys.ts`
  - `tests/slot-finder.test.ts`
- Acceptance Criteria:
  - Lint 0 warnings
  - `npm run test` 통과
  - UI 동작 변화 없음(메모이제이션/미사용 변수 정리 수준)
- Risks:
  - Hook dependency 안정화 과정에서 “의도치 않은 stale closure” 또는 과도한 re-render 위험
- Test Plan (high-level):
  - `npm run lint -- --max-warnings=0`
  - `npm run test`

### PR 2 — Modal ESC / Primary hotkeys consistency (P1)
- Conventional Commit Title: `fix(hotkeys): unify modal ESC/primary hotkeys and remove ad-hoc listeners`
- Scope: `hotkeys`
- Goal: ESC/primary hotkeys가 “top-of-stack only + IME safe” 규칙으로 일관되게 동작
- Expected Files:
  - `src/features/quickadd/QuickAddTask.tsx` (ad-hoc window listener 제거 → shared hook로 통일)
  - `src/features/goals/GoalsModal.tsx`
  - `src/features/battle/components/BossAlbumModal.tsx`
  - `src/features/template/TemplateModal.tsx`
  - `src/features/goals/WeeklyGoalModal.tsx`
  - (필요 시) `src/shared/hooks/useModalHotkeys.ts` 또는 관련 문서(짧은 가이드) 1곳
- Acceptance Criteria:
  - ESC는 항상 “최상단 UI(모달/오버레이)”만 닫힘
  - Ctrl/Cmd+Enter primary action은 “최상단 UI”에서만 실행
  - QuickAddTask에서 ESC/primary가 중복 실행되지 않음
  - IME 조합 중 단축키 오동작 없음(현행 정책 유지)
- Risks:
  - Electron 컨텍스트(QuickAdd 별도 윈도우)에서 키 이벤트 전파가 브라우저와 다를 수 있음
  - 특정 모달에서 기존 단축키 체감이 달라질 수 있음(예: textarea에서 Ctrl+Enter 허용 여부)
- Test Plan (high-level):
  - `npm run test`
  - `npm run electron:dev`로 QuickAdd/모달 열고 ESC/primary 동작 스모크 확인

### PR 3 — UnifiedTaskService coverage uplift (P2-Tests)
- Conventional Commit Title: `test(task): improve unifiedTaskService branch coverage`
- Scope: `task`
- Goal: `unifiedTaskService`의 “dual-storage / location unknown / edge branches” 커버
- Expected Files:
  - `tests/unified-task-service.test.ts` (또는 신규 테스트 파일 1개)
  - (원칙) prod 코드 변경 없이 테스트만으로 달성, 필요 시 최소한의 “테스트 친화 refactor”만 허용
- Acceptance Criteria:
  - Coverage에서 `unifiedTaskService` branch/line 지표가 유의미하게 상승(목표: branch ≥ 80%를 지향)
  - 테스트가 결정적(deterministic)이고 로컬에서 재현 가능
- Risks:
  - 테스트가 내부 구현 세부사항에 과도하게 결합될 위험
- Test Plan (high-level):
  - `npm run test`
  - (필요 시) `npm run test:coverage`로 수치 확인

### PR 4 — conflictResolver + syncCore branch coverage uplift (P2-Tests)
- Conventional Commit Title: `test(sync): improve conflictResolver and syncCore branch coverage`
- Scope: `sync`
- Goal: conflict 유형/실패/재시도 경로(branch) 테스트 강화(동작 변경 없이)
- Expected Files:
  - `tests/conflict-resolver.test.ts`
  - `tests/sync-core.test.ts`
  - (필요 시) `tests/sync-retry-queue.test.ts` 등 기존 sync 테스트 파일
- Acceptance Criteria:
  - Coverage에서 conflictResolver/syncCore branch 지표가 유의미하게 상승(목표: branch ≥ 80% 지향)
  - flaky 없음(시간/타이머 의존 최소화)
- Risks:
  - sync 관련 테스트는 환경/시간 의존으로 flake가 생기기 쉬움 → time mocking 기준 정리 필요
- Test Plan (high-level):
  - `npm run test`
  - (필요 시) `npm run test:coverage`

### PR 5 — Repository boundary guard (verify + minimal tighten) + short policy note
- Conventional Commit Title: `docs(policy): document and verify dexie access boundaries`
- Scope: `policy`
- Goal: “dexieClient 직접 import 금지 / db.* 직접 접근 금지”의 현행 가드를 팀에 명확히 공유하고, 필요 시만 미세 강화
- Expected Files:
  - `CLAUDE.md` (또는 개발자 가이드 문서 1곳) — 경계 규칙과 예외 경로를 1페이지로 정리
  - (변경 필요 시에만) `tests/db-access-boundary.test.ts` / `.eslintrc.cjs`
- Acceptance Criteria:
  - 경계 규칙이 문서로 명확해짐(어디서 허용/금지인지)
  - 경계 테스트가 CI에서 항상 실행되는 전제 확인(테스트 스위트에 포함)
  - 불필요한 규칙 강화로 기존 코드가 깨지지 않음
- Risks:
  - 과도한 정적 규칙 강화는 개발 생산성을 해칠 수 있음 → “미세 강화”만 허용
- Test Plan (high-level):
  - `npm run lint`
  - `npm run test`

### PR 6 — Version management (Release artifacts)
- Conventional Commit Title: `chore(release): bump version to 1.0.171`
- Scope: `release`
- Goal: Target Release 정합성 확보(릴리즈 묶음의 마지막)
- Expected Files:
  - `package.json`
- Acceptance Criteria:
  - `package.json` 버전이 1.0.171로 업데이트
  - 릴리즈 빌드 파이프라인 영향 없음
- Risks:
  - 낮음(메타데이터 변경)
- Test Plan (high-level):
  - `npm run lint`
  - `npm run test`

---

## Dependency / Order
1) PR 1 (lint) — **필수 선행**: CI unblock
2) PR 2 (hotkeys) — PR 1 이후 권장(병렬 가능하나, 린트 깨진 상태에서 리뷰 부담 증가)
3) PR 3 (unifiedTaskService tests) — PR 1 이후 병렬 가능
4) PR 4 (sync tests) — PR 1 이후 병렬 가능
5) PR 5 (boundary docs/verify) — 언제든 가능, 단 release 직전 정리 권장
6) PR 6 (version bump) — **모든 기능/테스트 PR merge 후 마지막**

---

## Verification (Non-QA, Engineering-level)
- Static: `npm run lint -- --max-warnings=0`
- Tests: `npm run test` (필요 시 `npm run test:coverage`)
- Runtime smoke (frontend/Electron): `npm run electron:dev`로 QuickAdd 및 대표 모달 입력 흐름 확인

---

## Rollback Notes
- PR 1: 린트 경고 회복이 목적이므로 revert 비용 낮음
- PR 2: 사용자 입력(ESC/primary) 회귀 가능성 → 문제 시 PR 2 단독 revert로 즉시 복구 가능하도록 분리 유지
- PR 3–4: 테스트만 변경이 원칙 → revert 안전

---

## Changelog
| Date | Author | Change |
|------|--------|--------|
| 2025-12-23 | Planner | PR 단위(3–6)로 재구성, P0/P1/P2를 병렬 가능하도록 분할, frontend-only 가드레일 명시 |
| 2025-12-23 | QA | `npm run lint -- --max-warnings=0`, `npm test`, `npm run test:coverage` 통과(Exit code 0) 확인 |
