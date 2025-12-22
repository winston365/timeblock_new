# Value Statement and Business Objective
모달 키보드 표준화(ESC 닫기 + Ctrl/Cmd+Enter primary)의 실제 대상 파일 경로를 확정해, 아키텍처 문서의 placeholder를 제거하고 구현자가 바로 적용할 수 있도록 합니다.

Status: Planned

## Changelog
- 2025-12-22: 모달 핫키 표준화 대상 파일들의 실제 경로를 전부 검증해 보고.
- 2025-12-22: PR 분해 계획(013)에서 본 분석(대상 경로)을 사용하므로 Status를 Planned로 전환.

## Objective
- 아키텍처 문서 006에서 placeholder로 남은 모달 파일 경로를 **workspace-relative 실경로**로 확정.
- 누락된 경우, 수행한 검색 패턴과 미발견 사유를 명시.
- 구현자가 변경 범위를 즉시 파악할 수 있게 파일 리스트로 제공.

## Context
- 참조 문서: [agent-output/architecture/006-modal-hotkeys-standardization-architecture-findings.md](agent-output/architecture/006-modal-hotkeys-standardization-architecture-findings.md)
- 범위: ESC 스택 우회 모달 2개 + Ctrl/Cmd+Enter primary 단축키 구현 모달 5개 (총 7개), 그리고 공용 ESC 훅 1개.

## Root Cause (Systemic)
- 이전 결과에서 모달 파일 경로가 placeholder 상태로 남아 있어, 실제 적용 위치를 명확히 전달하지 못함.

## Methodology
- Glob 검색: `**/GoalsModal.tsx`, `**/BossAlbumModal.tsx`, `**/TaskModal.tsx`, `**/MemoModal.tsx`, `**/BulkAddModal.tsx`, `**/TaskBreakdownModal.tsx`, `**/ShopModal.tsx`.
- 목적: 아키텍처 문서에 언급된 모달 이름과 일치하는 실제 파일 경로를 확인.
- 모든 검색은 workspace root(./) 기준으로 수행.

## Findings (Fact)
- 공용 ESC 스택 훅: [src/shared/hooks/useModalEscapeClose.ts](src/shared/hooks/useModalEscapeClose.ts)
- ESC 스택 우회 사례(교체 대상)
  - [src/features/goals/GoalsModal.tsx](src/features/goals/GoalsModal.tsx)
  - [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx)
- Ctrl/Cmd+Enter primary 단축키 구현 사례(표준 훅으로 수렴 대상)
  - [src/features/schedule/TaskModal.tsx](src/features/schedule/TaskModal.tsx)
  - [src/features/schedule/MemoModal.tsx](src/features/schedule/MemoModal.tsx)
  - [src/features/tasks/BulkAddModal.tsx](src/features/tasks/BulkAddModal.tsx)
  - [src/features/tasks/TaskBreakdownModal.tsx](src/features/tasks/TaskBreakdownModal.tsx)
  - [src/features/shop/ShopModal.tsx](src/features/shop/ShopModal.tsx)
- 누락 없음: 모든 대상 모달이 위 경로에서 확인됨. 추가 검색 불요.

## Recommendations
- 아키텍처 문서(006)에서 placeholder 대신 위 실경로를 그대로 사용하도록 반영.
- 구현 시 ESC/Primary 단축키를 공용 훅으로 수렴할 때, 각 파일에서 기존 window keydown 또는 onKeyDown 로직을 제거하고 스택 안전성을 확보할 것.

## Open Questions
- 추가적으로 primary 단축키가 필요한 모달이 더 있는지(예: 설정/템플릿 관련) 확인할 필요가 있는가? 현재 요청 범위에서는 7개 모두 발견됨.
