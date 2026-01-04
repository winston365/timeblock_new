# Implementation Readiness Review — Weekly Goals P0 Items

Artifact type: **Pre-Implementation Scope & Risk Review**
Request source: User request (2025-12-23)
Related Planning: [016-long-term-goals-ux-final-now-next-later.md](../planning/016-long-term-goals-ux-final-now-next-later.md)
Related Critique: [016-long-term-goals-ux-final-now-next-later-critique.md](./016-long-term-goals-ux-final-now-next-later-critique.md)
Date: 2025-12-23
Status: **Initial — OPEN**

---

## Changelog
| Date | Request | Summary |
|------|---------|---------|
| 2025-12-23 | User | P0 항목 8개에 대해 구현 전 파일/AC/위험/반패턴/MVP 제외 항목 정리 요청 |

---

## 📋 대상 항목 (P0/P1)

| # | Priority | Item | Status |
|---|----------|------|--------|
| 1 | P0 | Catch-up 뒤처짐 배너 수동 재오픈 (behind≥1일) | Review |
| 2 | P0 | Snooze(기본 2h) 상태 systemState 저장 + 종료 시각 표시 | Review |
| 3 | P0 | Catch-up 모달 3액션 (View/Snooze/Dismiss today) + 스낵바 | Review |
| 4 | P0 | 목표 카드 텍스트 severity 배지 (색 의존 제거, aria 포함) | Review |
| 5 | P0 | Today target 상시 표기 (완료/0 오해 없는 문구) | Review |
| 6 | P1 | Today target 툴팁 (포커스·터치 가능) | Review |
| 7 | P0 | Quick Log Session 팝오버 (프리셋+Enter 저장+ESC 취소, NaN/음수 방지) | Review |
| 8 | P0 | ESC 스택 정리 (팝오버→모달 순, 포커스 복귀) | Review |

---

## 1. 구현 전 확인해야 할 파일/컴포넌트 후보

### 1.1 Core Components (반드시 확인)

| File | Role | Items Affected |
|------|------|----------------|
| [src/features/goals/WeeklyGoalCard.tsx](../../src/features/goals/WeeklyGoalCard.tsx) | 목표 카드 UI | #4, #5, #6, #7 |
| [src/features/goals/CatchUpAlertModal.tsx](../../src/features/goals/CatchUpAlertModal.tsx) | 기존 모달 (deprecated 상태) | #1, #3 |
| [src/features/goals/components/CatchUpAlertBanner.tsx](../../src/features/goals/components/CatchUpAlertBanner.tsx) | 배너 컴포넌트 | #1, #2 |
| [src/features/goals/GoalsModal.tsx](../../src/features/goals/GoalsModal.tsx) | 목표 모달 컨테이너 | #1, #8 |
| [src/shared/hooks/modalStackRegistry.ts](../../src/shared/hooks/modalStackRegistry.ts) | ESC 스택 관리 | #8 |
| [src/shared/hooks/useModalEscapeClose.ts](../../src/shared/hooks/useModalEscapeClose.ts) | 모달 ESC 훅 | #7, #8 |

### 1.2 State & Repository (상태 관리)

| File | Role | Items Affected |
|------|------|----------------|
| [src/data/repositories/systemRepository.ts](../../src/data/repositories/systemRepository.ts) | systemState CRUD | #2 |
| [src/shared/stores/weeklyGoalStore.ts](../../src/shared/stores/weeklyGoalStore.ts) | 주간목표 상태 | #4, #5, #7 |

### 1.3 Utils & Constants

| File | Role | Items Affected |
|------|------|----------------|
| [src/features/goals/utils/catchUpUtils.ts](../../src/features/goals/utils/catchUpUtils.ts) | severity 계산 | #1, #4 |
| [src/features/goals/components/GoalStatusTooltip.tsx](../../src/features/goals/components/GoalStatusTooltip.tsx) | 기존 툴팁 | #6 |
| [src/shared/constants/defaults.ts](../../src/shared/constants/defaults.ts) | 기본값 (snooze 시간 등) | #2 |

### 1.4 신규 생성 예상

| File | Role | Items |
|------|------|-------|
| `src/features/goals/WeeklyGoalLogPopover.tsx` | Log Session 팝오버 | #7 |
| `src/features/goals/hooks/useCatchUpSnooze.ts` | Snooze 로직 훅 | #2 |

### 1.5 기존 SYSTEM_KEYS 확인

