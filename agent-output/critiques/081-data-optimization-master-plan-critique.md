---
ID: 081
Origin: 081
UUID: f2e8a193
Status: Active
---

# Critique 081: DB 전체 개선 3등분 계획 검증

> **Plan**: [plan-081-data-optimization-master-plan.md](../planning/plan-081-data-optimization-master-plan.md)
> **Critic Mode**: CODE
> **Date**: 2026-01-09

---

## 1. 계획 검증 결과

### ✅ 적절한 점

| 항목 | 이유 |
|------|------|
| **Value Statement 명확** | "Firebase 동기화가 효율적으로 작동하여 네트워크 비용 90% 절감"은 측정 가능한 목표 |
| **Phase 분리 원칙** | 기반 인프라 → 핵심 구현 → 통합 마무리 순서가 논리적 |
| **기존 패턴 존중** | `withFirebaseSync` 래퍼 확장, 기존 `SyncStrategy<T>` 호환 유지 |
| **Feature Flag 계획** | `systemState` 테이블 사용으로 localStorage 금지 규칙 준수 |
| **롤백 전략 명시** | 각 Phase별 롤백 트리거와 방법 정의됨 |
| **해시 캐시 활용** | 기존 `lastSyncHash` 패턴 재사용으로 중복 동기화 방지 |
| **테스트 전략** | 각 Phase별 테스트 스위트 및 E2E 시나리오 포함 |

### ⚠️ 개선 필요

| 항목 | 문제점 | 개선안 |
|------|--------|--------|
| **B-1 마이그레이션 복잡도** | `weeklyGoalsV2/{goalId}` 신규 경로 도입은 이중 경로 관리 부담 | **개선안**: 같은 경로 유지하고 데이터 구조만 변경 (`weeklyGoals/{goalId}` → 배열이 아닌 개별 문서) |
| **A-3 ItemStrategy 중복** | `weeklyGoalStrategy` + `weeklyGoalItemStrategy` 두 개 유지는 DRY 위반 | **개선안**: `ItemSyncStrategy<T>`가 기존 Strategy를 확장하므로, 하나의 Strategy만 정의하고 런타임에 mode 선택 |
| **C-1 배치 크기 미정** | "초기값 10, 성능 측정 후 조정"은 너무 모호 | **개선안**: 배치 크기는 시간 기반(300ms 윈도우)으로 변경하고, 최대 개수는 50으로 제한 |
| **Debounce 데이터 유실** | `beforeunload`는 비동기 작업 보장 안 함 | **개선안**: `visibilitychange` 이벤트도 추가하고, Dexie transaction 내에서 pending 상태 저장 |
| **templateRepository 동기화 부재** | 현재 `createTemplate`, `updateTemplate`, `deleteTemplate`에 Firebase 동기화 없음 | **개선안**: B-5에서 동기화 추가 시 기존 로컬 데이터와 충돌 해결 전략 명시 필요 |

### ❌ 수정 필요

| 항목 | 문제점 | 필수 수정안 | 심각도 |
|------|--------|-------------|--------|
| **B-6 누락된 의존성** | `deleteItemFromFirebase()` 정의가 B-6이지만, B-2, B-4, B-5에서 이미 사용 | B-6을 **A-2와 함께 Phase A로 이동** | HIGH |
| **B-3 Store 연동 순서** | `weeklyGoalStore`가 B-3이지만, B-2 Repository 변경과 동시에 진행해야 함 | B-2와 B-3을 **하나의 작업(B-2)으로 병합** | HIGH |
| **EventBus 배치 트리거 미정의** | `task:completedBatch`를 누가, 언제 emit하는지 불명확 | **배치 emit 로직을 Phase B에 추가** (예: `taskOperations.ts`에서 다중 완료 시 배치 emit) | MEDIUM |
| **마이그레이션 순서 오류** | B-1(마이그레이션)이 B-2~B-5(Repository 변경)보다 먼저이지만, 신규 경로는 Repository 변경 후에만 사용됨 | **B-1을 Phase B 마지막(B-7 이후)으로 이동**, 또는 마이그레이션을 Phase C로 이동 | CRITICAL |

---

## 2. 균형성 평가

| Phase | 점수 | 분석 |
|-------|------|------|
| **Phase A** | 8/10 | 적절한 기반 작업. 단, `deleteItemFromFirebase`가 B-6에 있어 불균형 |
| **Phase B** | 6/10 | 과도하게 많은 작업(17.5h). B-1 마이그레이션 복잡도가 과소평가됨. Store 연동이 분리되어 위험 |
| **Phase C** | 7/10 | 통합 작업으로 적절하나, 배치 이벤트 emit 로직이 누락됨 |

