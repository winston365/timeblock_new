
# TimeBlock Planner – Copilot Instructions

## Quick Map
- Entry: `src/main.tsx` → `src/App.tsx` → `src/app/AppShell.tsx`
- Feature-first UI: `src/features/**` (domain), shared infra: `src/shared/**`, data layer: `src/data/**`
- Imports use `@/` alias (see `vite.config.ts` / `tsconfig.json`)

## Non‑Negotiables
- Storage: no new `localStorage` usage (exception: `theme` during early startup in `src/main.tsx`); use repositories or Dexie `db.systemState`
- Defaults: never hardcode fallbacks; import from `src/shared/constants/defaults.ts`
- Data flow: UI/Stores → Repositories (`src/data/repositories/**`) → Dexie (`src/data/db/dexieClient.ts`, schema v17) → Firebase sync (async)
- Firebase: never call Firebase APIs directly from UI/Stores; repository/service layer only
- Modals: ESC must close and backdrop click must NOT close; use `useModalEscapeClose` (`src/shared/hooks/useModalEscapeClose.ts`)
- Safety: prefer `?.` + `??` for nested/optional data access

## Core Patterns
- EventBus: emit from stores/services, subscribe in `src/shared/subscribers/**`; types in `src/shared/lib/eventBus/types.ts`
- Task completion: handler pipeline lives in `src/shared/services/gameplay/taskCompletion/handlers/**`
- Sync: strategy registry in `src/shared/services/sync/firebase/strategies.ts` (update when data contracts change)
- Tasks can live in dailyData vs inbox; when unsure, use `src/shared/services/task/unifiedTaskService.ts`

## Commands
- Dev: `npm run electron:dev` (preferred), `npm run dev`
- Test: `npm test`, `npm run test:coverage`
- Lint: `npm run lint`
