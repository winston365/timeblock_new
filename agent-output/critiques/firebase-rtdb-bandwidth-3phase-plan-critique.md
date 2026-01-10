---
ID: 081
Origin: 081
UUID: c9d3f7a2
Status: OPEN
---

# Critique: Firebase RTDB 대역폭 최적화 3-Phase 계획

> **대상 계획**: 사용자 제시 3-Phase 계획 (deviceId 필터, 개별 아이템 업로드, 레거시 경로 제거)  
> **관련 문서**: Plan 081 (Data Optimization Master Plan)  
> **검토일**: 2026-01-10  
> **상태**: Initial

---

## Changelog

| 날짜 | Handoff | 요청 | 요약 |
|------|---------|------|------|
| 2026-01-10 | User | 3-Phase 계획 검토 | 초기 검토 완료, CRITICAL 이슈 4건 발견 |

---

## Value Statement Assessment

> **As a** TimeBlock 사용자,  
> **I want** Firebase 동기화가 효율적으로 작동하여,  
> **So that** 네트워크 비용이 절감되고 앱이 더 빠르게 반응합니다.

✅ **Value Statement 존재**: 명확한 문제 정의 (3.4MB 스토리지 vs 100MB+ 다운로드)  
✅ **정량적 목표 암시**: 대역폭 과다 사용 해결  
⚠️ **개선 필요**: 구체적인 성공 지표 (예: "1시간 idle 시 < 5MB 다운로드") 명시 필요

---

## 1. 균형 평가

| Phase | 평가 | 이유 |
|-------|------|------|
| **A** (인프라) | ⚠️ 조정필요 | 3개 태스크(A-1~A-3)가 있으나, itemSync.ts가 **이미 존재**함. A-3은 기존 코드 확장으로 충분 |
| **B** (핵심) | ❌ 조정필요 | 6개 태스크(B-1~B-6)로 **편중**. deviceId 필터(B-1~B-3)와 아이템 업로드(B-4~B-6) 분리 필요 |
| **C** (마무리) | ✅ OK | 3개 태스크(C-1~C-3)로 적절. 단, C-1(레거시 경로 제거)은 **Phase A 이후 즉시 가능** |

### 균형 재조정 권장안

```
현재:  Phase A (3개) → Phase B (6개) → Phase C (3개)
권장:  Phase A (4개) → Phase B (4개) → Phase C (4개)
```

**Phase A 확장**:
- A-1: deviceId 필터 유틸리티 함수 → **기존 코드 재사용 가능** (readDeviceId 이미 존재)
- A-2: 리스너 레지스트리 에코 방지 옵션 → 신규
- A-3: 개별 아이템 동기화 인프라 → **itemSync.ts 이미 존재** (FEATURE_FLAG만 활성화 필요)
- A-4 (추가): **레거시 경로 리스너 제거** (C-1에서 이동)

**Phase B 축소 및 분리**:
- B-1~B-3: deviceId 필터 추가 (templates, shopItems, globalInbox)
- B-4: SyncEngine의 컬렉션 업로드 → itemSync 전환 (templates, shopItems, globalInbox 동시 적용)

**Phase C 재구성**:
- C-1: 대역폭 모니터링 UI (개발 모드)
- C-2: 성능 측정 및 검증
- C-3: 테스트 추가 (deviceId 필터 + itemSync 통합 테스트)
- C-4: 문서화

---

## 2. 의존성 검증

### 의존성 그래프 분석

