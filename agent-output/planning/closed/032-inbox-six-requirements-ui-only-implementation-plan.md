# Plan: Inbox 6 Requirements (Frontend/UI Only)

## Plan Header
- Plan ID: plan-2025-12-23-inbox-6req-ui-only
- Target Release: **1.0.171**
- Epic Alignment: Inbox → schedule 배치 마찰 제거(ADHD 친화: 즉시 이해/즉시 확인/실수 복구)
- Status: **DRAFT (User Approval Pending)**
- Scope: **Frontend/UI only** (DB schema/Repo persistence model/Supabase/Electron IPC 구현 금지)

## Changelog
| Date | Change | Notes |
|---|---|---|
| 2025-12-23 | Draft created | Critique 030 + Analysis 031 기반으로 6개 요구사항의 UI-only 구현 플랜 정리 |

---

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want 인박스에서 해야 할 일을 **빠르게 캡처하고(입력), 한 번에 배치하고(오늘/내일/다음슬롯), 결과를 즉시 확인하고(HUD/토스트), 실수하면 되돌릴 수(Undo)** 있어서, so that 계획/실행 흐름이 끊기지 않고 정리 부담(인지 부하)을 최소화할 수 있다.

## Objective (This Plan)
요구사항 6개를 **기존 패턴 준수** 하에 UI-only로 구현 가능하도록, implementer가 바로 착수할 수 있는 작업 단위로 쪼개고 파일 변경 범위를 명확히 한다.

### Must-follow Constraints (Project Policies)
- Repository 경계: UI/Store는 Repository를 통해서만 영속화/CRUD (Dexie 직접 접근 금지)
- systemState: **Dexie `db.systemState`는 `systemRepository`를 통해서만**
- localStorage 금지(예외: theme)
- defaults 하드코딩 금지: `src/shared/constants/defaults.ts` 단일 출처
- 모달 UX: 배경 클릭 닫기 금지, **ESC는 항상 닫기**(top-of-stack)
- optional chaining 기본 적용(중첩 객체 undefined 가능)

---

## Scope: 6 Requirements (UI-only Interpretation)
1) **상태 저장 매핑**: pin/goalId(영속+동기화), triage 상태/필터/lastUsed 등(UI/로컬)
2) **Today/Tomorrow/NextSlot 원탭 배치**: dual-storage 경계에서 “유령 task” 방지(안전한 UI 오케스트레이션)
3) **즉시 피드백 단일화**: toast 채널 이원화 해소(단일 notify 래퍼)
4) **핫키/포커스/ESC 충돌 방지**: 모달 스택 우선순위 + triage 모드 스코프
5) **NextSlot 유틸(slotFinder) 설계**: 입력/출력 명확 + 엣지 케이스(23시 이후, 잠금 블록)
6) **미니 HUD(정리 목표/진행도) + 접힘 상태**: 산만함 줄이는 즉시 피드백(로컬 저장)

---

## Deliverable 1) 단계별 작업목록 (5~10 steps)
1) **Requirement Freeze & UI-only 경계 확정**
   - Objective: 6개 요구사항을 UI-only로 확정(스키마/동기화 영향은 “설계 고려”로만 남김)
   - Acceptance: 아래 OPEN QUESTION이 모두 CLOSED 또는 “미해결 상태로 진행 승인”으로 표기

2) **systemState 키/기본값(Defaults) 설계 및 수렴**
   - Objective: inbox 관련 UI 상태(정리 목표/HUD/triage/lastUsed 등)를 systemState로 일원화
   - Acceptance: 모든 키는 `SYSTEM_KEYS`에 존재, 모든 기본값은 `SYSTEM_STATE_DEFAULTS`에서만 가져옴

3) **단일 notify 래퍼 도입(react-hot-toast 정본화)**
   - Objective: Inbox/배치/Undo/오류 피드백이 한 채널에서 일관되게 노출
   - Acceptance: Inbox 관련 토스트는 direct `toast.*` 호출 없이 `notify.*`만 사용

4) **NextSlot slotFinder 유틸 추가(순수 함수 + 타입)**
   - Objective: Today/Tomorrow/NextSlot 버튼과 핫키가 동일한 계산 로직을 사용
   - Acceptance: slotFinder는 UI 컴포넌트/스토어와 분리된 순수 유틸이며, “잠금 블록 스킵/23시 이후 폴백” 정의 포함

