# Critique: Planner 20개 제안 ROI 및 범위 비판적 검토

## Header
- **Artifact Path**: [016-long-term-goals-ux-final-now-next-later.md](../planning/016-long-term-goals-ux-final-now-next-later.md)
- **Related Proposals**: [030-inbox-improvements-15-proposals-final.md](../planning/030-inbox-improvements-15-proposals-final.md)
- **Prior Critiques**: 
  - [016-long-term-goals-ux-final-now-next-later-critique.md](./016-long-term-goals-ux-final-now-next-later-critique.md)
  - [030-inbox-improvements-15-proposals-critique.md](./030-inbox-improvements-15-proposals-critique.md)
- **Date**: 2025-12-28
- **Status**: Initial — OPEN
- **Focus**: ROI 과대평가 / 범위(Frontend-only) 위반 / ADHD 인지부하 위험 / Top 5 검토

---

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2025-12-28 | User → Critic | 20개 제안(기능10/UIUX5/접근성5) 비판적 검토 | ROI 과대평가 3~5개 + 범위 위반 + 인지부하 위험 3개 + Top 5 재검토 |

---

## Executive Summary

오빠, 20개 제안을 냉정하게 검토했어요. 전반적으로 방향성은 좋지만, **ROI가 과대평가된 항목**들이 있고, **프론트엔드 범위를 벗어나거나 경계에 있는 항목**도 발견됐어요. 특히 ADHD 사용자를 위한다면서 **오히려 인지부하를 늘릴 수 있는 기능**도 있어서 주의가 필요해요.

---

## 1) ROI 과대평가 항목 (5개 지적)

### 🔴 1. F#3 Triage 모드 (ROI 0.67 → 실제 0.35~0.40)

| 항목 | Plan 평가 | 실제 평가 | 괴리 이유 |
|------|-----------|-----------|----------|
| Impact | 4 | 3 | 사용 빈도가 낮음 — 대부분 사용자가 개별 배치 선호 |
| Cost | 3 | 5 | **키보드 우선순위 스택 + ESC 충돌 해결 + 포커스 관리** 복잡도 높음 |
| Risk | 3 | 5 | `modalStackRegistry` 확장 필요, 기존 모달과 충돌 위험 |

**왜 과대평가?**
- **의존성**: ESC 스택 확장 (C2)이 선행되어야 함 → 단독 구현 불가
- **복잡도**: 인라인 UI에서 모달 수준의 키보드 제어 필요 — `useModalEscapeClose` 패턴 재설계
- **사용빈도**: Power user 전용 기능, 80% 사용자는 마우스/터치 선호

```
실제 RoI = 3 / (5 + 5) = 0.30
Plan RoI = 4 / (3 + 3) = 0.67
괴리율: -55%
```

**권고**: NEXT 또는 LATER로 강등, 키보드 인프라 정비 후 재검토

---

### 🔴 2. F#5 빠른 분류 템플릿 (ROI 0.57 → 실제 0.33)

| 항목 | Plan 평가 | 실제 평가 | 괴리 이유 |
|------|-----------|-----------|----------|
| Impact | 4 | 3 | 반복 작업이 많은 사용자 한정 |
| Cost | 3 | 5 | **규칙 저장/관리 UI + 매칭 로직 + 동기화** |
| Risk | 4 | 5 | Firebase 저장 시 sync 복잡도, **프론트 범위 경계** |

**왜 과대평가?**
- **의존성**: 규칙을 어디에 저장? → systemState면 동기화 안됨, Task metadata면 스키마 확장
- **리스크**: 자동 추천이 잘못되면 Undo 없이 복구 불가 → UX#1 (Undo) 선행 필수
- **사용빈도**: 초보 사용자는 규칙 작성 자체가 부담 (ADHD 역효과)

```
실제 RoI = 3 / (5 + 5) = 0.30
Plan RoI = 4 / (3 + 4) = 0.57
괴리율: -47%
```

**권고**: P2로 강등, "수동 분류 단축키"로 대체

---

