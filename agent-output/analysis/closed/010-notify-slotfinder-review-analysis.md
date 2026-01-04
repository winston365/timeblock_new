Value Statement and Business Objective
- Ensure inbox triage hotkeys and slot suggestion UX remain reliable and policy-compliant while preserving undo affordances that actually fire in production and test environments.

Status: Active

Objective
- Review unstaged changes for notify undo, inbox hotkeys quick placement, slotFinder logic, inbox store defaults, and related tests against policy constraints (no localStorage, defaults centralization, optional chaining, UI-only scope) and identify correctness/maintainability risks.

Context
- Frontend-only scope; react-hot-toast used for toasts. Policies: no localStorage except theme, defaults must come from defaults.ts, optional chaining for nested objects, no backend/IPC. notify.undo currently uses direct DOM query with data-toast-id selector and delayed listener. slotFinder supports today/tomorrow/next modes with TimeBlockStates. Tests exercise slotFinder.

Methodology
- Static read of specified files (notify.ts, useInboxHotkeys.ts, slotFinder.ts, inboxStore.ts, defaults.ts, slot-finder.test.ts) and domain type definitions.

Findings (Facts)
1) notify.undo uses document.querySelector(`[data-toast-id="${toastId}"]`) inside a setTimeout and attaches a click listener. react-hot-toast does not render data-toast-id attributes for its toasts; default markup uses class-based containers. As a result, the listener never binds and undo callbacks never execute. (src/shared/lib/notify.ts)
2) notify.undo unconditionally references document inside a delayed callback. In non-DOM contexts (Vitest node environment, SSR) this will throw ReferenceError when the timeout fires, even if toasts are disabled. No guard or cleanup is present. (src/shared/lib/notify.ts)

Findings (Hypotheses)
A) The delayed DOM query approach is brittle; even if the selector were corrected, toast re-renders or portal differences could detach the listener. A custom toast component with an explicit button is likely needed for reliable undo UX.

Recommendations
- Must-fix: Replace the data-toast-id DOM query approach in notify.undo with a react-hot-toast supported pattern (e.g., toast.custom or a JSX content renderer that includes an explicit Undo button and calls the provided onAction). Remove the selector and setTimeout hack.
- Must-fix: Guard DOM access in notify.undo (e.g., check typeof document !== 'undefined') to prevent ReferenceError in tests/SSR; ideally avoid direct DOM access entirely by using toast APIs.
- Should-fix: If keeping DOM-based handling temporarily, use the actual attribute rendered by react-hot-toast (id or class) and clean up listeners when the toast dismisses; but prefer the custom component approach for reliability.

Open Questions
- Do we want a standardized Undo toast component elsewhere to avoid duplicated patterns?
- Should undo toasts be cancellable via ESC or focus-visible for accessibility?

Changelog
- 2025-12-23: Initial analysis authored; issues identified in notify undo implementation and DOM safety.
