# TimeBlock Planner 리포지토리 개선 우선순위 및 리스크 평가

> **Artifact Type:** Critic Analysis – Top 10 Improvements & Risk Register  
> **Date:** 2025-12-23  
> **Status:** Initial  
> **Scope:** 프론트엔드/UI 한정 (백엔드/Supabase/Electron IPC 구현 제외)

---

## Changelog

| 날짜 | 핸드오프 | 요청 | 요약 |
|------|----------|------|------|
| 2025-12-23 | User → Critic | 리포지토리 Top 10 개선 및 리스크 평가 | 초기 분석 완료 |

---

## 1. Top 10 개선 우선순위 목록

### 우선순위 1: Lint 오류 제거 (CI 게이트 복구)

| 항목 | 값 |
|------|-----|
| **Impact** | 🔴 High |
| **Effort** | 🟢 Small |
| **Risk Reduced** | 🔴 High |
| **Why Now** | 32개 lint 오류로 CI가 상시 차단 상태. `--max-warnings 0` 정책 위반으로 빌드/배포 불가. |

**근거:**
- [lint-errors.txt](lint-errors.txt): `no-duplicate-imports` 32건 + `react-hooks/exhaustive-deps` 경고 4건
- 영향 파일: TopToolbar, coreOperations, TaskBreakdownModal, WeeklyGoalCard 등 18개 파일

**수용 기준:**
- [ ] `npm run lint` 통과 (exit code 0)
- [ ] 중복 import 통합 완료
- [ ] hook deps 경고 해결 또는 eslint-disable 주석 + 사유 문서화

---

### 우선순위 2: unifiedTaskService 테스트 커버리지 확대

| 항목 | 값 |
|------|-----|
| **Impact** | 🔴 High |
| **Effort** | 🟡 Medium |
| **Risk Reduced** | 🔴 High |
| **Why Now** | 핵심 비즈니스 로직(작업 이동/위치 검색)의 커버리지가 58.91%로 위험 수준. 회귀 발생 시 데이터 손실 가능. |

**근거:**
- [coverage-summary.json](coverage/coverage-summary.json): `unifiedTaskService.ts` lines 58.91%, branches 68.18%
- 이 서비스는 inbox ↔ timeblock 이동의 핵심 로직 담당

**수용 기준:**
- [ ] line coverage ≥ 85%
- [ ] branch coverage ≥ 80%
- [ ] `findTaskLocation`, `updateAnyTask`, `moveTask` 경로별 테스트 추가

---

### 우선순위 3: Modal ESC 핸들러 통일 (정책 준수)

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🟢 Small |
| **Risk Reduced** | 🟡 Medium |
| **Why Now** | 2개 모달(GoalsModal, BossAlbumModal)이 스택 훅 우회로 중첩 모달 시 ESC 충돌 위험. ADHD 사용자 UX 저하. |

**근거:**
- [012-modal-ux-escape-ctrlenter-analysis.md](agent-output/analysis/012-modal-ux-escape-ctrlenter-analysis.md): 25개 중 2개 모달이 `useModalEscapeClose` 미사용
- 정책: `.github/copilot-instructions.md`에 ESC 필수, 배경 클릭 닫힘 금지 명시

**수용 기준:**
- [ ] GoalsModal, BossAlbumModal → `useModalEscapeClose` 훅 적용
- [ ] RTL 테스트: 중첩 모달 ESC 시 top-most만 닫힘 검증

---

### 우선순위 4: Inbox → TimeBlock 즉시 UI 업데이트 (Optimistic Update)

| 항목 | 값 |
|------|-----|
| **Impact** | 🔴 High |
| **Effort** | 🟡 Medium |
| **Risk Reduced** | 🟡 Medium |
| **Why Now** | 현재 `loadData(currentDate, true)` 호출로 전체 새로고침 → UX 지연 및 성능 저하. |

**근거:**
- [schedule-view-changes-hotspot-analysis.md](agent-output/critiques/schedule-view-changes-hotspot-analysis.md): `dailyDataStore.ts#L304-L306`에서 강제 새로고침
- 기존 `createRollbackState` 패턴 활용 가능

