---
ID: 71
Origin: 71
UUID: f3a4c9d0
Status: Active
---

# Value Statement and Business Objective
Keep GitHub Copilot guidance concise and repo-accurate so AI outputs respect local-first Electron architecture, data safety policies, and existing workflows, reducing rework and regressions.

# Objective
Produce evidence-backed inputs for a refreshed `.github/copilot-instructions.md` that reflects current architecture boundaries, workflows, and project-specific rules.

# Context
- User asked for a 20–50 line Copilot instruction update grounded in actual repo patterns.
- Existing guidance is verbose and partially redundant with CLAUDE.md/README.md; some subdocs conflict (e.g., localStorage fallback references).

# Methodology
- Retrieved prior memory on policies (local-first, optional chaining, modal UX, no direct Firebase).
- Ran glob search for AI/convention docs; read `.github/copilot-instructions.md`, `CLAUDE.md`, top-level `README.md`.
- Inspected entry flow (`src/main.tsx` → `src/App.tsx` → `src/app/AppShell.tsx`).
- Reviewed supporting READMEs: event bus, Firebase sync, Dexie, task completion handlers, dailyData repository, task service.
- Parsed `package.json` scripts for dev/build/test commands.

# Findings (fact)
- Current `.github/copilot-instructions.md` already mandates Dexie primary, Firebase sync, repository pattern, handler pipeline, event bus, optional chaining, modal ESC-only close, no localStorage except theme, and use of defaults/constants.
- Entry path: `src/main.tsx` loads `App`, which initializes Google sync subscriber and renders `AppShell`; `AppShell` wires layout, services, modals, and uses numerous hooks/stores.
- Event bus README enforces emit-from-stores/subscribers-only, domain:action naming, dev middlewares, and discourages UI emits.
- Dexie README lists schema tables/v11 history; Firebase sync README describes refactor to conflictResolver/syncCore/strategies (path outdated in doc heading).
- Task completion README defines handler pipeline (BlockCompletion → XPReward → QuestProgress → WaifuAffection) and OCP add-new-handler approach.
- dailyData repository README still shows 3-tier flow including localStorage backup, conflicting with “no localStorage except theme.”
- Task service README documents unified task CRUD across dailyData/globalInbox.
- package.json scripts: dev `vite`, build `vite build`, preview, tests via `vitest run`, coverage `vitest run --coverage`, lint, bump, electron dev/build/prod, dist targets.

# Analysis Recommendations (next analysis steps)
- Cross-check dailyData repository docs vs current policy to confirm localStorage fallback deprecation before finalizing Copilot guidance.
- Verify Firebase sync doc path/terminology matches current folder (`src/shared/services/sync/firebase`) to prevent confusion in instructions.
- Reconfirm modal UX hook location and any recent changes before citing it in condensed guide.

# Open Questions
- Is localStorage fallback fully removed in implementation, or only discouraged? (doc conflict)
- Should Firebase sync instructions cite `shared/services/sync/firebase` or legacy `shared/services/firebase`?)
- Any updated test thresholds/coverage expectations beyond package scripts?

# Changelog
- 2026-01-05: Created analysis doc with evidence from key guides and entry files.
