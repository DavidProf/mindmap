# Fix - Repair audit findings (tests + HomePage split)

**Date:** 2026-09-04
**Branch:** fix/missing-unit-tests
**Type:** Fix (no build-plan item; nothing to check off)

Ad-hoc repair batch for audit findings F-02, F-06, F-09, F-10, F-11:

- `src/lib/layout.test.ts` (new, 10 cases): origin, quadrants, legacy-south,
  collapsed hiding, cycle termination, 21-node no-overlap, bounds.
- `src/lib/storage.test.ts` (new, 24 cases): validators, `clampZoom`, subtree
  ids/counts, `deleteNodeSubtree`, viewport read/write/fallback.
- `src/lib/exportPng.test.ts` (+12 cases): padding min/centering, slug edges,
  wrap/chunk/ellipsis, emoji pairs, DPR and 4096px caps.
- `src/lib/storage.mutation.test.ts` (new, 18 cases): CRUD throw paths, rename
  root-text sync, monotonic `updatedAt` bumps, sort order, corruption reset/flag,
  quota rethrow via a `vi.stubGlobal` `localStorage` stub.
- `src/components/home/` (new): `ProjectGrid`, `ProjectCard`, `ProjectMenu`,
  `CreateProjectDialog`, `RenameProjectDialog`, `ConfirmDeleteDialog`,
  `HomeEmptyState`, shared `PILL_SX`; `HomePage.tsx` 399 down to 199 lines of
  data wiring. Pure moves, no behavior change.

Verification: `npm run build` passed, `npm test` 70/70, `npm run lint` exit 0.

## Findings

### repair-audit-findings/F-06 [P3] closed - Viewport helpers lack unit coverage despite pure logic

**File:** src/lib/layout.ts:19, src/lib/storage.ts:255
**Found:** 2026-09-03 by /audit (scope: current; lens: tests)
**Why it matters:** `computeLayout` and `getViewport`/`setViewport`/`clampZoom` are pure, high-value logic with many edge cases (single node centered, collapsed hiding, cycle, 100-node no-overlap, zoom clamp, `updatedAt` bump). No `test` command is declared (`AGENTS.md:199`), so the Testing gate in `coding-standards.md` is not active, but the next `/tests` will need coverage. Current manual `node --experimental-strip-types` smoke is not repeatable in CI.
**Suggested fix:** When `/tests` adds Vitest, add `src/lib/layout.test.ts` and `src/lib/storage.viewport.test.ts` covering the done-whens from `current-feature.md:57` (single, symmetric, chain, collapsed, order, no-overlap, cycle, viewport clamp/migration). Feature 4 extends the same gap: add `validateNodeTextPure` (empty/whitespace/60/61), `addChildNode` (linkage, side persisted, invalid side throws), `updateNodeText`/`setNodeCollapsed` (trim, throws, strictly-increasing bumps), and radial `computeLayout` (origin, quadrants, fan-out separation, legacy-south, 100-node no-overlap, cycle). Re-examined 2026-09-03: still open, gap grown as described.
**Resolution:** Re-examined 2026-09-04 by /audit (scope: current; lens: all) - still no test runner, gap now includes feature 5 pure helpers (`getSubtreeIdsPure`, `countSubtreeNodesPure`, `getSubtreeCountsPure`, `deleteNodeSubtree`) per F-09 below. Build/lint pass; no new regression in existing helpers.
**Fixed 2026-09-04:** covered by `src/lib/layout.test.ts` (origin, quadrants, legacy-south, collapsed, cycle, no-overlap, bounds) and `src/lib/storage.test.ts` (validators, `clampZoom`, viewport read/write/fallback). Suite 52/52 green.
**Closed 2026-09-04 by /audit (scope: changed; lens: all):** re-read both test files; the enumerated pure-helper gaps are covered, 52/52 pass with lint and build green, no new defect in the repair. Narrower remainder (mutating helpers, bump monotonicity, corruption paths) moves to F-11.

### repair-audit-findings/F-09 [P3] closed - New pure subtree helpers lack unit coverage

**File:** src/lib/storage.ts:337
**Found:** 2026-09-04 by /audit (scope: current; lens: tests)
**Why it matters:** `getSubtreeIdsPure`, `countSubtreeNodesPure`, and `deleteNodeSubtree` are pure, high-value logic added by feature 5 (cross-project isolation, collapsed descendants counted, leaf/unknown/root guards, single-write atomicity, `bumpedIso`). Covered only by manual Playwright smoke in the implement session; no repeatable unit test exists. No `test` command is declared so the Testing gate is not active, but the gap will block CI once `/tests` is added.
**Suggested fix:** When `/tests` adds Vitest, add `src/lib/storage.subtree.test.ts` covering: leaf returns self, mid-tree returns full subtree, collapsed descendants included, unknown id returns `[]`, cross-project isolation, count equals ids length, `getSubtreeCountsPure` agrees with `countSubtreeNodesPure` per node, delete removes exactly subtree atomically, root throws, unknown throws, `Project.updatedAt` strictly increases. Keep helpers JSX-free as they are now.
**Resolution:** Re-examined 2026-09-04 by /audit (scope: current; lens: all) - still no test runner; gap confirmed to include `getSubtreeCountsPure`. Still P3 open, no severity change.
**Fixed 2026-09-04:** covered by `src/lib/storage.test.ts` (ids/counts agreement, cross-project isolation, self-parent cycle, `deleteNodeSubtree` atomicity/root/unknown). Suite 52/52 green.
**Closed 2026-09-04 by /audit (scope: changed; lens: all):** re-read the subtree describes; stated gap is covered, 52/52 pass with lint and build green. Remainder (explicit collapsed-inclusion case, `updatedAt` monotonicity) moves to F-11.

### repair-audit-findings/F-10 [P3] closed - New exportPng pure helpers lack unit coverage

**File:** src/lib/exportPng.ts:26
**Found:** 2026-09-04 by /audit (scope: current; lens: tests)
**Why it matters:** `paddedExportBounds`, `buildExportFilename`, `wrapLinesPure`, and `resolveExportScale` are pure, high-value logic added by feature 6 (single-node min-size padding, filename slug edge cases, 3-line wrap/ellipsis, DPR and 4096px scale caps). Covered only by ad-hoc Playwright download smoke in the autopilot session; no repeatable unit test exists. No `test` command is declared so the Testing gate is not active, but the gap grows with F-06/F-09 and will block CI once `/tests` is added.
**Suggested fix:** When `/tests` adds Vitest, add `src/lib/exportPng.test.ts` covering: zero-size bounds yield `NODE_DIAMETER + padding*2` minimum, padding centers on bounds midpoint, slug strips non-alphanumerics/lowercases/truncates/falls back to `mindmap`, wrap splits words at 12 chars, long words chunk, overflow past 3 lines truncates with ellipsis, empty text returns `[]`, astral characters (emoji) are not split mid-surrogate, scale caps DPR at 2 and longest side at 4096px. `renderMapToCanvas`/`exportMapAsPng` stay DOM-level and ride on download evidence per `coding-standards.md`.
**Resolution:** Fixed 2026-09-04: covered by `src/lib/exportPng.test.ts` (min-size padding, midpoint centering, slug strip/truncate/fallback, 12-char pack, long-word chunk, 3-line ellipsis, emoji pairs, DPR cap, 4096px cap). Suite 52/52 green.
**Closed 2026-09-04 by /audit (scope: changed; lens: all):** re-read the file; every suggested item is covered, 52/52 pass with lint and build green. No remainder.
