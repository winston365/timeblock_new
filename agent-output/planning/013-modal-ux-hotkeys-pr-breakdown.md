# Plan: 모달 UX 개선 — ESC 닫기 + Ctrl+Enter Primary 실행 (PR Breakdown)

## Plan Header
- Plan ID: plan-2025-12-22-modal-ux-hotkeys
- Target Release: **1.0.165 (제안, 현재 package.json = 1.0.164 기준 patch +1)**
- Epic Alignment: “모달 UX 통일(ESC 닫기 + Primary Ctrl+Enter) + 스택(top-of-stack) + IME/textarea 충돌 고려”
- Status: Draft

## Changelog
- 2025-12-22: PR 3개로 분할(공용 훅/테스트 → ESC 우회 제거 → Primary 단축키 표준화) 및 검증/롤백 포함.

## References
- Architecture: [agent-output/architecture/006-modal-hotkeys-standardization-architecture-findings.md](../architecture/006-modal-hotkeys-standardization-architecture-findings.md)
- Analysis (대상 경로 확정): [agent-output/analysis/012-modal-hotkeys-paths-analysis.md](../analysis/012-modal-hotkeys-paths-analysis.md)

---

## Value Statement and Business Objective
As a 사용자, I want 모든 모달에서 ESC로 예측 가능하게 닫을 수 있고(배경 클릭 닫기 금지 유지), 확인/저장 같은 primary action이 있는 모달은 Ctrl+Enter로 빠르게 실행할 수 있게 해서, so that 모달 조작 마찰을 줄이고 작업 흐름을 키보드 중심으로 안정적으로 유지할 수 있다.

## Objective
- 모든 모달: ESC로 닫힘(중첩 모달은 top-of-stack만 반응)
- Primary action이 있는 모달: Ctrl+Enter로 primary 실행(중첩 모달은 top-of-stack만 반응)
- 기존 ad-hoc window keydown 리스너를 최소화하고 공용 훅 패턴으로 수렴
- IME 조합 중(`isComposing`) 단축키 미동작
- Enter 단독 처리 금지(특히 textarea 줄바꿈과 충돌 방지)

## Scope / Constraints
- Frontend/Renderer(UI)만
- 변경 최소/안전 우선: 리팩터링은 “핫키 처리 경로”에 한정
- “배경 클릭 닫기 금지” UX는 유지(이 계획에서 변경하지 않음)

## Assumptions
- Primary 단축키는 “명확한 긍정 액션(저장/확인/완료/적용)”이 있는 모달에만 opt-in 한다.
- Ctrl+Enter는 textarea/input/contentEditable에서도 **명시적 단축키**로 취급하여 기본 허용하되, 모달별로 opt-out 가능해야 한다(충돌 시 안전하게 끌 수 있어야 함).

## OPEN QUESTION (BLOCKING)
- Target Release를 **1.0.165**로 올리는 것이 운영/로드맵 정책과 맞나요? (현재 package.json = 1.0.164)

## OPEN QUESTION
- macOS에서 Cmd+Enter도 허용할까요? (아키텍처 문서 006은 Ctrl/Cmd 동시 지원을 권고. 요구사항은 Ctrl+Enter만 명시)

---

# PR 단위 분해 (3 PR)

## PR#1 — 공용 훅/유틸 정리 + 단위 테스트 + “대상 식별(검색)” 체크포인트

### Scope
- 목적: ESC + Ctrl+Enter 규칙을 구현하는 **공용 훅(Option A)** 을 추가/정리하고, IME/textarea 충돌 및 top-of-stack 규칙을 테스트로 고정한다.
- 포함: “현재 모달 핫키가 산재/우회되는 경로”를 검색해 목록을 확정(또는 ‘추가 대상 없음’을 문서화)한다.

