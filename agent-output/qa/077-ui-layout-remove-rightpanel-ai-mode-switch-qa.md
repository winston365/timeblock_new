---
ID: 077
Origin: 077
UUID: c4a9f2d1
Status: QA Failed
---

# QA Report: UI 대폭 개선 — RightPanel 삭제 + AI 제거 + 스케줄 뷰 모드 전환

**Plan Reference**: `agent-output/planning/077-ui-layout-remove-rightpanel-ai-mode-switch-plan.md`
**QA Status**: QA Failed
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2026-01-07 | User | UI 개편 완료, QA 검증 요청 | 테스트 전략 수립 및 정적/동작 검증 수행. RightPanel 단축키 설정 잔존, localStorage 신규 사용 등 이슈로 QA Failed. |

## Timeline
- **Test Strategy Started**: 2026-01-07
- **Test Strategy Completed**: 2026-01-07
- **Implementation Received**: 2026-01-07
- **Testing Started**: 2026-01-07
- **Testing Completed**: 2026-01-07
- **Final Status**: QA Failed

## Test Strategy (Pre-Implementation)

### Testing Infrastructure Requirements
**Test Frameworks Needed**:
- Vitest (기존 사용)

**Testing Libraries Needed**:
- (선택) React 컴포넌트 상호작용 검증용: `@testing-library/react`, `@testing-library/user-event`
- (선택) DOM 환경: `happy-dom` 또는 `jsdom`

**Configuration Files Needed**:
- (선택) UI 테스트를 추가할 경우: `vitest.config.ts`에서 `environment` 전환 또는 파일별 환경 주석 사용

**Build Tooling Changes Needed**:
- 없음 (현재는 Node 환경 단위테스트 중심)

### Required Unit Tests
- 스케줄 뷰 모드 스토어: 기본값/모드 변경/영속화(정책에 따라 storage 결정)

### Required Integration Tests
- (가능하면) TopToolbar 모드 버튼 클릭 → CenterContent 렌더링 변화
- (가능하면) 앱 재시작 시 마지막 모드 복구

### Acceptance Criteria
- RightPanel(우측 사이드바) UI/토글/설정 진입점이 사용자 UI에서 완전 제거
- AI 요약/채팅 진입점이 사용자 UI에서 제거되고, 관련 전역 모달 렌더 경로가 남지 않음
- 모드 전환 버튼이 정상 동작하고, 모드별 올바른 컴포넌트가 렌더링됨
- 모드 상태가 정책에 맞는 저장소에 영속화됨

## Implementation Review (Post-Implementation)

### Code Changes Summary
- 레이아웃 4컬럼 → 3컬럼 전환, RightPanel 제거
- TopToolbar에서 Goals/Inbox 모달 진입 대신 3-way 모드 토글 추가
- AI 요약/채팅 모달 렌더 및 useModalState gemini 상태 제거
- 신규: `useScheduleViewModeStore` + `GoalsInlineView` + `InboxInlineView`

## Test Coverage Analysis

### New/Modified Code
| File | Function/Class | Test File | Test Case | Coverage Status |
|------|----------------|-----------|-----------|-----------------|
| src/shared/stores/useScheduleViewModeStore.ts | useScheduleViewModeStore | tests/schedule-view-mode-store.test.ts | defaults/persist/rehydrate | COVERED (단, storage 정책 이슈) |
| src/app/components/CenterContent.tsx | CenterContent | (없음) | 모드별 렌더링 | MISSING |
| src/app/components/TopToolbar.tsx | TopToolbar | (없음) | 모드 버튼 클릭/상태 반영 | MISSING |
| src/app/hooks/usePanelLayout.ts | usePanelLayout | (없음) | 3컬럼/FocusMode 적용 | MISSING |
| src/app/hooks/useKeyboardShortcuts.ts | useKeyboardShortcuts | (기존 테스트) | 단축키 회귀 | PARTIAL (기존 테스트 의존) |

### Coverage Gaps
- 모드 버튼 클릭 → 실제 렌더링 전환(컴포넌트 통합 테스트) 없음
- RightPanel/AI 제거에 대한 “사용자 UI 관점” 회귀 테스트 없음

## Test Execution Results

### Unit Tests
- **Command**: `npm test`
- **Status**: PASS (44 files / 519 tests)
- **New Tests Added**: `tests/schedule-view-mode-store.test.ts` PASS

### Lint
- **Command**: `npm run lint`
- **Status**: FAIL (baseline 이슈 존재)
- **Note**: 변경된 9개 파일만 대상으로 한 ESLint는 PASS.

### Build
- **Command**: `npm run build`
- **Status**: PASS (경고: chunk size/dynamic import 관련)

### Typecheck
- **Command**: `npx tsc -p tsconfig.json --noEmit`
- **Status**: FAIL (baseline 이슈 존재)

---

## Key Issues (QA Failed Reasons)

1) RightPanel 토글 설정 UI 잔존
- `src/features/settings/components/tabs/ShortcutsTab.tsx`에 “우측 패널 토글” 입력/기본 단축키 목록이 남아있음
- `src/shared/types/domain.ts`에 `rightPanelToggleKey`가 남아있고, 실제 동작 코드(`useKeyboardShortcuts`)에서는 더 이상 처리하지 않음 → 사용자에게 ‘동작하지 않는 설정’을 노출

2) 스케줄 뷰 모드 영속화가 localStorage에 직접 의존
- `src/shared/stores/useScheduleViewModeStore.ts`가 `zustand/persist` 기본 storage(localStorage)에 저장
- Plan 077의 제약(“localStorage 신규 사용 금지”)과 상충 가능
- Node 환경(테스트/비-브라우저)에서 import 시 런타임 의존성 리스크가 있으므로 저장소 정책 결정 필요

3) AI 채팅/전역 모달 경로가 코드베이스에 잔존 (dead code 위험)
- `src/app/components/GlobalModals.tsx`가 `GeminiFullscreenChat`를 렌더링
- 현재 AppShell이 GlobalModals를 사용하지 않는 것으로 보이지만, 재도입 시 “AI 제거” 요구사항을 되살릴 위험

## Recommended Fixes (Implementer Action Items)
- RightPanel 단축키 설정 항목 제거 또는 ‘Deprecated’ 처리(표시 숨김 + 타입 제거/마이그레이션)
- `useScheduleViewModeStore` 영속화 저장소를 `systemRepository`(Dexie `db.systemState`) 기반으로 변경(또는 “이번 릴리스는 localStorage 허용”을 명시적으로 정책 예외로 기록)
- GlobalModals 및 uiStore의 gemini/rightPanel 관련 상태를 정리(미사용이면 삭제)
- (선택) 모드 전환 통합 테스트 추가(TopToolbar 클릭 → CenterContent 렌더링 확인)

## Handoff
Handing off to uat agent for value delivery validation
