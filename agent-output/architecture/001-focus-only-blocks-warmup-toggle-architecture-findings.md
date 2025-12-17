# 001 — Architecture Findings: Focus-only TimeBlock Visibility + Warmup Auto-Generate Toggle

Date: 2025-12-17
Mode: Architect (no-memory)
Scope: frontend/UI only (no backend/Supabase/Electron IPC 구현 금지)

## Changelog
| Date | Trigger | Outcome |
|---|---|---|
| 2025-12-17 | Critic 결과 기반 “위험 최소화 단계 설계” 요청 | 단계별 롤아웃(3단계 이상), 요구사항 불명확성 가정 2안, 토글 저장 위치 trade-off 제시 |

## Inputs (근거)
- Critique: `agent-output/critiques/frontend-ui-improvement-plan-critique.md`
- Schedule list: `src/features/schedule/ScheduleView.tsx`
  - Past hide만 존재: `blocksToRender`는 isPast && !showPastBlocks만 필터.
  - Warmup 자동삽입은 ScheduleView 내부 setInterval 기반 useEffect로 항상 실행.
- Timeline: `src/features/schedule/TimelineView/useTimelineData.ts`
  - Past-hide 토글이 Dexie `systemState`에 저장됨.

---

## Requirement 1 — “현재 진행중인 3h 타임블록만 보이게”

### 불명확성(범위) 기본 가정 2안

#### 가정 A (최소 변경 / 추천 기본): ScheduleView(리스트형 타임블록)만 해당
- 정의: `ScheduleView.tsx`에서만 past+future를 숨겨 “현재 블록 1개”만 렌더.
- TimelineView는 ‘계획/조망’ 표면으로 유지(필요 시 past-hide는 그대로, future는 유지).

**영향**
- 장점: 계획 기능(미래 블록에 작업 배치) 경로가 Timeline에 남아 UX 손실을 완충.
- 리스크 감소: 드래그/배치/검색 등 다른 플로우에서 “데이터는 있는데 안 보임” 문제가 폭발적으로 늘지 않음.
- 단점: 동일한 하루 데이터가 두 표면에서 다른 정책으로 보임 → 사용자가 “왜 여기선 보이고 저기선 안 보이지?” 혼란 가능.

#### 가정 B (일관성 우선 / 고위험): ScheduleView + TimelineView 모두 해당
- 정의: 스케줄 리스트와 타임라인 모두 현재 블록만 보이게 (past+future 마스킹).

**영향**
- 장점: ‘지금 집중’ UX가 전 영역에서 일관.
- 리스크/비용: Timeline은 시간축을 전제로 레이아웃/스크롤/현재시각 라인 등을 계산하므로,
  - visibleStartHour/visibleEndHour(또는 표시할 hourGroups 범위) 수정이 필요
  - 현재 블록이 없는 시간대(23~05)에서 빈 화면/계산 예외가 증가
  - “미래에 작업 배치” 경로가 사실상 사라짐 → 앱 핵심 가치(계획) 손상 가능

---

## Requirement 2 — WarmupPresetModal에 자동생성 on/off 토글

### 설계 원칙(회귀 최소)
- 자동 삽입 로직은 현재 `ScheduleView.tsx` 내부 side-effect(useEffect + setInterval)로 구현되어 있어 회귀 범위가 큼.
- 따라서 1차는 **플래그 1개로 early-return 가드**하는 방식이 가장 안전.
- 토글 UI는 `WarmupPresetModal.tsx`에 추가하되, “모달 닫기 UX(ESC)”는 기존 패턴 유지.

---

## 단계별(최소 3단계) 작업 분해 — 위험 최소화 롤아웃

> 공통 가드레일
> - localStorage 금지 (theme 예외)
> - UI 토글/레이아웃 류 지속 상태는 Dexie `systemState` 우선
> - 데이터 변경(삭제/이동) 금지: 표시 정책만 바꾼다

### Phase 1 — ‘표시 정책’ 분리 + 내부 Feature Flag 도입
**변경 범위**
- (UI) “현재 블록만 표시”를 직접 기존 렌더링 코드에 박지 않고, 공용 함수/정책 객체로 분리(후속 적용 대비).
  - 후보 위치: `src/features/schedule/utils/timeBlockVisibility.ts` 또는 `src/shared/utils/timeBlockVisibility.ts`
  - 출력: `getVisibleBlocks({ now, mode })` / `isBlockVisible(block, now, policy)` 같은 순수 함수
- (UI) Warmup 자동생성 토글 플래그를 ‘읽기’만 먼저 연결(기본값은 기존과 동일: on)
  - 후보 위치: `db.systemState` key 예: `schedule:warmupAutoGenerateEnabled`

**리스크**
- 정책 분리 과정에서 기존 조건(showPastBlocks 등) 누락 → 블록 렌더링이 달라질 수 있음.
- 플래그 로딩 타이밍(초기값 로드 전)에서 1회 잘못 실행될 가능성.

**롤백 포인트**
- 새 정책/플래그 읽기를 제거하고 기존 `blocksToRender`/기존 warmup useEffect로 되돌리면 됨.

**검증 포인트**
- (수동) 현재 시각 기준: past-hide 동작이 기존과 동일하게 유지되는지.
- (수동) Warmup 자동삽입이 기존처럼 유지되는지(토글 UI 없이도).
- (기술) systemState 접근 실패 시 앱이 크래시하지 않고 기존 동작으로 폴백하는지.