5) **원탭 배치 오케스트레이션(안전한 이동 + 즉시 반영)**
   - Objective: inbox→schedule 이동이 리프레시 없이 즉시 반영되고, 실패 시 UI가 일관적으로 복구
   - Dependency: [agent-output/architecture/007-schedule-unlimited-optimistic-update-architecture-findings.md]의 “단일 경로(스토어)” 원칙 준수
   - Acceptance: 배치 성공 시 schedule에 즉시 보이고, 실패 시 inbox에서 사라지지 않음(유령 방지)

6) **Triage 모드 UI/포커스 루프 도입(키보드 중심)**
   - Objective: “하나 처리 → 다음” 루프로 산만함 최소화(ADHD 친화)
   - Acceptance: triage on일 때 ↑/↓로 이동, T/O/N로 배치, ESC로 triage 종료, 모달 오픈 시 모달이 우선

7) **미니 HUD(정리 목표/진행도) + 접힘 상태 저장**
   - Objective: 남은 개수/오늘 목표/처리 진행을 최소 시각 자극으로 제공
   - Acceptance: HUD 펼침/접힘이 systemState에 저장되며 기본값은 defaults에서 로드

8) **버전/릴리즈 아티팩트 업데이트**
   - Objective: Target Release 1.0.171에 맞게 버전/CHANGELOG 반영
   - Acceptance: `package.json` 버전이 1.0.171, CHANGELOG에 본 플랜 범위가 요약됨

---

## Deliverable 2) 수정/추가될 파일 목록(경로) + 변경 요약
> 실제 파일명은 구현 중 조정 가능. 원칙: cross-feature 재사용은 `src/shared/**` 우선.

### (A) SystemState / Defaults
- `src/data/repositories/systemRepository.ts`
  - inbox 관련 `SYSTEM_KEYS` 추가(아래 키 설계 반영)
  - `getSystemState<T>()` 사용처가 defaults 폴백을 쉽게 하도록 호출 규칙 정리(예: store 레벨에서 defaults 적용)
- `src/shared/constants/defaults.ts`
  - `SYSTEM_STATE_DEFAULTS`에 inbox HUD/triage/goal/lastUsed 기본값 추가

### (B) Notifications
- `src/shared/lib/notify.ts` (신규)
  - react-hot-toast 단일 진입점 래퍼(성공/오류/정보/Undo 액션)
- (필요 시) `src/app/components/AppToaster.tsx`
  - 전역 toaster 설정/스타일을 notify 정책과 정렬(위치/지속시간/중복)

### (C) Slot Finder
- `src/shared/services/schedule/slotFinder.ts` (신규)
  - Today/Tomorrow/NextSlot이 공유하는 slot suggestion 계산 유틸
- (연동을 위해 읽기만) `src/shared/types/domain.ts`, `src/features/schedule/utils/timeBlockVisibility.ts`
  - TIME_BLOCKS/잠금 상태/현재 블록 관련 타입/유틸 재사용 지점 확인

### (D) Inbox UI + Store
- `src/features/tasks/InboxTab.tsx`
  - Today/Tomorrow/NextSlot 버튼(또는 기존 버튼)에서 slotFinder + 단일 이동 경로 호출
  - triage 모드 UI(선택 강조/다음 이동) + HUD 컴포넌트 장착
  - notify 사용으로 즉시 피드백 표준화
- `src/shared/stores/inboxStore.ts`
  - triage UI state(활성화 여부, 포커스된 taskId 등) 관리
  - “배치 요청”을 단일 경로(usecase/스토어 경로)로 위임하고 optimistic 제거/실패 복구 정책 적용

### (E) Hotkeys (scope-bound)
- `src/shared/hooks/useModalHotkeys.ts` 또는 `src/shared/hooks/useModalEscapeClose.ts`
  - 모달 단축키 표준(IME/isComposing 가드 + top-of-stack). 이미 진행 중 표준과 충돌 없게 확장/사용
- `src/features/tasks/hooks/useInboxHotkeys.ts` (신규, 또는 InboxTab 내부 훅)
  - triage 활성 시에만 동작하는 keymap 처리(모달 열림 시 무시)

---

## Deliverable 3) systemState 키 설계
### 저장 위치
- 영속 저장: Dexie `db.systemState`
- 접근 관문: `src/data/repositories/systemRepository.ts` (`getSystemState`/`setSystemState`)
- 기본값 단일 출처: `src/shared/constants/defaults.ts`의 `SYSTEM_STATE_DEFAULTS`

