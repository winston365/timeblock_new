---
ID: 60
Origin: 60
UUID: 7fb92c4e
Status: Planned
---

## Changelog
- 2024-XX-XX: Initial PR2 modal backdrop/ESC audit across 29 modal-related files.
- 2026-01-03: Scope updated — PR2 goal shifts from “backdrop-click 제거” to “현행 유지 검증 + UX 힌트(ESC) 보강 + MissionModal 명시적 닫기 버튼 추가”.

## Value Statement and Business Objective
Ensure PR2 delivers ADHD-safe modal behavior (no backdrop-click dismissals; consistent ESC closure of the top-most modal) so users do not lose work from accidental clicks and have clear, predictable escape affordances.

## Objective
Enumerate all modal components, verify ESC/backdrop behaviors, and flag any gaps affecting PR2 (backdrop-close, missing ESC handling, missing close affordance, or unclear cues).

## Context
- Policy memory: backdrop clicks must not close modals; ESC closes top-most via modal stack registry hooks (`useModalEscapeClose`, `useModalHotkeys`).
- Scope: UI-only audit; no backend/Electron work. Files scanned via `src/**/*Modal*.ts*` (29 results).

## Methodology
- Searched for modal components (`Modal` in filename) and modal hooks.
- Manual code inspection of each modal for: ESC handling, backdrop click handlers, presence of explicit close controls, and any ESC/keyboard hints.

## Findings (facts)
- Universal ESC support: All inspected modals use `useModalHotkeys` or `useModalEscapeClose`; none rely on ad-hoc keydown listeners for ESC-only closure.
- Backdrop safety: None of the modals attach a backdrop `onClick` to close; most containers call `stopPropagation`, leaving backdrop clicks inert. PR2 backdrop removal goal already satisfied in inspected files.
- Close affordance gaps: `features/battle/components/MissionModal.tsx` renders full-screen without an explicit close button or hint; relies solely on ESC. Other modals include header/footer close controls.
- Hinting/ADHD cues: ESC/keyboard hints are present in a few modals (e.g., `goals/GoalsModal`, `battle/BossAlbumModal` footer note). Many lack hints despite ESC support: `settings/SettingsModal`, `settings/SyncLogModal`, `tasks/InboxModal`, `shop/ShopModal`, `battle/MissionModal`, `shared/components/MemoMissionModal`, `schedule/*` modals, `template/*`, `tempSchedule/*`, `tasks/*`, `insight/DailySummaryModal`, `goals/*`, `stats/StatsModal`.
- Text-label inconsistency: `SettingsModal` primary button reads “닫기” but triggers save before closing; behavior is correct but label may mislead users expecting a non-saving close.

## Analysis Recommendations (next steps to deepen inquiry)
- Confirm with UX whether `MissionModal` should expose an on-screen close control or keyboard hint to reduce reliance on ESC-only exit.
- Decide on a standard ESC/primary-action hint pattern and sample placement (header helper text, footer pill, or tooltip) for modals currently missing cues; prototype on a representative set and validate with users.
- If PR2 requires automated coverage, identify or add RTL tests that assert backdrop clicks are inert and ESC closes the top-most modal for a few representative modals (e.g., settings, tasks, battle) to guard regressions.

## Open Questions
- Should ESC/hotkey hints be mandatory across all modals, or only on high-risk (long-form) dialogs?
- For `SettingsModal`, is the “닫기” label on a saving action acceptable, or should it be split into Save vs Close (non-persisting)?
- Does `MissionModal` need an on-screen close affordance for keyboard-averse users, or is ESC-only acceptable in battle context?
