---
ID: 56
Origin: 56
UUID: 9f3d7a1c
Status: Active
---

# 임시스케쥴 개선 제안서 (최종 / 채팅용)

## 목적 (Value Statement)
- As a 사용자(특히 ADHD 사용자), I want 임시스케쥴을 “빠르게 잡고, 쉽게 수정하고, 필요하면 안전하게 정규 작업으로 전환”할 수 있어, so that 계획-실행 흐름이 끊기지 않고 작은 성공을 계속 쌓을 수 있다.

## 범위/제약 (반드시 준수)
- **프론트엔드/UI 범위만**: 렌더러 UI, 클라이언트 로직(로컬 조회/상태 포함)까지만.
- Supabase/백엔드/Electron IPC/전역 단축키(main process)는 **구현 제안 금지**. 필요 시 **“후속 설계 고려”**로만 표기.

## 표기 규칙 (스캔용)
- Effort: **S/M/L (FE-only)**
- Impact: **L/M/H**
- ROI 표기: **Impact/Effort**로 간단 표기 (예: **H/S=최상**, **H/M=상**, **M/S=상**, **M/M=중**, **H/L=중**)

---

## (A) 추가기능 10

- **A1. 승격(Promote) 후 ‘임시 블록 처리’ 선택(삭제/임시함으로 이동/그대로 유지)**
   - What/Why: 승격 후 원본 임시블록이 남아 중복·잔존이 생기므로, 승격 흐름에 “후처리”를 포함.
   - ADHD-friendly value: 정리 완료감↑, 중복으로 인한 혼란↓.
   - Effort: S (FE-only)
   - Impact: H
   - ROI: H/S=최상

- **A2. 드래그 생성: ‘저장 전 확인(확정/취소)’로 클러터 방지 (Draft MVP)**
   - What/Why: 드래그만 했는데 기본명 블록이 저장되면 클러터가 생기므로, “확정 전에는 저장하지 않음”을 기본으로.
   - ADHD-friendly value: 실수 비용↓, 부담↓.
   - Effort: M (FE-only)
   - Impact: H
   - ROI: H/M=상

- **A3. Day/Week 타임라인 카드 ‘퀵 편집(인라인)’: 이름/시간/색 최소 필드**
   - What/Why: 매번 모달 진입은 전환 비용이 커서, 가장 자주 바꾸는 3가지만 즉시 수정.
   - ADHD-friendly value: 맥락 전환↓, 짧은 수정 루프 유지.
   - Effort: M (FE-only)
   - Impact: H
   - ROI: H/M=상

- **A4. 겹침/충돌 하이라이트(임시블록 ↔ 메인 스케줄 스냅샷), ‘5분 이상 겹침’ 기준**
   - What/Why: 충돌을 늦게 알아차리면 재계획 스트레스가 커지므로, 기준 이상 겹침 시 즉시 시각 경고.
   - ADHD-friendly value: “아, 겹치네” 즉시 인지 → 재작업↓.
   - Effort: S (FE-only)
   - Impact: M
   - ROI: M/S=상

- **A5. ‘인박스로 보내기’(Capture) 액션: 승격의 대안 루트로 제공(메모 포함)**
   - What/Why: 정규 작업으로 승격할 만큼 확정이 아니면, ‘버리지 않고 안전하게 보관’이 더 자연스러움.
   - ADHD-friendly value: 결정 유예가 가능해 부담↓.
   - Effort: S (FE-only)
   - Impact: M
   - ROI: M/S=상

- **A6. 반복 일정 드래그 이동 시 선택: ‘이번 1회만’ vs ‘전체 패턴’ (MVP는 기본값+토스트 안내)**
   - What/Why: 반복이 의도치 않게 풀리거나 전체가 바뀌면 신뢰가 깨지므로, 의도를 묻는 선택을 제공.
   - ADHD-friendly value: 예기치 못한 변화↓, 불신·혼란↓.
   - Effort: L (FE-only)
   - Impact: H
   - ROI: H/L=중

