# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-02 [P3] fixed - Oversized HomePage bundles 4 dialogs and grid in one file

**File:** src/pages/HomePage.tsx:1
**Found:** 2026-09-02 by /audit (scope: current; lens: quality)
**Why it matters:** `HomePage.tsx` is 393 lines combining grid, empty state, create/rename/delete dialogs, menu, and navigation. `coding-standards.md` prefers one job per component and `src/components/[feature]/ComponentName.tsx`. The file is hard to review in one sitting and duplicates button `sx` props, increasing drift risk for future canvas features.
**Suggested fix:** Extract `ProjectGrid`, `ProjectCard`, `CreateProjectDialog`, `RenameProjectDialog`, `ConfirmDeleteDialog` into `src/components/home/` (as the spec's optional split suggested). Keep `HomePage` as data wiring only. No behavior change.
**Resolution:** Re-examined 2026-09-04 by /audit (scope: current; lens: all) - still 393 lines, not touched by feature 5 (canvas branch controls). Gap persists, no regression.
**Fixed 2026-09-04:** extracted `src/components/home/` (`ProjectGrid`, `ProjectCard`, `ProjectMenu`, `CreateProjectDialog`, `RenameProjectDialog`, `ConfirmDeleteDialog`, `HomeEmptyState`, shared `PILL_SX`); `HomePage.tsx` 399 down to 199 lines of data wiring. No behavior change: same validation, dialogs, menu actions, and quota paths. Build, lint, and 70/70 tests green.

### F-11 [P3] fixed - Storage mutation and recovery paths lack unit coverage

**File:** src/lib/storage.ts:93
**Found:** 2026-09-04 by /audit (scope: changed; lens: tests)
**Why it matters:** `createProject`, `renameProject` (root-text sync), `addChildNode`, `updateNodeText`, `setNodeCollapsed`, and the strictly-increasing `updatedAt` bumps in `bumpedIso` hold assertable logic that the new `storage.test.ts` does not exercise; neither does it cover corruption reset (`parseOrFallback`, `consumeCorruptionFlag`) or newest-first sort (`getProjectsSortedByUpdatedAt`). The viewport and delete tests pass only through the node-environment memory fallback, so the real `localStorage` read/write path is unproven.
**Suggested fix:** Add `src/lib/storage.mutation.test.ts` covering validation-throw paths, rename root-text sync, monotonic bumps across rapid writes, corrupt-JSON reset plus flag consumption, and sort order. Keep assertions on behavior, not on the memory fallback itself.
**Resolution:** Fixed 2026-09-04: added `src/lib/storage.mutation.test.ts` (18 cases: CRUD throw paths, rename sync, monotonic bumps, sort order, corruption reset/flag, quota rethrow) using a `vi.stubGlobal` localStorage stub so the real read/write path is exercised. Suite 70/70 green with build and lint clean.
