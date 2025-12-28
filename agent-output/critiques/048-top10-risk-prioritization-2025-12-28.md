# TimeBlock Planner 개선점 Top10 — 리스크/기술부채 우선순위 분석

> **Artifact Type:** Critic Analysis – Risk/Tech Debt Prioritization  
> **Date:** 2025-12-28  
> **Status:** Initial  
> **Scope:** 프론트엔드/UI 한정 (백엔드·Supabase·Electron IPC 구현 제외)

---

## Changelog

| 날짜 | 핸드오프 | 요청 | 요약 |
|------|----------|------|------|
| 2025-12-28 | User → Critic | Top10 개선/리스크 재분석 | 현재 레포 상태 기준 최신 분석 완료 |

---

## Executive Summary

현재 레포 분석 결과 (v1.0.175 기준):

| 영역 | 상태 |
|------|------|
| **Lint** | 1 error + 1 warning → CI 차단 중 |
| **Test Coverage** | 전체 88.43% ✅, 핵심 서비스(unifiedTaskService) 58.88% ⚠️ |
| **Branch Coverage** | conflictResolver 58.82%, syncCore 62.74% ⚠️ |
| **Modal Policy** | 대부분 준수, 배경클릭 위반 1건 발견 |
| **Repository Pattern** | infra 계층에서 직접 Dexie 접근 다수 |
| **RTL/UI Tests** | 0개 (환경 미구축) |

---

## 1. Top 10 개선 우선순위 목록

### 🥇 #1: Lint 오류 제거 (CI 게이트 복구)

| 항목 | 값 |
|------|-----|
| **Impact** | 🔴 Critical |
| **Effort** | 🟢 Trivial (< 30분) |
| **Risk Reduced** | 🔴 High |
| **선행조건** | 없음 |

**왜 중요한지:**
- `--max-warnings 0` 정책으로 경고 1개만 있어도 CI 실패 → 배포 파이프라인 전체 차단
- 현재 상태: `no-duplicate-imports` 1건 + `@typescript-eslint/no-unused-vars` 1건

**실패 시 영향:**
- 모든 PR 빌드 실패, 릴리즈 불가
- 개발자 피로도 증가, 기술부채 누적

