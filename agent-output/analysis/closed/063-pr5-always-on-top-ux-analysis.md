---
ID: 63
Origin: 63
UUID: 8f2c4a1b
Status: Planned
---

## Changelog
- 2026-01-03: Initial PR5 always-on-top UX analysis (Analyst mode).
- 2026-01-03: Status set to Planned; handed off to planning doc.

## Value Statement and Business Objective
Reliable, low-friction control of the Always-on-top state reduces context loss for ADHD users by making the main window’s visibility predictable and quickly adjustable, preventing task flow interruptions during multitasking.

## Objective
Map the current Always-on-top implementation (main, preload, renderer, settings), identify UX pain points, and surface research-backed improvement areas for PR5 without proposing implementation plans.

## Context
- Main process exposes `set-main-always-on-top` IPC and applies it to the main window; PiP/QuickAdd windows are instantiated with `alwaysOnTop: true` and PiP accepts a toggle action. [electron/main/index.ts#L1-L240](electron/main/index.ts#L1-L240) [electron/main/index.ts#L640-L706](electron/main/index.ts#L640-L706)
- Preload bridges `setMainAlwaysOnTop` for the renderer. [electron/preload/index.ts#L60-L84](electron/preload/index.ts#L60-L84)
- Renderer state/persistence: AppShell stores `isAlwaysOnTopEnabled` in settings, calls IPC on change, and renders a thin right-edge toggle bar. [src/app/AppShell.tsx#L107-L223](src/app/AppShell.tsx#L107-L223)
- Settings persistence defaults: `isAlwaysOnTopEnabled` false, toggle key `Ctrl+Shift+T`. [src/data/repositories/settingsRepository.ts#L38-L96](src/data/repositories/settingsRepository.ts#L38-L96) [src/shared/types/domain.ts#L420-L446](src/shared/types/domain.ts#L420-L446)
- Settings UI only exposes shortcut customization (Shortcuts tab); no checkbox/toggle for state. [src/features/settings/components/tabs/ShortcutsTab.tsx#L116-L172](src/features/settings/components/tabs/ShortcutsTab.tsx#L116-L172) [src/features/settings/SettingsModal.tsx#L260-L340](src/features/settings/SettingsModal.tsx#L260-L340)
- Keyboard shortcut handler reads `alwaysOnTopToggleKey` (default Ctrl+Shift+T) and delegates to AppShell. [src/app/hooks/useKeyboardShortcuts.ts#L120-L148](src/app/hooks/useKeyboardShortcuts.ts#L120-L148)

## Methodology
Static code inspection of main/preload IPC, renderer shell, settings store/repository, and settings UI tabs; no runtime validation or telemetry data collected.

## Findings (Fact vs Hypothesis)
- **Fact**: Renderer toggles Always-on-top via a 10px-wide fixed right-edge bar with hover tooltip; no in-toolbar or menu entry, and failure feedback is console-only. [src/app/AppShell.tsx#L107-L223](src/app/AppShell.tsx#L107-L223)
- **Fact**: Shortcut support exists and is user-configurable (default Ctrl+Shift+T) via Settings → Shortcuts tab; the tab copy references the “right-side sky-blue bar” as the primary control surface. [src/features/settings/components/tabs/ShortcutsTab.tsx#L116-L172](src/features/settings/components/tabs/ShortcutsTab.tsx#L116-L172) [src/app/hooks/useKeyboardShortcuts.ts#L120-L148](src/app/hooks/useKeyboardShortcuts.ts#L120-L148)
- **Fact**: Always-on-top state is persisted to settings and mirrored to main via IPC, but there is no renderer-side subscription for main-window state changes; renderer assumes the main process applied the change. [src/app/AppShell.tsx#L107-L148](src/app/AppShell.tsx#L107-L148) [electron/preload/index.ts#L60-L84](electron/preload/index.ts#L60-L84) [electron/main/index.ts#L691-L694](electron/main/index.ts#L691-L694)
- **Fact**: Settings UI lacks a direct Always-on-top on/off toggle; only the shortcut key can be edited. [src/features/settings/components/tabs/ShortcutsTab.tsx#L116-L172](src/features/settings/components/tabs/ShortcutsTab.tsx#L116-L172)
- **Fact**: Other windows: QuickAdd and PiP launch as always-on-top; PiP exposes an IPC action to toggle its own state. This differs from main-window behavior and may create inconsistent expectations. [electron/main/index.ts#L150-L240](electron/main/index.ts#L150-L240) [electron/main/index.ts#L660-L688](electron/main/index.ts#L660-L688)
- **Hypothesis**: The narrow edge control likely leads to low discoverability/precision for ADHD users, and absence of a tray/menu indicator or toolbar toggle may cause uncertainty about current state.

## Root Cause
The Always-on-top control was implemented as a minimal edge affordance without complementary surfaces (toolbar, tray, settings toggle) or state feedback channels, leaving discoverability and clarity unaddressed.

## Analysis Recommendations (next inquiry steps)
- Validate actual discoverability and misclick rates of the edge bar through usability tests or telemetry (click counts vs shortcut usage).
- Trace whether main-window Always-on-top ever desynchronizes (e.g., OS-level changes) by instrumenting state feedback from main → renderer.
- Audit tray/menu surfaces to confirm no alternative entry points and assess feasibility for fast-toggle surfaces in PR scope.
- Capture current default and user-customized shortcut usage frequency to gauge reliance on keyboard vs UI.

## Open Questions
- Do users report confusion or missed clicks on the edge control in support feedback or telemetry?
- Should PiP/QuickAdd always-on-top behavior align with main window expectations, or remain independent?
- Is there an existing design guideline for state indicators (icon/badge) we should align with in PR5?
