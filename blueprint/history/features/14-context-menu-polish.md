# Feature: Context menu polish (icon-first node menu)

**From build-plan:** 14
**Status:** verified

## Goal

Rework the node context menu from a text list into an icon-first menu: pencil and
link icons on one row, a convert section with an icon per target kind, size as
letters side by side (S, M, L, XL), fewer redundant items, and one combined
editor for media nodes.

## Design reference

None (no mockup). Extends the existing Excalidraw-minimal language: thin strokes,
neutral grays, one accent for hover/selection. Icons: small inline SVGs matching
the existing glyph style (`NodeMediaGlyph`).

## In scope

- **New XL size**: fourth footprint in `NODE_SIZE_PROFILES` (~2.2x small), enum
  becomes `small | medium | large | xlarge`; menu shows letters **S, M, L, XL**
  side by side in one row, checkmark/current highlighted. Auto-medium on fresh
  media attach stays as is.
- **Icon row**: Edit (pencil icon) and Add/Edit link (chain icon) on one row.
  Link removal moves into the link dialog (save-with-empty); "Open link" menu
  item is removed (the node badge still opens links).
- **Convert section**: labeled group with one icon per available target kind
  (circle, note, media). Media icon on a non-media node starts the attach flow
  (media is arrived at, not converted to); media nodes see circle and note only.
  Existing confirm rules keep: media removal confirm, circle truncation confirm.
- **"Open media" menu item removed** (the media badge still opens media).
- **Combined media editor**: on media-kind nodes, the pencil - via context menu,
  double-click, or the mobile long-press-edit path - opens one combined dialog
  with text field, media attach/replace/remove, and the fill toggle. The inline
  textarea no longer opens on media nodes. Fill/Edit-media menu items are removed.
- Delete and Collapse/Expand keep their current menu entries.

## Out of scope

- Drag-resize handles or arbitrary sizes (fixed profiles only).
- Resizing circles (fixed diameter).
- Reworking the plus-badge or collapse-badge interactions.
- New media types beyond image/video.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.

## Build steps

- [x] **Step 1 - XL profile + size letters row** - add `xlarge` to `NODE_SIZES` and `NODE_SIZE_PROFILES` (~2.2x; export/layout pick it up automatically through the shared profiles); replace the three per-size menu items with one row of letter buttons (S, M, L, XL), current one highlighted; persist and re-layout on choose. *Done when:* choosing XL shows the biggest footprint on canvas and after refresh; layout/export tests cover the XL profile; menu shows one letter row.
- [x] **Step 2 - Icon row + pruned items** - Edit and Add/Edit link become icon buttons on one row (pencil, chain; chain label changes "Add link"/"Edit link" by state); remove "Open link", "Open media" menu items; link removal lives in the link dialog (empty save removes, confirmed by existing dialog affordance). *Done when:* the menu shows the icon row, no Open link/Open media entries, node badges still open link/media, link add/edit/remove all work from the dialog.
- [x] **Step 3 - Convert section with kind icons** - grouped convert row(s) with an icon per available target kind (circle, note, media); media icon on non-media nodes opens the combined editor in attach mode; media nodes show circle + note icons; existing confirm dialogs fire on media-drop or circle truncation. *Done when:* each kind icon triggers the right flow; confirms still gate destructive conversions; menu no longer has text convert items.
- [x] **Step 4 - Combined media editor** - extend the media dialog with the node text field and fill toggle; on media-kind nodes the pencil (context menu, double-click, mobile long-press-edit path) opens this combined editor instead of the inline textarea; fill toggle and text save in one commit; non-media nodes keep the current inline editor. *Done when:* double-clicking a media node opens the combined editor everywhere the inline editor used to; text + media + fill all save from it; note nodes still get the inline textarea.
- [x] **Step 5 - Cleanup + verification**
- [x] **Repair F-01 - Combined-editor upload closes the dialog and drops unsaved text/fill edits**
- [x] **Repair F-02 - Video thumbnail img lacks a load-error fallback to the placeholder glyph**
- [x] **F-03 - decision pending: repair in place or defer to item 18 (keyboard nav)** - accepted by the user, deferred to item 18 - remove dead menu props/handlers ("Open media" handler, per-size items), align aria-labels, run full gates. *Done when:* no unused handlers/props remain; `npm run verify` and `npm run test:browser` green.

## Files / areas

