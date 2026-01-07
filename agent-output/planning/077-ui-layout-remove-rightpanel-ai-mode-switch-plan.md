---
ID: 077
Origin: 077
UUID: c4a9f2d1
Status: Active
---

# UI 대폭 개선 — RightPanel(Shop) 삭제 + AI 제거 + 스케줄 뷰 모드 전환

- Plan ID: plan-2026-01-07-ui-remove-rightpanel-ai-mode-switch
- Target Release: **1.0.187 (제안)** (현재 package.json = 1.0.186)
- Epic Alignment: UI 인지부하 감소, 화면 단순화(ADHD 친화), 핵심 플로우(스케줄/인박스/목표) 집중
- Status: Draft (승인 필요)

## Changelog
- 2026-01-07: Draft created from user requirements + codebase discovery (AppShell/usePanelLayout/TopToolbar).

## Value Statement and Business Objective
As a 사용자(특히 ADHD 사용자), I want 불필요한 사이드 패널/AI 기능을 제거하고 스케줄 화면 안에서 “타임블록·장기목표·인박스”를 즉시 전환할 수 있어, so that 시선 이동/모달 전환 비용 없이 오늘 할 일을 더 빠르게 파악하고 실행할 수 있다.

## Scope & Constraints
- Scope: Renderer UI 변경(React/TS) + 관련 상태/단축키/설정 UI 정리.
- Out of scope: Supabase/Firebase/Electron IPC의 신규 구현 또는 프로토콜 변경.
- 정책 준수: localStorage 신규 사용 금지, defaults 하드코딩 금지, 모달 정책(ESC 닫힘/백드롭 클릭 닫힘 금지) 유지.

## Inputs (현재 구조 요약)
- Layout: AppShell 그리드(좌 BattleSidebar → 타임라인(옵션) → 중앙 ScheduleView → 우측 RightPanel(shop))
- Layout 상태: usePanelLayout에서 좌/우 접힘 + 타임라인 표시를 systemRepository로 영속화
- Goals/Inbox: TopToolbar에서 모달로 열림 (InboxModal/GoalsModal)
- AI: TopToolbar(일일요약), AppShell(useModalState + GeminiFullscreenChat)

## OPEN QUESTIONS (승인 필요)
1) Shop 코드/데이터는 “UI 접근만 제거”로 남길까요, 아니면 Shop 기능 전체 삭제(파일 삭제 포함)까지 할까요?
2) Goals/Inbox 모달(GoalsModal/InboxModal)은 완전히 제거할까요, 아니면 보조 진입점(예: 단축키/설정)으로 남길까요?
3) 스케줄 뷰 모드(타임블록/목표/인박스)는 앱 재시작 후에도 유지(persist)해야 하나요? (제안: systemRepository에 저장)

---

## Task 목록

### Phase 1: 우측 사이드바 삭제
- Task 1.1: AppShell 그리드에서 RightPanel 제거 - [src/app/AppShell.tsx](src/app/AppShell.tsx), [src/app/hooks/usePanelLayout.ts](src/app/hooks/usePanelLayout.ts) - RightPanel 렌더/컬럼(340px) 제거 및 3컬럼(좌/타임라인/중앙) 레이아웃으로 재정의.
  - 예상 영향도: High (메인 레이아웃/반응형/집중모드에 직접 영향)
  - 의존성: 없음

- Task 1.2: RightPanel 토글 기능 제거(단축키 포함) - [src/app/hooks/useKeyboardShortcuts.ts](src/app/hooks/useKeyboardShortcuts.ts), [src/features/settings/components/tabs/ShortcutsTab.tsx](src/features/settings/components/tabs/ShortcutsTab.tsx), [src/shared/types/domain.ts](src/shared/types/domain.ts) - rightPanelToggleKey 설정 항목 및 단축키 바인딩 제거(문구 포함).
  - 예상 영향도: Medium (설정/단축키 UX 변경)
  - 의존성: Task 1.1

- Task 1.3: 우측 패널 접힘 상태/저장 경로 정리 - [src/app/hooks/usePanelLayout.ts](src/app/hooks/usePanelLayout.ts), [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts) - RIGHT_PANELS_COLLAPSED 읽기/쓰기 중단(키는 삭제하지 않고 “미사용”으로 남기거나, 삭제 시 마이그레이션/호환성 검토).
  - 예상 영향도: Medium (systemState 저장 키 사용 변경)
  - 의존성: Task 1.1

- Task 1.4: RightPanel/Shop 컴포넌트 정리 - [src/app/components/RightPanel.tsx](src/app/components/RightPanel.tsx), [src/features/shop/ShopPanel.tsx](src/features/shop/ShopPanel.tsx), [src/features/shop/ShopModal.tsx](src/features/shop/ShopModal.tsx) - UI 진입점 제거 후, 남은 참조/빌드 에러 여부에 따라 (A) 파일 유지(미사용) 또는 (B) 기능/파일 삭제로 정리.
  - 예상 영향도: Low~High (삭제 범위 선택에 따라 급변)
  - 의존성: Task 1.1

### Phase 2: AI 기능 삭제
- Task 2.1: AI 요약(일일요약) CTA 및 모달 제거 - [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx), [src/features/insight/DailySummaryModal.tsx](src/features/insight/DailySummaryModal.tsx) - TopToolbar의 “📝 AI 요약” 버튼/상태(showDailySummary) 제거. (선택) DailySummaryModal 자체도 더 이상 사용처가 없으면 제거.
  - 예상 영향도: Medium (상단 툴바 구성/기능 감소)
  - 의존성: 없음

