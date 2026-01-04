---
ID: 60
Origin: 60
UUID: 7fb92c4e
Status: Active
---

# Plan: PR2 — 모달 UX 힌트 보강 + 배경 클릭 회귀 보호 (2026-01-03)

- Target Release: **1.0.182** (상위 배치 계획 참조: `agent-output/planning/058-foundation-pr-breakdown-no-doc-deps-2026-01-03.md`; 현재 `package.json`=1.0.181)
- Epic Alignment: Modal UX Consistency (ESC top-of-stack), ADHD-safe affordances, 회귀 방지(자동화)
- Status: Active

## Changelog
- 2026-01-03: PR2 범위를 “배경 클릭 제거”에서 “현행 유지 검증 + UX 힌트 보강 + MissionModal 닫기 버튼”으로 축소/정의.

## Value Statement and Business Objective
As a 사용자(오빠), I want 모달에서 “어떻게 나갈 수 있는지(ESC/닫기)”가 즉시 보이길, so that 실수/불안(ADHD 인지 부하)을 줄이고 예측 가능한 닫기 경험을 유지한다.

## Objective
1) 현행 동작 유지 확인: 모달 backdrop click이 닫기를 유발하지 않는다는 가정이 깨지지 않도록 자동화로 보호한다.
2) 빈틈 보강: ESC 힌트가 없는 모달에 최소 힌트를 추가하고, `MissionModal`에 명시적 닫기 버튼을 제공한다.

## Scope / Constraints
- **동작 변경 금지**: 기존 닫기 로직(ESC, onClose 호출) 및 저장/액션 흐름은 변경하지 않는다.
- **UI-only**: backend/Supabase/Electron IPC/sync 전략 변경 금지.
- **최소 변경**: 디자인/카피는 최소(헤더 또는 footer에 작은 힌트), 추가 의존성 도입은 피한다.

## Inputs / References
- 분석 결과(종료됨): `agent-output/analysis/closed/060-pr2-modal-backdrop-analysis.md`
- 관련 훅/스택: `src/shared/hooks/useModalEscapeClose.ts`, `src/shared/hooks/useModalHotkeys.ts`, `src/shared/hooks/modalStackRegistry.ts`
- 대표 모달 후보: 
  - `src/features/tasks/InboxModal.tsx`
  - `src/features/settings/SettingsModal.tsx`
  - `src/features/settings/SyncLogModal.tsx`
  - `src/features/shop/ShopModal.tsx`
  - `src/shared/components/MemoMissionModal.tsx`
  - `src/features/battle/components/MissionModal.tsx`

## Assumptions
- A1: PR2 범위는 “정책 강화(행동 변경)”가 아니라 “UX 힌트/가시성 보강 + 회귀 방지”로 유지한다.
- A2: 모달 힌트는 **반드시 ‘ESC’ 중심**(필요 시 ‘닫기 버튼’ 병행)으로 통일한다.

## OPEN QUESTION
- Q1 (Release): 오빠 운영 흐름에서 PR2는 상위 배치 Target Release **1.0.182**에 포함해도 괜찮아?
- Q2 (Coverage): 힌트 적용 범위를 (a) 상위 6개 핵심 모달에 우선 적용 vs (b) 모달 파일 전수 적용 중 어느 쪽이 PR2에 더 맞아?

## Task List (2~3개로만 분해)

### T60-01 — 회귀 보호: “모달 배경 클릭은 닫지 않는다” 자동화
- 목표: `*Modal*.tsx` 계열에서 backdrop click으로 닫히는 패턴이 재도입되지 않도록 회귀 체크를 추가한다.
- 영향 파일(예상):
  - `tests/` 하위 신규 테스트 1개 또는 기존 테스트(`tests/modal-hotkeys.test.ts`) 확장 1개
  - (필요 시) `vitest.config.ts`는 변경하지 않는 것을 목표로 함
- 예상 LOC: 40–120
- 검증방법(고수준): `npm run test`로 회귀 체크 포함 전체 통과 확인
- 롤백 전략: 신규/확장된 테스트만 revert(제품 코드 변경 없이도 롤백 가능)

### T60-02 — UX 힌트 보강: ESC 안내(최소) 추가
- 목표: ESC로 닫을 수 있음을 화면에서 즉시 인지할 수 있도록 최소 힌트를 추가한다(footer 또는 제목 옆).
- 영향 파일(예상):
  - (선호) 공유 UI 조각 1개 추가: `src/shared/components/` 하위(예: Hotkey/ESC hint 컴포넌트)
  - 적용 대상(우선순위 높은 모달들, 분석에서 ‘힌트 부족’로 언급된 그룹):
    - `src/features/tasks/InboxModal.tsx`
    - `src/features/settings/SettingsModal.tsx`
    - `src/features/settings/SyncLogModal.tsx`
    - `src/features/shop/ShopModal.tsx`
    - `src/shared/components/MemoMissionModal.tsx`
  - (선택) 범위 확대 시: `src/**/*Modal*.tsx` 중 힌트가 없는 모달들
- 예상 LOC: 30–180 (적용 범위에 따라 변동)
- 검증방법(고수준): `npm run test`; (수동) 대표 모달 2~3개에서 힌트 노출 확인
- 롤백 전략: 힌트 컴포넌트 + 적용 변경만 revert(모달 닫기 동작에는 영향 없음)

### T60-03 — MissionModal: 명시적 닫기 버튼 추가(ESC 병행)
- 목표: `MissionModal`에 ‘닫기’ 버튼을 추가해 ESC 의존도를 낮춘다(기존 ESC 닫기 유지).
- 영향 파일(예상):
  - `src/features/battle/components/MissionModal.tsx`
  - (필요 시) 관련 하위 컴포넌트/스타일 조정: `src/features/battle/components/modal/*`
- 예상 LOC: 15–60
- 검증방법(고수준): `npm run test`; (수동) 전투 화면에서 모달 열기→닫기 버튼/ESC로 닫힘 확인
- 롤백 전략: `MissionModal` 변경만 revert(다른 모달/정책과 분리)

## Task Execution Order
1) T60-01 (회귀 테스트) — 현재 상태를 먼저 ‘잠금’
2) T60-02 (ESC 힌트) — 공통 힌트 조각 + 핵심 모달 적용
3) T60-03 (MissionModal 닫기 버튼) — 전투 UX 마무리

## Validation (Non-QA, 고수준)
- `npm run test`
- (변경이 UI 문자열/JSX 위주이므로) `npm run lint`는 선택적으로 수행

## Risks / Mitigations
- R1: 힌트가 과도하면 산만해질 수 있음 → 작은 크기/저대비/‘ESC’ 1개로 제한
- R2: 테스트가 구현 디테일(문자열) 과의존 → “backdrop click으로 닫기 패턴 부재” 같은 구조적 체크 위주로 설계
- R3: MissionModal에 버튼 추가 시 레이아웃 깨짐 → 기존 배치 유지, 버튼은 corner overlay로 최소 침습

## Version Management Milestone
- 이 PR2 단위에서는 `package.json` 버전 bump를 **하지 않는다**(상위 배치 릴리즈 PR에서 Target Release(1.0.182) 정합으로 처리).
