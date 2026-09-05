# Feature: 7 - Deploy & polish

**From build-plan:** feature 7
**Status:** verified

## Goal

Close out MVP so the app ships cleanly on GitHub Pages and feels finished on phone and laptop: locked Pages routing config plus a deploy workflow, visible `lastEdited` ordering that is not disturbed by pan/zoom, a zoom % indicator, and verified responsive plus storage/error states.

## In scope

- GitHub Pages deploy config: lock `base: "/mindmap/"` + `HashRouter` decision (no `404.html` needed), add `/.github/workflows/deploy.yml` (build `dist/` from `main`, Pages deploy), verify production build resolves assets under `/mindmap/`.
- Zoom % indicator on the editor canvas: live `Math.round(zoom * 100)%` badge, updates on wheel/pinch/re-center, read-only display with accessible label.
- `lastEdited` correctness: home cards keep showing `Edited {date}` newest-first; panning/zooming (viewport-only save) must not bump `updatedAt` and reorder the home list.
- Responsive/touch polish audit: 360px and 390px widths with no horizontal scroll, header actions reachable, plus targets stay `>=44px`, existing long-press vs drag behavior unchanged.
- Error/empty-state audit: storage-unavailable banner, corruption-reset banner, quota-full snackbar, project-not-found page with back link, empty-map placeholder, export-failure banner, invalid-viewport fallback. Fill only genuine gaps; do not redesign flows.

## Out of scope

- `/ci` Verify command and branch protection (separate explicit setup).
- `BrowserRouter` clean URLs, `public/404.html`, custom domain.
- Actual push, release, or Pages enablement (local config only; deploy happens after merge via GitHub).
- Dark mode, present mode, PDF/print, undo/redo, search/sort/duplicate, JSON import/export, cloud sync, ads, keyboard nav beyond current focus handling.
- Media/rectangle nodes, graph cross-links, node-text limit change (already `60` via `MAX_NODE_TEXT_LENGTH`).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Pages deploy config** - lock `vite.config.ts` base + `HashRouter` comment, fix absolute asset refs that break under `/mindmap/` (e.g. `index.html` `/favicon.svg` to relative/`%BASE_URL%`), add `.github/workflows/deploy.yml` (Node 22, `npm ci`, `npm run build`, upload `dist/`, deploy-pages), confirm `npm run build` emits asset paths under `/mindmap/`. *Done when:* workflow file exists with `contents: read + pages: write + id-token: write`, `npm run build` passes, built `index.html` references `/mindmap/` assets and favicon resolves from the deployed subpath.
- [x] **Step 2 - Zoom % indicator** - pure `formatZoomPct(zoom)` helper plus canvas badge (bottom-right pill) reading live `viewport.zoom`, `aria-label="Zoom {pct}"`, updates on wheel/pinch/re-center without affecting pan math. *Done when:* editor shows e.g. `100%`, wheel-in shows `~120%`, Re-center resets badge to the fitted value, badge never blocks node taps.
- [x] **Step 3 - lastEdited without viewport noise** - change `setViewport` to preserve `updatedAt` (viewport-only saves do not reorder home), keep `addChild/updateText/delete/collapse/rename/create` bumping `updatedAt`; add Vitest coverage for viewport-preserves-`updatedAt` plus `formatZoomPct` edge cases (NaN, clamp bounds). *Done when:* `npm test` green, panning a project does not move it to top of home list, editing text still does.
- [x] **Step 4 - Responsive and error-state gaps** - audit and fix only real gaps at 360/390px widths (header wrap, no x-scroll, badge/plus reachability) and confirm all existing banners/placeholders trigger (storage-off, corrupted JSON, quota, bad id, empty map, export throw, invalid viewport). *Done when:* 360px editor has no horizontal scroll with reachable Re-center/Export plus readable zoom badge; each error path shows its banner/placeholder without crashing canvas state.
- [x] **Step 5 - Browser coverage and full verification** - extend Playwright smoke with zoom-badge (`%` visible, stays in sync after Re-center) + bad-project-route (not-found + back link) assertions; run the full gate. *Done when:* `npm run build`, `npm run lint`, `npm test`, `npm run test:browser` all pass.

