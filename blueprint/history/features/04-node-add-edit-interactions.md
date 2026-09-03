# Feature: 4 - Node add & edit interactions

**From build-plan:** feature 4
**Status:** verified

## Goal

Let users grow and label the tree directly on the canvas: add a child to any node via discoverable plus buttons and edit any node's text inline with enforced limits, so a 10-15 node map can be built in minutes on phone or laptop without leaving the Editor. Placement is directional: the clicked plus button (N/E/S/W) decides which side of the parent the new child grows toward, and the canvas lays the tree out radially around the centered root.

## Design reference

No `prototypes/` directory and no `blueprint/reference/` image exists. This is new UI anchored to shipped tokens, not a pixel replication, so prose is sufficient:

- `src/components/canvas/TreeCanvas.css:32` - `.node-circle` fixed circle, `var(--node-fill)` / `var(--node-stroke)`, text clamp 3 lines.
- `src/index.css` - `--accent`, `--surface`, `--border`, `--shadow-sm`, `--radius-full` for plus buttons and editor.
- `src/components/canvas/NodeCircle.tsx:11` - current stateless circle to extend.
- `src/pages/EditorPage.tsx:9` - current loader to make reactive.
- `blueprint/context/project-overview.md:80` - plus buttons (hover desktop / tap mobile, 44px targets), inline editor with counter.

If a visual reference appears later, store it in `blueprint/reference/` and link it here.

## In scope

- **Storage ops (pure, client-only):** `addChildNode(projectId, parentId, text)` and `updateNodeText(nodeId, text)` in `src/lib/storage.ts` (or `src/lib/nodes.ts` if preferred). Trim, validate non-empty and max length, throw typed `Error` with message. Bump `Node.updatedAt` + parent `Project.updatedAt` (newest-first sort). New child: `id` via `crypto.randomUUID()` fallback, `collapsed: false`, appended in insertion order (sibling order = insertion order, no `order` field).
- **Reactive Editor state:** `EditorPage` holds `Node[]` in `useState` (seeded from `loadNodes`), recomputes `computeLayout` on change, persists via storage ops then sets state. Fixes current render-once `loadNodes()` so add/edit re-renders and reflows layout without reload.
- **Plus-button affordance:** multiple (4: N/E/S/W or top/right/bottom/left ring) plus buttons per node, all triggering the same add-child action. Desktop: hidden until node hover/focus-within, shown via CSS. Touch: shown when node is selected (tap selects). Hit area at least 44px (small visual + transparent padding). `stopPropagation` so clicks do not start canvas pan. Keyboard reachable (`aria-label="Add child to <text>"`, focusable, Enter/Space activates).
- **Add flow:** clicking a plus button creates the child on that button's side, reflows layout, selects the new child, and auto-focuses its inline editor with text selected. Adding to a `collapsed` parent auto-expands it (`collapsed=false`) so the new child is visible (no collapse toggle UI in this feature).
- **Directional radial layout (replaces the top-down layered layout from feature 3):** the root stays centered and branches grow toward N/E/S/W around it. Each non-root node stores the side it hangs off its parent (`Node.side`); the clicked button sets the new child's side. Siblings on the same side fan out across that side's quadrant, weighted by subtree leaf count so subtrees do not overlap. Legacy nodes without a side (created before this feature) default to `south` and re-layout radially on open. Pan/zoom/re-center math from feature 3 is bounds-based and carries over unchanged.
- **Inline editor:** overlay input (or `textarea`) centered in the circle, replacing static text while editing. Auto-focus + select-all on open. Live char counter (`<n>/<max>`). Commit on `Enter` (no modifier) or blur; cancel on `Escape`. Trim on commit; empty commit reverts to prior text (new node reverts to its default rather than persisting empty). Enforce max length by blocking over-limit input/paste (truncate + counter), never persisting over-limit text. Entry points: double-click/double-tap node to edit, plus auto-open after add (single click only selects; `Edit` context-menu entry stays deferred to feature 5).
- **Click-vs-drag disambiguation:** node tap/click must not fire after a canvas drag (movement threshold, e.g. >4px = drag). Long-press stays reserved for feature 5; this feature must not break drag/pan or trigger edit while panning.
- **Error/edge states:** quota/`SecurityError` surfaces via existing storage throw path (editor shows inline error, does not lose typed text); unknown `projectId` and empty-map fallbacks from feature 3 keep working; single-node map add works; rapid sequential adds work.

