# Feature: 2 - Home projects management

**From build-plan:** feature 2
**Status:** verified

## Goal

Give the Home route (`/` / `/#/`) a real project manager: users can create, open, rename, and delete mind-map projects with unique-name validation and delete confirmation, see them sorted newest-first (by `updatedAt`), handle empty state, and have everything persist in `localStorage` so refresh restores state.

## Design reference

No `prototypes/` directory exists and no `blueprint/reference/` image was supplied. Design is anchored to the already-shipped shell:

- `src/index.css:4` tokens (`--bg #fbfaf7`, `--surface`, `--border`, `--text #0f172a`, `--muted #64748b`, `--accent #3b82f6`, `--radius*`, `--shadow*`) — cards/grid must reuse these, no new hex values.
- `src/components/layout/AppHeader.tsx:42` + `prototypes` lineage from feature 1 archive (`blueprint/history/features/01-app-shell-minimal-theme.md:12`) — header pattern with "New project" primary action.
- `src/theme/muiTheme.ts:4` — MUI palette already mapped to tokens; dialogs/cards/buttons stay in that theme (`radius-full` buttons, Inter typography, no gradients).
- `src/pages/HomePage.tsx:4` + `src/pages/HomePage.css:1` — current stub and wrap/title-row/grid tokens to reuse; layout max-width 960, 28px padding, responsive at 540/820.

No screenshot can pin more detail — prose spec here is sufficient for this non-replication feature. If a Figma/Canva reference appears later, store it in `blueprint/reference/` and link it.

## In scope

- **Data layer:** `Project` + `Node` types (per `project-overview.md` Data model), `localStorage` persistence for `Project[]` + `Node[]`, storage keys, JSON parse/stringify with corruption recovery, quota-exceeded and `localStorage` unavailable (`SecurityError` in private mode) error surfacing with in-memory fallback + `Alert` warning.
- **Project list UI:** grid/list of cards on `HomePage` sorted `updatedAt` descending (newest first), showing name + last-edited timestamp (relative or formatted) + overflow actions (Open/Rename/Delete). Replaces current placeholder `src/pages/HomePage.tsx:15`.
- **Create:** "New project" button (currently disabled stub in `AppHeader.tsx:65`) becomes enabled on Home; opens MUI Dialog with `TextField` for name. Validation inline: trimmed non-empty, max 40 chars, case-insensitive unique (`"A project with this name already exists."`). On success creates `Project` + root `Node` (text = project name, `parentId: null`, `collapsed: false`), `createdAt`/`updatedAt` ISO, `viewport {x:0, y:0, zoom:1}`, uuid `id`/`rootNodeId`.
- **Rename:** inline dialog flow from card overflow; same validation as create (excluding self), bumps `updatedAt`, optionally syncs root node `text` if it still equals old project name (best-effort convenience, not a migration).
- **Delete:** card overflow Delete -> MUI confirm dialog ("Delete 'X'? This will remove N nodes." — for feature 2, N=1 plus any future subtree count via live Node count per `projectId`). Confirms then atomically deletes `Project` + its `Node`s (cascade by `projectId`). Empty-state fallback after last delete.
- **Empty state:** centered illustration/text + "New project" CTA when `Project[]` is empty.
- **Routing:** clicking Open/card navigates to `/#/project/:projectId` (`App.tsx:16`); unknown `projectId` handling deferred to Editor but Home must generate valid uuid ids.
- **Persistence guarantees:** reload restores list/sort/order; `updatedAt` drives sort; `localStorage` write on every mutation with try/catch.
- **Responsive/touch:** grid collapses to single column at 540px (matches `HomePage.css:28`), large touch targets (>=44px), keyboard focus visible.

## Out of scope

- Tree canvas, auto-layout, nodes, pan/zoom — feature 3.
- Plus buttons, inline node edit, char-limit enforcement for nodes — feature 4.
- Context menu Edit/Delete/Collapse, collapsed persistence, layout reflow — feature 5.
- PNG export — feature 6.
- GitHub Pages deploy polish, SPA 404 fallback switch, duplicate/search/filter/sort beyond newest-first, JSON import/export, lastEdited polish beyond Home card display, dark mode, a11y beyond basic labels/focus — deferred (features 7, 11, 13).
- Cloud sync/auth/share — post-MVP (feature 12).
- Test runner / Verify / browser harness — separate `/tests`, `/ci`, `/browser-tests` (no runner today per `AGENTS.md` Commands).
- Switching `localStorage` to `IndexedDB` — locked to `localStorage` in this feature; migration deferred. Corruption recovery is reset-with-warning, not IndexedDB fallback.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on. Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