- Task 2.2: AI 채팅 CTA 제거(툴바) - [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx), [src/app/AppShell.tsx](src/app/AppShell.tsx) - TopToolbar의 “✨ AI 채팅” 버튼 및 AppShell에서 onOpenGeminiChat prop 전달 제거.
  - 예상 영향도: Medium (상단 툴바 + AppShell props 변경)
  - 의존성: 없음

- Task 2.3: GeminiFullscreenChat 기능 제거(모달 상태 포함) - [src/app/hooks/useModalState.ts](src/app/hooks/useModalState.ts), [src/app/AppShell.tsx](src/app/AppShell.tsx), [src/features/gemini/GeminiFullscreenChat.tsx](src/features/gemini/GeminiFullscreenChat.tsx) - useModalState에서 geminiChat 상태/핸들러 제거, AppShell에서 GeminiFullscreenChat 렌더 제거. (선택) GeminiFullscreenChat 파일 및 관련 폴더 삭제.
  - 예상 영향도: Medium~High (모달/상태/의존 컴포넌트 제거)
  - 의존성: Task 2.2

- Task 2.4: AI 관련 서비스/패키지 정리(선택) - [src/shared/services/rag/embeddingService.ts](src/shared/services/rag/embeddingService.ts), [package.json](package.json) - @google/generative-ai 의존성과 RAG 관련 서비스가 더 이상 사용되지 않으면 제거. 사용처가 남아있다면 “미사용 경로만 제거”로 스코프 축소.
  - 예상 영향도: High (의존성 제거는 빌드/기능에 파급)
  - 의존성: Task 2.1~2.3 완료 후, 실제 사용처 조사 결과

### Phase 3: 스케줄뷰 모드 전환 시스템
- Task 3.1: 스케줄 메인 모드 상태 도입(타임블록/목표/인박스) - [src/features/schedule/stores](src/features/schedule/stores) (신규 파일), [src/data/repositories/systemRepository.ts](src/data/repositories/systemRepository.ts) - `timeblock | goals | inbox` 모드 정의 및 전역 상태(선택: systemRepository에 영속화) 추가.
  - 예상 영향도: Medium (새 전역 UI 상태)
  - 의존성: Phase 1/2와 논리적으로 독립(하지만 UI 충돌 줄이려면 1.1 이후 권장)

- Task 3.2: CenterContent를 모드 기반 렌더로 전환 - [src/app/components/CenterContent.tsx](src/app/components/CenterContent.tsx), [src/features/schedule/ScheduleView.tsx](src/features/schedule/ScheduleView.tsx), [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx), [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx) - 중앙 영역에 “모드별 화면”을 직접 렌더(모달이 아닌 인라인).
  - 예상 영향도: High (핵심 화면 전환/퍼포먼스/핫키 충돌 가능)
  - 의존성: Task 3.1

- Task 3.3: TopToolbar에 모드 전환 버튼 추가(3-way) + 기존 Goals/Inbox 모달 진입 제거 - [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx), [src/features/tasks/InboxModal.tsx](src/features/tasks/InboxModal.tsx), [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) - CTA 영역의 “🎯 목표/📥 인박스”를 모드 토글로 대체하고, 모달 렌더를 제거하거나 보조 진입으로 격하.
  - 예상 영향도: High (상단 내비게이션/사용 플로우 변경)
  - 의존성: Task 3.1~3.2

- Task 3.4: 단축키 동작 재정의(모달 오픈 → 모드 전환) - [src/features/goals/hooks/useGoalsHotkeys.ts](src/features/goals/hooks/useGoalsHotkeys.ts), [src/app/hooks/useKeyboardShortcuts.ts](src/app/hooks/useKeyboardShortcuts.ts) - 기존 Ctrl/Cmd+Shift+G 등은 Goals 모드로 전환하도록 변경(또는 제거). Inbox 모드 전환 단축키는 기존 충돌 여부를 확인 후 추가/조정.
  - 예상 영향도: Medium (학습 비용/회귀 가능)
  - 의존성: Task 3.1

- Task 3.5: Focus Mode와 모드 전환의 정책 결정 - [src/features/schedule/stores/focusModeStore.ts](src/features/schedule/stores/focusModeStore.ts), [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx) - Focus Mode에서는 (제안) 타임블록 모드 고정 또는 모드 토글 비활성화 등 일관된 규칙을 확정.
  - 예상 영향도: Medium (집중모드 UX 일관성)
  - 의존성: Task 3.1~3.3

### Phase 4: 정리 및 검증
- Task 4.1: 참조/임포트/설정 문구 정리 - [src/app/AppShell.tsx](src/app/AppShell.tsx), [src/app/components/TopToolbar.tsx](src/app/components/TopToolbar.tsx), [src/features/settings/components/tabs/ShortcutsTab.tsx](src/features/settings/components/tabs/ShortcutsTab.tsx) - 제거된 기능(우측패널/AI)의 잔여 문구/핫키 도움말/불필요 state 정리.
  - 예상 영향도: Low~Medium
  - 의존성: Phase 1~3 완료 후

- Task 4.2: 빌드/정적 검증 - [package.json](package.json) - `npm run lint`, `npm test`, `npm run electron:dev` 기준으로 최소 회귀 확인(구체 테스트케이스는 QA 문서로 이관).
  - 예상 영향도: Medium (회귀 발견 가능)
  - 의존성: Phase 1~3 완료 후

- Task 4.3: 버전/릴리즈 아티팩트 정합(제안) - [package.json](package.json) - Target Release를 1.0.187 라인으로 맞추는 버전 bump 및 릴리즈 노트(존재 시) 반영.
  - 예상 영향도: Low
  - 의존성: Task 4.2