```
┌─────────────────────────────────────────────────────────────────────┐
│ 사용자 제시 계획                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Phase A                                                            │
│  ┌────────┐     ┌────────┐     ┌────────┐                           │
│  │  A-1   │────▶│  A-2   │────▶│  A-3   │                           │
│  │ 유틸리티│     │ 레지스트│     │ itemSync│                          │
│  └────────┘     │ 리 옵션 │     │ 확장   │                           │
│                 └────────┘     └────────┘                           │
│                                    │                                │
│                                    ▼                                │
│  Phase B                                                            │
│  ┌────────┐  ┌────────┐  ┌────────┐                                │
│  │ B-1~3  │  │ B-4~6  │◀─┤ A-3    │                                │
│  │deviceId│  │ 개별   │  │ 의존   │                                │
│  │ 필터   │  │ 업로드 │  │        │                                │
│  └────────┘  └────────┘  └────────┘                                │
│       │           │                                                │
│       │           │                                                │
│       ▼           ▼                                                │
│  Phase C                                                            │
│  ┌────────┐  ┌────────┐  ┌────────┐                                │
│  │  C-1   │  │  C-2   │  │  C-3   │                                │
│  │레거시  │  │ 모니터 │  │ 테스트 │                                │
│  │ 제거   │  │ 링 UI  │  │        │                                │
│  └────────┘  └────────┘  └────────┘                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 문제점

| # | 의존성 이슈 | 심각도 | 설명 |
|---|------------|--------|------|
| 1 | **B-1~3 ↔ B-4~6 독립성** | 🟡 Medium | deviceId 필터와 개별 업로드는 **독립적** 문제. 분리 가능 |
| 2 | **C-1 조기 실행 가능** | 🟢 Low | 레거시 경로 제거는 Phase B 완료 전에 가능 (데이터가 없으면 영향 없음) |
| 3 | **A-3 ↔ Plan 081 중복** | 🔴 Critical | itemSync.ts가 **이미 구현됨**. Plan 081의 Phase A와 중복 |

### 의존성 검증 결과

⚠️ **문제 발견**: 사용자 제시 계획과 **기존 Plan 081이 다른 문제를 해결**하고 있음

| 측면 | 사용자 제시 계획 | Plan 081 |
|------|-----------------|----------|
| **주요 문제** | 다운로드 에코 (deviceId 필터 누락) | 업로드 비효율 (컬렉션 전체 sync) |
| **근본 원인** | 리스너가 자기 업로드를 다시 다운로드 | Repository가 toArray() 후 전체 업로드 |
| **해결 방향** | 리스너에 deviceId 필터 추가 | Item-level sync로 전환 |

**권장**: 두 계획을 **병합**하여 완전한 해결책 마련

---

## 3. Atomic Runnability

### Phase A 완료 후

| 상태 | 평가 | 이유 |
|------|------|------|
| **인프라** | ✅ OK | 새 함수/유틸리티가 기존 코드에 영향 없음 |
| **리스너** | ✅ OK | 레지스트리 옵션 추가만으로 기존 동작 불변 |
| **테스트** | ⚠️ 주의 | 신규 유틸리티 테스트 필수 |

**결론**: ✅ Phase A 완료 후 시스템 정상 동작

### Phase B 완료 후

| 상태 | 평가 | 이유 |
|------|------|------|
| **deviceId 필터** | ✅ OK | 필터 추가는 기존 동작을 깨뜨리지 않음 |
| **개별 업로드** | ⚠️ 주의 | SyncEngine Dexie Hook 수정 필요 (rollback 준비) |
| **데이터 일관성** | ❌ 위험 | 레거시 경로와 신규 경로 **dual-write 없으면 데이터 불일치** |

**결론**: ⚠️ Phase B 완료 후 **rollback 시나리오 명시 필요**

### Phase C 완료 후

| 상태 | 평가 | 이유 |
|------|------|------|
| **레거시 제거** | ⚠️ 주의 | 모든 클라이언트 업데이트 확인 필요 (단일 사용자면 OK) |
| **모니터링** | ✅ OK | 개발 모드 전용, 프로덕션 영향 없음 |
| **테스트** | ✅ OK | 회귀 방지 |

**결론**: ✅ Phase C 완료 후 시스템 정상 동작 (단, 레거시 제거 타이밍 주의)

---

## 4. 추가 리스크

### Critical (즉시 해결 필요)

| # | 리스크 | 상태 | 설명 | 영향 | 권장 조치 |
|---|--------|------|------|------|----------|
| 1 | **Plan 081과 중복** | OPEN | itemSync.ts 이미 존재. A-3 재작업은 낭비 | 시간 낭비 | A-3을 "itemSync 활성화"로 변경 |
| 2 | **SyncEngine Hook 위치 오류** | OPEN | 사용자가 언급한 "index.ts"는 **Hook 등록부**, 리스너는 listener.ts | 잘못된 수정 위치 | B-4~6은 **index.ts의 registerHooks**를 수정해야 함 |
| 3 | **에코 원인 불완전** | OPEN | deviceId 필터 외에 **Dexie Hook → Firebase → 리스너** 루프도 존재 | 부분 해결 | SyncEngine의 `isSyncingFromRemote` 플래그 확인 필요 |
| 4 | **테스트 누락** | OPEN | B-1~3 (deviceId 필터) 테스트 케이스 미정의 | 회귀 위험 | 테스트 케이스 명시 |

### High

| # | 리스크 | 상태 | 설명 | 영향 | 권장 조치 |
|---|--------|------|------|------|----------|
| 5 | **레거시 경로 데이터 여부 불명** | OPEN | `shopItems/all/data`와 `globalInbox/all/data`에 실제 데이터가 있는지 확인 필요 | 불필요한 리스너 유지 또는 데이터 유실 | Firebase Console에서 확인 |
| 6 | **Rollback 시나리오 누락** | OPEN | Phase B 실패 시 복구 절차 미정의 | 프로덕션 장애 대응 불가 | Rollback 시나리오 추가 |

### Medium

| # | 리스크 | 상태 | 설명 | 영향 | 권장 조치 |
|---|--------|------|------|------|----------|
| 7 | **성능 측정 기준 미정** | OPEN | "100MB+ 다운로드"의 측정 방법 미명시 | 개선 효과 검증 불가 | Firebase Console Bandwidth 또는 DevTools Network 사용 |
| 8 | **completedInbox 누락** | OPEN | 사용자 계획에 completedInbox deviceId 필터 언급 없음 | 일부 에코 잔존 | B-1~3에 completedInbox 추가 |

---

## 5. 개선안

### 개선안 1: Plan 081과 통합

**현재 상황**:
- Plan 081: Upload 최적화 (Item-level sync)
- 사용자 계획: Download 최적화 (deviceId 필터)

**권장**: 두 계획을 **하나의 대역폭 최적화 계획**으로 통합

```
┌─────────────────────────────────────────────────────────────────────┐
│ 통합 대역폭 최적화 계획                                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Phase A: 인프라 및 Quick Win                                       │
│  ├── A-1: deviceId 필터 유틸리티 (readDeviceId 재사용)               │
│  ├── A-2: 레거시 경로 리스너 제거 (즉시 대역폭 50% 감소 가능)        │
│  ├── A-3: templates/shopItems/globalInbox 리스너에 deviceId 추가    │
│  └── A-4: FEATURE_FLAGS.ITEM_SYNC_ENABLED = true 활성화             │
│                                                                     │
│  Phase B: 핵심 로직 전환                                            │
│  ├── B-1: SyncEngine templates Hook → itemSync 전환                 │
│  ├── B-2: SyncEngine shopItems Hook → itemSync 전환                 │
│  ├── B-3: SyncEngine globalInbox Hook → itemSync 전환               │
│  └── B-4: 대역폭 모니터링 훅 추가 (개발 모드)                        │
│                                                                     │
│  Phase C: 검증 및 마무리                                            │
│  ├── C-1: 통합 테스트 (에코 방지 + Item Sync)                       │
│  ├── C-2: 성능 측정 (Firebase Console + DevTools)                  │
│  ├── C-3: Feature Flag 기반 롤아웃                                  │
│  └── C-4: 문서화 및 CHANGELOG                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 개선안 2: Quick Win 우선 실행

