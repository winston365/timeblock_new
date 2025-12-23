# QA Report: BossDefeatOverlay useModalHotkeys 중복 제거

**Plan Reference**: `agent-output/analysis/027-boss-defeat-overlay-duplicate-import-analysis.md`
**QA Status**: Test Strategy Development
**QA Specialist**: qa

## Changelog

| Date | Agent Handoff | Request | Summary |
|------|---------------|---------|---------|
| 2025-12-23 | User | BossDefeatOverlay 중복 import/useModalHotkeys 중복 호출 제거 QA 시나리오 작성 | 수동 재현/검증 시나리오 + battle 영역 회귀 체크리스트 + 관찰 포인트 정리 |

## Timeline
- **Test Strategy Started**: 2025-12-23
- **Test Strategy Completed**: 2025-12-23
- **Implementation Received**: -
- **Testing Started**: -
- **Testing Completed**: -
- **Final Status**: Awaiting Manual Verification

## Test Strategy (Manual / User-facing)

### 수정 전 재현 시나리오 (2)
1) Dev 서버(또는 Electron dev)에서 전투 화면 진입 시 Vite 파서 에러로 화면이 깨지지 않는지 확인한다.
2) 빌드 파이프라인(`vite build`)에서 동일 식별자 중복 선언으로 빌드가 중단되는지 확인한다.

### 수정 후 확인 시나리오 (5)
1) Dev 서버에서 전투 흐름(보스 처치 연출)까지 정상 진입된다.
2) 오버레이에서 ESC로 닫힌다(1회 입력에 1회 닫힘).
3) 중첩 모달(예: BossAlbumModal 등)이 있을 때 ESC는 top-of-stack만 닫는다.
4) 배경(오버레이 바깥) 클릭으로 닫히지 않는다(모달 UX 정책 위반 여부 확인).
5) 선택 단계(select)에서 난이도 버튼 클릭은 정상 동작하고, 버튼 클릭이 오버레이 전체 클릭 핸들러에 의해 의도치 않게 닫히지 않는다.

### 회귀 체크리스트 (battle 관련 포함, 6)
- BossAlbumModal: ESC 닫기 동작/중첩 상세(보스 상세) 우선 닫기 유지
- MissionModal: ESC 닫기 동작 유지(핫키 훅 스택 충돌 없음)
- BattleSidebar: 보스 처치 후 오버레이가 1회만 표시되고, 닫힌 뒤 재오픈이 정상
- 오버레이 타이머(auto-close) 동작: 선택 단계가 아닐 때 자동으로 닫힘 유지
- 사운드/토스트: 보스 처치 사운드/토스트가 중복 재생되지 않음
- 키보드 이벤트 누수: 오버레이 종료 후 ESC/Enter 단축키가 다른 화면에 잔류 적용되지 않음

### 추가로 확인하면 좋은 로그/포인트 (3)
- `useModalHotkeys` 등록/해제 로그(모달 스택 push/pop 및 현재 depth)
- `onClose` 호출 횟수(ESC 1회당 1회 호출 보장) 및 타이머/클릭 경로별 호출 출처
- DevTools 콘솔: keydown 핸들러 중복 등록 경고, React state update on unmounted 등 경고 유무

## Handing off to uat agent for value delivery validation
