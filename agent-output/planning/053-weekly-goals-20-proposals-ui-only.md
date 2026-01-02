---
ID: 53
Origin: 53
UUID: a3f19c2d
Status: Active
---

# Weekly Goals (GoalsModal) — 20 Proposals (UI-only)

## Plan Header
- Plan ID: 053-weekly-goals-20-proposals-ui-only
- Target Release: **1.0.179 (제안; 현재 package.json = 1.0.178 기준 patch +1)**
- Epic Alignment: Weekly Goals UX 강화(리셋 가시성/정보밀도/히스토리/캐치업 개인화/오프라인·동기화 리스크 가시화)
- Scope Constraint: **프론트/UI 중심(백엔드/IPC/Supabase 구현 X)** — 필요한 경우 “디자인 고려”로만 기술

## Value Statement and Business Objective
As a 주간 목표를 매일 확인하는 사용자, I want to 목표 진행·리셋·만회(catch-up)·히스토리를 **덜 헷갈리고(인지부하↓)** **작게 시작할 수 있게(마이크로스텝)** **실패해도 다시 돌아올 수 있게(실패 내성)** 만들고, so that 주간 목표를 꾸준히 달성하면서도 압박감과 혼란을 줄인다.

## Context Snapshot (from existing code/analysis)
- GoalsModal은 주간목표 중심(글로벌 목표 UI 제거; legacy 테이블 잔존).
- Dexie(weeklyGoals/systemState) 기반 저장, 주간 리셋 + 얕은 히스토리(최근 몇 주), catch-up 배너, 1일 1회 토스트, Add/Edit 모달.
- Known issues: 리셋 가시성 부족, 정보 밀도 높음, 히스토리/인사이트 부족, catch-up 개인화 부족, 동기화/오프라인 리스크(사용자 인지 어려움).

---


# 1) 추가 기능 10개 (Feature)

## F1. “오늘의 1-스텝” (UI-only 프리셋/사용자 입력 기반)
- 문제/목표: 목표가 크면 시작 장벽이 높아(ADHD) 첫 행동이 멈춘다.
- 제안: 각 목표 카드에 “지금 2분/5분으로 할 1-스텝”을 프리셋 3개(예: ‘다음 행동 1줄 쓰기’)로 제공하고, 사용자가 직접 1줄 입력해 교체할 수 있게 한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): M
- 리스크/주의: 데이터 소스 불명확한 ‘자동 추천’은 금지(허상 방지) → 프리셋/사용자 입력만으로 완결, 스킵/다른 제안 기본 제공.
- 코드/패턴 연결: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) 표시 + [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts) 프리셋 상수.

## F2. “마이크로스텝” 리스트(Phase 1=세션, Phase 2=디자인 고려)
- 문제/목표: 추상적 목표는 실행 단위가 없어 압박만 커진다.
- 제안: 목표마다 마이크로스텝 3~7개를 입력하고, 오늘은 1~2개만 체크하도록 “오늘의 선택” UI를 제공한다(Phase 1은 새로고침 시 초기화 허용).
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): M
- 리스크/주의: 영구 저장(Phase 2)은 스키마/싱크 전략 변경이 필요하므로 이 문서 범위(UI-only)에서는 “디자인 고려”로만 명시한다.
- 코드/패턴 연결: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) + [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) (Phase 2 디자인 고려: [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts)).

## F3. “실패 내성” 복귀 버튼(가벼운 재시작)
- 문제/목표: 목표가 밀리면 ‘망했다’ 감정으로 이탈한다.
- 제안: catch-up 배너에 “오늘만 가볍게(0.5x) 재시작” 버튼을 추가해, 계산 규칙을 강요하지 않고 ‘권장 페이스’를 제시한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): S
- 리스크/주의: 계산 규칙이 혼란스러우면 죄책감이 커질 수 있음 → 버튼 문구를 “권장 페이스로 전환”처럼 중립적으로 고정.
- 코드/패턴 연결: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) + [src/features/goals/utils/catchUpUtils.ts](src/features/goals/utils/catchUpUtils.ts).

## F4. 캐치업 개인화(선택 폭발 방지: 전역 기본 + 고급 숨김)
- 문제/목표: 만회 규칙이 사용자에게 압박/무시로 작동하면 목표가 무의미해진다.
- 제안: GoalsModal 상단 “⚙️ 만회 설정”에서 전역 프리셋 1개만 선택(기본=균등)하게 하고, 목표별 오버라이드는 ‘고급’에서만 활성화한다.
- 사용자 가치(H/M/L): M
- 구현 노력(S/M/L): M
- 리스크/주의: 목표마다 설정을 요구하면 ADHD에 역효과 → 기본값 1개, 목표별 설정은 기본 숨김(프리셋은 3개 이하).
- 코드/패턴 연결: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) + [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts).

