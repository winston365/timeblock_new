# 006 — 전 모달 공통 키보드 UX 표준화 (ESC 닫기 + Ctrl/Cmd+Enter Primary 실행)
Status: APPROVED_WITH_CHANGES

## Changelog
- 2025-12-22: timeblock_new의 모달 키보드 UX(ESC, Ctrl/Cmd+Enter)를 “스택(top-of-stack) + IME 고려”로 표준화하기 위한 아키텍처 권고안 정리.

## 현 상태(Repo 근거)
### ESC의 “정석 경로”는 이미 존재
- 스택 기반 ESC 닫기 훅이 존재: [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts)
  - `Set<symbol>` 기반 전역 스택을 사용하며, **가장 마지막(=top-of-stack) 모달만** ESC에 반응.
  - 처리 시 `preventDefault` + `stopPropagation` 수행.
  - IME 조합 상태(`KeyboardEvent.isComposing`) 가드가 없음(현 repo 전반에 `isComposing` 사용이 사실상 없음).

### 스택 우회(드리프트) 2곳 존재 (Analyst 근거)
- GoalsModal: window keydown ESC를 직접 처리하며 스택을 우회: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx)
- BossAlbumModal: window keydown ESC를 직접 처리하며 스택을 우회: [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx)

### Ctrl+Enter(Primary 실행) 구현은 5곳만 존재, 규칙이 제각각 (Analyst 근거)
- window keydown + `requestSubmit`: [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx)
- window keydown + 직접 save: [src/features/schedule/MemoModal.tsx](src/features/schedule/MemoModal.tsx)
- React `onKeyDown` (Ctrl/Cmd 지원): [src/features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx), [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx)
- window keydown + DOM query(`.modal-body`) + submit: [src/features/shop/ShopModal.tsx](src/features/shop/ShopModal.tsx)

## 목표/요구사항
- 모든 모달: **ESC로 닫힘**
- Primary action(확인/완료/저장 등) 버튼이 있는 모달: **Ctrl+Enter로 primary 실행**
- 중첩 모달: **top-of-stack만** 반응(ESC도 Ctrl+Enter도 동일)
- 배경 클릭 닫기 금지 유지
- 프론트/UI만
- IME(한글) 조합 상태 `isComposing` 고려(조합 중엔 단축키 미동작)

---

## 1) 옵션(2~3개)

### Option A — “단일 공유 훅”으로 ESC + Primary Hotkey를 함께 처리 (1순위 추천)
**아이디어**
- ESC 닫기와 Ctrl/Cmd+Enter primary 실행을 **하나의 훅에서** 처리한다.
- 핵심은 “스택 등록/검증”을 한 번만 하게 만들어, 중첩 모달에서도 **항상 top-of-stack만** 이벤트를 먹도록 한다.

**Pros**
- 기존 패턴(스택 기반 ESC)과 가장 잘 맞음: [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts) 확장/공유.
- Ctrl+Enter가 가장 취약했던 “스택 일관성”을 구조적으로 해결.
- 모달마다 ad-hoc window listener/DOM query를 제거하기 쉬움.

**Cons**
- primary 단축키를 추가하려는 모달은 `useModalEscapeClose` 대신 새 훅으로 옮겨야 함(중복 등록 방지).
- 공용 훅 설계가 부주의하면, 기능별 단축키(탭 이동 등)와 충돌 가능 → “top-of-stack 가드”를 공통 규칙으로 강제해야 함.

**언제 적합한가**
- 현재처럼 모달이 여러 feature에 흩어져 있고, 하나의 ModalRoot로 완전 중앙집중이 되어 있지 않은 코드베이스에 적합.

---

### Option B — “Primary 전용 훅”을 만들되, 스택 토큰(scope)을 공유하도록 강제
**아이디어**
- 사용자가 제시한 형태대로 `usePrimaryActionHotkey({ ... })`를 제공하되,
  top-of-stack 보장을 위해 **반드시 `useModalEscapeClose`와 동일한 스택 토큰을 공유**하도록 API로 강제한다.

**Pros**
- ESC와 Primary를 필요에 따라 분리/조합 가능(유연).
- 장기적으로는 “모달 단축키”를 구성 가능한 빌딩블록으로 확장하기 쉬움.

