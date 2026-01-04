---
ID: 58
Origin: 58
UUID: a3f91c2e
Status: Active
---

# Plan: 문서 경로 의존 없는 PR 단위 분해 (Front/UI 중심)

- Target Release: **1.0.182 (제안; 현재 package.json = 1.0.181)**
- Epic Alignment: Critic Top 6 기반(린트, 모달 UX, unifiedTaskService 테스트/데이터 경로 안전망, Sync 테스트 강화, Always-on-top UX, 유틸 가드)
- Status: Active

## Value Statement and Business Objective
As a 사용자인 오빠, I want 프론트/UI 품질 게이트(린트/모달/핵심 서비스 테스트)가 먼저 단단해지길, so that 기능 추가/개선 전에 회귀·불안정·UX 혼란을 줄이고 ADHD 친화적인 ‘예측 가능/일관’ 경험을 유지한다.

## Scope / Constraints
- 이번 로드맵은 **프론트/UI 중심**(테스트 포함)만 구현 대상으로 간주한다.
- 백엔드/IPC/Sync 전략 변경은 **고려사항**으로만 다룬다(동작 변경 금지, 테스트/가드 중심).
- Anti-goals: alias 대통합, optimistic update 조기 구현, AppShell 대리팩토링, 레거시 모듈화, sync 테스트 통합 정리(보호 먼저).

## Architecture Guardrails (must hold)
- UI → Store/Usecase → Repo → Dexie 단방향
- Repo에서 event emit 금지(emit은 store/orchestrator에서만)
- UI/Store에서 Firebase 직접 호출 금지(Repo 경유)
- defaults 단일 출처: [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts)
- localStorage 금지(테마 예외만 허용)
- 모달 UX: 배경 클릭으로 닫기 금지, ESC로 닫기(필요 시 명시적 닫기 버튼 제공)

## 2주 로드맵
### Week 1 (Foundation + UX Consistency)
1) PR1: Lint/타입 안전 기반 정리(게이트 복구)
2) PR2: 모달 UX 힌트 보강 + 배경 클릭 무시 회귀 보호 + MissionModal 닫기 버튼
3) PR3: unifiedTaskService 테스트 + 핵심 데이터 경로 안전망(‘안전한 읽기/기본값’)

### Week 2 (Reliability + UX Polish)
4) PR4: Sync 테스트 강화(동작 변경 없이 보호막 확장)
5) PR6: 유틸 가드 추가(고위험 경로만)
6) PR5: Always-on-top UX 개선(UI만, IPC/전략 변경 금지)
7) PR7: 버전/릴리즈 아티팩트 업데이트(스택 마무리)

## PR List (문서 경로 의존 없이 실행 가능)

### PR1 — Lint 오류 수정 (Gate green)
- 목표: `npm run lint`를 0 warnings/0 errors로 통과시키고, 이후 PR의 노이즈를 제거한다.
- 세부 Task: [agent-output/planning/059-pr1-lint-ts-task-breakdown-2026-01-03.md](agent-output/planning/059-pr1-lint-ts-task-breakdown-2026-01-03.md)
- 변경 범위(예시): [src](src)/, [tests](tests)/ 중심(필요 시 eslint-disable 정리 포함)
- 리스크: 자동 수정이 의미 변화로 이어질 수 있음(특히 unused 제거/의존 import).
- 검증 방법: `npm run lint`; `npm run test`.
- 롤백 플랜: PR revert(기능 변경이 섞이지 않게 “린트만” 유지).
- 규모 제한: ≤ 15 files, ≤ 400 LOC(초과 시 PR 분리).
- ADHD-friendly 체크: “경고/에러 팝업(시각적 잡음)”을 먼저 제거해 집중 유지.

### PR2 — 모달 UX 힌트 보강 + 배경 클릭 무시 회귀 보호
- 목표: (현행 유지) 배경 클릭으로 닫히지 않는 동작을 **테스트로 보호**하고, ESC 힌트를 추가해 “어떻게 닫는지”를 즉시 알 수 있게 한다. 추가로 `MissionModal`에 명시적 닫기 버튼을 제공한다.
- 세부 Task: [agent-output/planning/060-pr2-modal-ux-hints-regression-plan-2026-01-03.md](agent-output/planning/060-pr2-modal-ux-hints-regression-plan-2026-01-03.md)
- 변경 범위(예시): [src/features](src/features)/**/\*Modal*.tsx, [tests](tests)/ 모달 회귀 테스트
- 리스크: 힌트가 과하면 산만해질 수 있음(ADHD) → 최소 힌트로 제한.
- 검증 방법: `npm run test`; 대표 모달(설정/인박스/전투) 수동 스모크.
- 롤백 플랜: 힌트/테스트 단위 revert(기능 동작과 분리).
- 규모 제한: ≤ 12 files, ≤ 300 LOC.
- ADHD-friendly 체크: 닫기 방법이 눈에 보이면 불안/인지부하 감소.

