# Feature: Link nodes

**From build-plan:** feature 13b (sub-item of 13)
**Status:** verified

## Goal

Attach one optional URL to any node (circle or note) so maps can point outward, with validation, a small open affordance, and PNG-safe handling. Unlocks the link half of the dense-text and media milestone while keeping the `kind` contract from 13a untouched.

## In scope

- `Node.url` contract: optional link on any kind, normalized on load, cleared with empty.
- URL validation: trim, empty clears, auto-prepend `https://` when no scheme, only `http:`/`https:` allowed via `URL` constructor, max length guard, `javascript:`/`data:` and other schemes rejected.
- Attach/edit/remove via context menu plus a small `NodeLinkDialog` (URL field, inline error, Save/Cancel, Remove when a link exists).
- Canvas affordance: small link badge on nodes with a URL (distinct corner from collapse badge, no overlap with plus targets), tooltip shows URL, click opens in new tab with `noopener,noreferrer`, keyboard accessible, touch long-press menu offers the same actions. Applies to any node including root.
- Open path: badge click and menu `Open link` both open the normalized URL; no fetch, no preview, no auto-linkify of node text.
- PNG export + preview: raster cannot stay clickable, so draw a small link indicator on linked nodes (same corner logic, light-background safe) and keep confirm/cancel flow unchanged.
- Persistence (IndexedDB primary + localStorage fallback + mirror) including legacy records without `url`; content edits bump `updatedAt`, viewport-only saves still do not.
- Collapse, plus buttons, selection ring, delete-subtree count, viewport persistence unchanged with links present.

## Out of scope

- 13c image/video rectangle nodes (media attach, thumbnails, media export).
- Directional placement, cross-links/graph edges (feature 14), undo/redo (15), present/dark/keyboard modes (17).
- Auto-linkify of node text, rich link previews, favicons, title fetching, multi-URL per node.
- Visual redesign, new palette or typography; badge reuses existing tokens and collapse-badge sizing.
- Cloud sync or shareable-link behavior (features 21/22); storage stays whole-list ops until feature 22.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - URL contract + validation + storage** - add `url: string | null` to `Node`, `MAX_URL_LENGTH = 2048`, pure `validateNodeUrlPure(raw)` (empty allowed as clear) + `normalizeNodeUrlPure(raw)` (trim, auto-`https://`, `URL` parse, http/https only), extend `normalizeNodes` to coerce missing/invalid/empty to `null`, new `setNodeUrlAsync(backend, nodeId, url | null)` (null/empty clears, invalid throws, bumps `updatedAt`, mirrors to localStorage), new nodes default to `null`, `setNodeKindAsync` preserves `url`. *Done when:* legacy nodes without `url` load as no-link; valid `https://example.com` and bare `example.com` (normalized to `https://example.com/`) accepted; `javascript:alert(1)`, `data:`, `ftp:` and over-length rejected; clear persists after refresh; `npm test` green for new validator/normalize/ops cases.
- [x] **Step 2 - Link dialog + context menu wiring** - new `NodeLinkDialog.tsx` (MUI Dialog, URL input, inline error from validator, Save disabled or blocked on invalid, Cancel, Remove button when a link exists), context menu items `Add link` / `Edit link` / `Remove link` / `Open link` (Open disabled when no URL, Remove needs no confirm), `TreeCanvas` state for link target plus `EditorPage` `handleSetUrl` handler with error banner on failure, focus returns to node on close. *Done when:* in dev server right-click (and touch long-press) a circle and a note can add, edit, remove a link; invalid input shows inline error and does not save; empty saves as remove; refresh keeps the link; editor stays working when no link exists.
- [x] **Step 3 - Canvas link badge + open behavior** - small link badge on `NodeCircle` and `NodeRect` when `url` is set (top-right corner to avoid collapse badge at bottom-right and plus targets at N/E/S/W offsets, reuses badge tokens, `>=24px` target with tooltip = URL, `aria-label` like `Open link for "text"`), click with `stopPropagation` opens normalized URL in new tab (`window.open` with `noopener,noreferrer`, fallback to anchor click), keyboard Enter/Space on focused badge opens, plus buttons and collapse badge unaffected, layout footprints unchanged. *Done when:* linked circles and notes show one badge each even when collapsed (both badges visible, no overlap); clicking badge opens the URL in a new tab without selecting or dragging the canvas; keyboard focus + Enter opens; touch tap on badge opens; unlinked nodes show no badge.
- [x] **Step 4 - PNG export + parity pass** - `exportPng.ts` draws a small link indicator on linked nodes (corner dot/glyph inside node bounds, light-background safe, scaled with export scale); bounds logic unchanged (badge overlay, no footprint change); parity: collapse/expand reflow with links, corrupted/over-long/invalid `url` values normalize to `null` with no crash, mobile long-press menu offers link actions, viewport-only saves still preserve `updatedAt` ordering. *Done when:* linked circles and notes export with link indicators on light background; preview confirm/cancel works; `npm run verify` green; `npm run test:browser` smoke green.
- [x] **Repair F-03 - delete-focus rect lookup** - reuse the two-shape selector in `handleConfirmDelete`. *Done when:* deleting a child of a note focuses the parent rect; `npm run verify` green.
- [x] **Repair F-01 - shared link badge component** - extract `NodeLinkBadge` and use from `NodeCircle`/`NodeRect` with no behavior change. *Done when:* linked circles and notes show identical badges; `npm run verify` green; browser smoke green.
- [x] **Repair F-02 - browser coverage for link flow** - add one focused Playwright case: attach via dialog, badge visible, reload persists. *Done when:* `npm run test:browser` green with the new case; `npm run verify` green.