Small, reviewable units. Each ends with something working. `/implement` checks these off as it finishes them, so progress survives a context clear.

- [x] **Step 1 — Types + storage service (pure logic, no UI yet)** — create `src/types/project.ts` + `src/types/node.ts` matching `project-overview.md:37` / `project-overview.md:48` (Project: `id, name, rootNodeId, createdAt, updatedAt, viewport{x,y,zoom}`; Node: `id, projectId, parentId, text, collapsed, createdAt, updatedAt`). Add `src/lib/storage.ts` (or `src/services/storage.ts` per `coding-standards.md` File Organization) with constants/keys (`mindmap:projects` + `mindmap:nodes` or single `mindmap:store` — pick one and document), helpers: `loadProjects()`, `loadNodes()`, `saveProjects()`, `saveNodes()`, `getProjectsSortedByUpdatedAt()`, `isNameUnique(name, excludeId?)`, `createProject(name)`, `renameProject(id, newName)`, `deleteProject(id)` (cascade deletes nodes), plus `parseOrFallback` corruption handling (try/catch, reset corrupt key with console warn), `localStorage` unavailable handling (wrap `getItem`/`setItem` in try/catch for `SecurityError`/`Access denied`, fall back to in-memory store and surface `isStorageAvailable: false`), and quota handling (catch `QuotaExceededError`/`NS_ERROR_DOM_QUOTA_REACHED`, surface via returned `{error: string}` or thrown typed error — caller displays). Add `validateProjectName(name, excludeId?)` pure validator: trimmed, non-empty (`"Name is required."`), max 40 (`"Name must be 40 characters or less."`), case-insensitive unique (`"A project with this name already exists."`). Export types/helpers, no UI. Keep functions <50 lines. *Done when:* `npm run build` + `npm run lint` pass, manual `node`/`vite` smoke: `createProject('Alpha')` creates Project+root Node in `localStorage`, second `createProject('alpha')` is rejected as duplicate, `loadProjects()` survives corrupted JSON (clears key, returns `[]`), `localStorage` blocked (mock `getItem` throwing `SecurityError`) falls back to in-memory with warning flag, and storage helpers are imported by no page yet so Home still shows placeholder.*

- [x] **Step 2 — Home project grid, empty state, and sort** — replace `HomePage.tsx` placeholder with real list: load projects via storage service on mount, render empty state (icon + "No projects yet" + "Create your first project" CTA) when `[]`, otherwise MUI `Card`/`Grid` (or plain div grid reusing `HomePage.css`) sorted newest-first by `updatedAt` descending, each card showing `name`, formatted `updatedAt` (e.g. `toLocaleDateString` or relative "Edited 2m ago"), and overflow `IconButton` menu (Open/Rename/Delete). Wire "New project" button in `AppHeader.tsx:65` (or duplicate CTA in title-row) to be enabled only on Home; keep dialog stub for now (click is no-op or opens placeholder). Ensure `max-width 960` wrap and responsive single-column at 540px still holds. *Done when:* `npm run dev` at `/#/` with 0 projects shows empty state with CTA; after seeding two projects (via devtools `localStorage` or Step 1 helper) cards appear sorted newest first, renaming in storage re-sorts, card layout matches shell spacing within 2px, cards are keyboard-focusable, and `npm run build` + `npm run lint` pass.*

