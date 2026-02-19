# TimeBlock Planner Workspace Instructions

These instructions apply to all tasks in this workspace. Keep changes local-first, repository-driven, and safe for Electron.

## Build and Test
- Install deps: `npm install`
- Preferred dev loop: `npm run electron:dev`
- Web-only dev: `npm run dev`
- Required before handoff: `npm run lint` and `npm test`
- If behavior could differ by runtime, also verify: `npm run preview` and `npm run electron:prod`
- Packaging checks: `npm run dist` (or `npm run dist:win|dist:mac|dist:linux`)

## Architecture Boundaries
- Renderer UI (`src/features/**`) uses stores, not DB/Firebase.
- Stores (`src/shared/stores/**`) coordinate state and call repositories.
- Repositories (`src/data/repositories/**`) are the only persistence boundary for Dexie/Firebase.
- DB schema and migrations live in `src/data/db/dexieClient.ts`.
- Firebase sync behavior is centralized in `src/shared/services/sync/firebase/**`.
- Electron main/preload boundaries are strict: privileged APIs in `electron/main/index.ts`, bridge in `electron/preload/index.ts`.

## Non-Negotiable Conventions
- Do not use `localStorage` except the `theme` key at startup.
- Do not access `db.*` outside `src/data/repositories/**` and `src/data/db/**`.
- Do not hardcode fallback defaults; use `src/shared/constants/defaults.ts`.
- Use `@/` import alias for `src/`.
- Event bus naming must follow `[Domain]:[Action]`.
- Do not call Firebase directly from UI/stores; route through repositories/services.

## Pitfalls to Avoid
- Subscription/sync feedback loops when mutating state inside listeners.
- Schema drift when changing models without updating migration + repository + sync strategy.
- Date/time regressions around KST day boundaries and daily reset logic.
- Desktop-only regressions: verify Electron runtime for features touching IPC/OS behavior.

## Key References
- `README.md` for product and high-level architecture overview.
- `CLAUDE.md` for deeper architecture and workflow guidance.
- `.eslintrc.cjs` for enforced architectural boundaries.
- `src/main.tsx` and `src/app/AppShell.tsx` for app bootstrap flow.
- `src/data/repositories/baseRepository.ts` for persistence contract.
- `src/shared/services/sync/firebase/syncCore.ts` for sync pipeline.
