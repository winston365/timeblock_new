# Phase2 Modal + Hotkeys + Parsing Refactor (2026-01-05)

## Files located
- `src/features/tasks/TaskBreakdownModal.tsx`
- `src/features/tasks/BulkAddModal.tsx`
- `src/features/tasks/hooks/useInboxHotkeys.ts`

## Shared parsing extraction
- Created `src/features/tasks/utils/taskParsing.ts`
  - Exports: `parseTaskInputText`, `DURATION_OPTIONS`, types (`TaskParsingDefaults`, `ParsedTaskInput`)
  - Supports: memo (`|`), duration (`[30m]`, `[1h]`), resistance emojis (`🟢/🟡/🟠/🔴`), timeblock tags (`@8-11`→`morning` via `TIME_BLOCKS start/end`, `@morning`), optional markdown list prefix stripping.
- Updated both modals to use shared parser; removed duplicated `parseInput` and `DURATION_OPTIONS` from each file.
- Added unit tests: `tests/task-parsing.test.ts`.

## useInboxHotkeys split
- Added new focused hooks under `src/features/tasks/hooks/inbox/`:
  - `useInboxNavigation.ts` (controlled/uncontrolled focus + moveFocus)
  - `useInboxHotkeysGuards.ts` (modal/input guards)
  - `useInboxPlacement.ts` (slotFinder-based quick placement)
  - `useInboxEditing.ts` (delete/edit/pin/defer mutations)
- Refactored `src/features/tasks/hooks/useInboxHotkeys.ts` to compose these hooks; public API unchanged.

## Verification
- `npm test`: PASS (38 files, 504 tests)
- `npx tsc --noEmit`: PASS
- Circular deps: `npx madge src --circular --ts-config tsconfig.json`: PASS
  - Note: running madge without `--ts-config` may produce a parser error for TS syntax.