### Phase 2 — Requirement 1 적용(가정 A 기준): ScheduleView에서만 ‘현재 블록 1개’ 렌더
**변경 범위**
- (UI) `ScheduleView.tsx`의 blocksToRender 계산을 “현재 블록만”으로 제한.
  - 기존 showPastBlocks UX(“지난 블록 보기” 안내)는 의미가 사라지므로 숨김/비활성 처리(Phase 3에서 정리).
- (UX) 현재 블록이 없는 시간대(예: 23~05) 처리 정의 필요:
  - 최소 해석: 빈 상태 메시지 1개(단일 CTA는 요구되지 않았으므로 추가하지 않음)

**리스크**
- 사용자가 미래 블록에 작업을 배치하는 동선 상실 → 혼란/불안.
- 드래그 앤 드롭 대상이 줄어들어 ‘작업 이동’이 갑자기 제한된 것처럼 느껴질 수 있음.

**롤백 포인트**
- feature flag(표시 정책)를 off로 돌리면 기존 전체 블록 렌더로 즉시 복귀.
  - 구현 가이드: systemState 키 또는 상수 기반 플래그로 스위치 가능하게 유지

**검증 포인트**
- (수동) 현재 블록 1개만 보이는지 + 해당 블록 내 CRUD(추가/편집/완료/잠금)가 정상인지.
- (수동) 현재 블록이 null인 시간대에서 크래시 없이 빈 상태가 보이는지.
- (회귀) past incomplete task를 inbox로 이동시키는 기존 useEffect가 동작하는지(표시와 무관해야 함).

### Phase 3 — Requirement 2 적용: WarmupPresetModal 토글 UI + 자동삽입 가드 연결
**변경 범위**
- (UI) `WarmupPresetModal.tsx`에 토글 컨트롤 추가
  - 디자인 시스템 제약: 기존 버튼 스타일/토큰(var(--color-*), border, bg)을 재사용
  - 컴포넌트 후보: 별도 Switch가 없으면 ‘버튼형 토글(켜짐/꺼짐 라벨)’로 최소 구현
- (로직) `ScheduleView.tsx` 자동 삽입 useEffect에서 플래그를 읽어 early-return
  - “기본값 on”을 보장해야 회귀가 최소

**리스크**
- 토글 상태 저장/로드 race condition으로, 사용자가 off로 했는데 그 사이 한 번 삽입될 수 있음.
- 모달에서만 제어하면 “왜 자동으로 생기지?”/“왜 안 생기지?” 원인 가시성이 낮음.

**롤백 포인트**
- 토글 UI/플래그를 제거하거나, 플래그 기본값을 true로 강제하여 기존 동작 복원.

**검증 포인트**
- (수동) 토글 off → 지정 시각(:50)에서 자동 삽입이 발생하지 않는지.
- (수동) 토글 on → 기존 조건(완료된 작업 있으면 삽입 안 함, 대상 슬롯 작업 2개 초과면 안 함 등)이 동일한지.
- (영향) 프리셋 저장/적용(이미 Firebase sync 존재)이 토글 추가로 깨지지 않는지.

---

## Requirement 2 — 플래그 저장 위치 선택지(2~3개) 및 trade-off

### Option 1 (추천 기본): Dexie `systemState`에 저장
- 형태: `db.systemState.put({ key, value: boolean })`
- 장점
  - localStorage 금지 정책에 부합
  - 오프라인/로컬 즉시 반영, 구현 단순
  - Timeline의 past-hide 토글 등과 같은 패턴으로 일관
- 단점
  - 기기/프로필 간 동기화가 안 됨(다른 기기에서 설정이 달라질 수 있음)
  - systemState 키가 늘어나면 관리 부채(네이밍/소유권) 증가

### Option 2: Store-only (Zustand 상태만, 지속 저장 없음)
- 장점
  - 구현/리스크 최소(저장/로드 레이스 없음)
  - 실험/임시 기능(Feature flag)에 적합
- 단점
  - 앱 재시작 시 초기화 → 사용자가 “왜 다시 켜졌지/꺼졌지?” 불신
  - 요구사항이 “설정” 성격이면 부적합

### Option 3 (확장/고위험): settingsStore + Firebase sync로 계정 단위 동기화
- 장점
  - 다중 기기에서 일관된 설정
  - 사용자가 ‘설정’으로 인지하기 쉬움
- 단점/리스크
  - 전략 추가/스키마 합의 필요(클라이언트만 바꿔도 데이터 계약이 바뀜)
  - 동기화 타이밍/충돌 처리, 기본값 결정(SETTING_DEFAULTS 연계) 등 설계 부담
  - 이번 요청이 “frontend/UI only”이므로, **설계 고려만** 하고 1차 적용은 비추천

---

## Verdict
APPROVED_WITH_CHANGES
- 가정 A(리스트만)로 Phase 2를 진행하는 것을 기본 권고.
- 가정 B(전 표면)로 가려면 Timeline의 시간 범위/빈 상태/계획 동선 대체가 먼저 정의되어야 함.
- Warmup 토글 저장은 Option 1(systemState) 우선 권고. Option 3는 후속(설정 체계 정리 이후)으로 보류.
