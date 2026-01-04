# 템플릿 기능 개선 제안 최종본 (15개)

| 항목 | 값 |
|------|-----|
| Plan ID | plan-2025-12-23-template-improvements-15-final |
| Target Release | **1.0.167 (제안; 현재 package.json = 1.0.166)** |
| Epic Alignment | 템플릿 UX/데이터 흐름 안정화 (로컬 퍼스트) |
| Date | 2025-12-23 |
| Status | Proposed |
| Inputs | 기존 15개 제안 + Critic 피드백(난이도/리스크 조정, localStorage 금지, 모달 UX, 통합 후보, Quick wins/중기 재분류, ADHD 친화 3개 통합) |

---

## Value Statement and Business Objective
As a 로컬 퍼스트 TimeBlock 사용자(특히 ADHD 성향 사용자), I want to 템플릿으로 반복 작업을 빠르고 안정적으로 생성/관리하고 오늘 해야 할 일에 자연스럽게 연결할 수 있도록 개선해서, so that 결정 피로를 줄이고(선택을 쉽게) 반복 루틴 실행을 꾸준히 유지할 수 있다.

---

## 범위/정책(필수 준수)
- 로컬 퍼스트 범위만 다룸 (Supabase/Electron IPC는 **고려사항**으로만 언급).
- **localStorage 금지(theme 키 제외)** → 상태/설정/기억은 Dexie `systemState` 사용(예: `getSystemState/setSystemState`).
- **하드코딩 기본값 금지** → 기본값은 `src/shared/constants/defaults.ts`에서 가져오기.
- 중첩 객체 접근은 **optional chaining**을 기본으로 사용.
- 모달 UX 정책: 배경 클릭 닫기 금지, ESC 닫기 필수. 미리보기/확인은 **중첩 모달 대신 인라인 패널 우선**.

---

## 스코어 기준
- 점수: 가치/난이도/리스크/효과 = 1(낮음) ~ 5(높음)
- 우선순위: P0(즉시), P1(다음), P2(후순위)

---

## A. 추가기능 10개

