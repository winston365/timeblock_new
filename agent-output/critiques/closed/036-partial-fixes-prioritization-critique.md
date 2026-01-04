# Critique: Partial Fixes 및 미해결 이슈 우선순위 평가

**Artifact:** Analyst Reports (032, 033, 034, 035)  
**Date:** 2025-12-23  
**Status:** Initial Review  
**Scope:** Frontend/UI 전용, 최소 리팩토링 리스크

---

## Changelog

| 날짜 | 핸드오프 | 요청 | 요약 |
|------|----------|------|------|
| 2025-12-23 | User → Critic | Analyst 리포트 기반 P0/P1/P2 우선순위화 및 수용 기준 | 초기 평가 완료 |

---

## 1. 우선순위 테이블 (리스크/노력 근거 포함)

### P0: 즉시 수정 필수 (CI 차단 해제)

| 항목 | 리스크 | 노력 | 근거 |
|------|--------|------|------|
| **Lint 경고 4건 수정** | 🔴 High | 🟢 Small (~30분) | CI가 `--max-warnings=0` 정책으로 차단됨. 4개 파일, 4줄만 수정하면 해결. |
| ├ todayTasks useMemo 래핑 | 🔴 | 🟢 | [InboxTab.tsx#L52](src/features/tasks/InboxTab.tsx#L52), [useInboxHotkeys.ts#L102](src/features/tasks/hooks/useInboxHotkeys.ts#L102) |
| ├ incrementProcessedCount 제거/연결 | 🔴 | 🟢 | [InboxTab.tsx#L78](src/features/tasks/InboxTab.tsx#L78) - 미사용 변수 |
| └ createTask 헬퍼 제거 | 🔴 | 🟢 | [slot-finder.test.ts#L15](tests/slot-finder.test.ts#L15) - 미사용 테스트 헬퍼 |

**Why P0:**
- 빌드/배포 완전 차단 상태
- 수정 범위가 매우 작음 (4줄)
- 다른 모든 작업의 선행 조건

**수용 기준:**
- [ ] `npm run lint -- --max-warnings=0` 통과 (exit code 0)
- [ ] 모든 경고 해결 또는 정당화된 eslint-disable 주석
- [ ] 기존 테스트 전체 통과

---

### P1: 높은 가치, 적절한 노력 (이번 이터레이션 포함)

| 항목 | 리스크 | 노력 | 근거 |
|------|--------|------|------|
| **Modal ESC 스택 정책 준수** | 🟡 Medium | 🟢 Small (~2시간) | 2개 모달(GoalsModal, BossAlbumModal)만 수정. useModalEscapeClose 훅 이미 존재. |
| **QuickAddTask 핫키 마이그레이션** | 🟡 Medium | 🟡 Medium (~3시간) | window keydown 리스너 → useModalHotkeys. IME 가드 및 스택 안전성 확보. |
| **Inbox → TimeBlock 낙관적 업데이트** | 🔴 High | 🟡 Medium (~4시간) | UX 크리티컬. loadData 강제 새로고침 제거. createRollbackState 패턴 활용 가능. |

**Why P1:**
- 사용자 경험에 직접적 영향 (ADHD 친화성)
- 기존 패턴/훅 재사용으로 리스크 낮음
- 명확한 수용 기준 정의 가능

**수용 기준 - Modal ESC 정책:**
- [ ] GoalsModal: `useModalEscapeClose` 훅 적용
- [ ] BossAlbumModal: `useModalEscapeClose` 훅 적용
- [ ] 수동 테스트: 중첩 모달 열기 → ESC → 최상위 모달만 닫힘
- [ ] 배경 클릭 시 모달 닫히지 않음 확인

**수용 기준 - QuickAddTask:**
- [ ] window.addEventListener('keydown') 제거
- [ ] `useModalHotkeys` 훅으로 ESC/Ctrl+Enter 처리
- [ ] IME 조합 중 ESC/Enter 무시 확인
- [ ] Electron 창에서 정상 동작 확인

**수용 기준 - Optimistic Update:**
- [ ] inbox → timeblock 이동 시 `loadData()` 호출 없음
- [ ] UI 즉시 반영 (새로고침 없이)
- [ ] 실패 시 롤백 동작 확인
- [ ] eventBus를 통한 inboxStore 동기화

---

### P2: 중요하나 이번 이터레이션 범위 초과 (백로그)

| 항목 | 리스크 | 노력 | 근거 |
|------|--------|------|------|
| **unifiedTaskService 커버리지 확대** | 🔴 High | 🟡 Medium (~6시간) | 58.91% → 85%+ 목표. 테스트 코드 작성량 많음. |
| **conflictResolver 브랜치 커버리지** | 🔴 High | 🟡 Medium (~4시간) | 58.82% → 80%+ 목표. 엣지 케이스 시나리오 필요. |
| **syncCore 브랜치 커버리지** | 🟡 Medium | 🟡 Medium (~4시간) | 62.74% → 80%+ 목표. |
| **TIME_BLOCKS 상수 통합** | 🟡 Medium | 🟢 Small (~1시간) | threeHourBucket.ts 정리. 다른 작업과 충돌 가능성. |
| **Ctrl+Enter 공용 훅 도입** | 🟢 Low | 🟢 Small (~2시간) | UX 개선이나 긴급하지 않음. |

**Why P2:**
- 테스트 커버리지 작업은 시간 집약적
- 동기화 로직 변경은 데이터 안전성 리스크 있음
- 이번 이터레이션 목표(UI 안정화)와 간접적 연관

---

## 2. 🚫 Do-Not-Do 목록 (범위 가드레일)

### ❌ RTL 테스트 인프라 구축

| 항목 | 설명 |
|------|------|
| **이유** | jsdom 환경 설정, @testing-library/react 추가, 테스트 유틸리티 생성 등 **대규모 인프라 작업** |
| **노력** | 🔴 Large (8시간+) |
| **리스크** | 설정 오류 시 전체 테스트 스위트 불안정화 |
| **대안** | 수동 Electron 앱 테스트로 ESC/Ctrl+Enter 검증 |
| **언제** | 다음 이터레이션에서 별도 계획으로 진행 |

---

### ❌ Repository 패턴 대규모 리팩토링

| 항목 | 설명 |
|------|------|
| **이유** | syncEngine, useAppInitialization 등 **32+개 직접 Dexie 호출** 수정 필요 |
| **노력** | 🔴 Large (12시간+) |
| **리스크** | 상태 관리 버그, 동기화 손상 가능성 |
| **대안** | 신규 코드에서만 Repository 패턴 강제 (코드 리뷰) |
| **언제** | 아키텍처 ADR 확정 후 전용 스프린트 |

---

### ❌ 백엔드/Supabase/Electron IPC 구현

| 항목 | 설명 |
|------|------|
| **이유** | 현재 단계는 **프론트엔드/UI 전용** |
| **제약** | `.github/instructions/personal.instructions.md`에 명시적으로 금지됨 |

---

### ❌ useModalHotkeys vs useModalEscapeClose 아키텍처 결정

| 항목 | 설명 |
|------|------|
| **이유** | 35번 critique에서 **Open Question으로 미해결** 상태 |
| **접근법** | P1에서는 기존 패턴(useModalEscapeClose) 그대로 적용 |
| **언제** | 별도 ADR로 모달 핫키 정책 확정 후 통합 리팩토링 |

---

## 3. 우선순위별 수용 기준 요약

### P0 수용 기준 체크리스트

```
✅ P0 완료 조건:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ npm run lint -- --max-warnings=0 → exit code 0
□ npm test → 전체 통과
□ 변경 파일: 4개 이하
□ 변경 라인: 10줄 이하
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### P1 수용 기준 체크리스트

```
✅ P1 완료 조건:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Modal ESC]
□ GoalsModal: useModalEscapeClose 적용
□ BossAlbumModal: useModalEscapeClose 적용
□ 중첩 모달 ESC → 최상위만 닫힘 (수동 검증)
□ 배경 클릭 → 모달 유지 (수동 검증)

[QuickAddTask]
□ window keydown 리스너 제거
□ useModalHotkeys 훅 적용
□ ESC: 창 닫힘
□ Ctrl+Enter: 태스크 추가
□ IME 조합 중 무시 (수동 검증)

[Optimistic Update]
□ inbox → block 이동 시 loadData() 미호출
□ UI 즉시 반영
□ 실패 시 롤백
□ inboxStore 동기화 (eventBus)
□ npm test → 전체 통과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### P2 수용 기준 (백로그 참고용)

```
📋 P2 완료 조건 (다음 이터레이션):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[커버리지]
□ unifiedTaskService: lines ≥ 85%, branches ≥ 80%
□ conflictResolver: branches ≥ 80%
□ syncCore: branches ≥ 80%

[상수 통합]
□ MAX_TASKS_PER_BLOCK → defaults.ts 이동
□ threeHourBucket.ts 중복 제거
□ 관련 테스트 업데이트

[Ctrl+Enter]
□ usePrimaryActionHotkey 훅 생성
□ 입력형 모달 3개+ 적용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. 리스크 평가 매트릭스

| 우선순위 | 리스크 수준 | 롤백 용이성 | 테스트 가능성 |
|----------|-------------|-------------|---------------|
| **P0** | 🟢 Very Low | ✅ 쉬움 (4줄) | ✅ `npm test` |
| **P1 Modal** | 🟢 Low | ✅ 쉬움 (훅 교체) | ⚠️ 수동 필요 |
| **P1 QuickAdd** | 🟡 Medium | ⚠️ 보통 (Electron) | ⚠️ 수동 필요 |
| **P1 Optimistic** | 🟡 Medium | ⚠️ 보통 (상태) | ✅ 기존 테스트 |
| **P2 Coverage** | 🟢 Low | ✅ 쉬움 (테스트만) | ✅ 자동 |
| **P2 상수 통합** | 🟡 Medium | ⚠️ 보통 | ⚠️ 시간 경계 검증 필요 |

---

## 5. 구현 순서 권장

```
Phase 1 (P0) ─── 30분
    │
    ├─ Lint 경고 4건 수정
    │
    ▼
Phase 2 (P1a) ─── 2시간
    │
    ├─ Modal ESC 정책 (GoalsModal, BossAlbumModal)
    │
    ▼
Phase 3 (P1b) ─── 3시간
    │
    ├─ QuickAddTask 핫키 마이그레이션
    │
    ▼
Phase 4 (P1c) ─── 4시간
    │
    ├─ Inbox → TimeBlock 낙관적 업데이트
    │
    ▼
[이터레이션 완료] ───────────────────────
    │
    ▼
Phase 5+ (P2) ─── 다음 이터레이션
    │
    ├─ 커버리지 확대
    ├─ 상수 통합
    └─ Ctrl+Enter 훅
```

---

## 6. Open Questions (미해결)

| # | 질문 | 영향 | 권장 조치 |
|---|------|------|-----------|
| 1 | useModalHotkeys가 ESC 스택 정책 준수인가? | P1 Modal 구현 방식 | **현재: useModalEscapeClose 사용. 추후 ADR로 통합 결정** |
| 2 | QuickAddTask는 modalStackRegistry에 참여해야 하는가? | P1 QuickAdd 구현 | **현재: 독립 창이므로 예외 허용. 주석으로 문서화** |
| 3 | Repository 패턴 예외 범위는? | P2 아키텍처 | **현재: infra 폴더만 예외. 목록 문서화 필요** |

---

## 7. 최종 권고

### ✅ 승인: P0 즉시 구현 가능

- 명확한 범위, 낮은 리스크, CI 차단 해제 필수

### ⚠️ 조건부 승인: P1

- Open Question #1, #2는 **현재 접근법으로 진행** (추후 통합 리팩토링)
- QuickAddTask는 Electron 빌드에서 수동 검증 필수

### 📋 백로그: P2

- 다음 이터레이션으로 적절히 연기됨
- RTL 인프라는 별도 계획으로 분리

---

## Revision History

| 버전 | 날짜 | 변경 사항 |
|------|------|-----------|
| v1.0 | 2025-12-23 | 초기 평가 완료 |