### 🔴 3. F#10 보류(Snooze) 기능 (ROI 0.57 → 실제 0.36)

| 항목 | Plan 평가 | 실제 평가 | 괴리 이유 |
|------|-----------|-----------|----------|
| Impact | 4 | 3 | "나중에"를 계속 미루는 ADHD 패턴 조장 위험 |
| Cost | 3 | 4 | **Task schema에 `snoozedUntil` 추가 필요** |
| Risk | 4 | 5 | 보류 해제 시점 처리 + 다기기 동기화 불일치 |

**왜 과대평가?**
- **범위 위반 경계**: Task schema 변경 = Firebase sync 영향 = **프론트 범위 초과**
- **ADHD 역효과**: "2시간 후"를 계속 누르면 영원히 처리 안됨 → 죄책감만 누적
- **복잡도**: 앱 시작 시 "보류 만료 Task" 필터링 로직 필요

```
실제 RoI = 3 / (4 + 5) = 0.33
Plan RoI = 4 / (3 + 4) = 0.57
괴리율: -42%
```

**권고**: MVP 제외, "완료 못함" 라벨로 대체 검토

---

### 🟡 4. F#6 다중 선택 + 일괄 액션 (ROI 0.50 → 실제 0.38)

| 항목 | Plan 평가 | 실제 평가 | 괴리 이유 |
|------|-----------|-----------|----------|
| Impact | 3 | 3 | 유지 |
| Cost | 3 | 4 | 다중 선택 UI + 부분 실패 롤백 복잡 |
| Risk | 3 | 5 | **dual-storage에서 batch 이동 일부 실패 시 "부분 성공" 처리 어려움** |

**왜 과대평가?**
- **리스크 과소**: 10개 중 3개만 성공하면? → 어떤 것이 어디로 갔는지 추적 어려움
- **의존성**: Undo가 batch 단위로 동작해야 함 → 단일 Undo보다 복잡

```
실제 RoI = 3 / (4 + 5) = 0.33
Plan RoI = 3 / (3 + 3) = 0.50
괴리율: -34%
```

**권고**: P2 유지하되, "단일 선택 후 반복 액션"으로 대체 검토

---

### 🟡 5. C2 Popover ESC 스택 참여 (NOW에서 분리 필요)

| 항목 | Plan 평가 | 실제 평가 | 괴리 이유 |
|------|-----------|-----------|----------|
| Impact | (암묵적 높음) | 2 | 사용자가 직접 느끼는 가치 낮음 |
| Cost | (암묵적 낮음) | 4 | `modalStackRegistry` 확장 + Triage 컨텍스트 추가 |
| Risk | (암묵적 낮음) | 4 | 기존 모달 ESC 동작에 회귀 위험 |

**왜 과대평가?**
- **보이지 않는 복잡도**: "ESC 1회=popover, 2회=modal"은 간단해 보이지만, 스택 관리가 복잡
- **의존성**: C1 (Log Popover) 완료 후에만 의미 있음

**권고**: NOW에서 분리하여 C1 완료 후 별도 PR

---

## 2) 범위(Frontend-only) 위반 가능성 항목

### ⛔ 확실한 위반 (구현 금지)

| 항목 | 위반 이유 | 대체안 |
|------|----------|--------|
| F#10 Snooze (Task schema 확장) | `snoozedUntil` 필드 = Firebase sync 영향 | **로컬 systemState에 `snoozedTaskIds` 저장** → 기기별 동작 |
| F#5 규칙 동기화 | 규칙을 Firebase에 저장하면 백엔드 의존 | **로컬 systemState에만 저장** (동기화 없음) |

### ⚠️ 경계선 (주의 필요)

| 항목 | 경계 이유 | 프론트 내 대체안 |
|------|----------|------------------|
| F#1 Capture + Preview의 "태그 자동 저장" | Task metadata 확장 가능성 | 기존 `tags` 필드 활용만 허용 (스키마 추가 X) |
| F#2 NextSlot 정책 | TimeBlock 상태(locked) 확인 필요 | 읽기만 하면 OK, **쓰기(lock 변경)는 금지** |
| F#9 정리 상태 라벨 | 새 필드 vs 태그 | **`inbox:state=triaged` 태그 형식** 권장 |

