---
ID: 077
Origin: 077
UUID: c4a9f2d1
Status: OPEN
---

# Critique: UI 대폭 개선 — RightPanel(Shop) 삭제 + AI 제거 + 스케줄 뷰 모드 전환

- Artifact: [agent-output/planning/077-ui-layout-remove-rightpanel-ai-mode-switch-plan.md](../planning/077-ui-layout-remove-rightpanel-ai-mode-switch-plan.md)
- Critique Date: 2026-01-07
- Status: Initial Review
- Reviewer: Critic Agent

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2026-01-07 | User | Initial review | Plan 077 전면 검토, 리스크/설계/누락 분석 |

---

## 1. Value Statement Assessment ✅

**평가: 적절함 (PASS)**

> As a 사용자(특히 ADHD 사용자), I want 불필요한 사이드 패널/AI 기능을 제거하고 스케줄 화면 안에서 "타임블록·장기목표·인박스"를 즉시 전환할 수 있어, so that 시선 이동/모달 전환 비용 없이 오늘 할 일을 더 빠르게 파악하고 실행할 수 있다.

- ✅ 명확한 사용자 스토리 형식
- ✅ ADHD 친화 원칙(인지부하 감소)과 정렬됨
- ✅ 직접 가치 전달 (공간 확보, 플로우 단순화)
- ✅ 측정 가능한 개선 (시선 이동/모달 전환 비용 감소)

---

## 2. Overview

이 계획은 3개 핵심 변경을 포함:
1. **우측 사이드바(Shop) 완전 제거** → 화면 공간 340px 확보
2. **AI 기능(채팅/일일요약) 제거** → UI 단순화
3. **스케줄뷰 모드 전환 시스템** → 모달 → 인라인 전환

전반적으로 구조화가 잘 되어 있고, 의존성 순서가 논리적이며, 영향도 분류가 적절함.

---

## 3. Architectural Alignment ✅

**현재 아키텍처와의 정합성:**

| 항목 | 상태 | 비고 |
|------|------|------|
| Grid Layout (AppShell) | ⚠️ 주의 | 4컬럼→3컬럼 변환 시 반응형 로직 전면 재검토 필요 |
| systemRepository 영속화 | ✅ 적절 | 새 모드 상태 저장은 기존 패턴 준수 |
| 모달 정책 | ✅ 준수 | ESC 닫힘/백드롭 클릭 금지 유지 |
| Zustand 상태관리 | ✅ 적절 | 새 모드 스토어는 기존 패턴 따름 |
| Feature-based 구조 | ✅ 적절 | 새 파일은 적절한 위치에 배치 |

---

## 4. Scope Assessment

### 4.1 범위 적정성

| 평가 항목 | 판정 | 근거 |
|-----------|------|------|
| 릴리즈 단위로 적절한가? | ⚠️ 경계 | 4 Phase, 15개 Task는 단일 PR로는 과대 |
| MVP 원칙 준수? | ⚠️ 부분적 | Phase 1-2는 삭제만, Phase 3은 신규 기능 |
| 테스트 전략 포함? | ❌ 미흡 | Task 4.2에 "최소 회귀 확인"만 언급 |

**권고사항:**
1. **PR 분할 권장**: Phase 1-2 (삭제) vs Phase 3 (신규) 분리
2. **테스트 전략 구체화 필요**: 특히 Phase 3의 모드 전환 시나리오

### 4.2 제안 PR 분할

```
PR A: 077-phase1-2-remove-rightpanel-ai
  - Phase 1 (Tasks 1.1~1.4)
  - Phase 2 (Tasks 2.1~2.4)
  - Phase 4.1~4.2 (정리/검증)
  - 목표: 삭제만, 신규 기능 없음

PR B: 077-phase3-schedule-view-modes
  - Phase 3 (Tasks 3.1~3.5)
  - 목표: 새 모드 전환 시스템
```

---

## 5. Technical Debt Risks

### 5.1 High Risk