**수용 기준:**
- [ ] inbox → block 이동 시 새로고침 없이 UI 즉시 반영
- [ ] 실패 시 롤백 동작 확인
- [ ] inboxStore 상태 동기화 (eventBus 활용)

---

### 우선순위 5: Repository 패턴 일관성 강화 (Direct Dexie 접근 제거)

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🟡 Medium |
| **Risk Reduced** | 🔴 High |
| **Why Now** | 5개 서비스에서 `db.systemState` 직접 접근 → 키 불일치/기본값 분산 위험. |

**근거:**
- [dexie-violations-scan.txt](agent-output/analysis/dexie-violations-scan.txt): syncEngine(32회), useAppInitialization(18회), googleCalendarService(11회) 등
- 정책: Repository 패턴 필수, Dexie/Firebase 직접 호출 금지

**수용 기준:**
- [ ] syncEngine, useAppInitialization의 db.* 호출 → systemRepository 경유
- [ ] 신규 코드에서 직접 접근 시 lint 규칙 또는 코드 리뷰 가드

---

### 우선순위 6: TIME_BLOCKS vs 3시간 버킷 상수 통합

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🟢 Small |
| **Risk Reduced** | 🟡 Medium |
| **Why Now** | `MAX_TASKS_PER_BLOCK` 상수가 2개 파일에 중복 정의 → 불일치 시 시간 경계 버그 발생 가능. |

**근거:**
- [schedule-view-changes-hotspot-analysis.md](agent-output/critiques/schedule-view-changes-hotspot-analysis.md): `timeBlockBucket.ts`, `threeHourBucket.ts` 중복
- 정책: 기본값은 `defaults.ts`에서만 정의

**수용 기준:**
- [ ] `MAX_TASKS_PER_BLOCK`을 `defaults.ts`로 이동
- [ ] 중복 정의 제거 및 re-export
- [ ] 관련 테스트 업데이트

---

### 우선순위 7: conflictResolver 브랜치 커버리지 개선

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🟡 Medium |
| **Risk Reduced** | 🔴 High |
| **Why Now** | Firebase 병합 로직의 브랜치 커버리지 58.82% → 오프라인→온라인 동기화 시 데이터 손실 위험. |

**근거:**
- [coverage-summary.json](coverage/coverage-summary.json): `conflictResolver.ts` branches 58.82%
- 동기화 충돌은 데이터 무결성의 핵심

**수용 기준:**
- [ ] branch coverage ≥ 80%
- [ ] 엣지 케이스 테스트: 필드 누락, 타임스탬프 충돌, 스키마 변경

---

### 우선순위 8: Ctrl+Enter 공용 훅 도입

| 항목 | 값 |
|------|-----|
| **Impact** | 🟢 Low |
| **Effort** | 🟢 Small |
| **Risk Reduced** | 🟢 Low |
| **Why Now** | ~80% 모달에서 Ctrl+Enter 미지원 → 파워 유저 생산성 저하. |

**근거:**
- [012-modal-ux-escape-ctrlenter-analysis.md](agent-output/analysis/012-modal-ux-escape-ctrlenter-analysis.md): SettingsModal, TemplatesModal 등 미적용
- 현재 ad-hoc window listener 사용

**수용 기준:**
- [ ] `usePrimaryActionHotkey` 훅 생성
- [ ] 입력형 모달(Settings, Templates, Goals)에 적용
- [ ] macOS metaKey 지원

---

### 우선순위 9: syncCore 브랜치 커버리지 개선

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🟡 Medium |
| **Risk Reduced** | 🟡 Medium |
| **Why Now** | 동기화 핵심 모듈 브랜치 커버리지 67.5% → 엣지 케이스 누락 시 동기화 실패 가능. |

**근거:**
- [coverage-summary.json](coverage/coverage-summary.json): `syncCore.ts` branches 67.5%

**수용 기준:**
- [ ] branch coverage ≥ 80%
- [ ] 네트워크 오류, 인증 만료, 부분 업로드 시나리오 테스트

---

### 우선순위 10: UI 컴포넌트 RTL 테스트 기반 구축

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🔴 Large |
| **Risk Reduced** | 🟡 Medium |
| **Why Now** | 현재 vitest가 서비스/유틸만 커버 → UI 정책 위반(ESC, 배경 클릭) 감지 불가. |