- [x] **Step 3 — Create project dialog with validation** — add MUI `Dialog` + `TextField` + counter (`0/40`) on Home for "New project". Wire to `validateProjectName` live (trimmed check, max 40, case-insensitive unique via storage). Show inline `helperText` error, disable Create until valid, `Enter` submits, `Escape` cancels. On success: `createProject(name)` (creates root Node), bumps list, closes dialog, clears input. Auto-focus input on open. Handle `QuotaExceededError` from storage: show `Snackbar`/`Alert` ("Storage full — delete a project or clear data"). Do not navigate on create in this step (navigation deferred to Step 5 for isolation). *Done when:* clicking "New project" opens dialog with focused input and `0/40`; typing `aaa` (duplicate of existing) shows "A project with this name already exists." inline; `40+` chars blocked with counter red + helper; trimming `"  Foo  "` creates `"Foo"`; `localStorage` inspection shows new Project + root Node with matching `projectId`/`rootNodeId` and ISO timestamps; refresh persists; `npm run build` + `npm run lint` pass.*

- [x] **Step 4 — Rename + delete (with confirm)** — add Rename dialog (same validation as Step 3, excluding self, pre-filled trimmed name, `Enter`/`Escape` semantics, `updatedAt` bump on success, empty-after-edit keeps previous value and shows validation) and Delete confirm dialog on each card's overflow: `Dialog` with `"Delete '«name»'? This will remove N node(s)."` where `N = nodes.filter(n => n.projectId===project.id).length` (1 for MVP), Cancel/Delete buttons, Delete is `color="error"` with focus trap, irreversible warning. Wire Rename/Delete to storage helpers and refresh sorted list in place. Root-delete nuance: deleting a project is the only way to delete its root (blocker for Editor handled later). Handle storage quota/error on rename/delete with inline `Snackbar`. *Done when:* Rename to duplicate (case-insensitive, other project's name) is rejected; rename to same name with different case differing only for self is allowed? No — self-excluded so same id with case tweak is allowed only if no other project collides; rename to `""` or whitespace is rejected; Delete cancel leaves data; Delete confirm removes project + its nodes from `localStorage`, list re-renders, empty-state returns when last project deleted, and list stays sorted by bumped `updatedAt`; `npm run build` + `npm run lint` pass.*

- [x] **Step 5 — Navigation, polish, and error hardening** — wire Open (card click + overflow Open) to `navigate(\`/project/${id}\`)` (hash route `/#/project/:projectId` per `App.tsx:16`), keep create-list-only for testability (no auto-navigate on create in MVP). Add `lastEdited` polish (consistent `toLocaleDateString` vs `HomePage.tsx:12` subtitle "Local to this browser · sorted newest first" — keep subtitle, drop `AppHeader` stub `"localStorage · stub"` or replace with real count), empty-state CTA reuse of same create dialog, keyboard `Tab`/`Enter`/`Escape` coverage and `aria-label`s on overflow menus/dialogs. Harden `loadProjects/loadNodes` with `try/catch` + graceful fallback UI (empty list + `Alert` "Stored data was corrupted and was reset." and second `Alert` "Storage unavailable — changes won't persist after reload" when `localStorage` blocked). `window.addEventListener('storage')` is out-of-scope (reloading restores). Verify all mutations persist across hard reload and viewport key does not break schema evolution. *Done when:* clicking a project card navigates to `/#/project/<uuid>` and `EditorPage` shows `projectId`; hard reload on Home retains sort/order; hard reload on Editor deep-link with unknown id still lands without crash (Editor placeholder); corrupted `localStorage` key (manual `localStorage.setItem('mindmap:projects','{bad')`) recovers to empty state with warning `Alert`; `localStorage` blocked shows unavailable `Alert` but app stays usable in-memory; `npm run build` + `npm run lint` pass; manual smoke of full flow (empty → create → rename → delete → create 2 → verify sort) passes without console errors; overflow menus and dialogs are reachable by keyboard and have discernible names.*

- [x] **Repair F-01 — Avoid repeated localStorage parse on every keystroke** — refactor `validateProjectName`/`isNameUnique` to pure over in-state arrays and memoize node count for delete dialog; remove JSX-time `loadProjects`/`getNodeCountForProject` calls.
- [x] **Repair F-03 — Remove dead export hadCorruptedData** — keep single corruption contract `consumeCorruptionFlag`.

## Files / areas

