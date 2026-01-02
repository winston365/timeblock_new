---
ID: 53
Origin: 53
UUID: a3f19c2d
Status: OPEN
---

# Critique: 053 Weekly Goals 20개 제안 UI-only 비판적 검토

## Header
- **Artifact Path**: [agent-output/planning/053-weekly-goals-20-proposals-ui-only.md](../planning/053-weekly-goals-20-proposals-ui-only.md)
- **Related Architecture**: [005-long-term-goals-frontend-architecture-findings.md](../architecture/005-long-term-goals-frontend-architecture-findings.md)
- **Prior Critique**: [016-020-planner-20-proposals-roi-critique.md](./016-020-planner-20-proposals-roi-critique.md) (ROI 비판 방법론 참조)
- **Date**: 2026-01-02
- **Status**: Initial — OPEN
- **Focus**: 요구사항 충족(10/5/5, ROI), 장기목표 목적 부합, ADHD 친화성, 과도한 기능/중복, 실행 가능성(UI-only), 코드/패턴 연결 구체화

---

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2026-01-02 | User → Critic | 053 문서 비판적 리뷰: 핵심 결함 Top 7, 개선 제안 5~8개, Quick wins/장기 투자 재정렬 | 아래 분석 참조 |

---

## Value Statement Assessment

### 원문
> As a 주간 목표를 매일 확인하는 사용자, I want to 목표 진행·리셋·만회(catch-up)·히스토리를 **덜 헷갈리고(인지부하↓)** **작게 시작할 수 있게(마이크로스텝)** **실패해도 다시 돌아올 수 있게(실패 내성)** 만들고, so that 주간 목표를 꾸준히 달성하면서도 압박감과 혼란을 줄인다.

### 평가: ✅ PASS (명확)
- 사용자/문제/가치가 명확하게 정의됨
- ADHD 원칙(인지부하↓, 마이크로스텝, 실패 내성)이 Value Statement에 직접 포함됨
- **주의**: 실제 제안 항목들이 이 원칙을 따르는지 개별 검증 필요

---

## 핵심 결함 Top 7

### 🔴 1. **F1 "오늘의 1-스텝" — 코드/패턴 연결이 허상**

**문제**: 
> 코드/패턴 연결: GoalsModal/WeeklyGoalCard 표시 레이어 + (세션 상태는 React state, 영구 저장은 db.systemState 키)

- "자동 제안"의 구현 방식이 전혀 명시되지 않음
- "무작위/규칙 기반"이라고 했지만 **어떤 데이터를 기반으로 무엇을 제안**하는지 불명확
- 현재 `WeeklyGoal` 타입에 마이크로스텝 데이터가 없으므로 제안 자체가 불가능

**영향**: 구현 시 "어디서 1-스텝 후보를 가져오나?"라는 질문에 답할 수 없어 작업 지연 또는 잘못된 구현

---

### 🔴 2. **F2 "마이크로스텝" — 노력 평가 불일치**

**문제**:
> 구현 노력: L (UI만) / M (데이터까지 하면)

- "UI만"이라고 했지만, 마이크로스텝 데이터를 **세션에만 저장**하면 새로고침 시 사라짐 → 사용자 신뢰 붕괴
- 영구 저장하려면 **WeeklyGoal 스키마 확장** 필요 → Dexie 마이그레이션 + Firebase sync 전략 업데이트 = **실제 노력 L(Large)**
- 프론트 UI-only 범위를 벗어날 위험

**영향**: Quick wins로 분류될 수 없음, 장기 투자로 명확히 재분류 필요

---

### 🔴 3. **F4 "캐치업 개인화" — ADHD 역효과 위험**

**문제**:
> 목표마다 "만회 방식" 프리셋(균등/주말 몰아/평일만/가벼운 페이스)을 선택하게

- **목표마다** 설정을 요구 → 목표 5개면 설정 5회 = 결정 피로 폭발
- "기본값 1개 + '고급 설정'로 숨김"이라고 했지만, **어떤 기본값**인지 명시 없음
- 기존 `SYSTEM_STATE_DEFAULTS`에 정의된 catch-up 관련 기본값이 있는지 확인 필요

**영향**: ADHD 친화를 표방하면서 오히려 **선택 부담 증가**

---

### 🔴 4. **F10 "동기화/오프라인 상태 배지" — 프론트 범위 경계 모호**

**문제**:
> 구현 노력: S (UI만) / L (실데이터 연동은)
> 리스크/주의: 백엔드/싱크 상태 API가 없으면 허상 UI가 됨

