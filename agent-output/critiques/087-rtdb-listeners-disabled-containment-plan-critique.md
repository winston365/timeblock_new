---
ID: 87
Origin: 87
UUID: 197edc5b
Status: OPEN
---

# Critique: 087-rtdb-listeners-disabled-containment-plan

| 항목 | 내용 |
|------|------|
| Artifact Path | [agent-output/planning/087-rtdb-listeners-disabled-containment-plan.md](../planning/087-rtdb-listeners-disabled-containment-plan.md) |
| Date | 2026-01-11 |
| Status | Initial Review |

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2026-01-11 | User → Critic | RTDB 리스너 비활성화 계획 검토 | 초기 검토 수행 |

---

## Value Statement Assessment

### ✅ PASS - Value Statement 존재

> As a local-first 사용자(특히 single-device 사용자), I want Firebase RTDB가 "앱을 켜놓기만 해도 지속적으로 다운로드되는 상태"를 완전히 없애고, so that 실제 데이터 크기(예: 3MB)만큼만 다운로드하며 비용/쿼터/배터리/발열 리스크를 제거한다.

**분석:**
- 사용자 페르소나: "local-first 사용자(특히 single-device 사용자)" - 명확함 ✓
- 원하는 것: "지속적 다운로드 상태 제거" - 구체적 ✓  
- 기대 결과: "비용/쿼터/배터리/발열 리스크 제거" - 명확한 가치 ✓

**평가:** Value Statement가 잘 작성되어 있으며, "single-device 사용자"라는 타겟팅이 적절함. 다만 multi-device 사용자에 대한 영향 고지가 Value Statement 자체에는 없음(본문에서 다룸).

---

## Overview

이 계획은 Firebase RTDB 실시간 리스너를 **완전 비활성화**하여 앱 방치 시 지속 다운로드 문제를 근본적으로 해결하려는 **"핵 옵션(nuclear option)"** 접근입니다.

### 핵심 메커니즘
- 새 플래그 `RTDB_LISTENERS_DISABLED: true` 도입
- `SyncEngine.startListening()` 진입부에서 플래그 체크 후 즉시 반환
- 리스너 시작 자체를 차단하여 Remote → Local 실시간 동기화 중단

### 기존 플래그와의 관계
현재 코드베이스에 이미 `LEGACY_RTDB_LISTENERS_DISABLED: true`가 존재함:
- **기존 플래그**: 레거시 경로(`/all/data`)만 비활성화, 신규 경로(`/data`)는 유지
- **제안 플래그**: **모든** RTDB 리스너 비활성화

이 두 플래그의 관계가 문서에서 명확히 설명되지 않음.

---

## Architectural Alignment

### ✅ 긍정적 측면

1. **Feature Flag 패턴 준수**: 기존 `featureFlags.ts` 패턴 그대로 사용
2. **Single Entry Point**: `SyncEngine.startListening()`이 유일한 리스너 진입점임을 활용한 효율적 차단
3. **Local → Remote 유지**: Dexie hooks 기반 업로드는 영향 없음
4. **롤백 경로 명확**: 플래그 false로 즉시 복구 가능

### ⚠️ 우려 사항

1. **플래그 명명 일관성 부족**
   - 기존: `LEGACY_RTDB_LISTENERS_DISABLED`
   - 제안: `RTDB_LISTENERS_DISABLED`
   - 혼란 가능성 있음

2. **Plan 086과의 충돌 가능성**
   - 086 계획은 "증분 적용"으로 리스너 최적화 목표
   - 087은 리스너 완전 비활성화 목표
   - 두 계획이 동시에 진행되면 의존성 충돌 가능

---

## Scope Assessment

### Task 1: Feature Flag 추가
- **범위**: 적절함 ✓
- **예상 시간**: 2시간 이내
- **리스크**: 낮음

### Task 2: startListening() 조건부 비활성화  
- **범위**: 적절함 ✓
- **예상 시간**: 2-4시간
- **리스크**: 낮음 (진입점이 하나뿐)

### Task 3: 테스트 업데이트
- **범위**: 적절함 ✓
- **예상 시간**: 2-4시간
- **리스크**: 낮음

### Task 4: (선택) 포커스 시 수동 fetch
- **범위**: 별도 PR로 분리 권장
- **리스크**: 중간 (큰 다운로드 유발 가능성)

---

## Technical Debt Risks

### 낮음 - 이 변경 자체의 기술 부채

1. **죽은 코드 증가**: 리스너 관련 코드가 실행되지 않지만 남아있음
   - `listener.ts`의 모든 `attachRtdbOnChild*` 함수들
   - `rtdbListenerRegistry` 관련 코드
   - 완화: Phase 2에서 삭제 예정이라 명시

2. **플래그 복잡도 증가**: Feature flag가 이미 7개, 하나 더 추가됨
   - 완화: 안정화 후 플래그 정리 로드맵 필요

