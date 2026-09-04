# Feature: 5 - Context menu & branch controls

**From build-plan:** feature 5
**Status:** verified

## Goal

Let users manage branches directly on the canvas: right-click (desktop) or long-press (touch) any node for Edit / Delete / Collapse-Expand, delete a whole subtree with a count confirm, and collapse branches to focus with a persisted badge indicator and layout reflow. Covers the core branch-management loop for 10-15 node maps without leaving the Editor.

## Design reference

No `prototypes/` directory and no `blueprint/reference/` image exists. This is new UI anchored to shipped tokens, not a pixel replication, so prose is sufficient:

- `src/pages/HomePage.tsx:255` - MUI `Menu` + `Dialog` pattern to reuse (overflow menu, delete confirm with count).
- `src/components/canvas/TreeCanvas.css:32` - `.node-circle` fixed circle, `var(--node-fill)` / `var(--node-stroke)`; badge must sit on this circle without breaking the clamp.
- `src/index.css` - `--accent`, `--surface`, `--border`, `--shadow-sm`, `--radius-full` for menu, badge, dialog.
- `src/components/canvas/TreeCanvas.tsx:285` - canvas already suppresses the browser `contextmenu` globally; node-level handler reuses that suppression.
- `blueprint/context/project-overview.md:81` - context menu (right-click / long-press ~500ms), collapsed badge/chevron.

If a visual reference appears later, store it in `blueprint/reference/` and link it here.

## In scope

- **Storage ops (pure, client-only):** `deleteNodeSubtree(nodeId)` in `src/lib/storage.ts` - deletes the node plus all descendants atomically, bumps parent `Project.updatedAt` (strictly-increasing via existing `bumpedIso`), throws `"Node not found."` for unknown id and `"Cannot delete the root node."` for the root. Pure helpers `getSubtreeIdsPure(nodes, nodeId): string[]` / `countSubtreeNodesPure(nodes, nodeId): number` (count includes the node itself) kept JSX-free for future Vitest.
- **Context menu trigger:** right-click (`onContextMenu`) on a node opens the menu at the cursor on desktop; long-press (~500ms, single touch, movement beyond ~10px cancels) opens the same menu at the touch point on mobile. Two-finger pinch and canvas drag never open the menu. Browser context menu stays suppressed on nodes. Menu closes on item select, `Escape`, outside click, or canvas pan/zoom start.
- **Menu items (MUI `Menu`, reusing the HomePage pattern):** `Edit` (opens the existing inline editor with select-all), `Collapse` / `Expand` (toggles via existing `setNodeCollapsed`, label follows current state, disabled with reason when the node has no children), `Delete` (destructive styling). Menu is positioned at the cursor/touch point (`anchorReference="anchorPosition"`), `aria-label`s per action, keyboard navigable via MUI defaults.
- **Subtree delete confirm (MUI `Dialog`, reusing the HomePage pattern):** shows `"Delete "<text>"? This will remove N node(s). This cannot be undone."` where N comes from the pure count helper (includes hidden descendants of a collapsed node). Confirm deletes atomically, clears selection/editor if the deleted subtree contained them, reflows layout. Cancel leaves everything untouched. Root node has no `Delete` item (project delete stays on Home).
- **Collapsed badge + reflow:** collapsed node with at least one descendant shows a small count badge (e.g. `+N`, N = hidden descendants) anchored to the circle edge in shipped tokens; expanding/collapsing persists via `setNodeCollapsed` and reflows through the existing `computeLayout` hidden-subtree path (`positions`/`edges`/`bounds` already exclude hidden ids). Adding a child to a collapsed parent still auto-expands (feature 4 behavior, unchanged).
- **Touch/mouse conflict hardening:** long-press timer cancelled on move/end/pinch/second finger; node tap/click threshold from feature 4 unchanged; plus buttons and editor keep `stopPropagation` so the menu never opens from plus/editor interactions.

## Out of scope

- PNG export - feature 6.
- Deploy config, SPA fallback, timestamps display, zoom % indicator, storage-full banner polish - feature 7.
- Undo/redo for delete (confirm dialog is the safety; undo is post-MVP item 10).
- Multi-select, bulk collapse, drag-to-move nodes, rectangle/media nodes - post-MVP.
- Full keyboard nav / screen-reader tree semantics (beyond menu keyboard defaults + focus return) - post-MVP item 13.
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

