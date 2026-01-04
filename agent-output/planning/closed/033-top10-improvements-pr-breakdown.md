# Plan: Repo Top 10 Improvements — PR-sized Breakdown (Frontend/UI Focus)

## Plan Header
- Plan ID: plan-2025-12-23-top10-improvements-pr-breakdown
- Target Release: **1.0.171 (제안; 현재 package.json = 1.0.170 기준 patch +1)**
- Epic Alignment: “프론트엔드/UI 품질·정책 준수·회귀 방지(테스트/린트)로 안정적 릴리즈 가능 상태 만들기”
- Status: Proposed

## Changelog
- 2025-12-23: Critique(Top10+Risk Register) 기반으로 12개 PR로 분해, 의존성/퀵윈/파운데이션 구분 포함.

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want 모달/스케줄/작업 이동이 예측 가능하고 즉시 피드백을 주며, 린트/테스트로 회귀가 조기에 잡히게 해서, so that 계획-실행 흐름이 끊기지 않고 데이터 손상/UX 불안을 줄일 수 있다.

## Scope / Constraints
- Frontend/Renderer(UI) 중심. (백엔드/Supabase/Electron IPC **구현 금지**)
- 프로젝트 정책 준수:
  - localStorage 사용 금지(테마 키만 예외)
  - Repository pattern 준수(직접 Dexie 호출 금지)
  - 모달 UX: 배경 클릭 닫기 금지, ESC는 항상 닫기(스택 top-most)
  - 기본값은 [src/shared/constants/defaults.ts](../../src/shared/constants/defaults.ts)에서만
  - 중첩 객체 접근은 optional chaining
- PR은 작고 리뷰 가능해야 함(핫스팟/리스크 격리).

## Inputs / References
- Critique: [agent-output/critiques/033-repo-top10-improvements-risk-prioritization.md](../critiques/033-repo-top10-improvements-risk-prioritization.md)
- Analysis (Modal UX): [agent-output/analysis/012-modal-ux-escape-ctrlenter-analysis.md](../analysis/012-modal-ux-escape-ctrlenter-analysis.md)
- Existing plans (참고용):
  - [agent-output/planning/013-modal-ux-hotkeys-pr-breakdown.md](013-modal-ux-hotkeys-pr-breakdown.md)
  - [agent-output/planning/014-schedule-unlimited-inbox-immediate-pr-plan.md](014-schedule-unlimited-inbox-immediate-pr-plan.md)

---

# PR Plan (12 PRs)

> 표기 규칙
> - **Scope**: 이 PR이 ‘무엇을/왜’ 바꾸는지
> - **Files/Areas**: 영향 범위(대표 경로)
> - **Acceptance Criteria**: 리뷰어가 “완료” 판단 가능한 체크
> - **Risks**: 실패/회귀 위험
> - **Test Strategy**: 어떤 수준의 테스트로 보호할지(구체 테스트케이스 설계는 QA 문서로 이관)

---

## PR 1 — chore(lint): unblock CI by fixing eslint errors

- **Scope**: 중복 import 및 react-hooks deps 경고를 제거해 `npm run lint`를 CI 게이트로 복구.
- **Files/Areas**: [lint-errors.txt](../../lint-errors.txt), 주요 UI 컴포넌트/스토어/서비스 (예: schedule/task/goals 관련)
- **Acceptance Criteria**:
  - `npm run lint` exit code 0
  - `--max-warnings 0` 준수
  - `react-hooks/exhaustive-deps`는 해결 또는 disable 시 사유가 코드/문서에 명시
- **Risks**: hooks deps 수정으로 런타임 동작 변화 가능(리렌더/루프).
- **Test Strategy**: `npm test` + 핵심 화면(스케줄/인박스/모달) 스모크 수동 확인.

---

## PR 2 — test(task): raise unifiedTaskService coverage to reduce move/regression risk

- **Scope**: 작업 위치 탐색/이동 핵심 로직 커버리지를 올려 데이터 손실/상태 불일치 회귀를 조기에 탐지.
- **Files/Areas**:
  - [src/shared/services/task/unifiedTaskService.ts](../../src/shared/services/task/unifiedTaskService.ts)
  - [tests/unified-task-service.test.ts](../../tests/unified-task-service.test.ts)
  - (필요 시) 관련 헬퍼/픽스처