---

## Findings

### 🔴 Critical (0)

없음

### 🟡 Medium (3)

#### M-1: OPEN QUESTION 미해결 - Q1 (기본값 true 확정)
| 항목 | 내용 |
|------|------|
| Status | OPEN |
| Description | 문서에 `RTDB_LISTENERS_DISABLED` 기본값을 **true**로 할지 명시적 확인 요청이 있으나 [RESOLVED] 표시 없음 |
| Impact | 기본값이 true면 multi-device 사용자 영향 즉시 발생; false면 수동 활성화 필요 |
| Recommendation | 사용자/팀이 명시적으로 Q1에 대해 "예, true로 간다" 또는 "아니오, 기본 false로 시작"을 결정해야 함 |

#### M-2: OPEN QUESTION 미해결 - Q2 (Task 4 포함 여부)
| 항목 | 내용 |
|------|------|
| Status | OPEN |
| Description | Task 4(포커스 fetch)가 1.0.193에 포함될지 Phase 2로 분리될지 미결정 |
| Impact | 포함 시 scope creep 위험; 분리 시 multi-device 경험이 "앱 재시작 필요"로 남음 |
| Recommendation | Task 4는 별도 PR(Phase 2)로 **확실히 분리** 권장. 이번 릴리즈는 "리스너 OFF"만 집중 |

#### M-3: 기존 플래그와 명명 혼란
| 항목 | 내용 |
|------|------|
| Status | OPEN |
| Description | `LEGACY_RTDB_LISTENERS_DISABLED`(기존)와 `RTDB_LISTENERS_DISABLED`(신규) 네이밍이 혼란스러움 |
| Impact | 개발자가 어느 플래그가 뭘 제어하는지 헷갈릴 수 있음 |
| Recommendation | 신규 플래그를 `ALL_RTDB_LISTENERS_DISABLED` 또는 `RTDB_LISTENERS_FULLY_DISABLED`로 변경하거나, JSDoc에 두 플래그 차이를 명확히 설명 |

### 🟢 Low (2)

#### L-1: Plan 086과의 의존성 미명시
| 항목 | 내용 |
|------|------|
| Status | OPEN |
| Description | 086 계획(증분 적용 최적화)과 087 계획이 같은 리스너 경로를 다루지만, 두 계획의 관계/순서가 명시되지 않음 |
| Impact | 낮음 - 087이 먼저 적용되면 086의 일부가 무의미해질 수 있음 |
| Recommendation | 087이 활성화되면 086의 PR-2/3/4(증분 적용)은 "리스너가 꺼진 상태에서 무의미"함을 문서에 명시 |

#### L-2: 릴리즈 노트 문구 구체화 필요
| 항목 | 내용 |
|------|------|
| Status | OPEN |
| Description | "멀티 디바이스 실시간 반영 지연" 영향을 사용자가 이해할 수 있게 구체적으로 작성 필요 |
| Impact | 낮음 - 사용자 혼란 가능성 |
| Recommendation | "다른 기기에서 변경한 내용은 앱 재시작 후 반영됩니다" 같은 명확한 문구 예시 추가 |

---

## Questions (User Review Points 응답)

### 1. 기능적 영향
> 리스너를 끄면 다른 기기에서 변경한 내용이 실시간으로 반영되지 않음

**분석 결과:**
- **맞습니다.** 실시간 반영이 중단됨
- **영향 범위**: 앱 실행 중 다른 기기 변경 → 반영 안됨 → 앱 재시작/수동 fetch까지 대기
- **single-device 사용자**: 영향 **없음** (자기 변경은 Local → Remote로 반영됨)
- **multi-device 사용자**: 영향 **있음** - 실시간 동기화 불가

### 2. 보안 영향
> 리스너를 끄면 보안에 영향이 있는가?

**분석 결과:**
- **보안 영향 없음** ✅
- Firebase Security Rules는 **서버 측**에서 동작 - 리스너 활성화 여부와 무관
- 클라이언트가 리스너를 안 켜도, 누군가 직접 RTDB에 접근 시도하면 Rules가 차단함
- 업로드(`set()`, `update()`) 경로도 동일한 Rules 적용

### 3. 기존 코드 영향
> `startListening()`을 호출하는 곳이 어디인가?

**분석 결과:**
- **호출 위치**: `useAppInitialization.ts` 라인 92 (유일한 호출점)
- **RAGSyncHandler**: RTDB 리스너와 **무관** - Dexie 데이터 변경을 추적하여 인덱싱하는 별도 시스템
- **다른 subscriber**: `syncEngine.startListening()` 외에 다른 경로로 RTDB 구독하는 코드 없음
- **결론**: 이 플래그 하나로 모든 RTDB 리스너 제어 가능 ✅

### 4. 롤백 가능성
> Feature Flag를 false로 바꾸면 즉시 복구 가능한가?