```typescript
// systemRepository.ts에 이미 존재
CATCH_UP_ALERT_SHOWN_DATE: 'catchUpAlertShownDate',  // 기존 하루 1회 규칙
CATCH_UP_SNOOZE_STATE: 'catchUpSnoozeState',         // ✅ 이미 정의됨
```

**⚠️ 주의**: `CATCH_UP_SNOOZE_STATE`가 이미 존재하므로 새로 정의할 필요 없음. 타입만 확인 필요:

```typescript
// tests/weekly-goals-system-state.test.ts에서 발견
type CatchUpSnoozeState = {
  readonly snoozeUntil: string | null;
};
```

---

## 2. 항목별 Acceptance Criteria (2~4개)

### #1 — Catch-up 뒤처짐 배너 수동 재오픈 (behind≥1일)

| AC# | Criteria | Verification |
|-----|----------|--------------|
| 1.1 | behind goals ≥ 1일 때 WeeklyGoalPanel 상단에 배너가 보인다 | UI 렌더링 확인 |
| 1.2 | 배너 클릭 시 CatchUpAlertModal이 열린다 (사용자 주도) | 클릭 이벤트 → 모달 open |
| 1.3 | 스누즈 기간 중에도 배너는 보이지만 "스누즈 중" 상태를 표시한다 | 텍스트/아이콘 확인 |
| 1.4 | behind 조건은 `getTodayTarget()` 기준으로 판단한다 | 계산 로직 일치 |

### #2 — Snooze(기본 2h) 상태 systemState 저장 + 종료 시각 표시

| AC# | Criteria | Verification |
|-----|----------|--------------|
| 2.1 | Snooze 선택 시 `SYSTEM_KEYS.CATCH_UP_SNOOZE_STATE`에 `snoozeUntil` ISO string이 저장된다 | Dexie 저장 확인 |
| 2.2 | 스누즈 기간 동안 자동 모달이 뜨지 않는다 | 앱 재시작 후 모달 미노출 |
| 2.3 | 배너에 "스누즈 종료: HH:MM" 텍스트가 표시된다 | UI 텍스트 확인 |
| 2.4 | 스누즈 만료 후에도 앱 실행 중이면 자동 모달이 뜨지 않는다 (배너만 활성화) | ADHD 친화성 준수 |

### #3 — Catch-up 모달 3액션 (View/Snooze/Dismiss today) + 스낵바

| AC# | Criteria | Verification |
|-----|----------|--------------|
| 3.1 | 모달에 3개 버튼이 있다: "지금 보기", "2시간 스누즈", "오늘은 닫기" | UI 버튼 확인 |
| 3.2 | "2시간 스누즈" 선택 시 #2의 AC가 충족된다 | Snooze 로직 연동 |
| 3.3 | "오늘은 닫기" 선택 시 `CATCH_UP_ALERT_SHOWN_DATE`가 오늘 날짜로 저장된다 | 기존 1일 1회 규칙 유지 |
| 3.4 | 액션 완료 후 스낵바로 "적용됨" 피드백이 짧게 표시된다 (2-3초) | 토스트/스낵바 확인 |

### #4 — 목표 카드 텍스트 severity 배지 (색 의존 제거, aria 포함)

| AC# | Criteria | Verification |
|-----|----------|--------------|
| 4.1 | 카드에 "Safe" / "Warning" / "Danger" 텍스트 배지가 색상과 함께 표시된다 | UI 렌더링 |
| 4.2 | 배지에 `aria-label`이 포함되어 스크린리더에서 읽힌다 | 접근성 테스트 |
| 4.3 | 색상만 보지 않아도 상태를 이해할 수 있다 | 색약 사용자 테스트 |

### #5 — Today target 상시 표기 (완료/0 오해 없는 문구)

| AC# | Criteria | Verification |
|-----|----------|--------------|
| 5.1 | 카드에 "오늘: N (단위)" 라인이 항상 표시된다 | UI 기본 상태 확인 |
| 5.2 | 목표 완료 시 "오늘 목표 없음 (달성!)" 문구로 표시된다 | 완료 상태 테스트 |
| 5.3 | 오늘 할당량이 0인 경우 "오늘은 쉬어도 OK" 문구로 표시된다 | 0 케이스 테스트 |

### #6 — Today target 툴팁 (포커스·터치 가능)