| Risk ID | 설명 | 영향 | 완화 방안 |
|---------|------|------|-----------|
| R1 | **Gemini API 서비스 광범위 사용** | AI 채팅 제거해도 다른 기능(이모지 추천, 인사이트, 날씨, TaskBreakdown 등)이 geminiApi 사용 | Task 2.4 스코프를 "UI 진입점만 제거"로 명확히 제한 |
| R2 | **Grid 레이아웃 반응형 로직** | usePanelLayout의 resize 핸들러(1200px/800px 임계값)가 4컬럼 기준 | Task 1.1에서 임계값 재조정 로직 명시 필요 |
| R3 | **Focus Mode 상호작용** | 현재 Focus Mode는 좌/우 패널 숨김, 새 모드 전환과 충돌 가능 | Task 3.5의 정책 결정이 구현 전 필수 |

### 5.2 Medium Risk

| Risk ID | 설명 | 영향 | 완화 방안 |
|---------|------|------|-----------|
| R4 | **HotkeyHelp 동기화** | 단축키 제거 시 도움말 문구 누락 가능 | Task 4.1에서 HotkeyHelp 컴포넌트 명시 |
| R5 | **GlobalModals 이중 참조** | GeminiFullscreenChat이 AppShell과 GlobalModals 양쪽에서 참조됨 | 두 파일 모두에서 제거 필요 |
| R6 | **systemRepository 키 삭제 vs 유지** | RIGHT_PANELS_COLLAPSED 키 삭제 시 기존 사용자 마이그레이션 이슈 | "미사용으로 남김" 권장 (무해함) |

### 5.3 Low Risk

| Risk ID | 설명 | 영향 |
|---------|------|------|
| R7 | 테스트 파일에 Gemini 관련 mock/fixture | 빌드는 통과하나 불필요 코드 잔존 |
| R8 | chatHistoryRepository 미사용 | 데이터 레이어 정리 시점 결정 필요 |

---

## 6. Findings

### 6.1 Critical Findings

| ID | Issue | Status | Description | Impact | Recommendation |
|----|-------|--------|-------------|--------|----------------|
| C1 | **OPEN QUESTION 3개 미해결** | OPEN | Shop 삭제 범위, Goals/Inbox 모달 유지 여부, 모드 영속화 여부 결정 안됨 | 구현 방향 모호 → 재작업 리스크 | 구현 전 OPEN QUESTION 모두 RESOLVED 처리 필수 |
| C2 | **GlobalModals.tsx 누락** | OPEN | GeminiFullscreenChat 참조하는 두 번째 파일 누락 | 빌드 실패 가능 | Task 2.3에 GlobalModals.tsx 추가 |
| C3 | **반응형 임계값 재조정 미명시** | OPEN | 4컬럼→3컬럼 시 1200px/800px 임계값 로직 변경 필요 | 반응형 깨짐 가능 | Task 1.1에 usePanelLayout 반응형 로직 재정의 항목 추가 |

### 6.2 Medium Findings

| ID | Issue | Status | Description | Impact | Recommendation |
|----|-------|--------|-------------|--------|----------------|
| M1 | **AI 서비스 삭제 범위 모호** | OPEN | Task 2.4가 "선택"으로 표기되나 의존성 파악 없이는 판단 불가 | 불필요 삭제 시 빌드 실패 | geminiApi 사용처 목록을 Plan에 명시 (현재 15+ 파일에서 사용) |
| M2 | **테스트 전략 부재** | OPEN | "최소 회귀 확인"만 언급, 구체 시나리오 없음 | 회귀 감지 실패 가능 | 최소한 모드 전환 E2E 시나리오 3개 명시 권장 |
| M3 | **InboxTab vs InboxModal 혼용** | OPEN | Task 3.2에서 InboxTab 사용하나 기존은 InboxModal | 컴포넌트 재사용 또는 신규 개발 여부 불명확 | InboxTab 존재 여부 확인 및 명시 |
| M4 | **PR 분할 제안 없음** | OPEN | 15개 Task 단일 PR은 리뷰 부담 | 리뷰 품질 저하 | 2 PR 분할 권장 (Phase 1-2 / Phase 3) |

### 6.3 Low Findings

| ID | Issue | Status | Description | Recommendation |
|----|-------|--------|-------------|----------------|
| L1 | **TopToolbar onOpenGeminiChat prop 제거 순서** | OPEN | Task 2.2에서 prop 제거 전 사용처 확인 | TopToolbarProps 인터페이스도 함께 수정 |
| L2 | **rightPanelTab 상태 처리** | OPEN | AppShell에 rightPanelTab/setRightPanelTab 상태 존재 | Task 1.1에서 함께 제거 필요 |
| L3 | **ShopModal 진입점 확인** | OPEN | ShopPanel 외에 ShopModal도 존재 | 두 컴포넌트 모두 제거 대상인지 명시 |