## Out of scope

- Context menu (right-click/long-press Edit/Delete/Collapse-Expand), subtree delete with count confirm, collapsed badge/chevron UI, persisted collapse toggle beyond auto-expand on add - feature 5.
- PNG export - feature 6.
- GitHub Pages config, SPA fallback, timestamps display, zoom indicator, storage-full banner polish - feature 7.
- Rectangle/media nodes, variable sizes, gradients - post-MVP.
- Undo/redo, duplicate/search, cloud sync, present/dark modes - post-MVP.
- Test runner / Verify / browser harness setup - separate `/tests`, `/ci`, `/browser-tests` (none configured per `AGENTS.md` Commands).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks
these off as it finishes them, so progress survives a context clear: a fresh
session reads which boxes are ticked and resumes from the first unchecked step.

- [x] **Step 1 - Node storage ops + text contract** - add `MAX_NODE_TEXT_LENGTH` constant (60), `validateNodeTextPure(text): string | null`, `addChildNode(projectId, parentId, text): Node`, and `updateNodeText(nodeId, text): Node` (trim, reject empty/over-limit with messages `"Text is required."` / `"Text must be 60 characters or less."`, bump `Node.updatedAt` + `Project.updatedAt` with strictly-increasing ISO, keep pure validators importable for future tests). No UI. *Done when:* `npm run build` + `npm run lint` pass; manual import smoke: `addChildNode` appends child with `parentId` set and insertion order preserved, empty text throws, 61-char text throws, `updateNodeText` trims and bumps both timestamps, adding to collapsed parent is allowed at storage level (UI auto-expands in Step 3).
- [x] **Step 2 - Reactive Editor state (no new UI yet)** - lift `EditorPage` nodes into `useState` (seed from `loadNodes` filtered by `projectId`), recompute `computeLayout` from state, add `handleAddChild(parentId): Node` and `handleUpdateText(nodeId, text)` wrappers that call storage ops, set state, and surface storage errors inline without crashing. No plus buttons or editor yet. *Done when:* `npm run build` + `npm run lint` pass; `npm run dev` at `/#/project/<id>` renders identical tree to before, hard reload preserves nodes, switching projects shows each project's nodes, corrupted/unknown-id fallbacks unchanged. Verified by temporarily calling handlers from devtools or a hidden test button removed before commit (or by Step 3 wiring).
- [x] **Step 3 - Plus buttons + add flow** - extend `NodeCircle` (or new `NodeWithActions`) with 4 plus buttons (N/E/S/W ring, 44px hit areas, `aria-label="Add child to ..."`, visible on `:hover`/`:focus-within` for mouse and when `selected` for touch), wire to `handleAddChild`, `stopPropagation` on pointer/mouse down, click-vs-drag threshold so pan does not create nodes, tap selects node on touch, new child auto-expands collapsed parent, selects new node and requests edit mode. *Done when:* on desktop hovering a circle shows plus buttons and clicking one adds a child circle connected by a line with layout reflow; on touch (or mobile emulation) tapping a node reveals plus buttons and tapping plus adds a child; dragging the canvas from a node does not create a child; new child enters edit mode focused (Step 4 editor may be stubbed as `prompt`-free focused state, but selection + focus request must be observable); `npm run build` + `npm run lint` pass.
- [x] **Step 4 - Inline editor with limit enforcement** - add inline editor overlay in the circle (input, centered, circle-clipped, char counter `n/60`, `aria-label="Edit node text"`), auto-focus + select-all on open, double-click/double-tap opens editor on existing nodes, `Enter` commits, `Escape` cancels to prior text, blur commits trimmed text, empty commit reverts (new default-text node keeps default), over-limit typing/paste blocked with counter at max, quota error keeps editor open with message. *Done when:* double-clicking a node opens a focused editor with text selected and counter visible; typing updates counter and blocks past 60 chars; `Enter`/blur persists trimmed text and reflows, `Escape`/empty reverts, new node from Step 3 opens already focused and `Escape` leaves default text intact; reload persists edits; long text wraps/clamps as before with tooltip; `npm run build` + `npm run lint` pass at 375px width with on-screen keyboard space (editor not clipped off-canvas for centered nodes).
- [x] **Step 5 - Node side contract + storage** - add `NodeSide = "north" | "east" | "south" | "west"` in `src/types/node.ts` and `Node.side: NodeSide | null` (`null` for the root and for legacy nodes). Extend `addChildNode(projectId, parentId, text, side: NodeSide)` to persist the side, throwing on any other value. Legacy nodes are never rewritten; the layout treats a non-root missing or unknown side as `south`. No UI. *Done when:* `npm run build` + `npm run lint` pass; smoke: a new child persists the clicked side, an invalid side throws, a legacy node without `side` still loads.
- [x] **Step 6 - Radial layout engine (replaces layered placement)** - rewrite the placement pass in `src/lib/layout.ts` as a radial tidy tree, keeping the exported contract (`computeLayout(nodes, rootId, opts)` returning `positions`, `edges`, `bounds`, `hiddenIds`), the collapsed-subtree hiding, and the cycle/missing-parent guards untouched. Root centers at `(0,0)`; each child sits one radial step (`NODE_DIAMETER + GAP_Y`) from its parent along an angle inside its side's quadrant (east 0deg, south 90deg, west 180deg, north 270deg in screen coords, y down); siblings sharing a side fan out across the quadrant weighted by visible leaf count. Edges stay straight parent-to-child lines; bounds keep radius padding. *Done when:* `npm run build` + `npm run lint` pass; smoke: single node at `(0,0)`; one child per side lands in the correct quadrant (east child `x > 0`, north child `y < 0`, and so on); two same-side children separate without overlap (center distance at least `NODE_DIAMETER`); collapsed subtree still hidden with reflow; a 100-node tree has no overlaps; cycle input does not throw.
- [x] **Step 7 - Directional wiring + re-verification** - thread the side from button to storage: `NodeCircle.onAddChild(parentId, side)`, `TreeCanvas.handlePlus` passes the clicked button's side and keeps select plus edit-focus, `EditorPage.handleAddChild(parentId, text, side)` persists it. Then re-prove the feature 3 canvas behaviors against the radial layout: pan/drag, wheel/pinch zoom with clamps, Re-center fits the whole radial tree, reload restores viewport and nodes, unknown-id and empty-map fallbacks intact. *Done when:* clicking each of the 4 plus buttons grows a child on that side of the parent with layout reflow and auto-focused editor; a legacy map (nodes without sides) opens laid out radially with children defaulting south; pan/zoom/re-center behave as in feature 3; `npm run build` + `npm run lint` pass; desktop plus 375px screenshots show the radial tree with edges attached and no clipped editor.
- [x] **Step 8 - Repair: node-click commits in-progress edit** - `/check` found that clicking another node while editing leaves the draft uncommitted (spec status `verification failed`). Blurs `document.activeElement` in `TreeCanvas.handleSelect`/`handleEditStart` when an edit is open on a different node, so the existing `onBlur → commit` path runs before selection changes. Background drag/pan still preserves the open editor. Proven by 7 browser assertions, zero errors.
- [x] **Repair F-09 - require addChildNode side** - drop the `"south"` default so `side: NodeSide` is required; fix any caller relying on the default. *Done when:* `npm run build` + `npm run lint` pass; smoke: omitted side is a compile error, explicit sides persist, invalid side still throws.
- [x] **Repair F-07 - reuse bumpedIso in setViewport** - replace the inline strictly-increasing bump with the shared helper. *Done when:* `npm run build` + `npm run lint` pass; pan/zoom persists viewport with strictly-increasing `updatedAt` as before.
- [x] **Repair F-08 - derive plus buttons from NODE_SIDES** - replace the `PLUS_POSITIONS` literal with the contract constant. *Done when:* `npm run build` + `npm run lint` pass; 4 plus buttons still render and add directionally.
- [x] **Repair F-10 - restore focus to circle after edit closes** - focus the edited circle when commit/cancel clears `editingId` (skip the quota-failure path where the editor stays open). *Done when:* `Escape`/`Enter` leaves focus on the circle; browser check confirms `document.activeElement`; `npm run build` + `npm run lint` pass.

