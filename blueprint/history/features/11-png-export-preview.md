# Feature 11: PNG export preview

**Status:** complete
**Completed:** 2026-09-06
**Branch:** `feature/png-export-preview` (squash-merged to `main`)

## Goal

Show a whole-tree fitted PNG preview inside the editor before download, so users can confirm framing and readability. Adds confirm/download plus cancel to the existing one-click export, keeping the same light background and filename.

## What was built

- **Step 1 - Preview dialog shell** - new `ExportPreviewDialog` (MUI `Dialog`) opened from the `AppHeader` Export button; title, `Cancel`/`Download` actions, placeholder, responsive sizing, `Escape`/backdrop close. Download initially passed through to the existing `exportMapAsPng` path.
- **Step 2 - Real fitted preview image** - preview generated in the Export click handler from the same inputs as download (`visibleNodes`, `layout.positions/edges/bounds` via `renderMapToCanvas` + `resolveExportScale`), displayed as a fitted `dataURL` image on `EXPORT_BACKGROUND`. Render failure surfaces in the dialog plus the editor error banner. An effect-based first draft failed lint (`set-state-in-effect`, ref-during-render), so generation moved into the click handler and the dialog stayed pure presentational. `dataURL` chosen over object URLs, so nothing needs revoking; state is cleared on close.
- **Step 3 - Confirm/download hardening** - single-flight guard (`exporting` disables dialog buttons and the header button), same `buildExportFilename` naming, download errors shown inside the dialog plus the editor banner while the dialog stays open, success closes the dialog. Focus return needed no code (MUI Dialog restores focus to Export PNG; verified in browser).
- **Repair F-02** - dialog palette hardcoded hex replaced with `TOKENS.border` / `TOKENS.muted` / `TOKENS.danger`.
- **Repair F-01** - committed Playwright test `export: preview opens, shows fitted image, and download closes it`.

## Files changed

- `src/components/canvas/ExportPreviewDialog.tsx` (new) - preview dialog UI.
- `src/pages/EditorPage.tsx` - preview state, preview generation, confirm/cancel wiring.
- `e2e/smoke.spec.ts` - focused export preview coverage.

## Data / contracts

No stored shape change. Reused `ExportBounds`, `ExportPosition`, `ExportEdge`, `Node[]`, and `computeLayout` output. Load-bearing `renderMapToCanvas`, `resolveExportScale`, `paddedExportBounds`, `buildExportFilename`, `EXPORT_BACKGROUND` unchanged; preview calls the same render path as download so preview equals file.

## Verification

- `npm run build` - pass
- `npm run lint` - pass
- `npm test` - 79 passed (no new pure logic, so no new unit tests)
- `npm run test:browser` - 7/7 passed (6 existing + 1 new)
- Temp Playwright probes during build (removed after passing): dialog open/cancel/Escape/backdrop, image `data:image/png` src, Download fires `*-mindmap.png` and closes, double-click yields 1 file, forced `toBlob` failure keeps dialog open with error, focus returns to Export PNG.
- Quality gates (regular, all `manual`): `/audit` ran twice (found F-01/F-02, then re-reviewed repairs to `closed`); `/check` and `/try` not requested.

## Findings

### 11/F-01 [P2] closed - No committed browser coverage for the new export preview flow

**File:** e2e/smoke.spec.ts
**Found:** 2026-09-06 by /audit (scope: current; lens: tests)
**Why it matters:** The Export button changed from direct download to open-preview-then-download, but no committed test opens the dialog. The existing smoke suite only asserts the button is visible, so a regression (dialog never opens, Download never fires) would pass all checks. The spec's Testing section predicted this coverage; it was verified with temp probes that were removed instead of committed.
**Suggested fix:** Add one focused Playwright test: open editor, click Export PNG, expect preview image visible, click Download, expect a `*-mindmap.png` download and dialog close.
**Resolution:** Repaired 2026-09-06 by /implement: added `export: preview opens, shows fitted image, and download closes it` to `e2e/smoke.spec.ts`; `npm run test:browser` passes 7/7. Awaiting /audit re-review.
**Re-review:** Closed 2026-09-06 by /audit: test present in `e2e/smoke.spec.ts`, follows file patterns, asserts dialog open, image `data:image/png` src, `*-mindmap.png` download, and dialog close; browser suite 7/7 green; repair introduced no new defect.

### 11/F-02 [P3] closed - Preview dialog hardcodes palette hex values instead of TOKENS

**File:** src/components/canvas/ExportPreviewDialog.tsx:46-54,62
**Found:** 2026-09-06 by /audit (scope: current; lens: quality)
**Why it matters:** The dialog inlines `#e2e8f0`, `#64748b` (duplicates of `TOKENS.border` / `TOKENS.muted`) and `#b91c1c` for errors (while `TOKENS.danger` is `#ef4444`). Token drift means a future palette change misses the dialog.
**Suggested fix:** Import `TOKENS` and use `TOKENS.border`, `TOKENS.muted`, `TOKENS.danger` (or `dangerSubtle`) for the placeholder border/text and download-error color.
**Resolution:** Repaired 2026-09-06 by /implement: dialog now uses `TOKENS.border`, `TOKENS.muted`, `TOKENS.danger`; no hardcoded hex remains; build and lint pass. Awaiting /audit re-review.
**Re-review:** Closed 2026-09-06 by /audit: `ExportPreviewDialog.tsx` uses `TOKENS` for all three values, no hex literals remain; lint clean; pure value swap with no new defect.
