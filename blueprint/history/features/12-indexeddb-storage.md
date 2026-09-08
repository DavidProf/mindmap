# Feature: IndexedDB storage

**From build-plan:** feature 12
**Status:** verified

## Goal

Move persistence from `localStorage`-only to IndexedDB-primary with `localStorage` fallback, so maps survive larger trees and quota pressure while WebViews without IndexedDB keep working with a clear warning.

Why it matters: `localStorage` is synchronous, small (~5MB), and blocks the main thread. IndexedDB is the browser-native async store for local-only data with no backend change.

## In scope

- IndexedDB database `mindmap` v1 with stores `projects` (keyPath `id`) and `nodes` (keyPath `id`, index `by-project` on `projectId`).
- Zero new runtime dependencies. Small promise wrapper around raw IndexedDB in `src/lib/`.
- One-time idempotent migration: if IDB stores are empty but `mindmap:projects` / `mindmap:nodes` exist in `localStorage`, copy them into IDB on boot. Leave the `localStorage` copy in place as the fallback seed.
- Backend selection: IndexedDB primary; `localStorage` fallback when `indexedDB` is undefined or open fails (notably mobile-framework WebViews); in-memory + warning when neither is writable (today's `isStorageAvailable() === false` path).
- Async conversion of all persistence callers: `HomePage`, `EditorPage` (+ `EditorCanvas`), `useViewport`. Loading states that preserve current placeholders (empty state, project-not-found, empty-map).
- Preserve all business rules: unique project name, 30-char node limit, subtree delete atomicity, collapse + viewport persistence, newest-first sort, viewport-only saves do not bump `updatedAt`.
- Preserve/unify warnings: storage-unavailable banner, corruption-reset notice, quota-full error (`Storage full — delete a project or clear data.`).
- Unit tests for migration + backend selection + async CRUD parity; browser smoke for real IDB read/write/reload.

## Out of scope

- Schema change to `Project` / `Node` types. No new fields, no order field, no server, no sync, no auth.
- Cloud sync, share links, multi-device merge (features 21-22).
- Undo/redo, JSON import/export, search/sort UI (features 15-16).
- Changing PNG export, layout, theming, or routing.
- Deleting the `localStorage` copy after migration (kept intentionally as fallback seed; cleanup is a later decision).
- Adding a generic ORM or `idb` / `dexie` dependency.

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

- [x] **Step 1 - Backend interface + migration pure helpers** - add `src/lib/storageBackend.ts` (or `src/lib/idb.ts` if preferred) with a `StorageBackend { loadProjects, loadNodes, saveProjects, saveNodes, isPersistent }` interface plus pure helpers: `shouldMigrate(idbProjects, idbNodes, lsProjects, lsNodes): boolean` and `mergeForMigration` (IDB empty + LS non-empty = copy LS; otherwise keep IDB). Re-export the existing sync `localStorage` backend behind the interface with zero behavior change. No UI wiring. *Done when:* `npm run verify` passes; new unit test proves: empty-IDB + populated-LS = migrate, populated-IDB = no overwrite, both empty = no-op, corrupt LS source = treated as empty (no crash).
- [x] **Step 2 - IndexedDB backend (unwired)** - implement `createIndexedDbBackend()` with open/upgrade (v1, stores + index), promise-wrapped transactions, per-store getAll/put-all (read-all + write-all to match current whole-list save pattern), open-failure rejection with name preserved (`QuotaExceededError`, `SecurityError`, etc.). Export `isIndexedDbSupported(): boolean` (`typeof indexedDB !== "undefined"`). Not yet wired into `storage.ts` callers, so the app still runs on `localStorage`. *Done when:* `npm run verify` passes; unit test with an in-memory fake of the backend interface proves put-all/get-all round-trips projects + nodes with `projectId` index filtering; real-browser check deferred to Step 6.
- [x] **Step 3 - Selector + one-time migration (pages still on sync LS)** - add `initStorage(): Promise<{ backend, migrated: boolean, fallback: "indexeddb" | "localstorage" | "memory" }>` plus the new async API (`loadProjectsAsync`, `saveProjectsAsync`, etc. or `*Async` suffix, final naming locked in this step) alongside the existing sync exports. `initStorage` tries IDB open, runs the Step-1 migration once (single-flight shared promise for StrictMode double-invoke), falls back to LS backend on unsupported/open-failure and to memory when neither is writable. Pages are not converted yet, so the app still runs exactly as before. *Done when:* unit test proves single-flight init (two concurrent `initStorage()` = one migration write); cold load with seeded LS + empty IDB migrates once and a second init does not duplicate; stubbing `indexedDB` undefined resolves to `localstorage` fallback with identical data; `npm run verify` passes with zero page changes.
- [x] **Step 4 - HomePage async conversion** - convert `HomePage` to `initStorage()` on mount with `loading` state (skeleton or existing empty-state shell, no flash of wrong list), then async `loadProjects` / `create` / `rename` / `delete` / `getNodeCount` through the selected backend. Keep validation sync via `validateProjectNamePure`. Preserve: newest-first sort, inline unique-name error, delete confirm with count, corruption + storage-unavailable banners (banner now also shows when `fallback !== "indexeddb"` with text `Using local fallback storage — ...`), quota Snackbar. *Done when:* home creates/renames/deletes with reload persistence; blocking IDB shows the fallback banner and still persists via `localStorage`; `npm run verify` + `npm run test:browser` pass.
- [x] **Step 5 - EditorPage async conversion (viewport stubbed sync)** - convert `EditorCanvas` node CRUD (`addChildNode`, `updateNodeText`, `setNodeCollapsed`, `deleteNodeSubtree`) to the Step-3 async API. Add canvas loading state (preserve `Project not found` and `Empty map` placeholders; no interaction before load). Keep: collapsed auto-expand on add, root-delete block, strictly-increasing `updatedAt` bumps. Viewport stays on the sync path in this step (converted next). *Done when:* editor add/edit/collapse/delete survive reload; unknown-id and empty-map placeholders intact; content edits still reorder home newest-first; `npm run verify` + `npm run test:browser` pass.
- [x] **Step 6 - useViewport async conversion** - convert `useViewport` (`getViewport` / `setViewport`) to async through the selected backend with initial-load fallback to `DEFAULT_VIEWPORT`. Keep debounce/commit behavior for pan/zoom/re-center and the rule that viewport-only saves do not bump `Project.updatedAt`. *Done when:* pan/zoom/re-center persist across reload; rapid wheel/pinch bursts commit once without error; viewport-only moves do not reorder home; `npm run verify` + `npm run test:browser` pass.
- [x] **Step 7 - Warnings, quota, and evidence hardening** - unify the three surfaces: (a) fallback banner on Home + Editor when on `localStorage`/`memory`, (b) `Storage full` error on `QuotaExceededError` from either backend without losing typed text, (c) corruption-reset notice preserved for the LS source path. Add/extend `e2e` smoke: seed via UI, reload, assert nodes persist (real IDB path); second case with IDB disabled asserts fallback banner + LS persistence. *Done when:* manual pass: normal reload persists, private/WebView-like (IDB blocked) shows fallback warning and still persists via LS, quota error shows Snackbar/banner without data loss; `npm run verify` + `npm run test:browser` green.
- [x] **Step 8 - Storage folder reorg (pure move, no logic)** - move the five storage modules plus tests from `src/lib/` to `src/storage/` with role names (`storage.ts` → `localStore.ts`, `storageBackend.ts` → `backend.ts`, `idb.ts` → `indexedDb.ts`, `storageInit.ts` → `init.ts`, `storageAsync.ts` → `operations.ts`; tests renamed to match and moved alongside). Update all import paths (pages, canvas, dialogs, `zoom.ts`, storage modules + tests). No logic, behavior, or export-name changes. *Done when:* `git status` shows renames only; `npm run lint` clean; `npm run verify` green; `npm run test:browser` green.
- [x] **Repair F-01a - strengthen async parity coverage** - extend `operations.test.ts` to cover every behavior the old sync tests assert that it does not yet: root text + parent linkage on create, strict `>` monotonicity across rapid writes, project bump on subtree delete, `createdAt` tiebreak in newest-first sort, corrupt-viewport fallback, quota rethrow through the LS backend. No product change. *Done when:* `npm run verify` passes with the new assertions green.
- [x] **Repair F-01b - rework localStore tests, drop mutation file** - rewrite `localStore.test.ts` to cover only what remains in `localStore.ts` (validators, pure helpers, clamp, primitives, corruption recovery, quota rethrow on the sync save path); delete `localStore.mutation.test.ts` whose CRUD coverage now lives in `operations.test.ts`. No product change. *Done when:* `npm run verify` passes; grep shows no test imports the sync domain ops.
- [x] **Repair F-01c - cut dead sync domain ops** - delete the prod-unreachable sync ops from `localStore.ts` (`getProjectsSortedByUpdatedAt`, `isNameUnique`, `validateProjectName`, `createProject`, `renameProject`, `deleteProject`, `getNodeCountForProject`, `addChildNode`, `updateNodeText`, `setNodeCollapsed`, `deleteNodeSubtree`, `getViewport`, `setViewport`) plus newly-unused imports. Mark F-01 `fixed`. *Done when:* `npm run lint` clean; `npm run verify` + `npm run test:browser` green.
- [x] **Repair F-02 - verify migration writes with retry** - make `runMigration` re-read both stores after saving and confirm counts match; on mismatch or throw, best-effort clear both IDB stores and rethrow so the next boot retries instead of stranding a partial migration. Add init tests for verified success and for partial-failure retry. Mark F-02 `fixed`. *Done when:* `npm run verify` passes with the new cases green.
- [x] **Repair F-03/F-04 - drop unused helpers, unify discriminant** - delete the uncalled `loadProjectsAsync`/`loadNodesAsync`/`saveProjectsAsync`/`saveNodesAsync` from `init.ts` and `parseJsonArray` from `backend.ts` (+ their tests); alias `StorageFallback` to the single union in `backend.ts`. Mark F-03, F-04 `fixed`. *Done when:* `npm run lint` clean; `npm run verify` green.
- [x] **Repair F-05 - cache the IndexedDB connection** - hold one shared open promise per backend instance in `createIndexedDbBackend` instead of opening per operation; add a call-count test proving one open serves many ops. Mark F-05 `fixed`. *Done when:* `npm run verify` passes with the new test green.
- [x] **Repair F-06 - seed viewport before first paint** - load the viewport alongside nodes in `EditorCanvas`, pass it as `initialViewport` through `TreeCanvas` into `useViewport` (which uses it as initial state and skips the redundant fetch). Mark F-06 `fixed`. *Done when:* `npm run verify` + `npm run test:browser` green; editor opens directly at the saved view.

## Files / areas

- `src/lib/storage.ts` - current sync `localStorage` layer; becomes fallback implementation + keeps all pure validators (`validateProjectNamePure`, `validateNodeTextPure`, `isNameUniquePure`, `getSubtreeIdsPure`, `countSubtreeNodesPure`, `getSubtreeCountsPure`, `clampZoom`) sync and unchanged.
- `src/lib/storageBackend.ts` (new) - backend interface + `localStorage` adapter + migration pure helpers.
- `src/lib/idb.ts` (new, or folded into backend file if small) - IndexedDB open/upgrade + promise wrapper + IDB backend.
- `src/lib/storage.*.test.ts` - extend existing `storage.test.ts` / `storage.mutation.test.ts`; add `storageBackend.test.ts` + `idb` round-trip test (in-memory fake; no real IDB in Vitest unless a dev-only fake is justified).
- `src/pages/HomePage.tsx` - async init + loading + fallback banner.
- `src/pages/EditorPage.tsx` - async node CRUD + loading state.
- `src/components/canvas/useViewport.ts` - async viewport load/commit.
- `e2e/smoke.spec.ts` - extend with IDB persistence + fallback cases.
- No changes to `src/lib/layout.ts`, `src/lib/exportPng.ts`, theme, router, or deploy workflow.

(Note: during Step 8 the modules moved to `src/storage/` as `localStore.ts`, `backend.ts`, `indexedDb.ts`, `init.ts`, `operations.ts`; dead sync ops were later removed from `localStore.ts` by repair F-01c.)

## Data / contracts

Load-bearing, unchanged shapes (no migration of fields):

- `Project { id, name, rootNodeId, createdAt, updatedAt, viewport: { x, y, zoom } }` - `viewport` persisted, restored on open; viewport-only saves must not bump `updatedAt`.
- `Node { id, projectId, parentId: string | null, text (max 30), side: NodeSide | null, collapsed, createdAt, updatedAt }` - strict tree via `parentId`, sibling order = insertion order, no order field.
- Storage keys (fallback path): `mindmap:projects` + `mindmap:nodes` - unchanged.
- New IDB contract (locked here):
  - DB `mindmap`, version `1`; stores `projects` (keyPath `id`), `nodes` (keyPath `id`, index `by-project` on `projectId`).
  - Whole-list read/write parity with today (`loadProjects` returns `Project[]`, `saveProjects` replaces all) to keep the diff reviewable; per-record writes are a later optimization, not this feature.
  - Async signatures locked here: the Step-3 async API mirrors today's sync names (`loadProjects`, `loadNodes`, `saveProjects`, `saveNodes`, `createProject`, `renameProject`, `deleteProject`, `getNodeCountForProject`, `addChildNode`, `updateNodeText`, `setNodeCollapsed`, `deleteNodeSubtree`, `getViewport`, `setViewport`) but returns `Promise<...>`; pure validators and `clampZoom` stay sync. Final export naming (`*Async` suffix vs async-only rename) is locked in Step 3 and applied in Steps 4-6.
  - `initStorage()` single-flight promise; `shouldMigrate` = IDB both-stores empty AND LS source has at least one valid record; corrupt LS JSON = empty source, never throws.
- Backend discriminant for UI: `"indexeddb" | "localstorage" | "memory"` - surfaced only for the warning banner, not stored.

## Testing

- `npm test` (Vitest, single run) must be green before any step approval, checkpoint, or `/complete`. Each logic-bearing step ships its test in the same diff.
- In-scope logic for unit tests: `shouldMigrate` matrix (empty/filled/corrupt × IDB/LS), backend selector (IDB ok / IDB blocked / LS unwritable), async CRUD parity (create/rename/delete/add/edit/collapse/viewport bumps + sort order), corruption-flag consumption on the LS source path.
- What is not unit-tested: React components, canvas rendering, actual IndexedDB durability (proven by browser evidence instead, per `coding-standards.md`).
- Browser evidence: `npm run test:browser` (Playwright Chromium smoke via `e2e/smoke.spec.ts`) extended in Step 6 for real-IDB persist-across-reload + IDB-blocked fallback banner. Remaining UI claims (loading shimmer, banner copy) ride on direct browser screenshots + `npm run verify` (`tests + typecheck + build`).
- Manual `/check` + `/try` path per step done-whens above; quota/unavailable paths verified by blocking IDB or forcing `QuotaExceededError` in devtools.

## Notes for the AI

- Client-only Vite SPA. No server, no auth, no env secrets. Do not add runtime deps (`idb`, `dexie`) without asking; raw IDB + ~100-line wrapper keeps the bundle minimal per project direction.
- React Compiler is enabled. No manual `useMemo`/`useCallback` unless measured. Async state: guard against set-state-after-unmount and double-init in StrictMode (single-flight `initStorage()` promise).
- TypeScript strict + `verbatimModuleSyntax` + `noUnusedLocals` + `erasableSyntaxOnly`. No `any`. Keep pure helpers JSX-free and importable for tests.
- Concurrency: IDB transactions are short-lived; implement read-all/write-all inside one transaction per save to avoid interleaved-write loss. Last-write-wins is acceptable (single-tab assumption, as today).
- Do not silently upgrade the DB version or change stores mid-feature; v1 is locked in this spec.
- Preserve existing error strings where UX depends on them (`A project with this name already exists.`, `Text is required.`, `Cannot delete the root node.`, `Storage full — delete a project or clear data.`).
- Formatting: concise scannable markdown per `ai-interaction.md`. Small diffs per step; show diff, not full files, at review.

## Findings

### 12/F-01 [P2] closed - Sync domain ops in localStore.ts duplicated by operations.ts, unreachable from production UI

**File:** src/storage/localStore.ts
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** A repo-wide grep confirms zero production callers: every `.tsx` file uses the `*Async` ops in `src/storage/operations.ts`; only the old test files called the sync versions. Two full implementations of the same business rules will drift the next time one of them is fixed.
**Suggested fix:** Delete the dead sync domain ops and repoint tests at the async ops.
**Resolution:** Fixed by repairs F-01a/b/c and closed by /audit re-review: 13 dead sync ops plus `isValidViewport` removed; parity coverage in `operations.test.ts`; mutation test file deleted. No new defect from the repair.

### 12/F-02 [P2] closed - Migration writes projects then nodes without verification or retry

**File:** src/storage/init.ts:58 (`runMigration`)
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** If the second of the two separate-transaction saves fails, IndexedDB holds projects without nodes and the next boot never retries, hiding nodes despite an intact `localStorage` copy.
**Suggested fix:** Re-read both stores and confirm counts; on mismatch or throw, clear both IDB stores and rethrow so the next boot retries.
**Resolution:** Fixed and closed by /audit re-review: count verification with best-effort clear plus rethrow; rollback-with-retry and mismatch tests green. No new defect from the repair.

### 12/F-03 [P3] closed - Async load/save primitives and parseJsonArray have no production callers

**File:** src/storage/init.ts; src/storage/backend.ts
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** Nothing imports these outside their own test files; small speculative surface future readers must account for.
**Suggested fix:** Delete the helpers and their tests.
**Resolution:** Fixed and closed by /audit re-review: primitives, `parseJsonArray`, and the parse suite removed; no dangling references. No new defect from the repair.

### 12/F-04 [P3] closed - Duplicate backend discriminant unions StorageBackendKind vs StorageFallback

**File:** src/storage/backend.ts; src/storage/init.ts
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** Two identical unions under different names will drift on the next backend addition.
**Suggested fix:** Define the union once and import it.
**Resolution:** Fixed and closed by /audit re-review: `StorageFallback` aliases `StorageBackendKind`; page imports unchanged. No new defect from the repair.

### 12/F-05 [P3] closed - IndexedDB connection opened per operation and never closed

**File:** src/storage/indexedDb.ts (`createIndexedDbBackend`)
**Found:** 2026-09-08 by /audit (scope: current; lens: performance)
**Why it matters:** Every load/save did an open round trip (3-4 per node op) and handles accumulated for the session.
**Suggested fix:** Cache one shared open promise per backend instance.
**Resolution:** Fixed and closed by /audit re-review: shared promise with failure-reset; share and retry tests green. No new defect from the repair.

### 12/F-06 [P3] closed - Editor canvas first paints at the default viewport before the saved one loads

**File:** src/components/canvas/useViewport.ts; src/pages/EditorPage.tsx; src/components/canvas/TreeCanvas.tsx
**Found:** 2026-09-08 by /audit (scope: current; lens: quality)
**Why it matters:** First paint was always origin/100% then jumped to the saved viewport once the IDB read landed.
**Suggested fix:** Gate first paint on the loaded viewport via the existing loading placeholder.
**Resolution:** Fixed and closed by /audit re-review: viewport loads alongside nodes, `initialViewport` seeds the hook, dead self-load effect removed; browser 9/9 green. No new defect from the repair.
