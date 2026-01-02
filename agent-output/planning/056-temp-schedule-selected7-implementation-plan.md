---
ID: 56
Origin: 56
UUID: 7c2e9b1f
Status: QA Complete
---

# Plan Header
- Plan ID: plan-2026-01-02-temp-schedule-selected7
- Target Release: **1.0.181** (current [package.json](package.json) = 1.0.180 → patch +1)
- Epic Alignment: Temp Schedule UX Quick Wins + Safety + Accessibility
- Status: QA Complete

## Changelog
- 2026-01-02: Created implementer-ready plan for selected 7 items (A1, A3, A6, A7, B2, C1, C4) using mapping analysis [agent-output/analysis/056-temp-schedule-implementation-mapping-analysis.md](agent-output/analysis/056-temp-schedule-implementation-mapping-analysis.md).
- 2026-01-02: QA rerun after Week quick actions (B2 parity) — build/test PASS, B2 PASS. See [agent-output/qa/056-temp-schedule-selected7-implementation-plan-qa.md](agent-output/qa/056-temp-schedule-selected7-implementation-plan-qa.md).

---

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want 임시스케쥴을 “빠르게 잡고(생성), 쉽게 수정하고(미세 조정), 필요하면 안전하게 정규 작업으로 전환(승격/정리)”할 수 있어, so that 계획-실행 흐름이 끊기지 않고 작은 성공을 계속 쌓을 수 있다.

---

## Scope & Constraints (MUST)
- **Frontend/UI only**: renderer UI + client state/repository (Dexie) 범위까지만.
- **No localStorage**: theme 키만 예외. 그 외는 Dexie `db.systemState` 또는 기존 Dexie 테이블/레포지토리 패턴 사용.
- **Modal UX**: ESC는 닫기, 배경 클릭 닫기 금지, `useModalEscapeClose` 사용.
- **Optional chaining**: 중첩 객체 접근은 `?.` 사용.
- **Repository pattern 유지**: UI/Store에서 Firebase 직접 호출 금지. TempSchedule은 `src/data/repositories/tempScheduleRepository.ts` 통해 지속성.
- **Keyboard conflicts**: TempScheduleModal의 기존 단축키(N/D/W/M/T, arrows)와 충돌하지 않도록 “스코프/우선순위” 명시.

---

## Dependency Graph (Parallel vs Sequential)

### High-level lanes
- **Lane A (Quick Win UI)**: C4 → B2 (동일 컴포넌트 표면을 함께 건드리므로 한 덩어리로)
- **Lane B (Promote Safety)**: A1 (Lane A와 병렬 가능)
- **Lane C (Templates)**: A7 (Lane A/B와 병렬 가능)
- **Lane D (Week Recurrence Move)**: A6 (WeeklyScheduleView 충돌 위험 때문에 Lane A 이후 권장)
- **Lane E (Command Palette)**: C1 (Lane A와 병렬 가능하나, 키보드 정책 합의 필요)
- **Lane F (Inline Edit)**: A3 (B2/C4와 같은 파일/영역을 많이 공유하므로 마지막에 권장)

### Mermaid DAG
```mermaid
graph TD
  C4[C4: 색+아이콘/텍스트 배지] --> B2[B2: 호버 퀵버튼]
  B2 --> A3[A3: 인라인 편집]

  A1[A1: 승격 후 처리] -->|공유 UX 패턴(토스트/선택)| A6[A6: 반복 이동 선택]

  C1[C1: 커맨드 팔레트] -->|핫키 게이팅 필요| A3

  A7[A7: 템플릿 핀]:::independent

  classDef independent fill:#f7f7f7,stroke:#bbb,stroke-dasharray: 5 5;
```

---

## Work Packages (2–4 subtasks per item)

### A1 — 승격 후 처리 (delete/archive/keep)

**A1-1 — 승격 후 “처리 옵션” 데이터 모델 확정 및 기본 동작 정의**
- Target files
  - [src/shared/types/tempSchedule.ts](src/shared/types/tempSchedule.ts)
  - [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts)
  - (UI 필터/표시가 필요하면) [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)