- **A7. 템플릿 즐겨찾기/고정(Pin) + ‘오늘 적용’ 원클릭(로컬 저장)**
   - What/Why: 자주 쓰는 루틴 템플릿 접근 비용을 줄여, “생각 없이 실행” 가능하게.
   - ADHD-friendly value: 실행 장벽↓, 루틴 유지↑.
   - Effort: S (FE-only)
   - Impact: M
   - ROI: M/S=상
   - 후속 설계 고려: 기기 간 동기화(필요 시)

- **A8. ‘내일로/다음 주로 미루기(Snooze +1/+7)’ 버튼(리스트/카드/메뉴)**
   - What/Why: 날짜 재배치는 자주 발생하므로, 달력 탐색 없이 한 번에 이동.
   - ADHD-friendly value: 결정 피로↓, 재배치 속도↑.
   - Effort: S (FE-only)
   - Impact: M
   - ROI: M/S=상

- **A9. ‘지금 기준 다음 빈 슬롯에 추가’ 원클릭(예: 다음 빈 30분)**
   - What/Why: 드래그 없이도 “지금 당장 넣기”가 가능하면 생성 마찰이 크게 줄어듦.
   - ADHD-friendly value: 시작 장벽↓, 즉시 실행↑.
   - Effort: S (FE-only)
   - Impact: H
   - ROI: H/S=최상

- **A10. 임시블록 ‘복제 후 수정’ 단축 액션(버튼/단축키) + 즉시 퀵 편집 연결**
   - What/Why: 유사 일정 연속 생성은 복제가 가장 빠르므로, 복제→즉시 최소 편집까지 한 흐름으로.
   - ADHD-friendly value: 반복 입력 피로↓, 속도↑.
   - Effort: S (FE-only)
   - Impact: M
   - ROI: M/S=상

---

## (B) UI/UX 5

- **B1. Day 뷰 메인 스냅샷(좌/우 분할) 가독성: 폭 조절/줌/접기**
   - What/Why: 스냅샷 폭이 좁으면 ‘인지’에 실패하므로, 정보가 “보이게” 만드는 조절 기능 제공.
   - ADHD-friendly value: 시각 과부하↓, 필요한 정보 찾는 시간↓.
   - Effort: M (FE-only)
   - Impact: M
   - ROI: M/M=중

- **B2. 핵심 액션 ‘호버/포커스 퀵버튼’ 노출(승격/인박스/삭제/색) + 컨텍스트 메뉴 유지**
   - What/Why: 오른쪽 클릭 탐색은 발견성이 낮으므로, 자주 쓰는 액션은 카드 위에서 즉시 실행.
   - ADHD-friendly value: 망설임↓, 클릭 수↓.
   - Effort: S (FE-only)
   - Impact: H
   - ROI: H/S=최상

- **B3. Add/Edit 모달 ‘스마트 기본값’(다음 빈 슬롯/최근 사용) + 즉시 미리보기**
   - What/Why: 입력을 시작하기 전에 기본값이 맞아 있으면 이탈이 줄어듦.
   - ADHD-friendly value: 시작 장벽↓, 완성률↑.
   - Effort: M (FE-only)
   - Impact: H
   - ROI: H/M=상
   - 제약 메모: 로컬 데이터 조회/계산만(원격 조회는 후속 설계 고려)

- **B4. Month 뷰 ‘정보 밀도 토글’: 기본은 간단(핵심 3개), 필요 시 펼치기**
   - What/Why: 한 화면에 너무 많으면 산만해지므로, 기본 상태를 “덜 보이게” 설계.
   - ADHD-friendly value: 한 화면 한 목표, 과부하↓.
   - Effort: S (FE-only)
   - Impact: M
   - ROI: M/S=상

- **B5. 템플릿 적용 전 ‘미리보기 + 영향 안내’(덮어쓰기/합치기/취소)로 실수 비용 최소화**
   - What/Why: 템플릿은 강력하지만 적용 실수는 치명적이므로, 적용 전 결과를 예측 가능하게.
   - ADHD-friendly value: 불안↓, 되돌리기 스트레스↓.
   - Effort: M (FE-only)
   - Impact: M
   - ROI: M/M=중

---

## (C) 접근성/빠른 접근 5