**Cons**
- 토큰/스코프를 잘못 쓰면 **이중 스택 등록**이 생기고 순서가 깨짐 → API 설계 난이도 상승.
- `useModalEscapeClose`의 내부 구조를 일부 공개(또는 래핑)해야 할 가능성.

**언제 적합한가**
- 단축키 종류가 앞으로 더 늘어나고(예: Shift+Enter, Alt+S 등) “조합 가능한 아키텍처”가 중요한 경우.

---

### Option C — GlobalModals(또는 ModalRoot)에서 전역 keydown 디스패처로 중앙 처리
**아이디어**
- 한 군데에서만 window keydown을 듣고, “현재 top modal”에 등록된 핸들러로 라우팅한다.

**Pros**
- 리스너가 단일화되어 추적/테스트가 쉬움.

**Cons**
- 현재는 모든 모달이 GlobalModals에 의해 라우팅된다고 보장하기 어려움(예: schedule 쪽에서 직접 렌더되는 모달이 존재).
- 아키텍처 변경 범위가 커져 UI-only 범위를 넘기 쉬움.

**언제 적합한가**
- 향후 “모든 모달이 단일 ModalHost를 통해 렌더”되는 구조로 리팩터링을 할 때.

---

## 2) 1순위 추천 + 가정 + 희생

### 1순위 추천
**Option A(단일 공유 훅)** 을 정본으로 권고.

### 가정(Assumptions)
- “Primary action”은 단 하나의 명확한 긍정 액션(저장/확인/완료/적용 등)이며, 단축키로 실행해도 안전하다.
- Primary action이 없는 정보성 모달은 Ctrl/Cmd+Enter를 바인딩하지 않는다.
- 모달 닫기는 배경 클릭이 아니라 **명시적 버튼/액션(ESC 포함)** 으로만 발생한다.

### 희생(무엇을 포기하는가)
- “중앙에서 자동 적용”을 포기하고, **각 모달에서 공용 훅을 호출하도록** 점진적 마이그레이션한다.
- Ctrl+Enter를 “모든 모달”에 무차별 적용하지 않고, **primary가 있는 모달만 opt-in** 한다(요구사항과 일치).

---

## 3) 구체적 인터페이스 제안(시그니처/규칙)

### 권장: 단일 훅 (Option A)
파일 제안: `src/shared/hooks/useModalHotkeys.ts` (재export: [src/shared/hooks/index.ts](src/shared/hooks/index.ts))

```ts
export type PrimaryHotkeyOptions = {
  enabled?: boolean; // default true
  onPrimary: () => void | Promise<void>;

  /** default true: macOS Cmd+Enter도 허용 */
  includeMetaKey?: boolean;
  /** default true: Win/Linux Ctrl+Enter 허용 */
  includeCtrlKey?: boolean;

  /** default true: textarea에서도 Ctrl/Cmd+Enter 허용 */
  allowInTextarea?: boolean;
  /** default true */
  allowInInput?: boolean;
  /** default true */
  allowInContentEditable?: boolean;
};

export type UseModalHotkeysOptions = {
  isOpen: boolean;

  /** ESC 닫기(없으면 바인딩 안 함) */
  onEscapeClose?: () => void;

  /** Primary(없으면 바인딩 안 함) */
  primaryAction?: PrimaryHotkeyOptions;

  /** default true: 처리 시 preventDefault */
  preventDefaultWhenHandled?: boolean;
  /** default true: 처리 시 stopPropagation */
  stopPropagationWhenHandled?: boolean;

  /** default true: IME 조합 중에는 단축키 무시 */
  ignoreWhenComposing?: boolean;
};

export function useModalHotkeys(options: UseModalHotkeysOptions): void;
```

### “usePrimaryActionHotkey” 형태도 제공 가능(요구사항 예시 충족)
단, **top-of-stack 보장**을 위해 별도 훅으로 분리할 경우 반드시 “공유 스택 등록”을 함께 설계해야 한다.

```ts
export type UsePrimaryActionHotkeyOptions = {
  isOpen: boolean;
  enabled?: boolean;
  onPrimary: () => void | Promise<void>;
  allowInTextarea?: boolean;
  includeMetaKey?: boolean;
  ignoreWhenComposing?: boolean;
};

export function usePrimaryActionHotkey(options: UsePrimaryActionHotkeyOptions): void;
```

