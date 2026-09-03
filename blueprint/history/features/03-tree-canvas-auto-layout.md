# Feature: 3 - Tree canvas with auto-layout

**From build-plan:** feature 3
**Status:** verified

## Goal

Render the mind-map tree on the Editor route (`/#/project/:projectId`) with a centered root, deterministic strict-tree auto-layout (SVG lines + fixed circular nodes), and a pannable/zoomable canvas whose viewport is persisted per project and restorable on re-open — so a 1–15 node map is instantly readable on phone and laptop without manual positioning.

## Design reference

No `prototypes/` directory and no `blueprint/reference/` image exists. Design is anchored to shipped tokens:

- `src/index.css:4` — `--canvas #fdfcfb`, `--node-fill #fff`, `--node-stroke #334155`, `--line #94a3b8`, `--accent #3b82f6`, `--radius*`, `--shadow*` — canvas/nodes/lines must reuse these.
- `src/theme/muiTheme.ts:4` — MUI palette already mapped; canvas chrome buttons (Re-center) use MUI `contained` with `radius-full`.
- `src/pages/EditorPage.tsx:4` + `src/pages/EditorPage.css:1` — current placeholder to replace; keep `AppHeader` variant `editor`.
- `blueprint/context/project-overview.md:62` — UI/UX: circles uniform size, thin stroke, one accent for selection/hover, no gradients.

Prose spec is sufficient — this is not a pixel-replication feature. If a Figma/Canva reference appears, store it in `blueprint/reference/` and link it.

## In scope

- **Layout engine (pure, no DOM):** stateless function `computeLayout(nodes, rootId, options)` → `Map<NodeId, {x,y}>` + `edges: {from,to}[]` + `bounds`. Handles strict tree (`parentId` single parent, no cycles), insertion-order sibling ordering, stable coordinates. Respects `collapsed` (if node.collapsed and feature 5 not yet shipped, hide its subtree from layout and return `hiddenIds`; layout reflows when collapsed changes). Detects cycle/missing-parent and falls back to visible nodes only. Node spacing tuned for fixed circles (~88px diameter) + line clearance. Positions computed, not stored.
- **Tree rendering:** `TreeCanvas` / `Canvas` component replacing `EditorPage` placeholder: SVG layer for edges (thin `var(--line)` lines, `1.5px`), absolute/transform layer for fixed circular nodes (uniform size, `var(--node-fill)`/`var(--node-stroke)`, centered text, char-limited display ~50 chars with wrap + `text-overflow` / line-clamp, tooltip on overflow, root visually centered on first paint).
- **Viewport + persistence:** `Project.viewport {x, y, zoom}` read on open, written on pan/zoom end (debounced, bump `updatedAt`). Helpers `getViewport(projectId)` / `setViewport(projectId, viewport)` in storage layer. `localStorage` unavailable falls back to in-memory + warning (reuse `isStorageAvailable` pattern). Corrupted nodes/projects already handled by storage layer — canvas shows empty/fallback, not crash.
- **Interactions:** pan/drag (mouse drag + one-finger touch drag), wheel zoom (ctrl/alt + wheel or plain wheel), pinch zoom (two-finger), zoom clamped (e.g. `[0.25, 3]`), smooth CSS transform (`translate(x,y) scale(zoom)`). Re-center / Fit-to-view button (MUI) that fits whole tree bounds centered in viewport and persists.
- **Edge & empty states:** unknown `projectId` → inline "Project not found" with link home; single-node map centered; empty nodes (project has 0 nodes due to corruption) → "Empty map" placeholder; off-screen nodes handled by fit; large map (50–100 nodes) still lays out without overlap on desktop width.
- **Route integration:** `src/App.tsx:16` `/#/project/:projectId` drives canvas; `HomePage` navigation already creates valid `rootNode` — no route change needed.

## Out of scope