## F5. “주간 리셋” 안내 카드(이번 주 시작/지난주 1줄 요약)
- 문제/목표: 리셋이 조용히 일어나면 데이터가 사라진 것처럼 느껴 신뢰가 떨어진다.
- 제안: 새 주가 감지되면 GoalsModal 상단에 “새 주 시작” 카드(지난주 달성률 1줄 + ‘히스토리 보기’)를 1주 1회만 노출한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): S
- 리스크/주의: 배너 과다 노출은 피로를 유발 → 표시 빈도 제한(주 1회)과 명확한 닫기 제공.
- 코드/패턴 연결: [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts) + [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx).

## F6. “히스토리에서 복제” (지난주 목표 재사용)
- 문제/목표: 매주 동일 목표를 다시 입력하는 마찰이 크다.
- 제안: 히스토리에서 ‘이번 주로 복제’ 버튼을 제공하고, 복제 직후 편집 모달을 자동으로 열어 단위/목표량을 빠르게 조정하게 한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): M
- 리스크/주의: 중복 목표 폭증 위험 → 복제 시 기본 접미사(예: “(복제)”)와 “방금 복제됨” 상태 배지로 명확히.
- 코드/패턴 연결: [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts) + [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx).

## F7. “목표 템플릿” 최소 프리셋(3개)로 빠른 추가
- 문제/목표: 빈 입력창은 시작을 어렵게 하고, 너무 많은 프리셋은 선택 폭발을 만든다.
- 제안: Add 모달에 프리셋 3개만 제공(예: 운동/공부/프로젝트)하고, 나머지는 “다른 예시 보기(선택)”로 숨긴다.
- 사용자 가치(H/M/L): M
- 구현 노력(S/M/L): S
- 리스크/주의: 개인차가 커서 쓸모없을 수 있음 → 프리셋은 ‘예시’로만 취급(선택 안 해도 즉시 입력 가능).
- 코드/패턴 연결: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) + [src/shared/constants/defaults.ts](src/shared/constants/defaults.ts).

## F8. “오늘만 보기” 필터(노이즈 컷)
- 문제/목표: 카드가 많을수록 우선순위가 흐려지고, 시작이 늦어진다.
- 제안: “오늘 할당량>0” 또는 “지금 할 것”만 보이도록 1탭 필터를 제공하고, 토글 상태를 칩/배지로 강하게 표시한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): S
- 리스크/주의: 숨겨진 카드가 “사라졌다”로 인식될 수 있음 → 필터 활성 시 “숨김 N개”를 명시.
- 코드/패턴 연결: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) + [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts).

## F9. “진행도 변경 가드 + Undo” (실수 방지)
- 문제/목표: 직접 입력/±/퀵로그가 섞이면 실수(과다/음수)가 늘고 신뢰가 깨진다.
- 제안: 기본은 ±로만 조작하고, 직접 입력은 ‘고급’에 숨긴다. 변경 직후 5초 내 Undo(되돌리기)를 제공한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): M
- 리스크/주의: 기존 사용자의 빠른 입력 루틴을 깨뜨릴 수 있음 → “고급 입력 유지” 토글로 점진 적용.
- 코드/패턴 연결: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) + [src/features/goals/WeeklyProgressBar.tsx](src/features/goals/WeeklyProgressBar.tsx).

## F10. “목표 테마/프로젝트 연결” (장기목표 느낌 강화)
- 문제/목표: 주간 목표가 장기 프로젝트/분기 목표와 연결되지 않으면 의미가 약해지고 지속성이 떨어진다.
- 제안: 각 목표에 “테마/프로젝트” 라벨(예: ‘Q1: 건강’, ‘프로젝트: 앱 출시’)을 붙이고, 동일 테마로 묶어 보기/필터링을 제공한다(기본은 자동 묶기 없음).
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): M
- 리스크/주의: 테마 입력이 부담이 되면 역효과 → 선택 사항으로 두고, 프리셋 3개 + 자유 입력 1칸만 제공.
- 코드/패턴 연결: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) + [src/data/repositories/weeklyGoalRepository.ts](src/data/repositories/weeklyGoalRepository.ts).

---

# 2) UI/UX 개선 5개