- [x] **Step 1 - Subtree delete + count storage ops** - add `getSubtreeIdsPure(nodes, nodeId)`, `countSubtreeNodesPure(nodes, nodeId)`, and `deleteNodeSubtree(nodeId)` to `src/lib/storage.ts` (atomic subtree removal, root throws `"Cannot delete the root node."`, unknown id throws `"Node not found."`, `Project.updatedAt` bumped via `bumpedIso`, reuse corruption/quota patterns). No UI. *Done when:* `npm run build` + `npm run lint` pass; smoke via devtools import: deleting a mid-tree node removes exactly its subtree, count helper returns N including hidden descendants, deleting root throws, unknown id throws, reload persists the deletion.
- [x] **Step 2 - Context menu shell with Edit + Collapse/Expand** - add node-level `onContextMenu` (desktop, cursor-anchored MUI `Menu`) and long-press (~500ms, touch-point anchored, move/pinch-cancels) trigger in `NodeCircle`/`TreeCanvas`, with `Edit` (opens existing editor) and `Collapse`/`Expand` (via `setNodeCollapsed` through a new `EditorPage` handler, label follows state, disabled when leaf) wired; no `Delete` item yet. Menu closes on select/`Escape`/outside/pan-start. *Done when:* right-clicking a node opens a positioned menu with working Edit + Collapse/Expand and layout reflow; long-press (~500ms, no move) opens the same menu on touch emulation; drag/pinch/plus/editor never open it; collapsed state survives reload; `npm run build` + `npm run lint` pass.
- [x] **Step 3 - Subtree delete with count confirm** - add the `Delete` menu item (destructive styling, hidden on root) plus MUI confirm `Dialog` (`"Delete "<text>"? This will remove N node(s). This cannot be undone."`, N from the count helper), wired through a new `EditorPage.handleDeleteSubtree` to `deleteNodeSubtree`; confirm clears selection/editor inside the deleted subtree and reflows, cancel is a no-op. *Done when:* deleting a branch shows the exact descendant count (collapsed descendants included), confirm removes the whole subtree with reflow and persists after reload, cancel changes nothing, root has no Delete path, deleting the editing/selected node closes the editor cleanly; `npm run build` + `npm run lint` pass.
- [x] **Step 4 - Collapsed badge + conflict/edge polish** - add the `+N` hidden-descendant badge on collapsed non-leaf nodes (shipped tokens, no layout break, `aria-label` e.g. `"Collapsed, N hidden nodes"`), focus returns to the circle after menu close, menu never opens from plus buttons/editor/drag, viewport persists across collapse/delete, empty-map and unknown-id fallbacks intact. *Done when:* collapsing shows `+N` with correct N, expanding removes it, badge survives reload, menu interactions keep focus in the canvas flow, drag-from-node still pans without opening the menu, `npm run build` + `npm run lint` pass at desktop + 375px widths.

## Files / areas

- `src/lib/storage.ts` - add `getSubtreeIdsPure`, `countSubtreeNodesPure`, `deleteNodeSubtree` (extend existing corruption/quota/`bumpedIso` patterns)
- `src/pages/EditorPage.tsx` - add `handleToggleCollapsed(nodeId)` + `handleDeleteSubtree(nodeId)` handlers, error surface, pass callbacks down
- `src/components/canvas/TreeCanvas.tsx` - menu open state (anchor position + target id), pan/zoom-dismiss wiring, pass-through collapse/delete/edit callbacks
- `src/components/canvas/NodeCircle.tsx` - node-level `onContextMenu` + long-press trigger, badge render (or split: `NodeContextMenu.tsx`, `NodeBadge.tsx` if helpers exceed ~50 lines)
- `src/components/canvas/TreeCanvas.css` - badge style, menu anchor fixes if needed (MUI `Menu`/`Dialog` carry their own theme)
- `src/lib/layout.ts`, `src/types/node.ts`, `src/components/canvas/NodeEditor.tsx` - read-only reference (`collapsed` hiding + reflow already implemented)
- `src/components/layout/AppHeader.tsx`, `src/theme/muiTheme.ts` - read-only reference

## Data / contracts

Client-only `localStorage`, no server. Locked or reused here (load-bearing for features 6-7):

- `Node.collapsed` (existing) - `true` hides the entire subtree from `positions`/`edges`/`bounds` via `computeLayout`; only meaningful when the node has children (menu disables Collapse on leaves); toggled only through `setNodeCollapsed`, persisted, `Project.updatedAt` bumped.
- `getSubtreeIdsPure(nodes, nodeId): string[]` - new pure helper; ids of the node plus all descendants (including hidden ones under collapsed nodes); order parent-before-children; unknown id returns `[]`.
- `countSubtreeNodesPure(nodes, nodeId): number` - new pure helper; `getSubtreeIdsPure(...).length`; the N shown in the delete confirm and the collapsed badge.
- `deleteNodeSubtree(nodeId): { deletedIds: string[] }` (or returns count) - removes the node + descendants atomically in one `saveNodes` write, bumps `Project.updatedAt` via `bumpedIso`; throws `"Node not found."` / `"Cannot delete the root node."`; never leaves orphans.
- `MAX_NODE_TEXT_LENGTH = 60`, `Node.text`, `Node.side`, storage keys, viewport handling - unchanged from features 2-4.
- Badge text `+N` where N = hidden descendants (`count - 1`); exact delete-confirm copy: `"Delete "<text>"? This will remove N node(s). This cannot be undone."` (matches Home project-delete tone).

