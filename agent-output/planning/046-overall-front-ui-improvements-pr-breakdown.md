# Plan: Overall Front/UI Improvements — PR-sized Breakdown (with Early Observability)

## Plan Header
- Plan ID: plan-2025-12-28-overall-front-ui-improvements-pr-breakdown
- Target Release: **1.0.176 (제안; 현재 package.json = 1.0.175 기준 patch +1)**
- Epic Alignment: “프론트/UI 안정성·일관성·성능을 측정 가능하게 개선하고, 정책(Repo/Defaults/Modal)을 재고정해 회귀를 줄인다.”
- Status: Proposed

## Changelog
- 2025-12-28: 최초 작성(관측성 PR을 초반에 배치, 11개 PR로 분해, 의존성/검증/롤백 포함).

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want 앱의 핵심 흐름(인박스→스케줄 배치, 모달 입력/저장, 시간블록 인지)이 예측 가능하고 즉각 피드백을 주며, 개선 효과를 수치로 확인할 수 있게 해서, so that 계획-실행 흐름이 끊기지 않고 회귀/데이터 손실에 대한 불안을 낮출 수 있다.

## Scope / Constraints
- Frontend/Renderer(UI) 중심. 백엔드/Supabase/Electron IPC 구현 금지(설계 고려/문서화만 가능).
- 정책 준수:
  - localStorage 사용 금지(테마 키만 예외)
  - defaults는 `src/shared/constants/defaults.ts`만 정본
  - Repository 패턴 준수(직접 Dexie 호출 최소화/제거 방향)
  - 모달 UX: 배경 클릭 닫기 금지, ESC는 스택 top-most만 닫기, `useModalEscapeClose` 계열 훅 사용
  - 중첩 객체 접근은 optional chaining
- 테스트: Vitest 기반, 기존 `tests/` 스타일/패턴 존중.

## Inputs / References
- 문제 분류/측정 포인트: agent-output/analysis/047-front-improvement-hypotheses-analysis.md
- 문제 분류(정책 위반 후보 포함): agent-output/analysis/032-repo-problem-taxonomy-analysis.md
- 모달/핫키 표준화 아키텍처 권고: agent-output/architecture/006-modal-hotkeys-standardization-architecture-findings.md
- 구조 개선 대안(A/B): agent-output/architecture/003-frontend-structural-improvements-architecture-findings.md
- 기존 PR 분해 참고(12 PR): agent-output/planning/033-top10-improvements-pr-breakdown.md

---

# PR Plan (11 PRs)

> 각 PR은 “작게, 되돌리기 쉽게, 관측 가능하게”를 원칙으로 한다.

## PR 1 — chore(lint): unblock merges by fixing eslint errors (max-warnings=0)
- 목표: `npm run lint`를 신뢰 가능한 게이트로 유지하면서, 현존 lint 실패/경고를 제거해 후속 PR의 마찰을 낮춘다.
- 변경 범위: `src/**` 전반(보고서에 잡힌 파일 중심). 린트 규칙 자체 변경은 원칙적으로 지양.
- 위험도: 중간(react-hooks deps 수정 시 런타임 동작 변화 가능).
- 검증(테스트/측정): `npm run lint`, `npm run test`, 핵심 화면 수동 스모크(스케줄/인박스/모달 2~3개).
- 롤백: 파일 단위로 되돌리기(훅 deps 변경은 커밋 분리 권장).

## PR 2 — feat(observability): add dev-only “Diagnostics” for UI latency & event timings
- 목표: 이후 성능/UX 개선의 효과를 **수치로 비교**할 수 있게, 로컬/개발 환경에서만 동작하는 관측 채널을 추가한다.
- 변경 범위(예):
  - `src/shared/lib/eventBus` 성능 리포트 노출(기존 미들웨어/후크가 있다면 활용)
  - 스케줄/타임라인 화면의 “렌더 커밋 시간/빈도” 및 “활성 타이머 수” 요약
  - (선택) Dexie `systemState` 접근 빈도 카운트(Repository 경유율 확인)
  - 진입 UI는 Settings 내 Diagnostics 탭 또는 기존 diagnose 페이지(public/diagnose.html) 확장
- 위험도: 낮음(기본적으로 dev-only, 사용자 데이터 변경 없음). 다만 계측 코드가 프로덕션 번들/경로에 섞이지 않도록 주의.
- 검증(테스트/측정): `npm run test`, `npm run test:coverage`(변화 없을 수 있음), electron:dev에서 Diagnostics 화면 표시/비활성(프로덕션) 확인.
- 롤백: 계측 모듈/탭 삭제로 즉시 복구 가능(기능 플래그/환경 가드로 보호).

