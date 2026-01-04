# UI 5개 변경 — 변경 파일 리스트/요구사항 매핑 (Workspace 기준)

## Value Statement and Business Objective
불필요한 진입점/시각적 부담(오늘 목표 UI, 상단 XP바, 가방 탭)을 제거하고 임시스케줄(월/주간) 가독성을 개선하여, 사용자가 오늘 해야 할 일에 더 빨리 집중하고 화면 인지 부하를 줄일 수 있게 한다.

## Objective
QA 보고서에 포함할 수 있도록, 현재 워크스페이스에서 확인되는 **정확한 변경 파일 경로**를 1줄씩 나열하고 각 파일을 요구사항(#1~#5)에 매핑한다.

## Context
- 기준 시점: 2025-12-17
- 소스: `git status --porcelain -uall`
- 요구사항(#1~#5) 정의는 플랜 문서(Option A Phase 1~5)를 그대로 사용한다.

### 요구사항(#1~#5) 정의(Plan 기준)
1. TopToolbar “오늘 하루 전체 XP바(DailyXPBar)” 제거
2. 우측 사이드바 “가방(인벤토리) 탭” 진입 UI 제거
3. TempSchedule 주간 뷰 시간별 구분선 추가
4. TempSchedule 월간 달력 UI 정렬(삐뚤어짐) 수정
5. GoalsModal에서 “오늘 목표” UI만 제거(장기 목표 유지)

## Methodology
- `git status --porcelain -uall`로 Modified/Untracked 파일을 수집
- 각 파일이 어떤 요구사항을 구현/검증/문서화하는지 플랜 및 구현/QA 문서의 서술을 근거로 매핑

## Findings

### 변경 파일 경로 목록(정확히, 1줄씩)
- src/app/AppShell.tsx
- src/features/goals/GoalsModal.tsx
- src/features/tempSchedule/components/MonthlyScheduleView.tsx
- agent-output/analysis/007-ui-five-changes-workspace-verification-analysis.md
- agent-output/implementation/002-ui-five-changes-optionA-implementation.md
- agent-output/qa/006-ui-five-changes-optionA-qa.md
- agent-output/qa/README.md

### 요구사항 매핑표(파일 → 요구사항 번호)
| File | Requirement Mapping |
|---|---|
| src/app/AppShell.tsx | #1, #2 |
| src/features/goals/GoalsModal.tsx | #5 |
| src/features/tempSchedule/components/MonthlyScheduleView.tsx | #4 |
| agent-output/analysis/007-ui-five-changes-workspace-verification-analysis.md | #1~#5 (워크스페이스 검증 문서) |
| agent-output/implementation/002-ui-five-changes-optionA-implementation.md | #1~#5 (구현 요약 문서) |
| agent-output/qa/006-ui-five-changes-optionA-qa.md | #1~#5 (QA 리포트) |
| agent-output/qa/README.md | #1~#5 (QA 폴더 메타/가이드) |

## Notes / Open Questions
- 현재 워크스페이스 변경 목록에는 #2(우측 인벤토리 탭 제거) 및 #3(주간 구분선 추가)의 핵심 구현 파일로 예상되는 `src/app/components/RightPanel.tsx`, `src/features/tempSchedule/components/WeeklyScheduleView.tsx`가 포함되어 있지 않다. 이는 (a) 이미 커밋되어 워크스페이스 변경으로 남아있지 않거나, (b) 다른 파일에서 구현되었거나, (c) 구현이 누락되었을 가능성이 있다. QA 보고서에 “변경 파일 리스트”를 채우는 목적이라면, 본 문서의 목록은 현재 워크스페이스 기준으로는 정확하다.
