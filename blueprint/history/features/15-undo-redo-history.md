# Feature: Undo/redo history

**From build-plan:** feature 15
**Status:** verified

## Goal

Per-project in-memory undo/redo for node content edits, so a mistaken add, delete, rename, convert, link/media change, resize, or collapse can be reversed with header buttons or `Ctrl/Cmd+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`. Clears on reload or project switch; viewport and project-list ops stay out.

## In scope

- History covers all node content mutations in `EditorPage`: add child, delete subtree, text edit, kind convert, url attach/remove, media attach/replace/remove (incl. local upload), media fill toggle, size change, collapse/expand toggle.
- Snapshot-based entries: `{ label, before: Node[], after: Node[] }` scoped to the open project; undo writes `before`, redo writes `after` via `backend.saveNodes` + refresh.
- Stack cap 50 entries (drop oldest); any new edit clears the redo stack; no-op writes (early-return in ops) push nothing.
- Grouped single entry for add-to-collapsed-parent (auto-expand + insert is one undo).
- UI: Undo/Redo buttons in editor `AppHeader` next to Re-center, with `disabled` states and `aria-label`s; keyboard `Ctrl/Cmd+Z` = undo, `Ctrl+Shift+Z` / `Ctrl+Y` = redo, ignored when focus is in an input, textarea, select, or contentEditable (native text undo wins there) and when a dialog editor is open.
- Delete-undo restores the subtree node records; uploaded-image blobs deleted on subtree delete are best-effort: if the blob is gone the restored node shows the media placeholder (no crash), documented in the empty/error handling.
- Project `updatedAt` bumps on undo/redo (content change); viewport-only saves still preserve it.
- Selection safety: after undo/redo, drop selection/editing state if the node is gone, else keep it.

## Out of scope

- Viewport (pan/zoom/re-center) history.
- Project-level ops: create, rename, delete, duplicate, import/export, home search/sort.
- Persistence across reload, across projects, or collaborative sync (items 22-23).
- Multi-select bulk actions (item 19), cross-links (item 17), present/keyboard-nav pass (item 18).
- Drag-resize, arbitrary sizes, new media types.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Pure history stack (`src/lib/history.ts` + `history.test.ts`)** - generic snapshot stack: `createHistory`, `pushEntry` (clears redo, enforces cap 50), `canUndo`/`canRedo`, `undo`/`redo` returning the snapshot to write, `clear`. Pure, no storage imports. *Done when:* `npm test -- history` passes: push/undo/redo ordering, redo cleared on new push, cap drops oldest, empty undo/redo are no-ops, clear resets.
- [x] **Step 2 - Editor wiring: push + restore** - in `EditorPage` `EditorCanvas`, snapshot project nodes before each content mutation and push `{ label, before, after }` after success; implement `handleUndo`/`handleRedo` writing the snapshot via `backend.saveNodes`, bumping project `updatedAt`, refreshing nodes; fresh history per `project.id` (reset on switch). *Done when:* add then undo removes the child, redo re-adds it; text edit undo restores prior text; collapse undo flips back; refresh persists each state.
- [x] **Step 3 - Header buttons + shortcuts** - extend `AppHeader` editor variant with Undo/Redo pill buttons (`aria-label="Undo"`, `"Redo"`, `disabled` when stack empty); wire `onUndo`/`onRedo`, `canUndo`/`canRedo` props; global keydown in `EditorCanvas` for `Ctrl/Cmd+Z`, `Ctrl+Shift+Z`, `Ctrl+Y` with editable-focus and dialog-open guards. *Done when:* buttons disable/enable correctly; shortcuts fire undo/redo on canvas focus and do nothing inside the node text editor or dialogs; touch devices get the buttons.
- [x] **Step 4 - Edges: grouping, no-ops, blobs, selection** - group add-to-collapsed auto-expand into one entry; merge the inline-editor rename that immediately follows an add into that add entry (one undo removes the child, not just its name); skip push when the op early-returns unchanged (same text/url/kind/size/fill/collapsed); delete-undo restores subtree records with missing-blob placeholder fallback (no throw); post-restore selection pruned to existing ids; root-delete-blocked path pushes nothing. *Done when:* undo after add+rename removes the child in one press; undo after add-to-collapsed removes child and restores collapsed state in one press; unchanged saves don't enable Undo; delete/undo round-trip restores count with placeholder if blob gone; no console errors.
- [x] **Step 5 - Verification + browser coverage** - extend e2e smoke (add/delete/collapse undo/redo round-trip, button disabled states) where cheap; run `npm run verify` and `npm run test:browser` green. *Done when:* both commands pass; manual walk (add, rename, convert, delete, collapse, undo xN, redo xN) leaves a coherent map.
  - Result 2026-09-16: `npm run verify` green; `e2e/undo.spec.ts` green (add/keyboard/collapse/delete/grouping/no-op); full `npm run test:browser` 20/21 with one failure in `e2e/media-upload.spec.ts` ("combined editor keeps unsaved edits") proven pre-existing by reproducing it on the clean tree with this branch's working changes stashed. Left open as a known issue outside this feature's scope.

