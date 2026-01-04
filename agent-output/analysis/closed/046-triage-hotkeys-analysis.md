Value Statement and Business Objective
- Ensure Inbox triage hotkeys remain reliable during keyboard-driven workflows, especially when focus sits on inputs, so users can clear inbox quickly without losing shortcuts.

Status: Active

Changelog
- 2025-12-28: Initial triage hotkeys registration review (Analyst pass).

Context
- Asked to inspect current triage hotkey registration and focus handling in inbox triage flow. Scope: useInboxHotkeys hook and InboxTab wiring.

Methodology
- Read src/features/tasks/hooks/useInboxHotkeys.ts and src/features/tasks/InboxTab.tsx for registration logic, focus guards, and triage toggle behavior.

Findings (facts)
- Hotkeys are registered via a manual window keydown listener with capture: true when triageEnabled && !disabled; no react-hotkeys-hook usage and no ref scoping. See [src/features/tasks/hooks/useInboxHotkeys.ts#L402-L510](src/features/tasks/hooks/useInboxHotkeys.ts#L402-L510).
- The listener guards out when modal open and when non-triage keys. Input-focus guard returns false during triage mode so the handler would run even if an input is active. See [src/features/tasks/hooks/useInboxHotkeys.ts#L213-L226](src/features/tasks/hooks/useInboxHotkeys.ts#L213-L226).
- InboxTab passes disabled as isInputFocused || isModalOpen, so when the inline input is focused the hotkey effect never mounts. See [src/features/tasks/InboxTab.tsx#L137-L160](src/features/tasks/InboxTab.tsx#L137-L160).
- Triage toggle blurs the current active element when turning on, clearing isInputFocused state to allow registration right after enable. See [src/features/tasks/InboxTab.tsx#L77-L88](src/features/tasks/InboxTab.tsx#L77-L88).
- UseInboxHotkeys call is uncontrolled but tied to triageEnabled and triageFocusedTaskId props, no explicit focus container/ref for scoping. See [src/features/tasks/InboxTab.tsx#L152-L188](src/features/tasks/InboxTab.tsx#L152-L188).

Conclusion
- With triageEnabled true and an INPUT focused, hotkeys do not fire because InboxTab sets disabled when isInputFocused is true, preventing the listener from mounting. Only after blur (auto on toggle or manual) do triage hotkeys register.

Recommendations (for Implementer)
- Allow triage mode to keep the listener active even if an input regains focus: e.g., set disabled to isModalOpen only, or gate isInputFocused out when triageEnabled is true.
- Optionally scope to a triage container ref if needed, but current behavior is global capture.

Open Questions
- Should inline input remain usable during triage or always blurred? Clarify desired UX before adjusting disabled gating.
