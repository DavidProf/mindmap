# Feature: Tree layout quality pass

**From build-plan:** feature 10
**Status:** verified

## Goal

Fix two misleading placements in the radial tidy-tree layout so parentage stays readable at a glance: opposite-side grandchildren must read as their parent's child, and nested same-direction subtrees must not cross or sit on each other's edges.

## In scope

- Case (a) fold-back: root has `A[east]`, `B[east]`, `D[east]` and `B` has `C[west]` - today `C` lands near root and reads as a root child. `C` must sit clearly nearer `B` than root or any non-parent.
- Case (b) corridor clash: root has `A[east]`, `B[east]`, `B` has `C[east]`, `A` has `D[south]` - today `D`'s edge crosses the `B` edge or sits over the `C` edge. Subtrees of `A` and `B` must separate with no edge-edge crossing and no node sitting on another edge corridor.
- General parent-proximity rule behind both: every visible non-root node is closer to its parent than to root (except root's direct children) and closer to its parent than to any node outside its own subtree branch where geometrically possible.
- Keep existing guarantees: strict tree, insertion-order siblings, collapsed subtrees hidden with reflow, every pair at least one diameter apart, bounds padded by radius, same `computeLayout` signature.
- Keep PNG export rendering correctly from the same positions (no export-logic change unless bounds contract shifts).

## Out of scope

- New node types or shapes (item 13 dense text and media nodes).
- Arbitrary cross-links (item 14).
- Auto side assignment or changes to the plus-button side picker interaction.
- Curved edges, edge labels, or a new rendering style unless the minimal fix requires it (prefer repositioning over restyling).
- Undo/redo (15), home enhancements (16), cloud sync (17), presentation/a11y polish (18), multi-select (19), PNG preview (11), IndexedDB (12).
- `Verify` command or CI setup (separate `/ci` decision).

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Reproduce both cases as failing tests** - add focused cases to `src/lib/layout.test.ts` building the exact trees from the plan line: (a) root + A/B/D east with C west-of-B, asserting `dist(C,B) < dist(C,root)` and `dist(C,B) < dist(C,A)`; (b) root + A/B east, C east-of-B, D south-of-A, asserting no edge segment intersects another edge segment except at shared endpoints and no node center falls within half-diameter of a non-incident edge. *Done when:* `npm test` shows exactly the 2 new tests failing and every pre-existing layout test still passing.
- [x] **Step 2 - Fix fold-back parent proximity (case a)** - adjust placement in `src/lib/layout.ts` so opposite-side grandchildren stay in the parent's orbit: on fold-back (base candidate within one step of grandparent) search deflection bearings finest-first (`FINE_DEGS`) at fixed one-step radius for the first clash-free bearing where the parent stays nearest, falling back to today's push-out. Keep leaf-count weighting and `resolveOverlap` behavior for all other cases. *Done when:* case (a) test passes, `dist(C,B)` is within 1% of one radial step (`NODE_DIAMETER + GAP_Y`) and strictly less than `dist(C,root)`, and the full layout suite is green.
- [x] **Step 3 - Fix subtree separation and edge crossings (case b)** - check every new edge against placed edges (`edgeClean`: no strict-interior crossing, half-diameter corridor clearance both ways); on violation search `FINE_DEGS` finest-first and push out along each bearing to its smallest clash-free radius before accepting, so direction bends as little as readability allows. No signature change; constants stay. *Done when:* case (b) test passes (zero non-shared edge intersections, node-to-edge clearance holds), case (a) still passes, and the full layout suite is green.
- [x] **Step 4 - Regression and visual proof** - run `npm test`, `npm run lint`, `npm run build`, and `npm run test:browser`; open the two repro maps in `npm run dev` and confirm parentage reads correctly at default zoom plus one collapse/expand reflow cycle. *Done when:* all four commands pass, both repro maps show C grouped with B and D clear of the B-C corridor in a screenshot, and collapse/expand still reflows without overlap.
- [x] **Step 5 - Grandparent-proximity guard in separation repair** - reported tree (`R,A[west],B[north of A],C[east of B],D+E[south of C]` plus `F[east of R]`) flings `E` to 103 from grandparent `B` vs 240 from parent `C`: `placeSeparated` never checks parent proximity. Veto bearings landing nearer the grandparent than the parent (root children exempt, no grandparent). Add a regression test asserting `dist(E,C) < dist(E,B)` with and without `F`. *Done when:* new test passes, full suite green, reported tree renders `E` adjacent to `C` in a screenshot.

## Files / areas

- `src/lib/layout.ts` - the only production file expected to change (radial placement, fan spread, overlap/separation logic).
- `src/lib/layout.test.ts` - new failing-then-passing cases plus any separation helpers tested directly.
- `src/components/canvas/TreeCanvas.tsx` - read-only reference (consumes `positions`/`edges`/`bounds`); change only if the layout contract forces it, which is not expected.
- `src/lib/exportPng.ts` - read-only reference (redraws the same positions); change only if bounds semantics shift, which is not expected.

## Data / contracts

- **Load-bearing, do not break:** `computeLayout(nodes, rootId, opts?) -> LayoutResult` with `positions: Map<string, Position>`, `edges: { from, to }[]`, `bounds` padded by node radius, `hiddenIds: Set<string>`; constants `NODE_DIAMETER = 88`, `GAP_X = 32`, `GAP_Y = 72` consumed by canvas and export tests.
- `Node.side: NodeSide | null` (`north | east | south | west`, missing defaults to `south`); `parentId: string | null` (null for root only); strict tree, no cycles; sibling order is insertion order; `collapsed` hides whole subtree.
- New test helpers (e.g. segment-intersection, point-to-segment distance) are test-only and must not leak into the production export.

## Testing

- `AGENTS.md` declares `Test: npm test` (Vitest) so the test gate is on: Steps 1-3 each ship their tests in the same diff, and `npm test` must be green before any checkpoint or `/complete`.
- `AGENTS.md` declares `Browser tests: npm run test:browser` (Playwright Chromium smoke via `e2e/smoke.spec.ts`): Step 4 runs it as a regression gate (existing smoke stays green). No new e2e spec for pixel readability; layout readability is asserted by unit geometry plus a direct screenshot.
- Manual proof in Step 4 doubles as the `/check` evidence: the two repro trees, default zoom, one collapse/expand cycle, plus `npm run build` and `npm run lint` green.

## Notes for the AI

- Client-only Vite SPA (React 19 + TypeScript strict, no `any`, `verbatimModuleSyntax` + `noUnusedLocals` enforced). No backend, no auth scoping, no storage change.
- Prefer the smallest geometry fix that satisfies both done-whens; do not rewrite the layout engine or introduce a dependency.
- Keep `resolveOverlap` termination and performance sane (current cap is 50 iterations over placed nodes); the suite has a 20-node spacing test that will catch blowups.
- Follow `coding-standards.md` comments rule: explain only the non-obvious why (e.g. why an angular clamp value was chosen), no banners or narration.
- No em dashes in code, specs, or commit messages; use hyphens or colons.