**근거:**
- 테스트 30개 중 UI/RTL 테스트 없음
- jsdom 미사용으로 렌더링 회귀 커버 부족

**수용 기준:**
- [ ] vitest + RTL 환경 구축 (jsdom)
- [ ] 핵심 모달 3개 샘플 테스트 (TaskModal, SettingsModal, GoalsModal)
- [ ] ESC 스택, Ctrl+Enter, 배경 클릭 시나리오 커버

---

## 2. 리스크 레지스터 (Top 5)

### R1: 데이터 손실/동기화 손상 🔴 Critical

| 항목 | 내용 |
|------|------|
| **트리거** | Firebase 병합 시 스키마 불일치, conflictResolver 엣지 케이스 미처리, 오프라인→온라인 전환 |
| **영향** | 사용자 작업 데이터 유실, 일정 손상 |
| **현재 상태** | conflictResolver branches 58.82%, syncCore branches 67.5% |
| **완화 조치** | 브랜치 커버리지 80%+ 확보, 동기화 전 백업 스냅샷, 충돌 로깅 강화 |
| **검증 방법** | vitest 엣지 케이스 추가, 수동 오프라인→온라인 시나리오 재현 |

---

### R2: 상태 불일치 🟠 High

| 항목 | 내용 |
|------|------|
| **트리거** | Repository 패턴 우회(direct Dexie), inboxStore↔dailyDataStore 동기화 누락, optimistic update 롤백 실패 |
| **영향** | UI와 DB 상태 불일치, 작업 이중 표시 또는 누락 |
| **현재 상태** | 5개 서비스에서 db.* 직접 접근, inbox→block 이동 시 강제 새로고침 의존 |
| **완화 조치** | Repository 강제 정책, eventBus 기반 store 동기화, 롤백 로직 필수화 |
| **검증 방법** | systemState 키 인벤토리 vs systemRepository 매핑 비교, 이동 시나리오 RTL 테스트 |

---

### R3: 성능 회귀 🟡 Medium

| 항목 | 내용 |
|------|------|
| **트리거** | Schedule/Focus 화면 다중 setInterval, 렌더 경로에서 Dexie IO, 전체 새로고침(loadData) |
| **영향** | UI 렌더링 지연, 배터리 소모 증가, 앱 응답성 저하 |
| **현재 상태** | inbox→block 이동 시 loadData 호출 확인됨 |
| **완화 조치** | optimistic update 적용, 타이머 cleanup 검증, Dexie 호출 캐싱/배치 |
| **검증 방법** | DevTools Performance 60초 프로파일링, 활성 interval 수 로깅 |

---

### R4: 테스트 취약성 🟡 Medium

| 항목 | 내용 |
|------|------|
| **트리거** | UI 컴포넌트 미테스트, 핵심 서비스 낮은 커버리지, 정책 위반 미감지 |
| **영향** | 회귀 버그 릴리즈, 정책 드리프트 |
| **현재 상태** | 테스트 30개 (서비스/유틸만), unifiedTaskService 58.91%, RTL 없음 |
| **완화 조치** | RTL 환경 구축, 핵심 서비스 커버리지 85%+, 정책 테스트 추가 |
| **검증 방법** | coverage report, CI 게이트 |

---

### R5: UX 회귀 (ADHD 사용자) 🟡 Medium

| 항목 | 내용 |
|------|------|
| **트리거** | 모달 ESC 정책 미준수, Ctrl+Enter 불일치, TIME_BLOCKS 라벨 혼란 |
| **영향** | 사용자 흐름 중단, 학습 비용 증가, 집중력 저하 |
| **현재 상태** | 2개 모달 스택 훅 미사용, 80% 모달 Ctrl+Enter 미지원 |
| **완화 조치** | 모달 정책 통일, 공용 훅 도입, 시간 블록 상수 통합 |
| **검증 방법** | 수동 Electron 앱 테스트, RTL 정책 테스트 |

---

## 3. 기술 부채 맵

### 🔴 Must-Fix (즉시 해결)