## U1. “축소 모드” 정보 최적화(중복 제거)
- 문제/목표: 이미 축소/확장이 있어도, 축소 모드에서 핵심 정보가 흩어지면 인지부하가 유지된다.
- 제안: 축소 모드에는 ‘제목/이번 주 진행/오늘 할당/상태(만회 필요 여부)’만 남기고, 상세 액션은 확장/더보기로만 노출한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): S
- 리스크/주의: 숨겨진 기능의 발견성이 떨어질 수 있음 → 첫 1회만 “더보기 위치” 힌트를 표시.
- 코드/패턴 연결: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) + [src/features/goals/WeeklyProgressBar.tsx](src/features/goals/WeeklyProgressBar.tsx).

## U2. 리셋 가시성: “주차 라벨 + 이번 주 시작 안내”
- 문제/목표: 주간 단위가 명확하지 않으면 진행도 해석이 흔들린다.
- 제안: GoalsModal 상단에 “이번 주(YYYY-WW)” 라벨과 “이번 주 시작” 안내를 고정 표시하고, 상세 시간은 툴팁으로만 제공한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): S
- 리스크/주의: 타임존/현지화 이슈 → “이번 주 시작”처럼 사용자 언어 중심 문구로 우회.
- 코드/패턴 연결: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) + [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts).

## U3. “만회 배너”를 압박 대신 안내로 재디자인
- 문제/목표: catch-up 메시지가 죄책감/압박으로 작동하면 회피가 강화된다.
- 제안: 배너를 “권장 페이스 + 선택지(복귀/숨김/히스토리)” 3버튼으로 단순화하고, 문구는 중립 톤으로 통일한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): S
- 리스크/주의: 숨김(snooze)이 영구 회피가 될 수 있음 → 주 1회만 자동 재등장.
- 코드/패턴 연결: [src/features/goals/utils/catchUpUtils.ts](src/features/goals/utils/catchUpUtils.ts) + [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx).

## U4. “리뷰/히스토리 인사이트 3줄” (칭찬 기반, 장기 연결)
- 문제/목표: 히스토리가 있어도 의미를 못 느끼면 장기 습관이 되기 어렵다.
- 제안: 히스토리 상단에 3줄만 표시(예: “최고 달성 주”, “4주 평균”, “가장 꾸준한 테마 1개”)해 분기/프로젝트 리뷰 느낌을 만든다.
- 사용자 가치(H/M/L): M
- 구현 노력(S/M/L): M
- 리스크/주의: 통계가 과하면 불안/회피 유발 → ‘칭찬’ 문구 우선, 비교/랭킹은 금지.
- 코드/패턴 연결: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) + [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts).

## U5. Add/Edit 모달 흐름 단순화(2단계)
- 문제/목표: 한 화면에 입력이 많으면 결정 피로가 오고, 저장을 미룬다.
- 제안: 1단계=제목/주간 목표량만 입력하면 즉시 저장, 2단계(선택)=단위/테마/마이크로스텝/만회 설정을 “추가로 다듬기”로 분리한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): M
- 리스크/주의: 단계가 늘어 귀찮을 수 있음 → 2단계는 완전 선택(나중에 언제든 편집).
- 코드/패턴 연결: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) + [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx).

---

# 3) 접근성/빠른 접근 5개 (A11y + Quick Access)

## A1. 키보드 중심: 단축키 힌트 UI 포함(노력 M로 재분류)
- 문제/목표: 마우스 이동이 많으면 흐름이 끊기고, 단축키는 “기억 부담” 때문에 쓰지 못한다.
- 제안: 기존 단축키를 유지/보완하되, `?`로 토글되는 “단축키 힌트 패널”을 GoalsModal 하단에 표시해 즉시 학습 가능하게 한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): M
- 리스크/주의: 입력창/IME 충돌 위험 → input/textarea 포커스 시 단축키 무시, 힌트 패널은 스크린리더 친화적으로 구성.
- 코드/패턴 연결: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) + [src/shared/stores/weeklyGoalStore.ts](src/shared/stores/weeklyGoalStore.ts).

## A2. 포커스 가시성 강화(시각적/인지적)
- 문제/목표: 현재 선택된 목표가 불명확하면 오입력/스트레스가 늘어난다.
- 제안: 포커스된 카드에 테두리/배경 대비를 강화하고, 키보드 이동 시 자동 스크롤로 노출한다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): S
- 리스크/주의: 애니메이션 과다로 산만해질 수 있음 → 150ms 이하, reduce-motion 존중.
- 코드/패턴 연결: [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx) + [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx).