- `src/types/project.ts` (new) — `Project` + `Viewport` interfaces
- `src/types/node.ts` (new) — `Node` interface
- `src/lib/storage.ts` or `src/services/storage.ts` (new) — load/save/CRUD + validation + keys + error mapping (pick one path per `coding-standards.md` File Organization, delete the empty placeholder folder)
- `src/pages/HomePage.tsx` — replace placeholder with real manager
- `src/pages/HomePage.css` — extend for grid/cards/empty-state (reuse tokens)
- `src/components/layout/AppHeader.tsx` — enable "New project" on Home, stub subtitle update
- `src/components/home/*` (optional) — `ProjectCard.tsx`, `ProjectGrid.tsx`, `CreateProjectDialog.tsx`, `ConfirmDeleteDialog.tsx` if splitting Home keeps each <50 lines; otherwise keep in `HomePage.tsx` with extracted components
- `src/lib/validate.ts` or co-located in `storage.ts` — `validateProjectName` pure helper (flag if split out)
- `vite.config.ts`, `src/theme/muiTheme.ts`, `src/index.css` — no changes expected (read-only reference)
- `public/icons.svg`, `public/favicon.svg` — read-only if empty-state borrows icons

## Data / contracts

Client-only (`localStorage`), no server. **Load-bearing for all later features — lock now:**

- `Project { id: string (uuid v4), name: string (trimmed, non-empty, max 40, unique case-insensitive), rootNodeId: string (FK Node.id), createdAt: string (ISO-8601), updatedAt: string (ISO-8601), viewport: { x: number, y: number, zoom: number } }`
- `Node { id: string (uuid v4), projectId: string (FK Project.id, cascade delete), parentId: string | null (null only for root), text: string (trimmed, non-empty, max 50 — enforced feature 4), collapsed: boolean (default false), createdAt: string (ISO-8601), updatedAt: string (ISO-8601) }`
- Storage shape: `localStorage["mindmap:projects"] = JSON.stringify(Project[])`, `localStorage["mindmap:nodes"] = JSON.stringify(Node[])` — alternative single key `mindmap:store = {projects, nodes}` is acceptable if chosen consistently; document choice in `storage.ts` header comment.
- Route contract (locked feature 1): `/#/project/:projectId` where `:projectId` is `Project.id` (uuid). Home list generates ids via `crypto.randomUUID()` with fallback `uuid()` helper.
- Validation contract: `validateProjectName(raw: string, excludeId?: string) => string | null` returns error message or null if valid; case-insensitive comparison uses `name.trim().toLowerCase()`.
- `updatedAt` drives Home sort: `[...projects].sort((a,b)=> Date.parse(b.updatedAt)-Date.parse(a.updatedAt))`, bumped on create/rename/delete (and future node edits/viewport per overview).
- Corruption contract: `loadProjects()`/`loadNodes()` catch `SyntaxError`, clear the offending key, return `[]`, and caller surfaces a transient warning; quota errors throw/are returned as `StorageError` with user message.

## Testing

No `test` / `Verify` / `Browser tests` command in `AGENTS.md:192` — gate is `npm run build` + `npm run lint` + browser evidence, per `coding-standards.md:100` opt-in rule. Do not install a runner mid-feature; `/tests` owns that.

- **In-scope pure logic for future Vitest coverage (when runner exists):** `validateProjectName` (empty/whitespace, >40, duplicate case-insensitive, trimmed, self-exclude on rename), `isNameUnique`, `getProjectsSortedByUpdatedAt` (stable newest-first, tie-breaker `createdAt`), `createProject` (uuid + root Node link + ISO timestamps), `deleteProject` cascade, corrupted-JSON fallback. Steps 1–4 must be written to be easily unit-testable (pure fns, no JSX) so `/tests` can add `*.test.ts` without refactor.
- **Verification per step is the done-when above, observed via:**
  - `npm run build` + `npm run lint` after every step (zero errors)
  - `npm run dev` at `http://localhost:5173/#/` visual checks: empty state, grid sort, dialogs, inline errors, confirm count
  - `localStorage` inspection in devtools (`Application > Local Storage`) for Project/Node shapes after each mutation
  - Hard reload checks for persistence and corruption recovery
  - Error paths: `QuotaExceededError` simulated by mocking `setItem` to throw, and bad JSON injection
  - If a `test` command appears before `/implement`, add minimal pure-logic tests for validators/sort (building Step 1 co-located `storage.test.ts` pattern per standards) — no component/render tests per "What not to test."

## Notes for the AI

