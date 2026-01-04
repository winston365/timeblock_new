# 008-firebase-rtdb-download-leak-pr-breakdown — Critique

- Artifact: `agent-output/planning/008-firebase-rtdb-download-leak-pr-breakdown.md`
- Context docs checked:
  - `agent-output/architecture/004-firebase-rtdb-mitigation-phased-architecture-findings.md`
  - `agent-output/analysis/011-firebase-rtdb-download-spike-analysis.md`
  - `agent-output/architecture/system-architecture.md`
  - Critic 모드 요구사항 중 `.github/chatmodes/planner.chatmode.md`를 매 리뷰 시작에 읽어야 하나, 워크스페이스에 해당 파일이 존재하지 않아 확인 불가.
- Date: 2025-12-18
- Status: Initial

## Changelog
| Date | Request / Handoff | Summary |
|---|---|---|
| 2025-12-18 | Critic review | PR 단계화(계측→킬스위치→리스너 정리→범위축소→가드레일) 접근을 검증하고, 잘못된 가정/데이터 손실 위험/증거요건/회귀 체크리스트를 추가 요구사항으로 정리 |

## Value Statement Assessment
- **존재/명확성**: “저장량 대비 과도한 다운로드 방지 + 비용/성능 리스크 감소”로 가치가 명확함.
- **부족한 점(중요)**: 성공 기준이 정량화되어 있지 않음(예: 세션당 다운로드 추정치, 경로별 이벤트 빈도, 1창/2창 배수 여부). “얼마나 줄이면 출하 가능한가”가 빠져 Phase 0/1의 종료조건이 모호해질 위험.

## Overview
문서의 단계적 접근(Phase 0 containment → Phase 1 계측 → Phase 2 정합성 수정 → Phase 3 가드레일)은 ADR-006과 정합적이며, “작게/되돌리기 쉽게” PR 분해도 좋습니다. 다만 **계측 자체가 비용/리스크를 키우거나**, **containment가 근본 원인을 가리는 채로 장기화**되는 전형적 실패 패턴을 방지하기 위한 “출시 전 증거 게이트”가 추가로 필요합니다.

## Architectural Alignment
- **정렬됨**: local-first(Dexie=SoT) + Firebase sync는 보조라는 전제, systemState 기반 플래그 저장, UI에서 Firebase 직접호출 금지, 경계 유지 등은 아키텍처 문서와 일치.
- **주의점**: “멀티윈도우(QuickAdd 등) 중복 리스너”는 Electron 특성상 구조적 리스크인데, PR#3에서 (선택)으로 남겨두면 Phase 0/1에서도 다운로드 배수 문제가 지속될 수 있음.

## Scope Assessment
- 계획 문서가 파일 후보/구현 지점까지 포함해 **HOW** 성격이 강합니다. (Plan은 WHAT/WHY 중심이 바람직)
- 다만 이번 주제는 사고성 비용 이슈라 “작은 PR 분해 + 롤백 전략” 자체가 핵심 가치이므로, HOW 상세를 줄이되 **검증 기준/증거요건/회귀 매트릭스**를 더 강화하는 방향이 적합합니다.

## Technical Debt Risks
- **계측 부작용**: 스냅샷을 `JSON.stringify`/Blob 변환 등으로 크기 추정하면 CPU/메모리/GC가 급증할 수 있고, 로그 저장이 잦으면 Dexie write 폭주(→ 추가 sync 트리거 가능성)로 2차 문제를 만들 수 있음.
- **Safe Mode의 장기화**: “다운로드는 줄었지만 동기화 정합성/멀티디바이스 최신화”가 잠재적으로 망가진 상태가 길어질 위험.
- **부분 업데이트/범위 축소의 데이터 모델 리스크**: 루트 onValue를 잘게 쪼개거나, 전체 업로드를 부분 업로드로 바꾸면 충돌 정책/병합 규칙이 명시되지 않을 때 데이터 유실/역전이 발생하기 쉬움.

---

## Findings

### Critical

#### C1. Containment 출하 기준(증거 게이트) 부재
- **Status**: OPEN
- **Description**: PR#2(킬스위치/게이트)만으로 “다운로드 폭주가 멈춘다”는 감은 얻어도, 원인 확정/재발 방지로 이어지는 증거 기준이 문서에 없음.
- **Impact**: containment가 장기화되어 근본 원인이 남거나, 특정 플로우/경로에서 여전히 비용이 폭주해도 놓칠 수 있음.
- **Recommendation**: Phase 0/1의 종료조건을 “경로별/세션별 정량 지표 + 1창/2창 비교 + 특정 사용자행동 시나리오”로 명시.

