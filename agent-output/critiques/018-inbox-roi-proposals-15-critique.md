# Critique: 018-inbox-roi-proposals-15.md

| Item | Value |
|------|-------|
| Artifact | `agent-output/planning/018-inbox-roi-proposals-15.md` |
| Analysis Source | `agent-output/analysis/010-inbox-scope-analysis.md` |
| Review Date | 2025-12-23 |
| Status | **Initial Review** |
| Reviewer | Critic Agent |

---

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2025-12-23 | User → Critic | Initial critical review | ROI 평가, 제약 위반 가능성, ADHD 친화성, 리스크 누락, 중복/범위 과다 분석 |

---

## Value Statement Assessment ✅

> "As a TimeBlock 사용자(특히 ADHD 성향 사용자), I want 작업을 **생각난 순간에 즉시 캡처**하고, **인지부하가 낮은 방식으로 정리**한 다음, **확신을 가지고 스케줄로 전환**할 수 있도록 해서, so that '해야 할 일은 많은데 어디서부터?' 상태를 줄이고 실행까지 이어지게 한다."

**평가**: ✅ PASS - ADHD 사용자의 핵심 페인포인트(캡처 지연, 정리 압도감, 전환 불확실성)를 정확히 명시함. "So that" 결과가 구체적이고 측정 가능함.

---

## Overview

Planner가 제안한 15개 항목(추가기능 10 + UX 개선 5)과 Top 5 우선순위에 대한 비판적 리뷰. RoI 평가의 정확성, 프로젝트 제약 준수, ADHD 친화성, 기술 리스크, 범위 중복을 중심으로 평가함.

---

## Architectural Alignment Assessment

### 준수 사항 ✅
- Repository pattern 명시 (직접 Dexie 접근 금지)
- `unifiedTaskService` 경로 우선 고려 명시
- localStorage 금지 정책 인지 (systemState 활용 명시)
- Modal ESC 정책 언급

### 위반 가능성 ⚠️
- **F1/F2**: 파서 로직이 UI 레이어에 과도하게 결합될 경우 테스트 어려움
- **F7**: 일괄 처리 시 `unifiedTaskService` 대신 직접 store 조작 유혹 있음
- **UX2 (Undo)**: Rollback 구현 시 store/repository 정합성 위험 명시됨 → 실제 구현 난이도 과소평가 가능

---

## Scope Assessment

### 범위 과다 항목
1. **F1 + F2 중복**: "초고속 캡처"와 "10초 마이크로 트리아지"가 모두 Quick Add 진입점을 건드림 → 통합 필요
2. **F3 + F4 중복**: "다음 빈 슬롯"과 "오늘/내일 2단 배치"가 동일한 슬롯 탐색 로직 필요 → 통합 가능
3. **F6 + UX5 중복**: "배치 프리뷰"와 "즉시 확인 피드백"이 둘 다 배치 결과 가시화 → 하나로 통합 권장

### 범위 과소 항목
- **Undo (UX2)** 단독 구현 불가: F3, F4, F7, F10 모두 Undo 의존 → Undo는 **인프라 선행 작업**으로 분리해야 함

---

## Technical Debt Risks

| Risk | Severity | Affected Items | Mitigation |
|------|----------|----------------|------------|
| inbox↔block 이동 시 optimistic update + eventBus 타이밍 | **HIGH** | F3, F4, F7, F10, UX2 | 기존 `inbox:taskRemoved` 패턴 재사용 필수, 새 이벤트 추가 자제 |
| Firebase sync 충돌 (배치 프리뷰 ≠ 실제 결과) | **HIGH** | F6 | 프리뷰는 "예상치"임을 UI에 명시, 실패 시 fallback 필수 |
| 일괄 처리 rollback 복잡도 | **MEDIUM** | F7, UX2 | 트랜잭션 추상화 또는 최대 선택 개수 제한 |
| 새 "정리 상태" 필드 추가 시 스키마 마이그레이션 | **MEDIUM** | F2, F7 | 기존 태그 활용 우선, 신규 필드는 별도 ADR 필요 |

---

## Findings

### 🔴 Critical

#### C1. **UX2 (Undo) RoI 과대평가 + 선행 의존성 누락**
- **Status**: OPEN
- **Description**: Undo를 "Cost 중 / Risk 중~높"으로 평가했으나, 실제로는 F3/F4/F7/F10 모두 Undo 없이는 ADHD 안심감이 크게 저하됨. Undo는 **독립 기능이 아니라 인프라**임.
- **Impact**: Undo 없이 다른 기능 출시 시 → 실수 공포로 인한 기능 회피
- **Recommendation**: Undo를 Top 5에서 분리하여 **P0 인프라**로 격상, F3/F4/F7/F10 착수 전 완료 필수