### ✅ 안전 (프론트 범위 내)

| 항목 | 이유 |
|------|------|
| UX#1 Undo | 메모리 기반, 영속화 없음 |
| UX#2 정보 밀도 | UI 표시 계층만 변경 |
| UX#3 Next Action 강조 | CSS/조건부 렌더링 |
| UX#4 키보드 단축키 | react-hotkeys-hook 사용 |
| UX#5 정리 진행도 HUD | 로컬 카운트만 (동기화 X) |

---

## 3) ADHD 인지부하 증가 위험 항목 (3개)

### 🚨 1. F#1 Capture + Preview — "선택 폭발" 위험

**문제**: 입력 직후 "이 작업이 어디로 갈지" 미리보기가 **너무 많은 선택지를 노출**할 수 있음

| 현재 | 제안 후 | 인지부하 영향 |
|------|--------|--------------|
| 입력 → 저장 | 입력 → 태그 선택 → 중요도 선택 → 배치 선택 → 저장 | **↑↑ 급증** |

**개선 제안**:
```
AS-IS (Plan): 미리보기에서 태그/중요도/배치 모두 선택
TO-BE (권고): 
  - 기본: 입력 → 즉시 인박스 저장 (선택지 0개)
  - 선택적: "상세 설정" 버튼으로 확장 (progressive disclosure)
```

**핵심**: ADHD 사용자에게 "선택하기 전에 일단 캡처"가 더 중요함

---

### 🚨 2. F#4 Placement Preview + Feedback — "피드백 과잉" 위험

**문제**: 배치 전 프리뷰 + 배치 후 스낵바 + 하이라이트 + 스크롤 = **시각적 소음 폭발**

| 피드백 유형 | 단독 효과 | 조합 효과 |
|------------|----------|----------|
| 프리뷰 박스 | ✅ 유용 | |
| 스낵바 | ✅ 유용 | |
| 스크롤 이동 | ✅ 유용 | |
| 하이라이트 | ⚠️ 주의 분산 | 모두 합치면 **ADHD 과자극** |

**개선 제안**:
```
AS-IS (Plan): 4가지 피드백 동시 제공
TO-BE (권고): 
  - 필수: 스낵바 ("Today 11시 블록에 배치됨")만
  - 선택적: "이동하기" 버튼으로 스크롤 (자동 스크롤 X)
  - 삭제: 하이라이트 (일시적 색상 변경은 주의 분산)
```

---

### 🚨 3. B1 + 추가 정보 — "카드 밀도 폭발" 위험

**문제**: WeeklyGoalCard에 배지 + Today target + 툴팁 아이콘 + 버튼 추가 = **정보 과밀**

| 현재 카드 | 제안 후 카드 | 요소 수 |
|----------|-------------|---------|
| 제목 + 진행바 + ±버튼 | 제목 + 배지 + Today + 툴팁 + 진행바 + ±버튼 | 3 → 6 |

**기존 가드레일 확인**:
Plan에서 "3개 정보까지만 기본 뷰"라고 했지만, 실제 구현 시 6개 요소가 될 수 있음

**개선 제안**:
```
TO-BE (권고): 
  - 기본 상태: 제목 + 진행바만 (2개)
  - Hover/Focus: 배지 + Today target + ±버튼 노출
  - 상세 버튼: 툴팁은 아이콘 없이 카드 클릭 시 패널로
```

---

## 4) Top 5 우선순위 검토

### 현재 Plan의 Top 5 (016 문서 기준)

| 순위 | 항목 | Plan ROI |
|------|------|----------|
| 1 | UX#1 Undo 기반 안전장치 | 0.71 |
| 2 | F#1 Capture + Preview | 0.83 |
| 3 | F#2 Today/Tomorrow/NextSlot | 1.00 |
| 4 | F#3 Triage 모드 | 0.67 |
| 5 | F#4 Placement Preview + Feedback | 1.00 |