## Files / areas

- `src/types/node.ts` - `url` field, `isNodeUrl`-style guard if needed, extended `normalizeNodes`.
- `src/storage/localStore.ts` - `MAX_URL_LENGTH`, `validateNodeUrlPure`, `normalizeNodeUrlPure`.
- `src/storage/operations.ts`, `src/storage/indexedDb.ts`, `src/storage/backend.ts` - `url` through writes, `setNodeUrlAsync`, default `null` on create.
- `src/components/canvas/NodeLinkDialog.tsx` (new), `NodeContextMenu.tsx`, `TreeCanvas.tsx`, `NodeCircle.tsx`, `NodeRect.tsx`, `TreeCanvas.css` - dialog, menu items, badge, open behavior.
- `src/pages/EditorPage.tsx` - `handleSetUrl` wiring with error banner.
- `src/lib/exportPng.ts`, `src/lib/exportPng.test.ts`, `src/components/canvas/ExportPreviewDialog.tsx` - link indicator in export/preview.
- `src/storage/*.test.ts`, `src/lib/*.test.ts` - validator, normalize, ops, export indicator cases.

## Data / contracts

- **Load-bearing, extends 13a `kind` contract, must not break 13c:**
  ```ts
  export type Node = {
    id: string;
    projectId: string;
    parentId: string | null;
    text: string;
    kind: NodeKind;
    url: string | null;
    side: NodeSide | null;
    collapsed: boolean;
    createdAt: string;
    updatedAt: string;
  };
  ```
- Rules: `url` defaults to `null` when missing, empty, or invalid (forward/backward compat); valid means trimmable, length within `MAX_URL_LENGTH`, parseable by `URL` after auto-`https://` prepend when scheme-less, protocol `http:` or `https:` only; stored value is the normalized `href` (trimmed, with scheme); empty string input clears to `null`, never stores `""`.
- `setNodeUrlAsync` bumps node and project `updatedAt` (content edit, affects home newest-first sort); viewport-only saves still do not bump (existing home-sort rule).
- Client-only (Vite SPA); no server, no API, no auth scoping. Storage stays whole-list ops until feature 22. 13c will add `media` payload without renaming `kind` or `url` and without changing `null` default.
- Security: never render `url` as HTML, never accept `javascript:`/`data:`/`file:` schemes, open only via `noopener,noreferrer` new tab; tooltip shows raw URL text only.

## Testing

- `npm test` (Vitest, gate on for logic steps): URL validator (empty-clear, trim, bare-domain prepend, http/https pass, `javascript:`/`data:`/`ftp:` fail, over-length fail), normalize legacy/malformed `url` to `null`, `setNodeUrlAsync` set/clear/invalid-throws + `updatedAt` bump, export link-indicator bounds/flag.
- `npm run test:browser` (Playwright Chromium smoke): keep green; add focused coverage only for stable behavior (dialog attach round-trip, badge presence on linked node) when proportionate.
- Manual `/check` per done-when above: add/edit/remove/open from menu and badge, invalid blocked with inline error, empty clears, collapsed + linked shows both badges without overlap, refresh persistence, whole-tree PNG shows indicators, touch long-press link actions.
- `npm run verify` (tests + typecheck + build) is the final gate before `/complete`.

