# Feature: 6 - PNG Export

**From build-plan:** feature 6
**Status:** verified

## Goal

Enable client-side PNG export of the whole visible mind map from the editor, with a light background suitable for slides and notes. No backend, no new dependencies.

## Scope

- Export button on editor header (`AppHeader` variant editor, currently disabled).
- New lib `src/lib/exportPng.ts`: pure bounds/filename helpers + canvas renderer (edges, circles, wrapped text) + download trigger.
- Wiring in `EditorPage` / `TreeCanvas` data flow: pass visible nodes + layout positions/edges/bounds into export; show error banner on failure.
- Collapsed subtrees excluded (export what is visible on canvas).
- Single-node / small maps export correctly.

### Explicit non-goals

- No PDF, print styles, present mode.
- No viewport-only crop mode (whole-tree fitted only for MVP).
- No new npm dependency (`html-to-image` etc. deferred); manual Canvas 2D only.
- No cloud upload, share link, or storage change.
- No selection ring, plus buttons, badges, or dotted canvas background in export (clean map only).

## Contracts

- `computeExportBounds(bounds)`: input layout `bounds` (includes node radius padding); add fixed export padding `EXPORT_PADDING = 48` world px on all sides. Single node (width/height 0 edge case from layout) still yields non-zero canvas.
- `buildExportFilename(projectName)`: trim, lowercase, replace `[^a-z0-9]+` with `-`, trim dashes, fallback `mindmap`, suffix `-mindmap.png`, max 60 chars before suffix.
- `renderMapToCanvas(opts)`: `{ nodes, positions, edges, bounds, scale }` draws:
  - background fill `#fbfaf7` (matches `muiTheme` default).
  - edges: `#94a3b8`-ish thin line (`var(--line)` equivalent), width `1.5 * scale`.
  - nodes: white fill `#ffffff`, stroke `#334155` (`var(--node-stroke)`), diameter `NODE_DIAMETER * scale`; selected state ignored.
  - text: `#0f172a`, 13px system font scaled, centered, word-wrapped max 3 lines with ellipsis (mirrors `.node-circle__text` clamp).
- `exportMapAsPng(...)`: creates canvas at `devicePixelRatio`-aware resolution (cap DPR at 2, cap longest side at 4096px), `canvas.toBlob('image/png')`, object URL + `<a download>` click, revoke URL. Throws on canvas/blob failure so caller shows banner.
- Header: `AppHeader` gains `onExport?: () => void` + `exporting?: boolean`; button enabled, label switches to `Exporting...` while busy, `aria-label="Export PNG"`.

## Build steps

- [x] 1. Export lib (`src/lib/exportPng.ts`): bounds padding, filename sanitizer, canvas renderer, download helper.
- [x] 2. Header + editor wiring: enable Export PNG button, busy state, error banner path, collapsed-aware visible-only export.
- [x] 3. Verification: `npm run build`, `npm run lint`, dev-server browser evidence (export downloads PNG, single-node + multi-node + collapsed cases).

## Done when

- [x] Editor header shows enabled `Export PNG` button; clicking downloads `<name>-mindmap.png`.
- [x] PNG contains whole visible tree fitted with padding on `#fbfaf7` background; edges + circles + text readable at 100%.
- [x] Collapsed descendants are absent from PNG; expanded re-export includes them.
- [x] Single-node project exports a centered circle with its label (no zero-size canvas).
- [x] Export failure (e.g. canvas blocked) shows editor error banner and does not crash canvas state.
- [x] `npm run build` and `npm run lint` pass.

## Testing

- No `test` command declared in `AGENTS.md`; test gate off (`verification.logicTests: when-configured`). No new runner installed mid-feature per `coding-standards.md`.
- Pure helpers (`buildExportFilename`, padded bounds math, text wrap splitter) kept JSX-free and unit-ready for future `/tests` (Vitest `src/lib/exportPng.test.ts`).
- Evidence: build + lint + dev-server download check (Playwright already in devDeps, used ad-hoc for screenshot/download proof, not added as harness).

## Spec critique (red-team) and fixes applied

- Missing unhappy path (zero-size canvas on single node) -> added single-node done-when + padding contract.
- Missing unhappy path (export throws) -> added banner error contract, `exporting` reset in `finally`.
- Oversized step (lib + UI in one diff) -> split into step 1 (lib) and step 2 (wiring).
- Undefined contract (background/scale/filename) -> pinned `#fbfaf7`, DPR cap 2 / 4096px cap, filename sanitizer contract.
- Scope creep risk (viewport crop, PDF, badges) -> listed under non-goals; renderer draws clean map only.
- Vague done-when (clean PNG) -> made concrete: fitted + padded, readable at 100%, collapsed excluded, filename pattern.
- Missing testing plan while helpers are pure logic -> noted future Vitest file, kept helpers pure; no runner installed now.

## Findings

### 6/F-11 [P3] closed - Spec contract misstates export node stroke color

**File:** blueprint/context/current-feature.md:34
**Found:** 2026-09-04 by /audit (scope: current; lens: quality)
**Why it matters:** The spec contract said export nodes use stroke `#cbd5e1`, but the code (`src/lib/exportPng.ts:8`) uses `#334155`, which matches the live canvas (`--node-stroke` in `src/index.css:35` and `.node-circle` border). The implementation was correct; the archived spec would have misled future readers.
**Suggested fix:** One-word fix in `current-feature.md:34`: `#cbd5e1` to `#334155` (or reference `var(--node-stroke)`). No code change.
**Resolution:** Fixed 2026-09-04 - contract corrected to `#334155` with `var(--node-stroke)` reference. Closed 2026-09-04 by /audit re-examination (defect gone, no new defect).
