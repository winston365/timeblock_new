# Critique: 템플릿 자동화 11개 항목 분석

| 항목 | 값 |
|------|-----|
| **Artifact** | [026-template-automation-11items-analysis.md](../analysis/026-template-automation-11items-analysis.md) |
| **Analysis Reference** | [023-template-feature-analysis.md](../analysis/023-template-feature-analysis.md), [024-template-improvements-15-proposals-critique.md](./024-template-improvements-15-proposals-critique.md) |
| **Date** | 2025-12-23 |
| **Status** | Initial Review |
| **Critic** | Eunha (Critic Mode) |

---

## Changelog

| Date | Handoff | Request | Summary |
|------|---------|---------|---------|
| 2025-12-23 | User → Critic | 11개 항목 비판적 검토 + 안전한 변경 순서/리스크 완화책 제시 | 초기 검토 완료 |

---

## 1. Value Statement 평가

**상태: ✅ 충족**

> "템플릿 기반 작업 생성(수동/자동)을 한 곳에서 신뢰성 있게 제어하고, ADHD 사용자가 실수를 줄이면서 빠르게 오늘 할 일을 만들 수 있도록..."

- **강점**: ADHD 사용자 중심 가치 명시, 11개 개선 항목과 코드 위치 매핑 완료
- **약점**: 각 항목별 "구현 후 검증 기준"이 없어 완료 정의가 모호

---

## 2. 🔴 가장 위험한 변경 TOP 3

### 🚨 위험 1: 단일 파이프라인 통합 (#1) - `unifiedTaskService` vs `dailyDataStore` 선택

| 측면 | 분석 |
|------|------|
| **현재 상태** | AppShell + GlobalModals에서 `dailyDataStore.addTask()` 직접 호출 (중복 코드 존재) |
| **unifiedTaskService 경로** | Task 위치 자동 감지(daily/inbox) + Store 자동 refresh. 하지만 **addTask 없음** (update/delete/toggle만 존재) |
| **dailyDataStore 경로** | 현재 방식. 하지만 **XP/퀘스트 핸들러가 다른 경로**에서 호출됨 (TaskCompletionPipeline) |
| **핵심 리스크** | unifiedTaskService에 `addTask` 추가 시 XP/퀘스트 핸들러 통합 필요. 누락 시 **게임화 파이프라인 깨짐** |

**🎯 판정**: 
- `dailyDataStore.addTask()` 유지가 **더 안전**
- 이유: XP 핸들러는 Task **완료** 시점에 발동하므로 생성 시점에는 관련 없음
- 단, `createTaskFromTemplate()` → `dailyDataStore.addTask()` 경로를 **하나의 헬퍼 함수로 통합**하여 중복 제거 필요

```
권장: src/shared/services/task/templateTaskService.ts 신규 생성
- createAndAddTaskFromTemplate(template) → Task 생성 + addTask + 퀘스트 진행 일괄 처리
```

---

### 🚨 위험 2: 자동생성 트리거 (#2) - 부팅 시 1회 보장의 함정

| 측면 | 분석 |
|------|------|
| **현재 흐름** | `gameStateStore.loadData()` → `lastLogin !== today`일 때만 `initializeNewDayInRepo()` → `generateTasksFromAutoTemplates()` |
| **중복 방지** | `templateRepository`에서 `lastGeneratedDate` 체크 + Firebase `lastTemplateGeneration` 이중 체크 |
| **레이스 컨디션** | 앱 초기화 중 `loadData()`가 비동기로 실행되면서 다른 컴포넌트가 먼저 렌더링될 수 있음 |
| **시간대 경계** | `getLocalDate()`가 자정 직전/직후에 호출되면 날짜 판정이 흔들릴 수 있음 (로컬 시간 기준) |

**🎯 중복 위험 시나리오**:
1. 11:59 PM에 앱 실행 → `lastLogin = 2025-12-22` → 자동생성 발동
2. 12:01 AM에 앱 재시작 → `lastLogin = 2025-12-22` ≠ `today(2025-12-23)` → **또 발동** (lastGeneratedDate 체크로 막힘)
3. 하지만 Firebase `lastTemplateGeneration`이 네트워크 지연으로 아직 sync 안 됐으면? → **중복 생성 가능**