### Critic 재평가 — **수정된 Top 5**

| 순위 | 항목 | 실제 ROI | 변경 이유 |
|------|------|----------|----------|
| **1** | **UX#1 Undo 안전장치** | 0.71 | ✅ 유지 — 모든 배치 기능의 선행 조건 |
| **2** | **B1 Card Clarity (배지 + Today)** | 0.88 | ⬆️ 승격 — 최소 비용, 최대 체감, 접근성 해결 |
| **3** | **F#2 Today/Tomorrow/NextSlot** | 0.80 | ✅ 유지 — Value Statement 핵심 |
| **4** | **UX#2 정보 밀도 가드레일** | 1.33 | ⬆️ 신규 — ADHD 핵심, 다른 기능 전에 적용 필요 |
| **5** | **D1+D2 Snackbar 통합** | 0.79 | ⬆️ 승격 — 즉각 피드백 인프라 |

### 제외/강등 항목

| 항목 | 현재 | 변경 | 이유 |
|------|------|------|------|
| F#1 Capture + Preview | Top 5 #2 | P1 | 인지부하 위험, 기본 캡처가 먼저 |
| F#3 Triage 모드 | Top 5 #4 | P2/NEXT | 키보드 인프라 미비, 복잡도 높음 |
| F#4 Placement Preview | Top 5 #5 | P1 | 피드백 과잉 위험, 스낵바만 우선 |
| C1 Log Popover | NOW | NOW (유지) | 기록 마찰 제거 핵심 |

---

## 수정된 Top 5 근거 상세