- Acceptance criteria
  - “아카이브(임시함)”가 무엇을 의미하는지 코드 레벨에서 표현 가능(예: `isArchived` 또는 systemState 기반 archivedIds).
  - 기존 데이터(필드 없음)도 안전하게 처리되어 기본 동작이 깨지지 않음(미지정 = not archived).
- Effort: 1.5h

**A1-2 — `promoteToRealTask` 후처리 훅/결과 반환 추가 (UI가 선택을 걸 수 있게)**
- Target files
  - [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts)
  - (연동 대상) [src/features/tempSchedule/components/TempScheduleContextMenu.tsx](src/features/tempSchedule/components/TempScheduleContextMenu.tsx)
- Acceptance criteria
  - Promote 실행 결과로 “원본 temp task id”와 “생성된 real task id(또는 성공 여부)”를 UI가 받을 수 있음.
  - Promote 실패 시 temp task가 임의로 삭제/변경되지 않고 에러 피드백이 노출됨.
- Effort: 2.0h

**A1-3 — Promote 후 선택 UI(삭제/아카이브/유지) 삽입 및 실행**
- Target files
  - [src/features/tempSchedule/components/TempScheduleContextMenu.tsx](src/features/tempSchedule/components/TempScheduleContextMenu.tsx)
  - [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts)
  - (토스트/undo 사용 시) [src/shared/lib/notify.ts](src/shared/lib/notify.ts)
- Acceptance criteria
  - Promote 직후 사용자에게 “삭제 / 임시함(아카이브) / 그대로” 선택지가 나타남.
  - 선택 결과가 즉시 UI에 반영되고, 기본 뷰에서 중복(승격된 작업 + 원본 임시블록)이 남지 않음.
  - ESC 정책/배경 클릭 정책을 위반하지 않음(토스트를 쓰면 backdrop close 이슈 없음; 모달을 쓰면 `useModalEscapeClose` 적용).
- Effort: 1.5h

---

### A3 — 인라인 편집 (hover popover/form)

