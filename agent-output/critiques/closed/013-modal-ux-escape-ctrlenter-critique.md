# 013-modal-ux-escape-ctrlenter-critique

**Artifact**: [agent-output/analysis/012-modal-ux-escape-ctrlenter-analysis.md](../analysis/012-modal-ux-escape-ctrlenter-analysis.md)  
**Date**: 2025-12-22  
**Status**: Initial Review  
**Review Type**: Pre-implementation Risk/Priority Analysis

---

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2025-12-22 | User → Critic | 리스크/우선순위 분석 요청 | 초기 critique 작성. ESC/Ctrl+Enter 적용 시 리스크 10개, Quick win 6개, 구조 개선 4개 도출 |

---

## Value Statement Assessment ✅

분석 문서의 Value Statement는 명확함:
> "Consistent keyboard affordances (ESC close, Ctrl+Enter primary action) reduce friction for power users and prevent modal stacking/escape bugs that block flows."

**Power user UX 향상 + 모달 스택 버그 방지**라는 이중 가치가 정당화됨. 단, Ctrl+Enter가 실제로 얼마나 사용되는지(telemetry 없음) 불확실하여 **추정된 가치**임에 유의.

---

## Risk Inventory (10개)

### 🔴 Critical Risks (구현 전 반드시 해결)

| # | Risk | Description | Impact | Mitigation |
|---|------|-------------|--------|------------|
| **R1** | **IME 입력 중 ESC 충돌** | 한글 IME 조합 중 ESC 키가 조합 취소와 모달 닫기 양쪽에 반응. 현재 훅은 `compositionend` 체크 없음. | 한글 입력 후 모달이 의도치 않게 닫힘 | 훅에 `e.isComposing` 체크 추가 또는 `compositionstart/end` 상태 추적 |
| **R2** | **Textarea 다중행 입력 시 ESC 혼란** | 큰 textarea(Memo, BulkAdd)에서 ESC 누르면 편집 취소 의도인지 모달 닫기 의도인지 불명확. | 사용자 입력 손실 가능 | 포커스가 textarea일 때는 ESC 첫 번째로 blur만 하고, 두 번째 ESC에 닫기? (UX 결정 필요) |
| **R3** | **Ctrl+Enter가 contentEditable/RichText에서 줄바꿈과 충돌** | 일부 rich editor에서 Ctrl+Enter = 줄바꿈 관례. 현재 코드베이스에 contentEditable 없으나 향후 도입 시 충돌. | 향후 확장 시 UX 혼란 | 문서화 + 컨벤션 정의: "Rich editor 도입 시 Shift+Enter = 줄바꿈, Ctrl+Enter = 제출" |

### 🟠 Medium Risks (구현 중 주의)

| # | Risk | Description | Impact | Mitigation |
|---|------|-------------|--------|------------|
| **R4** | **GoalsModal/BossAlbumModal의 자체 스택 로직 vs 훅 스택** | 두 모달이 `useModalEscapeClose` 대신 자체 window listener로 자식 모달 체크함. 훅으로 마이그레이션 시 스택 순서 차이로 이중 닫힘 발생 가능. | 부모-자식 모달 동시 닫힘 | 마이그레이션 시 자식 모달도 함께 훅으로 전환 + RTL 테스트로 스택 순서 검증 |
| **R5** | **Set 기반 스택의 비결정적 순서** | `modalStack`이 `Set`인데, ES6 Set은 삽입 순서 보장하지만 Symbol 비교 시 "가장 마지막"이 의도대로인지 테스트 부재. | 빠른 마운트/언마운트 시 의도치 않은 모달이 ESC 반응 | Unit test 추가: 두 모달 동시 마운트 → ESC → 올바른 모달만 닫히는지 |
| **R6** | **macOS metaKey 누락** | 일부 Ctrl+Enter 구현은 `ctrlKey`만 체크, `metaKey` 누락. macOS 사용자 UX 불일치. | macOS에서 Cmd+Enter 작동 안 함 | 공통 훅에서 `(e.ctrlKey \|\| e.metaKey) && e.key === 'Enter'` 표준화 |
| **R7** | **Select/Dropdown 열린 상태에서 ESC** | Select 컴포넌트(예: TaskModal의 difficulty 선택)가 열린 상태에서 ESC는 드롭다운 닫기인지 모달 닫기인지 불명확. | 드롭다운+모달 동시 닫힘 | Select 라이브러리(shadcn/radix)가 ESC stopPropagation 하는지 확인. 안 하면 wrapper 필요 |