- **C1. 임시스케쥴 명령 팔레트(Command Palette): 검색으로 실행(추가/승격/인박스/정리/템플릿/미루기)**
   - What/Why: 단축키 기억 대신 검색 실행이 가능하면, 기능 접근 실패가 크게 줄어듦.
   - ADHD-friendly value: 기억 부담↓, 재진입↑.
   - Effort: M (FE-only)
   - Impact: H
   - ROI: H/M=상
   - 제약 메모: 렌더러 내부 키 처리만(전역 단축키 등록은 후속 설계 고려)

- **C2. 단축키 치트시트(‘?’) + 상황별 힌트(방해 최소, ESC로 즉시 닫기)**
   - What/Why: 학습 비용이 높으면 기능이 있어도 못 쓰므로, 필요할 때만 짧게 보여줌.
   - ADHD-friendly value: 외우지 않아도 됨, 좌절↓.
   - Effort: S (FE-only)
   - Impact: M
   - ROI: M/S=상

- **C3. 키보드 전용 이동/리사이즈(선택→화살표+수정키) + 정밀 스냅 피드백**
   - What/Why: 드래그가 어려운 환경/사용자를 위해, 키보드로도 동일 작업이 가능해야 함.
   - ADHD-friendly value: ‘정확히’ 조작 가능 → 짜증/포기↓.
   - Effort: L (FE-only)
   - Impact: H
   - ROI: H/L=중

- **C4. 색각/고대비 친화: 상태를 ‘색+패턴/아이콘/텍스트’로 중복 표현(WCAG 2.1 AA 지향)**
   - What/Why: 색만으로 구분하면 접근성이 떨어지므로, 의미를 다중 채널로 제공.
   - ADHD-friendly value: 한눈 구분↑, 실수↓.
   - Effort: S (FE-only)
   - Impact: M
   - ROI: M/S=상

- **C5. 스크린리더/포커스 흐름 강화(ARIA 라벨, 포커스 트랩/복귀, ESC 닫기 정책 통일)**
   - What/Why: 모달/오버레이가 많은 UI에서 포커스가 튀면 사용성이 급락하므로, 일관된 포커스 정책이 필요.
   - ADHD-friendly value: 길 잃음↓, “내가 어디였지” 감소.
   - Effort: M (FE-only)
   - Impact: M
   - ROI: M/M=중

---

## Quick Wins (이번 스프린트 추천) 3개
- **B2 호버/포커스 퀵버튼**: Effort S, 즉시 발견성·속도 개선.
- **A1 승격 후 처리 선택(삭제/임시함/유지)**: Effort S, 중복·클러터 즉시 감소.
- **A9 다음 빈 슬롯에 추가**: Effort S, 생성 마찰 최소화(“지금 바로” 실행).

## Top 7 우선순위 (Critic 반영, 소폭 조정)
1. **B2 호버/포커스 퀵버튼** (ROI 최상)
2. **A1 승격 후 처리 선택** (ROI 최상)
3. **A9 다음 빈 슬롯에 추가** (ROI 최상)
4. **A4 겹침/충돌 하이라이트(5분 기준)** (ROI 상)
5. **C2 단축키 치트시트(‘?’)** (ROI 상)
6. **A8 미루기(Snooze +1/+7)** (ROI 상)
7. **A7 템플릿 즐겨찾기/고정** (ROI 상)

## 리스크/트레이드오프 5개
- **호버 퀵버튼 클러터**: 화면 복잡도↑ 가능 → hover/focus 시에만 노출로 제어.
- **충돌 하이라이트 오탐/과잉 경고**: 짧은 겹침까지 경고하면 피로↑ → ‘5분 이상’ 기준, 토글/설정은 후속 고려.
- **명령 팔레트/단축키 충돌**: 기존 단축키와 겹치면 혼란↑ → 충돌 없는 트리거/스코프 정책이 필요.
- **반복 일정 선택 UX 복잡도**: 선택 모달이 잦으면 방해↑ → MVP는 기본값+Undo/토스트로 축소.
- **접근성/포커스 회귀 위험**: 모달/오버레이가 늘수록 포커스 버그↑ → ESC/포커스 복귀 원칙을 일관되게 유지.
