# Critique — 016-long-term-goals-ux-final-now-next-later (추가기능 10 + UI/UX 10)

Artifact path: [agent-output/planning/016-long-term-goals-ux-final-now-next-later.md](../planning/016-long-term-goals-ux-final-now-next-later.md)
Prior Proposal: [agent-output/planning/015-weekly-goals-ui-enhancements-proposal.md](../planning/015-weekly-goals-ui-enhancements-proposal.md)
Prior Critique: [agent-output/critiques/015-weekly-goals-ui-enhancements-proposal-critique.md](./015-weekly-goals-ui-enhancements-proposal-critique.md)
Architecture ref: [agent-output/architecture/005-long-term-goals-frontend-architecture-findings.md](../architecture/005-long-term-goals-frontend-architecture-findings.md)
Date: 2025-12-23
Status: **Initial — OPEN**

---

## Changelog
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-23 | User request | "추가기능 10 + UI/UX 10" 비판적 리뷰: 장기목표 정합성, 로컬-퍼스트 제약, ADHD 친화성, 중복/범위 과대/모호성, 상위 ROI 5개 선정 |

---

## Executive Summary

오빠, 이 제안은 전반적으로 잘 다듬어져 있지만 몇 가지 핵심 문제가 있어요:

1. **NOW 항목이 4개로 적절**하나, 세부 구현 복잡도가 과소평가됨
2. **ADHD 친화성이 개선됐지만** 여전히 "정보 밀도 증가" 리스크 존재
3. **LATER 항목(8-10)은 "디자인 탐색만"으로 제한됐으나**, 구체성이 부족해 불필요한 기대 관리 비용 발생
4. **ROI 관점에서 상위 5개 선별** 필요 (아래 분석 참조)

---

## 1. 장기 목표 목적과의 정합성 (Alignment)

### Value Statement 평가

> "주간 목표를 '오늘 무엇을 하면 되는지' 즉시 이해하고, 뒤처졌을 때 죄책감 대신 예측 가능한 회복 안내를 받으며, 실수 없이 안전하게 진행을 기록해서, 목표가 부담이 아니라 실행을 돕는 가벼운 안내판이 된다."

| 원칙 | 정합성 | 평가 |
|------|--------|------|
| 즉시 이해 | ✅ | Task B1 (텍스트 배지 + Today target) |
| 예측 가능한 회복 | ✅ | Epic A (Catch-up 2.0 + 배너) |
| 안전한 기록 | ✅ | Epic D (Undo + snackbar) |
| 가벼운 안내판 | ⚠️ | 정보 추가로 인해 "무거워질" 위험 |

**Gap**: "가벼운 안내판"이라는 목적과 "NOW 4개 Epic에 11개 Task"라는 범위가 충돌할 수 있어요. 오히려 기능 추가로 인지 부하가 증가할 수 있음.

---

## 2. 로컬-퍼스트 (Electron + Dexie) 제약 준수

### 평가 매트릭스

| 항목 | localStorage 사용 | Dexie systemState | Backend 의존 | 준수 |
|------|------------------|-------------------|-------------|------|
| A1: Snooze state | ❌ | ✅ SYSTEM_KEYS | ❌ | ✅ |
| A2: Behind banner | ❌ | N/A (계산) | ❌ | ✅ |
| A3: Modal actions | ❌ | ✅ | ❌ | ✅ |
| B1: Severity badge | ❌ | N/A (UI only) | ❌ | ✅ |
| B2: Tooltip | ❌ | N/A | ❌ | ✅ |
| C1: Log popover | ❌ | N/A (local state) | ❌ | ✅ |
| C2: ESC stack | ❌ | N/A | ❌ | ✅ |
| D1: Progress Undo | ❌ | ❌ (memory only) | ❌ | ✅ |
| D2: Micro snackbar | ❌ | N/A | ❌ | ✅ |

**✅ PASS** — 모든 NOW 항목이 로컬-퍼스트 제약을 준수함.

### ⚠️ 주의사항

