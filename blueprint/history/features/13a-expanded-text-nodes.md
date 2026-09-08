# Feature: Expanded-text rectangle nodes

**From build-plan:** feature 13a (split from 13)
**Status:** verified

## Goal

Add a second node shape alongside circles: a rectangle **note** node that holds longer paragraph text, so dense ideas fit without abusing 30-char circles. Circles stay the default; notes opt in per node via convert.

Why it matters: unlocks the post-circle MVP (project-plan non-goal "dense/long-text node type") while locking the load-bearing `kind` contract that 13b (links) and 13c (image/video) will extend.

## In scope

- `Node.kind` contract: `circle` (default) vs `note` (rectangle), normalized on load.
- Longer text limit for notes (280 chars), circles stay 30 chars with existing counter behavior.
- Rectangle rendering on canvas (same palette/tokens, multiline wrap, tooltip on overflow).
- Size-aware auto-layout: rects get larger clearance than 88px circles, no new overlap/crossing regressions.
- Inline editing for notes (multiline editor with counter, commit on blur, Escape cancels, empty reverts).
- Type convert via context menu (circle to note, note to circle, with truncation confirm when note text exceeds 30 chars).
- New children default to circle; adding a child to a collapsed note auto-expands (existing rule). Root is convertible like any node; project-rename root-text sync applies regardless of kind.
- Collapse badge, plus buttons, selection ring, delete-subtree confirm with count work on rects. Existing over-30 legacy circles still display as-is until edited (feature 8 rule, unchanged).
- PNG export + preview render rects (rounded rect, wrapped text, light background as today).
- Persistence (IndexedDB primary + localStorage fallback) including old records without `kind`.

## Out of scope

- 13b link nodes (URL attach/open/validation).
- 13c image/video rectangle nodes (media attach, thumbnails, export of media).
- Directional placement (all pluses still mean add-child; side assignment unchanged).
- Cross-links/graph edges (feature 14), undo/redo (15), present/dark/keyboard modes (17).
- Visual redesign beyond rect shape; no new palette, no typography change.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Kind contract + validation + storage** - add `kind: circle | note` to `Node`, `MAX_NOTE_TEXT_LENGTH = 280`, kind-aware `validateNodeTextPure(text, kind)`, `normalizeNode` (missing/invalid kind to `circle`), wire through `operations.ts` (`addChildNodeAsync`, `updateNodeTextAsync`, new `setNodeKindAsync` with truncation guard), IndexedDB + localStorage round-trip. *Done when:* old nodes without `kind` load as circles; circle over 30 and empty still rejected; note up to 280 accepted; kind switch persists after refresh; `npm test` green for new validator/normalize cases.
- [x] **Step 2 - Size-aware layout** - introduce per-node footprint (`circle 88px` vs `note e.g. 168x104`), use max footprint for step/clearance and bounds padding, keep insertion-order and side-quadrant behavior. *Done when:* mixed circle/note maps place with no node-node overlap (center distance respects footprints) and no new edge-crossing on the layout quality fixtures; `layout.test.ts` covers mixed-size separation; existing circle-only layouts unchanged.
- [x] **Step 3 - Rectangle rendering + edit + convert** - rect node component (same tokens, `--line`/`--node-fill`, multiline wrap, `>=44px` plus targets preserved), multiline editor with `280` counter, context-menu convert items (including root and touch long-press), truncation confirm when note-to-circle exceeds 30 chars. Split render vs convert into two diffs at implement time if the diff gets too big to read. *Done when:* in dev server a circle converts to rect and back; long note wraps inside rect; empty edit reverts; plus buttons on rect add circle children; badge/count and selection ring behave as on circles on desktop and touch widths.
- [x] **Step 4 - PNG export + preview for rects** - `renderMapToCanvas` draws rounded rects with wrapped note text (reuse `wrapLinesPure` with wider measure), bounds include rect extents, preview dialog fits whole tree as today. *Done when:* a map with 2 notes + 3 circles exports a PNG showing all rects with readable wrapped text on light background; preview confirm/cancel still works; export unit tests cover rect wrapping/bounds.
- [x] **Step 5 - Parity + persistence pass** - collapse/expand reflow with rects, subtree delete count on notes, viewport persistence untouched, corrupted/unknown `kind` values normalize to circle with no crash, mobile long-press menu offers convert. *Done when:* manual walkthrough (create, convert, edit long text, collapse, refresh, delete with count, export) passes on desktop and narrow viewport; `npm run verify` green; `npm run test:browser` smoke green.
- [x] **Repair A - findings F-02, F-03, F-04 trivial cleanups** - remove unused `normalizeNode`, use `MAX_NODE_TEXT_LENGTH` in both convert paths, fix two formatting warts. *Done when:* `npm run verify` green; findings F-02, F-03, F-04 set to fixed.
- [x] **Repair B - finding F-01 shared gestures hook** - extract identical tap/double-tap/long-press/keyboard handlers from `NodeCircle`/`NodeRect` into `useNodeGestures`, use from both with no behavior change. *Done when:* circles and notes behave identically (browser smoke green), `npm run verify` green, finding F-01 set to fixed.

## Files / areas