### PR3 — unifiedTaskService 테스트 + 핵심 데이터 경로 안전망
- 목표: unifiedTaskService의 핵심 동작을 테스트로 고정하고, nested data 접근을 안전하게(기본값/옵셔널 체이닝/스키마 검증) 만들어 회귀를 막는다.
- 변경 범위(예시): [src/shared](src/shared)/services, [src/data](src/data)/repositories(필요 시 단방향 유지), [tests](tests)/unified-*
- 리스크: 테스트가 구현 디테일에 과도 의존하면 유지보수 비용 증가.
- 검증 방법: `npm run test`; `npm run test:coverage`(변경된 핵심 모듈 기준 향상 확인).
- 롤백 플랜: “테스트만” 분리 revert 가능(코드 안전망이 문제면 가드 변경만 롤백).
- 규모 제한: ≤ 12 files, ≤ 450 LOC.
- ADHD-friendly 체크: 데이터 깨짐으로 인한 갑작스런 UI 이상(혼란)을 사전에 차단.

### PR4 — Sync 테스트 강화(동작 변경 없이)
- 목표: Sync 관련 고위험 경로를 **테스트로 보호**하되, Sync 전략/동작 변경은 하지 않는다.
- 변경 범위(예시): [tests](tests)/sync-*, [src/shared](src/shared)/services/sync(테스트 가능성 개선이 필요할 때만 최소 변경)
- 리스크: 타이밍/비동기 기반 테스트의 flake(환경 의존).
- 검증 방법: `npm run test`(sync-* 중심); 필요 시 `npm run test:watch`로 안정성 확인.
- 롤백 플랜: flaky 테스트만 선별 revert(보호막을 잃지 않게 원인 수정 후 재도입).
- 규모 제한: ≤ 10 files, ≤ 350 LOC.
- ADHD-friendly 체크: “가끔만 터지는 이상 현상”을 줄여 신뢰감 유지.

### PR5 — Always-on-top UX 개선(UI만)
- 목표: Always-on-top 기능의 상태/의도/피드백을 UI에서 더 명확히 보여준다(표시, 툴팁, 단축키 힌트 등). **IPC/윈도우 제어 로직 변경은 금지**.
- 변경 범위(예시): [src/app](src/app)/, [src/features](src/features)/ (상단바/설정/토글 UI), [src/shared](src/shared)/stores(상태 읽기/표시만)
- 리스크: 실제 always-on-top 상태와 UI 표시가 불일치할 수 있음(기존 데이터 소스 확인 필요).
- 검증 방법: `npm run lint`; `npm run test`; 수동 스모크(토글→표시 변화→새로고침/재실행 후 유지 여부 확인은 기존 메커니즘 범위에서).
- 롤백 플랜: UI 표시/문구 변경만 revert(기능 토글 자체는 건드리지 않기).
- 규모 제한: ≤ 12 files, ≤ 400 LOC.
- ADHD-friendly 체크: 상태가 “보이는” UI로 불안/재확인 행동 감소.

### PR6 — 유틸 가드 추가(고위험 경로만)
- 목표: 자주 깨지는 입력/날짜/nullable 경로에 “작고 재사용 가능한” 가드를 추가해 런타임 오류와 엣지 케이스를 줄인다.
- 변경 범위(예시): [src/shared](src/shared)/utils, [src/shared](src/shared)/lib, (필요 시) [tests](tests)/*-utils*
- 리스크: 과도한 가드가 문제를 숨길 수 있음(조용히 삼키지 말고 명시적으로 처리).
- 검증 방법: `npm run test`; 관련 유틸 테스트 추가 시 해당 파일군 통과.
- 롤백 플랜: 새 유틸/호출부만 revert(기존 흐름 복구 용이).
- 규모 제한: ≤ 8 files, ≤ 250 LOC.
- ADHD-friendly 체크: 예외 팝업/페이지 깨짐 같은 “방해 자극” 최소화.

### PR7 — 버전/릴리즈 아티팩트 업데이트(스택 마무리)
- 목표: 2주 스택이 완료되면 릴리즈 메타(버전/변경 로그)를 considersation 하에 정합성 있게 갱신한다.
- 변경 범위(예시): [package.json](package.json), (존재 시) CHANGELOG/릴리즈 노트 문서
- 리스크: 버전 정책 충돌(운영 릴리즈 라인과 불일치).
- 검증 방법: `npm run lint`; `npm run test`; 패키지 버전 일관성 확인.
- 롤백 플랜: 버전 bump만 revert(기능 PR은 그대로 유지).
- 규모 제한: ≤ 3 files, ≤ 80 LOC.
- ADHD-friendly 체크: 릴리즈 노트가 명확하면 “무엇이 바뀌었는지” 파악 스트레스 감소.

## Dependency Graph (텍스트)
- PR1 → PR2
- PR1 → PR3
- PR1 → PR4
- PR1 → PR6
- PR2 → PR5 (모달/단축키 일관성 정리 후 UX 노출 강화)
- PR6 → PR3 (선택; 가드가 필요한 경우에만)
- PR3 → PR7
- PR4 → PR7
- PR5 → PR7

## Starter PR 선정
- Starter: **PR1 (Lint 오류 수정)**
- 이유: CI/리뷰 노이즈를 먼저 제거해 이후 PR들이 “의미 있는 변화(UX/테스트)”만 담도록 만들고, 병렬 작업(모달/테스트)을 안전하게 시작할 수 있다.

## OPEN QUESTION (BLOCKING)
- Target Release를 1.0.182로 잡는 것이 오빠의 운영/배포 흐름과 맞아? (현재 [package.json](package.json)=1.0.181)