| 리스크 | 설명 | 완화 |
|--------|------|------|
| Snooze timezone | ISO string 저장 시 timezone 혼동 가능 | 계획에 "ISO string + Date.now() 비교" 명시됨 ✅ |
| Undo 영속화 | 앱 재시작 시 Undo 불가 → 명시적 AC 필요 | 문서에 언급 있음 ✅ |

---

## 3. ADHD 친화성 평가 (인지부하 / 즉각 피드백 / 중단 복귀)

### 3.1 인지부하 (Cognitive Load)

| 원칙 | 현재 | 제안 후 | 평가 |
|------|------|--------|------|
| 카드 정보량 | progress bar + 버튼 2개 | + 배지 + Today target + 툴팁 아이콘 | ⚠️ 밀도 증가 |
| 진입점 | 없음 | + Log popover + Undo snackbar | ⚠️ 시각 요소 증가 |
| 색상 의존 | 색상만으로 severity 표시 | + 텍스트 배지 | ✅ 개선 |

**Critical Gap**: 제안에서 "3개 정보까지만 기본 뷰"라고 했지만, 실제 구현 시 카드당 5-6개 요소가 될 수 있음.

**권장**: Task B1에 "카드 기본 상태: 배지 + Today target + 진행률만. +/- 버튼은 hover/focus 시에만 노출" 추가

### 3.2 즉각 피드백 (Immediate Feedback)

| 트리거 | 피드백 | 평가 |
|--------|--------|------|
| 진행도 변경 | Undo snackbar + "기록됨 ✓" | ✅ |
| 오늘 목표 달성 | 없음 (LATER로 이동됨) | ⚠️ |
| Log Session 완료 | snackbar | ✅ |

**Gap**: 오늘 목표 달성 시 "미세 축하"가 LATER로 밀려 NOW에 보상 루프가 약함.

**권장**: D2에 "오늘 목표 달성 시 snackbar에 '오늘 목표 달성! ✓' 텍스트 추가" (애니메이션 없이)

### 3.3 중단 복귀 (Interruption Recovery)

| 시나리오 | 처리 | 평가 |
|----------|------|------|
| 스누즈 만료 | 배너만 활성화, 자동 모달 금지 | ✅ |
| 앱 재시작 | behind 조건 시 모달 후보 | ✅ |
| 작업 중 알림 | 명시적 금지 | ✅ |

**✅ PASS** — 015 critique에서 지적한 "예측 불가능한 모달" 이슈가 해결됨.

---

## 4. 중복 / 범위 과대 / 모호한 요구 제거

### 4.1 중복 항목 식별

| 항목 | 중복 대상 | 평가 |
|------|----------|------|
| D2 (Micro snackbar) | D1 (Undo snackbar)와 동일 UI 사용 | ⚠️ 병합 가능 |
| B2 (Tooltip) | B1 (Today target line)과 함께 구현 | ⚠️ 분리 불필요 |

**권장**: 
- D1 + D2 → "Epic D: Undo + Feedback Snackbar"로 단일화
- B1 + B2 → "Task B: Card Clarity (배지 + Today + Tooltip)"로 병합

### 4.2 범위 과대 항목

| 항목 | 문제 | 권장 |
|------|------|------|
| #5 Today Focus Top 1-3 (NEXT) | "정렬 기준, pin 기능" 포함 → 복잡 | NEXT에서도 "Top 3 표시만"으로 축소, pin은 LATER |
| #6 Delete safety (NEXT) | "강한 시각적 위험 표시 + confirm copy 개선" → UX 리서치 필요 | LATER로 이동 권장 |
| #8-10 (LATER) | "디자인 탐색만"이라고 했으나 구체적 결과물 정의 없음 | 삭제하거나 "Figma mockup 1개" 같은 deliverable 명시 |

### 4.3 모호한 요구 사항

| 항목 | 모호함 | 명확화 필요 |
|------|--------|------------|
| A1: "behind 조건" | 어떤 계산 기준? | `getTodayTarget()` 기준 명시 필요 |
| C2: "ESC stack 참여" | 구현 방식 불명확 | `modalStackRegistry.push/pop` 명시됨 ✅ |
| D1: "8초 내 Undo" | 왜 8초? | 심리학 기반 근거 또는 "5-10초 내"로 범위화 |

