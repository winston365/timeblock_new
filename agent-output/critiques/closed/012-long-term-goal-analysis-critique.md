# Critique — 012-long-term-goal-analysis

Artifact path: [agent-output/analysis/012-long-term-goal-analysis.md](../analysis/012-long-term-goal-analysis.md)
Date: 2025-12-21
Status: Initial

## Changelog
| Date | Handoff/Request | Summary |
|---|---|---|
| 2025-12-21 | User: “장기목표 기능 개선안 리스크/우선순위 평가 + Top 5” | 분석 문서를 기반으로 개선안을 Quick win vs 구조개선으로 패키징하고 리스크/비용/의존성 평가, 프로젝트 규칙 위반 리스크 체크, 스프린트 Top 5 권고 정리 |

## Value Statement Assessment
- 현재 아티팩트는 “개선안(Plan)”이 아니라 “현행 UX/데이터 플로우 분석 + 리스크 버킷”에 초점이 맞춰져 있어, 실행 가능한 우선순위/의존성/롤백 관점의 ‘작업 패키지’가 부족합니다.
- 다만, 개선 타깃(사용성/성능/정합성/유지보수/버그 가능성)과 검증 방법을 구조화해 둔 점은 이후 Plan으로 전환하기에 좋은 기반입니다.

## Overview
- 장기목표(weekly goals)와 일일/글로벌 goals가 공존하며 의미론이 분리되어 있습니다(수동 카운터 vs 작업 기반 시간/완료 추적).
- 장기목표 UI는 조작면(quick +/- + 직접 입력 + 편집/삭제/히스토리)이 많아 ADHD-friendly 목표와 충돌 가능성이 있습니다.
- 데이터 측면에서는 “주 시작(월요일) 경계 자동 리셋 + Firebase bulk sync” 패턴이 가장 큰 정합성/동기화 리스크 후보입니다.

## Architectural Alignment
- 시스템 원칙(Repository 경계, Local-first, EventBus 발행 규칙, systemState 저장 위치 등)은 [agent-output/architecture/system-architecture.md](../architecture/system-architecture.md)와 대체로 정합합니다.
- 다만 아래 항목은 아키텍처/UX 규칙과의 잠재 충돌(또는 문서화 누락)이 있습니다.
  - **모달 UX 통일**: 삭제 확인이 `confirm()` 기반이면 “앱 모달 UX”와 불일치(키보드/ESC/포커스/비동기 흐름) 가능성이 큼.
  - **defaults.ts 단일 출처**: 입력/클램프/디바운스 같은 ‘기본값’이 도입될 경우 하드코딩이 재발하기 쉬우며, Plan 단계에서 defaults 출처를 명시해야 함.
  - **optional chaining**: 중첩 객체(예: goal.history, settings 등) 접근에서 안전 패턴을 강제하는 체크리스트가 Plan에 포함되어야 함.

## Scope Assessment (Quick win vs 구조개선 패키지)

### Quick win (1~2 PR로 효과)

1) 삭제/위험 액션의 확인 UX 표준화(Confirm Modal)
- 기대효과: 실수 삭제 방지 + UX 일관성(키보드/ESC 포함) + 향후 다른 기능에도 재사용 가능
- 리스크
  - 회귀: 낮음(표면 UX만 교체)
  - 데이터 손상: 낮음
  - UX 혼란: 낮음(오히려 일관성 상승)
- 비용: 낮음~중간(모달 컴포넌트/훅 재사용 여부에 따라)
- 의존성: 모달 표준(배경 클릭 X, ESC 닫기) 준수 필요. 기존 GoalsModal의 중첩 모달(목표 편집/히스토리)과 포커스/ESC 우선순위 정의 필요.
- 규칙 체크
  - localStorage: 영향 없음
  - defaults.ts: 영향 없음
  - optional chaining: 영향 없음
  - 모달 UX: 개선 포인트(현재 `confirm()` 사용 시 위반 가능성)

2) 장기목표 진행값 검증/클램프(0 하한 + 타깃 상한 + 입력 정규화)
- 기대효과: 데이터 정합성 강화(타깃 초과/음수/NaN 누적 방지), UI가 예측 가능해짐
- 리스크
  - 회귀: 낮음(숫자 범위만 제한)
  - 데이터 손상: 낮음(기존 비정상 값이 있었다면 표시/동작이 달라질 수 있음)
  - UX 혼란: 낮음(단, 기존에 타깃 초과를 허용하던 사용자에게는 변화)
- 비용: 낮음
- 의존성: “타깃 초과를 허용하는가?” 제품 정책 결정 필요(허용 시 ‘소프트 경고’로 전환)
- 규칙 체크: defaults.ts 필요 없음(고정 규칙), optional chaining 주의(타깃 null/undefined)

3) Week reset(주차 리셋) 안전성 가드 + 가시화(로그/알림은 최소)
- 기대효과: 시계 오차/복수 디바이스에서 의도치 않은 리셋 및 히스토리 꼬임을 조기에 발견 가능
- 리스크
  - 회귀: 낮음~중간(리셋 조건/순서를 건드리면 영향 큼)
  - 데이터 손상: 중간(히스토리 중복/스킵이 이미 민감)
  - UX 혼란: 낮음(가시화는 디버그/로그 중심이면)
- 비용: 중간
- 의존성: 동기화 정책(단일 writer 가정 여부), 디바이스 시간 신뢰 수준 정의 필요
- 규칙 체크: localStorage 금지(설정/플래그 도입 시 systemState), optional chaining(히스토리)

