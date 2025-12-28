Status: Planned

Changelog:
- 2025-12-28: Initial analysis (memory retrieval unavailable; working in no-memory mode).
- 2025-12-28: Marked Planned; plan authored in `agent-output/planning/045-inbox-triage-ui-cleanup-ui-only-plan.md`.

Value Statement and Business Objective:
- Streamline the Inbox UI so ADHD users can triage faster without visual clutter and avoid crashes that interrupt the flow.
- Restore a stable triage mode so quick placement and pin/defer flows are reliable in the desktop build.

Objective:
- Remove per-task time-slot chips (5-8, 8-11, 11-14, 14-17, 17-20, 20-23) from Inbox items.
- Move the "고정"/"보류" controls into the same row as Today/Tomorrow/Next to simplify the action stack.
- Identify the triage-mode onClick crash (TypeError … is not a function) and outline a minimal fix consistent with existing patterns.

Context and Trace Points:
- Inbox UI and triage toggle live in [src/features/tasks/InboxTab.tsx#L560-L573](src/features/tasks/InboxTab.tsx#L560-L573); triage state is local (`triageEnabled`, `triageFocusedTaskId`).
- Quick-place buttons are rendered via `renderQuickPlaceButtons` [src/features/tasks/InboxTab.tsx#L584-L604](src/features/tasks/InboxTab.tsx#L584-L604) and injected per-task [src/features/tasks/InboxTab.tsx#L764](src/features/tasks/InboxTab.tsx#L764).
- Pin/defer buttons are rendered separately via `renderTriageButtons` [src/features/tasks/InboxTab.tsx#L614-L664](src/features/tasks/InboxTab.tsx#L614-L664) and injected per-task [src/features/tasks/InboxTab.tsx#L766](src/features/tasks/InboxTab.tsx#L766).
- The time-slot chips (5-8 … 20-23) are the `TIME_BLOCKS` row per task [src/features/tasks/InboxTab.tsx#L770-L788](src/features/tasks/InboxTab.tsx#L770-L788).
- Triage hotkeys and focus handling are centralized in [src/features/tasks/hooks/useInboxHotkeys.ts](src/features/tasks/hooks/useInboxHotkeys.ts); the hook keeps its own `triageFocusedTaskId` state and only consumes `triageEnabled`, optional external focus setter, and quick-place/pin/defer callbacks.

Findings (facts):
- Only one triage toggle onClick exists: the HUD switch in InboxTab at L566, wired to `setTriageEnabled(!triageEnabled)`.
- Quick-place buttons (Today/Tomorrow/Next) and pin/defer are separate rows, creating three stacked control rows per task.
- The `TIME_BLOCKS` map at L770 emits the 5-8…20-23 chips that the user wants removed.
- `useInboxHotkeys` uses an internal `triageFocusedTaskId` state but switches to the external setter when provided; the state it reads stays internal, so parent-provided focus updates never propagate back into the hook state (focus stays null).

Root Cause Hypotheses:
- The onClick crash likely originates from the triage toggle path in InboxTab because it is the only triage-labeled onClick; a prod stack with source maps is needed to confirm the exact symbol. Given the code, the most plausible culprit is the state/control mismatch between InboxTab and useInboxHotkeys: the hook reads its own `triageFocusedTaskId` while writes go to the parent setter when provided, leaving the hook’s internal state null and causing triage actions to no-op; if the hook ever receives a non-function setter (e.g., undefined) the onClick path would throw exactly the reported TypeError. Aligning the focus state to a single source should remove this failure mode.

Recommendations / Patch Plan Outline:
1) UI cleanup
- Remove the `TIME_BLOCKS` action row per task [src/features/tasks/InboxTab.tsx#L770-L788](src/features/tasks/InboxTab.tsx#L770-L788).
- Merge `renderQuickPlaceButtons` and `renderTriageButtons` into one compact row so Today/Tomorrow/Next sit alongside 고정/보류; drop the extra spacer row to keep controls single-line per task.
2) Triage stability
- Make triage focus state single-source: either keep it entirely inside `useInboxHotkeys` or pass both value and setter from InboxTab so reads/writes align. Guard setter availability before use to prevent `… is not a function` onClick failures.
- Add a dedicated `toggleTriage` callback (stable via useCallback) and, if available, log the prod stack/source-map mapping to confirm the exact failing handler before shipping.

Open Questions / Follow-ups:
- Need the exact production stack trace (with source map line) to validate the failing symbol; current mapping points to the HUD triage toggle in InboxTab.
- UX confirmation: Should the merged control row order be Today/Tomorrow/Next | 고정 | 보류, or another ordering for ADHD-friendly scanning?