## PR 3 — test(ui-infra): introduce RTL+jsdom harness for policy-level UI tests
- 목표: “모달 정책/핫키 정책” 같은 UI 회귀를 자동으로 잡을 수 있는 최소 기반을 만든다.
- 변경 범위: `vitest.config.ts`, `tests/setup.ts`, `tests/ui/**`(또는 기존 tests 패턴에 맞춘 위치).
- 위험도: 중간(테스트 런타임 증가/플레이키 가능).
- 검증(테스트/측정): `npm run test` green, jsdom 기반 테스트 최소 1~3개 성공.
- 롤백: UI 테스트 디렉터리 및 jsdom 설정만 제거하면 기존 node 기반 테스트로 복귀.

## PR 4 — fix(modal): enforce “ESC closes top-most only” by removing stack bypasses
- 목표: ESC 동작이 모달마다 달라 생기는 불안/입력 손실을 제거한다(스택 규칙 준수).
- 변경 범위: `src/shared/hooks/useModalEscapeClose.ts`, `src/features/goals/GoalsModal.tsx`, `src/features/battle/components/BossAlbumModal.tsx`.
- 위험도: 중간(기존 “내부 상태 먼저 닫기” UX가 달라질 수 있음).
- 검증(테스트/측정): PR3 기반 RTL로 ESC 스택 동작 검증 + electron:dev 수동 확인.
- 롤백: 모달별 기존 ESC 핸들러로 되돌리기(단, 재드리프트 위험 문서화).

## PR 5 — feat(modal): standardize Ctrl/Cmd+Enter primary action (IME-safe, top-most)
- 목표: 입력형 모달에서 Ctrl/Cmd+Enter가 “일관된 primary 실행”을 제공하도록 표준화한다(IME 조합 중 무시 포함).
- 변경 범위: 공용 훅 추가/정리(`src/shared/hooks/**`) + 대표 모달 적용(스케줄 Task/Memo, BulkAdd, TaskBreakdown, Shop 등).
- 위험도: 중간(키 이벤트 충돌/textarea UX 충돌 가능).
- 검증(테스트/측정): PR3 기반 RTL(대표 1~2개) + 수동 스모크.
- 롤백: 훅 적용 모달만 이전 구현으로 revert 가능(모달별 커밋 분리 권장).

## PR 6 — fix(modal): remove “backdrop click closes modal” violations
- 목표: 배경 클릭으로 닫히는 모달을 제거해 입력 손실/실수 종료를 방지한다(정책 재고정).
- 변경 범위: 위반 후보 모달/오버레이 컴포넌트(예: settings battle 탭 섹션 등) + 공통 모달 컴포넌트(있다면).
- 위험도: 낮음(정책 준수 방향). 다만 사용자가 “빠르게 닫기”를 기대하던 화면은 UX 재조정 필요.
- 검증(테스트/측정): RTL로 backdrop click 시 닫히지 않음 확인(가능한 범위) + 수동 확인.
- 롤백: 오버레이 클릭 핸들러만 복구하면 되지만, 정책 위반 재발로 기록.

## PR 7 — test(core): raise `unifiedTaskService` coverage as safety net for move/update flows
- 목표: 작업 이동/업데이트의 핵심 로직 회귀를 조기에 탐지해 데이터 손상 위험을 낮춘다.
- 변경 범위: `src/shared/services/task/unifiedTaskService.ts`, `tests/unified-task-service.test.ts`.
- 위험도: 낮음(테스트 중심). 다만 과도한 구현 결합은 피한다.
- 검증(테스트/측정): `npm run test:coverage`에서 해당 모듈 coverage 상승 확인.
- 롤백: 테스트만 제거하면 기능 영향 없이 복귀.

## PR 8 — fix(inbox/schedule): optimistic inbox→timeblock updates (no forced reload)
- 목표: 인박스에서 스케줄 배치가 즉시 반영되도록 하여(낮은 지연/즉시 피드백) ADHD 친화 흐름을 강화한다.
- 변경 범위: `src/shared/stores/*`(inbox/dailyData 관련) + 해당 UI(인박스 탭/스케줄 배치 UI).
- 위험도: 높음(두 스토어 간 불일치/롤백 누락 위험).
- 검증(테스트/측정): `npm run test` + 스토어 단위 테스트(가능 범위) + PR2 Diagnostics로 체감 지연/리렌더 변화 관측.
- 롤백: optimistic 경로를 feature-flag(또는 설정)로 감싸거나, 기존 “강제 새로고침/재조회” 방식으로 revert.