### 키 목록(제안)
> 네이밍 규칙: `inbox:` prefix 고정, UI-only 상태는 동기화 대상 아님.

- `inbox:triageEnabled` (boolean)
  - 목적: triage on/off 기억(선택: “마지막 상태 유지” UX)
  - default: `false`
- `inbox:triageDailyGoalCount` (number)
  - 목적: “정리 목표” 숫자(예: 오늘 10개)
  - default: `5` (ADHD 친화: 과도한 목표 방지)
- `inbox:hudCollapsed` (boolean)
  - 목적: 미니 HUD 펼침/접힘
  - default: `false` (기본은 보이되 작게)
- `inbox:quickPlacement:lastUsed` (object)
  - 목적: “최근 사용한 배치” 재사용(선택)
  - shape (illustrative): `{ mode: 'today'|'tomorrow'|'next', date: string, blockId: TimeBlockId, hourSlot: number }`
  - default: `null`
- `inbox:filters` (object)
  - 목적: triage 필터(예: New/Triaged/Parked) UI 상태 기억
  - default: `{ status: 'all', hideParked: false }`

### defaults에서 가져오는 방식(규칙)
- UI/store 초기 로드시: `await getSystemState(key)`가 `undefined`이면 `SYSTEM_STATE_DEFAULTS.<field>`로 폴백
- 절대 금지: 컴포넌트/스토어 내부에 숫자/불리언 기본값 하드코딩

---

## Deliverable 4) 새로운 유틸(NextSlot slotFinder) 설계
### 목적
- Today/Tomorrow/NextSlot 버튼/핫키가 **동일한 계산 로직**을 공유
- 사용자 예측 가능성 우선(“다음”이 왜 그 시간인지 설명 가능한 결과)

### 타입/시그니처(제안)
- File: `src/shared/services/schedule/slotFinder.ts`

**Types**
- `export type SlotFindMode = 'today' | 'tomorrow' | 'next';`
- `export type SlotSuggestion = Readonly<{\n  readonly dateISO: string;\n  readonly blockId: TimeBlockId;\n  readonly hourSlot: number;\n  readonly label: string;\n  readonly reason: 'within-current-block' | 'next-future-block' | 'fallback-tomorrow' | 'skipped-locked';\n}>;`
- `export type FindSlotInput = Readonly<{\n  readonly now: Date;\n  readonly mode: SlotFindMode;\n  readonly today: {\n    readonly tasks: readonly Task[];\n    readonly timeBlockStates?: Partial<Record<TimeBlockId, { readonly isLocked?: boolean }>>;\n    readonly dateISO: string;\n  };\n  readonly tomorrow?: {\n    readonly tasks: readonly Task[];\n    readonly timeBlockStates?: Partial<Record<TimeBlockId, { readonly isLocked?: boolean }>>;\n    readonly dateISO: string;\n  };\n  readonly options?: Readonly<{\n    readonly skipLockedBlocks?: boolean;\n    readonly avoidHourSlotCollisions?: boolean;\n    readonly allowStackingIfFull?: boolean;\n  }>;\n}>;`

**Function**
- `export const findSuggestedSlot = (input: FindSlotInput): SlotSuggestion | null => { ... }`

### 정책(요구사항 결정 B 반영)
- 기본 동작
  1) mode=today: 오늘 기준으로 “현재 시간 이후” 가장 가까운 블록/slot 추천
  2) mode=tomorrow: 내일 첫 유효 블록/slot 추천
  3) mode=next: 오늘 남은 첫 유효 블록이 있으면 그쪽, 없으면 내일 첫 블록
- 23시 이후 또는 현재 블록 없음: 내일 첫 블록으로 폴백
- 잠금 블록: `skipLockedBlocks=true`일 때 스킵하고 reason에 반영
- “빈 슬롯” 정의(선택 가능)
  - 기본값: `avoidHourSlotCollisions=true`로 시작(같은 hourSlot에 이미 task가 있으면 다음 hour로)
  - 블록 내 모든 hour가 찼다면:
    - `allowStackingIfFull=true`면 block.start로 스택(사용자에게 label로 고지)
    - 아니면 다음 블록으로 이동

---

