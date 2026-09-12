# Feature: Node resize (per-node small / medium / large)

**From build-plan:** 13f (under 13. Dense text & media nodes)
**Status:** verified

## Goal

Let the user choose a footprint for note and media nodes - small (default, current
168x104), medium, or large - from the context menu, so a map can mix compact nodes
with a few emphasized ones. Adding media to a small node auto-sets medium. Layout
and PNG export must honor the chosen footprint.

## Design reference

None. This extends the existing rectangle-note visual language; no new visual
design, only scaled dimensions of the existing note/media rect.

## In scope

- New persisted `Node.size` field: `"small" | "medium" | "large"`, default `"small"`.
- Context menu "Node size" control (submenu with three checkable options, matching
  the existing "Fill node with media" checkitem pattern) shown only for note-kind
  nodes (`kind === "note"` or with media attached). Circles keep the fixed
  NODE_DIAMETER footprint.
- Adding media (URL or upload) to a node currently `small` auto-sets `medium`.
  A node already medium or large keeps its size.
- Layout uses per-node half-extents: medium and large notes reserve proportionally
  more space (radial step, clash radius, edge clearance, bounds) via the existing
  `nodeRadius` / `nodeHalfExtents` functions, now driven by per-node extent lookup.
- Canvas rendering (`NodeRect`) and PNG export (`exportPng.ts`) read the same
  size profile so the two cannot drift.
- Text rendering inside larger notes keeps the existing clamping behavior (text
  becomes tooltip/alias when filled; otherwise wraps within the rect).

## Out of scope

- Free-form drag-resize handles or arbitrary pixel sizes (fixed profiles only).
- Resizing circle-kind nodes (fixed diameter stays uniform per the design language).
- Image thumbnail rendering quality changes (13d territory).
- Any change to sibling ordering or the layout algorithm beyond per-node extents.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

## Build steps

- [x] **Step 1 - Size contract + persistence** - add `NODE_SIZES = ["small", "medium", "large"]`, `NodeSize`, `normalizeNodeSizeValue`, and a `size: NodeSize` field on `Node` with default `"small"`; thread it through `normalizeNodes` (same pattern as `mediaFill`: missing/invalid becomes `"small"`, no rewrite when unchanged). *Done when:* old persisted node lists load without a `size` field and every node reads `small`; storage round-trip keeps a set `medium`; `npm test` green.
- [x] **Step 2 - Size profiles + layout honors footprint** - add exported `NODE_SIZE_PROFILES` in `src/lib/layout.ts` (`small` = NOTE_WIDTH x NOTE_HEIGHT as today; medium and large are fixed multipliers, e.g. 1.4x and 1.8x, chosen for readability), and change `nodeRadius` / `nodeHalfExtents` to accept per-node extents so the layout reserves more space for larger notes. *Done when:* `layout.test.ts` covers a medium note getting larger clearance than a small one and bounds reflecting the larger footprint; layout still passes existing tests.
- [x] **Step 3 - Context menu size control + auto-medium on media attach** - add a checkable "Node size" submenu (small/medium/large, checkmark on current) in `NodeContextMenu` for note-kind nodes only; wire the handler in `EditorPage`; when media is attached to a `small` node, set size to `medium` in the same save. *Done when:* right-click/long-press on a note shows the submenu, changing size re-lays-out the canvas and persists after refresh; attaching media to a small node shows it at medium without a second interaction.
- [x] **Step 4 - Canvas render + PNG export at size**
- [x] **Step 5 - Review fixes: editor scales with node, one `media` node kind, drop context-menu upload** - media becomes its own `NodeKind` (`"circle" | "note" | "media"`) set by attaching media and reverting to `note` on clear; normalizer aligns kind with media on load; convert dialog cannot create `media` (attach via Add media); the inline editor fills medium/large rects; the redundant context-menu "Upload image" item is removed (upload lives in the Add media dialog). *Done when:* attaching media shows kind `media` with size menu without converting; editor fills the rect at medium/large; upload flows through the dialog; `npm run verify` and `npm run test:browser` green.
- [x] **Repair F-01 - Orphaned upload blob on convert (EditorPage.tsx:193 guard compares `undefined === null`; cleanup never fires)**
- [x] **Repair F-02 - Stale layout.ts header comment on note dimensions** - `NodeRect` renders width/height from the node's profile (and media/text fill respects the larger box); `exportPng.ts` uses the same profile for drawing and bounds so exported PNG matches the canvas. *Done when:* a map with mixed small/medium/large notes renders and exports with matching proportions; `exportPng.test.ts` covers footprint-derived bounds; `npm run verify` green.