**즉시 효과 (코드 변경 최소)**:
1. **레거시 경로 리스너 제거**: `shopItems/all/data`, `globalInbox/all/data` 리스너 제거
   - 영향: 데이터가 없으면 **즉시 대역폭 ~50% 감소** (중복 다운로드 제거)
   - 리스크: 낮음 (레거시 데이터가 없다면)

2. **deviceId 필터 추가 (3줄 변경)**:
   ```typescript
   // listener.ts - Templates Listener
   const syncData = snapshot.val() as unknown;
   if (readDeviceId(syncData) === deviceId) return; // 이 줄 추가
   ```

### 개선안 3: 명확한 롤백 시나리오 추가

각 Phase에 다음 추가:

```markdown
### Phase B 롤백 시나리오

**트리거**: 
- [ ] Firebase 쓰기 실패율 > 5%
- [ ] 데이터 불일치 발생
- [ ] 앱 크래시 발생

**롤백 절차**:
1. Feature Flag OFF: `FEATURE_FLAGS.ITEM_SYNC_ENABLED = false`
2. 기존 컬렉션 전체 업로드 로직 자동 활성화
3. 모니터링: 24시간 대역폭 정상화 확인

**영향 범위**: SyncEngine registerHooks 함수만
```

### 개선안 4: 성공 지표 명확화

