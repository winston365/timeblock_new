# Plan: Inbox Triage UI Cleanup (UI-only)

## Plan Header
- Plan ID: plan-2025-12-28-inbox-triage-ui-cleanup
- Target Release: **1.0.174 (현재 버전 유지 / 버전 작업 제외)**
  - 근거: 본 플랜은 UI-only 정리 + 크래시 방지이며, 사용자 요청에 따라 릴리즈 버전 결정/범위는 다루지 않음
- Epic Alignment: Inbox → 인지 부하 감소(ADHD 친화) + Triage 루프 안정화
- Status: **QA Complete**
- Scope: **Frontend/UI only** (DB schema/Repository 모델 변경/Supabase/Electron IPC 구현 금지)

## Related Artifacts
- Analysis: `agent-output/analysis/045-inbox-triage-ui-cleanup-analysis.md`
- Critique: `agent-output/critiques/045-inbox-triage-ui-cleanup-critique.md`
- Prior Plan Context: `agent-output/planning/032-inbox-six-requirements-ui-only-implementation-plan.md`

## Changelog
| Date | Change | Notes |
|---|---|---|
| 2025-12-28 | Draft created | Analysis 045 + Critique 045 기반으로, 3개 변경(칩 제거/행 병합/크래시 방지) UI-only 구현 플랜 확정안 작성 |
| 2025-12-28 | QA executed | `agent-output/qa/045-inbox-triage-ui-cleanup-qa.md`에서 Vitest PASS 확인, 그러나 triage 포커스 동기화/ESC 종료/기본값 하드코딩 이슈로 QA Failed 판정 |
| 2025-12-28 | QA re-run PASS | Implementer fix pass 반영 후 재-QA에서 요구사항 및 이전 Fail 항목(포커스 동기화, defaults, quick-place date handling) 해결 확인 → QA Complete |
| 2025-12-28 | QA gating re-check PASS | input focus/triage/modal 게이팅 최신 수정 재검증(실제 `git diff --name-only`, `npm test` 기반) → QA Complete 유지 |

---

## Value Statement and Business Objective
As a ADHD 성향 사용자를 포함한 사용자, I want 인박스에서 작업을 정리할 때 **눈에 띄는 요소를 최소화**하고 **핵심 액션만 한 줄에 모아서** 실수/크래시 없이 흐름을 유지할 수 있어서, so that “정리(트리아지) → 배치 → 다음 작업” 루프가 끊기지 않고 스트레스가 줄어든다.

## Objective (This Plan)
1) Inbox item에서 per-task 시간대 칩(5-8…20-23) 제거
2) Today/Tomorrow/Next와 고정/보류 액션을 한 줄로 병합
3) Triage 모드에서 발생하는 `TypeError: x is not a function` 크래시를 방지하고(재발 방지 포함) 포커스 상태가 일관되게 동작하도록 정리

## Must-follow Constraints (Project Policies)
- UI-only (데이터 스키마/동기화/IPC 구현 변경 금지)
- localStorage 금지(예외: theme)
- 기본값 하드코딩 금지: `src/shared/constants/defaults.ts` 단일 출처
- nested access는 optional chaining 기본 적용
- 모달 UX: 배경 클릭 닫기 금지, ESC 닫기 유지

---