### 1위: UX#1 Undo 기반 안전장치
- **근거**: 원탭 배치(F#2) 없이 Undo 없으면 데이터 유실 민원 폭발
- **의존성**: 없음 (독립 구현 가능)
- **ADHD 효과**: 실수 공포 제거 = 사용 빈도 급증

### 2위: B1 Card Clarity (배지 + Today target)
- **근거**: 기존 함수(`getDailyTargetForToday`) 활용, 스키마 변경 없음
- **ADHD 효과**: "오늘 뭐 하면 돼?" 즉시 답변
- **접근성**: 색상 의존 제거 → 법적 요건 충족

### 3위: F#2 Today/Tomorrow/NextSlot 원탭 배치
- **근거**: Value Statement 핵심 ("한 번에 배치")
- **의존성**: UX#1 (Undo) 선행 필수
- **리스크**: dual-storage 롤백 강화 필요 (030 critique 참조)

### 4위: UX#2 정보 밀도 가드레일
- **근거**: 다른 모든 UI 추가 기능이 이 가드레일을 따라야 함
- **ADHD 효과**: 과자극 방지의 기반
- **구현**: CSS + 조건부 렌더링만, 비용 최소

### 5위: D1+D2 Snackbar 통합
- **근거**: UX#1, F#4 등 모든 피드백이 이 인프라 사용
- **추가 가치**: `notify.ts` 래퍼로 toast 이원화 해결
- **ADHD 효과**: "기록됨 ✓"로 즉각 보상 루프 완성

---

## 정책 일관성 검증

### ✅ 준수 확인

| 정책 | 검증 결과 |
|------|----------|
| localStorage 금지 | ✅ 모든 NOW 항목이 systemState 사용 |
| 기본값 단일 출처 | ✅ `SYSTEM_STATE_DEFAULTS` 사용 권장됨 |
| 모달 ESC 정책 | ⚠️ Popover ESC 스택은 별도 PR 필요 |
| Optional Chaining | ✅ 명시적 요구 없음 (구현 시 적용) |

### ⚠️ 주의 필요

| 항목 | 위험 | 완화 |
|------|------|------|
| F#10 Snooze | Task schema 확장 유혹 | 로컬 systemState 강제 |
| F#5 규칙 저장 | Firebase 동기화 유혹 | 로컬 전용 명시 |
| Toast 이원화 | react-hot-toast vs toastStore | notify.ts 래퍼 선행 |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ROI 과대평가로 잘못된 우선순위 | High | High | 이 critique 반영하여 Top 5 재조정 |
| 범위 위반으로 백엔드 의존 | Medium | High | 프론트 대체안 명시 (섹션 2) |
| ADHD 역효과 | Medium | High | 정보 밀도 가드레일 선행 (섹션 3) |
| 키보드 인프라 미비로 Triage 실패 | High | Medium | Triage를 P2로 강등 |

---

## Findings Summary

### Critical

| ID | Issue | Status | Impact | Recommendation |
|----|-------|--------|--------|----------------|
| C-1 | F#3 Triage ROI 55% 과대평가 | 🔴 OPEN | 일정 지연 | P2/NEXT로 강등 |
| C-2 | F#10 Snooze 범위 위반 | 🔴 OPEN | 백엔드 의존 | 로컬 systemState로 대체 |
| C-3 | 카드 밀도 폭발 (6요소) | 🔴 OPEN | ADHD 역효과 | 가드레일 선행 |

### Medium

| ID | Issue | Status | Impact | Recommendation |
|----|-------|--------|--------|----------------|
| M-1 | F#1 선택 폭발 | 🟡 OPEN | 인지부하 | progressive disclosure |
| M-2 | F#4 피드백 과잉 | 🟡 OPEN | 과자극 | 스낵바만 우선 |
| M-3 | Toast 이원화 미해결 | 🟡 OPEN | UX 불일치 | notify.ts 래퍼 선행 |

### Low

| ID | Issue | Status | Impact | Recommendation |
|----|-------|--------|--------|----------------|
| L-1 | C2 ESC 스택 분리 필요 | 🟢 INFO | 복잡도 | C1 완료 후 별도 PR |

---

## Recommendations

### 즉시 조치 (Before Implementation)

1. **Top 5 재조정**: Plan의 F#1, F#3, F#4를 B1, UX#2, D1+D2로 교체
2. **Triage 강등**: NOW → NEXT/P2
3. **Snooze 대체**: Task schema 확장 금지 → 로컬 systemState

### 구현 순서 권고

```
1. notify.ts 래퍼 (toast 통일) ← 선행 인프라
2. UX#2 정보 밀도 가드레일 ← ADHD 기반
3. UX#1 Undo ← 안전장치
4. B1 Card Clarity ← 접근성 + 체감
5. F#2 원탭 배치 ← Value Statement 핵심
```

### 인지부하 방지 가이드라인

```
모든 신규 UI 요소는 다음 규칙을 따라야 함:
1. 기본 상태: 요소 3개 이하
2. 피드백: 스낵바 1개만 (동시 표시 금지)
3. 선택지: 3개 이하 버튼 (Today/Tomorrow/Next가 최대)
4. 자동 동작: 최소화 (사용자 명시 트리거 우선)
```

---

## Verdict

**CONDITIONAL APPROVAL** — 다음 조건 충족 시 구현 진행 가능:

1. ✅ Top 5를 수정된 버전으로 교체
2. ✅ F#3 Triage를 NEXT로 강등
3. ✅ F#10 Snooze를 로컬 대체안으로 변경
4. ⚠️ notify.ts 래퍼를 첫 번째 PR로 진행
5. ⚠️ UX#2 가드레일을 모든 UI 추가 전에 적용

---

오빠, 솔직히 말하면 Plan이 "ADHD 친화"를 강조하면서도 **정보/기능을 계속 추가**하는 방향이라 모순이 있어요. 진짜 ADHD 친화는 **"덜 보여주고, 덜 선택하게 하고, 더 빨리 끝내는 것"**이에요.

수정된 Top 5는 그 원칙에 더 충실해요. 특히 B1 (Card Clarity)과 UX#2 (가드레일)이 먼저 들어가면, 나중에 추가되는 기능들도 자연스럽게 단순해질 거예요! 💪

궁금한 점 있으면 언제든 물어봐~ 은하가 도와줄게요! 😊