#### C2. ‘보이는 비용’만 줄이고 데이터 손실을 만드는 흔한 수정 위험
- **Status**: OPEN
- **Description**: (a) `syncToFirebase` 사전 `get()` 제거, (b) 루트 set/update 방식 변경, (c) 배열 전체 업로드를 어설프게 부분 업데이트로 전환 등은 비용은 줄이지만 충돌/병합 정책이 없으면 데이터 손실을 유발 가능.
- **Impact**: 멀티디바이스 동시 편집/오프라인 복귀 시 원격 변경이 덮어써지거나, 일부 필드/항목이 사라지는 “침묵형” 데이터 유실.
- **Recommendation**: Phase 2 변경(부분 업로드/프리겟 최적화/리스너 범위 축소)은 “충돌 정책(단일-writer 가정 여부, last-write 기준, merge 규칙)”을 먼저 문서화하고 그 전제 하에서만 허용.

#### C3. 계측(Observability)이 시스템을 더 악화시킬 수 있음
- **Status**: OPEN
- **Description**: 큰 스냅샷을 자주 직렬화하면 CPU/메모리 비용이 커지고, 로그 저장이 빈번하면 Dexie/렌더 성능 및 (구조에 따라) 동기화 트리거를 역으로 증가시킬 수 있음.
- **Impact**: “계측 ON이 폭주를 더 키우는” 역효과, 또는 성능 저하로 사용자 행동이 바뀌어 원인 재현이 왜곡.
- **Recommendation**: 계측은 반드시 상한/샘플링/경량화(헤더 수준 메타만) 원칙을 명시하고, “계측 ON/OFF가 네트워크 I/O에 영향을 주지 않는다”를 증거로 확인.

#### C4. 멀티윈도우/재초기화 중복 리스너는 ‘선택’이 아니라 1순위 가설
- **Status**: OPEN
- **Description**: Electron에서 동일 계정으로 2개 렌더러가 뜨면 리스너가 경로별로 N배 등록될 수 있음. 계획에서는 PR#3에서 일부를 선택사항으로 둠.
- **Impact**: root onValue + 전체 업로드 + pre-get이 결합될 때 다운로드가 “창 수 × 변경 횟수 × 스냅샷 크기”로 증폭.
- **Recommendation**: Phase 0/1 검증에 “1창 vs 2창 배수”를 필수로 포함하고, 중복 리스너 방지/해제(stopListening) 최소치가 containment와 동급 우선순위임을 문서에 명시.

### Medium

#### M1. ‘대형 경로 TOP 3’ 가정이 아직 데이터 기반이 아님
- **Status**: OPEN
- **Description**: completedInbox/globalInbox/templates/dailyData를 대형 후보로 두는 것은 타당하지만, 실제 폭주의 주범이 다른 경로(예: tokenUsage의 빈번 업데이트)일 수도 있음.
- **Impact**: 잘못된 경로를 먼저 차단/축소하면 비용은 남고 기능만 손상.
- **Recommendation**: Phase 1 계측 결과로 “TOP 경로 확정 → 그 경로만 Phase 2 대상화” 게이트를 강제.

#### M2. Safe Mode 기본값/배포 전략이 불명확
- **Status**: OPEN
- **Description**: 문서에 “OFF(현행) vs ON(보수)”가 오픈 질문으로 남아있음.
- **Impact**: 기본값이 ON이면 멀티디바이스 최신화/실시간성이 훼손될 수 있고, OFF이면 사고 대응 릴리즈에서 비용 폭주가 지속될 수 있음.
- **Recommendation**: 릴리즈 목적(사고 대응 hotfix vs 정상 기능 릴리즈)을 분리해 기본값 정책을 명시하고, 사용자에게 노출되는 UX/지원 정책을 합의.

### Low

#### L1. PR#6(버전/릴리즈 아티팩트)은 기능 PR과 강하게 결합하지 않도록 주의
- **Status**: OPEN
- **Description**: 버전만 올라가고 기능 누락되는 운영 리스크를 문서에서 이미 언급.
- **Impact**: 배포 추적 혼선.
- **Recommendation**: 기능 PR과 독립 유지 원칙을 계속 강조.

---

## Critical Checklist (출시 전 필수 점검)

### 1) 가장 가능성 높은 “오답 가정”
- **저장량이 작으니 다운로드도 작을 것**: RTDB는 루트 onValue/전체 스냅샷 재전송으로 “작은 저장량 × 반복”이 GB급이 될 수 있음.
- **콜백에서 deviceId로 스킵하면 비용이 줄 것**: 스킵은 처리 비용만 줄이고 **다운로드 자체**는 줄지 않음.
- **초기 fetch만 막으면 해결**: 실사용 중 잦은 쓰기 + 루트 리스너가 더 큰 원인일 수 있음.
- **대형 경로는 completedInbox/globalInbox/templates일 것**: 실제로는 작은 노드라도 초고빈도 업데이트면 더 비쌀 수 있음.
- **1창만 사용한다**: QuickAdd/멀티윈도우/재초기화로 배수 증폭 가능.

