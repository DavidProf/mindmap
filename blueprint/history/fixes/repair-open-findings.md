# Fix - Repair open findings F-12 and F-13

**Date:** 2026-09-04
**Branch:** fix/repair-open-findings
**Type:** Fix (no build-plan item; nothing to check off)

Ad-hoc repair batch for the two open P3 findings from the full-project audit,
plus archival of F-02/F-11 (repaired in the prior fix, closed since, never
archived):

- F-12: moved `PILL_SX` from `src/components/home/` to shared
  `src/components/pillSx.ts` (via `git mv`); all 7 usages (home dialogs,
  `HomePage`, `NodeDeleteDialog`, `AppHeader`) share it. No visual change.
- F-13: extracted `src/components/canvas/useViewport.ts` (viewport state,
  pan/pinch/wheel handlers, recenter math, persistence, timer cleanup);
  `TreeCanvas.tsx` 446 down to 273 lines of node actions. Handler bodies moved
  verbatim; menu-dismiss and background-deselect preserved via explicit
  callbacks. No behavior change.

Verification: `npm run build` passed, `npm test` 70/70, `npm run lint` exit 0.

## Findings

### repair-open-findings/F-02 [P3] closed - Oversized HomePage bundles 4 dialogs and grid in one file

**File:** src/pages/HomePage.tsx:1
**Found:** 2026-09-02 by /audit (scope: current; lens: quality)
**Why it matters:** `HomePage.tsx` is 393 lines combining grid, empty state, create/rename/delete dialogs, menu, and navigation. `coding-standards.md` prefers one job per component and `src/components/[feature]/ComponentName.tsx`. The file is hard to review in one sitting and duplicates button `sx` props, increasing drift risk for future canvas features.
**Suggested fix:** Extract `ProjectGrid`, `ProjectCard`, `CreateProjectDialog`, `RenameProjectDialog`, `ConfirmDeleteDialog` into `src/components/home/` (as the spec's optional split suggested). Keep `HomePage` as data wiring only. No behavior change.
**Resolution:** Re-examined 2026-09-04 by /audit (scope: current; lens: all) - still 393 lines, not touched by feature 5 (canvas branch controls). Gap persists, no regression.
**Fixed 2026-09-04:** extracted `src/components/home/` (`ProjectGrid`, `ProjectCard`, `ProjectMenu`, `CreateProjectDialog`, `RenameProjectDialog`, `ConfirmDeleteDialog`, `HomeEmptyState`, shared `PILL_SX`); `HomePage.tsx` 399 down to 199 lines of data wiring. No behavior change: same validation, dialogs, menu actions, and quota paths. Build, lint, and 70/70 tests green.
**Closed 2026-09-04 by /audit (scope: full; lens: all):** re-read `HomePage.tsx` (199 lines, data wiring only) and the `src/components/home/` split; original bundle gone, behavior preserved, signals green, no new defect. Pill-`sx` leftovers outside home/ move to F-12.

### repair-open-findings/F-11 [P3] closed - Storage mutation and recovery paths lack unit coverage

**File:** src/lib/storage.ts:93
**Found:** 2026-09-04 by /audit (scope: changed; lens: tests)
**Why it matters:** `createProject`, `renameProject` (root-text sync), `addChildNode`, `updateNodeText`, `setNodeCollapsed`, and the strictly-increasing `updatedAt` bumps in `bumpedIso` hold assertable logic that the new `storage.test.ts` does not exercise; neither does it cover corruption reset (`parseOrFallback`, `consumeCorruptionFlag`) or newest-first sort (`getProjectsSortedByUpdatedAt`). The viewport and delete tests pass only through the node-environment memory fallback, so the real `localStorage` read/write path is unproven.
**Suggested fix:** Add `src/lib/storage.mutation.test.ts` covering validation-throw paths, rename root-text sync, monotonic bumps across rapid writes, corrupt-JSON reset plus flag consumption, and sort order. Keep assertions on behavior, not on the memory fallback itself.
**Resolution:** Fixed 2026-09-04: added `src/lib/storage.mutation.test.ts` (18 cases: CRUD throw paths, rename sync, monotonic bumps, sort order, corruption reset/flag, quota rethrow) using a `vi.stubGlobal` localStorage stub so the real read/write path is exercised. Suite 70/70 green with build and lint clean.
**Closed 2026-09-04 by /audit (scope: full; lens: all):** re-read `src/lib/storage.mutation.test.ts`; every suggested item is covered (throw paths, rename sync, monotonic bumps, sort, corruption reset/flag, quota rethrow on the real path), 70/70 pass with lint and build green. No remainder.

### repair-open-findings/F-12 [P3] closed - Pill-button sx duplicated outside the home components

**File:** src/components/canvas/NodeDeleteDialog.tsx:28
**Found:** 2026-09-04 by /audit (scope: full; lens: quality)
**Why it matters:** The F-02 repair centralized the pill-button style as `PILL_SX` in `src/components/home/`, but `NodeDeleteDialog.tsx:28,36` and `AppHeader.tsx:37,47` still carry the same literal, so the next radius change needs three coordinated edits.
**Suggested fix:** Move `PILL_SX` to a shared spot such as `src/components/pillSx.ts` and use it in the home components, `NodeDeleteDialog`, and `AppHeader`. No visual change.
**Resolution:** Fixed 2026-09-04: moved to `src/components/pillSx.ts`, used in all 7 spots. The export button gains `textTransform: none` from the shared style, but the theme already applies that globally, so computed styles are unchanged. Build, lint, 70/70 green.
**Closed 2026-09-04 by /audit (scope: current; lens: all):** grepped all usages, 7 spots share `PILL_SX`, zero `999px` literals remain; signals green. No remainder.

### repair-open-findings/F-13 [P3] closed - TreeCanvas mixes viewport gestures with node-action wiring

**File:** src/components/canvas/TreeCanvas.tsx:29
**Found:** 2026-09-04 by /audit (scope: full; lens: quality)
**Why it matters:** At 446 lines it is now the largest module, combining pan/pinch/wheel/recenter viewport state with selection, editing, menu, delete, and focus wiring. Same class of bundle F-02 fixed in `HomePage.tsx`; it will get harder to review with each canvas feature.
**Suggested fix:** When next touched, extract viewport gesture handling (pan, pinch, wheel, recenter, persistence) into a `useViewport` hook, leaving `TreeCanvas` as layout-plus-node-actions. No behavior change.
**Resolution:** Fixed 2026-09-04: added `src/components/canvas/useViewport.ts` (viewport state, gestures, recenter, persistence, timer cleanup); `TreeCanvas.tsx` 446 down to 273 lines of node actions. Handler bodies moved verbatim; menu-dismiss and background-deselect preserved via `onInteract`/`onBackgroundPress` callbacks. Build, lint, 70/70 green.
**Closed 2026-09-04 by /audit (scope: current; lens: all):** re-read `useViewport.ts` and `TreeCanvas.tsx` (273 lines, node actions only); handler bodies verbatim, menu-dismiss and background-deselect preserved, signals green. No new defect. Gesture behavior itself rides on browser evidence (no harness yet).