4) 장기목표 조작(quick +/-)의 과도한 동기화 호출 완화(저위험 디바운스/배치)
- 기대효과: 클릭 연타 시 성능/네트워크/배터리 개선, Firebase 비용 절감 가능
- 리스크
  - 회귀: 중간(동기화 타이밍 변경 → 크래시/앱 종료 시 마지막 변경 유실 위험)
  - 데이터 손상: 중간(동시 디바이스에서 overwrite 경쟁 가능성)
  - UX 혼란: 낮음~중간(즉시 반영 vs 저장 지연 체감)
- 비용: 중간
- 의존성: 동기화 계층(디바운스 정책, flush 타이밍, 종료 시 flush)과의 결합이 큼. RTDB 폭주 완화 작업(계측/게이트)와 우선순위 조율 권장.
- 규칙 체크: defaults.ts(디바운스 ms 기본값) 단일 출처 필요 가능성 높음.


### 구조 개선(리팩터/아키텍처 수준)

A) “주간(수동 카운터) vs 글로벌(작업 기반)” 목표 의미론 단일화
- 기대효과: 사용자 혼란 감소(목표가 하나의 모델로 설명됨), 코드/스토어/구독자/핸들러 부채 감소
- 리스크
  - 회귀: 높음(여러 UI/스토어/서비스/핸들러 체인 연쇄 영향)
  - 데이터 손상: 중간~높음(기존 데이터 마이그레이션/호환 정책 필요)
  - UX 혼란: 중간(사용자 기대치 변화)
- 비용: 높음
- 의존성: Task completion pipeline, goalSubscriber, 저장소(weeklyGoals/globalGoals) 동시 변경 가능성. 스키마/마이그레이션 정책 필요.
- 규칙 체크: defaults.ts(새 정책 기본값), optional chaining(이력/마이그레이션), systemState 키 관리 필요.

B) 동기화 전략 표준화(Goals 도메인에 대한 Firebase sync throttle/merge 정책)
- 기대효과: overwrite/race 감소, 비용/성능 안정화, 장애 대응 용이
- 리스크: 중간~높음(동기화는 교차 도메인 영향)
- 비용: 중간~높음
- 의존성: RTDB 다운로드 누수 완화 Phase(계측/게이트/리스너 위생)와 직접 결합됨. 병렬 추진 시 충돌 위험.

C) 과거 날짜 목표 재계산/히스토리 정책 명시(Backfill/재집계)
- 기대효과: “지난 작업 수정” 시 목표/통계 불일치 감소
- 리스크: 중간(성능/복잡도 상승, 데이터 재기록 위험)
- 비용: 중간
- 의존성: dailyData/tasks의 과거 변경 이벤트 수집 방식(EventBus/Subscriber) 정합 필요.

## Technical Debt / Policy Risks (프로젝트 규칙 관점)
- localStorage 금지(테마 예외): 장기목표 개선에서 ‘토글/실험 플래그/디바운스 옵션’을 넣게 되면 localStorage로 빠질 위험이 높음 → 반드시 systemState + Repository를 계획에 명시해야 함.
- defaults.ts 단일 출처: 숫자 기본값(디바운스 ms, 자동 리셋 정책, 상한 클램프 정책 등)이 하드코딩될 위험이 높음 → Plan에 “defaults.ts에 추가/사용”을 AC로 포함 권장.
- optional chaining: goals/history/settings는 중첩 구조가 많고, 로딩 전 null 가능성이 높음 → Plan 체크리스트에 ‘중첩 optional’ 점검을 필수화 권장.
- 모달 UX 통일: `confirm()`은 앱 모달 규칙(ESC/포커스/배경클릭 금지/일관된 닫기 버튼)을 우회할 수 있음 → Quick win 1순위로 교체 권장.

## Priority Recommendation — 이번 스프린트 Top 5
1) Confirm UX 표준화(삭제/위험 작업) — 회귀 낮고 UX 가치 큼
2) 진행값 검증/클램프(입력 정규화 포함) — 데이터 정합성/버그 방어선
3) Week reset 안전성 가드(중복/스킵 탐지 중심) — 데이터 손상 리스크 직접 저감
4) 장기목표 progress 업데이트 동기화 완화(저위험 디바운스) — 성능/비용 개선, 단 flush/경쟁정책을 최소로 문서화
5) (스프린트 착수 수준) 목표 의미론 단일화의 Decision 문서화(어느 모델을 정본으로?) — 구현 착수는 다음 스프린트로 미루되, 방향이 없으면 Quick win이 다시 부채로 쌓임

## Questions (blocking/clarifying)
1) “장기목표 개선안”의 범위는 weekly goals(수동 카운터)만인가요, 아니면 global goals(작업 기반)까지 포함인가요?
2) 목표 progress가 target을 초과하는 것을 허용해야 하나요? (허용이면 클램프 대신 경고/표시 정책 필요)
3) 동기화 지연(디바운스) 시, 앱 종료/크래시에서 ‘마지막 입력 유실’ 허용 범위는?

## Risk Assessment (summary)
- 전체 리스크는 ‘의미론 단일화’와 ‘동기화/정합성 정책 변경’에서 급증합니다.
- 이번 스프린트는 UX 일관성/정합성 방어선(Confirm/클램프/리셋 가드) 중심으로 “작게, 되돌리기 쉬운” 범위가 가장 안전합니다.

## Notes
- Critic 프로세스 요구사항 중 `.github/chatmodes/planner.chatmode.md`를 워크스페이스에서 찾지 못했습니다(파일 부재 또는 exclude 가능). 향후 리뷰 일관성을 위해 위치/존재를 확인 권장.