---

## 7. Unresolved Open Questions ⚠️

**경고: 이 계획에 3개의 미해결 OPEN QUESTION이 있습니다.**

| # | Question | 권장 답변 | 영향 Task |
|---|----------|-----------|-----------|
| 1 | Shop 코드/데이터는 "UI 접근만 제거"로 남길까요, 전체 삭제할까요? | **UI 접근만 제거 권장** (향후 재활용 가능) | Task 1.4 |
| 2 | Goals/Inbox 모달은 완전히 제거할까요, 보조 진입점으로 남길까요? | **보조 진입점으로 유지 권장** (단축키 접근) | Task 3.3 |
| 3 | 스케줄 뷰 모드는 앱 재시작 후에도 유지해야 하나요? | **Yes - systemRepository에 저장** (일관된 UX) | Task 3.1 |

**질문:** 위 OPEN QUESTION들이 미해결 상태입니다. 이 상태로 구현 승인할까요, 아니면 Planner가 먼저 해결해야 할까요?

---

## 8. Risk Assessment Summary

| Category | Count | Most Critical |
|----------|-------|---------------|
| High | 3 | R1 (Gemini API 광범위 사용) |
| Medium | 3 | R5 (GlobalModals 이중 참조) |
| Low | 2 | R7 (테스트 fixture 정리) |

**전체 리스크 수준: MEDIUM-HIGH**

주요 리스크 요인:
1. OPEN QUESTION 미해결로 인한 구현 방향 모호
2. AI 서비스 삭제 범위 결정 필요
3. 반응형 레이아웃 로직 재정의 누락

---

## 9. Recommendations

### 9.1 구현 전 필수 조치

1. **OPEN QUESTION 3개 해결** - Planner에게 반환하여 명확한 답변 확보
2. **GlobalModals.tsx 파일 추가** - Task 2.3에 누락된 파일 명시
3. **반응형 임계값 로직 추가** - Task 1.1에 usePanelLayout 수정 사항 명시

### 9.2 계획 개선 제안

1. **PR 분할**: Phase 1-2 (삭제) / Phase 3 (신규) 2개 PR로 분리
2. **AI 서비스 사용처 명시**: geminiApi 사용 파일 목록을 Plan에 추가
3. **테스트 시나리오 명시**: 최소 3개 핵심 시나리오
   - 모드 전환 후 상태 유지
   - Focus Mode에서 모드 전환 동작
   - 반응형 레이아웃 임계값 동작

### 9.3 병렬 실행 가능 Task

| 그룹 | Tasks | 근거 |
|------|-------|------|
| A | Task 1.1, 2.1, 2.2 | 서로 독립적인 UI 영역 |
| B | Task 1.2, 1.3 | Task 1.1 의존 |
| C | Task 3.1 | Phase 1-2 완료 후 독립 착수 가능 |

### 9.4 순서 최적화 제안

현재 순서는 전반적으로 적절하나, 다음 최적화 권장:

```
Phase 1.1 → [1.2, 1.3 병렬] → 1.4
Phase 2.1, 2.2 병렬 → 2.3 → 2.4 (조건부)
Phase 3.1 → [3.2, 3.4 병렬] → 3.3 → 3.5
Phase 4.1 → 4.2 → 4.3
```

---

## 10. Verdict

| 항목 | 판정 |
|------|------|
| Value Statement | ✅ PASS |
| Architectural Fit | ✅ PASS |
| Scope Appropriateness | ⚠️ CAUTION (PR 분할 권장) |
| Completeness | ❌ INCOMPLETE (OPEN QUESTIONS 미해결) |
| Risk Level | ⚠️ MEDIUM-HIGH |

**최종 판정: CONDITIONAL APPROVAL**

다음 조건 충족 시 구현 진행 가능:
1. ✅ OPEN QUESTION 3개에 대한 결정 확정
2. ✅ GlobalModals.tsx를 Task 2.3에 추가
3. ✅ 반응형 임계값 로직을 Task 1.1에 명시

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-07 | Initial critique |