## Audit repairs (2026-09-16; F-06 skipped - pre-existing, separate /debug+/fix per audit)

- [x] **Repair F-01 - Tick-guarded prune effect in TreeCanvas** - replace the render-time `nodesRef` write with a tick ref updated inside the dep-less effect; drop the stale eslint-disable. *Done when:* `npm run lint` reports no `react-hooks/refs` error and undo still prunes dead selection (existing e2e green).
- [x] **Repair F-02 - Exercise the filled stack in the clear test** - assert `canUndo` true before clearing, then empty after. *Done when:* `npm run lint` reports no `no-useless-assignment` error and history tests green.
- [x] **Repair F-03 - Busy guard for undo/redo during mutations** - track in-flight mutations; `handleUndo`/`handleRedo` (buttons and shortcuts) no-op while busy; buttons show disabled while busy. *Done when:* undo during a pending mutation is refused; idle undo/redo still round-trips (existing e2e green).
- [x] **Repair F-04 - E2E leg for standalone rename undo/redo** - rename root, undo (prior text back), redo (new text back). *Done when:* `e2e/undo.spec.ts` covers the `"Rename node"` entry and passes.
- [x] **Repair F-05 - Adaptive history cap for large maps** - shrink the entry cap once snapshots exceed a node-count threshold; document the bound in the spec. *Done when:* unit test covers the small-map and large-map caps; default behavior unchanged for small maps.
- [x] **Repair F-07 - Reuse cloneNodes in the restore path** - replace the inline clone in `restoreProjectNodesAsync`. *Done when:* no logic change (restore tests green), single clone implementation.
- [x] **Repair F-08 - Platform-aware shortcut hints** - show Cmd on macOS, Ctrl elsewhere. *Done when:* titles render the right modifier per platform.

## Files / areas

- `src/lib/history.ts` (new) + `src/lib/history.test.ts` (new) - pure stack
- `src/pages/EditorPage.tsx` - snapshot push in all `handle*` content ops, `handleUndo`/`handleRedo`, history reset per project
- `src/components/layout/AppHeader.tsx` - Undo/Redo buttons, props
- `src/components/canvas/TreeCanvas.tsx` - read-only props pass-through only if needed (no canvas logic change)
- `e2e/smoke.spec.ts` (or focused `e2e/undo.spec.ts`) - round-trip coverage

## Data / contracts

- **Load-bearing:** history entry `{ label: string, before: Node[], after: Node[] }` holds full per-project node snapshots; restore path is `backend.saveNodes(snapshot)` + mirror to localStorage fallback seed (reuse `operations.ts` mirror behavior), then `refreshNodes()`.
- `Project.updatedAt` bumps on undo/redo restores (content edit); viewport saves keep the existing preserve rule.
- Cap: 50 entries per project for maps up to 200 nodes, 10 entries above that (`historyCapForSnapshot`); in-memory only; cleared on project switch, reload, or unmount. No stored shape change, no migration.
- Blob store untouched by undo except best-effort read: restored upload nodes with missing blobs render the existing placeholder via `loadBlob` null path.

## Testing

