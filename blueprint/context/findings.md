# Findings

> **Generated file.** The findings ledger: review findings raised by `/audit`
> against the work in progress, each with a durable ID, severity (P0-P3), and
> status. `/implement` marks repaired findings `fixed`, a later `/audit` pass
> moves them to `closed`, and `/complete` refuses to merge while any P0 or P1
> finding is `open` or `fixed`, then archives resolved findings with the work
> and resets this file.

### F-02 [P3] open - Oversized HomePage bundles 4 dialogs and grid in one file

**File:** src/pages/HomePage.tsx:1
**Found:** 2026-09-02 by /audit (scope: current; lens: quality)
**Why it matters:** `HomePage.tsx` is 393 lines combining grid, empty state, create/rename/delete dialogs, menu, and navigation. `coding-standards.md` prefers one job per component and `src/components/[feature]/ComponentName.tsx`. The file is hard to review in one sitting and duplicates button `sx` props, increasing drift risk for future canvas features.
**Suggested fix:** Extract `ProjectGrid`, `ProjectCard`, `CreateProjectDialog`, `RenameProjectDialog`, `ConfirmDeleteDialog` into `src/components/home/` (as the spec's optional split suggested). Keep `HomePage` as data wiring only. No behavior change.
**Resolution:** Re-examined 2026-09-04 by /audit (scope: current; lens: all) - still 393 lines, not touched by feature 5 (canvas branch controls). Gap persists, no regression.

### F-06 [P3] open - Viewport helpers lack unit coverage despite pure logic

**File:** src/lib/layout.ts:19, src/lib/storage.ts:255
**Found:** 2026-09-03 by /audit (scope: current; lens: tests)
**Why it matters:** `computeLayout` and `getViewport`/`setViewport`/`clampZoom` are pure, high-value logic with many edge cases (single node centered, collapsed hiding, cycle, 100-node no-overlap, zoom clamp, `updatedAt` bump). No `test` command is declared (`AGENTS.md:199`), so the Testing gate in `coding-standards.md` is not active, but the next `/tests` will need coverage. Current manual `node --experimental-strip-types` smoke is not repeatable in CI.
**Suggested fix:** When `/tests` adds Vitest, add `src/lib/layout.test.ts` and `src/lib/storage.viewport.test.ts` covering the done-whens from `current-feature.md:57` (single, symmetric, chain, collapsed, order, no-overlap, cycle, viewport clamp/migration). Feature 4 extends the same gap: add `validateNodeTextPure` (empty/whitespace/60/61), `addChildNode` (linkage, side persisted, invalid side throws), `updateNodeText`/`setNodeCollapsed` (trim, throws, strictly-increasing bumps), and radial `computeLayout` (origin, quadrants, fan-out separation, legacy-south, 100-node no-overlap, cycle). Re-examined 2026-09-03: still open, gap grown as described.
**Resolution:** Re-examined 2026-09-04 by /audit (scope: current; lens: all) - still no test runner, gap now includes feature 5 pure helpers (`getSubtreeIdsPure`, `countSubtreeNodesPure`, `getSubtreeCountsPure`, `deleteNodeSubtree`) per F-09 below. Build/lint pass; no new regression in existing helpers.

### F-09 [P3] open - New pure subtree helpers lack unit coverage

**File:** src/lib/storage.ts:337
**Found:** 2026-09-04 by /audit (scope: current; lens: tests)
**Why it matters:** `getSubtreeIdsPure`, `countSubtreeNodesPure`, and `deleteNodeSubtree` are pure, high-value logic added by feature 5 (cross-project isolation, collapsed descendants counted, leaf/unknown/root guards, single-write atomicity, `bumpedIso`). Covered only by manual Playwright smoke in the implement session; no repeatable unit test exists. No `test` command is declared so the Testing gate is not active, but the gap will block CI once `/tests` is added.
**Suggested fix:** When `/tests` adds Vitest, add `src/lib/storage.subtree.test.ts` covering: leaf returns self, mid-tree returns full subtree, collapsed descendants included, unknown id returns `[]`, cross-project isolation, count equals ids length, `getSubtreeCountsPure` agrees with `countSubtreeNodesPure` per node, delete removes exactly subtree atomically, root throws, unknown throws, `Project.updatedAt` strictly increases. Keep helpers JSX-free as they are now.
**Resolution:** Re-examined 2026-09-04 by /audit (scope: current; lens: all) - still no test runner; gap confirmed to include `getSubtreeCountsPure`. Still P3 open, no severity change.
