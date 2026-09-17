# Feature: 16. Home enhancements

**From build-plan:** feature 16
**Status:** verified

## Goal

Make the home project list usable as the library grows: duplicate a project in one click, find it via search with sort control, and move it via JSON file export/import. Keeps the local-only model; no cloud, no sharing links.

## In scope

- **Duplicate project** from the project card overflow menu: deep-copies project + all its nodes with fresh IDs, auto-unique name (`<name> (copy)`, then `<name> (copy 2)`...), copies IndexedDB image blobs to the new node/project IDs, appears newest-first via fresh timestamps.
- **Search + sort on home:** text input filters by project name (case-insensitive substring); sort criterion select (Last updated default, Date created, Name) plus direction toggle (joined Asc/Desc segment); result count; filtered-empty state with clear action distinct from the no-projects empty state.
- **JSON export:** per-project export from the overflow menu to a versioned `.json` file download (`<sanitized-name>-mindmap.json`).
- **JSON import:** home-level Import button + file picker, structural validation with user-friendly errors, name-conflict auto-rename (`<name> (imported)`, then numbered), fresh IDs/timestamps, viewport preserved when valid.

## Out of scope

- Items 17-23 (cross-links, present/a11y, multi-select, grid layout, PNG fit, URL share, team short-link). No cloud sync, no delta/tombstone changes.
- Blob bytes in JSON export (export carries node records only; upload refs are stripped with a notice - see contracts). No multi-file / zip export.
- Persisting search/sort across reloads, tags, archiving, bulk selection, project folders.
- Changing the `mindmap:projects` / `mindmap:nodes` storage keys or the IndexedDB schema.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Pure home helpers + unit tests** - new `src/lib/projectHome.ts` with `buildDuplicateNamePure`, `filterProjectsPure`, `sortProjectsPure`, `serializeProjectExportPure`, `parseProjectImportPure` (structural validation only, no storage). *Done when:* `npm test` passes with new `projectHome.test.ts` covering copy-numbering, case-insensitive filter, all three sorts, export shape version, and import rejects (malformed JSON, wrong version, missing root, dangling parentId, bad name); `npm run build` passes.
- [x] **Step 2 - Duplicate storage op + tests** - `duplicateProjectAsync(backend, id, blobs?)` in `src/storage/operations.ts`: loads project + its nodes, remaps all node IDs + `projectId` + `parentId` + `rootNodeId`, fresh `createdAt`/`updatedAt` (nodes too), copies viewport, mirrors to localStorage seed, copies each upload blob to the new upload/node/project IDs (missing blob falls back to clearing that node's upload ref). *Done when:* new `operations` tests show duplicate has new IDs, same node count/texts/kinds/sides/collapsed, unique `(copy)` name, newest-first ordering, and blob copy verified via memory blob store; `npm run verify` green.
- [x] **Step 3 - Search + sort UI** - `HomePage` gets a search field (`label Search projects`) + sort criterion select (`Last updated` default, `Date created`, `Name`) plus a direction toggle button (`aria-label Toggle sort direction`, Asc/Desc joined segment) above the grid, wired through the new pure helpers (`sortProjectsPure(projects, key, dir)`); result count text (`N of M` when filtered); filtered-empty card with Clear search button; controls hidden on the no-projects empty state path; responsive stack on mobile. *Done when:* typing filters the grid live, criterion + direction reorder visibly, clearing restores the default order, and filtered-empty shows only when a query matches nothing.
- [x] **Step 4 - Duplicate menu entry** - `ProjectMenu` gains Duplicate item; `HomePage` handler calls the op, refreshes, surfaces quota errors via the existing Snackbar path, closes the menu. *Done when:* Duplicate on a card creates `<name> (copy)` at the top of the grid, opens with identical node count in the editor, and a second duplicate yields `(copy 2)` without a name-conflict error.
- [x] **Step 5 - JSON export** - menu Export JSON item downloads the serialized file via Blob URL + `a[download]`; filename sanitized (lowercase, non-alphanumerics to `-`, fallback `mindmap`); projects containing upload blobs show a notice that uploaded image bytes are not included. *Done when:* clicking Export downloads `<name>-mindmap.json` whose parsed content validates (`version: 1`, project + nodes), and re-importing that file later reproduces the map.
- [x] **Step 6 - JSON import UI** - home header Import button + hidden file input (`.json,application/json`); reads text (rejects files over ~10 MB with a friendly error), runs `parseProjectImportPure`, resolves name conflict with `(imported)` numbering, writes project + remapped nodes atomically, clears the search query so the new card is visible, refreshes, shows inline errors for malformed/invalid files (`Not a valid mindmap file.` + reason) and quota failures; file-picker cancel is a no-op; clears the input value so the same file can be picked twice. *Done when:* valid export file imports as a new card at top with matching node count; malformed file shows an error and creates nothing; duplicate-name import auto-renames; cancelling the picker changes nothing.
- [x] **Step 7 - Browser round-trip + responsive polish** - extend `e2e/smoke.spec.ts` with one stable round-trip (small URL-media-only project, no uploaded bytes): duplicate via menu, search narrows to one card, export + import reproduces node count; verify 360px stacking of search/sort/import controls. *Done when:* `npm run verify` green and `npm run test:browser` passes with the new test.
- [x] **Repair F-01 - Import parser rejection coverage** - add throw-expecting cases to `src/lib/projectHome.test.ts` for a parent cycle, an unreachable node, and duplicate node ids (plus a duplicate-without-blob-store case clearing upload refs in `src/storage/operations.test.ts`). *Done when:* `npm test` passes with the new cases green.
- [x] **Repair F-02 - Clear upload ref when blob copy fails** - in `duplicateProjectAsync`, apply the missing-blob fallback (clear ref, revert media kind to note) when `saveBlob` rejects instead of leaving a dangling uploadId, with a unit test using a throwing blob store. *Done when:* `npm run verify` green and the new test proves the fallback.

## Files / areas

- `src/lib/projectHome.ts` (new) + `src/lib/projectHome.test.ts` (new) - pure naming, filter/sort, export/import shape.
- `src/storage/operations.ts` + `src/storage/operations.test.ts` - `duplicateProjectAsync`, import-write helper reusing the duplicate remap path.
- `src/pages/HomePage.tsx` + `src/pages/HomePage.css` - search/sort controls, import button + file input, duplicate/export/import handlers.
- `src/components/home/ProjectMenu.tsx` - Duplicate + Export JSON items.
- `src/components/home/ProjectGrid.tsx` (`ProjectCard.tsx` unchanged unless props demand it).
- `e2e/smoke.spec.ts` - one stable round-trip test (small project, no uploaded bytes).

## Data / contracts

- **Export schema (load-bearing, versioned):** `{ app: "mindmap", version: 1, project: { name, viewport }, nodes: [{ id, parentId, text, kind, url, media, mediaFill, size, side, collapsed }] }` where `id`/`parentId` are opaque file-local refs remapped to fresh IDs on import (never written raw to storage). Import requires exactly one root (`parentId: null`), every non-root `parentId` resolving inside the file, and a non-empty nodes array; unknown future `version > 1` is rejected with `Unsupported file version.` Import normalizes via existing `normalizeNodes`; legacy over-limit text displays as-is per item 8.
- **Uploads:** `media.uploadId` refs are stripped on export and on import (media node with a stripped upload reverts to `note` per `normalizeNodes`); duplicate is the only path that copies blob bytes. UI copy must say bytes stay local.
- **Naming:** duplicate uses `<name> (copy)` numbering truncated to `MAX_PROJECT_NAME_LENGTH` (40); import uses `<name> (imported)` numbering; both loop through `validateProjectNamePure` until unique. **(Load-bearing: same helpers serve editor-adjacent flows later.)**
- **Timestamps:** duplicate and import set fresh `createdAt`/`updatedAt` (`nowIso` / `bumpedIso`) so results sort newest-first; viewport-only saves still preserve `updatedAt` per existing rule.
- **Duplicate preserves:** collapsed flags, sides, kinds, sizes, URLs, URL media, and viewport; only IDs, timestamps, and the name change.
- No storage-key or IDB schema change.

## Testing

- `npm test` (Vitest): pure-helper tests (Step 1) plus op tests for duplicate remap/counts/naming/blob-copy and import remap/rename/strip-uploads (Steps 2/6). In-scope logic per `coding-standards.md` testing gate: naming, filter/sort, serialize/validate, ID remap.
- `npm run verify` (tests + typecheck + build) green before each checkpoint and before `/complete`.
- `npm run test:browser` (Playwright Chromium): one focused round-trip - create small project, duplicate via menu, search narrows to one card, export + import reproduces node count. Visual fidelity and touch behavior ride on direct Check/Try, not the harness.
- Manual `/check` per done-when: duplicate twice, search/clear/sort each mode, export-then-import, malformed file, name-collision import, quota-error path, mobile 360px stacking.

## Notes for the AI

- Client-only Vite SPA; follow `blueprint/context/coding-standards.md` (strict TS, no `any`, functional components, no gradients, no em dashes in generated content).
- Reuse `validateProjectNamePure`, `normalizeNodes`, `genId`, `nowIso`/`bumpedIso`, `mirrorToLocalStorage`; never hand-roll validators.
- Keep diffs reviewable: pure lib first, storage op second, UI in thin slices; do not silently add a test runner or CI - both exist (`npm test`, `npm run test:browser`, `npm run verify`).
- Accessibility: labelled search/sort/import controls, menu items keyboard-reachable, error text announced via the existing Snackbar/Alert path.

## Findings

### 16/F-01 [P2] closed - Import parser cycle/unreachable/duplicate-id rejections have no unit test

**File:** src/lib/projectHome.test.ts:1
**Found:** 2026-09-17 by /audit (scope: current; lens: tests)
**Why it matters:** `parseProjectImportPure` guards hostile or corrupt files with cycle detection, unreachable-node rejection, and duplicate-id rejection, but the suite only covered malformed JSON, version, empty nodes, dangling parent, two roots, and bad name.
**Suggested fix:** Add three small cases to `projectHome.test.ts`: a two-node parent cycle, a node unreachable from the root, and duplicated node ids, each expecting a throw.
**Resolution:** Repaired 2026-09-17 by /implement (duplicate-id, self-parent, and detached-cycle cases plus a duplicate-without-blob-store strip test). **Re-review:** Closed 2026-09-17 by /audit; full suite green (233 tests).

### 16/F-02 [P3] closed - Duplicate swallows blob-save failure, leaving a dangling upload ref

**File:** src/storage/operations.ts:192
**Found:** 2026-09-17 by /audit (scope: current; lens: quality)
**Why it matters:** If `saveBlob` failed during `duplicateProjectAsync`, the `.catch(() => undefined)` left the copied node pointing at a blob that was never stored.
**Suggested fix:** On save failure, apply the same fallback as the missing-blob path (clear the ref, revert media kind to note).
**Resolution:** Repaired 2026-09-17 by /implement (shared `clearUploadRef` helper plus a throwing-blob-store test). **Re-review:** Closed 2026-09-17 by /audit; verify green (233 tests + build).