### 균형 조정 권고

```
현재: A(6.5h) : B(17.5h) : C(10h) = 19% : 51% : 30%
권장: A(8h) : B(14h) : C(12h) = 24% : 41% : 35%
```

**조정 사항**:
1. Phase A에 `deleteItemFromFirebase()` 추가 (+1h)
2. Phase A에 `removeItemFromFirebase()` 네이밍 일관성 검토 (+0.5h)
3. Phase B에서 마이그레이션(B-1)을 Phase C로 이동 (-3h)
4. Phase C에 마이그레이션 및 점진적 롤아웃 (+3h)
5. Phase C에 배치 emit 로직 추가 (+1h)

---

## 3. 의존성 검증

### ✅ 올바른 의존성

| From | To | 관계 |
|------|----|----|
| A-2 (syncItemToFirebase) | A-1 (ItemSyncStrategy) | 타입 의존 ✅ |
| A-3 (ItemStrategy 정의) | A-1, A-2 | 인터페이스 + 함수 사용 ✅ |
| B-2~B-5 (Repository 변경) | A-2, A-3 | Item Sync 함수/Strategy 사용 ✅ |
| C-1 (Subscriber 배치) | A-5 (Batch Event 타입) | 타입 의존 ✅ |
| C-2 (Debounce 적용) | A-4 (Debounced 래퍼) | 함수 사용 ✅ |

### ❌ 누락된 의존성

| From | To | 누락 이유 |
|------|----|----|
| B-2, B-4, B-5 | B-6 (`deleteItemFromFirebase`) | B-6이 B-2~B-5 이후에 정의되어 있으나, 삭제 기능은 먼저 필요 |
| C-1 (Subscriber 배치) | **배치 emit 로직** | 누가 `task:completedBatch`를 emit하는지 정의 없음 |
| B-2~B-5 | **충돌 해결 전략 결정** | 각 Repository별 충돌 해결 전략(LWW vs Merge) 명시 필요 |

### ⚠️ 불필요하거나 과도한 의존성

| From | To | 문제 |
|------|----|----|
| B-3 (Store 연동) | B-2 (Repository 변경) | **불필요한 분리**: Store와 Repository는 동시에 변경해야 안전. 분리 시 중간 상태에서 런타임 에러 가능 |

---

## 4. Atomic Runnability 검증

### Phase A 완료 후: ✅ **시스템 정상 동작**

| 구성요소 | 상태 | 이유 |
|----------|------|------|
| 기존 `syncToFirebase()` | ✅ 동작 | 변경 없음 |
| 기존 Repository | ✅ 동작 | 신규 함수 호출 안 함 |
| 신규 `syncItemToFirebase()` | ⚪ 미사용 | export만 됨, 호출 없음 |
| 테스트 | ✅ 통과 예상 | 기존 315개 + 신규 테스트 |

**결론**: Phase A는 **안전한 Atomic Point** ✅

---

### Phase B 완료 후: ⚠️ **조건부 동작**

| 구성요소 | 상태 | 위험 |
|----------|------|------|
| weeklyGoalRepository | ✅ 동작 | Item Sync로 전환됨 |
| weeklyGoalStore | ⚠️ 주의 | B-3이 B-2 직후 완료되어야 함 |
| inboxRepository | ✅ 동작 | Item Sync로 전환됨 |
| templateRepository | ✅ 동작 | 첫 Firebase 동기화 추가 |
| Firebase 데이터 경로 | ⚠️ 위험 | **마이그레이션 미완료 시 신규 경로 데이터 없음** |

**Critical Issue**: B-1(마이그레이션)이 Phase B 첫 번째지만, 실제로는 Repository 변경(B-2~B-5) 완료 후에 마이그레이션해야 기존 클라이언트 호환성 유지.

**결론**: Phase B 순서 재조정 필요. **현재 순서로는 Atomic Point 보장 안 됨** ❌

---

### Phase C 완료 후: ✅ **시스템 최적화 완료**

| 구성요소 | 상태 | 이유 |
|----------|------|------|
| EventBus 배치 처리 | ✅ 동작 | Feature Flag로 제어 가능 |
| Sync Debounce | ✅ 동작 | Feature Flag로 제어 가능 |
| Feature Flag 시스템 | ✅ 동작 | systemState에 저장 |
| 성능 목표 | ✅ 측정 가능 | E2E 테스트 포함 |

**결론**: Phase C는 Feature Flag로 롤백 가능한 **안전한 Atomic Point** ✅