**관련 파일:**
- [src/data/repositories/dailyData/coreOperations.ts](../src/data/repositories/dailyData/coreOperations.ts#L18) — 중복 import
- [src/features/tasks/InboxTab.tsx](../src/features/tasks/InboxTab.tsx#L94) — unused var `setTodayProcessedCount`

**수용 기준:**
- [ ] `npm run lint` exit code 0
- [ ] CI 파이프라인 정상 통과

---

### 🥈 #2: unifiedTaskService 테스트 커버리지 확대

| 항목 | 값 |
|------|-----|
| **Impact** | 🔴 High |
| **Effort** | 🟡 Medium (2-4h) |
| **Risk Reduced** | 🔴 High |
| **선행조건** | #1 완료 |

**왜 중요한지:**
- 핵심 비즈니스 로직(inbox ↔ timeblock 이동, 작업 위치 탐색)의 커버리지가 **lines 58.88%, branches 69.04%**로 위험 수준
- 데이터 조작 코어 로직이 충분히 검증되지 않음

**실패 시 영향:**
- 리팩토링 시 회귀 버그 → 작업 데이터 손실/이중 표시
- 이동 로직 오류로 사용자 작업 누락

**미커버 영역:**
- `findTaskLocation` 다중 경로 분기
- `updateAnyTask` 엣지 케이스
- `moveTask` 롤백 시나리오

**수용 기준:**
- [ ] line coverage ≥ 85%
- [ ] branch coverage ≥ 80%
- [ ] 경로별 테스트 케이스 추가

---

### 🥉 #3: 동기화 모듈 브랜치 커버리지 개선

| 항목 | 값 |
|------|-----|
| **Impact** | 🔴 High |
| **Effort** | 🟡 Medium (3-4h) |
| **Risk Reduced** | 🔴 High |
| **선행조건** | #1 완료 |

**왜 중요한지:**
- `conflictResolver.ts` branches **58.82%**, `syncCore.ts` branches **62.74%**
- 오프라인→온라인 전환, 스키마 변경 시 데이터 병합 로직이 불완전하게 테스트됨

**실패 시 영향:**
- Firebase 동기화 시 데이터 손실/덮어쓰기
- 필드 누락, 타임스탬프 충돌 미처리

**수용 기준:**
- [ ] conflictResolver branches ≥ 80%
- [ ] syncCore branches ≥ 80%
- [ ] 엣지 케이스 테스트: 네트워크 오류, 부분 업로드, 스키마 마이그레이션

---

### #4: 배경 클릭 닫힘 정책 위반 수정

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🟢 Small (< 1h) |
| **Risk Reduced** | 🟡 Medium |
| **선행조건** | 없음 |

**왜 중요한지:**
- 정책: "모달 배경 클릭 시 닫힘 금지" (ADHD 사용자 입력 보호)
- 위반 발견: `BattleMissionsSection.tsx#L77`에서 `onClick={onClose}` 직접 연결

**실패 시 영향:**
- 사용자가 실수로 배경 클릭 시 입력 내용 손실
- ADHD 사용자 UX 저하, 집중력 방해

**관련 파일:**
- [src/features/settings/components/tabs/battle/BattleMissionsSection.tsx](../src/features/settings/components/tabs/battle/BattleMissionsSection.tsx#L77)

**수용 기준:**
- [ ] 배경 div에서 `onClick={onClose}` 제거 또는 `e.stopPropagation()` 처리
- [ ] 닫기는 ESC 키 또는 명시적 닫기 버튼만 허용

---

### #5: Inbox → TimeBlock Optimistic Update 적용

| 항목 | 값 |
|------|-----|
| **Impact** | 🔴 High (UX) |
| **Effort** | 🟡 Medium (2-3h) |
| **Risk Reduced** | 🟡 Medium |
| **선행조건** | #2 완료 권장 |

**왜 중요한지:**
- 현재 `dailyDataStore.ts`에서 `loadData(currentDate, true)` 호출로 전체 새로고침
- UX 지연 + 성능 저하 + ADHD 사용자 피드백 지연

**실패 시 영향:**
- 작업 이동 후 0.5~1초 딜레이로 사용자 흐름 중단
- 다수 작업 이동 시 누적 성능 저하

**관련 파일:**
- [src/shared/stores/dailyDataStore.ts#L310](../src/shared/stores/dailyDataStore.ts#L310) — `loadData(currentDate, true)`
- [src/shared/stores/dailyDataStore.ts#L714](../src/shared/stores/dailyDataStore.ts#L714)

**수용 기준:**
- [ ] optimistic update 패턴 적용 (createRollbackState 활용)
- [ ] 실패 시 롤백 동작 검증
- [ ] eventBus 기반 store 간 동기화

---

### #6: Repository 패턴 일관성 강화

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🟡 Medium (3-4h) |
| **Risk Reduced** | 🟡 Medium-High |
| **선행조건** | 정책 결정 (예외 허용 범위) |

**왜 중요한지:**
- infra 계층(`syncEngine.ts`, `useAppInitialization.ts`)에서 `db.*` 직접 접근 17건 이상
- 키/기본값 분산으로 불일치 위험

**실패 시 영향:**
- systemState 키 불일치로 설정 손실
- 마이그레이션 시 기본값 혼란

**관련 파일:**
- [src/data/db/infra/syncEngine.ts](../src/data/db/infra/syncEngine.ts) — 7개 직접 접근
- [src/data/db/infra/useAppInitialization.ts](../src/data/db/infra/useAppInitialization.ts) — 7개 직접 접근

**수용 기준:**
- [ ] 예외 허용 범위 문서화 (infra 계층만 허용 vs 전면 금지)
- [ ] 신규 코드에서 직접 접근 금지 lint 규칙 또는 리뷰 가드

---

### #7: Ctrl+Enter 공용 훅 적용 확대

| 항목 | 값 |
|------|-----|
| **Impact** | 🟢 Low-Medium |
| **Effort** | 🟢 Small (1-2h) |
| **Risk Reduced** | 🟢 Low |
| **선행조건** | 없음 |

**왜 중요한지:**
- `useModalHotkeys` 훅은 준비됨, 그러나 **~20% 모달만 적용**
- 파워 유저 생산성 저하, 키보드 중심 UX 불일치

**실패 시 영향:**
- 입력형 모달에서 Ctrl+Enter 동작 안 함 → 마우스 의존
- UX 일관성 저하

**수용 기준:**
- [ ] 입력형 모달(Settings, Templates, Goals 등)에 Ctrl+Enter 적용
- [ ] macOS Command+Enter 지원 확인

---

### #8: UI/RTL 테스트 환경 구축

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🔴 Large (4-6h) |
| **Risk Reduced** | 🟡 Medium |
| **선행조건** | #1 완료 |

**왜 중요한지:**
- 현재 vitest: `environment: 'node'` → jsdom/RTL 미사용
- UI 정책 위반(ESC, 배경 클릭) 자동 감지 불가

**실패 시 영향:**
- 모달 정책 회귀 릴리즈
- UI 변경 시 수동 테스트 의존

**수용 기준:**
- [ ] vitest + jsdom + @testing-library/react 환경 구성
- [ ] 샘플 모달 3개 RTL 테스트 (ESC 스택, 배경 클릭, Ctrl+Enter)
- [ ] CI에서 UI 테스트 실행

---

### #9: Schedule/Focus 타이머 리소스 최적화

| 항목 | 값 |
|------|-----|
| **Impact** | 🟡 Medium |
| **Effort** | 🟡 Medium (2-3h) |
| **Risk Reduced** | 🟢 Low-Medium |
| **선행조건** | 성능 프로파일링 |

**왜 중요한지:**
- 다중 `setInterval`/`setTimeout`이 cleanup 없이 누적될 가능성
- 장시간 사용 시 CPU/배터리 소모 증가

**실패 시 영향:**
- 앱 응답성 저하
- Electron 앱 배터리 소모 증가

**관련 파일:**
- [src/features/schedule/ScheduleView.tsx](../src/features/schedule/ScheduleView.tsx)
- [src/features/schedule/TimelineView/useTimelineData.ts](../src/features/schedule/TimelineView/useTimelineData.ts)
- [src/features/focus](../src/features/focus)

**수용 기준:**
- [ ] DevTools Performance 60초 프로파일링
- [ ] 활성 interval 수 로깅
- [ ] cleanup 누락 시 수정

---

### #10: defaults.ts ↔ Repository 기본값 일치 검증

| 항목 | 값 |
|------|-----|
| **Impact** | 🟢 Low |
| **Effort** | 🟢 Small (1h) |
| **Risk Reduced** | 🟢 Low |
| **선행조건** | 없음 |

**왜 중요한지:**
- `defaults.ts`와 Repository `createInitial`/`sanitize` 함수의 기본값 불일치 가능성
- 신규 설치 vs 마이그레이션 시 다른 값 저장

**실패 시 영향:**
- 설정 불일치로 예기치 않은 동작
- 디버깅 어려움

**수용 기준:**
- [ ] defaults.ts vs repository 기본값 비교표 작성
- [ ] 불일치 항목 통합
- [ ] vitest snapshot 테스트 추가

---

## 2. 리스크/부채 우선순위 매트릭스

### Impact × Likelihood 매트릭스

```
                    Likelihood (발생 확률)
                    Low         Medium        High
              ┌─────────────┬─────────────┬─────────────┐
        High  │ #9 타이머   │ #5 Optim.   │ #1 Lint ⭐  │
              │ #10 기본값  │ #6 Repo     │ #2 Task커버 │
Impact        │             │ #7 Ctrl+Ent │ #3 Sync커버 │
              ├─────────────┼─────────────┼─────────────┤
       Medium │             │ #8 RTL환경  │ #4 배경클릭 │
              │             │             │             │
              ├─────────────┼─────────────┼─────────────┤
         Low  │             │             │             │
              └─────────────┴─────────────┴─────────────┘

⭐ = 즉시 조치 필요 (High Impact × High Likelihood)
```

### User Pain × Engineering Cost 매트릭스

| # | 항목 | User Pain | Eng. Cost | 권장 액션 |
|---|------|-----------|-----------|-----------|
| 1 | Lint 오류 | 🔴 배포 불가 | 🟢 Trivial | **즉시 수정** |
| 2 | unifiedTaskService | 🔴 데이터 손실 위험 | 🟡 Medium | **이번 스프린트** |
| 3 | Sync 커버리지 | 🔴 동기화 손상 | 🟡 Medium | **이번 스프린트** |
| 4 | 배경 클릭 | 🟡 입력 손실 | 🟢 Small | **이번 스프린트** |
| 5 | Optimistic Update | 🟠 UX 지연 | 🟡 Medium | 다음 스프린트 |
| 6 | Repository 패턴 | 🟡 유지보수 | 🟡 Medium | 다음 스프린트 |
| 7 | Ctrl+Enter | 🟢 편의성 | 🟢 Small | 백로그 |
| 8 | RTL 환경 | 🟡 품질 | 🔴 Large | 백로그 |
| 9 | 타이머 최적화 | 🟢 성능 | 🟡 Medium | 백로그 |
| 10 | 기본값 일치 | 🟢 일관성 | 🟢 Small | 백로그 |

---

## 3. 영역 구분: 위험 vs 안전

### 🔴 지금 당장 손대면 위험한 영역 (회귀 가능성 높음)

| 영역 | 이유 | 회귀 리스크 |
|------|------|-------------|
| `syncEngine.ts` | Firebase 동기화 핵심, 테스트 커버리지 낮음 | 데이터 손실/충돌 |
| `useAppInitialization.ts` | 앱 부팅 시퀀스, 초기화 순서 민감 | 앱 시작 실패 |
| `conflictResolver.ts` | 병합 로직, 브랜치 58.82% | 동기화 데이터 손상 |
| `dailyDataStore.ts` (loadData) | 상태 관리 핵심, 전체 새로고침 의존 | UI/데이터 불일치 |
| `dexieClient.ts` | DB 스키마, 마이그레이션 | 데이터 손실 |

**권장:** 이 영역 수정 전 반드시 테스트 커버리지 확보 필요

---

### 🟢 안전한 고가치 영역 (변경 리스크 낮음)

| 영역 | 이유 | 예상 효과 |
|------|------|-----------|
| **Lint 수정** (coreOperations, InboxTab) | 단순 import/변수 정리, 로직 변경 없음 | CI 복구 |
| **배경 클릭 수정** (BattleMissionsSection) | 단일 라인 변경, 독립적 | 정책 준수 |
| **Ctrl+Enter 적용** | 기존 훅 재사용, 추가만 | UX 개선 |
| **defaults.ts 정리** | 상수 통합, 참조만 변경 | 일관성 |
| **새 테스트 추가** | 기존 코드 변경 없음 | 커버리지 향상 |

**권장:** 이 영역부터 먼저 처리하여 빠른 개선 효과 확보

---

## 4. 실행 로드맵

### Phase 1: 즉시 (이번 주)

```
#1 Lint 수정 ─────> CI 복구 ─────> #2, #3 테스트 추가 가능
      │
      └── #4 배경 클릭 수정 (병렬 가능)
```

### Phase 2: 이번 스프린트

```
#2 unifiedTaskService 테스트 ──┬──> #5 Optimistic Update (안전하게)
                               │
#3 Sync 모듈 테스트 ───────────┘
```

### Phase 3: 다음 스프린트

```
#5 Optimistic Update
#6 Repository 패턴 정리
#7 Ctrl+Enter 확대
```

### Phase 4: 백로그

```
#8 RTL 환경 구축
#9 타이머 최적화
#10 기본값 통합
```

---

## 5. 검증 경로

| 항목 | 검증 명령/방법 |
|------|---------------|
| Lint 통과 | `npm run lint` |
| 테스트 통과 | `npm test` |
| 커버리지 확인 | `npm run test:coverage` |
| UX 검증 | `npm run electron:dev` → 모달 ESC, 배경 클릭, Ctrl+Enter |
| 성능 프로파일 | DevTools Performance 60초 캡처 |
| 동기화 검증 | 오프라인→온라인 전환 후 SyncLog 확인 |

---

## 6. Open Questions (결정 필요)

1. **Repository 예외 범위:** infra 계층(`syncEngine`, `useAppInitialization`)의 직접 Dexie 접근을 허용할지, 전면 금지할지?
2. **Ctrl+Enter 적용 범위:** 정보성 모달까지 강제할지, 입력형 모달에 한정할지?
3. **RTL 테스트 우선순위:** Large effort 대비 현재 단계에서 도입할지, Supabase 연동 후로 미룰지?

---

## Revision History

| 날짜 | 버전 | 변경 사항 |
|------|------|-----------|
| 2025-12-28 | v1.0 | 현재 레포 상태 기준 최신 분석 완료 |
