# TimeBlock Planner – AI Agent Guide
## Architecture
- Renderer lives in `src/**` (React + Vite) while `electron/main/index.ts` and `electron/preload/index.ts` own the desktop shell; entry is `src/main.tsx` → `AppShell`.
- Feature modules under `src/features/*` keep UI, hooks, and utils per domain (schedule, waifu, gemini, stats, settings, ignition, insight, weather, etc.); cross-cutting pieces live in `src/shared/**` (components, stores, services, lib).
- Global state is handled by Zustand stores inside `src/shared/stores/*`; components subscribe via hooks and the stores delegate persistence to repositories to keep side effects centralized.
- **Persistence flows through Dexie → Firebase ONLY**; `localStorage`는 **금지** (예외: `theme` 키만 허용). Repositories in `src/data/repositories/*` (extending `baseRepository.ts`) are the only layer that should touch storage APIs.
- Dexie schema + migrations live in `src/data/db/dexieClient.ts`; v12 added `ragDocuments` for vector persistence. Whenever you change stored shapes, bump the version, add an `upgrade`, and mirror the change in Firebase strategies.
## Workflows
- `npm run dev` starts the Vite renderer only; `npm run electron:dev` launches the full Electron app and is the preferred E2E loop.
- `npm run build` bundles the renderer, `npm run electron:build` transpiles main/preload into `dist-electron/`, and `npm run dist` / `dist:win|mac|linux` hands off to electron-builder (artifacts in `release/`).
- `npm run lint` is the lone automated check; there is no dedicated test suite, so manually verify in both `npm run preview` and `npm run electron:prod` whenever behavior could diverge between web and desktop.
- Firebase credentials are user-provided through the Settings modal; `src/data/firebase/config.ts` stays gitignored—never add secrets to the repo.
## Patterns & Conventions
- Use the `@/` path alias (see `vite.config.ts`) for imports; keep components PascalCase, hooks/services camelCase, and respect the feature-first layout.
- **⚠️ localStorage 사용 금지!** Data writes: Repository → Dexie → `syncToFirebase(strategy, key)`. 시스템 상태는 `db.systemState.put({ key, value })` 사용.
- **Task는 dailyData(날짜별)와 globalInbox(전역)에 분리 저장됨**; 작업 ID만 알고 저장소 위치를 모를 때는 `@/shared/services/task/unifiedTaskService`의 `updateAnyTask()`, `getAnyTask()` 등을 사용 (점화, 통합 검색 등에서 활용).
- When altering sync behavior, edit/add strategies under `src/shared/services/firebase` and keep Last-Write-Wins + retry queue semantics described in `src/shared/services/firebase/README.md`.
- Task completion side effects live in `src/shared/services/gameplay/handlers/*` and are orchestrated by `taskCompletionService.ts`; new behaviors belong there as `TaskCompletionHandler` implementations.
- Event-driven UI logic uses `src/shared/lib/eventBus` with `[domain]:[action]` names; unsubscribe in `useEffect` cleanup and enable logger/performance middleware in dev for tracing.
- Daily reset + template auto-generation runs inside `app/AppShell.tsx` + `app/hooks/useAppInitialization.ts`; server-side templates are generated via `functions/index.js` at 00:00 KST, so the client should never double-generate.
## Storage Policy (중요!)
```typescript
// ❌ 금지 - 개발 환경에서 경고 발생
localStorage.setItem('key', value);
getFromStorage('key', default);  // deprecated

// ✅ 올바른 방법 - Dexie systemState 사용
import { db } from '@/data/db/dexieClient';
await db.systemState.put({ key: 'myKey', value: data });
const record = await db.systemState.get('myKey');
```
- 유일한 예외: `theme` 키 (앱 시작 시 Dexie 초기화 전 필요)

## Default Values Policy (중요!)
```typescript
// ❌ 금지 - 하드코딩된 fallback 값은 불일치 버그의 원인
const cooldown = settings?.ignitionCooldownMinutes ?? 5;
const duration = settings?.ignitionDurationMinutes ?? 3;

// ✅ 올바른 방법 - SETTING_DEFAULTS 사용
import { SETTING_DEFAULTS, IGNITION_DEFAULTS, IDLE_FOCUS_DEFAULTS, GAME_STATE_DEFAULTS } from '@/shared/constants/defaults';

const cooldown = settings?.ignitionCooldownMinutes ?? SETTING_DEFAULTS.ignitionCooldownMinutes;
const duration = settings?.ignitionDurationMinutes ?? IGNITION_DEFAULTS.durationMinutes;
```
- 모든 설정 관련 fallback 값은 `src/shared/constants/defaults.ts`에서 import
- `SETTING_DEFAULTS`: 사용자 설정 fallback (ignitionCooldownMinutes, justDoItCooldownMinutes, ignitionInactivityMinutes 등)
- `IGNITION_DEFAULTS`: 점화 시스템 (durationMinutes, xpCost, dailyFreeSpins)
- `IDLE_FOCUS_DEFAULTS`: 비활동 집중모드 (enabled, minutes, countdownSeconds)
- `GAME_STATE_DEFAULTS`: 게임 상태 초기화 (dailyFreeIgnitions)
## Integration Notes
- Gemini flows sit under `src/shared/services/ai/*` and `src/features/gemini/**`; build persona context (see `personaUtils`) before invoking `geminiApi.ts` to keep responses coherent.
- Waifu assets in `public/assets/waifu/poses/**` map to affection tiers; state lives in `waifuCompanionStore` + `waifuRepository`, so keep filenames stable if you swap art.
- The Quick Add window (global shortcut Ctrl/Cmd+Shift+Space) routes `?mode=quickadd` and still writes through `inboxRepository` → sync pipeline; keep it lightweight with zero direct Dexie calls.
- Dexie v7 introduced `completedInbox`, v8 seeded the "don't-do" checklist, v9 added `images`, v10 added `weather` cache, v11 added `aiInsights`; ensure future migrations stay idempotent and backfill both IndexedDB and Firebase.
- Large repositories are modularized (e.g., `dailyData/` folder with coreOperations, taskOperations, blockOperations, queryHelpers).
- Gemini AI module is split into `src/shared/services/ai/gemini/` (apiClient, personaPrompts, taskFeatures, types).
- Settings and Stats modals use tab-based decomposition in `components/tabs/` subfolders.
- Use the event bus performance monitor (`window.__performanceMonitor`) and SyncLog modal when debugging cascaded handlers or Firebase sync issues before shipping.