- **Acceptance Criteria**:
  - 해당 파일 기준 line coverage ≥ 85%, branch coverage ≥ 80%(repo 기준 합의된 목표)
  - `findTaskLocation`, `updateAnyTask`, `moveTask`의 주요 분기 경로가 테스트로 고정
- **Risks**: 테스트가 구현 세부에 과도 결합하면 리팩터링 저항 증가.
- **Test Strategy**: Vitest 단위 테스트 중심 + `npm run test:coverage` 확인.

---

## PR 3 — test(ui): add RTL + jsdom infra for modal policy verification

- **Scope**: UI/모달 정책(ESC, top-most, backdrop click 금지)을 자동 검증할 기반을 마련.
- **Files/Areas**:
  - [vitest.config.ts](../../vitest.config.ts)
  - [tests/setup.ts](../../tests/setup.ts)
  - 신규 `tests/ui/*` 또는 `tests/modal-*` 계열(경로는 팀 컨벤션에 맞춤)
- **Acceptance Criteria**:
  - jsdom 환경에서 최소 1개의 샘플 컴포넌트 렌더/키 이벤트 테스트가 green
  - “top-most 모달만 ESC로 닫힘”을 더미 모달로 검증하는 테스트 1개 이상
- **Risks**: 테스트 런타임 증가, flaky(타이밍/portal).
- **Test Strategy**: Vitest + RTL 컴포넌트 테스트(스냅샷 최소화, 이벤트 기반).

---

## PR 4 — fix(modal): migrate GoalsModal & BossAlbumModal to stack-aware ESC close

- **Scope**: ESC 처리 우회 모달 2개를 스택 훅으로 통일해 중첩 모달에서 예측 가능한 닫힘 보장.
- **Files/Areas**:
  - [src/shared/hooks/useModalEscapeClose.ts](../../src/shared/hooks/useModalEscapeClose.ts) (필요 시 옵션 확장)
  - [src/features/goals/GoalsModal.tsx](../../src/features/goals/GoalsModal.tsx)
  - [src/features/battle/components/BossAlbumModal.tsx](../../src/features/battle/components/BossAlbumModal.tsx)
  - (테스트) PR3에서 구축한 RTL 인프라 기반
- **Acceptance Criteria**:
  - 두 모달에서 ad-hoc window keydown ESC 리스너 제거
  - 중첩 모달에서 ESC는 top-most만 닫힘(회귀 테스트 포함)
  - 배경 클릭 닫힘 금지 정책 유지
- **Risks**: 기존 “서브 상태 먼저 닫기” UX가 깨질 수 있음.
- **Test Strategy**: RTL로 ESC 동작 + 수동으로 Goals/BossAlbum 흐름 1회씩 확인.

---

## PR 5 — feat(modal): standardize Ctrl+Enter primary action via shared hook

- **Scope**: primary action이 있는 모달에 Ctrl+Enter(필요 시 macOS metaKey) 단축키를 일관되게 제공.
- **Files/Areas**:
  - 공용 훅: [src/shared/hooks](../../src/shared/hooks)
  - 적용 대상(분석 기준):
    - [src/features/schedule/TaskModal.tsx](../../src/features/schedule/TaskModal.tsx)
    - [src/features/schedule/MemoModal.tsx](../../src/features/schedule/MemoModal.tsx)
    - [src/features/tasks/BulkAddModal.tsx](../../src/features/tasks/BulkAddModal.tsx)
    - [src/features/tasks/TaskBreakdownModal.tsx](../../src/features/tasks/TaskBreakdownModal.tsx)
    - [src/features/shop/ShopModal.tsx](../../src/features/shop/ShopModal.tsx)
- **Acceptance Criteria**:
  - Ctrl+Enter로 primary 실행(Enter 단독은 처리하지 않음)
  - IME 조합 중(`isComposing`) 단축키가 발동하지 않음
  - 중첩 모달에서 top-most만 반응
- **Risks**: textarea/입력 UX 충돌, 키 이벤트 전파 문제.
- **Test Strategy**: 공용 훅 단위 테스트 + 대표 모달 1~2개 RTL 검증.

---

## PR 6 — refactor(constants): dedupe schedule bucket constants into defaults

- **Scope**: 중복 상수(`MAX_TASKS_PER_BLOCK` 등)를 단일 출처([src/shared/constants/defaults.ts](../../src/shared/constants/defaults.ts))로 통합해 불일치 버그 방지.
- **Files/Areas**:
  - [src/features/schedule/utils](../../src/features/schedule/utils)
  - [src/shared/constants/defaults.ts](../../src/shared/constants/defaults.ts)
  - 관련 테스트(버킷 유틸 테스트)