### 🟡 Low Risks (문서화/모니터링)

| # | Risk | Description | Impact | Mitigation |
|---|------|-------------|--------|------------|
| **R8** | **정보성 모달에 Ctrl+Enter 불필요** | CompletionCelebrationModal, StatsModal 등 "확인" 버튼만 있는 모달에 Ctrl+Enter 추가 시 혼란 | 사용자가 단축키 예측 불가 | 정책 정의: "Primary action이 데이터 변경/저장일 때만 Ctrl+Enter 적용" |
| **R9** | **다중 window listener 누수** | 모달이 많아질수록 window keydown listener 개수 증가. cleanup 누락 시 메모리/성능 이슈. | 장기 세션에서 성능 저하 | 훅 사용 강제화로 cleanup 일관성 확보. DevTools에서 listener 개수 모니터링 |
| **R10** | **Blocking 모달 의도적 ESC 비활성화 케이스** | 일부 모달(예: 결제 확인, 중요 경고)은 실수 닫기 방지를 위해 ESC 비활성화가 의도된 UX일 수 있음. | 일괄 적용 시 의도적 UX 훼손 | 훅에 `{ disableEscape: true }` 옵션 추가 또는 해당 모달 예외 문서화 |

---

## Quick Wins (낮은 리스크, 높은 ROI)