---

## 5. 리스크 재평가

| 리스크 | 계획 평가 | 재평가 | 이유 |
|--------|----------|--------|------|
| **Firebase 마이그레이션 데이터 유실** | 🔴 Critical | 🔴 **Critical 유지** | V2 경로 도입 시 롤백 복잡도 증가. 같은 경로 유지 권장 |
| **Store 반환 타입 오류** | 🟠 High | 🔴 **Critical 상향** | B-2와 B-3 분리로 중간 상태 위험 |
| **Debounce 데이터 유실** | 언급 없음 | 🟠 **High 추가** | `beforeunload`만으로는 비동기 작업 보장 안 됨 |
| **멀티 기기 충돌** | 🟠 High | 🟡 **Medium 하향** | 기존 LWW 로직 재사용으로 충분히 검증됨 |
| **templateRepository 첫 동기화** | 🟡 Medium | 🟡 **Medium 유지** | 로컬 데이터와 Firebase 데이터 병합 전략 명시 필요 |
| **EventBus 배치 emit 누락** | 언급 없음 | 🟠 **High 추가** | 배치 이벤트 타입만 있고 emit 로직 없음 |

### 신규 식별 리스크

| 리스크 | 심각도 | 설명 | 완화 방안 |
|--------|--------|------|----------|
| **Phase B 순서 오류** | 🔴 Critical | B-1(마이그레이션)이 B-2~B-5 전에 실행되면 신규 경로에 데이터 없음 | B-1을 Phase C로 이동하거나 Phase B 마지막으로 이동 |
| **deleteItemFromFirebase 누락** | 🟠 High | B-2, B-4, B-5에서 삭제 로직 필요하나 B-6에 정의됨 | Phase A로 이동 |
| **테스트 커버리지 부족** | 🟡 Medium | Repository 변경에 대한 통합 테스트가 B-7에만 있음 | 각 Repository 변경(B-2~B-5)에 개별 테스트 추가 |

---

## 6. 아키텍처 일관성 검토

### ✅ 기존 패턴 준수

| 패턴 | 적용 | 평가 |
|------|------|------|
| Repository → Dexie → Firebase | ✅ | 기존 데이터 플로우 유지 |
| `withFirebaseSync` 래퍼 | ✅ | 새 `withFirebaseSyncDebounced` 추가로 확장 |
| `SyncStrategy<T>` 패턴 | ✅ | `ItemSyncStrategy<T>`로 확장 (extends) |
| EventBus emit/subscribe | ✅ | 새 배치 이벤트 타입 추가 |
| Feature Flag in systemState | ✅ | localStorage 금지 규칙 준수 |

### ⚠️ 잠재적 위반

| 항목 | 문제 | 권장 |
|------|------|------|
| **weeklyGoalItemStrategy 중복** | `weeklyGoalStrategy`와 `weeklyGoalItemStrategy` 두 개 유지 | 하나의 Strategy로 통합, `getItemId` 선택적 |
| **Debounce 구현 위치** | `firebaseGuard.ts`에 추가하면 단일 책임 원칙 위반 가능 | 별도 `syncDebounce.ts` 파일 생성 권장 |
| **배치 emit 위치** | 계획에 명시 안 됨 | `taskOperations.ts` 또는 새 `batchEmitter.ts`에 로직 추가 |

---

## 7. 테스트 커버리지 검토

### Phase A 테스트

| 테스트 | 계획 | 평가 |
|--------|------|------|
| `syncItemToFirebase()` 단위 테스트 | ✅ A-6에 명시 | 적절 |
| `deleteItemFromFirebase()` 단위 테스트 | ❌ 누락 | B-6에서 언급되나 Phase A에서 필요 |
| `withFirebaseSyncDebounced()` 테스트 | ✅ A-6에 명시 | 적절 |
| 기존 테스트 315개 통과 | ✅ 명시 | 적절 |

### Phase B 테스트

| 테스트 | 계획 | 평가 |
|--------|------|------|
| Repository CRUD 테스트 | ✅ B-7에 명시 | **부족**: 각 Repository 변경(B-2~B-5) 직후 테스트 실행 권장 |
| 마이그레이션 전/후 호환성 | ✅ B-7에 명시 | 적절 |
| Firebase Emulator 테스트 | ✅ B-7에 명시 | 적절 |

### Phase C 테스트