## Files / areas

- `src/types/node.ts` - size type, normalizer, `normalizeNodes` threading
- `src/lib/layout.ts` - `NODE_SIZE_PROFILES`, per-node extents in `nodeRadius` / `nodeHalfExtents`
- `src/components/canvas/NodeContextMenu.tsx` - size submenu
- `src/components/canvas/NodeRect.tsx` - render at profile dimensions
- `src/pages/EditorPage.tsx` - handler wiring, auto-medium on media attach
- `src/lib/exportPng.ts` - export uses per-node profile
- Tests: `src/types` (via storage ops tests), `src/lib/layout.test.ts`, `src/lib/exportPng.test.ts`

## Data / contracts

- **Load-bearing:** `Node.size: NodeSize` (`"small" | "medium" | "large"`, default `"small"`). Persisted in IndexedDB/localStorage via the existing node normalizer; later features (grid-like layout, multi-select) will read footprints from this field. Lock the three-value enum now; arbitrary sizes stay out of scope.
- `NODE_SIZE_PROFILES` in `src/lib/layout.ts` is the single source of dimensions for layout, canvas, and export.
- No project-shape changes; node shape change only.

## Testing

`npm test` (Vitest) is declared and is the gate for logic-bearing steps; browser smoke exists (`npm run test:browser`) but per established 13a-13e practice, layout/export logic gets unit tests and rendering behavior rides on direct browser evidence.

- Step 1: normalizer tests (missing, invalid, unchanged-no-rewrite) alongside existing node-normalizer tests.
- Step 2: layout tests for per-size clearance and bounds; existing layout tests stay green (back-compat at small).
- Step 4: export bounds test with a mixed-size map.
- Manual/browser evidence: mixed-size map renders, re-layouts on size change, auto-medium on media attach, refresh persistence, PNG proportions.

## Notes for the AI

- Follow the `mediaFill` pattern end to end: normalize on load, no-op write when unchanged, one shared pure helper for canvas and export.
- Keep extents lookup per node id inside `layoutTree` (it already builds `nodeById`); do not add a second traversal.
- Size only applies to note-kind nodes; a node converted back to circle kind can drop its size (normalizer may keep the value harmlessly, rendering ignores it).
- Client-only (Vite SPA); all storage via existing operations in `src/storage/operations.ts`.
- No em dashes in code, comments, or commit messages.

## Findings

### 13f/F-01 [P1] closed - Converting away from media never deletes the orphaned upload blob

**File:** src/pages/EditorPage.tsx:193
**Found:** 2026-09-11 by /audit (scope: current; lens: quality)
**Why it matters:** `handleSetKind` guarded blob cleanup with `updated.media?.uploadId === null`; when media was dropped the optional chain yielded `undefined`, so `undefined === null` was false and cleanup never ran, leaking the upload blob in IndexedDB per convert.
**Suggested fix:** `if (previousUploadId && updated.media === null)` plus a convert-flow test.
**Resolution:** 2026-09-11 - guard corrected to `updated.media === null` in EditorPage.tsx; new e2e test converts an uploaded-media node to circle and asserts the media badge is gone and a circle renders. Re-reviewed 2026-09-11 by /audit (scope: current): guard verified correct for all three cases (drop deletes, no prior upload skips, referenced blob survives); e2e convert flow passes 19/19. Closed.

### 13f/F-02 [P3] closed - Stale module comment on size-aware layout

**File:** src/lib/layout.ts:1-4
**Found:** 2026-09-11 by /audit (scope: current; lens: quality)
**Why it matters:** Header still read "notes and media nodes use NOTE_WIDTH x NOTE_HEIGHT" but the module now scales footprints via `NODE_SIZE_PROFILES`.
**Suggested fix:** Update the header line to mention the per-size profiles.
**Resolution:** 2026-09-11 - header updated to describe NODE_SIZE_PROFILES footprints. Re-reviewed 2026-09-11 by /audit: comment now matches the size-aware behavior; no defect introduced. Closed.