**분석 결과:**
- **빌드타임 플래그**: 코드 변경 → 빌드 → 배포 필요 (즉시 복구 아님)
- **런타임 kill-switch 없음**: 현재 계획에서는 런타임 전환 미지원
- **데이터 정합성**: 
  - 리스너 OFF 동안 다른 기기에서 변경 → 로컬에 미반영 상태
  - 리스너 ON으로 복구 시 → 초기 스냅샷으로 최신 데이터 수신 → **정합성 복구됨** ✅
- **위험 시나리오**: 양쪽 기기에서 같은 데이터 수정 시 충돌 가능 (기존에도 동일한 문제)

### 5. 테스트 커버리지
> 기존 테스트가 깨지지 않는가?

**분석 결과:**
- `sync-engine-rtdb-range-listeners.test.ts`: `startRtdbListeners()`를 **직접** 호출하므로 영향 없음
- `smoke-sync-engine-basic.test.ts`: `applyRemoteUpdate` 테스트 - 영향 없음
- `firebase-service-legacy-root-listeners-disabled.test.ts`: `enableFirebaseSync` deprecation 테스트 - 영향 없음
- **필요한 새 테스트**: Task 3에서 명시한 대로 플래그 on/off 케이스 추가 필요

---

## Risk Assessment

| 리스크 | 심각도 | 확률 | 완화 상태 |
|--------|--------|------|-----------|
| Multi-device 실시간 반영 상실 | 중간 | 확실 | ⚠️ 계획에 명시됨, 사용자 동의 필요 |
| 플래그 명명 혼란 | 낮음 | 중간 | ❌ 미완화 |
| Task 4 scope creep | 중간 | 중간 | ⚠️ Phase 2 분리 권장 |
| 086 계획과 충돌 | 낮음 | 낮음 | ❌ 관계 미명시 |

---

## Recommendations

### 필수 (구현 전 해결)

1. **Q1 확정 (M-1)**: `RTDB_LISTENERS_DISABLED` 기본값 true/false 명시적 결정
2. **Q2 확정 (M-2)**: Task 4를 1.0.193에서 **제외**하고 Phase 2로 분리 확정

### 권장 (구현 품질 향상)

3. **플래그 명명 개선 (M-3)**: `ALL_RTDB_LISTENERS_DISABLED` 또는 JSDoc에 두 플래그 차이 명시
4. **086 관계 명시 (L-1)**: "087 활성화 시 086 PR-2/3/4는 우선순위 하락" 문서화
5. **릴리즈 노트 예시 (L-2)**: 사용자 친화적 영향 설명 문구 추가

---

## Unresolved Open Questions

⚠️ **이 계획에는 2개의 미해결 OPEN QUESTION이 있습니다.**

| # | Question | 영향 |
|---|----------|------|
| Q1 | 기본값 true 확정 여부 | Multi-device 영향 즉시 발생 vs 수동 활성화 |
| Q2 | Task 4 포함 여부 | Scope creep vs UX 개선 |

**오빠, 이 계획을 OPEN QUESTION 미해결 상태로 구현 승인할까요?**
- **권장**: Q1, Q2를 명시적으로 답변한 후 구현 진행
- **대안**: "OPEN QUESTION은 구현 중 결정"으로 진행 (위험 수용)

---

## Final Verdict

### 📋 판정: **조건부 승인 (Conditional Approval)**

**근거:**
1. ✅ Value Statement 명확
2. ✅ 기술적 접근 방식 적절 (single entry point 활용)
3. ✅ 보안 영향 없음
4. ✅ 롤백 가능 (빌드타임 플래그이지만 데이터 정합성 복구 가능)
5. ✅ 기존 테스트 영향 최소
6. ⚠️ OPEN QUESTION 2개 미해결 - **사용자 결정 필요**

**승인 조건:**
- [ ] Q1 답변: 기본값 true 또는 false 확정
- [ ] Q2 답변: Task 4를 Phase 2로 분리 확정 (권장)

**조건 충족 시 구현 가능합니다.**

---

## Confirmed Final Plan (조건 충족 후)

### 확정된 Task 목록

| Task | 설명 | 예상 시간 | 리스크 |
|------|------|----------|--------|
| Task 1 | `RTDB_LISTENERS_DISABLED` 플래그 추가 | 1-2시간 | 낮음 |
| Task 2 | `startListening()` 가드 추가 | 2-4시간 | 낮음 |
| Task 3 | 테스트 추가 (플래그 on/off 케이스) | 2-4시간 | 낮음 |

**Task 4는 Phase 2로 분리 권장** (별도 계획 문서 필요)

### 버전
- Target Release: **1.0.193**

---

## Revision History

| 날짜 | 리비전 | 변경 내용 |
|------|--------|----------|
| 2026-01-11 | Initial | 초기 검토 완료 |