## A3. 스크린리더/ARIA: 진행도 컨트롤 라벨링 + 핵심 상태 읽기
- 문제/목표: 아이콘 버튼 중심 UI는 접근성 정보가 부족해 조작 실수가 늘어난다.
- 제안: 진행도 증감/삭제/히스토리 버튼에 aria-label을 부여하고, 진행도 변경은 필요한 경우에만 aria-live로 읽히게 한다.
- 사용자 가치(H/M/L): M
- 구현 노력(S/M/L): S
- 리스크/주의: aria-live 남발은 소음 → “달성/만회 필요” 같은 핵심 상태만 제한적으로 읽기.
- 코드/패턴 연결: [src/features/goals/WeeklyGoalCard.tsx](src/features/goals/WeeklyGoalCard.tsx) + [src/features/goals/WeeklyProgressBar.tsx](src/features/goals/WeeklyProgressBar.tsx).

## A4. 빠른 검색/필터(입력 부담 최소화)
- 문제/목표: 목표가 많으면 찾는 비용이 커져 실행이 늦어진다.
- 제안: GoalsModal 상단에 “검색”을 기본 숨김으로 두고, `/`로 열어 제목 필터를 적용한다(닫기/초기화는 Esc).
- 사용자 가치(H/M/L): M
- 구현 노력(S/M/L): S
- 리스크/주의: 검색이 또 다른 해야 할 일이 되지 않게 기본은 닫힘, 최근 검색어 저장은 하지 않는다.
- 코드/패턴 연결: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) + [src/features/goals/WeeklyGoalPanel.tsx](src/features/goals/WeeklyGoalPanel.tsx).

## A5. 모달 접근성 통합(ESC 닫기/배경클릭 금지/포커스 일관)
- 문제/목표: 모달 행동이 불일치하면 불안/실수가 늘고, 복귀 비용이 커진다.
- 제안: Goals 관련 모든 모달에 ESC 닫기와 배경클릭 금지를 통일하고, 포커스 흐름(초기 포커스/복귀)을 일관되게 만든다.
- 사용자 가치(H/M/L): H
- 구현 노력(S/M/L): M
- 리스크/주의: 포커스 관련 회귀가 생길 수 있음 → 모달별 점진 적용(가장 자주 쓰는 모달부터).
- 코드/패턴 연결: [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx) + [src/shared/services/sync/firebase/strategies.ts](src/shared/services/sync/firebase/strategies.ts) (디자인 고려: 모달/상태 변화가 동기화 UX에 미치는 영향).

---

# Quick wins Top 5 (근거 1줄씩)
1) U3 만회 배너 단순화 — 문구/버튼 재구성 중심이라 UI-only로 빠르고, ADHD 죄책감(회피)을 즉시 줄임.
2) U2 주차 라벨/이번 주 시작 안내 — 헤더 정보 추가만으로 “리셋 혼란”을 크게 줄이는 고ROI.
3) F8 오늘만 보기 필터 — 리스트 노이즈를 즉시 컷해서 시작 장벽을 낮춤(토글 1개).
4) A2 포커스 가시성 강화 — 실수/스트레스 감소 체감이 크고 스타일 변경 위주.
5) F3 복귀 버튼 — 실패 후 재진입(복귀) 비용을 최소화하는 핵심 가드레일.

# 장기 투자 3개 (근거 1줄씩)
1) F2 마이크로스텝 Phase 2(영구화) — 데이터까지 완성되면 장기 지속/재방문에 복리로 기여.
2) U5 2단계 모달 — 결정 피로를 구조적으로 줄여 목표 생성/편집 성공률을 올림.
3) A5 모달 접근성 통합 — UX 신뢰 기반(예측 가능성)을 만들고 다른 모달에도 확장 가능.

---

## Dependencies (High-level)
- UI-only 범위 내: 기존 weeklyGoalStore/weeklyGoalRepository/systemState 키를 재사용하고, **새 영구 상태가 필요하면 Dexie systemState 경유**.
- 데이터 스키마 확장이 필요한 항목(F2/F4 등)은 별도 마이그레이션/싱크 전략 업데이트가 필요하므로 **후속 스코프로 분리**.

## Validation (High-level)
- 기존 vitest 기반에서 스토어/유틸 로직은 단위 테스트로 보호.
- UI 단은 별도 jsdom/@testing-library/react 구성이 필요할 수 있으나(현 설정 제약), 최소한의 런타임 회귀는 smoke 테스트로 커버.

## Version Management Milestone
- 실제 PR 반영 묶음에서 `package.json` 버전과 CHANGELOG(있다면)를 **Target Release(1.0.179 제안)** 라인에 맞춰 정합성 유지.