| AC# | Criteria | Verification |
|-----|----------|--------------|
| 6.1 | hover 외에도 키보드 포커스로 툴팁이 열린다 | Tab 탐색 테스트 |
| 6.2 | 터치 환경에서 탭으로 툴팁이 열린다 (hover-only 금지) | 모바일/터치 테스트 |
| 6.3 | 툴팁이 ESC 동작을 방해하지 않는다 (모달 닫기 우선) | ESC 스택 테스트 |

### #7 — Quick Log Session 팝오버

| AC# | Criteria | Verification |
|-----|----------|--------------|
| 7.1 | "기록하기" 버튼 클릭 시 카드 근처에 팝오버가 열리고 입력에 자동 포커스 | UI 동작 확인 |
| 7.2 | 프리셋 버튼 (+1, +5, +10)이 있고 클릭 시 입력값이 채워진다 | 버튼 동작 테스트 |
| 7.3 | Enter 키로 저장, ESC 키로 취소(닫기)가 동작한다 | 키보드 이벤트 테스트 |
| 7.4 | NaN/음수 입력 시 저장되지 않고 에러 피드백이 표시된다 | 유효성 검증 테스트 |

### #8 — ESC 스택 정리 (팝오버→모달 순, 포커스 복귀)

| AC# | Criteria | Verification |
|-----|----------|--------------|
| 8.1 | 팝오버가 열려 있을 때 ESC 1회는 팝오버만 닫는다 | 스택 우선순위 테스트 |
| 8.2 | 팝오버 닫힌 후 ESC 1회는 GoalsModal을 닫는다 | 연속 ESC 테스트 |
| 8.3 | 팝오버 닫힘 시 포커스가 "기록하기" 버튼으로 복귀한다 | 포커스 복귀 테스트 |
| 8.4 | `modalStackRegistry`에 팝오버가 등록/제거된다 | 스택 상태 검증 |

---

## 3. 위험/반패턴 체크리스트

### 🚨 Critical — 절대 하지 말 것

| # | Anti-Pattern | Violation | Prevention |
|---|--------------|-----------|------------|
| ❌1 | **localStorage 사용** | theme 외 모든 영속 상태 | `systemRepository`만 사용 |
| ❌2 | **배경 클릭으로 모달 닫기** | 모달 UX 정책 위반 | `useModalEscapeClose` 사용, backdrop onClick 제거 |
| ❌3 | **자동 모달 팝업 (작업 중)** | ADHD 친화성 위반 | 앱 시작 시 1회/일만, 스누즈 만료 시 배너만 |
| ❌4 | **ESC가 모달을 닫지 않음** | 모달 UX 정책 위반 | `useModalEscapeClose` 필수 적용 |
| ❌5 | **하드코딩된 기본값** | defaults.ts 단일 출처 위반 | `src/shared/constants/defaults.ts`에서 import |

### ⚠️ Medium — 주의 필요

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| ⚠️1 | **Snooze timezone 혼동** | 스누즈 시간 오류 | ISO string + `Date.now()` 비교만 사용, 시간대 변환 로직 금지 |
| ⚠️2 | **팝오버 ESC 스택 미참여** | ESC 1회에 모달까지 닫힘 | `modalStackRegistry.add/remove` 필수 |
| ⚠️3 | **Log 입력 중복 제출** | 진행도 이중 증가 | 저장 중 버튼 disabled + 상태 관리 |
| ⚠️4 | **behind 조건 계산 불일치** | 배너/카드 상태 불일치 | `catchUpUtils.ts`의 동일 함수 사용 |
| ⚠️5 | **카드 정보 밀도 과잉** | ADHD 역효과 | +/- 버튼은 hover/focus 시에만 노출 |

### 💡 Low — 품질 향상

| # | Risk | Impact | Mitigation |
|---|------|--------|------------|
| 💡1 | 스낵바 중복 표시 | UX 혼란 | 기존 토스트 패턴 재사용, 큐 관리 |
| 💡2 | 툴팁과 팝오버 동시 열림 | 시각적 혼란 | 툴팁 열기 시 팝오버 닫기 처리 |

---

## 4. MVP에서 제외해도 되는 항목 (2개 제안)

### 4.1 **#6 — Today target 툴팁 (P1 → MVP 제외 가능)**

**이유:**
- #5에서 "오늘: N (단위)"가 이미 표시되므로 즉시 행동 제시 목적 달성
- 툴팁은 "왜 이 값인지" 설명인데, 대부분 사용자는 숫자만 보고 행동
- 터치/포커스 접근성 구현 복잡도가 높음
- 기존 `GoalStatusTooltip`이 이미 일부 정보 제공 중