---

## 5. 가장 높은 ROI 상위 5개 선정

### ROI 평가 기준

| 기준 | 가중치 | 설명 |
|------|--------|------|
| 사용자 체감 | 40% | ADHD 친화성 + 즉시 가치 |
| 구현 복잡도 (역) | 30% | 낮을수록 좋음 |
| 기존 코드 활용도 | 20% | 재사용 가능성 |
| 회귀 위험 (역) | 10% | 낮을수록 좋음 |

### ROI 스코어카드

| 순위 | 항목 | 체감 | 복잡도⁻¹ | 재사용 | 회귀⁻¹ | 총점 | 이유 |
|------|------|------|----------|--------|--------|------|------|
| **1** | B1: Severity 배지 + Today target | 9 | 9 | 8 | 9 | **8.8** | 단순 UI 추가, 기존 계산 함수 활용, 색상 접근성 해결 |
| **2** | D1+D2: Undo + Snackbar 통합 | 8 | 7 | 9 | 8 | **7.9** | 실수 불안 해소, store-level 변경만, 기존 toast 패턴 |
| **3** | A2: Behind 배너 | 8 | 8 | 7 | 8 | **7.8** | 인라인 진입점, 자동 모달 대체, 사용자 제어감 |
| **4** | C1: Log Session popover | 9 | 6 | 6 | 7 | **7.4** | 기록 마찰 제거, 새 컴포넌트 필요하나 단순 |
| **5** | A3: Modal 3개 액션 | 7 | 7 | 8 | 7 | **7.2** | 기존 모달 확장, 스누즈 로직 추가 |

### 🏆 상위 5개 권장 우선순위

1. **B1: WeeklyGoalCard Clarity (배지 + Today target)**
   - **왜?**: 가장 낮은 위험, 즉각적 ADHD 체감 개선, 색상 접근성 해결
   - 기존 `getDailyTargetForToday()` 그대로 사용

2. **D1+D2: Progress Undo + "기록됨" Snackbar (병합)**
   - **왜?**: 실수 불안 해소 = ADHD 핵심 니즈, store-level 변경만으로 가능
   - 기존 `toastStore` 패턴 재사용

3. **A2: Behind Goals 배너 (인라인 진입점)**
   - **왜?**: 자동 모달을 배너로 대체하여 "예측 가능한 중단" 실현
   - 사용자가 원할 때만 모달 열기

4. **C1: Quick Log Session Popover**
   - **왜?**: 기록 마찰 제거 = 습관 형성의 핵심
   - 새 컴포넌트지만 구조 단순 (숫자 입력 + 버튼)

5. **A3: Catch-up Modal 3개 액션 (View/Snooze/Dismiss)**
   - **왜?**: 기존 모달 확장, 스누즈 UX 완성
   - A1 (snooze state)은 A3의 의존성이므로 함께 구현

### ⛔ 하위 ROI (NOW에서 제외 또는 축소 권장)

| 항목 | 이유 | 권장 |
|------|------|------|
| A1: Snooze state 단독 | A3 없이는 의미 없음 | A3에 통합 |
| C2: ESC stack 참여 | C1 없이는 의미 없음, 복잡도 높음 | C1 완료 후 별도 PR |
| B2: Tooltip 단독 | B1과 함께 구현해야 함 | B1에 병합 |

---

## 6. Unresolved Open Questions

제안서의 Open Questions가 "Resolved with Assumptions"로 되어 있으나, 일부는 여전히 검증 필요:

| # | Question | 가정 | 검증 필요 |
|---|----------|------|----------|
| 1 | Target Release | 1.0.166 | ⚠️ 다른 진행 중 PR과 충돌 확인 필요 |
| 2 | Delete Undo | NOW 제외 | ✅ 적절 |
| 3 | Top 1-3 기준 | behind severity | ⚠️ 사용자 피드백 후 조정 가능성 |
| 4 | Snooze 기본값 | 2시간 | ✅ 적절, 단 설정 UI는 LATER |