- `src/types/node.ts` - `NodeKind`, `kind` field, `isNodeKind` guard.
- `src/storage/localStore.ts` - limits, kind-aware validation, normalize on load.
- `src/storage/operations.ts`, `src/storage/indexedDb.ts`, `src/storage/backend.ts` - kind through writes, `setNodeKindAsync`.
- `src/lib/layout.ts`, `src/lib/layout.test.ts` - footprint-aware placement.
- `src/components/canvas/NodeCircle.tsx` (+ new `NodeRect.tsx` or unified `MindNode.tsx`), `NodeEditor.tsx`, `NodeContextMenu.tsx`, `TreeCanvas.tsx`, `TreeCanvas.css` - render/edit/convert.
- `src/lib/exportPng.ts`, `src/lib/exportPng.test.ts`, `src/components/canvas/ExportPreviewDialog.tsx` - rect export/preview.
- `src/pages/` editor wiring for `onSetKind` handler.

## Data / contracts

- **Load-bearing, extends in 13b/13c:**
  ```ts
  export const NODE_KINDS = ["circle", "note"] as const;
  export type NodeKind = (typeof NODE_KINDS)[number];
  export type Node = {
    id: string;
    projectId: string;
    parentId: string | null;
    text: string;
    kind: NodeKind;
    side: NodeSide | null;
    collapsed: boolean;
    createdAt: string;
    updatedAt: string;
  };
  ```
- Rules: `kind` defaults to `circle` when missing/invalid (forward/backward compat); circle text max 30, note text max 280; empty-after-edit reverts (existing rule, both kinds); note-to-circle convert with text over 30 requires explicit confirm then truncates only on approve, else stays note.
- 13b will add optional `url` on any kind; 13c will add `media` payload on `note` (or a new kind). Neither may rename `kind` values or change defaults without a migration step.
- Client-only (Vite SPA); no server, no API, no auth scoping. Storage stays whole-list ops until feature 22.

## Testing

- `npm test` (Vitest, gate on for logic steps): kind-aware text validation, normalize/migration of legacy nodes, footprint separation math, export rect wrap/bounds.
- `npm run test:browser` (Playwright Chromium smoke): keep green; add focused coverage only for stable behavior (convert round-trip, note edit commit) when proportionate.
- Manual `/check` per done-when above: convert both ways, 280-char wrap, empty revert, truncation confirm, collapse reflow, refresh persistence, whole-tree PNG readability, touch long-press convert.
- `npm run verify` (tests + typecheck + build) is the final gate before `/complete`.

## Notes for the AI

- Keep diffs small and in step order; each step leaves the app working with circles unchanged when no notes exist.
- No `any`, strict TS, `verbatimModuleSyntax`; no gradients; reuse `TOKENS` and existing canvas CSS variables.
- Do not invent a test runner or CI; use declared `npm test`, `npm run test:browser`, `npm run verify`.
- Truncation uses ellipsis convention from `wrapLinesPure`; tooltips for overflow text.
- Viewport-only saves must still not bump `updatedAt` (existing home-sort rule).

## Findings

### 13a/F-01 [P2] closed - NodeRect duplicates NodeCircle gesture and chrome logic

**File:** src/components/canvas/NodeRect.tsx:1
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** About 180 of 230 lines are identical to `NodeCircle.tsx` (tap/double-tap/long-press/drag-threshold handlers, collapse badge, plus buttons). Any future gesture fix (timing, thresholds, a11y) must be applied twice and will drift.
**Suggested fix:** Extract a shared `useNodeGestures` hook (or a common `NodeFrame` wrapper for badge plus buttons) and use it from both components. Follow-up candidate, not a merge blocker.
**Resolution:** Extracted `useNodeGestures` (plus `PLUS_POSITIONS`) in Repair B; both shapes use it. Badge/plus JSX stays duplicated per shape (deliberate, sizes differ). Re-audit 2026-09-08: hook logic verbatim, both call sites wired, lint clean, 114 tests + 9 browser tests green. Closed.

### 13a/F-02 [P3] closed - Unused normalizeNode export

**File:** src/types/node.ts:33
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** `normalizeNode` (singular) is exported but nothing imports it; all call sites use `normalizeNodes`. Dead API surface invites confusion about which to call.
**Suggested fix:** Remove it, or keep it only if 13b/13c is expected to need single-node normalization.
**Resolution:** Removed the export in Repair A; `normalizeNodes` covers all call sites. Re-audit 2026-09-08: no references remain. Closed.

### 13a/F-03 [P3] closed - Circle text limit hardcoded as 30 in convert paths

**File:** src/storage/operations.ts:192
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** `setNodeKindAsync` uses literal `30` (and `TreeCanvas.tsx` handleMenuConvert repeats the same `> 30` check) instead of `MAX_NODE_TEXT_LENGTH`. A future limit change must find both spots.
**Suggested fix:** Import `MAX_NODE_TEXT_LENGTH` from `localStore` in both places.
**Resolution:** Both `operations.ts` and `TreeCanvas.tsx` now use the constant in Repair A. Re-audit 2026-09-08: no literal-30 limit checks remain. Closed.

### 13a/F-04 [P3] closed - Two formatting warts from edits

**File:** src/pages/EditorPage.tsx:158
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** `handleToggleCollapsed` signature and its first statement sit on one long line, and `src/lib/exportPng.ts` is missing the blank line between `traceRoundRect` and `resolveExportScale`. Lint passes, so this is readability only.
**Suggested fix:** Restore the line break in `EditorPage.tsx` and the blank line in `exportPng.ts`.
**Resolution:** Both restored in Repair A. Re-audit 2026-09-08: line break and blank line confirmed in place. Closed.
