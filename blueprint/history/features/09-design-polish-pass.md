# Feature: Design polish pass

**From build-plan:** feature 9
**Status:** verified

## Goal

Make the shipped app feel calm and finished without changing what it does: locked palette/typography tokens, a refined collapse badge and empty state, a responsive sweep, plus four small interaction fixes (smaller/offset add badges with auto-hide, clickable collapse badge, node rename commits on blur, project rename inline like node).

## In scope

- Lock palette/typography tokens (`src/index.css` + `src/theme/muiTheme.ts` stay in sync; no hardcoded hex outside tokens).
- Add (`+`) badges: smaller badge visual, larger offset from node, 44px touch target kept, auto-hide on click-out/deselect.
- Collapse badge: click (and keyboard) toggles expand/collapse.
- Node rename: commits on blur/click-out (Escape still cancels).
- Project rename: inline editing on the home card like node editing, replacing the rename dialog.
- Empty-state feel (`HomeEmptyState`) and placeholder/error card consistency.
- Responsive check: 360px phone, 768px tablet, desktop; canvas chrome and home grid.

## Out of scope

- Layout algorithm changes (build-plan 10: subtree separation, edge routing, parent-proximity).
- PNG preview, IndexedDB, media/graph/undo/home-enhancements/cloud/presentation/multi-select (build-plan 11-19).
- Dark mode, new themes, icon set redesign, copy rewrite beyond empty-state polish.
- New data fields, API, or persistence changes.

## Build loop

Build one step at a time, never the whole feature at once.

1. Plan mode lays out the step before any code.
2. The AI implements just that step.
3. It shows the diff (not full files); you read it and understand it.
4. You approve, then choose whether to commit a checkpoint or roll straight on.
   Checkpoints are optional; `/complete` makes the real feature-level commit at the end.

Never accept a step you haven't read. If a diff is too big to review, the step was too big, so split it.

## Build steps

- [x] **Step 1 - Lock tokens** - audit `index.css` vars vs `muiTheme.ts` vs ad-hoc values; move inline placeholder/error styles into CSS; document the token table in code comments minimal. *Done when:* `grep -rnE '#[0-9a-fA-F]{3,6}\b' src` shows hex only inside `src/index.css` and `src/theme/` (the token sources); `npm run build` passes; home + editor look unchanged in a screenshot.
- [x] **Step 2 - Add badges** - shrink plus badge visual (16px faint, user-tuned to -10px offset), keep 44px hit target; pluses show on hover/focus-within and hide on canvas click-out/deselect (selection alone does not pin them). *Done when:* desktop hover shows 4 small pluses; clicking empty canvas deselects and hides them; `npm run test:browser` passes.
- [x] **Step 3 - Collapse badge toggle** - turn `.node-badge` span into an accessible button; click toggles collapse/expand; Enter/Space toggles; badge hidden on leaf nodes; context-menu toggle keeps working. *Done when:* clicking `+N` expands and the badge disappears/flips; keyboard toggle works; collapsed count still correct after refresh.
- [x] **Step 4 - Node blur commit** - ensure click-out/blur commits a valid rename (Enter and blur agree, Escape cancels, empty reverts to previous text); fix the canvas-mousedown focus trap if blur is swallowed. *Done when:* editing a node then clicking another node or empty canvas commits the new text and closes the editor; Escape discards; empty edit keeps old text.
- [x] **Step 5 - Project inline rename** - replace `RenameProjectDialog` with inline card editing reusing `validateProjectNamePure` (unique case-insensitive, max 40, inline error + counter); Enter/blur commits valid name, Escape cancels, duplicate/empty blocked with inline message; delete/create dialogs untouched. *Done when:* Home card menu Rename focuses an inline input; valid rename persists newest-first order; duplicate shows "already exists" inline and does not save; dialog component removed.
- [x] **Step 6 - Empty-state + responsive sweep** - refine `HomeEmptyState` spacing/icon/copy against locked tokens; verify 360px (single column, chrome reachable), 768px (2-col), desktop (3-col), editor chrome not overlapping canvas on small screens. *Done when:* screenshots at 360/768/1280 show no overlap or clipped targets; `/check` walks home empty, card rename, canvas badge toggle, and blur commit clean.
- [x] **Repair F-01 - dead plus-stroke token** - delete the unreferenced `--plus-stroke` line from `src/index.css`. *Done when:* `grep -rn 'plus-stroke' src` is empty; `npm run build` passes.
- [x] **Repair F-02 - shared project-name limit** - export `MAX_PROJECT_NAME_LENGTH` from `src/lib/storage.ts`, use it in the validator, `ProjectRenameEditor`, and the create-dialog counter. *Done when:* no bare limit outside the shared constant; `npm test` green.
- [x] **Repair F-03 - committed browser coverage** - add two focused Playwright tests to `e2e/smoke.spec.ts`: badge click/keyboard expands a collapsed node; inline rename blocks a duplicate and commits a valid name. *Done when:* `npm run test:browser` passes with the new tests.

