---
ID: 63
Origin: 63
UUID: 8f2c4a1b
Status: Active
---

## Changelog
- 2026-01-03: Created PR5 plan from analysis 063; UI-only scope (no Electron IPC changes).

## PR5 구현 계획

- Target Release: **1.0.182 (제안; 현재 package.json=1.0.181, 확정 필요)**
- Epic Alignment: Always-on-top UX 개선(ADHD-friendly, 발견 가능성/피드백 강화)
- Status: Active

## Value Statement and Business Objective
As a ADHD 성향 사용자, I want Always-on-top 상태를 한눈에 확인하고 큰 버튼으로 빠르게 토글할 수 있게 되어, so that “지금 창이 항상 위인지 아닌지”를 재확인하느라 흐름이 끊기지 않는다.

## Objective
Renderer/UI만으로 Always-on-top 토글의 (1) 히트영역을 충분히 크게 하고, (2) 상태 피드백을 명확히 제공하며, (3) Settings에서 on/off를 제어할 수 있도록 한다. (Electron IPC 구현/변경은 하지 않는다.)

## Scope / Constraints
- 포함: React UI, Settings UI, 상태 표시(아이콘/배지/툴팁), 접근성(키보드/ARIA), 문구 정합.
- 제외: Electron main/preload IPC 추가/변경, tray 메뉴 구현, main↔renderer 상태 동기 이벤트 구현.
- 설계 고려(문서로만): main이 실제 상태를 push/pull로 알려주는 동기화 이벤트(후속 PR) 필요성.

## Assumptions
- Always-on-top on/off의 “의도 상태(source of intent)”는 기존처럼 settings의 `isAlwaysOnTopEnabled`를 기준으로 한다.
- IPC 호출 실패는 UI에서 명확히 피드백(토스트/배너) 가능하며, 실패 시 상태를 롤백하거나 “알 수 없음”으로 표현할 수 있다.

## PR5 구현 계획

### Task T90-01: Always-on-top 토글 UI를 툴바 버튼으로 승격(히트영역 확대)
- 대상: src/app/AppShell.tsx
- 작업:
  1. 현재 10px 오른쪽 엣지 바(고정 위치 토글)를 “주 토글 UI”에서 제외(대체 경로로 축소/삭제는 팀 선택).
  2. 상단 툴바(또는 AppShell 상단 액션 영역)에 Always-on-top 전용 버튼 추가(최소 44px 이상 클릭 영역).
  3. 버튼은 텍스트+아이콘(예: pin) 조합으로 의미를 즉시 전달하고, 토글 상태에 따라 `aria-pressed` 및 스타일 변화를 제공.
  4. 버튼 근처에 현재 단축키(설정값)를 함께 노출(짧은 힌트 형태로 과도한 시각잡음은 피함).
- 검증: npm run lint / npx tsc --noEmit / npm test 통과

### Task T90-02: 시각적 상태 피드백 강화(ON/OFF, 실패, 알 수 없음)
- 대상: src/app/AppShell.tsx
- 작업:
  1. ON 상태일 때 버튼에 명확한 “활성” 표현(색/배지/아이콘 채움 등)을 적용.
  2. 토글 직후 즉시 피드백 제공(필요 시 기존 토스트 패턴 재사용). 과도한 토스트 남발은 피하고, 실패 시에만 강하게 알림.
  3. IPC 실패/예외 시 사용자에게 “반영 실패”를 보이게 하고(콘솔-only 금지), 다음 행동(다시 시도/설정 열기)을 제시.
  4. (설계 고려) 실제 main window 상태를 알 수 없는 경우를 표현할 UX(예: “상태 확인 불가” 배지) 필요 여부를 결정.
- 검증: npm run lint / npx tsc --noEmit / npm test 통과

### Task T90-03: Settings에 Always-on-top on/off 토글 추가(단축키 탭 문구 정합)
- 대상: src/features/settings/SettingsModal.tsx, src/features/settings/components/tabs/ShortcutsTab.tsx
- 작업:
  1. Settings 내에 Always-on-top “켜짐/꺼짐” 토글 컨트롤을 추가(위치: Shortcuts 탭 또는 적절한 탭/섹션).
  2. 기존 Shortcuts 탭의 설명(“오른쪽 하늘색 바”)을 툴바 버튼 중심 설명으로 수정.
  3. 토글은 기존 settings 저장 플로우를 따르며, 기본값은 `SETTING_DEFAULTS` 단일 출처를 유지.
  4. 토글 변경 시 사용자 기대가 명확하도록 간단한 설명(예: “메인 창을 항상 위에 유지”) 제공.
- 검증: npm run lint / npx tsc --noEmit / npm test 통과

### Task T90-04: 키보드 토글 경험 일관화(힌트/발견성)
- 대상: src/app/hooks/useKeyboardShortcuts.ts, src/app/AppShell.tsx
- 작업:
  1. 단축키로 토글했을 때도 툴바 버튼 상태가 즉시 업데이트되도록 상태 경로 확인.
  2. 단축키 설정이 비어있거나 비정상일 때(입력 실수)에도 UX가 깨지지 않게 “미설정” 표현을 제공.
  3. (선택) 툴바 버튼 툴팁에 단축키를 함께 표시해 학습 비용을 낮춤.
- 검증: npm run lint / npx tsc --noEmit / npm test 통과

### Task T90-05: 버전/릴리즈 아티팩트 정합(릴리즈 묶음 기준)
- 대상: package.json (및 존재 시 CHANGELOG/릴리즈 노트)
- 작업:
  1. PR5 단독이 아닌 “릴리즈 묶음” 운영이라면, 버전 bump는 배치 마무리 PR에서 수행하도록 릴리즈 흐름을 명확히 문서화.
  2. Target Release가 1.0.182로 확정되면, 최종 릴리즈 PR에서 버전과 변경 로그를 정합성 있게 갱신.
- 검증: npm run lint / npx tsc --noEmit / npm test 통과

## Testing Strategy (High-level)
- Unit/Integration: 기존 테스트에 더해, Always-on-top UI 변경이 Settings 저장 플로우 및 단축키 토글과 충돌하지 않는지 확인.
- Smoke: 토글 버튼 클릭/단축키 토글/Settings 토글 변경 후 UI 상태 표시가 일관적인지 확인.

## Risks / Rollback
- 리스크: 실제 main-window always-on-top 상태와 settings 기반 UI 표시가 불일치할 수 있음(현 단계에서는 완전 해소 불가).
- 완화: 실패/불확실성을 숨기지 않고 UI에서 명확히 표시; 후속 PR에서 main→renderer 상태 동기 이벤트를 설계/구현.
- 롤백: UI 표면(툴바 버튼/문구/설정 토글) 변경만 되돌릴 수 있도록 기능 변경과 분리.

## Dependencies
- 권장 선행: PR1(린트/tsc 게이트), PR2(모달/단축키 UX 정리) 이후 적용 시 충돌/회귀 리스크 감소.

## OPEN QUESTION (미해결)
1) 오른쪽 10px 엣지 바는 완전 제거 vs 보조 진입점으로 유지(단, 히트영역 확대/설명 변경 필요) 중 어떤 방향이 좋아?
2) 상태 피드백은 “항상 표시되는 배지(ON)” 중심 vs “토글 시 토스트” 중심 중 어떤 게 ADHD 관점에서 덜 산만해?
3) Target Release를 1.0.182로 확정해도 될까? (현재 package.json=1.0.181)