## Notes for the AI

- Keep diffs small and in step order; each step leaves the app working with unlinked maps pixel-identical to today.
- No `any`, strict TS, `verbatimModuleSyntax`; no gradients; reuse `TOKENS` and existing canvas CSS variables; reuse `NodeConvertDialog`/`NodeDeleteDialog` dialog patterns.
- Do not invent a test runner or CI; use declared `npm test`, `npm run test:browser`, `npm run verify`.
- Badge is overlay only: do not touch `src/lib/layout.ts` footprints, clearances, or insertion-order/side-quadrant behavior.
- Stop event propagation on badge and dialog interactions so canvas pan/select/drag and `NodeEditor` blur-commit paths do not fire accidentally; return focus to the node shape on dialog close (match `focusCircle` pattern, extend to rects where needed).
- Viewport-only saves must still not bump `updatedAt`; link set/clear must bump it.

## Findings

### 13b/F-01 [P2] closed - Link badge button and SVG duplicated in NodeCircle and NodeRect

**File:** src/components/canvas/NodeCircle.tsx:87
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** The `node-link` badge (button chrome, stopPropagation handlers, tooltip, aria-label, inline chain SVG) is copied verbatim into `NodeRect.tsx:89`. Any future badge fix (keyboard handling, tooltip, touch target, icon) must be applied twice and will drift. This repeats the pattern 13a/F-01 already paid down for gestures with `useNodeGestures`, while badge JSX was deliberately left duplicated; the link badge doubles that surface.
**Suggested fix:** Extract a shared `NodeLinkBadge` component (props: `text`, `url`, `onOpen`) and render it from both shapes, mirroring the `useNodeGestures` precedent.
**Resolution:** Extracted `src/components/canvas/NodeLinkBadge.tsx` and used it from both shapes with no behavior change; `npm run verify` and `npm run lint` green. Awaiting re-audit to close.
**Re-audit 2026-09-08:** single shared component confirmed, both call sites identical, no leftover duplication, no new defect. Closed.

### 13b/F-02 [P2] closed - No automated coverage for link dialog and badge wiring

**File:** src/components/canvas/NodeLinkDialog.tsx:19
**Found:** 2026-09-08 by /audit (scope: current; lens: tests)
**Why it matters:** Dialog validation/save/remove, menu wiring, badge presence and open behavior, and the export badge are exercised only by manual walkthrough (no `/check` evidence in this pass) and the pre-existing 9-test browser smoke, which has no link case. A regression in `handleSaveLink`, the badge `stopPropagation` chain, or `renderMapToCanvas` badge code would ship green.
**Suggested fix:** Add one focused Playwright case (attach link via dialog on a circle and a note, expect badge `Open link for ...` visible, reload persists, export preview still renders), proportionate to the spec's testing plan. Unit-test the `window.open` fallback in `src/lib/link.ts` only if cheap; the browser case covers the boundary better.
**Resolution:** Added `e2e/link-nodes.spec.ts` (invalid blocked with inline error and disabled Save, `example.com` attach shows badge, reload persists); also tightened `normalizeNodeUrlValue` to reject whitespace after Chromium was found to accept `https://not a url` while Node throws, plus a unit case. `npm run test:browser` 10 passed, `npm run verify` and `npm run lint` green. Awaiting re-audit to close.
**Re-audit 2026-09-08:** `e2e/link-nodes.spec.ts` reviewed (invalid blocked, attach shows badge, reload persists), whitespace rule sound (raw whitespace never valid in a URL; encoded forms unaffected), no `.only`/skips, lint clean with 131 unit tests green. Closed.

### 13b/F-03 [P3] closed - Delete-focus lookup misses rect parents

**File:** src/components/canvas/TreeCanvas.tsx:220
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** `focusCircle` was extended for 13b to query `.node-circle, .node-rect`, but `handleConfirmDelete` still tests only `[data-node-id="..."] .node-circle` before focusing. After deleting a child whose parent is a note, focus falls back to the canvas container instead of the parent rect, a small keyboard-flow inconsistency for note-heavy maps.
**Suggested fix:** Reuse the same two-shape selector as `focusCircle` in the delete-focus check.
**Resolution:** Reused the two-shape selector in `handleConfirmDelete`; `npm run verify` and `npm run lint` green. Awaiting re-audit to close.
**Re-audit 2026-09-08:** two-shape selector confirmed at `TreeCanvas.tsx:220`, matching `focusCircle`; no new defect. Closed.