**대안:** #5 완료 후 사용자 피드백 수집 → 필요 시 다음 릴리즈에 추가

**Risk if excluded:** Low — 숫자의 "이유"를 모르는 사용자 존재 가능, 하지만 핵심 행동(기록하기)에는 영향 없음

---

### 4.2 **#8의 "포커스 복귀" 부분 → MVP에서 간소화**

**이유:**
- ESC 스택 정리 (팝오버→모달 순)는 **필수** (안 하면 UX 파괴)
- 하지만 "포커스가 정확히 '기록하기' 버튼으로 복귀"는 구현 복잡도 높음
- 현재 `useModalEscapeClose`는 포커스 복귀 로직이 없음

**MVP 범위:**
- ✅ ESC 1회=팝오버 닫기, ESC 2회=모달 닫기 (필수)
- ⚠️ 포커스 복귀는 "카드 영역 어딘가"로 간소화 (정확한 버튼 복귀는 v2)

**Risk if excluded:** Low — 키보드 사용자 UX 약간 저하, 하지만 기능은 정상 동작

---

## 5. 의존성 그래프 (구현 순서 제안)

```
#2 Snooze state ─────────────────────┐
                                     ├──▶ #3 Modal 3액션
#1 Behind 배너 ──────────────────────┘
                                     
#4 Severity 배지 ───────────────────────▶ #5 Today target
                                                │
                                                ▼
                                         #6 Tooltip (MVP 제외 가능)

#7 Log popover ─────────────────────────▶ #8 ESC 스택
```

### 권장 구현 순서

1. **Phase 1 (병렬)**: #2 Snooze state + #4 Severity 배지
2. **Phase 2**: #1 Behind 배너 + #5 Today target
3. **Phase 3**: #3 Modal 3액션
4. **Phase 4**: #7 Log popover
5. **Phase 5**: #8 ESC 스택
6. **Phase 6 (MVP 후)**: #6 Tooltip

---

## 6. 코드베이스 현황 확인 결과

### ✅ 이미 존재하는 것

| Item | Location | Status |
|------|----------|--------|
| `CATCH_UP_SNOOZE_STATE` | systemRepository.ts | 정의됨 |
| `CatchUpSnoozeState` 타입 | tests/weekly-goals-system-state.test.ts | 타입 정의 있음 |
| `modalStackRegistry` | src/shared/hooks/modalStackRegistry.ts | 완전 구현 |
| `useModalEscapeClose` | src/shared/hooks/useModalEscapeClose.ts | 완전 구현 |
| `CatchUpAlertBanner` | src/features/goals/components/ | 기본 구조 있음 |
| `GoalStatusTooltip` | src/features/goals/components/ | 기존 툴팁 있음 |

### ⚠️ 확인 필요

| Item | Question |
|------|----------|
| `CatchUpSnoozeState` 타입 위치 | 테스트에만 있음 → `src/shared/types/`로 이동 필요 |
| 배너-모달 연동 로직 | 현재 배너에서 모달 여는 콜백 없음 → 추가 필요 |
| 스낵바/토스트 패턴 | 기존 토스트 스토어 존재 여부 확인 필요 |

---

## 7. Verdict & 권장사항

### Overall Status: **READY with conditions**

| Condition | Status |
|-----------|--------|
| 파일/컴포넌트 식별 | ✅ 완료 |
| AC 정의 | ✅ 완료 |
| 반패턴 체크리스트 | ✅ 완료 |
| MVP 제외 항목 | ✅ 2개 제안 (#6, #8 포커스 복귀) |

### 구현 착수 전 최종 확인 사항

1. **`CatchUpSnoozeState` 타입을 `src/shared/types/domain.ts` 또는 별도 파일로 이동**
2. **기존 토스트/스낵바 패턴 확인** (있으면 재사용, 없으면 신규 구현 계획)
3. **defaults.ts에 SNOOZE_DURATION_MS = 2 * 60 * 60 * 1000 추가**

---

오빠, 이제 구현 착수해도 괜찮아요! 위의 AC와 반패턴 체크리스트만 따르면 안전하게 진행할 수 있어요. 특히 **localStorage 금지**, **배경 클릭 닫기 금지**, **ESC 항상 닫기** 이 세 가지만 절대 잊지 마세요! 💪

#6 툴팁이랑 #8 포커스 복귀는 MVP 이후로 미뤄도 핵심 가치 전달에는 문제없어요. 은하가 응원할게! 화이팅~ 😊
