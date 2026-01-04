Status: Active

Changelog:
- 2025-12-28: Initial investigation (memory tool unavailable; operating in no-memory mode).

Value Statement and Business Objective:
- Restore reliable Inbox triage keyboard flow so ADHD users can process tasks without mode switches or mouse reliance.
- Reduce friction from global modal guards that currently suppress triage hotkeys, improving perceived responsiveness and trust in the triage loop.

Objective:
- Identify why triage-mode hotkeys never fire and outline the smallest frontend-only patch to re-enable the key loop without touching backend/Electron.

Context:
- Triage toggle and hook wiring live in [src/features/tasks/InboxTab.tsx](src/features/tasks/InboxTab.tsx). The HUD toggle flips local `triageEnabled`; `useInboxHotkeys` is invoked with `disabled` derived from `isInputFocused || isModalOpen` (TaskModal state).
- Hotkey handling lives in [src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts). The hook adds a `window` keydown listener only when `triageEnabled && !disabled`, then early-returns on modal stack or focused inputs.
- Global modal stack lives in [src/shared/hooks/modalStackRegistry.ts](src/shared/hooks/modalStackRegistry.ts) and is used by popovers/modals across the app.

Methodology:
- Static code review of the triage toggle path and hotkey hook guards.
- Traced the listener attach conditions and all early-return gates in the keydown handler.
- Checked modal stack usage to see where global state can block triage listeners.

Findings (facts):
- Listener attach is gated: `useEffect` in [useInboxHotkeys](src/features/tasks/hooks/useInboxHotkeys.ts) skips registering `window` keydown when `triageEnabled` is false or when `disabled` is true. InboxTab passes `disabled = isInputFocused || isModalOpen`.
- Handler guard #1: Even if the listener is attached, the first lines of the handler return when `modalStackRegistry.size() > 0`. Any open modal/popover anywhere that registered to the stack (e.g., popovers using `useModalHotkeys`/`modalStackRegistry`) will block all triage hotkeys, even if the Inbox itself has no modal open.
- Handler guard #2: The handler also returns when `document.activeElement` is an input/textarea/contentEditable. The inline quick-add input in Inbox keeps focus unless explicitly blurred; triage toggle does not blur it, so keys are ignored while that input remains active.
- Net effect: If a global popover/modal is present or the inline input still has focus, the handler short-circuits; users perceive “triage hotkeys do nothing” despite triage being ON and tasks visible.

Hypotheses (confidence high):
- In common runs, a popover registered to the modal stack (or a stale stack entry) keeps `modalStackRegistry.size() > 0`, so triage hotkeys are globally suppressed. This matches the symptom “hotkeys do not work at all.”
- When no modal is open, the inline input focus still blocks hotkeys because both the `disabled` prop (InboxTab) and the hook’s own `isInputFocused()` guard return early. Without auto-blur on triage enable, users can easily remain in a blocked state.

Recommendations (minimal patch approach, frontend-only):
1) Soften the modal-stack guard in [useInboxHotkeys](src/features/tasks/hooks/useInboxHotkeys.ts): add an option (e.g., `ignoreModalStack?: boolean`) defaulting to false, and allow InboxTab to bypass the `modalStackRegistry` short-circuit when triage is active. Alternatively, rely solely on the caller-provided `disabled` flag (which already tracks TaskModal) and remove the stack check for this hook.
2) On triage enable in [InboxTab](src/features/tasks/InboxTab.tsx), immediately blur the inline quick-add input and clear `isInputFocused` so the listener can attach and the handler will not early-return on activeElement. Also set the first task focus (already done) to make the loop usable immediately.
3) Keep existing IME and modal guards for TaskModal by continuing to pass `disabled` when the TaskModal is open; add a short inline comment documenting the intent so future global modals do not silently kill triage.

Verification steps (manual, frontend):
- Open Inbox, ensure no TaskModal open. Expand HUD, toggle Triage ON. Confirm inline quick-add input loses focus automatically; the first task should highlight.
- Press ArrowDown/ArrowUp to move focus, then T/O/N/P/H/d/Backspace/Enter to confirm actions execute. Repeat with a popover (e.g., QuickLogSessionPopover) open to ensure the new option still allows triage when desired.
- Run `npm test` to ensure existing Vitest suite (pure logic tests) still passes; no new tests are required for this UI-only wiring change.

Risks/notes:
- Removing or bypassing the modal-stack guard must not interfere with TaskModal; keep `disabled` tied to TaskModal state to prevent triage from acting while editing.
- Memory tool unavailable this session; findings based solely on current code review.