**🎯 판정**:
- "부팅 시 1회 보장"을 추가하려면 **Dexie systemState에 `template:lastExecutionDate` 키 추가** 필요
- 이 키는 **로컬에서만** 체크하여 네트워크 레이스를 차단
- 기존 `lastGeneratedDate`는 템플릿별이므로 충분하지 않음

```
권장 순서:
1. SYSTEM_KEYS.TEMPLATE_LAST_EXECUTION_DATE 추가 (systemRepository.ts)
2. generateTasksFromAutoTemplates() 시작 시 이 키 체크
3. 성공 완료 시 이 키에 today 저장
4. Firebase 체크는 "보조 수단"으로만 사용
```

---

### 🚨 위험 3: 진입점 통합 (#6) - TemplatePanel 제거/대체/통합 결정

| 옵션 | RoI | 리스크 | 권장 |
|------|-----|--------|------|
| **A. 제거** | 🟢 높음 (부채 제거) | 🟢 낮음 | ✅ **권장** |
| **B. 대체 (TemplatesModal로)** | 🟡 중간 | 🟡 중간 (네비게이션 플로우 변경) | ⚠️ 조건부 권장 |
| **C. 통합 (기능 병합)** | 🔴 낮음 | 🔴 높음 (두 경로 유지보수) | ❌ 비권장 |

**현재 상태 확인**:
```tsx
// TemplatePanel.tsx - 마운트되지 않음 (grep 결과)
// - 리포지토리 직접 호출: loadTemplates(), deleteTemplate()
// - useState로 로컬 상태 관리
// - useTemplateStore 사용 안 함
```

```tsx
// TemplatesModal.tsx - GlobalModals에서 렌더링됨
// - useTemplateStore 사용
// - 메인 진입점
```

**🎯 판정**: 
- TemplatePanel은 **사이드바용으로 설계**되었으나 현재 마운트되지 않음
- TemplatesModal이 **유일한 활성 진입점**
- **옵션 A(제거) 권장**: 데드코드 제거로 유지보수 부담 감소

```
권장 순서:
1. TemplatePanel.tsx를 deprecated 폴더로 이동 (git history 보존)
2. TemplatesModal이 유일한 진입점임을 문서화
3. 향후 사이드바 필요 시 TemplatesModal 기반으로 새로 구현
```

---

## 3. ✅ 빠른 승리 5개 유지 여부

| # | 항목 | 유지? | 수정 제안 |
|---|------|-------|----------|
| **#7** | 폼 검증 (Zod 도입) | ✅ 유지 | Zod 범위를 **TemplateModal 3단계 폼 전체**로 한정. `templateSchema`를 `src/shared/schemas/template.ts`에 정의 |
| **#8** | systemState 정렬/필터 저장 | ✅ 유지 | 키 네이밍: `template:sortOrder`, `template:filters`. defaults.ts에 기본값 추가 |
| **#10** | 폼 UX 정리 | ✅ 유지 | #7과 함께 진행. 인라인 에러 메시지 + optional chaining 보강 |
| **#11** | 카드 요약 개선 | ✅ 유지 | 순수 UI 작업. 우선순위 높음 |
| **#3** | 미리보기 인라인 패널 | ⚠️ 조건부 | 모달 중첩 금지 정책과 **충돌 없음 확인됨** (인라인이므로). 단, TemplatesModal 내부 레이아웃 변경 필요 |

### #3 미리보기 인라인 패널 - 상세 검토

| 측면 | 분석 |
|------|------|
| **모달 중첩 금지** | 인라인 패널은 **모달 내부 확장**이므로 중첩이 아님 ✅ |
| **구현 복잡도** | TemplatesModal 레이아웃을 2-column으로 변경 필요 (좌: 리스트, 우: 프리뷰) |
| **UX 가치** | ADHD 사용자에게 "클릭 전 미리보기"는 **결정 피로 감소**에 효과적 |
| **판정** | ✅ 진행 권장. 단, 모바일 반응형 고려 필요 |

---

## 4. 📋 권장 구현 순서 (6단계)

### Phase 0: 선행 정리 (Day 1)