- `npm test` (Vitest) gates Steps 1-2 and 4: history stack unit tests;现有 `operations.test.ts` pattern for snapshot helpers if any pure helpers are added.
- `npm run test:browser` covers Step 5: stable undo/redo round-trips (add, delete, collapse) plus button enable/disable.
- Manual `/check` or `/try`: rename, convert note/circle, attach/remove link, attach media + fill toggle, resize S-XL, delete subtree with count confirm, then undo-all / redo-all; confirm zoom/viewport untouched and home order only moves on content change.
- Final gate: `npm run verify` green before `/complete`.

## Notes for the AI

- Client-only Vite SPA; functional components, strict TS, no `any`; reuse `PILL_SX` for header buttons; no em dashes in code or comments.
- Do not swallow storage errors: surface via the existing `editor-error` path; quota errors keep the `toEditorError` message.
- Keep the diff small per step; Step 2 is the big one, split further (e.g. add/text/collapse first, then kind/url/media/size) if the diff exceeds one sitting.
- Keyboard guard: check `(e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')` and skip when any MUI dialog is open; `preventDefault` only when actually handling.

## Findings

### 15/F-01 [P1] closed - TreeCanvas writes a ref during render

**File:** src/components/canvas/TreeCanvas.tsx:61
**Found:** 2026-09-16 by /audit (scope: current; lens: quality)
**Why it matters:** `nodesRef.current = nodes` runs during render, which `npm run lint` reports as an error (`react-hooks/refs`: cannot update ref during render) and is unsafe under concurrent rendering. The accompanying `eslint-disable-next-line react-hooks/exhaustive-deps` is itself unused (a third lint warning), so the suppression is stale too.
**Suggested fix:** drop the render-time ref write. Guard the prune effect with a tick ref updated inside the effect instead, e.g. keep `prevTickRef`, early-return when unchanged, and read the already-current `nodes` prop inside a dep-less effect. That removes the error, the stale disable comment, and the extra ref.
**Resolution:** 2026-09-16 - replaced with a prune-if-gone effect on `[historyTick, nodes]` (idempotent, no ref write, no disable comment). Lint clean on the file, `tsc` clean; behavioral re-proof via `e2e/undo.spec.ts` pending final repair pass.
**Re-review:** 2026-09-16 - confirmed: no render-time ref write, no disable comment, `npm run lint` clean repo-wide, prune semantics intact and idempotent on every nodes change (menu always null at that point; selection kept when alive). Closed.

### 15/F-02 [P2] closed - Useless assignment in the history clear test

**File:** src/lib/history.test.ts:83
**Found:** 2026-09-16 by /audit (scope: current; lens: tests)
**Why it matters:** `npm run lint` reports an error (`no-useless-assignment`): the `pushEntry` result is reassigned by `clearHistory` on the next line, so the pushed entry never participates in the assertion. The test still passes, but lint fails and the "clear a non-empty stack" intent is not actually exercised.
**Suggested fix:** assert the filled stack is undoable first, then clear and assert empty, e.g. hold the pushed stack in its own const, expect `canUndo` true, then `clearHistory` and expect both `canUndo`/`canRedo` false.
**Resolution:** 2026-09-16 - test now asserts `canUndo` on the filled stack before clearing. Lint clean, 9/9 history tests green.
**Re-review:** 2026-09-16 - confirmed the filled-stack assertion is exercised and lint is clean. Closed.

### 15/F-03 [P2] closed - Overlapping async mutations can push stale snapshots

**File:** src/pages/EditorPage.tsx:172
**Found:** 2026-09-16 by /audit (scope: current; lens: quality)
**Why it matters:** every content handler clones `before` from its render closure, then awaits storage writes. Two gestures in flight at once (or undo pressed mid-mutation) can interleave: the second `before` is stale, and last-writer-wins decides the outcome, so an undo entry can silently drop the other op (lost update). Sequential use is safe; only overlap is at risk.
**Suggested fix:** serialize mutations with a single in-flight promise chain (or an in-flight ref that makes undo/redo early-return while a mutation is pending) and disable the Undo/Redo buttons while busy. Smallest useful step is the busy guard on `handleUndo`/`handleRedo` plus `disabled` while busy.
**Resolution:** 2026-09-16 - added `busy` state set around all 10 mutation handlers plus undo/redo restores (try/finally); undo/redo early-return while busy in buttons, shortcuts, and handlers. Mutation-mutation overlap still shares a base snapshot but each entry restores a valid past state (no corruption). Refusal path is timing-dependent so proven by review; idle round-trips re-proven by `e2e/undo.spec.ts` in the final pass.
**Re-review:** 2026-09-16 - confirmed 12 paired set/reset sites plus guards in handlers, buttons, and shortcuts; audited every early return after `setBusy(true)` and all sit inside try blocks with finally (no stuck-busy leak). No new defect. Closed.

