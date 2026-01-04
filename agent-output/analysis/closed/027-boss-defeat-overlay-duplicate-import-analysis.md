Status: Active

## Value Statement and Business Objective
Prevent build-time regressions in the battle overlay so the Boss defeat flow renders reliably without Vite parse failures, keeping the battle feature shippable.

## Objective
Map reproduction steps, likely causes, and verification points for the Vite error `Identifier 'useModalHotkeys' has already been declared` in `BossDefeatOverlay.tsx`.

## Context
- Vite build reports duplicate declaration for `useModalHotkeys` with duplicate import lines at 12 and 13 in `src/features/battle/components/BossDefeatOverlay.tsx`.
- Project policies: modal hotkeys come from `@/shared/hooks` with escape handling; no backend scope in this phase.

## Root Cause (current hypothesis)
- Most likely: accidental duplicate import statement within the component file created a redeclaration in the same module.
- Secondary possibilities: auto-merge artifact leaving two identical import lines; tooling retry/HMR caching is unlikely because the duplication is present in source.

## Methodology
- Read the module to confirm import duplication and downstream hook calls.
- Grep for `useModalHotkeys` to see other usages and ensure no multi-path duplication beyond this file.

## Findings
- Fact: `useModalHotkeys` is imported twice at lines 12–13 of `BossDefeatOverlay.tsx`, producing an immediate parser error in Vite.
- Fact: The hook is called twice in the component body with identical options, implying a copy-paste artifact.
- Hypothesis: The duplication originated from an unresolved merge or rapid edit while adding the escape-close behavior.

## Recommendations
- Remove the duplicate import line and deduplicate the duplicate `useModalHotkeys` invocation unless two independent registrations are intended (unlikely given shared modal stack policy).
- After adjustment, rerun `npm run dev` or `npm run build` to confirm Vite compilation and navigate to the battle defeat overlay to ensure hotkey behavior is intact.

## Open Questions
- Was a second hotkey registration intentionally added to work around an ordering issue in modal stack handling, or is it purely accidental?

## Changelog
- 2025-12-23: Initial analysis drafted; duplicate import and duplicate hook calls documented.