## PR 9 — refactor(systemState): route usage through `systemRepository` + key inventory
- 목표: systemState 접근을 단일 관문으로 수렴시켜 키/기본값/마이그레이션 드리프트를 줄인다.
- 변경 범위: `src/data/repositories/systemRepository.ts` 중심 + direct `db.systemState` 접근 치환(핫패스부터).
- 위험도: 중간(초기화 타이밍/undefined 처리).
- 검증(테스트/측정): `npm run test` + PR2에서 “systemState 접근 카운트/경유율” 감소 확인(가능 시).
- 롤백: 변경 모듈 단위로 되돌리기 가능(단, 재드리프트 위험).

## PR 10 — refactor(schedule): unify time-block bucket rules/constants (single source of truth)
- 목표: 시간 블록 경계/라벨/버킷 규칙의 불일치를 줄여 사용자 인지 혼란을 제거한다.
- 변경 범위: `src/features/schedule/**`(버킷/유틸) + `src/shared/constants/defaults.ts`(필요 시 상수 정본화).
- 위험도: 중간(표시/계산의 체감 변화 가능).
- 검증(테스트/측정): 관련 유틸 테스트 통과 + electron:dev에서 시간 경계/라벨 확인, PR2로 화면 반응성 변화 비교.
- 롤백: 상수/유틸 변경을 분리 커밋으로 유지해 단계별 revert 가능.

## PR 11 — docs + release: policy checklist + diagnostics usage + optional patch bump
- 목표: 정책(로컬스토리지/Defaults/모달/Repo)과 “PR별 검증 커맨드”를 ADHD 친화 체크리스트로 문서화하고, 필요 시 patch 릴리즈를 준비한다.
- 변경 범위: `README.md` 및 필요 문서, (선택) `package.json` 버전 bump/CHANGELOG.
- 위험도: 낮음.
- 검증(테스트/측정): 링크/명령 정합성 확인 + `npm run lint`, `npm run test` 재확인.
- 롤백: 문서/버전 변경 revert.

---

# PR Dependency Graph (Text)

- PR1 → (PR2..PR11 전반)  
  - 이유: lint 게이트를 먼저 안정화해야 후속 PR이 병목 없이 머지 가능
- PR2 → PR8, PR9, PR10  
  - 이유: 성능/반응성/경유율 변화(개선 효과)를 계측으로 비교
- PR3 → PR4, PR5, PR6  
  - 이유: 모달 정책을 자동 검증하려면 RTL/jsdom 기반이 필요
- PR4 → PR5 (권장)  
  - 이유: ESC 스택 규칙을 먼저 정착시키면 primary 핫키도 top-most 일관성 유지가 쉬움
- PR7 → PR8 (권장)  
  - 이유: 상태 이동/업데이트 변경 전에 핵심 서비스 테스트 안전망 확보

# Recommended Execution Order
1) PR1 (lint)
2) PR2 (observability/diagnostics)
3) PR3 (RTL/jsdom infra)
4) PR4 (ESC 스택 준수)
5) PR5 (Ctrl/Cmd+Enter 표준화)
6) PR6 (backdrop click 위반 제거)
7) PR7 (unifiedTaskService 테스트 강화)
8) PR8 (optimistic inbox→timeblock)
9) PR9 (systemState repository 수렴)
10) PR10 (time-block bucket 규칙 통합)
11) PR11 (docs + optional release)

---

# Quick Wins (2–3)
- PR1: lint 게이트 안정화(머지 마찰 즉시 감소)
- PR6: backdrop click 닫힘 제거(입력 손실 체감 개선)
- PR4: ESC 닫힘 일관성(모달 불안/피로 감소)

# Long-term Initiatives (2–3, 별도 승인/별도 에픽 권장)
- L1) 구조 개선 B안(Use-case/Port 분리 등): agent-output/architecture/003-frontend-structural-improvements-architecture-findings.md의 B안 검토 기반
- L2) UI 테스트 범위 확대(핵심 플로우별 “정책/스모크” 커버리지 체계화): PR3 이후 단계적 확장
- L3) 스케줄 화면 성능 예산/가상화(대량 task/타임라인 렌더 최적화): PR2 계측 데이터 기반으로 병목 확정 후 진행

---

# OPEN QUESTIONS (진행 전 확인)
1) Observability(진단 UI)는 “Settings 탭” vs “별도 diagnose 페이지(public/diagnose.html)” 중 어디가 더 선호인가?
2) Ctrl/Cmd+Enter 적용 범위: “입력형 모달만 opt-in(권장)”으로 고정할까, 아니면 더 넓힐까?
3) Target Release는 1.0.176으로 잡아도 될까(현재 1.0.175)? 아니면 릴리즈 PR은 생략하고 기능 PR만 병합할까?