- **Acceptance Criteria**:
  - 중복 정의 제거, import는 defaults 단일 사용
  - 버킷 유틸 테스트/스모크 테스트 green
- **Risks**: 상수 의미 변화로 UI 제한/표시가 달라질 수 있음.
- **Test Strategy**: 기존 유틸 테스트 업데이트 + 스케줄 화면 수동 확인.

---

## PR 7 — fix(schedule): make inbox→timeblock updates optimistic (remove forced full reload)

- **Scope**: 인박스에서 시간대 지정 시 새로고침 없이 즉시 스케줄에 반영(실패 시 롤백)하여 UX/성능 개선.
- **Files/Areas**:
  - [src/shared/stores/dailyDataStore.ts](../../src/shared/stores/dailyDataStore.ts)
  - [src/shared/stores/inboxStore.ts](../../src/shared/stores/inboxStore.ts)
  - [src/features/tasks/InboxTab.tsx](../../src/features/tasks/InboxTab.tsx)
  - (참고) 기존 계획: [agent-output/planning/014-schedule-unlimited-inbox-immediate-pr-plan.md](014-schedule-unlimited-inbox-immediate-pr-plan.md)
- **Acceptance Criteria**:
  - 인박스→스케줄 배치가 즉시 UI 반영
  - 저장 실패 시 중복/유령 task 없이 원상복구(롤백)
  - repository pattern 준수(직접 Dexie 호출/새 localStorage 없음)
- **Risks**: 상태 불일치(두 store 간), 롤백 누락.
- **Test Strategy**: store 단위 테스트(모킹) + 수동으로 드래그/버튼 배치 1회씩.

---

## PR 8 — refactor(data): reduce direct db.systemState access by routing through repositories

- **Scope**: 직접 Dexie 접근을 줄이고 repository 경유로 일관성 확보(키/기본값 분산 방지).
- **Files/Areas**:
  - [src/data/repositories](../../src/data/repositories)
  - [src/shared](../../src/shared) 초기화/설정 접근 경로(예: init, sync engine 주변)
  - (참고) 관련 분석 문서가 있다면 PR 본문에 링크 추가
- **Acceptance Criteria**:
  - 대상 모듈에서 `db.systemState` 직접 호출이 의미 있게 감소
  - 기본값은 defaults 사용, nested 접근 optional chaining 유지
- **Risks**: 초기화 타이밍/마이그레이션 경로에서 예기치 않은 null/undefined.
- **Test Strategy**: 기존 테스트 + 앱 부팅 스모크(설정 로딩/동기화 시작 전후).

---

## PR 9 — test(sync): improve conflictResolver branch coverage (no behavior changes)

- **Scope**: 동기화 충돌 병합 로직의 브랜치 커버리지를 올려 데이터 손실 리스크를 감소.
- **Files/Areas**:
  - (예상) [src/shared/services/sync](../../src/shared/services/sync) 내부 conflict resolver
  - [tests/conflict-resolver.test.ts](../../tests/conflict-resolver.test.ts)
- **Acceptance Criteria**:
  - conflictResolver 브랜치 커버리지 ≥ 80%
  - 필드 누락/타임스탬프 충돌/스키마 변화 등의 분기가 테스트로 고정
- **Risks**: 테스트가 실제 운영 시나리오와 괴리될 수 있음(픽스처 품질).
- **Test Strategy**: Vitest 단위 테스트 + 커버리지 리포트 확인.

---

## PR 10 — test(sync): improve syncCore branch coverage (no behavior changes)

- **Scope**: 동기화 핵심 모듈의 네트워크/인증/부분 실패 분기를 테스트로 고정.
- **Files/Areas**:
  - (예상) [src/shared/services/sync](../../src/shared/services/sync) 내부 sync core
  - [tests/sync-core.test.ts](../../tests/sync-core.test.ts)
- **Acceptance Criteria**:
  - syncCore 브랜치 커버리지 ≥ 80%
  - 네트워크 실패/인증 만료/부분 업로드 분기 최소 1개 이상씩 보호
- **Risks**: 모킹 복잡도 상승(테스트 유지보수 부담).
- **Test Strategy**: Vitest 단위 테스트(경계 모킹) + 커버리지 확인.

---

## PR 11 — docs: document frontend policies & PR workflow (lint/tests/modal rules)

