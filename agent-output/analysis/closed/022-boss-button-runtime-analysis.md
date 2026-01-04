# 022-boss-button-runtime-analysis

**Status:** Active  
**Changelog:** Initial scan of boss CTA flow, crash point, and asset path.

## Value Statement and Business Objective
Prevent the boss ("보스") CTA from crashing the app and ensure boss album visuals load reliably so players can view progression without errors or broken imagery.

## Objective
Map the TopToolbar boss button path, identify the runtime `useEffect` ReferenceError source, and gauge severity of the 410 Gone image failure with mitigation options.

## Context
User reports: clicking TopToolbar "보스" button crashes with `Uncaught ReferenceError: useEffect is not defined` in bundled index-*.js, and a boss-related image URL returns 410 Gone. Scope is frontend/UI analysis only.

## Methodology
- grep scan for TopToolbar + boss keywords and `useEffect` usage.
- Read TopToolbar and BossAlbumModal implementations.
- Inspect local boss assets and asset URL helper.

## Findings (facts)
1) Boss CTA wiring
- TopToolbar renders CTA `renderCTA('boss-album', '🏆 보스', ...)` opening BossAlbumModal with badge for daily defeats [src/app/components/TopToolbar.tsx#L27](src/app/components/TopToolbar.tsx#L27), [src/app/components/TopToolbar.tsx#L77](src/app/components/TopToolbar.tsx#L77), [src/app/components/TopToolbar.tsx#L280](src/app/components/TopToolbar.tsx#L280), [src/app/components/TopToolbar.tsx#L293](src/app/components/TopToolbar.tsx#L293).
- Boss modal component lives at [src/features/battle/components/BossAlbumModal.tsx](src/features/battle/components/BossAlbumModal.tsx); only routing target for the CTA (no intermediate routes/popovers).

2) Crash trigger file
- BossAlbumModal uses `useEffect` (loads recent stats when open) at [src/features/battle/components/BossAlbumModal.tsx#L483](src/features/battle/components/BossAlbumModal.tsx#L483) but imports only `useMemo`, `useState`, `useCallback` at top—`useEffect` is missing from the React import [src/features/battle/components/BossAlbumModal.tsx#L17](src/features/battle/components/BossAlbumModal.tsx#L17). This would produce `useEffect is not defined` once the modal code executes (when the Boss CTA is clicked).

3) Boss asset paths
- Boss images resolve via `getBossImageSrc` → `${import.meta.env.BASE_URL}assets/bosses/${imageFileName}` [src/features/battle/utils/assets.ts#L4](src/features/battle/utils/assets.ts#L4).
- Local assets exist for boss_01.webp … boss_31.webp under public/assets/bosses (verified by directory listing).

## Hypotheses (ranked) and how to confirm
1) Missing React import in BossAlbumModal causes the ReferenceError.  
   - Confirm: open BossAlbumModal and check imports vs hook usage; devtools stack should point to the modal chunk [src/features/battle/components/BossAlbumModal.tsx#L17](src/features/battle/components/BossAlbumModal.tsx#L17) and [src/features/battle/components/BossAlbumModal.tsx#L483](src/features/battle/components/BossAlbumModal.tsx#L483). Add the import and re-run Boss CTA to see if error disappears.

2) If the bundle still errors, another hook in the Boss modal subtree could miss imports.  
   - Confirm: search boss subtree for `useEffect` and ensure corresponding imports; focus on BossAlbumModal first since it fires immediately when CTA mounts.

3) 410 Gone for boss images likely due to incorrect BASE_URL at runtime or a removed remote host when packaged (e.g., pointing to an outdated CDN instead of local assets).  
   - Confirm: check network tab for requested URL of the failing image; validate it matches `${BASE_URL}assets/bosses/*.webp`. If URL is remote and returns 410, ensure assets are served locally in Electron or add a fallback placeholder.

## 410 Gone severity & mitigation (high level)
- Severity: Non-crashing UI degradation; modal still loads but shows broken image.  
- Mitigation options: (a) prefer local packaged assets via `getBossImageSrc`; (b) add fallback placeholder/"image not found" state; (c) cache-bust or rehost the missing file if a remote CDN is intended.

## Recommendations
- Fix import: add `useEffect` to the React import list in BossAlbumModal to remove the crash.  
- After fixing, re-run the boss CTA and watch for any additional missing hook imports.  
- Verify the failing image URL in devtools; if it is remote, switch to local asset path or add a graceful fallback UI to avoid broken visuals.

## Open Questions
- What exact URL returned 410 Gone (full path)?  
- Is BASE_URL customized in this Electron build that could mispoint asset requests?  
- Any other boss-related components (e.g., sidebar) loading images from a remote CDN instead of local assets?