| # | Task | Scope | Expected Effect | Trade-off |
|---|------|-------|-----------------|-----------|
| **Q1** | **useModalEscapeClose에 `isComposing` 가드 추가** | [useModalEscapeClose.ts](../src/shared/hooks/useModalEscapeClose.ts) 수정 (5줄 이내) | R1 해결. 한글 IME 충돌 완전 방지 | 없음. 순수 버그픽스 |
| **Q2** | **GoalsModal을 훅으로 마이그레이션** | [GoalsModal.tsx](../src/features/goals/GoalsModal.tsx#L52-L69) → `useModalEscapeClose` 교체 | R4 부분 해결. 스택 일관성 확보 | 자식 WeeklyGoalModal 이미 훅 사용 중이라 충돌 없음. 단, 자체 스택 로직 제거 필요 |
| **Q3** | **BossAlbumModal을 훅으로 마이그레이션** | [BossAlbumModal.tsx](../src/features/battle/components/BossAlbumModal.tsx#L515-L526) → `useModalEscapeClose` 교체 | R4 해결. 전체 모달 스택 통일 | 내부 `selectedBoss` 상태 먼저 닫는 로직 유지해야 함 → 훅 사용 + 추가 로직 필요 |
| **Q4** | **기존 Ctrl+Enter 구현에 metaKey 추가** | 5개 모달 수정 (TaskModal, MemoModal, BulkAddModal, TaskBreakdownModal, ShopModal) | R6 해결. macOS UX 일관성 | 이미 일부는 metaKey 포함. 누락된 곳만 추가 |
| **Q5** | **Ctrl+Enter 지원 모달 목록 문서화** | README 또는 copilot-instructions.md 업데이트 | R8 방지. 팀 컨벤션 명확화 | 문서 유지보수 부담 |
| **Q6** | **useModalEscapeClose 스택 동작 unit test 추가** | tests/ 폴더에 RTL + jsdom 테스트 | R5 해결. 스택 순서 보장 검증 | 테스트 작성 시간 (30분~1시간) |

---

## Structural Improvements (중간~높은 리스크)

| # | Task | Scope | Necessity | Trade-off |
|---|------|-------|-----------|-----------|
| **S1** | **usePrimaryActionHotkey 공통 훅 신규 생성** | 새 훅 + 기존 5개 모달 마이그레이션 | ad-hoc listener 난립 방지. 향후 모달 추가 시 일관성 보장 | 신규 추상화 도입 비용. 기존 코드 수정 범위 넓음 |
| **S2** | **모달 스택 관리자 중앙화 (ModalStackContext)** | Context Provider + 모든 모달 래핑 | 현재 Set 기반 전역 변수보다 React-native한 상태 관리. DevTools 연동 가능 | 전체 모달 리팩토링 필요. 오버엔지니어링 우려 |
| **S3** | **Select/Dropdown ESC 전파 표준화** | radix-ui 또는 shadcn Select 동작 검증 + wrapper 추가 | R7 완전 해결. 드롭다운-모달 ESC 충돌 방지 | 컴포넌트 라이브러리 의존성 조사 필요 |
| **S4** | **ESC 비활성화 모달 예외 시스템** | 훅에 옵션 추가 + 정책 문서화 | R10 해결. 의도적 blocking 모달 지원 | 예외가 많아지면 일관성 훼손 |

---

## Priority Recommendation

### Phase 1: 즉시 실행 (0.5일)
**Q1 → Q6 → Q4** 순서

- **Q1 (isComposing)**: 한글 사용자 버그이므로 최우선
- **Q6 (스택 테스트)**: Q2/Q3 마이그레이션 전 안전망 필수
- **Q4 (metaKey)**: 기존 코드 최소 수정, macOS UX 즉시 개선

**희생하는 것**: 구조 개선 없이 땜질. 기술 부채 일부 누적.

### Phase 2: 단기 (1일)
**Q2 → Q3 → Q5**

- GoalsModal, BossAlbumModal 마이그레이션으로 **스택 100% 통일**
- 문서화로 팀 컨벤션 정립

**희생하는 것**: 신규 훅(S1) 없이 진행하므로 Ctrl+Enter 확장은 ad-hoc 유지.

### Phase 3: 선택적 구조 개선 (2~3일)
**S1 → S4** (필요 시)

- 모달이 30개 이상으로 증가하거나, Ctrl+Enter 요구가 늘어날 때 투자
- 현재 25개 모달 규모에서는 **YAGNI 원칙** 적용 가능

**희생하는 것**: 장기 유지보수성. 모달 추가 시마다 ad-hoc 구현 반복.

---

## Trade-off Summary

| Approach | Pros | Cons |
|----------|------|------|
| **Quick wins only** | 빠른 적용, 낮은 리스크, 즉각적 UX 개선 | 기술 부채 누적, 향후 모달마다 반복 작업 |
| **Full structural refactor** | 일관성, 확장성, DevTools 연동 | 오버엔지니어링, 2~3일 소요, 25개 모달 규모에서 과도함 |
| **Hybrid (권장)** | Quick wins로 즉각 가치 + 테스트로 안전망 + 문서로 컨벤션 | S1/S2는 보류하여 구조적 일관성 지연 |

---

## Unresolved Open Questions (분석 문서에서)

1. **Ctrl+Enter 적용 범위**: 정보성 모달 포함 여부 → **Recommendation**: 데이터 변경 모달만 적용
2. **macOS metaKey 일관성**: → **Recommendation**: 모든 Ctrl+Enter에 metaKey 추가
3. **ESC 의도적 비활성화 케이스**: 현재 없음으로 확인됨. 향후 필요 시 옵션 추가.

---

## Status Summary

- **Critical Risks**: 3개 (R1 IME, R2 textarea, R3 contentEditable)
- **Medium Risks**: 4개 (R4~R7)
- **Low Risks**: 3개 (R8~R10)
- **Quick Wins**: 6개 (0.5~1일)
- **Structural Improvements**: 4개 (선택적)

**Recommendation**: Phase 1 + Phase 2 진행으로 **1.5일 내 ESC/Ctrl+Enter UX 90% 커버**. 구조 개선은 모달 규모 증가 시점에 재평가.