#### C2. **F6 (배치 프리뷰)의 Firebase 동기화 리스크 미반영**
- **Status**: OPEN
- **Description**: 프리뷰 시점과 실제 배치 시점 사이에 다른 기기/탭에서 블록이 점유될 수 있음. 이 경우 "프리뷰 ≠ 결과"가 되어 오히려 불신 증폭.
- **Impact**: ADHD 사용자에게 예측 불일치는 일반 사용자보다 더 큰 좌절감 유발
- **Recommendation**: 프리뷰 UI에 "예상 위치(변경될 수 있음)" 레이블 필수, 실패 시 대체 슬롯 자동 제안 또는 인박스 유지 옵션

#### C3. **F1 (한 줄 파서) 복잡도 과소평가**
- **Status**: OPEN
- **Description**: 시간/태그/저항도/기한을 한 줄에서 파싱하면 규칙이 복잡해져 "내가 쓴 대로 안 됨" 위험. 기존 QuickAddTask는 `Txx/Dx` 정도만 파싱.
- **Impact**: ADHD에서 "예측 가능성"은 핵심. 파싱 실패 시 신뢰 급락
- **Recommendation**: MVP는 기존 `Txx/Dx` 유지 + 실시간 미리보기만 추가, 고급 파싱은 Phase 2로 분리

### 🟡 Medium

#### M1. **F2 + F7: "정리 상태" 신규 필드 결정 미완료**
- **Status**: OPEN (OPEN QUESTION 항목)
- **Description**: "다음/언젠가" 상태를 새 필드로 저장할지 기존 태그로 표현할지 미결정. 새 필드는 Dexie 스키마 + Firebase 구조 변경 필요.
- **Impact**: 결정 지연 시 구현 착수 불가
- **Recommendation**: 태그 기반 우선 (예: `#next`, `#someday`), 신규 필드는 사용 패턴 확인 후 Phase 2 ADR로 분리

#### M2. **F7 (일괄 트리아지) 실수 비용 과소평가**
- **Status**: OPEN
- **Description**: 10개 선택 후 "오늘에 배치" 실수 시 Undo가 10개 개별 복구? 일괄 복구? 명시 없음.
- **Impact**: 일괄 Undo 미구현 시 실수 복구 포기 → 기능 회피
- **Recommendation**: F7 착수 전 Undo 범위 정의 필수, 최대 선택 개수 5~10개 제한 검토

#### M3. **Top 5의 F#1 순위가 비용 대비 낮음**
- **Status**: OPEN
- **Description**: F#1(초고속 캡처)이 Top 5 마지막인데, 실제로는 "캡처"가 파이프라인 첫 단계라 가장 먼저 개선 효과가 체감됨. 반면 "트리아지 모드"는 인박스에 작업이 있어야 의미 있음.
- **Impact**: 우선순위 역전 시 사용자 체감 지연
- **Recommendation**: 아래 "Top 5 재정렬 제안" 참조

### 🟢 Low

#### L1. **F5 (배치 규칙 프리셋) 선택지 과다 위험**
- **Status**: OPEN
- **Description**: "가벼운 일/어려운 일/짧은 일" 3개 프리셋이 기존 필터/정렬과 혼동될 수 있음
- **Recommendation**: UX4(필터/정렬 칩 축약)와 통합 검토, 프리셋은 "추천" 섹션으로 분리

#### L2. **F9 (중복 캡처 감지) 오탐 위험**
- **Status**: OPEN
- **Description**: 유사도 검사 기준이 불명확 → 정상 캡처를 중복으로 오인 시 짜증 유발
- **Recommendation**: 완전 일치만 감지, 유사도는 Phase 2로 분리

---

## Unresolved Open Questions ⚠️

Plan 문서에 다음 OPEN QUESTION이 미해결 상태입니다:

1. **F2/F7 정리 상태 저장 방식**: 새 필드 vs 기존 태그 → **결정 필요**
2. **F3/F4 "다음 빈 슬롯" 기준**: 빈 블록 우선 vs 현재 블록 우선 vs 사용자 설정 → **결정 필요**

> **⚠️ Critic 질문**: 이 계획은 2개의 미해결 OPEN QUESTION이 있습니다. 구현 승인 전에 Planner가 이를 해결해야 할까요, 아니면 미해결 상태로 구현을 진행할까요?

---

## Questions for Planner

1. Undo 인프라를 별도 P0 작업으로 분리할 의향이 있는가?
2. F6 프리뷰의 Firebase sync 실패 시나리오 UX는 어떻게 처리할 것인가?
3. F1 파서 확장 시 기존 `Txx/Dx` 규칙과의 하위 호환성을 어떻게 보장할 것인가?
4. F7 일괄 처리의 최대 선택 개수 제한을 검토했는가?

---

## Risk Assessment