| 부채 항목 | 근거 | 영향 |
|-----------|------|------|
| Lint 오류 32건 | [lint-errors.txt](lint-errors.txt) | CI 차단, 배포 불가 |
| unifiedTaskService 낮은 커버리지 | coverage 58.91% | 핵심 로직 회귀 위험 |
| conflictResolver 브랜치 갭 | coverage 58.82% | 동기화 손상 위험 |
| Repository 패턴 우회 | [dexie-violations-scan.txt](agent-output/analysis/dexie-violations-scan.txt) | 상태 불일치 |

---

### 🟡 Should-Fix (다음 스프린트)

| 부채 항목 | 근거 | 영향 |
|-----------|------|------|
| Modal ESC 정책 미준수 2개 | [012-modal-ux-escape-ctrlenter-analysis.md](agent-output/analysis/012-modal-ux-escape-ctrlenter-analysis.md) | UX 불일치 |
| Inbox→Block optimistic update 부재 | [schedule-view-changes-hotspot-analysis.md](agent-output/critiques/schedule-view-changes-hotspot-analysis.md) | 성능/UX 저하 |
| 상수 중복 정의 | timeBlockBucket.ts + threeHourBucket.ts | 유지보수 혼란 |
| syncCore 브랜치 갭 | coverage 67.5% | 동기화 엣지 케이스 누락 |
| hook deps 경고 방치 | lint-errors.txt 4건 | 잠재적 무한 루프 |

---

### 🟢 Nice-to-Have (백로그)

| 부채 항목 | 근거 | 영향 |
|-----------|------|------|
| Ctrl+Enter 공용 훅 미도입 | 80% 모달 미지원 | 파워 유저 불편 |
| UI RTL 테스트 환경 부재 | jsdom 미사용 | 정책 검증 자동화 불가 |
| syncLogger 브랜치 갭 | coverage 72.72% | 디버깅 어려움 |
| EventBus 함수 커버리지 갭 | coverage 81.81% | 이벤트 누락 감지 어려움 |

---

## 4. Do-Not-Do 목록 (범위 확대 방지)

### ❌ 1. 백엔드/Supabase/Electron IPC 구현

> **이유:** 현재 단계는 프론트엔드/UI 한정. 백엔드 연동은 설계 고려사항일 뿐, 구현 범위가 아님.

---

### ❌ 2. 대규모 아키텍처 리팩토링 (상태 관리 전환 등)

> **이유:** Zustand→다른 라이브러리 전환, React Query 도입 등은 Supabase 동기화 단계에서 진행. 현재는 기존 패턴 내에서 개선.

---

### ❌ 3. 완벽한 100% 테스트 커버리지 추구

> **이유:** 핵심 비즈니스 로직(unifiedTaskService, conflictResolver, syncCore) 85%+ 목표. 전체 100%는 ROI 낮음.

---

### ❌ 4. UI 디자인 시스템 대규모 변경

> **이유:** Tailwind/Shadcn 기반 현재 시스템 유지. 컴포넌트 라이브러리 전환은 별도 ADR 필요.

---

## 5. 검증 경로 요약

| 검증 항목 | 명령/방법 |
|-----------|-----------|
| Lint 통과 | `npm run lint` |
| 테스트 통과 | `npm test` |
| 커버리지 확인 | `npm run test:coverage` |
| 수동 UX 검증 | `npm run electron:dev` → 모달 ESC, Ctrl+Enter, inbox→block 이동 |
| 성능 프로파일링 | DevTools Performance 60초 캡처 |
| 동기화 검증 | 오프라인→온라인 전환 후 SyncLog 확인 |

---

## 6. Open Questions

1. **Repository 패턴 예외:** syncEngine 등 성능상 이유로 직접 Dexie 접근이 필요한 경우 예외 리스트를 둘지, 전면 금지할지 결정 필요.
2. **Ctrl+Enter 적용 범위:** 정보성 모달(CompletionCelebrationModal 등)까지 강제할지, 입력형 모달 한정할지 UX 정책 결정 필요.
3. **TIME_BLOCKS wrap 블록:** 23-05시간대 블록 추가 여부 및 시간대 길이별 가중 규칙 확정 필요.

---

## Revision History

| 날짜 | 버전 | 변경 사항 |
|------|------|-----------|
| 2025-12-23 | v1.0 | 초기 분석 완료 |