- **Scope**: 팀/기여자가 정책을 놓치지 않도록 문서로 정리(ADHD 친화적으로 “짧은 체크리스트” 포함).
- **Files/Areas**:
  - [README.md](../../README.md)
  - (필요 시) [docs](../../docs) 아래 정책/개발 가이드 문서
  - [agent-output/critiques/033-repo-top10-improvements-risk-prioritization.md](../critiques/033-repo-top10-improvements-risk-prioritization.md) 링크 정리(선택)
- **Acceptance Criteria**:
  - “금지/필수” 정책(로컬스토리지/Repo 패턴/모달 ESC/기본값) 체크리스트로 명시
  - 개발자가 따라 할 수 있는 명령 3개(`npm run lint`, `npm test`, `npm run electron:dev`)가 한 곳에 정리
- **Risks**: 문서가 과도하게 길어져 실제로 안 읽힐 위험.
- **Test Strategy**: 문서 PR은 테스트 없음(단, 링크 깨짐 확인).

---

## PR 12 — chore(release): prepare 1.0.171 release artifacts

- **Scope**: Target Release 버전 정합성(버전 아티팩트/릴리즈 노트/변경 요약) 확보.
- **Files/Areas**:
  - [package.json](../../package.json)
  - (존재 시) CHANGELOG/릴리즈 노트 문서
- **Acceptance Criteria**:
  - repo 표시 버전이 1.0.171로 일치
  - 이번 배치의 사용자 영향 요약 5~8줄(퀵윈/주의사항 포함)
- **Risks**: 병행 작업으로 버전 충돌(다른 PR에서 선반영).
- **Test Strategy**: `npm test`, `npm run lint` 재확인.

---

# Dependency Graph / Recommended Order

1) PR 1 (lint) — 모든 PR의 바닥
2) PR 2 (unifiedTaskService tests) — 상태 이동/즉시 반영 작업 전에 안전망
3) PR 3 (RTL+jsdom infra) — 이후 모달 정책 테스트를 위해 기반 마련
4) PR 4 (ESC 통일) — PR3에 의존(테스트)
5) PR 5 (Ctrl+Enter 훅) — PR3에 의존(테스트)
6) PR 6 (constants dedupe) — 독립(단, schedule 변경과 충돌 가능하므로 PR7 전에 권장)
7) PR 7 (optimistic inbox→timeblock) — PR2 선행 권장, PR6와 충돌 가능
8) PR 8 (repository routing) — 독립이지만 범위가 넓을 수 있어 PR7 이후로 밀어 리스크 격리 권장
9) PR 9 (conflictResolver tests) — 독립
10) PR 10 (syncCore tests) — 독립
11) PR 11 (docs) — 언제든 가능(보통 PR1 이후)
12) PR 12 (release) — 마지막(선행 PR 전부 머지 후)

---

# Quick Wins vs Foundational

## Quick Wins (리뷰/머지 빠름)
- PR 1 (lint 게이트 복구)
- PR 4 (ESC 정책 위반 2개 모달 수렴)
- PR 6 (상수/기본값 출처 단일화)
- PR 11 (문서 체크리스트화)

## Foundational (안정성/장기 효율)
- PR 2 (핵심 task 이동 로직 커버리지)
- PR 3 (RTL/모달 정책 자동검증 기반)
- PR 5 (Primary 단축키 표준화)
- PR 7 (optimistic update로 즉시 피드백 루프)
- PR 8 (repository pattern 준수 강화)
- PR 9~10 (동기화 핵심 분기 테스트 강화)

---

# OPEN QUESTIONS (승인 필요)

1) Target Release를 **1.0.171**로 잡아도 되나요? (현재 [package.json](../../package.json) = 1.0.170)
2) PR 8의 범위: 성능/운영상 이유로 “직접 Dexie 접근”을 예외로 둘 모듈이 있나요, 아니면 전면 금지 방향인가요?
3) Ctrl+Enter 적용 범위: 입력형 모달에만 적용(권장) vs 전 모달 일괄 적용?

---

# Handoff Notes
- 이 문서는 **프론트/UI 중심**으로만 구성했으며, 백엔드/Supabase/Electron IPC 구현은 포함하지 않는다.
- PR7(optimistic)과 PR8(repo routing)은 상태/데이터 무결성 리스크가 있으므로 커밋 분리/롤백 포인트를 명확히 유지하는 것을 권장한다.