- **Client-only:** Vite SPA, `localStorage` only, no server actions. Use `crypto.randomUUID()` (fallback `Date.now`+rand if unavailable) for ids. Respect React Compiler — no manual `useMemo`/`useCallback` unless measured.
- **Standards:** Functional components, strict TS, no `any`, PascalCase components, `src/components/[feature]/ComponentName.tsx` or `src/pages/` per `coding-standards.md:32`; hooks for state; comments only for why. MUI dialogs use `ThemeProvider` from `src/theme/muiTheme.ts:3`.
- **Validation UX:** Inline `helperText` + `error` on `TextField`, counter `value.length/40`, `Create/Rename` button disabled when invalid; `Delete` confirm uses `color="error"` + focus-trap + explicit node count — never delete without confirm.
- **Load-bearing:** Do not invent a competing `Project` shape — match `project-overview.md:37` exactly. `rootNodeId` must point to a real `Node` (feature 3 renders it). `viewport` persists per project even though Editor doesn't use it yet — seed `{x:0,y:0,zoom:1}`.
- **Empty `src/types/` and `src/services/`:** those folders exist empty (`glob src/**/*:10`) — create `src/types/*.ts` there and consolidate `src/services` vs `src/lib` (prefer `src/lib/storage.ts` per standards, remove or leave empty `services` with README, don't have two storage modules).
- **Scope discipline:** Do not build canvas, layout math, plus buttons, or PNG export stub here — header Fit/Re-center/Export buttons stay disabled until features 3/6 wire them.
- **Edge cases:** duplicate rename excluded self, whitespace-only rejected, max 40 enforced live, corruption fallback, quota alert, delete last project → empty state, unknown `projectId` deep link must not crash (Editor placeholder suffices for now).

## Findings

### 2/F-01 [P2] closed - Repeated localStorage parse on every keystroke

**File:** src/lib/storage.ts:147, src/pages/HomePage.tsx:58
**Found:** 2026-09-02 by /audit (scope: current; lens: performance, quality)
**Why it matters:** `validateProjectName` calls `loadProjects()` which does `localStorage.getItem` + `JSON.parse` on every render. On Home, this runs on every keystroke for both create and rename drafts (`HomePage.tsx:58-63`). `getNodeCountForProject` called inline in `DialogContentText` also reparses nodes each render. For 10-15 projects this is small, but it violates the fix-once pattern and will scale to jank on larger maps or low-end phones, and it duplicates parsing that a memoized projects state already holds.
**Suggested fix:** Pass the in-state `projects`/`nodes` arrays into pure validators (e.g. `validateProjectName(raw, projects, excludeId)`) or memoize `loadProjects` result. Call `getNodeCountForProject` once when `deleteTarget` is set, not inside JSX.
**Resolution:** Fixed 2026-09-02 — added `isNameUniquePure`/`validateProjectNamePure`/`getNodeCountForProjectPure` in `storage.ts`, wired `HomePage` live validation to `validateProjectNamePure(draft, projects)` (no storage I/O per keystroke), and memoized delete count via `openDelete()` → `deleteNodeCount` state. Re-audited 2026-09-02: `HomePage.tsx:59` now uses `validateProjectNamePure(draft, projects)`, `HomePage.tsx:64` uses pure with `excludeId`, `HomePage.tsx:149` memoizes count, `storage.ts:147` pure helpers present — defect confirmed gone, no new defect introduced. Closed.

### 2/F-03 [P3] closed - Dead export hadCorruptedData

**File:** src/lib/storage.ts:101
**Found:** 2026-09-02 by /audit (scope: current; lens: quality)
**Why it matters:** `hadCorruptedData()` is exported but never imported; `HomePage` uses `consumeCorruptionFlag()` exclusively. Dead export adds API surface and lint noise, and suggests the corruption-contract has two entry points.
**Suggested fix:** Remove `hadCorruptedData` or re-export it only if a second caller needs a peek without consuming. Keep `consumeCorruptionFlag` as the single contract.
**Resolution:** Fixed 2026-09-02 — removed `hadCorruptedData` export. Re-audited 2026-09-02: `storage.ts` exports only `consumeCorruptionFlag` (line 101), grep shows no `hadCorruptedData` — defect confirmed gone. Closed.