## Files / areas

- `src/lib/storage.ts` - add `MAX_NODE_TEXT_LENGTH`, `validateNodeTextPure`, `addChildNode`, `updateNodeText` (extend corruption/quota patterns already there)
- `src/pages/EditorPage.tsx` - reactive `Node[]` state, `handleAddChild` / `handleUpdateText`, error surface, pass callbacks + `selectedId` / `editingId` down
- `src/components/canvas/TreeCanvas.tsx` - selection state, plus-button positioning layer, click-vs-drag threshold, pass-through add/edit callbacks, auto-expand on add
- `src/components/canvas/NodeCircle.tsx` - plus buttons + inline editor UI (or split: `NodePlusButtons.tsx`, `NodeEditor.tsx` if file exceeds ~50-line helpers)
- `src/components/canvas/TreeCanvas.css` - plus-button ring, hover vs selected visibility, 44px targets, editor overlay + counter styles (reuse `--accent`, `--surface`, `--border`)
- `src/types/node.ts`, `src/types/project.ts` - read-only (no shape change)
- `src/lib/layout.ts` - read-only (reflow is automatic on nodes change)
- `src/components/layout/AppHeader.tsx`, `src/theme/muiTheme.ts` - read-only reference

## Data / contracts

Client-only `localStorage`, no server. Locked here (load-bearing for features 5-6):