| Step | 작업 | 근거 |
|------|------|------|
| 0.1 | `SYSTEM_KEYS.TEMPLATE_SORT_ORDER` 추가 | #8 선행 |
| 0.2 | `SYSTEM_KEYS.TEMPLATE_FILTERS` 추가 | #8 선행 |
| 0.3 | `SYSTEM_STATE_DEFAULTS`에 기본값 추가 | defaults.ts 정책 준수 |
| 0.4 | TemplatePanel.tsx → `deprecated/` 이동 | #6 완료 |

### Phase 1: Quick Wins UI (Day 2-3)

| Step | 작업 | 의존성 |
|------|------|--------|
| 1.1 | #11 카드 요약 개선 | 없음 |
| 1.2 | #8 정렬/필터 systemState 연동 | 0.1-0.3 완료 |
| 1.3 | #10 폼 UX 인라인 에러 추가 | 없음 |

### Phase 2: Zod 검증 도입 (Day 4)

| Step | 작업 | 의존성 |
|------|------|--------|
| 2.1 | `src/shared/schemas/template.ts` 생성 | 없음 |
| 2.2 | #7 TemplateModal에 Zod 적용 | 2.1 |
| 2.3 | 검증 에러 → 인라인 메시지 연결 | 1.3, 2.2 |

### Phase 3: 자동생성 안정화 (Day 5-6)

| Step | 작업 | 의존성 |
|------|------|--------|
| 3.1 | `SYSTEM_KEYS.TEMPLATE_LAST_EXECUTION_DATE` 추가 | 없음 |
| 3.2 | `generateTasksFromAutoTemplates()` 중복 방지 로직 보강 | 3.1 |
| 3.3 | 단위 테스트: 중복 실행 방지, 시간대 경계 | 3.2 |

### Phase 4: 파이프라인 통합 (Day 7-8)

| Step | 작업 | 의존성 |
|------|------|--------|
| 4.1 | `templateTaskService.ts` 생성 | 없음 |
| 4.2 | AppShell/GlobalModals 핸들러를 templateTaskService로 대체 | 4.1 |
| 4.3 | 중복 코드 제거 검증 | 4.2 |

### Phase 5: 미리보기 패널 (Day 9-10)

| Step | 작업 | 의존성 |
|------|------|--------|
| 5.1 | TemplatesModal 2-column 레이아웃 | 없음 |
| 5.2 | 인라인 프리뷰 패널 구현 | 5.1 |
| 5.3 | 중복 감지 로직 추가 (선택) | 5.2 |

### Phase 6: 실행 로그 (#4) (선택적, 후속)

| Step | 작업 | 의존성 |
|------|------|--------|
| 6.1 | `SYSTEM_KEYS.TEMPLATE_EXECUTION_LOG` 정의 | 없음 |
| 6.2 | 로그 스키마 설계 | 6.1 |
| 6.3 | UI 구현 | 6.2 |

---

## 5. 🛡️ 되돌리기 전략/가드레일

### 5.1 Feature Flag 전략

```typescript
// src/shared/constants/featureFlags.ts
export const FEATURE_FLAGS = {
  /** 템플릿 자동생성 중복 방지 강화 */
  TEMPLATE_DUPE_GUARD_V2: true,
  
  /** 템플릿 미리보기 패널 */
  TEMPLATE_PREVIEW_PANEL: false, // 개발 중에는 false
  
  /** Zod 검증 활성화 */
  TEMPLATE_ZOD_VALIDATION: true,
} as const;
```

### 5.2 단위 테스트 포인트

| 테스트 파일 | 커버리지 포인트 |
|------------|-----------------|
| `template-auto-generation.test.ts` | 중복 실행 방지, 시간대 경계 (23:59 → 00:01), Firebase 실패 시 로컬 fallback |
| `template-task-service.test.ts` | createAndAddTaskFromTemplate 정상 동작, 퀘스트 진행 호출 확인 |
| `template-zod-validation.test.ts` | 필수 필드 누락, intervalDays < 1, weeklyDays 빈 배열 케이스 |
| `template-system-state.test.ts` | 정렬/필터 저장/로드, 기본값 fallback |

### 5.3 Rollback 체크리스트

