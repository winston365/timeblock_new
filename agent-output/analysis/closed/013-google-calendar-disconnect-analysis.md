# Value Statement and Business Objective
Stable Google Calendar syncing keeps scheduled tasks mirrored without manual re-auth. Eliminating frequent disconnects reduces user friction and prevents missed or duplicated calendar updates.

## Objective
Identify why Google Calendar auth appears to drop (access token expires and does not auto-refresh), and outline verification steps to confirm root causes on the frontend/electron side.

## Changelog
- 2025-12-21: Initial code-level reconnaissance of Google Calendar auth/storage/refresh flows.

## Context (facts)
- Google auth is handled via Electron IPC and PKCE in [electron/main/index.ts](electron/main/index.ts#L729-L1030); refresh handled at [electron/main/index.ts#L951-L1000](electron/main/index.ts#L951-L1000).
- Renderer API exposure is in [electron/preload/index.ts](electron/preload/index.ts#L83-L107).
- Calendar service stores tokens in Dexie `systemState` via [src/data/repositories/calendarRepository.ts](src/data/repositories/calendarRepository.ts#L11-L126). Tokens live under key `googleCalendarSettings`.
- Renderer auth/token logic is in [src/shared/services/calendar/googleCalendarService.ts](src/shared/services/calendar/googleCalendarService.ts#L47-L470):
  - Login saves `accessToken`, `refreshToken`, `tokenExpiresAt`, `clientId`, `clientSecret`, `enabled` (lines ~76-119).
  - `isTokenValid` checks `tokenExpiresAt` only (line ~123).
  - `refreshAccessToken` requires `refreshToken`, `clientId`, `clientSecret`, and `window.electronAPI.googleOAuthRefresh` (line ~134).
  - `getValidAccessToken` refreshes if expiry is within 5 minutes or missing (line ~183) and `callCalendarApi` retries once on 401 (line ~219).
- Settings UI shows connection state and a manual “토큰 갱신” button that re-runs full login, not refresh, in [src/features/settings/components/tabs/GoogleCalendarTab.tsx](src/features/settings/components/tabs/GoogleCalendarTab.tsx#L35-L220).
- No localStorage usage for tokens; all persistence is Dexie `systemState`.

## Root-Cause Hypotheses (ranked)
1) **Missing refresh preconditions ⇒ auto-refresh short-circuits** (likely). `refreshAccessToken` returns false if any of `refreshToken`, `clientId`, or `clientSecret` are absent or if `window.electronAPI.googleOAuthRefresh` is undefined. In that case `getValidAccessToken` returns null and every Calendar/Tasks API call throws “인증이 필요합니다…”, effectively forcing a manual re-login. Evidence: guard clauses at [src/shared/services/calendar/googleCalendarService.ts#L134-L150](src/shared/services/calendar/googleCalendarService.ts#L134-L150). If older installs never persisted `clientSecret`/`clientId`, or if Dexie entry was partially cleared, refresh can never run.

2) **Expiry field mismatch from legacy data ⇒ perpetual “expired” state and repeated full logins** (medium). Repo schema earlier used `expiresAt`/`email` ([src/data/repositories/calendarRepository.ts#L11-L27](src/data/repositories/calendarRepository.ts#L11-L27)), while service/UI now rely on `tokenExpiresAt`/`userEmail` ([src/shared/services/calendar/googleCalendarTypes.ts](src/shared/services/calendar/googleCalendarTypes.ts#L47-L80) and `isTokenValid` at line ~123). If a user record still has `expiresAt` but not `tokenExpiresAt`, `isTokenValid` always returns false, UI shows “토큰 만료”, and the “갱신” button reopens the full OAuth flow instead of invoking refresh. Auto-refresh will still attempt, but only if `clientSecret`+`refreshToken` exist; otherwise it fails silently (Hypothesis 1).

3) **Refresh only on demand + single retry on 401 ⇒ easily falls back to manual login** (medium). Tokens are refreshed only when an API call is made; there is no background timer. `callCalendarApi` retries once on a 401, then surfaces the error (line ~219). Transient network failures, revoked refresh tokens, or running the renderer without Electron (`window.electronAPI` undefined) will surface as “인증 필요” and the UI currently directs the user to re-auth via full OAuth instead of a lightweight refresh. This matches a pattern of “keeps disconnecting” after idle periods or in non-Electron dev runs.

## How to Confirm / Instrument
- **Check stored settings in Dexie**: Inspect `systemState` → key `googleCalendarSettings` for presence of `refreshToken`, `clientId`, `clientSecret`, and `tokenExpiresAt`. If missing, Hypothesis 1 is confirmed. (DevTools > Application > IndexedDB > timeblock_db > systemState.)
- **Add targeted logging**:
  - In `refreshAccessToken` around [src/shared/services/calendar/googleCalendarService.ts#L134-L170](src/shared/services/calendar/googleCalendarService.ts#L134-L170), log when preconditions are missing and include the keys present in settings.
  - In `callCalendarApi`’s 401 branch [src/shared/services/calendar/googleCalendarService.ts#L219-L244](src/shared/services/calendar/googleCalendarService.ts#L219-L244), log status, error body, and whether refresh succeeded.
  - In Electron refresh handler [electron/main/index.ts#L951-L1000](electron/main/index.ts#L951-L1000), log the POST body sans secrets and whether Google returns `refresh_token`.
- **Legacy field check**: Log the keys of the loaded settings object in `getGoogleCalendarSettings` (renderer) to see if only `expiresAt` exists (Hypothesis 2). If so, add a temporary migration that copies `expiresAt` → `tokenExpiresAt` for validation.
- **Electron availability**: In a repro run, check `window.electronAPI?.googleOAuthRefresh` before sync events; if undefined, Hypothesis 3 (running in Vite/web) is active and auto-refresh cannot work.

## Repro Notes (UI)
1. Open Settings → Google Calendar tab ([src/features/settings/components/tabs/GoogleCalendarTab.tsx#L35-L220](src/features/settings/components/tabs/GoogleCalendarTab.tsx#L35-L220)).
2. Enter client ID/secret, save, then “Google 계정으로 연동하기” to store tokens.
3. After ~1h (access token expiry) create/update a scheduled task to trigger sync. Observe whether a 401 error/toast prompts full login instead of silent refresh.
4. If the tab shows “토큰 만료” immediately after app restart, inspect the stored settings for missing `tokenExpiresAt`/credentials.

## Recommendations (next investigative steps)
- Instrument refresh precondition failures and 401 retry outcomes to see if refresh is being attempted and why it fails.
- Capture the shape of `googleCalendarSettings` in Dexie across affected users; verify presence of `tokenExpiresAt`, `refreshToken`, `clientId`, `clientSecret`.
- Decide whether Settings “토큰 갱신” should call `refreshAccessToken` when refresh token exists to avoid forcing a full OAuth flow.

## Open Questions
- Do affected users have missing `clientSecret`/`clientId` in stored settings (legacy data)?
- Are repros happening in packaged Electron builds or in `npm run dev` (no `electronAPI`)?
- Do Google token responses for this client consistently omit `refresh_token` on refresh, causing rotation failures?