- `MAX_NODE_TEXT_LENGTH = 60` - single source in storage lib; display clamps as before (`line-clamp` 3 + `title` tooltip when `>40` chars stays).
- `Node.text` - trimmed, non-empty, max 60; empty edit reverts, over-limit input blocked (never persisted).
- `Node.side: NodeSide | null` where `NodeSide = "north" | "east" | "south" | "west"` - the side of its parent the node grows toward; `null` for the root and for legacy nodes created before this feature. The layout treats a non-root missing or unknown side as `south`. Load-bearing for every future layout and export feature.
- `addChildNode(projectId, parentId, text, side: NodeSide)` - creates `{ id: uuid, projectId: parentId, text: trimmed, side, collapsed: false, createdAt/updatedAt: nowIso() }`, appends (insertion order breaks ties within a side), bumps `Project.updatedAt`, auto-expands parent at UI layer (`collapsed=false` on parent when adding to collapsed node).
- Layout contract: radial tidy tree replacing feature 3's layered placement. `computeLayout` keeps its signature and return shape; root at `(0,0)`; radial step `NODE_DIAMETER + GAP_Y`; side quadrants east 0deg / south 90deg / west 180deg / north 270deg (screen coords, y down); same-side siblings fan out by visible leaf-count weight. Edges only for visible parent-child pairs; bounds enclose visible nodes with radius padding. Deterministic given same nodes and sides.
- `updateNodeText(nodeId, text)` - trims, validates, sets `Node.text` + `Node.updatedAt`, bumps `Project.updatedAt`; empty throws/reverts at caller (editor reverts, never writes empty).
- New-child default text: `"New idea"` - created then immediately edited with select-all; cancel/empty keeps default (never persists `""`).
- Storage keys unchanged (`mindmap:projects` + `mindmap:nodes`); viewport handling from feature 3 unchanged; quota throw path reused.