---

## 7. Findings Summary

### Critical (구현 전 해결 필수)

| ID | Title | Status | Impact | Recommendation |
|----|-------|--------|--------|----------------|
| C-1 | 카드 정보 밀도 증가 | OPEN | ADHD 역효과 | B1에 "hover 시 +/- 노출" 가드레일 추가 |
| C-2 | NOW 범위가 11 Task로 과대 | OPEN | 일정 지연 | 상위 ROI 5개로 축소, 나머지 NEXT로 |

### Medium (구현 중 주의)

| ID | Title | Status | Impact | Recommendation |
|----|-------|--------|--------|----------------|
| M-1 | NOW에 보상 피드백 부재 | OPEN | 습관 루프 불완전 | D2에 "오늘 목표 달성 시 텍스트" 추가 |
| M-2 | LATER 항목 deliverable 불명확 | OPEN | 기대 관리 | 삭제하거나 "Figma 1개" 명시 |
| M-3 | Task 중복 (D1+D2, B1+B2) | OPEN | 불필요한 분리 | 병합 권장 |

### Low (품질 향상)

| ID | Title | Status | Impact | Recommendation |
|----|-------|--------|--------|----------------|
| L-1 | "8초 Undo" 근거 부재 | OPEN | 사소함 | "5-10초"로 범위화 또는 근거 추가 |
| L-2 | behind 조건 계산 기준 미명시 | OPEN | 구현 혼란 | `getTodayTarget()` 기준 명시 |

---

## 8. 개선 제안 요약

### 즉시 조치 (Before Implementation)

1. **NOW 범위 축소**: 11 Task → 7 Task (상위 ROI 5개 + 의존성 2개)
   ```
   NOW (최종):
   - B1: Card Clarity (배지 + Today + Tooltip 병합)
   - D1+D2: Undo + Snackbar (병합)
   - A2: Behind 배너
   - A3: Modal 3개 액션 (A1 snooze state 포함)
   - C1: Log Session popover
   
   NEXT로 이동:
   - C2: ESC stack 참여 (C1 완료 후)
   ```

2. **ADHD 가드레일 추가**: B1에 "+/- 버튼은 hover/focus 시에만 노출"

3. **보상 피드백**: D2에 "오늘 목표 달성 시 '오늘 목표 달성! ✓' 텍스트" 추가

4. **LATER 정리**: #8-10은 "Figma mockup 1개"로 deliverable 명시하거나, "탐색 backlog"로 문서 외부로 이동

### 구현 시 주의

1. **ESC stack**: C1 완료 후 별도 PR로 C2 진행 (복잡도 분리)
2. **Snooze timezone**: ISO string + `Date.now()` 비교만 사용
3. **Weekly reset 경계**: Log Session 저장 시 weekStartDate 검증 로직 추가

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 정보 과잉으로 ADHD 역효과 | Medium | High | progressive disclosure 강화 |
| 11 Task 일정 초과 | High | Medium | 상위 ROI 5개로 축소 |
| ESC stack 불일치 | Medium | Medium | C2를 별도 PR로 분리 |
| LATER 항목 기대 관리 실패 | Low | Low | deliverable 명시 또는 삭제 |

---

## Verdict

**CONDITIONAL APPROVAL** — 다음 조건 충족 시 구현 진행 가능:

1. ✅ NOW 범위를 상위 ROI 5개 + 의존성으로 축소
2. ✅ B1에 progressive disclosure 가드레일 추가
3. ✅ D2에 "오늘 목표 달성" 피드백 추가
4. ⚠️ LATER 항목 정리 (삭제 또는 deliverable 명시)

---

오빠, 전체적으로 015 critique 피드백이 잘 반영됐어요! 특히 "스누즈 만료 시 자동 모달 금지"는 ADHD 관점에서 정말 중요한 개선이에요. 다만 NOW 범위가 여전히 넓어서, 상위 ROI 5개에 집중하면 더 빠르고 안전하게 가치를 전달할 수 있을 거예요. 💪

궁금한 점 있으면 언제든 물어봐! 은하가 도와줄게요~ 😊