### 변경 파일 유형(예상)
- Shared hook 추가/수정: `src/shared/hooks/*`
- Shared hook re-export: `src/shared/hooks/index.ts`
- Unit tests: `tests/*hotkey*`, `tests/*modal*` 또는 기존 hook 테스트 인접 파일
- (필요 시) 작은 shared util: `src/shared/utils/*` (YAGNI 준수: 훅 내로 가능하면 유지)

### 검증 방법
- 정적: `npm run lint`
- 자동: `npm test`
- 수동(짧게): 임의 모달 1개를 열고 ESC가 닫히는지, Ctrl+Enter가 (primary가 있을 때만) 동작하는지 1회 확인

### 체크리스트(완료 기준)
- [ ] 공용 훅이 top-of-stack 규칙을 강제(ESC/Primary 공통)
- [ ] `KeyboardEvent.isComposing` 고려(조합 중 단축키 무시)
- [ ] Enter 단독은 처리하지 않음(반드시 Ctrl+Enter)
- [ ] textarea 줄바꿈과 충돌하지 않도록 기본 규칙이 명확(Enter 단독 미처리) + 필요 시 opt-out 옵션 존재
- [ ] 기존 `useModalEscapeClose`와의 관계가 명확(이중 등록/스택 드리프트 방지)
- [ ] Vitest에서 공용 훅 동작이 최소한의 단위 테스트로 고정
- [ ] “대상 식별” 결과가 이 계획 문서에 반영됨: 아래 후보 검색으로 추가 모달이 있으면 PR#2/#3 범위에 편입, 없으면 ‘추가 없음’으로 닫음

### 대상 식별(검색) — PR#1에 포함 (구체 지침)
- 목적: Analyst가 확정한 7개 외에, **(a) ad-hoc ESC 처리**, **(b) Ctrl+Enter 구현 산재**, **(c) primary 버튼은 있으나 단축키 없는 모달**을 찾는다.
- 방법(예):
  - `addEventListener('keydown'` / `window.addEventListener` / `document.addEventListener`
  - `'Escape'` / `key === 'Escape'`
  - `ctrlKey` + `key === 'Enter'` / `metaKey` + `Enter`
  - `requestSubmit()` / `onKeyDown` 핸들러

### 롤백 전략
- 훅은 신규 추가 중심으로 진행하고, 기존 모달 마이그레이션은 PR#2/#3에서 수행 → PR#1은 revert가 쉬움.

---

## PR#2 — ESC 스택 우회 모달 2개를 공용 훅으로 마이그레이션

### Scope
- 목적: window keydown으로 ESC를 직접 처리하며 스택을 우회하는 모달을 제거하고, 공용 훅으로 수렴시켜 “top-of-stack만 닫힘”을 보장한다.
- 대상(분석 012 기반):
  - [src/features/goals/GoalsModal.tsx](../../src/features/goals/GoalsModal.tsx)
  - [src/features/battle/components/BossAlbumModal.tsx](../../src/features/battle/components/BossAlbumModal.tsx)

### 변경 파일 유형(예상)
- Feature modal 컴포넌트: `src/features/**/**Modal.tsx`
- (필요 시) 관련 하위 모달/상태 컴포넌트(단, 범위는 ESC 닫기 로직에 한정)

### 검증 방법
- 정적: `npm run lint`
- 자동: `npm test`
- 수동(핵심):
  - GoalsModal: ESC 시 “자식(예: 주간 목표 모달/서브 상태) 우선 닫기 → 그 다음 본 모달 닫기” 기존 UX가 유지되는지
  - BossAlbumModal: ESC 시 “선택된 보스 상세 닫기 → 그 다음 모달 닫기” 기존 UX가 유지되는지
  - 중첩 모달 상황에서 top-of-stack만 반응하는지(간단 확인)

### 체크리스트(완료 기준)
- [ ] 두 모달에서 ad-hoc window keydown 리스너 제거
- [ ] ESC 처리 로직이 공용 훅 경로로 수렴
- [ ] 기존의 ‘ESC 1단계 동작’(서브 상태/상세 닫기 우선) 유지
- [ ] 배경 클릭 닫기 금지 동작 유지(이 PR에서 변경하지 않음)
- [ ] 중첩 모달에서 ESC가 “최상단 1개만” 닫는 동작이 유지

