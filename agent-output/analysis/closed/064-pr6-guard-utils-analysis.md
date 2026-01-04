---
ID: 64
Origin: 64
UUID: 8e4fa2b9
Status: Planned
---

## Changelog
- 2026-01-03: Initial scan of defensive guard utilities, usages, and gaps.
- 2026-01-03: Marked Planned; handoff to agent-output/planning/064-pr6-guard-utils-plan.md.

## Value Statement and Business Objective
- Reinforce runtime safety for the desktop app by understanding existing guard utilities, their adoption, and weak points so PR6 can target the highest-risk gaps without duplicating work.

## Objective
- Catalog current guard/assert utilities (outside Zod schemas) and their usage.
- Identify null/undefined handling patterns in practice.
- Surface missing guard types and message standardization needs to inform PR6 scope.

## Context
- Scope limited to frontend/runtime code; backend/Supabase logic out-of-scope per phase guidance.
- Guard functions examined under `src/shared/utils` and `src/shared/lib`, plus repository usage patterns affecting sync safety.

## Methodology
- Scanned guard definitions via symbol search and manual reads in [src/shared/lib/errorHandler.ts](src/shared/lib/errorHandler.ts#L256-L289), [src/shared/lib/storeUtils.ts](src/shared/lib/storeUtils.ts#L406-L430), [src/shared/utils/firebaseGuard.ts](src/shared/utils/firebaseGuard.ts#L37-L126), [src/shared/utils/firebaseSanitizer.ts](src/shared/utils/firebaseSanitizer.ts#L83-L137).
- Queried call sites using pattern search for `assert*`, `withFirebase*`, and reviewed `dailyDataStore` usage to observe null-check idioms.

## Findings (Facts)
- Guard inventory
  - Validation guards in [src/shared/lib/errorHandler.ts](src/shared/lib/errorHandler.ts#L256-L289): `assertExists`, `assertNotEmpty`, `assertInRange`; no call sites found outside definitions (unused globally).
  - Store-specific guard in [src/shared/lib/storeUtils.ts](src/shared/lib/storeUtils.ts#L406-L414): `assertDailyDataExists` with eight call sites inside [src/shared/stores/dailyDataStore.ts](src/shared/stores/dailyDataStore.ts#L183-L656); throws `Error` after console.error.
  - Finder helper in [src/shared/lib/storeUtils.ts](src/shared/lib/storeUtils.ts#L424-L430): `findTaskOrThrow`; no external usage detected.
  - Firebase sync guards in [src/shared/utils/firebaseGuard.ts](src/shared/utils/firebaseGuard.ts#L37-L126):
    - `withFirebaseSync`: ~18 call sites across repositories (battleRepository:3, inboxRepository:6, tempScheduleRepository:4, weeklyGoalRepository:5).
    - `withFirebaseFetch`: 2 call sites (templateRepository, weeklyGoalRepository).
    - `shouldSyncToFirebase`, `executeFirebaseSync`: defined but no external call sites.
  - Sanitization guard in [src/shared/utils/firebaseSanitizer.ts](src/shared/utils/firebaseSanitizer.ts#L83-L137): `sanitizeForFirebase` converts `undefined`→`null`, repairs invalid keys/dotted paths before Firebase writes; not tied to a broader guard pattern.
- Usage patterns
  - Null/undefined handling is mostly inline: optional chaining (`dailyData?.`), default fallbacks (`|| {}`), and early returns; centralized guards are rare outside `dailyDataStore` and Firebase sync wrappers.
  - Error messages vary: errorHandler guards emit `Validation failed: <field>`, while store guard uses `[DailyDataStore]` prefix; Firebase guards log ad-hoc console errors. No shared error type or code standard ties these together.
  - Guard functions seldom typed as type guards beyond `assert*`; no generic `isNonNullish`/`isNonEmptyArray` helpers exist to lift null checks into reusable predicates.

## Findings (Gaps / Risks)
- Guard definitions exist but are unused (`assertExists`, `assertNotEmpty`, `assertInRange`, `findTaskOrThrow`), suggesting missing integration or duplication of inline checks.
- No generic non-nullish / array / object type guards to standardize filtering and map operations; inline `if (!value)` patterns risk conflating empty string/zero with nullish.
- Error messaging and exception types are inconsistent across guards; lack of standardized error codes makes downstream handling/log correlation difficult.
- Firebase guard usage is repository-focused; other data paths (stores/services) rely on manual checks, so null/sync safety is uneven.

## Analysis Recommendations (next investigative steps)
- Map which modules rely on inline null checks vs guards to prioritize where adopting shared guards would reduce risk (e.g., other stores beyond dailyDataStore).
- Trace error surfaces for guard failures to determine whether standardized error codes/types are needed for logging and UX surfaces.
- Verify whether `withFirebaseSync`/`withFirebaseFetch` consistently wrap all Firebase writes/reads or if gaps exist in other repositories/services.
- Inventory situations where `undefined` sneaks into persistence (Dexie/RTDB) to see if `sanitizeForFirebase` is applied consistently or needs integration tests.

## Open Questions
- Should unused guard helpers be removed or adopted? If adopted, which modules would benefit most (e.g., repositories vs stores)?
- What error taxonomy (codes/prefixes) should guard failures conform to for consistent user messaging and logging?
- Is there a need for type-level guards (e.g., `isNonNullish`, `isNonEmptyArray`, `isRecord`) to support safer array filtering/map pipelines?