## Scope and Primary Edit Locations (Exact)
### A) Inbox UI
- File: `src/features/tasks/InboxTab.tsx` (component: `InboxTab`)
  - Triage mode state + hotkeys wiring
    - Local state: [src/features/tasks/InboxTab.tsx#L68-L69](src/features/tasks/InboxTab.tsx#L68-L69)
    - Hotkeys hook call: [src/features/tasks/InboxTab.tsx#L121-L166](src/features/tasks/InboxTab.tsx#L121-L166)
    - Triage toggle button: [src/features/tasks/InboxTab.tsx#L560-L573](src/features/tasks/InboxTab.tsx#L560-L573)
  - Inbox quick actions (mouse)
    - Quick-place handler: [src/features/tasks/InboxTab.tsx#L174-L210](src/features/tasks/InboxTab.tsx#L174-L210)
    - Per-task quick buttons renderer: [src/features/tasks/InboxTab.tsx#L584-L604](src/features/tasks/InboxTab.tsx#L584-L604)
    - Per-task pin/defer renderer: [src/features/tasks/InboxTab.tsx#L614-L708](src/features/tasks/InboxTab.tsx#L614-L708)
  - Remove: per-task `TIME_BLOCKS.map(...)` 칩 행
    - 근거 위치: [src/features/tasks/InboxTab.tsx#L770-L788](src/features/tasks/InboxTab.tsx#L770-L788)
  - Merge: `renderQuickPlaceButtons(taskId)` + `renderTriageButtons(task)`를 “단일 액션 행”으로 통합
    - 정의 위치: [src/features/tasks/InboxTab.tsx#L584-L664](src/features/tasks/InboxTab.tsx#L584-L664)
    - 사용 위치: [src/features/tasks/InboxTab.tsx#L763-L767](src/features/tasks/InboxTab.tsx#L763-L767)

### B) Triage Hotkeys (Crash Fix)
- File: `src/features/tasks/hooks/useInboxHotkeys.ts` (hook: `useInboxHotkeys`)
  - Options type: [src/features/tasks/hooks/useInboxHotkeys.ts#L42-L62](src/features/tasks/hooks/useInboxHotkeys.ts#L42-L62)
  - Focus state + setter mismatch hotspot:
    - Local focus state: [src/features/tasks/hooks/useInboxHotkeys.ts#L107](src/features/tasks/hooks/useInboxHotkeys.ts#L107)
    - External setter fallback selection: [src/features/tasks/hooks/useInboxHotkeys.ts#L110](src/features/tasks/hooks/useInboxHotkeys.ts#L110)
    - Optional callback truthy-checks needing guards: [src/features/tasks/hooks/useInboxHotkeys.ts#L113-L126](src/features/tasks/hooks/useInboxHotkeys.ts#L113-L126)
  - 목적: triage 포커스 상태를 단일 소스로 정리하고, 옵션으로 주입되는 콜백들에 런타임 가드를 추가해 `… is not a function` 류 크래시를 제거
  - 근거: hook 내부 state와 외부 setter 혼용으로 읽기/쓰기 불일치가 존재(크리틱 045 참고)

### C) Supporting Types / Defaults (Reference only; not required to change)
- `src/shared/types/domain.ts` (type: `Task` inbox triage fields)
  - `isPinned`, `deferredUntil`: [src/shared/types/domain.ts#L99-L114](src/shared/types/domain.ts#L99-L114)
- `src/shared/constants/defaults.ts` (Dexie systemState defaults)
  - `SYSTEM_STATE_DEFAULTS.inboxTriageEnabled` 등: [src/shared/constants/defaults.ts#L205-L236](src/shared/constants/defaults.ts#L205-L236)

---

## Assumptions
- 현재 요청 범위는 UI 정리/안정성에 한정되며, “특정 블록에 즉시 배치” 기능 삭제로 인한 UX 변화는 수용 가능하다.
- (만약 필요하면) 시간 블록 직접 선택은 TaskModal 편집 경로로 여전히 가능하다(크리틱 045의 리스크 참조).

## Defaults (No blocking questions)
- 병합된 액션 행 버튼 순서(기본값, ADHD 친화 스캔): `⚡ Today / Tomorrow / Next` | `📌 고정` `⏸️ 보류`
- 좁은 폭 대응: 기본은 자연 줄바꿈 허용(2줄까지). 버튼 크기/터치 타겟을 줄이지 않는다.

---

## Plan (Numbered, Implementer-Ready)

1) Requirement Freeze (UI-only) 및 산출물 기준 확정
   - Objective: 이번 변경이 “칩 제거 + 행 병합 + triage 크래시 방지” 3개에만 집중되도록 범위 고정
   - Acceptance:
     - `InboxTab`에서 TIME_BLOCKS 칩 행이 제거된다
     - task당 액션 행이 1줄로 줄어든다(QuickPlace+Pin/Defer)
     - triage 모드에서의 TypeError 크래시가 재현되지 않는다

2) Inbox per-task TIME_BLOCKS 칩 제거
   - Where: `src/features/tasks/InboxTab.tsx`
   - Change:
     - [src/features/tasks/InboxTab.tsx#L770-L788](src/features/tasks/InboxTab.tsx#L770-L788) 구간의 “⏰ + TIME_BLOCKS 버튼 행”을 삭제
   - Rationale: 시각적 산만함/수직 공간을 줄여 인지 부하를 낮춤(ADHD 친화)
   - Acceptance:
     - Inbox item 하단에 `5-8, 8-11, ...` 버튼이 더 이상 보이지 않는다

3) QuickPlace + Pin/Defer를 단일 액션 행으로 병합
   - Where: `src/features/tasks/InboxTab.tsx`
   - Change:
     - `renderQuickPlaceButtons`와 `renderTriageButtons`를 병합한 단일 렌더러(예: `renderInboxActionRow`)로 통합
     - 사용처 [src/features/tasks/InboxTab.tsx#L763-L767](src/features/tasks/InboxTab.tsx#L763-L767)에서 2줄 호출을 1줄 호출로 교체
     - 시각적 구분(구분자/간격) + 접근성 그룹화(role/aria-label)를 포함
     - 버튼 텍스트/툴팁 단축키 힌트는 유지(T/O/N, P/H)
   - Rationale:
     - 행동 묶음을 한 줄로 줄여 “다음 행동” 선택을 빠르게 함
     - 같은 범주의 버튼을 그룹으로 묶어 오클릭/혼란을 줄임
   - Acceptance:
     - task당 액션이 한 줄에 표시된다
     - 좁은 폭에서도 레이아웃이 깨지지 않는다(필요 시 줄바꿈 허용)

4) Triage 크래시 방지: useInboxHotkeys 상태 단일화 + 런타임 가드
   - Where: `src/features/tasks/hooks/useInboxHotkeys.ts`
   - Change (기본 선택: InboxTab이 focus를 소유하므로, hook은 value+setter를 함께 받도록 정리):
     - `useInboxHotkeys` options에 `triageFocusedTaskId?: string | null`를 추가하고, hook 내부에서 “읽기/쓰기”가 동일한 값/세터 쌍을 사용하도록 정리
       - InboxTab 호출부에서 `triageFocusedTaskId`도 함께 전달하여 상태 불일치를 제거
     - 주입되는 함수형 옵션(`setTriageFocusedTaskId`, `placeTaskToSlot`, `setLastUsedSlot`)은 “truthy 체크”가 아니라 `typeof === 'function'` 가드로 검증
       - 함수가 아니면 안전한 fallback을 사용하고, 개발 환경에서는 `console.warn`으로 조용히 진단 신호만 남김
     - (선택) `Escape` 키가 실제로 triage 종료를 수행하도록, hook 또는 InboxTab에서 명확히 처리(현재 UI 안내 문구 “ESC 종료”와 일치)
   - Rationale:
     - “truthy지만 함수가 아닌 값”이 들어오면 onClick/키 이벤트에서 즉시 TypeError로 터질 수 있음
     - 현재는 외부 setter 주입 시 내부 state가 갱신되지 않아 triage 포커스가 사실상 고정/무효화됨
   - Acceptance:
     - triage ON 상태에서 포커스가 일관되게 표시된다(현재 포커스 task가 하이라이트)
     - triage ON 상태에서 단축키(T/O/N, P/H, 삭제/편집)가 크래시 없이 동작한다
     - 콘솔에 “is not a function” 크래시가 재현되지 않는다

5) Add Vitest coverage for the crash-prevention logic (Node environment compatible)
   - Rationale: 이 repo의 Vitest 환경은 `node`이며 `.tsx` 렌더링 테스트를 기본으로 두지 않으므로, “핵심 가드/포커스 계산”을 순수 함수로 분리해 단위 테스트로 회귀를 막는다.
   - New files to add:
     - `src/features/tasks/hooks/inboxHotkeysUtils.ts` (new; pure helpers used by `useInboxHotkeys`)
     - `tests/inbox-hotkeys-utils.test.ts` (new)
       - Coverage: 콜백 가드(`typeof === 'function'`), 포커스 이동/초기 포커스 선정 로직(빈 배열/1개/래핑)
   - Acceptance:
     - 새 테스트가 `node` 환경에서 동작한다(브라우저/DOM 의존 없음)
     - “함수 아님(truthy)” 입력에서도 예외가 발생하지 않는 경로가 테스트로 보장된다

6) Validation (Developer Local)
   - Commands:
     - `npm run lint`
     - `npm run test`
   - Focused tests to run (existing + new):
     - `npm run test -- tests/slot-finder.test.ts`
     - `npm run test -- tests/unified-task-service.test.ts`
     - `npm run test -- tests/modal-hotkeys.test.ts`
     - `npm run test -- tests/inbox-hotkeys-utils.test.ts`

7) Version / Release Artifacts (Out of scope)
   - 사용자 요청에 따라, 본 플랜은 버전/릴리즈 아티팩트 변경을 포함하지 않는다.

---

## Testing Strategy (High-level; QA 상세는 QA 문서에서)
- Unit: 순수 유틸/가드 로직이 분리된다면 Vitest로 단위 테스트 추가
- Integration/Smoke: 기존 Vitest 스모크 + lint로 회귀 방지

## Risks and Mitigations
- 기능 손실(특정 블록 즉시 선택): TaskModal/편집 경로로 유지되는지 확인 필요(범위 밖이면 최소 안내만)
- 좁은 폭에서 버튼 밀집: 줄바꿈/축약 라벨/구분자 등으로 대응
- hook API 변경 리스크: 선택지 A(호환) 우선 고려, 선택지 B는 변경 범위 확정 후 진행

## Handoff Notes
- Defaults가 이미 적용되어 있으므로, implementer는 바로 작업을 시작할 수 있다.