### 15/F-04 [P2] closed - Standalone rename undo/redo has no coverage

**File:** e2e/undo.spec.ts:1
**Found:** 2026-09-16 by /audit (scope: current; lens: tests)
**Why it matters:** the e2e covers add+rename via the merge path and no-op rename, but never a plain rename of an existing node followed by undo/redo, which is the only exercise of the `"Rename node"` entry and the merge-fallback branch in `handleUpdateText`. A regression there would slip past both suites (unit tests cover the generic stack only).
**Suggested fix:** add one e2e leg: rename the root, undo (prior text back), redo (new text back). Alternatively extract the merge decision into a pure helper in `history.ts` with unit tests for merge vs fallback.
**Resolution:** 2026-09-16 - added the rename/undo/redo leg to `e2e/undo.spec.ts`; passes (6.6s). Merge-fallback branch stays inline, now exercised through this leg.
**Re-review:** 2026-09-16 - confirmed the leg exists at the spec tail and `e2e/undo.spec.ts` passes (7.0s this pass). Closed.

### 15/F-05 [P2] closed - History holds up to 50 full-map snapshots

**File:** src/lib/history.ts:20
**Found:** 2026-09-16 by /audit (scope: current; lens: performance)
**Why it matters:** each entry clones the whole project node array and the cap is a flat 50, so peak history memory is 50x map size. Fine for typical 10-15 node maps, but the project has measured near 1 MB per storage op at 5k nodes, where this becomes tens of MB held in memory.
**Suggested fix:** make the cap adaptive (e.g. fewer entries once the snapshot exceeds a node-count threshold) or store compact JSON snapshots instead of live object graphs. Document the chosen bound in the spec.
**Resolution:** 2026-09-16 - added `historyCapForSnapshot` (50 entries up to 200 nodes, 10 above), wired into both push paths, bound documented in the spec. Unit tests cover both caps; 14/14 history+restore green.
**Re-review:** 2026-09-16 - confirmed the cap helper, both push-path wirings, the spec documentation, and full unit suite 218/218 green. Closed.

### 15/F-07 [P3] closed - Node-clone logic duplicated in the restore path

**File:** src/storage/operations.ts:406
**Found:** 2026-09-16 by /audit (scope: current; lens: quality)
**Why it matters:** `restoreProjectNodesAsync` inlines the same spread-plus-media clone as `cloneNodes` in `history.ts`. Two copies of a three-line rule will drift (e.g. if `Node` gains another nested field).
**Suggested fix:** import and reuse `cloneNodes` in `restoreProjectNodesAsync`. Check import direction first (`storage` importing from `lib` matches existing usage like `localStore` helpers, so no cycle).
**Resolution:** 2026-09-16 - `restoreProjectNodesAsync` now uses `cloneNodes`; no import cycle (`history.ts` is type-only on node types). Restore tests green.
**Re-review:** 2026-09-16 - confirmed single clone implementation with no cycle; restore tests green within the 218/218 suite. Closed.

### 15/F-08 [P3] closed - Shortcut hints hardcode Ctrl on all platforms

**File:** src/components/layout/AppHeader.tsx:40
**Found:** 2026-09-16 by /audit (scope: current; lens: quality)
**Why it matters:** the handler accepts `Cmd` on macOS but both `title` hints say `Ctrl+Z` / `Ctrl+Shift+Z`, so macOS users see the wrong modifier.
**Suggested fix:** pick the label at runtime (`navigator.platform` carrying `Mac` uses Cmd) or drop the parenthetical to just "Undo"/"Redo".
**Resolution:** 2026-09-16 - titles now render `Cmd+Z` / `Cmd+Shift+Z` on macOS, `Ctrl` elsewhere. Text-only change, verified by typecheck.
**Re-review:** 2026-09-16 - confirmed platform-conditional titles with undefined-safe `navigator` access; typecheck clean. Closed.