## Testing

No `test` / `Verify` / `Browser tests` command in `AGENTS.md` Commands - gate is `npm run build` + `npm run lint` + browser evidence, per `coding-standards.md` opt-in switch. Do not install a runner mid-feature; `/tests` owns that.

- **In-scope pure logic for future Vitest (when runner exists):** `validateNodeTextPure` (empty, whitespace-only, 60 ok / 61 rejected, trim), `addChildNode` (parent linkage, side persisted, invalid side throws, insertion order, collapsed parent allowed at storage level, timestamps bump), `updateNodeText` (trim, empty throws, over-limit throws, `Project.updatedAt` strictly increases), `computeLayout` radial (single node at origin, one child per side in the correct quadrant, same-side fan-out without overlap, collapsed hides subtree, legacy missing side defaults south, cycle/missing-parent graceful). Keep pure/JSX-free so `*.test.ts` needs no refactor.
- **Verification per step is the done-when above, observed via:**
  - `npm run build` + `npm run lint` after every step (zero errors)
  - `npm run dev` at `http://localhost:5173/#/project/:projectId`: hover shows plus buttons, click adds + focuses editor, tap on touch shows buttons, double-click edits, counter enforces 60, `Enter`/blur commits, `Escape`/empty reverts, reload persists, layout reflows with edges attached
  - `localStorage` inspection (`mindmap:nodes`) after add/edit + reload
  - Edge checks: drag-from-node does not create, quota error keeps editor open, unknown id / empty map fallbacks intact, 375px width editor usable

## Notes for the AI

- **Client-only Vite SPA:** `crypto.randomUUID()` with fallback already in `storage.ts:81`; no server, no auth. Respect React Compiler - no manual `useMemo`/`useCallback` unless measured.
- **Standards:** functional components, strict TS, no `any`, PascalCase, `src/components/[feature]/ComponentName.tsx` per `coding-standards.md`. Keep helpers under ~50 lines. Comments only for why (drag threshold, focus timing, auto-expand rationale). No em dashes in code, comments, or commit messages.
- **Event discipline:** plus buttons and editor must `stopPropagation` on `pointerdown`/`mousedown`/`touchstart` so canvas pan/zoom handlers in `TreeCanvas.tsx:112` never fire; use a movement threshold to separate click from drag; do not `preventDefault` the canvas `contextmenu` suppression at `TreeCanvas.tsx:220` (feature 5 needs it).
- **Focus timing:** request editor focus after layout commit (e.g. `requestAnimationFrame` or `useEffect` on `editingId`), select-all on open for fast overwrite; keep editor inside the transformed world layer so it pans/zooms with the node.
- **Scope discipline:** do not build context menu, delete, collapse chevron/badge UI (beyond auto-expand on add), PNG export, or zoom indicator - even as stubs. Single click selects only; edit opens via double-click or post-add.

## Findings

### 4/F-07 [P3] closed - setViewport duplicates the strictly-increasing timestamp bump

**File:** src/lib/storage.ts:368
**Found:** 2026-09-03 by /audit (scope: current; lens: quality)
**Why it matters:** `bumpedIso` at `src/lib/storage.ts:255` (added by this feature) implements the strictly-increasing `updatedAt` bump used by `addChildNode`, `updateNodeText`, and `setNodeCollapsed`, but the older `setViewport` still inlines the same `Date.parse` + 1ms logic. Two copies of a subtle ordering invariant will drift the next time one of them is fixed.
**Suggested fix:** Replace the inline block in `setViewport` with `bumpedIso(projects[idx].updatedAt)`. No behavior change; existing viewport persistence smoke still passes.
**Resolution:** Fixed 2026-09-03 by /implement - `setViewport` now calls `bumpedIso`; smoke confirms persist + clamp + strictly-increasing `updatedAt`. `npm run build` + `npm run lint` pass. Closed 2026-09-03 by /audit (scope: current; lens: quality) - re-examined `storage.ts:363` shows the single shared call, sole duplication removed, build/lint pass, no new defect.