| 테스트 | 계획 | 평가 |
|--------|------|------|
| 멀티 기기 시나리오 | ✅ C-4에 명시 | 적절 |
| 오프라인 시나리오 | ✅ C-4에 명시 | 적절 |
| 연속 작업 시나리오 | ✅ C-4에 명시 | 적절 |
| **배치 이벤트 emit 테스트** | ❌ 누락 | 배치 emit 로직 테스트 필요 |

---

## 8. Open Questions 검토

| # | 질문 | 계획 답변 | 평가 | 권장 |
|---|------|----------|------|------|
| 1 | 구 경로 데이터 보존 기간? | 2주 | ⚠️ | **4주 권장** (모바일 앱 업데이트 주기 고려) |
| 2 | Debounce 중 오프라인 전환 처리? | 즉시 flush → retryQueue | ✅ | 적절 |
| 3 | EventBus 배치 크기 최적값? | 초기값 10 | ⚠️ | **시간 기반(300ms 윈도우) + 최대 50개 권장** |
| 4 | 템플릿 동기화 충돌 전략? | LWW | ✅ | 적절 |

### 미해결 질문 추가

| # | 질문 | 권장 답변 |
|---|------|----------|
| 5 | 배치 이벤트 emit 위치? | `taskOperations.ts`의 `completeMultipleTasks` 함수 |
| 6 | V2 경로 vs 동일 경로? | **동일 경로 유지** (배열 → 개별 문서 구조 변경만) |
| 7 | `deleteItemFromFirebase` Phase 위치? | **Phase A로 이동** |

---

## 9. 최종 권고

### 계획 승인 여부: ⚠️ **조건부 승인**

### 필수 조정 사항 (CRITICAL/HIGH)

1. **[CRITICAL] B-1 마이그레이션 순서 변경**
   - B-1을 Phase B 마지막(B-7 이후)으로 이동
   - 또는 Phase C 첫 번째(C-0)로 이동
   - 이유: Repository 변경 후 마이그레이션해야 기존 클라이언트 호환성 유지

2. **[HIGH] B-6 deleteItemFromFirebase를 Phase A로 이동**
   - A-2 (syncItemToFirebase) 직후에 A-2b로 추가
   - 이유: B-2, B-4, B-5에서 삭제 로직 필요

3. **[HIGH] B-2와 B-3 병합**
   - weeklyGoalRepository와 weeklyGoalStore를 동시에 변경
   - 이유: 분리 시 중간 상태에서 런타임 에러 가능

4. **[HIGH] 배치 emit 로직 추가**
   - Phase C-1 전에 배치 emit 로직 정의 필요
   - 권장 위치: `taskOperations.ts` 또는 별도 `batchEmitter.ts`

### 권장 조정 사항 (MEDIUM/LOW)

5. **[MEDIUM] V2 경로 대신 동일 경로 구조 변경 권장**
   - `weeklyGoals` 배열 → `weeklyGoals/{goalId}` 개별 문서
   - 이유: 이중 경로 관리 부담 감소

6. **[MEDIUM] Debounce에 visibilitychange 이벤트 추가**
   - `beforeunload`만으로는 비동기 작업 보장 안 됨

7. **[LOW] ItemStrategy 중복 제거**
   - 하나의 Strategy로 통합, `getItemId` 선택적 필드로

---

## 10. 수정된 Phase 구조 권고

```
Phase A (기반) ~8h
├── A-1: ItemSyncStrategy 인터페이스 정의
├── A-2a: syncItemToFirebase() 구현
├── A-2b: deleteItemFromFirebase() 구현 ← [이동]
├── A-3: Item Strategy 정의
├── A-4: withFirebaseSyncDebounced() 래퍼
├── A-5: EventBus 배치 이벤트 타입
└── A-6: Phase A 테스트 스위트

Phase B (핵심 구현) ~14h
├── B-2: weeklyGoalRepository + weeklyGoalStore (병합)
├── B-3: inboxRepository Single Item Sync
├── B-4: templateRepository Firebase 동기화 추가
├── B-5: Repository 재조회 제거 최적화
├── B-6: 배치 emit 로직 구현 ← [추가]
└── B-7: Phase B 테스트 업데이트

Phase C (통합 마무리) ~12h
├── C-0: Firebase 마이그레이션 실행 ← [이동]
├── C-1: EventBus Subscriber 배치 처리
├── C-2: Sync Debounce 적용
├── C-3: Feature Flag 시스템
├── C-4: E2E 테스트
├── C-5: 성능 측정
└── C-6: 문서화
```

---

## Changelog

| 날짜 | 변경자 | 내용 |
|------|--------|------|
| 2026-01-09 | Critic | 초안 작성 - Plan 081 비판적 검토 완료 |