**중요(스택 연동 원칙)**
- `usePrimaryActionHotkey`를 독립적으로 만들면, `useModalEscapeClose`와 스택이 분리되어 top-of-stack 보장이 깨질 수 있다.
- 따라서 현실적인 권고는:
  - primary가 필요한 모달은 `useModalEscapeClose` 대신 `useModalHotkeys` 하나만 사용(이중 등록 방지)
  - ESC만 필요한 모달은 기존 `useModalEscapeClose` 유지

### top-of-stack 보장 방식(기존 스택과 연동)
- 현재 스택 구현은 [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts) 내 `modalStack: Set<symbol>`.
- 권고: “스택 등록/상단 판정”을 공유 모듈로 추출하고,
  - `useModalEscapeClose`와 `useModalHotkeys`가 **동일한 스택 레지스트리**를 사용하도록 한다.
- 단일 훅(Option A)을 쓰면, 모달 인스턴스당 스택 등록이 1회로 고정되어 순서가 안정적이다.

### Ctrl+Enter 처리 규칙(충돌/IME)
- 단축키는 **반드시 Ctrl/Cmd + Enter만** 처리한다(Enter 단독은 절대 처리하지 않음 → textarea 줄바꿈과 충돌 방지).
- IME 조합 중 무시:
  - `ignoreWhenComposing !== false` 이고 `e.isComposing === true` 이면 무시.
  - (Chromium/Electron 대응) 필요 시 `e.key === 'Process'` 도 무시 대상으로 포함.
- 포커스 컨텍스트:
  - 기본값은 textarea/input/contentEditable에서도 허용(명시적 단축키이므로).
  - 특정 모달에서 입력 UX와 충돌하면 `allowInTextarea: false` 등으로 opt-out.
- 스택 규칙:
  - ESC/Primary 모두 “현재 모달이 top-of-stack일 때만” 동작.
  - 처리 시 `preventDefault` + `stopPropagation` 기본 적용.

---

## 4) 변경 영향 범위(Analyst 목록 기반)

### ESC 표준화(스택 우회 제거) — 필수 적용 2개
- [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx)
  - 현재: window keydown ESC 직접 처리 + 자식(WeeklyGoalModal) 우선 닫기 로직 포함
  - 권고: 공용 훅으로 통합하되, ESC 시 “자식 먼저 닫기”는 `onEscapeClose` 내부 규칙으로 유지
- [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx)
  - 현재: window keydown ESC 직접 처리(선택된 보스 상세 → 모달 닫기)
  - 권고: 공용 훅으로 통합하고, ESC 시 “selectedBoss 먼저 닫기” 규칙 유지

### Ctrl+Enter primary 표준화 — 적용(또는 교체) 대상 5개
- [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx)
  - 현재: window keydown Ctrl+Enter → `formRef.current?.requestSubmit()`
  - 권고: 공용 훅 `primaryAction.onPrimary`로 수렴(IME 가드 + top-of-stack 포함)
- [src/features/schedule/MemoModal.tsx](src/features/schedule/MemoModal.tsx)
  - 현재: window keydown Ctrl+Enter → `handleSave()`
  - 권고: 공용 훅으로 수렴(IME 가드 + top-of-stack 포함)
- [src/features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx)
  - 현재: React `onKeyDown`에서 Ctrl/Cmd+Enter 처리
  - 권고: 공용 훅으로 수렴(동일 규칙/IME/스택)
- [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx)
  - 현재: React `onKeyDown`에서 Ctrl/Cmd+Enter 처리
  - 권고: 공용 훅으로 수렴(동일 규칙/IME/스택)
- [src/features/shop/ShopModal.tsx](src/features/shop/ShopModal.tsx)
  - 현재: window keydown Ctrl+Enter + DOM query(`.modal-body`)로 submit
  - 권고: 공용 훅으로 수렴 + DOM query 제거(가능하면 ref 기반 submit)

---

## Verdict
**APPROVED_WITH_CHANGES**
- 방향성 승인: Option A(단일 공유 훅)가 현재 구조에 최적.
- 필수 조건: 스택(top-of-stack) 보장을 깨는 “이중 등록/분리 스택”을 금지.
- 필수 조건: IME `isComposing` 가드를 공용 훅에 포함.