### 4/F-08 [P3] closed - Plus-button sides duplicate the NodeSide contract

**File:** src/components/canvas/NodeCircle.tsx:27
**Found:** 2026-09-03 by /audit (scope: current; lens: quality)
**Why it matters:** `PLUS_POSITIONS` re-lists the four sides already defined as `NODE_SIDES` in `src/types/node.ts:1`. If a side is ever renamed or added, the buttons and the storage guard (`isNodeSide`) diverge silently.
**Suggested fix:** Derive the buttons from the contract (`const PLUS_POSITIONS: readonly NodeSide[] = NODE_SIDES;`). The `node-plus--${pos}` classes already match the side names, so CSS is unaffected.
**Resolution:** Fixed 2026-09-03 by /implement - buttons derive from `NODE_SIDES`; browser check shows 4 buttons and a west add persisting `side: "west"`. `npm run build` + `npm run lint` pass. Closed 2026-09-03 by /audit (scope: current; lens: quality) - re-examined `NodeCircle.tsx:25` shows the derived constant with identical values and order, class names unchanged, no new defect.

### 4/F-09 [P3] closed - addChildNode side default weakens the directional contract

**File:** src/lib/storage.ts:261
**Found:** 2026-09-03 by /audit (scope: current; lens: quality)
**Why it matters:** The spec locks `addChildNode(projectId, parentId, text, side)` with a required side, but the implementation defaults a missing side to `"south"`. A future caller that forgets the side silently misplaces the child instead of failing fast. Every current caller passes the side explicitly, so the default only masks mistakes.
**Suggested fix:** Make `side: NodeSide` required and fix any caller that relied on the default. Keep the `"Invalid side."` throw for runtime values crossing the storage boundary.
**Resolution:** Fixed 2026-09-03 by /implement - dropped the `= "south"` default; sole caller `EditorPage.tsx:54` already passes `side`. `npm run build` + `npm run lint` pass. Closed 2026-09-03 by /audit (scope: current; lens: quality) - re-examined `storage.ts:263` shows the required parameter, repo-wide grep confirms the single caller passes it, build proves no stale callers, no new defect.

### 4/F-10 [P3] closed - Focus drops to body when the inline editor closes

**File:** src/components/canvas/TreeCanvas.tsx:242
**Found:** 2026-09-03 by /audit (scope: current; lens: quality)
**Why it matters:** Committing with `Enter` or cancelling with `Escape` unmounts the editor input while it holds focus, so focus falls back to `document.body` and keyboard users must tab back into the canvas for every node they label. Full keyboard nav is post-MVP, but this is a one-line focus restoration inside the committed feature.
**Suggested fix:** After clearing `editingId` in `handleCommitText`/`handleCancelEdit`, move focus to the edited circle (e.g. query `[data-node-id="${nodeId}"] .node-circle` and call `.focus()`), guarded for the quota-failure path where the editor stays open.
**Resolution:** Fixed 2026-09-03 by /implement - `focusCircle` helper called on commit/cancel/select, skipped on quota failure; browser check shows `activeElement` on the circle after `Escape`/`Enter` and immediate re-edit via keyboard. `npm run build` + `npm run lint` pass. Closed 2026-09-03 by /audit (scope: current; lens: quality) - re-examined `TreeCanvas.tsx:213-270`: blur-before-switch preserved, quota path unfocused, interpolated id comes from internally generated uuids, programmatic focus causes no scroll in this fullscreen canvas, no new defect.
