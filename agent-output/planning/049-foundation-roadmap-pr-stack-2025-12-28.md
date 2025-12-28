# Plan Header
- Plan ID: plan-2025-12-28-foundation-roadmap-pr-stack
- Target Release: **1.0.171** (foundation batch; aligns with existing 1.0.170 → +1 guidance)
- Epic Alignment: 안정성/데이터 안전/ADHD UX(입력 손실 방지) 기반 체력 강화
- Status: Proposed

## Changelog
- 2025-12-28: 초기 작성(요청 우선순위 1~9를 PR 단위로 재구성, 의존성/순서 명시).

## References (Existing Analyst/Critic/Architect Outputs)
- Planning: agent-output/planning/033-top10-improvements-pr-breakdown.md
- Planning: agent-output/planning/036-lint-hotkeys-coverage-pr-plan.md
- Planning: agent-output/planning/014-schedule-unlimited-inbox-immediate-pr-plan.md (optimistic update 선행 설계)
- Architecture: agent-output/architecture/006-modal-hotkeys-standardization-architecture-findings.md
- Architecture: agent-output/architecture/007-schedule-unlimited-optimistic-update-architecture-findings.md
- Critique: agent-output/critiques/048-top10-risk-prioritization-2025-12-28.md
- Analysis (status Planned): agent-output/analysis/028-eslint-lint-status-analysis.md, agent-output/analysis/012-modal-ux-escape-ctrlenter-analysis.md, agent-output/analysis/033-top10-status-verification-analysis.md, agent-output/analysis/047-front-improvement-hypotheses-analysis.md

---

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want CI가 막히지 않고(lint), 모달이 실수로 닫혀 입력이 날아가지 않으며(배경 클릭 금지), 핵심 task 이동/동기화 로직이 테스트로 보호되어(부분 실패 포함) 변경이 두렵지 않게 되어, so that 계획/실행 흐름이 끊기지 않고 데이터 무결성과 개발 속도가 함께 올라간다.

## Objective (요청 우선순위 1~9)
1) Lint 오류 수정으로 CI 차단 해제
2) 배경 클릭으로 모달 닫힘(정책 위반) 제거
3) unifiedTaskService 테스트 확대(데이터 안전 + 부분 실패 모드 포함)
4) Sync 모듈 안정성 강화(브랜치 커버리지 + 시나리오 기반 테스트)
5) 테스트 중복 통합(time-block-visibility) + (테스트 범위) alias 정리
6) Optimistic Update 적용(스토어/서비스 레벨 Dexie 선반영 + 롤백)
7) ADHD UX 개선(항상-위 토글 툴바 이동, 히트 영역 확대)
8) 경로 스타일 통일(코드베이스 alias 적용)
9) 가드 클로즈 추가(시간 블록 유틸 등)

## Scope & Constraints
- Frontend/Renderer 중심. Electron IPC/백엔드/원격 DB 로직은 “변경”이 아니라 “연동 고려” 수준으로 제한.
- 정책 준수: localStorage 금지(theme만 예외), defaults 단일 출처, optional chaining, 모달 배경 클릭 닫기 금지.
- PR은 작게(ADHD-friendly 성취감), 단독 revert 가능하도록 커밋 분리.

## Assumptions
- 현재 package.json 버전은 1.0.170이며, 이번 배치의 Target Release는 1.0.171로 운영 가능하다.
- “배경 클릭 금지” 정책은 예외 없이 적용한다(예외가 있다면 PR2 전에 명시 필요).

## OPEN QUESTION (승인 필요)
1) 오빠, 이번 배치(아래 PR1~PR8)를 **1.0.171 한 릴리즈**로 묶을까요, 아니면 (PR1~PR5=1.0.171 / PR6~PR8=1.0.172+)처럼 **2단 릴리즈**로 갈까요?

---

# PR Roadmap (Order + Dependencies)

아래 PR 번호는 “실행 순서” 기준이며, 병렬 가능한 PR은 명시했습니다.

## PR 1 — chore(lint): unblock CI by fixing eslint errors (Priority #1)
- 목표: `npm run lint`를 CI 게이트로 복구(에러/경고 0).
- 주요 변경 파일(대표): `src/**` 중 lint 리포트에 잡힌 파일들(중복 import, hooks deps 등), (참고) lint-errors.txt.
- 예상 소요 시간: 1~3시간
- 의존성: 없음(모든 PR의 바닥)

## PR 2 — fix(modal): remove backdrop-click close violation (BattleMissionsSection) (Priority #2)
- 목표: 배경 클릭으로 닫히는 overlay 동작 제거(입력 손실 방지).
- 주요 변경 파일:
  - src/features/settings/components/tabs/battle/BattleMissionsSection.tsx
- 예상 소요 시간: 0.5~1시간
- 의존성: PR 1 권장(하지만 기술적으로는 독립)

## PR 3 — test(task): expand unifiedTaskService coverage incl. partial-failure branches (Priority #3)
- 목표: 작업 위치 탐색/이동/업데이트 로직의 분기(dual-storage, not-found, 경계 날짜 탐색, 부분 실패)를 테스트로 고정.
- 주요 변경 파일:
  - src/shared/services/task/unifiedTaskService.ts (동작 변경 없음; 필요 시 테스트 가능하도록 작은 구조 정리만)
  - tests/unified-task-service.test.ts
- 예상 소요 시간: 3~6시간
- 의존성: PR 1

