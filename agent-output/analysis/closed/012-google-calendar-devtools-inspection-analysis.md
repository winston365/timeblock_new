# Value Statement and Business Objective
Help the user quickly inspect and diagnose Google Calendar disconnect causes by reading the Dexie `systemState` record `googleCalendarSettings` via Electron DevTools, so they can reconnect without touching code.

## Changelog
- Added two DevTools inspection flows (Application tab and Console snippet).
- Added decision tree for common bad states (missing tokens, missing credentials, bad expiry formats, missing preload bridge).

## Objective
Provide an ADHD-friendly, step-by-step DevTools guide to view/edit `googleCalendarSettings` in Dexie `systemState`, plus next-action decisions for likely disconnect states.

## Context
- Settings live in IndexedDB (Dexie) `systemState` under key `googleCalendarSettings`.
- No backend/Electron code changes allowed; user will operate inside Electron DevTools only.

## Methodology
- Describe two inspection paths: (1) Application tab manual view/edit; (2) Console-based safe dump.
- Enumerate decision branches for observed field issues and prescribe user actions.

## Findings (guides)
1) Application tab (manual view/edit)
- Open Electron app → DevTools (Ctrl+Shift+I) → Application tab → IndexedDB → dexie.
- Tables → systemState → find key `googleCalendarSettings` → select row.
- Value column shows JSON; double-click to edit if needed. Copy before editing.
- Expected shape: `{ clientId, clientSecret, refreshToken, accessToken?, tokenExpiresAt }`.

2) Console dump (safe, read-first)
- In DevTools Console, run:
```
const db = await window.dedentDb?.();
const row = await db?.systemState.get('googleCalendarSettings');
console.log('googleCalendarSettings', row);
```
- If `window.dedentDb` is unavailable, use Dexie global fallback:
```
const db = window.dexieDb || window.db;
const row = await db?.systemState.get('googleCalendarSettings');
console.log('googleCalendarSettings', row);
```
- Output: the stored object or `undefined` if missing.

## Decision Tree (what to do next)
- Missing `refreshToken`: Re-login Google in the app (Settings → Google Calendar connect). If still missing, delete the row in Application tab and reconnect.
- Missing `clientId` or `clientSecret`: Re-enter credentials in Settings. If fields are blanked, delete row and reconnect so wizard repopulates.
- `tokenExpiresAt` missing: Trigger a fresh login so the app writes expiry; deleting the row forces a clean reconnect.
- `tokenExpiresAt` is seconds (too small) or string: Delete row, reconnect to rebuild with millis number. Avoid manual string edits.
- `electronAPI` undefined when running console snippet: You are likely in the Vite-only renderer. Launch the full Electron app (`npm run electron:dev`) and retry.

## Recommendations
- Always copy the existing JSON before edits. Prefer delete+reconnect over manual token edits.
- After fixing, try a calendar sync or wait for scheduled refresh to confirm tokens persist.

## Open Questions
- Do any users still have legacy shapes (e.g., `expires_at`)? If yes, we may need a migration script (outside current constraints).