| ID | 제안 | 우선순위 | 가치 | 난이도 | 리스크 | 효과 | 한 줄 근거 | 손댈 코드 영역(1~2) |
|---:|------|:--:|:--:|:--:|:--:|:--:|------|------|
| 1 | **단일 파이프라인(템플릿→Task) 통합** | P1 | 5 | **4** | **5** | 5 | 저장소/상태 흐름이 갈라져 있으면 확장할수록 불안정해짐 (※ #12와 통합 실행 권장) | `src/shared/stores/templateStore.ts`, `src/features/template/TemplatePanel.tsx` |
| 2 | **자동생성: 앱 부팅/데일리 타이밍에 1회 실행 + 중복 방지 강화** | P1 | 4 | **3** | **4** | 4 | 트리거/중복 방지가 불명확하면 신뢰도가 무너짐 (※ “부드러운 시작 알림” 고려사항 포함) | `src/data/repositories/templateRepository.ts`, `src/App.tsx` |
| 3 | **미리보기+실행확인(인라인 프리뷰 패널)** | P1 | 4 | 3 | 3 | 4 | 모달 중첩 없이 결과를 예측 가능하게 해 실수 생성/삭제를 줄임 (※ #2와 묶어 UX 흐름 정리 권장) | `src/features/template/TemplatesModal.tsx`, `src/features/template/TemplatePanel.tsx` |
| 4 | **실행 로그/최근 생성 기록 + 시간 추정 학습 피드백(ADHD)** | P2 | 4 | 3 | 3 | 4 | “예상 vs 실제” 피드백은 ADHD의 시간 과소평가를 줄여 루틴 지속에 도움 | `src/data/repositories/systemRepository.ts`, `src/features/template/TemplatesModal.tsx` |
| 5 | **빠른 생성 1단계(기본정보만) + 준비(preparation) 후속 유도** | P2 | 3 | 3 | 3 | 3 | 속도는 올리되 preparation을 버리지 않고 ‘나중에 보완’으로 ADHD 가치 훼손을 방지 | `src/features/template/TemplateModal.tsx`, `src/shared/constants/defaults.ts` |
| 6 | **복제 + 즉시 편집(바로 수정 흐름)** | P2 | 3 | 2 | 2 | 3 | 반복 루틴은 “비슷한 템플릿 조금만 수정”이 많아 편집 진입 비용을 줄이면 효과 큼 (※ #14와 UI 통합 권장) | `src/features/template/TemplatesModal.tsx`, `src/features/template/TemplatePanel.tsx` |
| 7 | **준비 체크리스트를 Task에 반영/표시(ADHD 방해물 대응 유지)** | P1 | 4 | **4** | **4** | 4 | preparation이 Task에 존재해도 UI에 안 보이면 기능 가치가 사실상 사라짐 | `src/features/schedule/TaskCard.tsx`, `src/data/repositories/templateRepository.ts` |
| 10 | **일괄 추가(멀티선택)로 여러 템플릿을 한 번에 ‘오늘 할 일’로** | P1 | 4 | 3 | 3 | 4 | 루틴은 ‘세트’로 실행되는 경우가 많아 멀티선택은 체감 개선이 큼 | `src/features/template/TemplatesModal.tsx`, `src/shared/stores/templateStore.ts` |
| 12 | **진입점 통합(Panel↔Modal 상태/흐름 일치)** | P1 | 5 | **4** | **4** | 5 | 진입점이 다르면 같은 기능도 다르게 느껴지고 버그가 반복됨 (※ #1과 통합 실행 권장) | `src/features/template/TemplatePanel.tsx`, `src/features/template/TemplatesModal.tsx` |
| 15 | **안전한 삭제 UX(확인/Undo/소프트 삭제 옵션)** | P1 | 4 | 2 | 3 | 4 | 삭제는 되돌리기 없으면 신뢰를 잃기 쉬워 ‘안전장치’가 필수 | `src/shared/stores/templateStore.ts`, `src/features/template/TemplatesModal.tsx` |

---

## B. UI/UX 개선 5개

| ID | 제안 | 우선순위 | 가치 | 난이도 | 리스크 | 효과 | 한 줄 근거 | 손댈 코드 영역(1~2) |
|---:|------|:--:|:--:|:--:|:--:|:--:|------|------|
| 8 | **유효성 강제(필수값/최솟값/주기 설정)로 “잘못된 템플릿” 방지** | P0 | 4 | 2 | 2 | 4 | 잘못된 템플릿은 자동생성/실행에서 폭발하므로 초기에 차단하는 게 RoI가 큼 | `src/features/template/TemplateModal.tsx`, `src/shared/constants/defaults.ts` |
| 9 | **정렬 + 기본 정렬 기억(= systemState) + “오늘 집중 템플릿” 하이라이트(ADHD)** | P0 | 4 | 2 | 2 | 4 | 선택 장애를 줄이려면 “오늘 할 것”이 먼저 보여야 함 (※ #11과 통합 실행 권장) | `src/features/template/TemplatesModal.tsx`, `src/data/repositories/systemRepository.ts` |
| 11 | **TemplatePanel 검색/필터(TemplatesModal 수준으로 최소 이식)** | P0 | 4 | 2 | 2 | 4 | 패널에서도 찾을 수 있어야 “모달을 열어야만 하는” 마찰이 줄어듦 (※ #9와 통합 권장) | `src/features/template/TemplatePanel.tsx`, `src/features/template/TemplatesModal.tsx` |
| 13 | **폼 단계별 에러 문구/가이드(3단계 UX 개선)** | P0 | 4 | 2 | 2 | 4 | ‘왜 다음으로 못 가는지’ 즉시 알려주면 이탈이 크게 줄어듦 | `src/features/template/TemplateModal.tsx`, `src/shared/constants/defaults.ts` |
| 14 | **카드 핵심 요약(반복/자동/준비/소요) + 액션 버튼 정리** | P0 | 4 | 2 | 1 | 4 | 한 눈에 요약되면 ADHD 사용자의 스캔 비용이 급감 (※ #6과 UI 통합 권장) | `src/features/template/TemplatePanel.tsx`, `src/features/template/TemplatesModal.tsx` |

---

## 실행 제안 (재정렬)

### 빠른 성과(1~2일) 5개
- **#8 유효성 강제**: TemplateModal 내부 중심, 의존성 낮음
- **#13 단계별 에러 문구**: UX 체감 즉시, 리스크 낮음
- **#14 카드 핵심 요약**: 순수 UI 비중 높고 빠름
- **#11 TemplatePanel 검색/필터**: 기존 modal 로직 일부 이식으로 빠르게 구현 가능
- **#9 정렬/기억 + 오늘 집중 하이라이트**: systemState 활용, 독립 실행 가능

### 중기(1~2주) 5~7개
- **(#1 + #12) 데이터 흐름/진입점 통합**: 저장소 접근 이원화 해소를 선행으로 묶어서 진행
- **(#2 + #3) 자동생성 트리거 + 인라인 프리뷰/확인**: 중복 실행 방지/UX 신뢰도까지 함께 완성
- **#4 실행 로그 + 시간 추정 학습 피드백(ADHD)**: systemState 기반으로 단계적으로 확장
- **#7 준비 체크리스트 Task 표시**: schedule task 카드/메타데이터 영향이 큼
- **#10 멀티선택 일괄 추가**: 상태 관리/선택 UI가 필요
- **#15 안전한 삭제 UX(Undo 포함 시)**: soft delete/복구 타이밍 등 설계 필요
- (선택) **#5 빠른 생성 1단계**: ADHD 가치 훼손이 없도록 “후속 준비 유도”까지 포함했을 때만 착수

---

## 의존성/리스크 메모
- **선행 조건(중요)**: #1 착수 전, TemplatePanel/TemplateModal의 “저장소 직접 호출”과 TemplatesModal의 “store 경로”가 섞여 있는 상태를 정리해야 함.
- **데이터 저장 정책**: #9/#4 같은 “기억/로그”는 localStorage 대신 `systemState`로 저장.
- **모달 UX**: #3은 중첩 모달을 피하고, ESC 닫기 정책을 자연스럽게 지키는 인라인 패널 우선.
- **Electron 알림(고려사항)**: “부드러운 시작 알림”은 UI/설정은 로컬 퍼스트로 가능하지만, 실제 OS 알림은 Electron main/preload 연동이 필요할 수 있음(본 문서는 UI 제안 범위).

---

## OPEN QUESTION (정리)
- 자동생성 트리거는 앱 시작 시점/데일리 리셋/기타 subscriber 중 어디에 두는 것이 운영 정책과 맞나?
- 템플릿 실행 결과(Task 생성)의 저장 위치(인박스 vs 스케줄)는 현재 규칙을 유지할지, 선택 옵션을 둘지?
- #15 Undo를 “소프트 삭제(타이머)”로 할지 “휴지통”으로 할지?