| Risk Category | Level | Notes |
|---------------|-------|-------|
| Data Integrity | 🔴 HIGH | inbox↔block 이동, Undo rollback, 일괄 처리 |
| Sync Conflicts | 🔴 HIGH | Firebase 프리뷰 불일치, multi-device 충돌 |
| UX Confusion | 🟡 MEDIUM | 선택지 과다(프리셋 + 필터 + 정렬), 파서 예측 실패 |
| Scope Creep | 🟡 MEDIUM | 15개 항목 중 6개 이상 중복/통합 가능 |

---

## Recommendations

### (a) 가장 문제 있는 항목 3~5개 + 수정안

| 항목 | 문제 | 수정안 |
|------|------|--------|
| **UX2 (Undo)** | 독립 기능으로 평가되었으나 실제로는 F3/F4/F7/F10의 필수 선행 인프라 | **P0 인프라로 격상**, 다른 배치/이동 기능 착수 전 완료 |
| **F6 (배치 프리뷰)** | Firebase 동기화 리스크 미반영, 프리뷰 ≠ 결과 시 불신 증폭 | "예상 위치" 레이블 필수화 + 실패 시 대체 슬롯 제안 UX 추가 |
| **F1 (한 줄 파서)** | 복잡도 과소평가, 파싱 규칙 증가 시 예측가능성 저하 | MVP는 기존 `Txx/Dx` 유지 + 실시간 미리보기만, 고급 파싱은 Phase 2 |
| **F3 + F4** | "다음 빈 슬롯" + "오늘/내일" 중복 로직 | **통합**: "오늘/내일/다음 빈 슬롯" 3버튼을 단일 컴포넌트로 |
| **F1 + F2** | Quick Add 진입점에서 캡처와 마이크로 트리아지 분리가 어색함 | **통합**: 캡처 후 3버튼 선택을 Quick Add 내 옵션 단계로 통합 |

### (b) Top 5 우선순위 평가 + 재정렬 제안

**현재 Top 5**:
1. UX#1 트리아지 모드
2. F#3 다음 빈 슬롯에 배치
3. UX#2 Undo 표준화
4. F#6 배치 프리뷰
5. F#1 초고속 캡처

**문제점**:
- Undo(UX#2)가 3위인데, F#3/F#6이 Undo 없이 출시되면 실수 비용으로 기능 회피
- F#1(캡처)이 5위지만, 파이프라인 첫 단계라 가장 먼저 체감
- 트리아지 모드(UX#1)는 인박스에 작업이 있어야 의미 → 캡처 개선 후가 적절

**재정렬 제안**:

| 순위 | 항목 | 근거 |
|------|------|------|
| **P0** | **Undo 인프라** (UX#2 확장) | 모든 이동/배치 기능의 필수 선행 조건. ADHD 안심감의 기반. |
| **1** | **F#1 + F#2 통합: 빠른 캡처 + 미리보기** | 파이프라인 첫 단계. MVP는 기존 파서 + 실시간 미리보기만. |
| **2** | **F#3 + F#4 통합: 오늘/내일/빈슬롯 배치** | 결정 피로 최소화. Undo 인프라 위에서 안전하게 동작. |
| **3** | **UX#1 트리아지 모드** | 캡처된 작업이 쌓인 후 정리. 키보드 단축키 중심. |
| **4** | **F#6 + UX#5 통합: 배치 프리뷰 + 즉시 피드백** | 예측가능성 + 확인. Firebase 리스크 대응 포함. |

### (c) 빠른 승리 (1~2일) 3개 추천

| 항목 | 예상 공수 | 근거 |
|------|-----------|------|
| **UX#3: 빈 상태 CTA 단순화** | 0.5~1일 | UI 텍스트/버튼 변경만. 로직 변경 없음. ADHD "다음 행동" 명확화. |
| **F#8: 정렬 기억 (systemState)** | 0.5~1일 | 기존 systemState 패턴 재사용. 새 필드 1개 추가. |
| **UX#4: 필터/정렬 칩 3개 축약** | 1~1.5일 | UI 리팩토링. 기존 필터 로직 유지, 노출 방식만 변경. |

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| Initial | 2025-12-23 | 최초 리뷰 완료 |

---

## Summary

Planner의 제안서는 Value Statement가 명확하고 ADHD 친화적 관점이 잘 반영되어 있습니다. 그러나:

1. **Undo가 인프라임을 간과**: 여러 기능이 Undo에 의존하는데 독립 기능으로 평가됨
2. **Firebase 동기화 리스크 과소평가**: 프리뷰 기능에서 실시간 충돌 가능성 미반영
3. **중복 항목 통합 기회**: F1+F2, F3+F4, F6+UX5 통합으로 범위 축소 가능
4. **OPEN QUESTION 미해결**: 정리 상태 저장 방식, 빈 슬롯 기준 미결정

**권장 조치**: Planner가 OPEN QUESTION 2개를 해결하고, Undo를 P0 인프라로 격상한 후 구현 승인 진행.