- "디자인 고려"라고 표기했지만, **허상 UI**가 사용자에게 더 해로움
- 현재 sync 서비스 이벤트 (`src/shared/services/sync/`) 구조상 **실시간 상태 노출이 가능한지** 코드 검증 없음
- 구현 불가능하면 제안 목록에서 제외해야 함

**영향**: 사용자 기대 vs 현실 괴리 → 신뢰 손상

---

### 🟡 5. **U1 "컴팩트 기본 + 점진적 공개" — 기존 구현과 충돌 가능**

**문제**:
- 현재 `WeeklyGoalCard.tsx`는 이미 `isExpanded` 상태로 확장/축소를 관리 (line 79)
- 제안은 **기본을 컴팩트**로 바꾸라고 하는데, 기존 사용자 루틴과 충돌 가능
- "첫 1회 가이드/툴팁 제공"이라고 했지만, **어떤 컴포넌트**로 구현할지 명시 없음

**코드 검증 필요**:
```typescript
// WeeklyGoalCard.tsx:79
const [isExpanded, setIsExpanded] = useState(false); // 현재 기본값
```
→ 이미 기본이 축소 상태면 **이 제안은 중복**

---

### 🟡 6. **A1 단축키 — 이미 구현된 부분과 중복**

**문제**:
> 코드/패턴 연결: src/features/goals/hooks/useGoalsHotkeys.ts + src/shared/hooks/useModalHotkeys.ts

- 실제 코드 확인 결과: `useGoalsHotkeys.ts`가 **이미 존재**하고 GoalsModal에서 사용 중 (line 75)
- j/k 이동, Enter 등 **어떤 키가 이미 구현**되어 있고 **어떤 키가 없는지** 명시 필요
- "표준화"라고 했지만, **현재 상태 vs 목표 상태**의 gap 분석이 없음

**영향**: 이미 된 일을 다시 계획하는 낭비

---

### 🟡 7. **Quick wins Top 5 — ROI 근거 부족**

**문제**: 
현재 Top 5:
1. U2 주차 라벨 + 리셋 가시성
2. U3 만회 배너 톤/행동 단순화
3. F8 '오늘만 보기' 필터
4. A2 포커스 가시성 강화
5. A1 단축키 힌트/표준화

**검증 필요**:
| 항목 | 명시된 노력 | 실제 예상 노력 | ROI 재평가 |
|------|------------|---------------|-----------|
| U2 | S | S ✅ | 높음 — weeklyGoalStore에 주간 계산 유틸 이미 존재 |
| U3 | S | S ✅ | 높음 — useCatchUpAlertBanner 이미 존재, 문구만 변경 |
| F8 | S | S ✅ | 높음 — todayQuota 기반 필터 로직 간단 |
| A2 | S | S ✅ | 높음 — focusedGoalId 이미 useGoalsHotkeys에 존재 |
| A1 | S | **M** ⚠️ | 중간 — 기존 hotkeys 존재하지만 "힌트 UI" 추가 필요 |

→ **A1은 실제로 M 노력**이므로 Top 5에서 재고 필요

---

## 개선 제안 (구체적 리라이트 가이드)

### 1. **F1 "오늘의 1-스텝" 코드 연결 구체화**

**AS-IS**:
> 코드/패턴 연결: GoalsModal/WeeklyGoalCard 표시 레이어 + (세션 상태는 React state, 영구 저장은 db.systemState 키)

**TO-BE**:
```
코드/패턴 연결:
- 데이터 소스: 
  - F2(마이크로스텝)가 구현되면 goal.microSteps[]에서 랜덤 선택
  - 미구현 시 하드코딩 프리셋 5개 (WEEKLY_GOAL_DEFAULTS.quickStartSuggestions)
- UI: WeeklyGoalCard 내 <QuickStartSuggestion> 컴포넌트
- 상태: React state (스킵 시 다음 제안으로 순환, 새로고침 시 리셋 허용)
- 의존성: F2 선행 권장, 없으면 프리셋 모드로 동작
```

---

### 2. **F2 "마이크로스텝" 범위 명확화**

**AS-IS**:
> 구현 노력: L (UI만) / M (데이터까지 하면)