- `src/types/node.ts` - `xlarge` in `NODE_SIZES`
- `src/lib/layout.ts` - XL entry in `NODE_SIZE_PROFILES`
- `src/components/canvas/NodeContextMenu.tsx` - icon row, letter row, convert section, pruned items
- `src/components/canvas/NodeLinkDialog.tsx` - remove-link affordance (if not already present)
- `src/components/canvas/NodeMediaDialog.tsx` - text field + fill toggle (combined editor)
- `src/components/canvas/NodeRect.tsx` / `useNodeGestures.ts` - media nodes route edit gestures to the combined editor
- `src/components/canvas/TreeCanvas.tsx`, `src/pages/EditorPage.tsx` - handler wiring
- Tests: `layout.test.ts` (XL), `exportPng.test.ts` (XL bounds), e2e `smoke.spec.ts`/`media-upload.spec.ts` menu interactions

## Data / contracts

- **Load-bearing:** `NodeSize` gains `"xlarge"`. Stored nodes with `size: "xlarge"` must normalize cleanly; older app versions reading a new map fall back per normalizer (already `small`-defaulted). Persisted shape otherwise unchanged.
- `NODE_SIZE_PROFILES` stays the single dimension source; XL added there only.
- Menu action handlers change shape (icons instead of text items); no storage contract changes.

## Testing

`npm test` (Vitest) is the gate for logic-bearing steps; browser smoke exists for behavior.

- Step 1: XL profile tests in `layout.test.ts` (radius/bounds) and `exportPng.test.ts` (rect scaling); normalizer test for `xlarge` acceptance.
- Steps 2-4: menu flows ride on browser evidence; extend e2e smoke where cheap (menu renders icon row, convert confirm still fires).
- Manual: full menu walk on desktop hover and mobile long-press.

## Notes for the AI

- Icons: inline SVG, `currentColor`, stroke style matching `NodeMediaGlyph`; no icon dependency.
- The combined editor is a dialog extension, not a new component tree; keep one source of truth for media state (`NodeMediaDialog` target pattern).
- Mobile: the long-press path that opens the context menu already exists; the double-click/tap-edit path routes through `handleEditStart` - intercept only for media-kind nodes.
- Keep large touch targets (>= 44px) on the new icon and letter buttons.
- Client-only; no em dashes in code or comments.

## Findings

### 14/F-01 [P2] closed - Combined-editor upload closes the dialog and drops unsaved edits

**File:** src/components/canvas/TreeCanvas.tsx:253
**Found:** 2026-09-11 by /audit (scope: current; lens: quality)
**Why it matters:** `handleDialogUploadFile` closed the media dialog on upload success; in combined mode that silently discarded unsaved text and fill edits.
**Suggested fix:** in combined mode, keep the dialog open on upload success and only close on explicit Save/Remove/Cancel.
**Resolution:** 2026-09-11 - `onUploadMedia` now returns the fresh upload media alongside the message; `handleDialogUploadFile` keeps the combined dialog open and updates the target's media on success. Simple (attach) mode still closes like a save. Re-review found a residual remount path (the dialog key included media.src, so uploading over URL media remounted and reset drafts); fixed by keying on nodeId+mode instead. Re-reviewed with new e2e (type text, upload mid-edit, save unfilled: text and media persist). Closed.

### 14/F-02 [P3] closed - Video thumbnail img has no load-error fallback

**File:** src/components/canvas/NodeRect.tsx:173-180
**Found:** 2026-09-11 by /audit (scope: current; lens: quality)
**Why it matters:** the YouTube thumbnail `img` rendered without an error handler; when i.ytimg.com was unreachable the node showed the browser's broken-image glyph instead of the video placeholder.
**Suggested fix:** reuse the existing `brokenSrc` state pattern (keyed on the thumb URL) to fall back to the placeholder.
**Resolution:** 2026-09-11 - thumb img reuses `brokenSrc`; on error it falls back to the video placeholder glyph. Re-reviewed: condition `videoThumbSrc !== null && videoThumbSrc !== brokenSrc` verified, no conflict with the image-src brokenSrc use (one media per node). Closed.

### 14/F-03 [P3] accepted - Context menu icon and letter rows sit outside MUI keyboard navigation

**File:** src/components/canvas/NodeContextMenu.tsx:96-265
**Found:** 2026-09-11 by /audit (scope: current; lens: tests)
**Why it matters:** MUI Menu's arrow-key navigation walks MenuItem children only; the Box-button rows are tab-focusable but skipped by arrow keys, so keyboard users get inconsistent navigation.
**Suggested fix:** register the custom rows as menu items, or defer to item 18's keyboard-nav pass.
**Resolution:** 2026-09-11 - accepted by the user in chat: deferred to item 18 (Presentation & a11y polish, keyboard nav pass); all custom controls remain tab-focusable with labels, so the minimal a11y bar is met meanwhile.