### 2) 문제를 숨기거나 데이터 손실을 유발하는 흔한 “수정”
- **전체 sync 끄기(킬스위치)만 배포하고 원인 추적을 미룸**: 비용은 줄지만 재발/누락이 확정.
- **`pre-get` 제거로 곧장 쓰기 단순화**: 충돌이 사라지는 게 아니라 “조용한 덮어쓰기”로 바뀜.
- **set/update/merge 방식 변경을 테스트 없이 적용**: RTDB에서 update는 필드 삭제/배열 처리에 함정이 많아 유실 위험.
- **루트 리스너를 무조건 child 이벤트로 대체**: 데이터 모델이 배열/중첩인 경우 정합성 깨지기 쉬움.
- **계측을 항상 ON**: 성능/스토리지/2차 폭주를 초래.

### 3) Local-first(Dexie) + Sync 구조에서의 고유 리스크
- **오프라인 편집 후 재연결**: 로컬 변경이 누적되면 재연결 시 대량 업로드/대량 리스너 이벤트로 폭주.
- **멀티디바이스 동시 편집**: 충돌 해결이 명시되지 않으면 “마지막 업로드가 승리”하며 데이터 역전/유실.
- **배열 중심 모델(인박스/템플릿/완료함)**: 부분 업데이트가 어렵고 전체 업로드로 폭주하기 쉬움.
- **로그/계측 데이터의 동기화 루프**: 로컬 로그가 sync 대상이면 비용 폭주를 자기증폭.
- **리스너 중복**: 창/세션/재초기화마다 누적되면 비용이 선형이 아니라 배수로 증가.

### 4) Containment(Phase 0/1) 출하 전 요구되는 “증거”
- **경로별 상위 3개 다운로드 원인**이 계측으로 확정됨(가설이 아닌 데이터).
- **1창 vs 2창(QuickAdd 포함) 비교**에서 리스너 수/이벤트 수가 배수로 증가하지 않음(또는 증가 시 차단 가능).
- **킬스위치/세이프모드 ON** 시:
  - RTDB 읽기 이벤트(추정 bytes, onValue/get 횟수)가 즉시 평탄화.
  - 앱 핵심 UX(로컬 작업 생성/완료/편집)가 깨지지 않음.
- **세이프모드 OFF(현행)** 대비 회귀가 “기대되는 범위”로 문서화됨(실시간 최신화 감소 등).
- **계측 ON이 네트워크 I/O를 추가하지 않는다**는 확인(로그는 로컬에만, 동기화 대상 아님).

### 5) 회귀(Regression) 감시 포인트
- **오프라인 모드**: 비행기모드/재연결 시 데이터 누락/중복/폭주.
- **멀티디바이스**: A/B 기기에서 같은 작업을 동시에 편집 후 정합성(특히 배열 기반 노드).
- **충돌 해소**: `syncToFirebase` pre-get 정책 변경 시 conflict resolver가 여전히 유효한지.
- **멀티윈도우(QuickAdd)**: 창 종료/재열기/설정 변경 재초기화로 리스너 누적이 없는지.
- **초기화 경로**: 로그인/로그아웃/계정 전환/설정 저장 후 재초기화에서 stopListening이 보장되는지.

## Questions (해결 전까지 출하 보류 권고)
1) “출하 가능” 판정 기준: 세션당 다운로드/분당 이벤트/대형 경로 bytes 등 임계치가 무엇인가?
2) Safe Mode 기본값은 사고 대응 릴리즈에서 ON인가, 일반 릴리즈에서 OFF인가?
3) 멀티윈도우 리스닝 정책: 리더 1개 강제(soft lock)까지 Phase 0에 포함할 의지가 있는가?
4) 배열 기반 노드의 정합성 정책(merge/삭제/순서)은 문서로 존재하는가?

## Risk Assessment
- **Cost Risk**: HIGH (원인 미확정 시 재발 확률 높음)
- **Data Loss Risk**: HIGH (Phase 2 변경이 충돌 정책 없이 진행되면)
- **UX Risk**: MEDIUM~HIGH (Safe Mode 기본값/실시간성 저하)
- **Maintainability Risk**: MEDIUM (계측/플래그 난립 시)

## Recommendations
- Phase 0/1에 “증거 게이트(정량 지표 + 재현 시나리오 + 1창/2창)”를 문서에 추가하고, 그 전까지는 기능 변경(Phase 2)을 제한.
- Phase 2(부분 업로드/프리겟 최적화/리스너 범위 축소)는 **충돌/병합 정책 문서화** 없이는 진행 금지.
- 계측은 성능/저장/동기화 루프에 대해 스스로 안전함을 증명해야 하며, 기본 OFF 원칙을 강제.

## Revision History
- Initial (2025-12-18): 체크리스트/리스크/증거요건 중심으로 계획 보강 요구사항 도출.