## Deliverable 5) 핫키 설계
### 원칙
- 모달이 열려 있으면: **모달이 최우선**(top-of-stack)
- triage 모드가 켜져 있으면: inbox-local 키가 전역보다 우선
- IME 조합 중(`isComposing`/`key==='Process'`)에는 단축키 무시
- Enter 단독 저장/배치는 금지(입력 UX 충돌 방지). 확정은 Ctrl/Cmd+Enter 또는 명시 버튼.

### 키 매핑(제안)
**Inbox (Triage ON, focus가 inbox 리스트 내부일 때만)**
- `↑/↓` 또는 `j/k`: 포커스(선택) 이동
- `t`: Today로 배치
- `o`: Tomorrow로 배치
- `n`: NextSlot로 배치
- `p`: Pin 토글(핀은 task schema 쪽이지만 UI-only 범위에서는 표시/토글 경로만 설계)
- `d` 또는 `Backspace`: 삭제(Undo 제공)
- `Esc`: triage 종료(단, 모달이 열려있으면 모달 닫기)

**Inbox (Triage OFF)**
- `Ctrl/Cmd+K` (또는 `Ctrl/Cmd+I`): “빠른 캡처” 입력 포커스
- `Ctrl/Cmd+Shift+N`: 선택된 task를 NextSlot로 배치(옵션)

### Focus 관리(ADHD 친화)
- triage 시작 시: “첫 번째 처리 대상”에 roving focus 부여(시각적 강조 1개만)
- 배치/삭제 후: 다음 항목으로 자동 포커스 이동
- 입력창(캡처) 포커스가 활성일 때는 triage 단축키 비활성(예: t/o/n은 텍스트 입력으로 처리)

### ESC 닫기
- 모달: `useModalEscapeClose`/`useModalHotkeys` 표준(architecture 006 준수)
- triage: 모달이 없을 때만 ESC가 triage 종료를 수행

---

## Deliverable 6) 즉시 피드백(단일 notify 래퍼) 설계
### 목표
- 모든 배치/삭제/Undo/오류가 “한 곳”에서 동일 UX로 노출
- 산만함 최소화(짧고 구체적인 문장, 과한 애니메이션 금지)

### API 제안
- File: `src/shared/lib/notify.ts`
- `export type NotifyAction = Readonly<{ label: string; onAction: () => void; }>;`
- `export type NotifyOptions = Readonly<{ id?: string; durationMs?: number; }>;`

- `export const notify = {\n  success: (message: string, options?: NotifyOptions) => void;\n  error: (message: string, options?: NotifyOptions) => void;\n  info: (message: string, options?: NotifyOptions) => void;\n  undo: (message: string, action: NotifyAction, options?: NotifyOptions) => void;\n};`

### 메시지 정책(예시)
- 배치 성공: “오늘 14–17 블록으로 이동” (가능하면 block label 포함)
- 실패: “이동 실패: 다시 시도할까요?” + 오류는 개발자 콘솔로(사용자에겐 짧게)
- Undo: “삭제됨” + [되돌리기]

---

## Testing Strategy (High-level, no test cases)
- Unit: slotFinder 순수 함수(시간/잠금/폴백) 단위 테스트
- Integration: InboxTab에서 단축키 → 배치 → 즉시 schedule 반영(스토어 경로)
- Regression: 모달 ESC 동작(top-of-stack), IME 조합 중 단축키 무시

---

## Risks / Mitigations (UI-only)
- Dual-storage 이동 실패로 유령 task: “단일 경로(스토어) + optimistic/rollback” 원칙으로 완화
- Toast 이원화로 UX 분열: notify 단일 진입점으로 완화
- Hotkey 충돌: 스코프(모달 > triage > global)와 focus/IME 가드로 완화

---

## OPEN QUESTION (Needs User Decision)
1) **“정리 상태(triaged/parked)”를 task schema에 넣지 않고도**, UI-only 단계에서 “태그/메타”로 표현하는 것에 동의하는가? (동의 시: 실험 가능 / 반대 시: 스키마 변경 논의 필요)
2) NextSlot의 “빈 슬롯” 정의를 무엇으로 할까?
   - A) 시간 기반(가장 가까운 미래 블록 시작, task 개수 무시)
   - B) hourSlot 충돌 회피(가능하면 비어있는 hourSlot을 찾음)  
   - 권장: B (단, 꽉 찼으면 스택 또는 다음 블록 폴백)
3) triageEnabled를 systemState에 “기억”할까, 아니면 세션 한정으로 둘까?