## Testing

No `test` / `Verify` / `Browser tests` command in `AGENTS.md` Commands - gate is `npm run build` + `npm run lint` + browser evidence, per `coding-standards.md` opt-in switch. Do not install a runner mid-feature; `/tests` owns that.

- **In-scope pure logic for future Vitest (when runner exists):** `getSubtreeIdsPure` (leaf returns self, mid-tree returns full subtree, collapsed descendants included, unknown id returns `[]`), `countSubtreeNodesPure` (matches ids length), `deleteNodeSubtree` (removes exactly the subtree, bumps `Project.updatedAt` strictly, root throws, unknown throws, single-write atomicity), collapse visibility via `computeLayout` (collapsed hides subtree ids in `hiddenIds`, expand restores, badge N equals hidden count). Keep pure/JSX-free so `*.test.ts` needs no refactor.
- **Verification per step is the done-when above, observed via:**
  - `npm run build` + `npm run lint` after every step (zero errors)
  - `npm run dev` at `http://localhost:5173/#/project/:projectId`: right-click opens menu at cursor, long-press opens it on touch emulation, Edit focuses editor, Collapse reflows + badges, Delete confirm shows N and removes subtree, reload persists collapse + deletion
  - `localStorage` inspection (`mindmap:nodes`) after collapse/delete + reload
  - Edge checks: root has no Delete, leaf Collapse disabled, drag/pinch never opens menu, deleting editing node closes editor, 375px width badge/menu usable

## Notes for the AI

- **Client-only Vite SPA:** no server, no auth. Respect React Compiler - no manual `useMemo`/`useCallback` unless measured.
- **Standards:** functional components, strict TS, no `any`, PascalCase, `src/components/[feature]/ComponentName.tsx` per `coding-standards.md`. Keep helpers under ~50 lines. Comments only for why (long-press timing, drag-vs-press threshold, root-delete guard). No em dashes in code, comments, or commit messages.
- **Reuse HomePage patterns:** MUI `Menu` (`anchorReference="anchorPosition"`) + `Dialog` confirm with count copy from `src/pages/HomePage.tsx:255,366`; check its `MenuItem`/`DialogActions` usage before writing new code so the two confirms stay consistent.
- **Event discipline:** node `onContextMenu` must `preventDefault` + `stopPropagation` (canvas suppresses globally, but the node claims the event); long-press uses a ~500ms timer set on single-touch start, cancelled on move (>10px), end, cancel, or second finger; plus buttons and editor keep existing `stopPropagation` so they never trigger the menu; close the menu when pan/zoom starts.
- **Focus discipline:** after menu close / delete cancel, return focus to the target circle (reuse the `focusCircle` pattern from feature 4); after delete confirm of the selected node, move focus to the parent circle or canvas.
- **Scope discipline:** do not build PNG export, zoom indicator, undo, multi-select, or drag-to-move - even as stubs. Single-node menu only.

## Findings

### 5/F-07 [P3] closed - Duplicate storage imports in TreeCanvas

**File:** src/components/canvas/TreeCanvas.tsx:5
**Found:** 2026-09-04 by /audit (scope: current; lens: quality)
**Why it matters:** `clampZoom`/`getViewport`/`setViewport` and `countSubtreeNodesPure` are imported from `../../lib/storage` in two separate statements. Duplicate imports from the same module diverge over time (one updated, the other missed) and trip `no-duplicate-imports` in stricter eslint configs.
**Suggested fix:** Merge into one import.
**Resolution:** Fixed 2026-09-04 - merged into one import line; build/lint pass. Closed 2026-09-04 by /audit re-examination.

### 5/F-08 [P3] closed - Badge hiddenCount rebuilds full subtree per render

**File:** src/components/canvas/TreeCanvas.tsx:424
**Found:** 2026-09-04 by /audit (scope: current; lens: performance)
**Why it matters:** `hiddenCount` for each visible node called `countSubtreeNodesPure`, rebuilding `childrenMap` per node (O(N*(N+E)) per render).
**Suggested fix:** Derive once via a `Map<id, count>` from a single traversal.
**Resolution:** Fixed 2026-09-04 - added `getSubtreeCountsPure(nodes)` in `src/lib/storage.ts` (single-visit memoized traversal with cross-project guard) and switched badge wiring to map lookup; build/lint pass, smoke confirms counts match. Closed 2026-09-04 by /audit re-examination.