| 단계 | Rollback 조건 | 복구 방법 |
|------|---------------|----------|
| Phase 0 | deprecated 이동 후 참조 에러 발생 | git revert + import 복구 |
| Phase 2 | Zod 검증이 기존 유효 데이터 거부 | TEMPLATE_ZOD_VALIDATION → false |
| Phase 3 | 자동생성 안 됨 / 중복 생성 | SYSTEM_KEYS 체크 로직 우회 (기존 동작 복구) |
| Phase 4 | 템플릿→Task 생성 실패 | 기존 핸들러 코드 복구 (git history에서) |
| Phase 5 | 레이아웃 깨짐 | TEMPLATE_PREVIEW_PANEL → false |

### 5.4 systemState 키 스키마 제안

```typescript
// src/shared/constants/defaults.ts 추가분
export const TEMPLATE_SYSTEM_DEFAULTS = {
  /** 정렬 순서: 'daysUntilNext' | 'name' | 'lastGenerated' */
  sortOrder: 'daysUntilNext' as const,
  
  /** 필터 상태 */
  filters: {
    showAutoOnly: false,
    categoryFilter: null as string | null,
  },
  
  /** 마지막 실행 날짜 (YYYY-MM-DD) */
  lastExecutionDate: null as string | null,
} as const;

// 스키마 충돌 방지: 접두사 'template:' 사용
// - template:sortOrder
// - template:filters
// - template:lastExecutionDate
```

---

## 6. 🔍 Open Questions

| # | 질문 | 영향 범위 | 권장 조치 |
|---|------|----------|----------|
| 1 | TemplatePanel이 현재 마운트되지 않는 것이 **의도된 것**인가? | #6 결정 | 팀/사용자 확인 후 제거 진행 |
| 2 | 자동생성된 Task를 **인박스**에 둘지 **블록**에 둘지? | #2 구현 | 현재 로직 확인 필요 (template.timeBlock 기반 추정) |
| 3 | #4 실행 로그의 **보존 기간**은? | 스토리지 | 30일 권장, systemState에 저장 시 주기적 정리 로직 필요 |
| 4 | 미리보기 패널에서 **Task 수정**도 허용할지? | #3 UX | 초기 버전은 읽기 전용 권장 |

---

## 7. Risk Assessment

| 리스크 | 확률 | 영향 | 완화책 |
|--------|------|------|--------|
| 자동생성 중복 | 🟡 중 | 🔴 높 | Phase 3 선행, 단위 테스트 필수 |
| Zod 검증 기존 데이터 거부 | 🟢 낮 | 🟡 중 | feature flag + 마이그레이션 스크립트 |
| 파이프라인 변경 후 XP 누락 | 🟢 낮 | 🔴 높 | Phase 4 테스트 강화 |
| TemplatePanel 제거 후 regression | 🟢 낮 | 🟢 낮 | grep 검증 완료됨 (미사용 확인) |

---

## 8. Recommendations Summary

| 우선순위 | 권장 액션 |
|---------|----------|
| 1 | **Phase 0 즉시 실행**: systemState 키 추가, TemplatePanel deprecated 처리 |
| 2 | **Phase 1-2 병렬 진행**: Quick Wins UI + Zod 검증 (3-4일) |
| 3 | **Phase 3 별도 테스트**: 자동생성 중복 방지는 단위 테스트 커버리지 확보 후 머지 |
| 4 | **Phase 4-5 순차 진행**: 파이프라인 통합 → 미리보기 패널 |
| 5 | **Phase 6 보류**: 실행 로그는 핵심 기능 안정화 후 진행 |

---

## 9. Revision History

| Revision | Date | Artifact Changes | Findings Addressed | New Findings | Status Changes |
|----------|------|------------------|-------------------|--------------|----------------|
| Initial | 2025-12-23 | N/A | N/A | 위험3개, 권장순서6단계, 가드레일 정의 | Initial Review |

---

오빠, 분석 문서 비판적 검토 완료했어! 💕

**핵심 요약**:
1. **가장 위험한 건 자동생성 중복 문제** - Dexie systemState로 로컬 체크 추가해야 해
2. **TemplatePanel은 제거가 정답** - 이미 마운트 안 되고 있으니 부채만 늘어
3. **unifiedTaskService 대신 dailyDataStore 유지**가 더 안전해 - addTask 없으니까
4. **Quick Wins 5개는 다 진행 가능**하지만, Phase 0 선행 작업(systemState 키 추가)이 먼저야!

구현 순서 잘 따라가면 안전하게 개선할 수 있을 거야. 질문 있으면 언제든 물어봐! 🌟