## Files / areas

- `src/index.css`, `src/theme/muiTheme.ts`, `src/theme/tokens.ts` (new), `src/components/pillSx.ts`
- `src/components/canvas/TreeCanvas.tsx`, `src/components/canvas/NodeCircle.tsx`, `src/components/canvas/NodeEditor.tsx`, `src/components/canvas/TreeCanvas.css`
- `src/pages/HomePage.tsx`, `src/components/home/ProjectCard.tsx`, `src/components/home/ProjectGrid.tsx`, `src/components/home/ProjectRenameEditor.tsx` (new), `src/components/home/RenameProjectDialog.tsx` (deleted), `src/pages/HomePage.css`
- `src/pages/EditorPage.tsx`, `src/pages/EditorPage.css` (placeholder/error token cleanup only)
- `e2e/smoke.spec.ts` (two `polish:` tests)

## Data / contracts

- None. `Project` and `Node` shapes unchanged; `collapsed`, `viewport`, validation limits (node 30, project 40) unchanged.
- Load-bearing reuse: `validateProjectNamePure` stays the single project-name rule for both create and new inline rename; `MAX_PROJECT_NAME_LENGTH` (40) is the shared limit constant.

## Testing

- Commands: `npm test` (Vitest), `npm run test:browser` (Playwright Chromium smoke), `npm run build`, `npm run lint`.
- Final evidence: `npm run build`, `npm run lint`, `npm test` 76/76, `npm run test:browser` 6/6 green; live-browser proofs per step plus 360/768/1280 screenshots with zero console errors.

## Notes for the AI

- Client-only Vite SPA; MUI components get tokens via CSS vars (`var(--bg)`, `var(--accent)`, radii/shadows); no gradients, no Tailwind, no new deps.
- Touch first: keep `>=44px` hit targets, `LONG_PRESS_MS` vs drag thresholds untouched, hover logic stays disabled-by-CSS on touch (no JS device sniffing).
- Accessibility: plus buttons keep `aria-label Add child to X`; collapse badge is a real `<button>` with `aria-expanded` + `aria-label` including hidden count; inline rename input has `aria-label` and `aria-invalid` on error; visible focus rings via `--accent-ring`.
- Do not change layout math, storage keys, export rendering, or routing; do not add a test runner or Verify/CI (explicit `/tests`, `/browser-tests`, `/ci` territory).

## Findings

### 9/F-01 [P3] closed - Unused --plus-stroke token left in index.css

**File:** src/index.css:42
**Found:** 2026-09-06 by /audit (scope: current; lens: quality)
**Why it matters:** Step 2 moved the plus badge to `--faint`/`--muted`; nothing references `--plus-stroke` anymore, so the token table has a dead entry inviting reuse confusion.
**Suggested fix:** Delete the `--plus-stroke` line from `:root`.
**Resolution:** Removed in repair pass; re-audit confirmed line gone, no references, lint clean.

### 9/F-02 [P3] closed - Project name limit 40 hardcoded in rename editor

**File:** src/components/home/ProjectRenameEditor.tsx:47
**Found:** 2026-09-06 by /audit (scope: current; lens: quality)
**Why it matters:** `maxLength`, the slice cap, and the counter each hardcode `40` while `validateProjectNamePure` owns the real limit; a future limit change must touch both files.
**Suggested fix:** Export one `MAX_PROJECT_NAME_LENGTH` from `src/lib/storage.ts` and use it in both the editor and the create dialog counter.
**Resolution:** Constant exported and used in validator, editor, and create dialog; re-audit confirmed single constant in all spots, message text identical, 76 unit tests pass.

### 9/F-03 [P2] closed - No committed browser coverage for badge toggle and inline rename

**File:** e2e/smoke.spec.ts:1
**Found:** 2026-09-06 by /audit (scope: current; lens: tests)
**Why it matters:** The spec predicted focused harness coverage for the two stable behavioral done-whens; both were proven only by throwaway scripts.
**Suggested fix:** Add two focused Playwright tests: badge click expands a collapsed node (and keyboard Enter does too), and inline rename blocks a duplicate while committing a valid name.
**Resolution:** Two `polish:` tests added; re-audit confirmed they assert real behavior with no skips or focus flags, `npm run test:browser` 6/6 green.