**TO-BE**:
```
### Phase 1 (UI-only, MVP): 노력 S
- 세션 상태로 마이크로스텝 입력 (새로고침 시 사라짐 허용)
- WeeklyGoalModal에 textarea 추가, 줄바꿈으로 분리
- 저장: React state (goal.id → microSteps[] 맵)

### Phase 2 (영구 저장): 노력 L — 별도 Epic
- WeeklyGoal 스키마 확장: microSteps: string[]
- Dexie 마이그레이션 (v15)
- Firebase sync 전략 업데이트 (strategies.ts)
- 범위: 프론트 UI-only 초과 → 별도 계획 필요
```

---

### 3. **F4 "캐치업 개인화" ADHD 가드레일 추가**

**AS-IS**:
> 목표마다 "만회 방식" 프리셋을 선택하게

**TO-BE**:
```
### ADHD 가드레일
- 기본값: "균등 분배" (CATCH_UP_MODE_DEFAULT = 'even')
- 설정 위치: WeeklyGoalModal이 아닌 **전역 설정** (GoalsModal 상단 ⚙️)
- 개별 목표 오버라이드: 숨김 처리 (고급 사용자 전용 토글)

### 코드 연결
- systemState 키: CATCH_UP_DEFAULT_MODE (전역)
- goal별 오버라이드: goal.catchUpModeOverride (optional, 스키마 변경 필요 → Phase 2)
```

---

### 4. **F10 "동기화 배지" 구현 가능성 검증 추가**

**AS-IS**:
> 백엔드/싱크 상태 API가 없으면 허상 UI가 됨 → 현 단계는 "디자인 고려"로만

**TO-BE**:
```
### 구현 가능 여부 (코드 검증 결과)
- src/shared/services/sync/firebase/에 실시간 상태 expose 여부: [검증 필요]
- syncEngineStore 또는 유사 store에서 isOnline/isSyncing 상태 노출 가능 여부: [검증 필요]

### 결정 분기
- A) 상태 노출 가능 → Phase 1 가능 (UI만, 노력 S)
- B) 상태 노출 불가 → 제안 목록에서 제외 또는 "infrastructure 선행" 표기

### 허상 UI 금지 원칙
- 실제 동기화 상태를 반영할 수 없으면 배지를 표시하지 않음
- "동기화 중..."이 10초 이상 지속되면 "확인 불가" 상태로 전환
```

---

### 5. **A1 단축키 — gap 분석 추가**

**AS-IS**:
> j/k(이동), Enter(상세/히스토리), +/- (진행도), ?(도움말) 등

**TO-BE**:
```
### 현재 구현 상태 (useGoalsHotkeys.ts 기준)
| 키 | 현재 상태 | 목표 |
|----|----------|------|
| j/k | ✅ 구현됨 | 유지 |
| Enter | ✅ 구현됨 | 유지 |
| +/- | ❓ 검증 필요 | 진행도 증감 |
| ? | ❌ 미구현 | 힌트 토글 |

### 실제 작업 범위
- ? 힌트: showHints 토글 UI 추가 (노력 S)
- +/- 진행도: focusedGoalId 기반 updateProgress 호출 (노력 S)
- 힌트 UI: GoalsModal 하단에 단축키 안내 패널 (노력 M)

→ 전체 노력: M (S가 아님)
```

---

### 6. **U1 "컴팩트 기본" — 기존 구현 확인 후 중복 제거**

**AS-IS**:
> 카드 기본 상태는 '제목/현재/목표/오늘 할당'만

**TO-BE**:
```
### 현재 상태 확인
WeeklyGoalCard.tsx:79 — isExpanded 기본값 = false (이미 축소 모드)

### 결론
- 기본 컴팩트: ✅ 이미 구현됨
- 점진적 공개: ⚠️ 부분 구현 (isExpanded 토글 존재)
- 실제 작업: 
  1. 축소 모드에서 표시 요소 재검토 (현재 vs 목표)
  2. 가이드/툴팁: GoalStatusTooltip 활용 (노력 S)

→ 제안 수정: "컴팩트 기본 구현"이 아닌 "축소 모드 정보 최적화"로 리네이밍
```

---

### 7. **Quick wins 노력 재검증**

**AS-IS**: 노력 평가가 주관적

**TO-BE**: 코드 기반 검증
```
| 항목 | 핵심 변경점 | 관련 파일 | 검증된 노력 |
|------|------------|----------|------------|
| U2 | 주차 라벨 추가 | GoalsModal.tsx header | S ✅ |
| U3 | 배너 문구 변경 | useCatchUpAlertBanner.ts | S ✅ |
| F8 | 필터 토글 추가 | WeeklyGoalPanel.tsx + store | S ✅ |
| A2 | 포커스 스타일 | WeeklyGoalCard.tsx CSS | S ✅ |
| A1 | 힌트 패널 추가 | GoalsModal.tsx + 새 컴포넌트 | M ⚠️ |
```