### 롤백 전략
- 각 모달별로 변경이 국소적이어야 함(리스너/훅 적용부만). 문제 시 해당 모달 파일만 revert.

---

## PR#3 — Primary action 모달에 Ctrl+Enter 표준 wiring(산재 구현 제거) + 회귀 방지

### Scope
- 목적: primary action이 있는 모달에서 Ctrl+Enter 동작을 공용 훅으로 수렴시키고, 기존 산재 구현(윈도우 리스너/DOM query/onKeyDown)을 제거한다.
- 대상(분석 012 기반):
  - [src/features/schedule/TaskModal.tsx](../../src/features/schedule/TaskModal.tsx)
  - [src/features/schedule/MemoModal.tsx](../../src/features/schedule/MemoModal.tsx)
  - [src/features/tasks/BulkAddModal.tsx](../../src/features/tasks/BulkAddModal.tsx)
  - [src/features/tasks/TaskBreakdownModal.tsx](../../src/features/tasks/TaskBreakdownModal.tsx)
  - [src/features/shop/ShopModal.tsx](../../src/features/shop/ShopModal.tsx)

### 변경 파일 유형(예상)
- Feature modal 컴포넌트: `src/features/**/**Modal.tsx`
- (필요 시) form submit/primary handler가 위치한 helper/hook (단, 동작 변경 최소)
- (선택) 회귀 방지용 테스트 보강: `tests/*modal*`, `tests/*hotkey*` (핫키 훅이 이미 PR#1에서 커버되면 PR#3은 최소화)

### 검증 방법
- 정적: `npm run lint`
- 자동: `npm test`
- 수동(핵심):
  - 각 모달에서 Ctrl+Enter가 primary를 실행하는지
  - textarea가 있는 모달에서 Enter 단독 줄바꿈이 유지되는지
  - IME 조합 중 Ctrl+Enter가 발동하지 않는지(한글 입력 상태에서 간단 확인)

### 체크리스트(완료 기준)
- [ ] 5개 모달의 Ctrl+Enter 처리가 공용 훅으로 수렴
- [ ] ad-hoc window keydown/DOM query/onKeyDown 기반 구현이 제거되거나 최소화
- [ ] top-of-stack 규칙 준수(중첩 모달에서 하위 모달이 Ctrl+Enter를 먹지 않음)
- [ ] IME 조합 중 단축키 무시
- [ ] Enter 단독은 처리하지 않음(특히 textarea 줄바꿈 보존)

### 롤백 전략
- 모달별로 분리된 커밋 또는 최소 diff로 구성 → 특정 모달 회귀 시 해당 모달만 revert 가능.

---

## Testing Strategy (High-level)
- Unit: 공용 훅(키 이벤트 처리)이 IME/Enter 규칙/top-of-stack을 준수하는지 Vitest로 고정
- Integration(얕게): 대표 모달 1~2개에서 훅 사용이 정상(ESC close + primary execute)
- Non-goals: 새로운 테스트 프레임워크 도입, 대규모 e2e는 범위 밖

## Risks
- IME 관련: `isComposing` 신뢰성/브라우저 차이로 인해 특정 입력기에서 오작동 가능
- 이벤트 전파: 기존 모달 내부 단축키(탭 이동 등)와 충돌 가능
- 스택 드리프트: 훅 이중 등록 또는 기존 ad-hoc 리스너 잔존 시 top-of-stack 규칙이 깨질 수 있음

## Rollback / Mitigation
- PR#1은 신규 훅+테스트 중심으로 설계해 쉽게 revert
- PR#2/#3은 모달 단위로 국소 변경(리스너 제거 + 훅 적용)만 수행
- 문제 발생 시: 영향 모달만 revert → 공용 훅은 유지(또는 훅 옵션 default를 보수적으로 조정)