| 지표 | 현재 | 목표 | 측정 방법 |
|------|------|------|----------|
| Idle 1시간 다운로드 | 100MB+ | < 10MB | Firebase Console → Usage → Bandwidth |
| 에코 발생률 | 측정 필요 | 0% | SyncLog에서 동일 데이터 업/다운로드 비교 |
| Firebase 쓰기 횟수 | 기준 | -50% | Firebase Console → Usage → Database |

---

## 6. Unresolved Open Questions

사용자 계획에서 다음 항목들이 **명확히 해결되지 않음**:

| # | Open Question | 상태 | 권장 답변 |
|---|---------------|------|----------|
| 1 | 레거시 경로에 실제 데이터가 있는가? | ⏳ OPEN | Firebase Console 확인 필요 |
| 2 | completedInbox는 왜 계획에서 제외되었는가? | ⏳ OPEN | 이미 deviceId 필터가 있어서 제외된 것으로 추정 (확인 필요) |
| 3 | Plan 081과 어떻게 조율할 것인가? | ⏳ OPEN | 통합 또는 순차 실행 결정 필요 |
| 4 | 성공 기준은 무엇인가? | ⏳ OPEN | 정량적 목표 설정 필요 (예: < 10MB/hour idle) |

---

## 7. Risk Assessment

### 종합 리스크 점수

| 영역 | 점수 | 이유 |
|------|------|------|
| 기술적 복잡도 | 🟢 Low | deviceId 필터 추가는 단순, itemSync는 이미 구현됨 |
| 데이터 안전성 | 🟡 Medium | 레거시 경로 제거 시 확인 필요 |
| 롤백 가능성 | 🔴 High | Rollback 시나리오 미정의 |
| 테스트 커버리지 | 🟡 Medium | 신규 테스트 케이스 필요 |
| Plan 081 조율 | 🔴 High | 중복 작업 위험 |

---

## 8. Recommendations

### 즉시 조치 (Before Implementation)

1. **Firebase Console 확인**: `shopItems/all/data`, `globalInbox/all/data` 경로에 데이터 존재 여부 확인
2. **Plan 081과 조율**: 통합 또는 순차 실행 결정
3. **성공 지표 정의**: 정량적 목표 설정

### 계획 수정 권장 사항

1. **A-3 수정**: "개별 아이템 동기화 인프라" → "itemSync Feature Flag 활성화"
2. **C-1 이동**: "레거시 경로 리스너 제거"를 Phase A로 이동 (Quick Win)
3. **롤백 시나리오 추가**: 각 Phase에 롤백 절차 명시
4. **테스트 케이스 명시**: B-1~3에 대한 구체적 테스트 시나리오 추가

---

## 9. 최종 권고

### ❌ 수정 필요

**이유**:
1. Plan 081과의 **중복/충돌 해결 필요**
2. **롤백 시나리오 누락**
3. **성공 지표 미정의**
4. **레거시 경로 데이터 확인 필요** (존재 여부에 따라 계획 변경)

**추천 다음 단계**:
1. Firebase Console에서 레거시 경로 데이터 확인
2. Plan 081 Planner와 조율하여 통합 계획 작성
3. 성공 지표 및 롤백 시나리오 추가 후 재검토 요청

---

## Revision History

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-01-10 | 1.0 | 초기 검토 완료 |