- Node add/edit inline, plus buttons, char-limit enforcement counter — feature 4.
- Context menu (Edit/Delete/Collapse-Expand), subtree delete, collapsed badge/chevron UI beyond layout hiding, persisted collapsed toggle UI — feature 5 (layout must already hide collapsed subtrees, but the toggle control is deferred).
- PNG export (whole-tree fitted, `html-to-image`/canvas) — feature 6.
- GitHub Pages polish, SPA 404 fallback switch, `lastEdited` beyond viewport bump, responsive chrome beyond canvas fit — feature 7.
- Variable circle sizes, rectangle/media nodes, gradients — post-MVP.
- Graph cross-links (multiple parents, cycles) — post-MVP (feature 9) — this feature enforces strict tree.
- Undo/redo, duplicate/search, cloud sync — post-MVP.
- Test runner / Verify / browser harness — separate `/tests`, `/ci`, `/browser-tests` (no runner today per `AGENTS.md` Commands).
- Switching `localStorage` to `IndexedDB` — locked to `localStorage`.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on. Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks these off as it finishes them, so progress survives a context clear: a fresh session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1 — Layout engine (pure logic, no UI)** — create `src/lib/layout.ts` (or `src/lib/treeLayout.ts`) exporting `type Position {x:number,y:number}`, `type LayoutResult {positions: Map<string,Position>, edges: {from:string,to:string}[], bounds:{minX,maxX,minY,maxY,width,height}, hiddenIds: Set<string>}` and `computeLayout(nodes: Node[], rootId: string, opts?: {gapX?:number,gapY?:number, nodeDiameter?:number})`. Build strict-tree adjacency from `parentId`, BFS/DFS from root, hide subtrees where ancestor `collapsed===true`, detect missing parent / cycle (skip offending node, warn), assign tidy layered positions (depth → y, sibling order → x, centered parent over children). Export `NODE_DIAMETER` constant (88) and gaps. No React, no DOM. Keep <50 lines per helper. *Done when:* `npm run build` + `npm run lint` pass; manual smoke via `node`/`vite` import: single node → `{x:0,y:0}` centered; root + 2 children → children at `y≈120` symmetric around `x=0`; chain of 5 → increasing `y`; collapsed parent hides its descendants in `hiddenIds` and reflow compacts width; insert order preserved; 100-node balanced tree has no overlapping positions (min pairwise distance ≥ `NODE_DIAMETER+gapX`); cycle input does not throw.*

- [x] **Step 2 — Viewport persistence helpers** — extend `src/lib/storage.ts` with `getViewport(projectId:string): Viewport | null`, `setViewport(projectId:string, viewport:Viewport): void`, and `updateProjectViewport(projectId, patch: Partial<Viewport>)` that validates `zoom` clamped `[0.25, 3]`, bumps `Project.updatedAt` to `nowIso()`, persists via `saveProjects`, handles quota/`SecurityError` with same fallback as create/rename, and returns new viewport. Seed default `{x:0,y:0,zoom:1}` on read when missing (migration for pre-feature-3 projects). No UI. *Done when:* `npm run build` + `npm run lint` pass; `setViewport(id,{x:10,y:20,zoom:1.5})` survives reload (`loadProjects` shows persisted), `getViewport` returns default for unknown/missing, clamping keeps `zoom=10` → `3`, quota throw surfaces as typed error, and `updatedAt` strictly increases.*

- [x] **Step 3 — Static tree canvas render (SVG edges + fixed circles)** — replace `src/pages/EditorPage.tsx:9` placeholder with real `EditorPage` that loads `Project` + `Node[]` for `projectId`, calls `computeLayout`, renders `src/components/canvas/TreeCanvas.tsx` (or `src/components/editor/TreeCanvas.tsx`) + `NodeCircle.tsx` + `EdgeLine.tsx` (or co-located). Canvas is `position:relative` + `overflow:hidden` with dotted `var(--canvas)` bg from `EditorPage.css:1`; inner world `div` holds SVG `position:absolute` edges and absolute circles (`width/height: NODE_DIAMETER`, `border:1px solid var(--node-stroke)`, `background:var(--node-fill)`, `border-radius:999px`, centered text with `line-clamp` 3, `font-size ~13px`, `overflow:hidden`, `title` tooltip when `text.length>40`). Unknown `projectId` → "Project not found" + link home; zero nodes → "Empty map". No pan/zoom yet — static centered tree using CSS `transform: translate(-50%,-50%)` at `50% 50%`. Respect insertion order, uniform size strict. *Done when:* `npm run dev` at `/#/project/<validId>` shows centered root circle with project name, child nodes placed by layout with thin gray lines, text wraps inside circle and truncates with tooltip beyond ~50 chars, unknown id shows not-found, hard reload restores same positions, and `npm run build` + `npm run lint` pass. Visual check at 375px width shows no horizontal overflow beyond canvas bounds.*

