Value Statement and Business Objective
- Deliver stable Boss Album modal rendering so Electron prod builds avoid runtime ReferenceError and users can review boss progress without crashes.

Status: Active

Changelog
- Investigated Boss button render path, BossAlbumModal internals, hook imports, and build configuration.

Objective
- Identify the origin of `Uncaught ReferenceError: useEffect is not defined` in Electron build when opening the Boss Album modal and isolate the most suspicious files/lines.

Context
- Error surfaces only after clicking the Boss button in TopToolbar (Electron prod build via GitHub Actions). BossAlbumModal previously believed to import useEffect.
- Stack mentions minified function `dPe` in index-D81OOiut.js; source maps unavailable in prod bundle.

Methodology
- Traced component tree from TopToolbar to BossAlbumModal and its nested components. Reviewed BossAlbumModal dependencies and hooks. Checked React/Vite versions and build config for tree-shaking quirks.

Findings (facts)
1) Component tree on Boss click: TopToolbar -> BossAlbumModal (modal root) -> branches: BossCard grid (all/today views), BossDetailOverlay (conditional), StatsTab (stats view).
2) BossAlbumModal imports React hooks at [src/features/battle/components/BossAlbumModal.tsx#L17](src/features/battle/components/BossAlbumModal.tsx#L17) but omits `useEffect`; the modal body uses `useEffect` at [src/features/battle/components/BossAlbumModal.tsx#L487](src/features/battle/components/BossAlbumModal.tsx#L487) to load recent stats. In React 19, undeclared `useEffect` is `undefined`, causing the observed ReferenceError when the modal renders.
3) Internal components/hooks used inside BossAlbumModal:
   - `BossCard` (tilt card UI) uses `useState` for tilt/glare; depends on `getBossImageSrc`, `DIFFICULTY_COLORS`, and boss props.
   - `BossDetailOverlay` shows boss info overlay; no hooks.
   - Inline `StatsTab` inside BossAlbumModal uses `useMemo` only; no `useEffect`.
   - External dependencies: `BOSSES`, `getBossById`, `useBattleStore`, `getRecentBattleStats`, `useModalHotkeys`, `Boss/BossDifficulty/DailyBattleStats` types, and asset helper `getBossImageSrc`.
4) TopToolbar renders BossAlbumModal when `showBossAlbum` is true [src/app/components/TopToolbar.tsx#L142-L169](src/app/components/TopToolbar.tsx#L142-L169); no code splitting or lazy loading involved.
5) React 19.2.1 in package.json; Vite 7.2.2 with default @vitejs/plugin-react and minimal build config [vite.config.ts#L1-L17](vite.config.ts#L1-L17). No custom tree-shaking or rollup options that would strip hooks. React 19 still expects explicit named imports for hooks.
6) Given only one `useEffect` usage without import in this path, the minified symbol `dPe` likely corresponds to the BossAlbumModal function after minification, where the missing binding triggers the ReferenceError.

Hypotheses
- None needed: missing `useEffect` import is sufficient to explain the runtime error.

Recommendations
- Add `useEffect` to the React named imports in BossAlbumModal at [src/features/battle/components/BossAlbumModal.tsx#L17](src/features/battle/components/BossAlbumModal.tsx#L17). Rebuild Electron bundle and verify modal opens without ReferenceError.
- (Optional) Add a quick smoke test or lint rule to catch undefined React hooks in battle modal components.

Top 3 suspect files/lines
1) Missing hook import: [src/features/battle/components/BossAlbumModal.tsx#L17](src/features/battle/components/BossAlbumModal.tsx#L17).
2) Hook usage without binding: `useEffect` call in modal body [src/features/battle/components/BossAlbumModal.tsx#L487](src/features/battle/components/BossAlbumModal.tsx#L487).
3) Boss modal entry point: Boss button triggers modal render [src/app/components/TopToolbar.tsx#L142-L169](src/app/components/TopToolbar.tsx#L142-L169) (context for reproduction).

Open Questions
- None; root cause appears singular (missing import).