## Files / areas

- `vite.config.ts` (base comment lock, no logic change expected)
- `.github/workflows/deploy.yml` (new)
- `src/components/canvas/TreeCanvas.tsx`, `src/components/canvas/TreeCanvas.css` (zoom badge placement)
- `src/components/canvas/useViewport.ts` (expose zoom only; no math change)
- `src/lib/zoom.ts` (new, `formatZoomPct`) + `src/lib/zoom.test.ts` (new)
- `src/lib/storage.ts` (`setViewport` stops bumping `updatedAt`) + `src/lib/storage.test.ts` (extend)
- `src/components/home/ProjectCard.tsx` (no redesign; verify `Edited {date}` only)
- `src/pages/HomePage.tsx`, `src/pages/EditorPage.tsx` (verify banners/placeholders only)
- `e2e/smoke.spec.ts` (extend: zoom badge visible/updates, unknown project shows not-found + back link)

## Data / contracts

- `Viewport { x: number, y: number, zoom: number }` unchanged; `MIN_ZOOM = 0.25`, `MAX_ZOOM = 3`, `DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 }`; invalid stored viewport falls back to default (existing `isValidViewport` path).
- **Load-bearing change:** `setViewport(projectId, viewport)` preserves `Project.updatedAt` (no `bumpedIso` on that path). All other mutators (`createProject`, `renameProject`, `addChildNode`, `updateNodeText`, `setNodeCollapsed`, `deleteNodeSubtree`) keep bumping `updatedAt` for newest-first sort. Home sort stays `updatedAt desc, createdAt desc`.
- `formatZoomPct(z: number): string` - `!Number.isFinite(z)` returns `"100%"`; otherwise `Math.round(clampZoom(z) * 100) + "%"`; display range `25%`-`300%`.
- Pages contract: production `base "/mindmap/"`, dev `/`; `HashRouter` so deep links work without `404.html`; workflow builds `dist/` on `push: branches: [main]` + `workflow_dispatch`.
- No new env vars, no backend, no storage-key change (`mindmap:projects`, `mindmap:nodes`).

## Testing

- Scope note: `project-overview.md` flagged the zoom % indicator as build-plan-only; this spec confirms it belongs in MVP polish as a tiny orientation aid (read-only badge, no new interaction model).
- Test gate is on: `AGENTS.md` declares `Test: npm test` (Vitest) and `Browser tests: npm run test:browser` (Playwright Chromium smoke via `e2e/smoke.spec.ts`).
- Unit (Step 3, same diff as the fix): viewport-save preserves `updatedAt` while node edit bumps it; `formatZoomPct` handles `1 -> "100%"`, `0.25 -> "25%"`, `3 -> "300%"`, `NaN -> "100%"`, out-of-range clamps.
- Browser (Step 4): extend smoke - zoom badge visible with `%`, Re-center keeps badge in sync, visiting `#/project/does-not-exist` shows Project not found with back link. Visual fidelity and touch long-press feel stay in direct Check/Try, not in automation.
- Gates per step: `npm run build` + `npm run lint` always; `npm test` from Step 3 on; `npm run test:browser` in Step 4. Do not install new runners mid-feature.

## Notes for the AI

- Client-only Vite SPA, React 19 + TS strict (`no any`, `verbatimModuleSyntax`, `noUnusedLocals`); functional components; React Compiler on (no manual memo unless measured).
- Follow `coding-standards.md`: minimal diffs, no unrelated refactors, no `em dashes` in code/docs, `term - description` with hyphen when needed.
- Local-only `localStorage` with in-memory fallback; quota/corruption paths already in `storage.ts` and `HomePage.tsx`, reuse them.
- Styling: plain CSS + MUI `PILL_SX` for pills; zoom badge must match canvas minimal tokens (`var(--surface)`, `var(--border)`, `var(--muted)`), sit above canvas (`z-index`) with `pointer-events: none` except where it must not block plus buttons.
- Do not push, deploy, or enable Pages remotely; workflow file only. `/complete` owns the merge.