## PR 4 — test(sync): improve conflictResolver branch coverage (Priority #4a)
- 목표: 충돌 해결(conflictResolver)의 분기 커버리지 상승(대표 충돌 타입/필드 누락/타임스탬프/배열 merge 경계).
- 주요 변경 파일:
  - src/shared/services/sync/** (conflictResolver 위치)
  - tests/conflict-resolver.test.ts
- 예상 소요 시간: 2~4시간
- 의존성: PR 1

## PR 5 — test(sync): improve syncCore branch coverage + scenario-focused tests (Priority #4b)
- 목표: syncCore의 실패/재시도/부분 성공(예: retry queue enqueue, remote-only update, early-return guards) 분기들을 테스트로 보호.
- 주요 변경 파일:
  - src/shared/services/sync/firebase/syncCore.ts
  - tests/sync-core.test.ts
  - (필요 시) tests/smoke-sync-engine-basic.test.ts 등 기존 sync 스모크 테스트 보강
- 예상 소요 시간: 3~6시간
- 의존성: PR 1

## PR 6 — chore(test): dedupe time-block-visibility tests + normalize imports in tests (Priority #5)
- 목표: 중복 테스트 파일 통합으로 노이즈/중복 실행 제거, 테스트 파일 내 import 스타일을 정리(필요 시 alias 사용).
- 주요 변경 파일:
  - tests/time-block-visibility.test.ts
  - tests/timeblock-visibility.test.ts
  - (연쇄 수정 가능) 해당 테스트가 import하는 유틸 파일들
- 예상 소요 시간: 1~2시간
- 의존성: PR 1

## PR 7 — refactor(paths): unify import path style using @/ alias across src/** (Priority #8, but scheduled before #6 to reduce conflicts)
- 목표: 코드베이스 경로 스타일을 `@/` alias로 통일해, 이후 리팩토링/이동/검색 비용과 충돌을 줄인다.
- 주요 변경 파일(대표): `src/**` 전반(대량 변경 가능), 필요 시 `vite.config.ts`/`tsconfig.json` 정합성 재확인(정책/동작 변경 최소).
- 예상 소요 시간: 2~6시간(자동화 도구 사용 시 단축)
- 의존성: PR 1, PR 6 완료 후 권장(테스트 파일 중복 정리와 충돌 최소화)
- 비고(ADHD-friendly): 한 PR에 너무 많은 파일이 터지면, `src/shared/**` → `src/features/**` 순으로 2개 PR로 분할 가능.

## PR 8 — feat(store): optimistic inbox→timeblock update with rollback (Priority #6)
- 목표: Inbox에서 시간대 지정 시 강제 reload 없이 즉시 반영(선반영) + 저장 실패 시 롤백(유령 task/중복 방지).
- 주요 변경 파일:
  - src/shared/stores/dailyDataStore.ts
  - src/shared/stores/inboxStore.ts
  - src/features/tasks/InboxTab.tsx
  - (옵션) store 단위 테스트 신규/보강
- 예상 소요 시간: 4~8시간
- 의존성: PR 3 강력 권장(안전망), PR 7 권장(대량 import 충돌 방지)

## PR 9 — feat(ux): move always-on-top toggle into toolbar + enlarge hit targets (Priority #7)
- 목표: “오른쪽 얇은 바” UX를 더 발견 가능하고 오클릭에 강한 형태로 개선(ADHD 친화).
- 주요 변경 파일:
  - src/app/AppShell.tsx (현재 always-on-top 표시/토글 UI 위치 조정)
  - src/features/settings/components/tabs/ShortcutsTab.tsx (설명 문구/힌트 정합)
  - (필요 시) 공용 버튼/툴바 컴포넌트
- 예상 소요 시간: 2~4시간
- 의존성: PR 1, PR 7 권장(충돌 최소)

## PR 10 — fix(utils): add guard clauses in time-block utilities (Priority #9)
- 목표: time-block 관련 유틸에서 undefined/경계값으로 인한 런타임 예외를 가드(early return)로 차단.
- 주요 변경 파일(후보):
  - src/features/schedule/utils/timeBlockVisibility.ts
  - src/features/schedule/utils/timeBlockBucket.ts
  - src/features/schedule/utils/threeHourBucket.ts
  - 관련 테스트(유틸 테스트)
- 예상 소요 시간: 2~4시간
- 의존성: PR 7 이후 권장(경로/리네임 충돌 최소), PR 8과는 파일이 겹칠 수 있어 순서 조정 가능

## PR 11 — chore(release): bump version + release notes for batch
- 목표: Target Release(기본 제안 1.0.171)로 버전/릴리즈 아티팩트 정합성 확보.
- 주요 변경 파일:
  - package.json
  - (존재 시) CHANGELOG/릴리즈 노트 문서
- 예상 소요 시간: 0.5~1시간
- 의존성: PR 1~PR 10 모두 merge 후 마지막

---

## Dependency Summary (Text)
- PR1 → all
- PR3 → PR8 (권장)
- PR6 → PR7 (권장; 테스트 파일 정리 후 대량 경로 변경)
- PR7 → PR8/PR9/PR10 (권장; 충돌 최소)

## Validation (High-level; 구체 테스트케이스는 QA 문서로 이관)
- Lint: `npm run lint`
- Unit/Integration: `npm test` 및 `npm run test:coverage`(커버리지 상승 확인)
- Manual smoke(짧게): Battle settings 모달 overlay 클릭 시 닫힘 여부, Inbox 배치 즉시 반영/롤백, always-on-top 토글 UI 동작

## Risks / Rollback Notes
- PR7(경로 통일)은 대량 변경이므로, 자동화 적용 + 리뷰 친화(기능 변경 없음) + 필요 시 2 PR로 분할.
- PR8(optimistic update)은 상태 불일치/롤백 누락 위험이 높으므로, 커밋 분리(선반영/롤백/테스트)와 revert 포인트를 명확히.

## Handoff
- Critic 리뷰 필요: PR 순서/의존성/범위 과대 여부 점검 후 Implementer로 전달.