**A3-1 — 인라인 편집 UI 컴포넌트(또는 패턴) 정의 + 포커스/ESC 정책 적용**
- Target files
  - [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx)
  - [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
  - [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)
  - (ESC 처리) [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts)
- Acceptance criteria
  - 이름/시간/색 “3필드 최소 편집” UI가 재사용 가능한 형태로 정의됨.
  - 편집 시작 시 입력 포커스가 확실히 들어가고, ESC로 편집이 취소/닫힘.
  - 드래그/클릭과 충돌하지 않도록 편집 모드 중 인터랙션이 명확히 제한됨.
- Effort: 3.0h

**A3-2 — Day(Timeline) 표면: 블록에서 인라인 편집 진입/저장 연결**
- Target files
  - [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx)
  - [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts)
- Acceptance criteria
  - Timeline 블록에서 hover(또는 더블클릭/단축키 등)로 인라인 편집을 열 수 있음.
  - 저장 시 `updateTask`를 통해 즉시 반영되고, 취소 시 원복됨.
- Effort: 2.0h

**A3-3 — Week + List 표면: 동일 편집 경험 제공**
- Target files
  - [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
  - [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)
- Acceptance criteria
  - Week 블록과 List 아이템에서도 동일한 최소 편집이 가능(UX/단축키 일관).
  - hover-only에 의존하지 않고 keyboard focus 시에도 편집 진입이 가능.
- Effort: 3.0h

**A3-4 — 입력 검증/가드/성능(불필요한 rerender 방지) 정리**
- Target files
  - [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts)
  - (시간 파싱/스냅 관련 유틸이 tempScheduleRepository에 있음) [src/data/repositories/tempScheduleRepository.ts](src/data/repositories/tempScheduleRepository.ts)
- Acceptance criteria
  - 잘못된 시간/빈 이름 등 외부 입력이 안전하게 거부/보정됨(런타임 예외 없음).
  - 인라인 편집이 대량 렌더를 유발하지 않고(체감상) 스크롤/드래그 성능이 유지됨.
- Effort: 2.0h

---

### A6 — 반복 이동 선택 (this once vs keep pattern)

**A6-1 — 반복 task drop 감지 + 선택 UI(토스트/미니 모달) 설계**
- Target files
  - [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
  - (피드백 UX) [src/shared/lib/notify.ts](src/shared/lib/notify.ts)
- Acceptance criteria
  - `recurrence.type !== 'none'` 인 task를 드래그 드롭으로 이동할 때만 선택 UI가 뜸.
  - 선택 UI는 작업 흐름을 막지 않되(ADHD-friendly), 실수를 줄일 만큼 명확함.
- Effort: 2.0h

**A6-2 — “이번 1회만” vs “패턴 유지(전체 이동)” 동작 구현 (silent reset 제거)**
- Target files
  - [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
  - [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts)
- Acceptance criteria
  - “이번 1회만”: 기존과 같이 recurrence를 끊는 동작이지만, **사용자 선택에 의해** 실행됨(자동/무통보 금지).
  - “패턴 유지”: recurrence를 유지한 채 이동이 수행됨(현재 데이터 모델 상 ‘시리즈 전체가 이동’될 수 있음을 UI에서 명시).
  - 기존의 강제 `recurrence: none` 리셋이 기본 경로에서 제거됨.
- Effort: 2.0h

**A6-3 — 실행 피드백(성공/실패) + Undo(가능한 범위) 제공**
- Target files
  - [src/shared/lib/notify.ts](src/shared/lib/notify.ts)
  - [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
- Acceptance criteria
  - 이동 결과에 대한 토스트 피드백이 일관되게 제공됨.
  - 최소 1-step Undo(직전 이동 취소)가 UX 상 제공되거나, 제공이 불가하면 “왜 불가한지(데이터 모델 제약)”를 명확히 안내.
- Effort: 1.0h

---

### A7 — 템플릿 핀 (pinnedTemplateIds in systemState)

**A7-1 — systemState에 pinnedTemplateIds 저장/로드(레포지토리 헬퍼 추가)**
- Target files
  - [src/data/repositories/tempScheduleRepository.ts](src/data/repositories/tempScheduleRepository.ts)
  - (템플릿 타입 사용) [src/shared/types/tempSchedule.ts](src/shared/types/tempSchedule.ts)
- Acceptance criteria
  - pinnedTemplateIds가 localStorage 없이 Dexie systemState에서 유지됨.
  - pinnedTemplateIds가 없거나 비어 있어도 템플릿 로딩/적용이 깨지지 않음.
- Effort: 1.5h

**A7-2 — TemplateModal: 핀 토글 UI + pinned 우선 정렬 + 시각 표시**
- Target files
  - [src/features/tempSchedule/components/TemplateModal.tsx](src/features/tempSchedule/components/TemplateModal.tsx)
- Acceptance criteria
  - 템플릿 항목에 “핀(고정)” 토글이 있고, pinned는 상단에 정렬됨.
  - pinned 상태가 즉시 반영되고, 모달을 닫았다 열어도 유지됨.
- Effort: 2.0h

**A7-3 — TempScheduleModal 진입 시 pinned 템플릿 접근성 개선(선택/바로가기)**
- Target files
  - [src/features/tempSchedule/TempScheduleModal.tsx](src/features/tempSchedule/TempScheduleModal.tsx)
- Acceptance criteria
  - pinned 템플릿으로 빠르게 접근(예: pinned 우선 표시/바로가기 버튼/단축 동선)이 가능.
  - 기존 N/D/W/M/T 단축키 동작과 충돌하지 않음.
- Effort: 1.0h

---

### B2 — 호버 퀵버튼 (promote / delete / color / …)

**B2-1 — 퀵액션 버튼셋 정의(hover+focus) + 접근성 규칙 확정**
- Target files
  - [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx)
  - [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
  - [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)
  - (피드백 UX) [src/shared/lib/notify.ts](src/shared/lib/notify.ts)
- Acceptance criteria
  - 마우스 hover뿐 아니라 키보드 focus로도 퀵버튼이 나타남.
  - 버튼은 aria-label을 갖고, 클릭/키보드 활성화(Enter/Space)가 가능.
- Effort: 2.0h

**B2-2 — Day/Week/List 표면에 퀵버튼 삽입 및 액션 연결**
- Target files
  - [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx)
  - [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
  - [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)
  - [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts)
- Acceptance criteria
  - 최소 액션(승격/삭제/색 변경)이 3개 표면에서 동일하게 동작.
  - 기존 컨텍스트 메뉴는 유지되며, 퀵버튼은 단축 동선 역할만 함.
- Effort: 2.5h

**B2-3 — 시각적 클러터 제어(레이아웃/밀도) + 모바일/좁은 폭 대응**
- Target files
  - [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx)
  - [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
  - [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)
- Acceptance criteria
  - 퀵버튼은 기본적으로 숨김(hover/focus only)이며 UI가 과밀해지지 않음.
  - 좁은 폭에서도 버튼이 겹치지 않거나, 최소 표시 규칙이 적용됨.
- Effort: 1.0h

---

### C1 — 명령 팔레트 (Temp Schedule modal scoped)

**C1-1 — 팔레트 오버레이(검색 입력 + 리스트) 추가 + Ctrl/Cmd+K 트리거 + ESC 닫기**
- Target files
  - [src/features/tempSchedule/TempScheduleModal.tsx](src/features/tempSchedule/TempScheduleModal.tsx)
  - (ESC 정책) [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts)
- Acceptance criteria
  - TempScheduleModal이 열려 있을 때만 Ctrl/Cmd+K로 팔레트가 열림(전역 단축키 금지).
  - ESC로 팔레트가 닫히며, 팔레트가 열려 있는 동안 기존 N/D/W/M/T/arrow 핫키는 의도치 않게 실행되지 않음.
  - 배경 클릭으로 닫히지 않음.
- Effort: 2.5h

**C1-2 — 최소 명령 세트 구현(뷰 전환/오늘/이전/다음/추가/템플릿 열기 등)**
- Target files
  - [src/features/tempSchedule/TempScheduleModal.tsx](src/features/tempSchedule/TempScheduleModal.tsx)
  - [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts)
- Acceptance criteria
  - 검색으로 명령이 필터링되고, Enter로 실행됨.
  - 명령 실행 후 팔레트가 닫히거나(또는 유지) 일관된 규칙이 있음.
- Effort: 2.0h

**C1-3 — (Stretch within item) task 대상 명령: 이름으로 task 찾기 → 편집/승격/삭제 실행**
- Target files
  - [src/features/tempSchedule/TempScheduleModal.tsx](src/features/tempSchedule/TempScheduleModal.tsx)
  - [src/features/tempSchedule/stores/tempScheduleStore.ts](src/features/tempSchedule/stores/tempScheduleStore.ts)
- Acceptance criteria
  - 팔레트에서 temp task를 검색(현재 날짜 또는 현재 뷰 스코프 기준)하고, 선택 후 액션을 실행할 수 있음.
  - 액션 실행은 기존 store 메서드를 재사용하고, 실패 시 피드백이 제공됨.
- Effort: 3.0h

---

### C4 — 색상 + 아이콘/텍스트 (color-only 제거)

**C4-1 — 상태/의미 “다중 채널” 어휘 정의(아이콘+텍스트+패턴) 및 최소 배지 구성**
- Target files
  - [src/shared/types/tempSchedule.ts](src/shared/types/tempSchedule.ts)
  - (표면 적용) [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx)
  - (표면 적용) [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
  - (표면 적용) [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)
- Acceptance criteria
  - 색만 보지 않아도 구분 가능한 최소 정보가 정의됨(예: duration 배지, 반복/즐겨찾기/아카이브 아이콘+텍스트).
- Effort: 1.5h

**C4-2 — Day/Week/List에 배지/아이콘 적용(레이아웃 안정)**
- Target files
  - [src/features/tempSchedule/components/TempScheduleTimelineView.tsx](src/features/tempSchedule/components/TempScheduleTimelineView.tsx)
  - [src/features/tempSchedule/components/WeeklyScheduleView.tsx](src/features/tempSchedule/components/WeeklyScheduleView.tsx)
  - [src/features/tempSchedule/components/TempScheduleTaskList.tsx](src/features/tempSchedule/components/TempScheduleTaskList.tsx)
- Acceptance criteria
  - 모든 표면에서 동일한 의미가 동일한 배지/아이콘으로 표현됨.
  - 배지 추가로 카드 높이가 요동치지 않거나, 요동이 최소화됨.
- Effort: 2.0h

**C4-3 — 접근성(ARIA/포커스/고대비) 체크 및 마감**
- Target files
  - (표면 적용) [src/features/tempSchedule/TempScheduleModal.tsx](src/features/tempSchedule/TempScheduleModal.tsx)
  - (표면 적용) Day/Week/List 컴포넌트들
- Acceptance criteria
  - 아이콘 단독 사용을 피하고(필요 시) 텍스트/aria-label로 의미가 전달됨.
  - focus-visible이 보장되고, 키보드 사용자가 상태를 인지 가능.
- Effort: 1.0h

---

## Recommended Execution Order (Quick wins first, minimize merge conflicts)
1) **C4 (C4-1~3)** → 2) **B2 (B2-1~3)**
   - 같은 표면을 건드리므로 같이 묶어 UI/스타일을 한 번에 안정화.
2) **A1 (A1-1~3)**
   - Promote 중복/클러터를 즉시 줄이는 “정리 완료감” Quick Win.
3) **A7 (A7-1~3)**
   - 템플릿 접근 비용을 크게 낮추는 Quick Win.
4) **A6 (A6-1~3)**
   - WeekView 드래그의 신뢰성 회복. (B2와 WeeklyScheduleView 충돌 줄이기 위해 후순위)
5) **C1 (C1-1~3)**
   - 단축키/게이팅 정책을 확정한 뒤 구현.
6) **A3 (A3-1~4)**
   - UI 표면을 넓게 건드리므로 마지막에 합치는 것이 안전.

---

## Totals
- Item subtasks
  - A1: 3
  - A3: 4
  - A6: 3
  - A7: 3
  - B2: 3
  - C1: 3
  - C4: 3
- **Total task count**: 22
- **Total estimate**: **42.0 hours** (±20% — UI 상호작용/키보드 충돌/데이터 모델 제약에 따라 변동)

---

## Validation (High-level)
- Typecheck/build: `npm run build` (or `npm run dev` smoke)
- Tests: `npm run test`
- Lint (if running in your PR stack): `npm run lint`
- Manual smoke (짧게)
  - Day/Week/List에서 퀵버튼 노출/동작
  - Promote 후 선택 UI와 결과 반영
  - Week 드래그에서 반복 이동 선택이 뜨고, 선택 결과가 반영
  - TemplateModal 핀 토글/정렬/지속성
  - Ctrl/Cmd+K 팔레트 오픈/ESC 닫기/핫키 충돌 없음

---

## Risks & Mitigations
- **A6 데이터 모델 한계**: “이번 1회만” vs “패턴 유지”가 실제로는 ‘시리즈 전체 이동’ 의미가 될 수 있음 → UI에서 명시, 기본값을 안전한 쪽(이번 1회)으로.
- **A3/B2/C4 파일 충돌**: 동일 컴포넌트를 많이 수정 → 실행 순서로 충돌 최소화, 기능 플래그/작은 PR 권장.
- **Keyboard conflict**: TempScheduleModal의 기존 핫키와 팔레트/인라인 편집이 충돌 → “열려있는 오버레이가 있으면 기존 핫키를 게이트” 원칙 적용.

---

## OPEN QUESTIONS (Needs explicit acknowledgment before implementer handoff)
1) **A1의 ‘아카이브/임시함’ 정의**
   - 제안(MVP): `TempScheduleTask`에 `isArchived?: boolean` 추가 → 기본 뷰에서 숨김, List에서 “보관함 보기” 토글로 확인 가능.
   - 오빠 결정 필요: 이 MVP 정의로 진행할까, 아니면 “systemState에 archivedIds 배열” 방식이 더 좋아?
2) **C1 트리거 키**
   - 제안: TempScheduleModal 스코프에서만 Ctrl/Cmd+K. (기존 N/D/W/M/T와 충돌 최소)
   - 오빠 확인 필요: Ctrl+K를 다른 기능(전역)으로 쓸 계획이 있어?
3) **A6 기본값**
   - 제안: 기본은 “이번 1회만(안전)” + ‘패턴 유지(전체 이동 가능)’은 명시적으로 선택.

원하면 오빠가 “1)~3) 승인”이라고 답해주면, 이 플랜을 Critic 단계로 넘길 수 있어.