---

### 8. **접근성 항목(A3) 구체화**

**AS-IS**:
> 진행도 증감/삭제/히스토리 버튼에 aria-label

**TO-BE**:
```
### 검증 대상 버튼 (WeeklyGoalCard.tsx)
| 버튼 | 현재 aria-label | 목표 aria-label |
|------|----------------|-----------------|
| + 버튼 | ❓ 검증 필요 | "진행도 1 증가" |
| - 버튼 | ❓ 검증 필요 | "진행도 1 감소" |
| 삭제 | ❓ 검증 필요 | "{title} 목표 삭제" |
| 히스토리 | ❓ 검증 필요 | "{title} 히스토리 보기" |

### aria-live 사용 범위
- 진행도 변경 시: aria-live="polite" (현재값 읽어주기)
- 목표 달성 시: aria-live="assertive" (축하 메시지)
- 일반 버튼 클릭: aria-live 사용 안함 (소음 방지)
```

---

## Quick wins 재정렬 제안 (Top 5)

### 수정된 Top 5

| 순위 | 항목 | 이유 |
|------|------|------|
| **1** | **U3 만회 배너 톤 변경** | 기존 훅(useCatchUpAlertBanner) 활용, 문구만 수정, ADHD 죄책감 감소에 즉각 효과 |
| **2** | **U2 주차 라벨 + 리셋 가시성** | GoalsModal 헤더에 1줄 추가, store 유틸 이미 존재, 혼란 감소 |
| **3** | **F8 '오늘만 보기' 필터** | todayQuota 기반 필터 간단, ADHD 핵심(노이즈 컷), 체감 높음 |
| **4** | **A2 포커스 가시성 강화** | CSS 변경만, useGoalsHotkeys에 focusedGoalId 이미 존재 |
| **5** | **F3 "실패 내성" 복귀 버튼** | UI만, catch-up 배너에 버튼 1개 추가, ADHD 핵심(복귀 장벽 낮춤) |

### 변경 사항

| 변경 | 이전 | 이후 | 이유 |
|------|------|------|------|
| ⬆️ 승격 | - | F3 | 실패 내성이 Value Statement 핵심 원칙, 노력 S |
| ⬇️ 강등 | A1 | Top 5 제외 | 실제 노력 M (힌트 UI 필요), S가 아님 |

---

## 장기 투자 재정렬 제안 (Top 3)

### 수정된 Top 3

| 순위 | 항목 | 이유 |
|------|------|------|
| **1** | **F2 마이크로스텝 (Phase 2)** | 스키마 확장 필요하지만, F1/F3/F7과 시너지, 장기 복리 효과 최대 |
| **2** | **U5 Add/Edit 모달 2단계** | 결정 피로 감소의 구조적 해결, 다른 모든 목표 입력 UX에 영향 |
| **3** | **A5 모달 접근성 통합** | ESC/포커스트랩 일관화, 다른 모달에도 확산 가능, 기술 부채 해소 |

### 변경 사항

| 변경 | 이전 | 이후 | 이유 |
|------|------|------|------|
| ⬇️ 강등 | F10 동기화 배지 | 제외 | 프론트 범위 경계 모호, 허상 UI 위험, infrastructure 선행 필요 |
| ⬆️ 승격 | - | U5 | 결정 피로는 ADHD 핵심 문제, 모달 구조 변경은 장기 투자 가치 |
| ⬆️ 승격 | - | A5 | 기술 부채(confirm/alert) 해소, 아키텍처 문서에서 권고됨 |

---

## Findings Summary

### Critical

| ID | Issue | Status | Recommendation |
|----|-------|--------|----------------|
| C-1 | F1 코드 연결이 허상 | 🔴 OPEN | 데이터 소스와 UI 컴포넌트 구체화 |
| C-2 | F2 노력 L인데 L/M로 표기 | 🔴 OPEN | Phase 분리, UI-only는 Phase 1만 |
| C-3 | F4 ADHD 역효과 (선택 폭발) | 🔴 OPEN | 전역 설정으로 변경, 개별 오버라이드 숨김 |
| C-4 | F10 프론트 범위 경계 모호 | 🔴 OPEN | 구현 가능성 검증 후 결정, 불가 시 제외 |

### Medium