- [x] **Step 4 — Pan/drag + wheel + pinch zoom** — add interaction to `TreeCanvas`: mouse drag (mousedown→mousemove on canvas → update `x,y`), one-finger touch drag, wheel zoom (wheel delta → `zoom` centered on cursor, `preventDefault`), two-finger pinch zoom (distance delta → `zoom` centered on midpoint), clamp `zoom [0.25,3]`, cursor `grab/grabbing`. Use lightweight handlers (no heavy dep; optional `use-gesture` only if already installed — prefer custom `pointerEvents` to keep bundle small). Viewport state lives in `EditorPage` (`useState` from `getViewport`), transform applied as `transform: translate(x,y) scale(zoom)` on world layer. Persist on gesture end (mouseup/touchend/wheel debounce ~300ms) via `setViewport` (do not persist on every move frame). Disable page scroll while pinching/dragging on canvas. *Done when:* on desktop, dragging canvas pans tree and release persists (reload restores same pan); wheel over canvas zooms centered on cursor and clamps at 0.25/3; on touch (or emulated), one-finger drag pans and two-finger pinch zooms centered on midpoint without scrolling page; rapid gestures do not throw; zoom/pan do not break layout (edges stay attached); `npm run build` + `npm run lint` pass.*

- [x] **Step 5 — Re-center / Fit button + polished states** — add `Re-center` (or `Fit to view`) MUI button in canvas chrome (bottom-right or header-adjacent, `aria-label="Re-center"`), computing fit: `scale = min(1, min(viewW/boundsW, viewH/boundsH)*0.85)` clamped `[0.25,1.5]`, `x = viewW/2 - (boundsCenterX)*scale`, `y = viewH/2 - (boundsCenterY)*scale`, animating transform (`transition: transform 220ms ease`) and persisting viewport. Handle single-node (center at `zoom=1`), whole-tree off-screen after grow, and resize (`ResizeObserver` or `window.resize` → optional re-fit only on explicit button, not auto on every resize). Ensure `AppHeader` project name shows real `Project.name` (not raw `projectId`) and viewport persisted per project (switching projects restores each one's viewport). Add empty/missing polish and prevent long-press/drag conflict stub (long-press deferred to feature 5 but drag must not trigger context menu). *Done when:* clicking Re-center centers whole tree fitted with ~15% padding and persists after reload; switching between two projects restores each one's distinct viewport; single-node map centers at `zoom≈1`; large tree (15 nodes) fits without clipping; window resize keeps transform valid; `npm run build` + `npm run lint` pass; manual flow create (Home) → open editor → pan/zoom → re-center → reload → same viewport → back home → open second project → distinct viewport passes.*

## Files / areas

- `src/lib/layout.ts` (new) — `computeLayout`, `NODE_DIAMETER`, types, spacing constants (pure, no DOM)
- `src/lib/storage.ts` — add `getViewport`/`setViewport`/`updateProjectViewport` + default migration
- `src/pages/EditorPage.tsx` — replace placeholder with loader + `TreeCanvas` composition + not-found/empty states
- `src/pages/EditorPage.css` — extend for canvas, world layer, chrome button positioning (reuse `--canvas`, `--node-*`, `--line`)
- `src/components/canvas/TreeCanvas.tsx` (new) — SVG + nodes world, transform, gesture handlers
- `src/components/canvas/NodeCircle.tsx` (new, optional) — fixed circular node with text clamp/tooltip
- `src/components/canvas/EdgeLine.tsx` (new, optional) — SVG line between positions
- `src/types/node.ts`, `src/types/project.ts` — read-only (no shape change; `collapsed` already there, `viewport` already there)
- `src/App.tsx`, `src/theme/muiTheme.ts`, `src/index.css` — read-only reference
- `src/components/layout/AppHeader.tsx` — minor: show project name when on editor

## Data / contracts

Client-only `localStorage`, no server. **Lock now (load-bearing for features 4–6):**

- `Project { id, name, rootNodeId, createdAt, updatedAt, viewport:{x:number,y:number,zoom:number} }` — `viewport` clamped `zoom [0.25,3]`, bumped on pan/zoom end via `setViewport`.
- `Node { id, projectId, parentId:string|null, text:string, collapsed:boolean, createdAt, updatedAt }` — strict tree, single parent, `collapsed` hides subtree in layout (hiddenIds).
- Layout contract: `computeLayout(nodes, rootId) → {positions, edges, bounds, hiddenIds}` — `positions` keyed by visible `Node.id`, `edges` only for visible parent→child, `bounds` encloses visible nodes by `NODE_DIAMETER/2` padding. Deterministic given same `nodes` order; insertion order = sibling order. No positions stored.
- Storage keys: `mindmap:projects` + `mindmap:nodes` (locked feature 2) — viewport lives inside `Project` JSON, no new key. Corruption fallback already in `storage.ts:88` — canvas shows fallback UI, not crash.
- Route: `/#/project/:projectId` (`App.tsx:16`) — `projectId` is `Project.id` uuid; unknown id → not-found.
- Constants: `NODE_DIAMETER = 88` (or 80–96, pick one and document in `layout.ts` header), `GAP_X ≈ 32`, `GAP_Y ≈ 72` (tuned so circles + lines don't collide, sibling subtrees separated). Document chosen values in file header.
- Zoom: `[MIN_ZOOM=0.25, MAX_ZOOM=3]`, default `1`, persisted per project.

## Testing

No `test` / `Verify` / `Browser tests` command in `AGENTS.md:192` — gate is `npm run build` + `npm run lint` + browser evidence, per `coding-standards.md:100` opt-in. Do not install a runner mid-feature; `/tests` owns that.

- **In-scope pure logic for future Vitest (when runner exists):** `computeLayout` (single node centered, two children symmetric, chain y-increasing, collapsed hides subtree + reflow, insertion order stable, 100-node no-overlap, cycle/missing-parent graceful), `getViewport`/`setViewport` (default migration, clamp, `updatedAt` bump, quota error), `fit` math (scale clamp, center formula). Keep these pure/no-JSX so `*.test.ts` can be added without refactor.
- **Verification per step is the done-when above, observed via:**
  - `npm run build` + `npm run lint` after every step (zero errors)
  - `npm run dev` at `http://localhost:5173/#/project/:projectId` visual checks: centered root, lines, text clamp, pan/drag, wheel/pinch zoom, re-center fit
  - `localStorage` inspection (`Application > Local Storage` → `mindmap:projects` viewport) after pan/zoom + reload
  - Edge checks: unknown id → not-found, single node centered, corrupted storage → fallback UI, zoom clamps, touch drag/pinch without page scroll

## Notes for the AI

- **Client-only:** Vite SPA, `localStorage` only. Use `crypto.randomUUID()` fallback from `storage.ts:77`. Respect React Compiler — no manual `useMemo`/`useCallback` unless measured.
- **Standards:** Functional components, strict TS, no `any`, PascalCase, `src/components/[feature]/ComponentName.tsx` per `coding-standards.md:32`. MUI for chrome buttons only; canvas itself is plain SVG+div. Comments only for why (e.g. zoom center math, collapse hiding).
- **Layout choice:** layered tidy-tree (depth→y, subtree centering) over radial for MVP readability (radial reserved for later polish). If `use-gesture` not installed, write custom `pointerdown/move/up` + `wheel` + `touch` handlers; do not add heavy `d3`/`react-flow`.
- **Performance:** layout is `O(n)` and runs on `nodes` change; do not run on every pan frame. Persist viewport only on gesture end (debounced). Keep handlers <50 lines.
- **Scope discipline:** do not build plus buttons/inline edit (feature 4), context menu/collapse UI (feature 5), or PNG export (feature 6) — even as stub. Re-center button is the only chrome in this feature.
- **Edge cases:** duplicate names already validated (feature 2); root delete blocked; add child to collapsed parent auto-expands is feature 5 behavior — for now layout simply hides collapsed subtree. Storage quota/full and `localStorage` unavailable reuse patterns from `storage.ts:16`.

## Findings

### 3/F-03 [P3] closed - Duplicate clampZoom and unused viewport helper

**File:** src/components/canvas/TreeCanvas.tsx:9, src/lib/storage.ts:244, src/lib/storage.ts:283
**Found:** 2026-09-03 by /audit (scope: current; lens: quality)
**Why it matters:** `TreeCanvas.tsx:9` re-defines `clampZoom` with `MIN_ZOOM/MAX_ZOOM` already defined in `storage.ts:244`. `storage.ts:283` exports `updateProjectViewport` which no caller uses (grep shows 0 imports). Duplication risks divergent zoom bounds and adds dead API surface that the next feature must reconcile.
**Suggested fix:** Export `clampZoom` from `storage.ts` and import it in `TreeCanvas.tsx`; remove or wire `updateProjectViewport` (or delete if `setViewport` is the single contract) and update `current-feature.md` Data/contracts.
**Resolution:** Fixed 2026-09-03 — exported `clampZoom` from `storage.ts:244` and imported in `TreeCanvas.tsx:5`, removed `updateProjectViewport` export. Verified `npm run build` + `npm run lint` pass, `grep -rn updateProjectViewport` 0 hits.
Closed 2026-09-03 by /audit (scope: current; lens: quality) — re-examined `storage.ts:244` shows single exported `clampZoom`, `TreeCanvas.tsx:5` imports it, no local duplicate, `updateProjectViewport` absent, build/lint pass, no new defect.

### 3/F-04 [P3] closed - Untracked debug harnesses left in repo root

**File:** check.mjs:1, empty_check.mjs:1
**Found:** 2026-09-03 by /audit (scope: current; lens: quality)
**Why it matters:** `check.mjs` and `empty_check.mjs` are untracked Playwright harnesses from manual verification (`git status` shows `??`). They are not `.gitignore`'d and will be considered by `current` audits, confuse `changed` scope, and risk accidental commit of local `127.0.0.1:5181` hardcodes.
**Suggested fix:** Delete the files or move to `scripts/` and `.gitignore` them; keep the `playwright` devDependency as requested but document the browser check command in `AGENTS.md` if it should be repeatable (`/browser-tests`).
**Resolution:** Fixed 2026-09-03 — deleted `check.mjs` and `empty_check.mjs` from repo root, verified `git status --short` shows no `??` harnesses, kept `playwright@1.62.1` as requested.
Closed 2026-09-03 by /audit (scope: current; lens: quality) — `git status --short` shows no `??`, `ls check.mjs` fails, `package.json:34` retains `playwright`, no new defect.

### 3/F-05 [P2] closed - TreeCanvas timers not cleaned up on unmount

**File:** src/components/canvas/TreeCanvas.tsx:31, src/components/canvas/TreeCanvas.tsx:63
**Found:** 2026-09-03 by /audit (scope: current; lens: performance)
**Why it matters:** `wheelTimer` (`setTimeout 300ms` in `handleWheel:102`) and `window.setTimeout(() => setAnimate(false), 260)` in `handleRecenter:63` are never cleared in a cleanup effect. Unmounting mid-gesture (route change from `/#/project/:id` to `/`) can fire `setViewportState`/`setAnimate` on an unmounted component and leak the storage bump via `setViewport`.
**Suggested fix:** Store timeout ids in refs and clear them in `useEffect` cleanup; or use `useRef` for animate timer and clear on unmount.
**Resolution:** Fixed 2026-09-03 — added `animateTimer` ref in `TreeCanvas.tsx:32` and cleanup `useEffect` at `TreeCanvas.tsx:33` clearing both `wheelTimer` and `animateTimer` on unmount, stored `handleRecenter` timeouts in `animateTimer`. Verified `npm run lint` pass (no `set-state-in-effect` warning) and `npm run build` pass.
Closed 2026-09-03 by /audit (scope: current; lens: performance) — `TreeCanvas.tsx:27-34` shows `animateTimer` + cleanup effect, `grep` shows 0 duplicate `clampZoom`, build/lint pass, no new defect.