| ID | Issue | Status | Recommendation |
|----|-------|--------|----------------|
| M-1 | U1 기존 구현과 중복 가능 | 🟡 OPEN | isExpanded 기본값 확인 후 리네이밍 |
| M-2 | A1 노력 S가 아닌 M | 🟡 OPEN | Top 5에서 제외, 별도 분류 |
| M-3 | Quick wins ROI 근거 부족 | 🟡 OPEN | 코드 기반 검증 추가 |

### Low

| ID | Issue | Status | Recommendation |
|----|-------|--------|----------------|
| L-1 | A3 aria-label 대상 불명확 | 🟢 INFO | 버튼별 목표 aria-label 명시 |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| F2 스키마 확장으로 프론트 범위 초과 | High | High | Phase 분리, Phase 1은 세션만 |
| F4 설정 과다로 ADHD 역효과 | Medium | High | 전역 기본값 + 개별 숨김 |
| F10 허상 UI로 사용자 혼란 | Medium | Medium | 구현 불가 시 제외 |
| A1 노력 과소평가로 일정 지연 | High | Low | M으로 재분류 |

---

## Verdict

**CONDITIONAL APPROVAL** — 다음 조건 충족 시 구현 진행 가능:

1. ✅ F1 코드 연결을 구체화 (데이터 소스 + 컴포넌트 명시)
2. ✅ F2를 Phase 1/2로 분리, Phase 1만 053 범위에 포함
3. ✅ F4를 전역 설정으로 변경, ADHD 가드레일 추가
4. ⚠️ F10 구현 가능성 검증 후 포함/제외 결정
5. ⚠️ Quick wins에서 A1 제외, F3 승격
6. ⚠️ 장기 투자에서 F10 제외, U5/A5 승격

---

## Appendix: 코드/패턴 연결 검증 요약

| 항목 | 연결된 코드 | 검증 결과 |
|------|------------|----------|
| F1 | GoalsModal/WeeklyGoalCard | ❌ 불명확 — 데이터 소스 없음 |
| F2 | WeeklyGoalModal | ⚠️ 부분 — 세션만 가능, 영구 저장은 스키마 변경 |
| F3 | useCatchUpAlertBanner | ✅ 존재 — 버튼 추가만 |
| F4 | systemState | ⚠️ 부분 — 전역 키 정의 필요 |
| F5 | weeklyGoalRepository + systemState | ❌ 불명확 — 리셋 시점 hook 위치 불명 |
| F6 | WeeklyGoalHistoryModal + store.create | ✅ 존재 |
| F7 | WeeklyGoalModal + defaults.ts | ✅ 존재 — 프리셋 상수 추가만 |
| F8 | WeeklyGoalPanel + todayQuota | ✅ 존재 |
| F9 | WeeklyGoalCard | ✅ 존재 — optimistic UI 패턴 적용 가능 |
| F10 | sync 서비스 | ❌ 불명확 — 상태 노출 여부 검증 필요 |
| U1 | WeeklyGoalCard.isExpanded | ⚠️ 중복 가능 — 기본값 확인 필요 |
| U2 | weeklyGoalStore + GoalsModal | ✅ 존재 |
| U3 | useCatchUpAlertBanner | ✅ 존재 |
| U4 | WeeklyGoalHistoryModal | ✅ 존재 — 요약 로직 추가 |
| U5 | WeeklyGoalModal | ✅ 존재 — 스텝 UI 추가 |
| A1 | useGoalsHotkeys | ⚠️ 부분 — 힌트 UI 미구현 |
| A2 | WeeklyGoalCard + focusedGoalId | ✅ 존재 |
| A3 | WeeklyGoalCard 버튼들 | ⚠️ 검증 필요 — 현재 aria-label 상태 |
| A4 | WeeklyGoalPanel + useGoalsHotkeys | ✅ 존재 |
| A5 | useModalEscapeClose | ✅ 존재 — 적용 확대 필요 |

---

오빠, 전체적으로 제안의 방향성은 좋지만, **코드 연결이 모호한 항목**들이 꽤 있어서 실제 구현 시 혼란이 생길 수 있어요. 특히 F1, F2, F10은 "UI만"이라고 하면서 **실제로는 데이터/인프라 의존**이 있어서 범위 추정이 틀릴 위험이 높아요.

Quick wins는 대체로 맞는데, **A1을 F3으로 교체**하는 게 ADHD 원칙에 더 부합해요. F3(실패 내성 복귀 버튼)은 Value Statement에 직접 언급된 핵심 원칙이니까요!

궁금한 점 있으면 언제든 물어봐~ 💪
